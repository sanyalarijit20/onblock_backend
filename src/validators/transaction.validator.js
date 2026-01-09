const { body, param, query, validationResult } = require('express-validator');
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

const validateSendTransaction = [
  body('to')
    .trim()
    .notEmpty()
    .withMessage('Recipient address is required')
    .matches(/^0x[a-fA-F0-9]{40}$/)
    .withMessage('Invalid Ethereum address format'),
  
  body('amount')
    .notEmpty()
    .withMessage('Amount is required')
    .isString()
    .withMessage('Amount must be a string (to handle big numbers)')
    .matches(/^\d+$/)
    .withMessage('Amount must be a positive number in wei'),
  
  body('token')
    .optional()
    .isObject()
    .withMessage('Token must be an object'),
  
  body('token.symbol')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Token symbol is required when token is provided'),
  
  body('token.address')
    .optional()
    .trim()
    .matches(/^0x[a-fA-F0-9]{40}$/)
    .withMessage('Invalid token contract address'),
  
  body('token.decimals')
    .optional()
    .isInt({ min: 0, max: 18 })
    .withMessage('Token decimals must be between 0 and 18'),
  
  body('network')
    .optional()
    .trim()
    .isIn(['polygon', 'ethereum', 'base', 'optimism', 'arbitrum'])
    .withMessage('Invalid network'),
  
  body('biometricData')
    .notEmpty()
    .withMessage('Biometric verification required')
    .isString()
    .withMessage('Biometric data must be a string'),
  
  body('metadata')
    .optional()
    .isObject()
    .withMessage('Metadata must be an object'),
  
  body('metadata.description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must not exceed 500 characters'),
  
  handleValidationErrors
];

const validateSwapTransaction = [
  body('fromToken')
    .notEmpty()
    .withMessage('From token is required')
    .isObject()
    .withMessage('From token must be an object'),
  
  body('fromToken.symbol')
    .trim()
    .notEmpty()
    .withMessage('From token symbol is required'),
  
  body('fromToken.address')
    .optional()
    .trim()
    .matches(/^0x[a-fA-F0-9]{40}$/)
    .withMessage('Invalid from token address'),
  
  body('toToken')
    .notEmpty()
    .withMessage('To token is required')
    .isObject()
    .withMessage('To token must be an object'),
  
  body('toToken.symbol')
    .trim()
    .notEmpty()
    .withMessage('To token symbol is required'),
  
  body('toToken.address')
    .optional()
    .trim()
    .matches(/^0x[a-fA-F0-9]{40}$/)
    .withMessage('Invalid to token address'),
  
  body('amount')
    .notEmpty()
    .withMessage('Amount is required')
    .isString()
    .withMessage('Amount must be a string')
    .matches(/^\d+$/)
    .withMessage('Amount must be a positive number'),
  
  body('slippage')
    .optional()
    .isFloat({ min: 0, max: 50 })
    .withMessage('Slippage must be between 0 and 50'),
  
  body('biometricData')
    .notEmpty()
    .withMessage('Biometric verification required'),
  
  
  handleValidationErrors
];

const validateGetTransaction = [
  param('transactionId')
    .trim()
    .notEmpty()
    .withMessage('Transaction ID is required')
    .isMongoId()
    .withMessage('Invalid transaction ID format'),
  
  handleValidationErrors
];

const validateGetTransactions = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  
  query('status')
    .optional()
    .isIn(['pending', 'submitted', 'confirmed', 'failed', 'rejected'])
    .withMessage('Invalid status value'),
  
  query('type')
    .optional()
    .isIn(['send', 'receive', 'swap', 'deposit', 'withdrawal'])
    .withMessage('Invalid transaction type'),
  
  handleValidationErrors
];

const validateCancelTransaction = [
  param('transactionId')
    .trim()
    .notEmpty()
    .withMessage('Transaction ID is required')
    .isMongoId()
    .withMessage('Invalid transaction ID format'),
  
  handleValidationErrors
];

const validateEstimateGas = [
  body('to')
    .trim()
    .notEmpty()
    .withMessage('Recipient address is required')
    .matches(/^0x[a-fA-F0-9]{40}$/)
    .withMessage('Invalid Ethereum address'),
  
  body('amount')
    .notEmpty()
    .withMessage('Amount is required')
    .isString()
    .withMessage('Amount must be a string'),
  
  body('token')
    .optional()
    .isObject()
    .withMessage('Token must be an object'),
  
  handleValidationErrors
];

const validateCheckFraud = [
  body('to')
    .trim()
    .notEmpty()
    .withMessage('Recipient address is required')
    .matches(/^0x[a-fA-F0-9]{40}$/)
    .withMessage('Invalid Ethereum address'),
  
  body('amount')
    .notEmpty()
    .withMessage('Amount is required')
    .isString()
    .withMessage('Amount must be a string'),
  
  handleValidationErrors
];

module.exports = {
  validateSendTransaction,
  validateSwapTransaction,
  validateGetTransaction,
  validateGetTransactions,
  validateCancelTransaction,
  validateEstimateGas,
  validateCheckFraud
};