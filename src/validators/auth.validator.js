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
  body('email')
    .trim()
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  
  body('phoneNumber')
    .trim()
    .isMobilePhone()
    .withMessage('Valid phone number is required'),
  
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain uppercase, lowercase, number and special character'),
  
  body('fullName')
    .trim()
    .notEmpty()
    .withMessage('Full name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Full name must be between 2 and 100 characters'),
  
  handleValidationErrors
];

const validateLogin = [
  body('identifier')
    .trim()
    .notEmpty()
    .withMessage('Email or phone number is required'),
  
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  
  handleValidationErrors
];

const validateOtpRequest = [
  body('phoneNumber')
    .trim()
    .isMobilePhone()
    .withMessage('Valid phone number is required'),
  
  handleValidationErrors
];

const validateOtpVerify = [
  body('phoneNumber')
    .trim()
    .isMobilePhone()
    .withMessage('Valid phone number is required'),
  
  body('otp')
    .trim()
    .isLength({ min: 6, max: 6 })
    .isNumeric()
    .withMessage('Valid 6-digit OTP is required'),
  
  handleValidationErrors
];

const validateBiometricSetup = [
  body('biometricData')
    .notEmpty()
    .withMessage('Biometric data is required')
    .isString()
    .withMessage('Biometric data must be a string'),
  
  body('deviceId')
    .optional()
    .trim()
    .isString()
    .withMessage('Device ID must be a string'),
  
  handleValidationErrors
];


const validateBiometricVerify = [
  body('biometricData')
    .notEmpty()
    .withMessage('Biometric data is required')
    .isString()
    .withMessage('Biometric data must be a string'),
  
  handleValidationErrors
];


const validatePasswordChange = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),
  
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('New password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('New password must contain uppercase, lowercase, number and special character'),
  
  body('confirmPassword')
    .custom((value, { req }) => value === req.body.newPassword)
    .withMessage('Passwords do not match'),
  
  handleValidationErrors
];

const validatePasswordReset = [
  body('email')
    .trim()
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  
  handleValidationErrors
];

const validatePasswordResetConfirm = [
  body('token')
    .notEmpty()
    .withMessage('Reset token is required'),
  
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain uppercase, lowercase, number and special character'),
  
  handleValidationErrors
];

module.exports = {
  validateRegister,
  validateLogin,
  validateOtpRequest,
  validateOtpVerify,
  validateBiometricSetup,
  validateBiometricVerify,
  validatePasswordChange,
  validatePasswordReset,
  validatePasswordResetConfirm
};