const bcrypt = require('bcryptjs');
const User = require('../models/user.model');
const { successResponse, errorResponse } = require('../utils/response');
const {
  generateTokenPair,
  refreshAccessToken
} = require('../services/jwt.service');
const {
  enrollBiometric,
  verifyBiometric: verifyBiometricML,
  enrollFacial,
  verifyFacial: verifyFacialML
} = require('../services/fraud_ml.service');
const logger = require('../utils/logger');

/* =========================
   REGISTER
========================= */
const register = async (req, res) => {
  try {
    const { email, phoneNumber, password, fullName } = req.body;

    // Hard guard
    if (!email || !phoneNumber || !password || !fullName) {
      return errorResponse(
        res,
        'Required fields missing',
        400,
        'MISSING_FIELDS'
      );
    }

    // Check existing user
    const existingUser = await User.findOne({
      $or: [{ email }, { phoneNumber }]
    });

    if (existingUser) {
      return errorResponse(
        res,
        'Email or phone number already registered',
        409,
        'USER_EXISTS'
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const user = await User.create({
      email,
      phoneNumber,
      password: hashedPassword,
      fullName,
      isActive: true
    });

    // Generate tokens
    const tokens = generateTokenPair(user._id.toString());

    logger.info(`User registered: ${user._id}`);

    return successResponse(
      res,
      'Registration successful',
      {
        user: {
          id: user._id,
          email: user.email,
          phoneNumber: user.phoneNumber,
          fullName: user.fullName,
          isActive: user.isActive,
          createdAt: user.createdAt
        },
        ...tokens
      },
      201
    );
  } catch (error) {
    logger.error('REGISTER ERROR:', error);
    return errorResponse(
      res,
      error.message || 'Registration failed',
      500,
      'REGISTER_ERROR'
    );
  }
};

/* =========================
   LOGIN
========================= */
const login = async (req, res) => {
  try {
    const { identifier, password, biometricData, facialData, imageData } =
      req.body;

    if (!identifier || !password || !biometricData) {
      return errorResponse(
        res,
        'Missing login credentials',
        400,
        'LOGIN_DATA_MISSING'
      );
    }

    const user = await User.findOne({
      $or: [{ email: identifier }, { phoneNumber: identifier }]
    });

    if (!user) {
      return errorResponse(res, 'Invalid credentials', 401, 'INVALID_CREDENTIALS');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return errorResponse(res, 'Invalid credentials', 401, 'INVALID_CREDENTIALS');
    }

    if (!user.isActive) {
      return errorResponse(res, 'Account deactivated', 403, 'ACCOUNT_DEACTIVATED');
    }

    // Biometric verification
    const biometricResult = await verifyBiometricML(
      biometricData,
      user._id.toString()
    );

    if (!biometricResult?.verified) {
      return errorResponse(
        res,
        'Biometric verification failed',
        401,
        'BIOMETRIC_VERIFY_FAILED'
      );
    }

    // Optional facial verification
    if (facialData) {
      const facialResult = await verifyFacialML(
        facialData,
        user._id.toString(),
        imageData
      );

      if (!facialResult?.verified) {
        return errorResponse(
          res,
          'Facial verification failed',
          401,
          'FACIAL_VERIFY_FAILED'
        );
      }
    }

    user.lastLogin = new Date();
    await user.save();

    const tokens = generateTokenPair(user._id.toString());

    return successResponse(res, 'Login successful', {
      user: {
        id: user._id,
        email: user.email,
        phoneNumber: user.phoneNumber,
        fullName: user.fullName,
        lastLogin: user.lastLogin
      },
      ...tokens
    });
  } catch (error) {
    logger.error('LOGIN ERROR:', error);
    return errorResponse(res, 'Login failed', 500, 'LOGIN_ERROR');
  }
};

/* =========================
   REFRESH TOKEN
========================= */
const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return errorResponse(
        res,
        'Refresh token missing',
        400,
        'REFRESH_TOKEN_MISSING'
      );
    }

    const newTokens = refreshAccessToken(refreshToken);
    return successResponse(res, 'Token refreshed', newTokens);
  } catch (error) {
    logger.error('REFRESH TOKEN ERROR:', error);
    return errorResponse(res, 'Invalid refresh token', 401, 'REFRESH_TOKEN_INVALID');
  }
};

/* =========================
   PROFILE
========================= */
const getProfile = async (req, res) => {
  try {
    const user = req.user;
    return successResponse(res, 'Profile retrieved', {
      id: user._id,
      email: user.email,
      phoneNumber: user.phoneNumber,
      fullName: user.fullName,
      isActive: user.isActive,
      lastLogin: user.lastLogin,
      createdAt: user.createdAt
    });
  } catch (error) {
    logger.error('GET PROFILE ERROR:', error);
    return errorResponse(res, 'Failed to get profile', 500, 'GET_PROFILE_ERROR');
  }
};

/* =========================
   EXPORTS
========================= */
module.exports = {
  register,
  login,
  refreshToken,
  getProfile
};
