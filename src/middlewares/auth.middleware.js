const jwt = require('jsonwebtoken');
const User = require('../models/user.model');
const Wallet = require('../models/wallet.model');
const { errorResponse } = require('../utils/response');
const logger = require('../utils/logger');
const config = require('../config/env');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return errorResponse(res, 'Authentication required', 401, 'AUTH_REQUIRED');
    }

    const token = authHeader.split(' ')[1];

    let decoded;
    try {
      decoded = jwt.verify(token, config.JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return errorResponse(res, 'Token expired', 401, 'TOKEN_EXPIRED');
      }
      return errorResponse(res, 'Invalid token', 401, 'INVALID_TOKEN');
    }

    const userId = decoded.userId || decoded.id;
    if (!userId) {
      return errorResponse(res, 'Invalid token payload', 401, 'INVALID_TOKEN');
    }

    const user = await User.findById(userId);

    if (!user) {
      return errorResponse(res, 'User not found', 401, 'USER_NOT_FOUND');
    }

    if (!user.isActive) {
      return errorResponse(res, 'Account deactivated', 403, 'ACCOUNT_DEACTIVATED');
    }

    if (user.changedPasswordAfter && user.changedPasswordAfter(decoded.iat)) {
      return errorResponse(res, 'Password changed, login again', 401, 'TOKEN_INVALID');
    }

    req.user = user;
    req.userId = user._id;
    req.token = token;

    next();
  } catch (error) {
    logger.error('Auth middleware error:', error);
    return errorResponse(res, 'Authentication failed', 500, 'AUTH_ERROR');
  }
};

const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      req.user = null;
      return next();
    }

    const token = authHeader.split(' ')[1];

    try {
      const decoded = jwt.verify(token, config.JWT_SECRET);
      const userId = decoded.userId || decoded.id;

      if (userId) {
        const user = await User.findById(userId);
        if (user && user.isActive) {
          req.user = user;
          req.userId = user._id;
          req.token = token;
        }
      }
    } catch (_) {
      req.user = null;
    }

    next();
  } catch (error) {
    logger.error('Optional auth error:', error);
    req.user = null;
    next();
  }
};

const requireBiometric = (req, res, next) => {
  if (!req.user) {
    return errorResponse(res, 'Authentication required', 401, 'AUTH_REQUIRED');
  }

  if (!req.user.biometricData?.isVerified) {
    return errorResponse(
      res,
      'Biometric verification required',
      403,
      'BIOMETRIC_REQUIRED'
    );
  }

  next();
};

const requireFacial = (req, res, next) => {
  if (!req.user) {
    return errorResponse(res, 'Authentication required', 401, 'AUTH_REQUIRED');
  }

  if (!req.user.biometricData?.isVerified) {
    return errorResponse(
      res,
      'Facial verification required',
      403,
      'FACIAL_REQUIRED'
    );
  }

  next();
};

const requireKYC = (req, res, next) => {
  if (!req.user) {
    return errorResponse(res, 'Authentication required', 401, 'AUTH_REQUIRED');
  }

  if (!req.user.isKYCComplete()) {
    return errorResponse(
      res,
      'KYC verification required',
      403,
      'KYC_REQUIRED'
    );
  }

  next();
};

const requireWallet = async (req, res, next) => {
  if (!req.user) {
    return errorResponse(res, 'Authentication required', 401, 'AUTH_REQUIRED');
  }

  const wallet = await Wallet.findPrimaryWallet(
    req.user._id,
    config.BLOCKCHAIN_NETWORK
  );

  if (!wallet) {
    return errorResponse(
      res,
      'Wallet not found. Create wallet first.',
      400,
      'WALLET_NOT_FOUND'
    );
  }

  req.wallet = wallet;
  next();
};

const verifySignature = (req, res, next) => {
  const signature = req.headers['x-signature'];

  if (!signature) {
    return errorResponse(res, 'Signature missing', 400, 'SIGNATURE_REQUIRED');
  }

  next();
};

module.exports = {
  authenticate,
  optionalAuth,
  requireBiometric,
  requireFacial,
  requireKYC,
  requireWallet,
  verifySignature
};
