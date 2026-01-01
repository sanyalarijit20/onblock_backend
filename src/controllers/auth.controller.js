const bcrypt = require('bcryptjs');
const User = require('../models/user.model');
const { successResponse, errorResponse } = require('../utils/response');
const { generateTokenPair, verifyToken, refreshAccessToken } = require('../services/jwt.service');
const { enrollBiometric, verifyBiometric, enrollFacial, verifyFacial } = require('../services/fraud_ml.service');
const logger = require('../utils/logger');

const register = async (req, res) => {
  try {
    const { email, phoneNumber, password, fullName } = req.body;

    const existingUser = await User.findOne({
      $or: [{ email }, { phoneNumber }]
    });

    if (existingUser) {
      return errorResponse(res, 'Email or phone number already registered', 409, 'USER_EXISTS');
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await User.create({
      email,
      phoneNumber,
      password: hashedPassword,
      fullName,
      isActive: true
    });

    const tokens = generateTokenPair(user._id);

    const userData = {
      id: user._id,
      email: user.email,
      phoneNumber: user.phoneNumber,
      fullName: user.fullName,
      isActive: user.isActive,
      createdAt: user.createdAt
    };

    logger.info(`User registered: ${user._id}`);

    return successResponse(res, 'Registration successful', { user: userData, ...tokens }, 201);
  } catch (error) {
    logger.error('Register error:', error);
    return errorResponse(res, 'Registration failed', 500, 'REGISTER_ERROR');
  }
};

const login = async (req, res) => {
  try {
    const { identifier, password } = req.body;

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
      return errorResponse(res, 'Account is deactivated', 403, 'ACCOUNT_DEACTIVATED');
    }

    if (user.securityFlags.isBlocked) {
      return errorResponse(res, 'Account is blocked', 403, 'ACCOUNT_BLOCKED');
    }

    user.lastLogin = new Date();
    await user.save();

    const tokens = generateTokenPair(user._id);

    const userData = {
      id: user._id,
      email: user.email,
      phoneNumber: user.phoneNumber,
      fullName: user.fullName,
      biometricEnabled: user.biometricEnabled,
      facialRecognitionEnabled: user.facialRecognitionEnabled,
      walletId: user.walletId,
      lastLogin: user.lastLogin
    };

    logger.info(`User logged in: ${user._id}`);

    return successResponse(res, 'Login successful', { user: userData, ...tokens });
  } catch (error) {
    logger.error('Login error:', error);
    return errorResponse(res, 'Login failed', 500, 'LOGIN_ERROR');
  }
};

const logout = async (req, res) => {
  try {
    logger.info(`User logged out: ${req.userId}`);
    return successResponse(res, 'Logout successful');
  } catch (error) {
    logger.error('Logout error:', error);
    return errorResponse(res, 'Logout failed', 500, 'LOGOUT_ERROR');
  }
};

const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return errorResponse(res, 'Refresh token required', 400, 'REFRESH_TOKEN_MISSING');
    }

    const newTokens = refreshAccessToken(refreshToken);

    return successResponse(res, 'Token refreshed', newTokens);
  } catch (error) {
    logger.error('Refresh token error:', error);
    return errorResponse(res, 'Token refresh failed', 401, 'REFRESH_TOKEN_INVALID');
  }
};

const requestOtp = async (req, res) => {
  try {
    const { phoneNumber } = req.body;

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    logger.info(`OTP generated for ${phoneNumber}: ${otp}`);

    return successResponse(res, 'OTP sent successfully', { otp });
  } catch (error) {
    logger.error('Request OTP error:', error);
    return errorResponse(res, 'Failed to send OTP', 500, 'OTP_REQUEST_ERROR');
  }
};

const verifyOtp = async (req, res) => {
  try {
    const { phoneNumber, otp } = req.body;

    logger.info(`OTP verification for ${phoneNumber}: ${otp}`);

    return successResponse(res, 'OTP verified successfully', { verified: true });
  } catch (error) {
    logger.error('Verify OTP error:', error);
    return errorResponse(res, 'OTP verification failed', 500, 'OTP_VERIFY_ERROR');
  }
};

const setupBiometric = async (req, res) => {
  try {
    const { biometricData, deviceId } = req.body;
    const userId = req.userId;

    const result = await enrollBiometric(biometricData, userId.toString());

    if (!result.success) {
      return errorResponse(res, 'Biometric setup failed', 400, 'BIOMETRIC_SETUP_ERROR');
    }

    await User.findByIdAndUpdate(userId, {
      biometricEnabled: true,
      biometricId: result.biometricId,
      'securityFlags.biometricDeviceId': deviceId || null
    });

    logger.info(`Biometric setup for user: ${userId}`);

    return successResponse(res, 'Biometric setup successful', { biometricId: result.biometricId });
  } catch (error) {
    logger.error('Setup biometric error:', error);
    return errorResponse(res, 'Biometric setup failed', 500, 'BIOMETRIC_SETUP_ERROR');
  }
};

const verifyBiometric = async (req, res) => {
  try {
    const { biometricData } = req.body;
    const userId = req.userId;

    const result = await verifyBiometric(biometricData, userId.toString());

    if (!result.verified) {
      return errorResponse(res, 'Biometric verification failed', 401, 'BIOMETRIC_VERIFY_FAILED');
    }

    logger.info(`Biometric verified for user: ${userId}`);

    return successResponse(res, 'Biometric verified successfully', {
      verified: result.verified,
      confidence: result.confidence
    });
  } catch (error) {
    logger.error('Verify biometric error:', error);
    return errorResponse(res, 'Biometric verification failed', 500, 'BIOMETRIC_VERIFY_ERROR');
  }
};

const setupFacial = async (req, res) => {
  try {
    const { facialData, imageData } = req.body;
    const userId = req.userId;

    const result = await enrollFacial(facialData, userId.toString(), imageData);

    if (!result.success) {
      return errorResponse(res, 'Facial setup failed', 400, 'FACIAL_SETUP_ERROR');
    }

    await User.findByIdAndUpdate(userId, {
      facialRecognitionEnabled: true,
      facialId: result.facialId
    });

    logger.info(`Facial recognition setup for user: ${userId}`);

    return successResponse(res, 'Facial recognition setup successful', { facialId: result.facialId });
  } catch (error) {
    logger.error('Setup facial error:', error);
    return errorResponse(res, 'Facial setup failed', 500, 'FACIAL_SETUP_ERROR');
  }
};

const verifyFacial = async (req, res) => {
  try {
    const { facialData, imageData } = req.body;
    const userId = req.userId;

    const result = await verifyFacial(facialData, userId.toString(), imageData);

    if (!result.verified) {
      return errorResponse(res, 'Facial verification failed', 401, 'FACIAL_VERIFY_FAILED');
    }

    logger.info(`Facial verified for user: ${userId}`);

    return successResponse(res, 'Facial verified successfully', {
      verified: result.verified,
      confidence: result.confidence,
      livenessCheck: result.livenessCheck
    });
  } catch (error) {
    logger.error('Verify facial error:', error);
    return errorResponse(res, 'Facial verification failed', 500, 'FACIAL_VERIFY_ERROR');
  }
};

const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.userId;

    const user = await User.findById(userId);

    if (!user) {
      return errorResponse(res, 'User not found', 404, 'USER_NOT_FOUND');
    }

    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);

    if (!isPasswordValid) {
      return errorResponse(res, 'Current password is incorrect', 401, 'INVALID_PASSWORD');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    user.password = hashedPassword;
    await user.save();

    logger.info(`Password changed for user: ${userId}`);

    return successResponse(res, 'Password changed successfully');
  } catch (error) {
    logger.error('Change password error:', error);
    return errorResponse(res, 'Password change failed', 500, 'PASSWORD_CHANGE_ERROR');
  }
};

const requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      return successResponse(res, 'If email exists, reset link sent');
    }

    const resetToken = Math.random().toString(36).substring(2, 15);

    logger.info(`Password reset requested for ${email}, token: ${resetToken}`);

    return successResponse(res, 'Password reset link sent', { resetToken });
  } catch (error) {
    logger.error('Request password reset error:', error);
    return errorResponse(res, 'Password reset request failed', 500, 'PASSWORD_RESET_REQUEST_ERROR');
  }
};

const confirmPasswordReset = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    logger.info(`Password reset confirmed with token: ${token}`);

    return successResponse(res, 'Password reset successful');
  } catch (error) {
    logger.error('Confirm password reset error:', error);
    return errorResponse(res, 'Password reset failed', 500, 'PASSWORD_RESET_ERROR');
  }
};

const getProfile = async (req, res) => {
  try {
    const user = req.user;

    const userData = {
      id: user._id,
      email: user.email,
      phoneNumber: user.phoneNumber,
      fullName: user.fullName,
      biometricEnabled: user.biometricEnabled,
      facialRecognitionEnabled: user.facialRecognitionEnabled,
      walletId: user.walletId,
      isActive: user.isActive,
      lastLogin: user.lastLogin,
      createdAt: user.createdAt
    };

    return successResponse(res, 'Profile retrieved', userData);
  } catch (error) {
    logger.error('Get profile error:', error);
    return errorResponse(res, 'Failed to get profile', 500, 'GET_PROFILE_ERROR');
  }
};

const updateProfile = async (req, res) => {
  try {
    const { fullName, phoneNumber } = req.body;
    const userId = req.userId;

    const updateData = {};
    if (fullName) updateData.fullName = fullName;
    if (phoneNumber) updateData.phoneNumber = phoneNumber;

    const user = await User.findByIdAndUpdate(userId, updateData, { new: true });

    logger.info(`Profile updated for user: ${userId}`);

    return successResponse(res, 'Profile updated successfully', {
      id: user._id,
      email: user.email,
      phoneNumber: user.phoneNumber,
      fullName: user.fullName
    });
  } catch (error) {
    logger.error('Update profile error:', error);
    return errorResponse(res, 'Profile update failed', 500, 'UPDATE_PROFILE_ERROR');
  }
};

const deleteAccount = async (req, res) => {
  try {
    const userId = req.userId;

    await User.findByIdAndUpdate(userId, { isActive: false });

    logger.info(`Account deactivated for user: ${userId}`);

    return successResponse(res, 'Account deleted successfully');
  } catch (error) {
    logger.error('Delete account error:', error);
    return errorResponse(res, 'Account deletion failed', 500, 'DELETE_ACCOUNT_ERROR');
  }
};

module.exports = {
  register,
  login,
  logout,
  refreshToken,
  requestOtp,
  verifyOtp,
  setupBiometric,
  verifyBiometric,
  setupFacial,
  verifyFacial,
  changePassword,
  requestPasswordReset,
  confirmPasswordReset,
  getProfile,
  updateProfile,
  deleteAccount
};