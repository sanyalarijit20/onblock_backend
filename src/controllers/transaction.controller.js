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

/**
 * SEND TRANSACTION
 * Controller responsibilities ONLY:
 * - auth (already done by middleware)
 * - biometric + facial verification
 * - collect raw inputs
 * - call analyzeFraud()
 * - act on result
 */
const sendTransaction = async (req, res) => {
  try {
    const { to, amount, token, network, biometricData, facialData, metadata } =
      req.body;
    const userId = req.userId;
    const user = req.user;

    if (!user.walletId) {
      return errorResponse(res, 'Wallet not found', 404, 'WALLET_NOT_FOUND');
    }

    const wallet = await Wallet.findById(user.walletId);
    if (!wallet) {
      return errorResponse(res, 'Wallet not found', 404, 'WALLET_NOT_FOUND');
    }

    const biometricResult = await verifyBiometric(
      biometricData,
      userId.toString()
    );
    if (!biometricResult.verified) {
      return errorResponse(
        res,
        'Biometric verification failed',
        401,
        'BIOMETRIC_FAILED'
      );
    }

    const facialResult = await verifyFacial(
      facialData,
      userId.toString()
    );
    if (!facialResult.verified) {
      return errorResponse(
        res,
        'Facial verification failed',
        401,
        'FACIAL_FAILED'
      );
    }

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

    if (fraudAnalysis.isBlocked) {
      return errorResponse(
        res,
        'Transaction blocked due to fraud detection',
        403,
        'FRAUD_DETECTED',
        {
          riskScore: fraudAnalysis.riskScore,
          signals: fraudAnalysis.signals,
          detectedPatterns: fraudAnalysis.detectedPatterns
        }
      );
    }

    const transaction = await Transaction.create({
      userId,
      walletId: wallet._id,
      type: 'send',
      amount,
      token: token || { symbol: 'ETH', address: null, decimals: 18 },
      from: wallet.smartAccountAddress,
      to,
      network: network || wallet.network,
      chainId: network === 'polygon' ? 137 : 1,
      status: 'pending',
      fraudAnalysis: {
        riskScore: fraudAnalysis.riskScore,
        isBlocked: fraudAnalysis.isBlocked,
        mlModelVersion: fraudAnalysis.mlModelVersion,
        detectedPatterns: fraudAnalysis.detectedPatterns,
        signals: fraudAnalysis.signals,
        analyzedAt: fraudAnalysis.analyzedAt
      },
      biometricVerified: true,
      facialVerified: true,
      metadata: metadata || {}
    });

    const callData = buildTransferCallData(
      to,
      amount,
      token?.address
    );

    const nonceData = await getSmartAccountNonce(
      wallet.smartAccountAddress,
      network || wallet.network
    );

    const userOpBuilder = createUserOpBuilder(
      network || wallet.network
    );

    userOpBuilder
      .setSender(wallet.smartAccountAddress)
      .setNonce(nonceData.nonce)
      .setCallData(callData);

    await userOpBuilder.setGasFees();

    let userOp = userOpBuilder.build();

    const sponsored = await sponsorUserOperation(
      userOp,
      network || wallet.network
    );

    userOp.paymasterAndData = sponsored.paymasterAndData;
    userOp.preVerificationGas = sponsored.preVerificationGas;
    userOp.verificationGasLimit = sponsored.verificationGasLimit;
    userOp.callGasLimit = sponsored.callGasLimit;

    const sendResult = await sendUserOperation(
      userOp,
      network || wallet.network
    );

    await transaction.markSubmitted(null, sendResult.userOpHash);

    logger.info(
      `Transaction submitted user=${userId} userOpHash=${sendResult.userOpHash} riskScore=${fraudAnalysis.riskScore}`
    );

    return successResponse(
      res,
      'Transaction submitted successfully',
      {
        transactionId: transaction._id,
        userOpHash: sendResult.userOpHash,
        status: 'submitted',
        fraudAnalysis: {
          riskScore: fraudAnalysis.riskScore,
          isBlocked: fraudAnalysis.isBlocked,
          signals: fraudAnalysis.signals
        }
      },
      201
    );
  } catch (error) {
    logger.error('Send transaction error:', error);
    return errorResponse(
      res,
      'Transaction failed',
      500,
      'TRANSACTION_ERROR'
    );
  }
};

const swapTokens = async (req, res) => {
  try {
    const { fromToken, toToken, amount, slippage, biometricData, facialData } =
      req.body;
    const userId = req.userId;
    const user = req.user;

    if (!user.walletId) {
      return errorResponse(res, 'Wallet not found', 404, 'WALLET_NOT_FOUND');
    }

    const wallet = await Wallet.findById(user.walletId);
    if (!wallet) {
      return errorResponse(res, 'Wallet not found', 404, 'WALLET_NOT_FOUND');
    }

    const biometricResult = await verifyBiometric(
      biometricData,
      userId.toString()
    );
    if (!biometricResult.verified) {
      return errorResponse(
        res,
        'Biometric verification failed',
        401,
        'BIOMETRIC_FAILED'
      );
    }

    const facialResult = await verifyFacial(
      facialData,
      userId.toString()
    );
    if (!facialResult.verified) {
      return errorResponse(
        res,
        'Facial verification failed',
        401,
        'FACIAL_FAILED'
      );
    }

    logger.info(`Swap transaction initiated for user: ${userId}`);

    return successResponse(res, 'Swap functionality coming soon', {
      fromToken,
      toToken,
      amount,
      slippage: slippage || 0.5
    });
  } catch (error) {
    logger.error('Swap tokens error:', error);
    return errorResponse(res, 'Swap failed', 500, 'SWAP_ERROR');
  }
};

const getTransactions = async (req, res) => {
  try {
    const userId = req.userId;
    const { page = 1, limit = 20 } = req.query;

    const result = await Transaction.getUserTransactions(
      userId,
      parseInt(page, 10),
      parseInt(limit, 10)
    );

    return successResponse(res, 'Transactions retrieved successfully', result);
  } catch (error) {
    logger.error('Get transactions error:', error);
    return errorResponse(
      res,
      'Failed to retrieve transactions',
      500,
      'GET_TRANSACTIONS_ERROR'
    );
  }
};

const getTransaction = async (req, res) => {
  try {
    const { transactionId } = req.params;
    const userId = req.userId;

    const transaction = await Transaction.findOne({
      _id: transactionId,
      userId
    }).populate('walletId', 'address smartAccountAddress');

    if (!transaction) {
      return errorResponse(
        res,
        'Transaction not found',
        404,
        'TRANSACTION_NOT_FOUND'
      );
    }

    return successResponse(
      res,
      'Transaction retrieved successfully',
      transaction.toClientJSON()
    );
  } catch (error) {
    logger.error('Get transaction error:', error);
    return errorResponse(
      res,
      'Failed to retrieve transaction',
      500,
      'GET_TRANSACTION_ERROR'
    );
  }
};

const cancelTransaction = async (req, res) => {
  try {
    const { transactionId } = req.params;
    const userId = req.userId;

    const transaction = await Transaction.findOne({
      _id: transactionId,
      userId
    });

    if (!transaction) {
      return errorResponse(
        res,
        'Transaction not found',
        404,
        'TRANSACTION_NOT_FOUND'
      );
    }

    if (transaction.status !== 'pending') {
      return errorResponse(
        res,
        'Transaction cannot be cancelled',
        400,
        'CANNOT_CANCEL'
      );
    }

    await transaction.markFailed('Cancelled by user', 'USER_CANCELLED');

    logger.info(`Transaction cancelled: ${transactionId}`);

    return successResponse(res, 'Transaction cancelled successfully');
  } catch (error) {
    logger.error('Cancel transaction error:', error);
    return errorResponse(
      res,
      'Failed to cancel transaction',
      500,
      'CANCEL_TRANSACTION_ERROR'
    );
  }
};

const estimateGas = async (req, res) => {
  try {
    const { to, amount, token } = req.body;
    const user = req.user;

    if (!user.walletId) {
      return errorResponse(res, 'Wallet not found', 404, 'WALLET_NOT_FOUND');
    }

    const wallet = await Wallet.findById(user.walletId);
    if (!wallet) {
      return errorResponse(res, 'Wallet not found', 404, 'WALLET_NOT_FOUND');
    }

    const gasData = await blockchainService.estimateGas(
      {
        from: wallet.smartAccountAddress,
        to,
        value: token ? '0' : amount
      },
      wallet.network
    );

    return successResponse(res, 'Gas estimated successfully', {
      ...gasData,
      note: 'Transaction will be gasless via Biconomy'
    });
  } catch (error) {
    logger.error('Estimate gas error:', error);
    return errorResponse(
      res,
      'Failed to estimate gas',
      500,
      'ESTIMATE_GAS_ERROR'
    );
  }
};

const getPendingTransactions = async (req, res) => {
  try {
    const userId = req.userId;
    const pending = await Transaction.getPendingTransactions(userId);

    return successResponse(res, 'Pending transactions retrieved', {
      transactions: pending.map((tx) => tx.toClientJSON())
    });
  } catch (error) {
    logger.error('Get pending transactions error:', error);
    return errorResponse(
      res,
      'Failed to retrieve pending transactions',
      500,
      'GET_PENDING_ERROR'
    );
  }
};

const getTransactionStatus = async (req, res) => {
  try {
    const { transactionId } = req.params;
    const userId = req.userId;

    const transaction = await Transaction.findOne({
      _id: transactionId,
      userId
    });

    if (!transaction) {
      return errorResponse(
        res,
        'Transaction not found',
        404,
        'TRANSACTION_NOT_FOUND'
      );
    }

    if (transaction.userOpHash && transaction.status === 'submitted') {
      try {
        const receipt = await getUserOpReceipt(
          transaction.userOpHash,
          transaction.network
        );

        if (receipt) {
          await transaction.markConfirmed(
            receipt.blockNumber,
            receipt.actualGasUsed
          );
        }
      } catch (err) {
        logger.error('Error checking transaction status:', err);
      }
    }

    return successResponse(res, 'Transaction status retrieved', {
      status: transaction.status,
      txHash: transaction.txHash,
      userOpHash: transaction.userOpHash,
      blockNumber: transaction.blockNumber,
      confirmedAt: transaction.confirmedAt
    });
  } catch (error) {
    logger.error('Get transaction status error:', error);
    return errorResponse(
      res,
      'Failed to retrieve transaction status',
      500,
      'GET_STATUS_ERROR'
    );
  }
};

const retryTransaction = async (req, res) => {
  try {
    const { transactionId } = req.params;
    const userId = req.userId;

    const transaction = await Transaction.findOne({
      _id: transactionId,
      userId
    });

    if (!transaction) {
      return errorResponse(
        res,
        'Transaction not found',
        404,
        'TRANSACTION_NOT_FOUND'
      );
    }

    if (transaction.status !== 'failed') {
      return errorResponse(
        res,
        'Only failed transactions can be retried',
        400,
        'CANNOT_RETRY'
      );
    }

    logger.info(`Transaction retry initiated: ${transactionId}`);

    return successResponse(res, 'Retry functionality coming soon');
  } catch (error) {
    logger.error('Retry transaction error:', error);
    return errorResponse(
      res,
      'Failed to retry transaction',
      500,
      'RETRY_TRANSACTION_ERROR'
    );
  }
};

module.exports = {
  sendTransaction,
  swapTokens,
  getTransactions,
  getTransaction,
  cancelTransaction,
  estimateGas,
  getPendingTransactions,
  getTransactionStatus,
  retryTransaction
};
