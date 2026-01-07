const Transaction = require('../models/transaction.model');
const Wallet = require('../models/wallet.model');
const { successResponse, errorResponse } = require('../utils/response');
const {
  analyzeFraud,
  verifyBiometric,
  verifyFacial
} = require('../services/fraud_ml.service');
const {
  buildTransferCallData,
  getSmartAccountNonce,
  sponsorUserOperation,
  sendUserOperation,
  getUserOpReceipt
} = require('../services/biconomy.service');
const { createUserOpBuilder } = require('../blockchain/userop.builder');
const blockchainService = require('../services/blockchain.service');
const logger = require('../utils/logger');

/* =======================
   SEND TRANSACTION
======================= */

const sendTransaction = async (req, res) => {
  try {
    const { to, amount, token, network, biometricData, facialData, metadata } =
      req.body;

    const userId = req.userId;
    const user = req.user;

    if (!user || !user.walletId) {
      return errorResponse(res, 'Wallet not found', 404, 'WALLET_NOT_FOUND');
    }

    const wallet = await Wallet.findById(user.walletId);
    if (!wallet) {
      return errorResponse(res, 'Wallet not found', 404, 'WALLET_NOT_FOUND');
    }

    /* =========================
       BIOMETRIC (MANDATORY)
    ========================= */
    const biometricResult = await verifyBiometric(
      biometricData,
      userId.toString()
    );

    if (!biometricResult || biometricResult.verified !== true) {
      return errorResponse(
        res,
        'Biometric verification failed',
        401,
        'BIOMETRIC_FAILED'
      );
    }

    /* =========================
       FACIAL (OPTIONAL)
    ========================= */
    let facialVerified = false;

    if (facialData) {
      const facialResult = await verifyFacial(
        facialData,
        userId.toString()
      );
      facialVerified = facialResult?.verified === true;
    }

    /* =========================
       FRAUD ANALYSIS (NON-BLOCKING)
    ========================= */
    const fraudAnalysis = await analyzeFraud({
      from: wallet.smartAccountAddress,
      to,
      amount,
      token: token || { symbol: 'ETH' },
      network: network || wallet.network,
      userId: userId.toString(),
      deviceInfo: req.deviceInfo || {},
      metadata: metadata || {}
    });

    // 🚨 FLAG ONLY — DO NOT BLOCK
    const isFlagged =
      typeof fraudAnalysis?.riskScore === 'number' &&
      fraudAnalysis.riskScore >= 0.7;

    /* =========================
       CREATE TRANSACTION
    ========================= */
    const transaction = await Transaction.create({
      userId,
      walletId: wallet._id,
      type: 'send',
      amount,
      token: token || { symbol: 'ETH', address: null, decimals: 18 },
      from: wallet.smartAccountAddress,
      to,
      network: network || wallet.network,
      chainId: wallet.chainId,
      status: 'pending',
      fraudAnalysis: {
        ...fraudAnalysis,
        flagged: isFlagged
      },
      biometricVerified: true,
      facialVerified
    });

    /* =========================
       BUILD USER OP
    ========================= */
    const callData = buildTransferCallData(
      to,
      amount,
      token?.address
    );

    const nonce = await getSmartAccountNonce(
      wallet.smartAccountAddress,
      network || wallet.network
    );

    const builder = createUserOpBuilder(network || wallet.network);

    builder
      .setSender(wallet.smartAccountAddress)
      .setNonce(nonce)
      .setCallData(callData);

    await builder.setGasFees();

    const userOp = builder.build();

    const sponsoredOp = await sponsorUserOperation(
      userOp,
      network || wallet.network
    );

    Object.assign(userOp, sponsoredOp);

    const sendResult = await sendUserOperation(
      userOp,
      network || wallet.network
    );

    await transaction.markSubmitted(null, sendResult.userOpHash);

    return successResponse(
      res,
      isFlagged
        ? 'Transaction submitted (FLAGGED for review)'
        : 'Transaction submitted successfully',
      {
        transactionId: transaction._id,
        userOpHash: sendResult.userOpHash,
        status: 'submitted',
        flagged: isFlagged
      },
      201
    );
  } catch (error) {
    logger.error('Send transaction error:', error);
    return errorResponse(res, 'Transaction failed', 500, 'TRANSACTION_ERROR');
  }
};

/* =======================
   SWAP (STUB)
======================= */

const swapTokens = async (req, res) => {
  return successResponse(res, 'Swap functionality coming soon');
};

/* =======================
   FRAUD CHECK
======================= */

const checkFraud = async (req, res) => {
  try {
    const { to, amount, token, network, metadata } = req.body;
    const user = req.user;

    if (!user || !user.walletId) {
      return errorResponse(res, 'Wallet not found', 404, 'WALLET_NOT_FOUND');
    }

    const wallet = await Wallet.findById(user.walletId);
    if (!wallet) {
      return errorResponse(res, 'Wallet not found', 404, 'WALLET_NOT_FOUND');
    }

    const fraudAnalysis = await analyzeFraud({
      from: wallet.smartAccountAddress,
      to,
      amount,
      token: token || { symbol: 'ETH' },
      network: network || wallet.network,
      userId: req.userId.toString(),
      deviceInfo: req.deviceInfo || {},
      metadata: metadata || {}
    });

    return successResponse(res, 'Fraud analysis completed', fraudAnalysis);
  } catch (error) {
    logger.error('Check fraud error:', error);
    return errorResponse(res, 'Failed to analyze fraud', 500, 'CHECK_FRAUD_ERROR');
  }
};

/* =======================
   QUERY / STATUS
======================= */

const getTransactions = async (req, res) => {
  const { page = 1, limit = 20 } = req.query;

  const result = await Transaction.getUserTransactions(
    req.userId,
    Number(page),
    Number(limit)
  );

  return successResponse(res, 'Transactions retrieved successfully', result);
};

const getTransaction = async (req, res) => {
  const tx = await Transaction.findOne({
    _id: req.params.transactionId,
    userId: req.userId
  });

  if (!tx) {
    return errorResponse(res, 'Transaction not found', 404, 'TRANSACTION_NOT_FOUND');
  }

  return successResponse(res, 'Transaction retrieved successfully', tx.toClientJSON());
};

const cancelTransaction = async (req, res) => {
  const tx = await Transaction.findOne({
    _id: req.params.transactionId,
    userId: req.userId
  });

  if (!tx || tx.status !== 'pending') {
    return errorResponse(res, 'Cannot cancel transaction', 400, 'CANNOT_CANCEL');
  }

  await tx.markFailed('Cancelled by user', 'USER_CANCELLED');
  return successResponse(res, 'Transaction cancelled successfully');
};

const estimateGas = async (req, res) => {
  const wallet = await Wallet.findById(req.user.walletId);

  const gas = await blockchainService.estimateGas(
    {
      from: wallet.smartAccountAddress,
      to: req.body.to
    },
    wallet.network
  );

  return successResponse(res, 'Gas estimated successfully', gas);
};

const getPendingTransactions = async (req, res) => {
  const pending = await Transaction.getPendingTransactions(req.userId);
  return successResponse(res, 'Pending transactions retrieved', pending);
};

const getTransactionStatus = async (req, res) => {
  const tx = await Transaction.findOne({
    _id: req.params.transactionId,
    userId: req.userId
  });

  if (!tx) {
    return errorResponse(res, 'Transaction not found', 404, 'TRANSACTION_NOT_FOUND');
  }

  if (tx.userOpHash && tx.status === 'submitted') {
    const receipt = await getUserOpReceipt(tx.userOpHash, tx.network);
    if (receipt) {
      await tx.markConfirmed(
        receipt.blockNumber,
        receipt.actualGasUsed
      );
    }
  }

  return successResponse(res, 'Transaction status retrieved', {
    status: tx.status,
    userOpHash: tx.userOpHash
  });
};

const retryTransaction = async (req, res) => {
  return successResponse(res, 'Retry functionality coming soon');
};

/* =======================
   EXPORTS
======================= */

module.exports = {
  sendTransaction,
  swapTokens,
  checkFraud,
  getTransactions,
  getTransaction,
  cancelTransaction,
  estimateGas,
  getPendingTransactions,
  getTransactionStatus,
  retryTransaction
};
