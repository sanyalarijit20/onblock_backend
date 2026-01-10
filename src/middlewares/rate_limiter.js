const rateLimit = require('express-rate-limit');
const { errorResponse } = require('../utils/response');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true,
  handler: (req, res) => {
    return errorResponse(
      res,
      'Too many authentication attempts. Please try again after 15 minutes.',
      429,
      'RATE_LIMIT_EXCEEDED'
    );
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const transactionLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: false,
  handler: (req, res) => {
    return errorResponse(
      res,
      'Too many transaction requests. Please slow down.',
      429,
      'TRANSACTION_RATE_LIMIT'
    );
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const generalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 100,
  skipSuccessfulRequests: false,
  handler: (req, res) => {
    return errorResponse(
      res,
      'Too many requests. Please try again later.',
      429,
      'GENERAL_RATE_LIMIT'
    );
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const otpLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 3,
  skipSuccessfulRequests: false,
  handler: (req, res) => {
    return errorResponse(
      res,
      'Too many OTP requests. Please wait 5 minutes.',
      429,
      'OTP_RATE_LIMIT'
    );
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const biometricLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: false,
  handler: (req, res) => {
    return errorResponse(
      res,
      'Too many biometric verification attempts.',
      429,
      'BIOMETRIC_RATE_LIMIT'
    );
  },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  authLimiter,
  transactionLimiter,
  generalLimiter,
  otpLimiter,
  biometricLimiter
};