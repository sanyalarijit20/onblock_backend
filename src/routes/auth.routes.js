const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { authLimiter, otpLimiter, biometricLimiter } = require('../middlewares/rate_limiter');
const {
  validateRegister,
  validateLogin,
  validateOtpRequest,
  validateOtpVerify,
  validateBiometricSetup,
  validateBiometricVerify,
  validatePasswordChange,
  validatePasswordReset,
  validatePasswordResetConfirm
} = require('../validators/auth.validator');

router.post('/register', authLimiter, validateRegister, authController.register);

router.post('/login', authLimiter, validateLogin, authController.login);

router.post('/logout', authenticate, authController.logout);

router.post('/refresh-token', authController.refreshToken);

router.post('/otp/request', otpLimiter, validateOtpRequest, authController.requestOtp);

router.post('/otp/verify', otpLimiter, validateOtpVerify, authController.verifyOtp);

router.post('/biometric/setup', authenticate, biometricLimiter, validateBiometricSetup, authController.setupBiometric);

router.post('/biometric/verify', authenticate, biometricLimiter, validateBiometricVerify, authController.verifyBiometric);

router.post('/password/change', authenticate, authLimiter, validatePasswordChange, authController.changePassword);

router.post('/password/reset', authLimiter, validatePasswordReset, authController.requestPasswordReset);

router.post('/password/reset/confirm', authLimiter, validatePasswordResetConfirm, authController.confirmPasswordReset);

router.get('/me', authenticate, authController.getProfile);

router.put('/profile', authenticate, authController.updateProfile);

router.delete('/account', authenticate, authController.deleteAccount);

module.exports = router;