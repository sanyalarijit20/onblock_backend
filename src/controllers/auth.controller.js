const jwt = require('jsonwebtoken');
const User = require('../models/user.model');
const config = require('../config/env');
const { successResponse, errorResponse } = require('../utils/response');
const logger = require('../utils/logger');

const signToken = (id, secret, expire) => {
    return jwt.sign({ id }, secret, { expiresIn: expire });
};

const createSendToken = async (user, statusCode, res) => {
    const accessToken = signToken(user._id, config.JWT_SECRET, config.JWT_EXPIRE);
    const refreshToken = signToken(user._id, config.JWT_REFRESH_SECRET, config.JWT_REFRESH_EXPIRE);

    user.refreshToken = refreshToken;
    user.lastLogin = Date.now();
    await user.save({ validateBeforeSave: false });

    user.password = undefined;
    user.refreshToken = undefined;

    res.status(statusCode).json({
        success: true,
        token: accessToken,
        refreshToken: refreshToken,
        data: { user }
    });
};

exports.signup = async (req, res) => {
    try {
        const { email, password, firstName, lastName, phoneNumber } = req.body;

        const existingUser = await User.findOne({ $or: [{ email }, { phoneNumber }] });
        if (existingUser) {
            return errorResponse(res, 'User with this email or phone already exists', 400);
        }

        const newUser = await User.create({
            email,
            password,
            firstName,
            lastName,
            phoneNumber
        });

        createSendToken(newUser, 201, res);
    } catch (err) {
        logger.error('Signup Error:', err);
        errorResponse(res, err.message, 500);
    }
};

exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return errorResponse(res, 'Please provide email and password', 400);
        }

        const user = await User.findOne({ email }).select('+password +loginAttempts +lockUntil');

        if (!user) {
            return errorResponse(res, 'Invalid credentials', 401);
        }

        if (user.lockUntil && user.lockUntil > Date.now()) {
            return errorResponse(res, 'Account locked. Try again later', 403);
        }

        const isMatch = await user.comparePassword(password);

        if (!isMatch) {
            user.loginAttempts += 1;
            if (user.loginAttempts >= 5) {
                user.lockUntil = Date.now() + 30 * 60 * 1000; 
            }
            await user.save({ validateBeforeSave: false });
            return errorResponse(res, 'Invalid credentials', 401);
        }

        user.loginAttempts = 0;
        user.lockUntil = undefined;
        user.lastLoginIP = req.ip;
        
        createSendToken(user, 200, res);
    } catch (err) {
        logger.error('Login Error:', err);
        errorResponse(res, 'Internal Server Error', 500);
    }
};

exports.refreshToken = async (req, res) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return errorResponse(res, 'Refresh token required', 400);
        }

        const decoded = jwt.verify(refreshToken, config.JWT_REFRESH_SECRET);
        const user = await User.findById(decoded.id).select('+refreshToken');

        if (!user || user.refreshToken !== refreshToken) {
            return errorResponse(res, 'Invalid refresh token', 401);
        }

        const newAccessToken = signToken(user._id, config.JWT_SECRET, config.JWT_EXPIRE);
        
        res.status(200).json({
            success: true,
            token: newAccessToken
        });
    } catch (err) {
        errorResponse(res, 'Invalid or expired refresh token', 401);
    }
};

exports.logout = async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        if (user) {
            user.refreshToken = undefined;
            await user.save({ validateBeforeSave: false });
        }
        successResponse(res, 'Logged out successfully');
    } catch (err) {
        errorResponse(res, 'Logout failed', 500);
    }
};

exports.getMe = async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        successResponse(res, 'User profile fetched', user);
    } catch (err) {
        errorResponse(res, 'Failed to fetch profile', 500);
    }
};

exports.updateProfile = async (req, res) => {
    try {
        const allowedUpdates = ['firstName', 'lastName', 'gender', 'dateOfBirth', 'address', 'preferences'];
        const updates = Object.keys(req.body);
        const isValidOperation = updates.every(update => allowedUpdates.includes(update));

        if (!isValidOperation) {
            return errorResponse(res, 'Invalid update fields', 400);
        }

        const user = await User.findByIdAndUpdate(req.userId, req.body, {
            new: true,
            runValidators: true
        });

        successResponse(res, 'Profile updated successfully', user);
    } catch (err) {
        errorResponse(res, err.message, 500);
    }
};