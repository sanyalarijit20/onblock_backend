const bcrypt = require('bcryptjs');
const User = require('../models/user.model');
const { successResponse, errorResponse } = require('../utils/response');
const {
  generateTokenPair,
  refreshAccessToken
} = require('../services/jwt.service');
const logger = require('../utils/logger');

const DEMO_MODE = process.env.DEMO_MODE === 'true';

/* =========================
   REGISTER (DEMO BYPASS)
========================= */
const register = async (req, res) => {
  try {
    let { email, phoneNumber, password, fullName } = req.body;

    // DEMO MODE: auto-fill everything
    if (DEMO_MODE) {
      email = email || `demo_${Date.now()}@example.com`;
      phoneNumber = phoneNumber || `${Math.floor(9000000000 + Math.random() * 999999999)}`;
      fullName = fullName || 'Demo User';
      password = password || 'Demo@1234';
    }

    // Check existing user
    let user = await User.findOne({
      $or: [{ email }, { phoneNumber }]
    });

    // DEMO MODE: auto-login if user exists
    if (user && DEMO_MODE) {
      const tokens = generateTokenPair(user._id.toString());
      return successResponse(res, 'Demo user logged in', {
        user,
        ...tokens
      });
    }

    if (user) {
      return errorResponse(res, 'User already exists', 409, 'USER_EXISTS');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    user = await User.create({
      email,
      phoneNumber,
      password: hashedPassword,
      fullName,
      isActive: true
    });

    const tokens = generateTokenPair(user._id.toString());

    return successResponse(res, 'Registration successful', {
      user,
      ...tokens
    }, 201);

  } catch (error) {
    logger.error('REGISTER ERROR:', error);
    return errorResponse(res, error.message, 500, 'REGISTER_ERROR');
  }
};

/* =========================
   LOGIN (DEMO BYPASS)
========================= */
const login = async (req, res) => {
  try {
    const { identifier, password } = req.body;

    let user = await User.findOne({
      $or: [{ email: identifier }, { phoneNumber: identifier }]
    });

    // DEMO MODE: auto-create + login
    if (!user && DEMO_MODE) {
      user = await User.create({
        email: identifier || `demo_${Date.now()}@example.com`,
        phoneNumber: `${Math.floor(9000000000 + Math.random() * 999999999)}`,
        password: await bcrypt.hash('Demo@1234', 10),
        fullName: 'Demo User',
        isActive: true
      });
    }

    if (!user) {
      return errorResponse(res, 'Invalid credentials', 401, 'INVALID_CREDENTIALS');
    }

    if (!DEMO_MODE) {
      const valid = await bcrypt.compare(password, user.password);
      if (!valid) {
        return errorResponse(res, 'Invalid credentials', 401, 'INVALID_CREDENTIALS');
      }
    }

    user.lastLogin = new Date();
    await user.save();

    const tokens = generateTokenPair(user._id.toString());

    return successResponse(res, 'Login successful', {
      user,
      ...tokens
    });

  } catch (error) {
    logger.error('LOGIN ERROR:', error);
    return errorResponse(res, error.message, 500, 'LOGIN_ERROR');
  }
};

/* =========================
   REFRESH TOKEN
========================= */
const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    const tokens = refreshAccessToken(refreshToken);
    return successResponse(res, 'Token refreshed', tokens);
  } catch (error) {
    return errorResponse(res, 'Invalid refresh token', 401, 'REFRESH_TOKEN_INVALID');
  }
};

/* =========================
   PROFILE
========================= */
const getProfile = async (req, res) => {
  try {
    return successResponse(res, 'Profile', req.user);
  } catch (error) {
    return errorResponse(res, 'Profile fetch failed', 500, 'PROFILE_ERROR');
  }
};

module.exports = {
  register,
  login,
  refreshToken,
  getProfile
};
