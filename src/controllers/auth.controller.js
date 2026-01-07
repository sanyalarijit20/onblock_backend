const jwt = require('jsonwebtoken');
const User = require('../models/user.model');
const config = require('../config/env');
const { successResponse, errorResponse } = require('../utils/response');
const logger = require('../utils/logger');

// Helper for JWT
const signToken = (id, secret, expire) => {
    return jwt.sign({ id }, secret, { expiresIn: expire });
};

// 1. REGISTER
exports.register = async (req, res) => {
    try {
        const { email, password, firstName, lastName, phoneNumber } = req.body;
        const userExists = await User.findOne({ $or: [{ email }, { phoneNumber }] });
        if (userExists) return errorResponse(res, 'User already exists', 400);

        const user = await User.create({ email, password, firstName, lastName, phoneNumber });
        const token = signToken(user._id, config.JWT_SECRET, config.JWT_EXPIRE);

        return successResponse(res, { user, token }, 'Registration successful', 201);
    } catch (err) {
        logger.error('Register Error:', err);
        return errorResponse(res, err.message, 500);
    }
};

// 2. LOGIN
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email }).select('+password');
        if (!user || !(await user.comparePassword(password))) {
            return errorResponse(res, 'Invalid credentials', 401);
        }

        const token = signToken(user._id, config.JWT_SECRET, config.JWT_EXPIRE);
        const refreshToken = signToken(user._id, config.JWT_REFRESH_SECRET, config.JWT_REFRESH_EXPIRE);

        user.refreshToken = refreshToken;
        await user.save({ validateBeforeSave: false });

        return successResponse(res, { token, refreshToken }, 'Login successful');
    } catch (err) {
        return errorResponse(res, 'Internal server error', 500);
    }
};

// 3. PROFILE & ACCOUNT
exports.getProfile = async (req, res) => {
    return successResponse(res, req.user, 'Profile fetched');
};

exports.updateProfile = async (req, res) => {
    try {
        const user = await User.findByIdAndUpdate(req.user._id, req.body, { new: true, runValidators: true });
        return successResponse(res, user, 'Profile updated');
    } catch (err) {
        return errorResponse(res, err.message, 500);
    }
};

exports.deleteAccount = async (req, res) => {
    await User.findByIdAndDelete(req.user._id);
    return successResponse(res, null, 'Account deleted');
};

// 4. TOKEN & LOGOUT
exports.refreshToken = async (req, res) => {
    const { refreshToken } = req.body;
    if (!refreshToken) return errorResponse(res, 'No token provided', 401);
    try {
        const decoded = jwt.verify(refreshToken, config.JWT_REFRESH_SECRET);
        const user = await User.findById(decoded.id);
        if (!user) return errorResponse(res, 'User not found', 401);

        const newToken = signToken(user._id, config.JWT_SECRET, config.JWT_EXPIRE);
        return successResponse(res, { token: newToken });
    } catch (err) {
        return errorResponse(res, 'Invalid Refresh Token', 401);
    }
};

exports.logout = async (req, res) => {
    const user = await User.findById(req.user._id);
    user.refreshToken = undefined;
    await user.save({ validateBeforeSave: false });
    return successResponse(res, null, 'Logged out');
};

// 5. PLACEHOLDERS (To stop the crash)
// You need to implement these based on your ML/SMS service
exports.requestOtp = async (req, res) => successResponse(res, null, 'OTP Sent (Placeholder)');
exports.verifyOtp = async (req, res) => successResponse(res, null, 'OTP Verified (Placeholder)');
exports.setupBiometric = async (req, res) => successResponse(res, null, 'Biometric Setup (Placeholder)');
exports.verifyBiometric = async (req, res) => successResponse(res, null, 'Biometric Verified (Placeholder)');
exports.setupFacial = async (req, res) => successResponse(res, null, 'Facial Setup (Placeholder)');
exports.verifyFacial = async (req, res) => successResponse(res, null, 'Facial Verified (Placeholder)');
exports.changePassword = async (req, res) => successResponse(res, null, 'Password Changed (Placeholder)');
exports.requestPasswordReset = async (req, res) => successResponse(res, null, 'Reset Link Sent (Placeholder)');
exports.confirmPasswordReset = async (req, res) => successResponse(res, null, 'Password Reset (Placeholder)');