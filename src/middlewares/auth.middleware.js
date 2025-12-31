const jwt = require('jsonwebtoken');
const User = require('../models/user.model');
const { errorResponse } = require('../utils/response');
const logger = require('../utils/logger');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return errorResponse(res, 'Authorization header missing', 401, 'AUTH_HEADER_MISSING');
    }

    if (!authHeader.startsWith('Bearer ')) {
      return errorResponse(res, 'Invalid authorization format. Use Bearer token', 401, 'INVALID_AUTH_FORMAT');
    }

    const token = authHeader.substring(7);

    if (!token || token.trim() === '') {
      return errorResponse(res, 'Token not provided', 401, 'TOKEN_MISSING');
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtError) {
      if (jwtError.name === 'TokenExpiredError') {
        return errorResponse(res, 'Token has expired', 401, 'TOKEN_EXPIRED');
      }
      if (jwtError.name === 'JsonWebTokenError') {
        return errorResponse(res, 'Invalid token', 401, 'TOKEN_INVALID');
      }
      throw jwtError;
    }

    const userId = decoded.userId || decoded.id;

    if (!userId) {
      return errorResponse(res, 'Invalid token payload', 401, 'INVALID_TOKEN_PAYLOAD');
    }

    const user = await User.findById(userId).select('-__v');

    if (!user) {
      return errorResponse(res, 'User not found', 401, 'USER_NOT_FOUND');
    }

    if (!user.isActive) {
      return errorResponse(res, 'Account is deactivated', 403, 'ACCOUNT_DEACTIVATED');
    }

    if (user.securityFlags.isBlocked) {
      return errorResponse(
        res, 
        'Account has been blocked due to security concerns. Please contact support.', 
        403, 
        'ACCOUNT_BLOCKED'
      );
    }

    req.user = user;
    req.userId = user._id;
    req.token = token;

    logger.info(`User authenticated: ${user._id}`);

    next();

  } catch (error) {
    logger.error('Authentication error:', error);
    return errorResponse(res, 'Authentication failed', 500, 'AUTH_ERROR');
  }
};

const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      req.user = null;
      req.userId = null;
      return next();
    }

    const token = authHeader.substring(7);

    if (!token || token.trim() === '') {
      req.user = null;
      req.userId = null;
      return next();
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const userId = decoded.userId || decoded.id;

      if (userId) {
        const user = await User.findById(userId).select('-__v');
        
        if (user && user.isActive && !user.securityFlags.isBlocked) {
          req.user = user;
          req.userId = user._id;
          req.token = token;
        } else {
          req.user = null;
          req.userId = null;
        }
      }
    } catch (jwtError) {
      req.user = null;
      req.userId = null;
    }

    next();

  } catch (error) {
    logger.error('Optional auth error:', error);
    req.user = null;
    req.userId = null;
    next();
  }
};

const requireBiometric = (req, res, next) => {
  if (!req.user) {
    return errorResponse(res, 'Authentication required', 401, 'AUTH_REQUIRED');
  }

  if (!req.user.biometricEnabled) {
    return errorResponse(
      res, 
      'Biometric verification required for this action', 
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

  if (!req.user.facialRecognitionEnabled) {
    return errorResponse(
      res, 
      'Facial recognition required for this action', 
      403, 
      'FACIAL_REQUIRED'
    );
  }

  next();
};

const requireFullVerification = (req, res, next) => {
  if (!req.user) {
    return errorResponse(res, 'Authentication required', 401, 'AUTH_REQUIRED');
  }

  if (!req.user.biometricEnabled || !req.user.facialRecognitionEnabled) {
    return errorResponse(
      res, 
      'Full biometric and facial verification required', 
      403, 
      'FULL_VERIFICATION_REQUIRED'
    );
  }

  next();
};

const requireWallet = (req, res, next) => {
  if (!req.user) {
    return errorResponse(res, 'Authentication required', 401, 'AUTH_REQUIRED');
  }

  if (!req.user.walletId) {
    return errorResponse(
      res, 
      'Wallet not found. Please create a wallet first.', 
      400, 
      'WALLET_NOT_FOUND'
    );
  }

  next();
};

const verifySignature = (req, res, next) => {
  const signature = req.headers['x-signature'];
  
  if (!signature) {
    return errorResponse(res, 'Signature required', 400, 'SIGNATURE_MISSING');
  }
  
  next();
};

module.exports = {
  authenticate,
  optionalAuth,
  requireBiometric,
  requireFacial,
  requireFullVerification,
  requireWallet,
  verifySignature
};