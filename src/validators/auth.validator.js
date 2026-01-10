const { body, validationResult } = require('express-validator');
const { errorResponse } = require('../utils/response');

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return errorResponse(
      res,
      'Validation failed',
      400,
      'VALIDATION_ERROR',
      errors.array()
    );
  }
  next();
};

const validateRegister = [
  body('email').trim().isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('phoneNumber').trim().isMobilePhone().withMessage('Valid phone number is required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('firstName').trim().notEmpty().withMessage('First name is required'),
  body('lastName').trim().notEmpty().withMessage('Last name is required'),
  handleValidationErrors
];

const validateLogin = [
  body('identifier').trim().notEmpty().withMessage('Email or phone number is required'),
  body('password').notEmpty().withMessage('Password is required'),
  handleValidationErrors
];

/**
 * NEW: Validator for Facial Identity Setup
 * Validates facial feature data and the reference image sent from Flutter
 */
const validateFacialSetup = [
  body('facialData').notEmpty().withMessage('Facial identity data is required'),
  body('imageData').notEmpty().withMessage('Face reference image is required'),
  handleValidationErrors
];

/**
 * NEW: Validator for Biometric Device Setup
 */
const validateBiometricSetup = [
  body('biometricData').notEmpty().withMessage('Biometric token is required'),
  body('deviceId').optional().trim().isString(),
  handleValidationErrors
];

// ... other validators preserved from your existing code ...
const validateOtpRequest = [
  body('phoneNumber').trim().isMobilePhone().withMessage('Valid phone number is required'),
  handleValidationErrors
];

const validateOtpVerify = [
  body('phoneNumber').trim().isMobilePhone().withMessage('Valid phone number is required'),
  body('otp').trim().isLength({ min: 6, max: 6 }).isNumeric().withMessage('Valid 6-digit OTP is required'),
  handleValidationErrors
];

const validateBiometricVerify = [
  body('biometricData').notEmpty().withMessage('Biometric data is required').isString(),
  handleValidationErrors
];

const validatePasswordChange = [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters'),
  body('confirmPassword').custom((value, { req }) => value === req.body.newPassword).withMessage('Passwords do not match'),
  handleValidationErrors
];

const validatePasswordReset = [
  body('email').trim().isEmail().normalizeEmail().withMessage('Valid email is required'),
  handleValidationErrors
];

const validatePasswordResetConfirm = [
  body('token').notEmpty().withMessage('Reset token is required'),
  body('newPassword').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  handleValidationErrors
];

module.exports = {
  validateRegister,
  validateLogin,
  validateFacialSetup,
  validateBiometricSetup,
  validateOtpRequest,
  validateOtpVerify,
  validateBiometricVerify,
  validatePasswordChange,
  validatePasswordReset,
  validatePasswordResetConfirm
};