const express = require('express');
const router = express.Router();
const transactionController = require('../controllers/transaction.controller');
const { authenticate, requireWallet, requireFullVerification } = require('../middlewares/auth.middleware');
const { transactionLimiter, generalLimiter } = require('../middlewares/rate_limiter');
const {
  validateSendTransaction,
  validateSwapTransaction,
  validateGetTransaction,
  validateGetTransactions,
  validateCancelTransaction,
  validateEstimateGas,
  validateCheckFraud
} = require('../validators/transaction.validator');

router.use(authenticate);
router.use(requireWallet);

router.post('/send', transactionLimiter, requireFullVerification, validateSendTransaction, transactionController.sendTransaction);

router.post('/swap', transactionLimiter, requireFullVerification, validateSwapTransaction, transactionController.swapTokens);

router.get('/history', generalLimiter, validateGetTransactions, transactionController.getTransactions);

router.get('/:transactionId', generalLimiter, validateGetTransaction, transactionController.getTransaction);

router.post('/:transactionId/cancel', transactionLimiter, validateCancelTransaction, transactionController.cancelTransaction);

router.post('/estimate-gas', generalLimiter, validateEstimateGas, transactionController.estimateGas);

router.post('/check-fraud', generalLimiter, validateCheckFraud, transactionController.checkFraud);

router.get('/pending/list', generalLimiter, transactionController.getPendingTransactions);

router.get('/:transactionId/status', generalLimiter, validateGetTransaction, transactionController.getTransactionStatus);

router.post('/:transactionId/retry', transactionLimiter, validateGetTransaction, transactionController.retryTransaction);

module.exports = router;

