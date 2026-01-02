const Transaction = require('../models/transaction.model');
const Wallet = require('../models/wallet.model');
const { successResponse, errorResponse } = require('../utils/response');
const { analyzeFraud, verifyBiometric, verifyFacial } = require('../services/fraud_ml.service');
const { estimateGas } = require('../services/blockchain.service');
const {
  buildUserOperation,
  sponsorUserOperation,
  sendUserOperation,
  getUserOpReceipt,
  buildTransferCallData,
  getSmartAccountNonce
} = require('../services/biconomy.service');
const { createUserOpBuilder } = require('../blockchain/userop.builder');
const logger = require('../utils/logger');

const calculateFraudSignals = async (userId, walletAddress, to, amount) => {
  const signals = {};

  const userTransactions = await Transaction.find({ 
    userId, 
    status: { $in: ['confirmed', 'submitted'] } 
  }).sort({ createdAt: -1 });

  if (userTransactions.length > 0) {
    const amounts = userTransactions.map(tx => parseFloat(tx.amount));
    const avgAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const amountRatio = parseFloat(amount) / avgAmount;
    
    signals.amount_ratio = amountRatio;
    signals.amount_anomaly = amountRatio >= 5 ? 'high' : amountRatio >= 2 ? 'medium' : 'low';
  } else {
    signals.amount_ratio = 1;
    signals.amount_anomaly = 'low';
  }

  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
  const recentTxCount = await Transaction.countDocuments({
    userId,
    createdAt: { $gte: tenMinutesAgo }
  });

  signals.tx_frequency = recentTxCount;
  signals.frequency_risk = recentTxCount > 5 ? 'high' : recentTxCount >= 3 ? 'medium' : 'low';

  if (userTransactions.length > 0) {
    const lastTx = userTransactions[0];
    const timeGap = (Date.now() - new Date(lastTx.createdAt).getTime()) / 1000;
    
    signals.time_gap_seconds = timeGap;
    signals.time_gap_risk = timeGap < 10 ? 'high' : 'low';
  } else {
    signals.time_gap_seconds = null;
    signals.time_gap_risk = 'low';
  }

  const currentHour = new Date().getHours();
  signals.night_tx = (currentHour >= 0 && currentHour < 5) ? 1 : 0;
  signals.night_tx_risk = signals.night_tx === 1 ? 'medium' : 'low';

  const pastRecipients = await Transaction.distinct('to', { 
    userId, 
    status: { $in: ['confirmed', 'submitted'] } 
  });
  
  signals.new_receiver = pastRecipients.includes(to.toLowerCase()) ? 0 : 1;
  signals.new_receiver_risk = signals.new_receiver === 1 ? 'medium' : 'low';

  signals.device_change = 0;
  signals.device_change_risk = 'low';

  return signals;
};

const calculateOverallRiskScore = (signals) => {
  let riskScore = 0;
  const riskWeights = {
    high: 0.3,
    medium: 0.15,
    low: 0.05
  };

  riskScore += riskWeights[signals.amount_anomaly] || 0;
  riskScore += riskWeights[signals.frequency_risk] || 0;
  riskScore += riskWeights[signals.time_gap_risk] || 0;
  riskScore += riskWeights[signals.night_tx_risk] || 0;
  riskScore += riskWeights[signals.new_receiver_risk] || 0;
  riskScore += riskWeights[signals.device_change_risk] || 0;

  return Math.min(riskScore, 1);
};

const sendTransaction = async (req, res) => {
  try {
    const { to, amount, token, network, biometricData, facialData, metadata } = req.body;
    const userId = req.userId;
    const user = req.user;

    if (!user.walletId) {
      return errorResponse(res, 'Wallet not found', 404, 'WALLET_NOT_FOUND');
    }

    const wallet = await Wallet.findById(user.walletId);

    if (!wallet) {
      return errorResponse(res, 'Wallet not found', 404, 'WALLET_NOT_FOUND');
    }

    const biometricResult = await verifyBiometric(biometricData, userId.toString());
    if (!biometricResult.verified) {
      return errorResponse(res, 'Biometric verification failed', 401, 'BIOMETRIC_FAILED');
    }

    const facialResult = await verifyFacial(facialData, userId.toString());
    if (!facialResult.verified) {
      return errorResponse(res, 'Facial verification failed', 401, 'FACIAL_FAILED');
    }

    const fraudSignals = await calculateFraudSignals(userId, wallet.smartAccountAddress, to, amount);
    const localRiskScore = calculateOverallRiskScore(fraudSignals);

    const fraudAnalysis = await analyzeFraud({
      from: wallet.smartAccountAddress,
      to: to,
      amount: amount,
      token: token || { symbol: 'ETH' },
      network: network || wallet.network,
      userId: userId.toString(),
      metadata: metadata || {},
      signals: fraudSignals
    });

    const combinedRiskScore = (localRiskScore + fraudAnalysis.riskScore) / 2;

    const isBlocked = combinedRiskScore > 0.7 || fraudAnalysis.isBlocked;

    if (isBlocked) {
      return errorResponse(res, 'Transaction blocked due to fraud detection', 403, 'FRAUD_DETECTED', {
        riskScore: combinedRiskScore,
        signals: fraudSignals,
        detectedPatterns: fraudAnalysis.detectedPatterns
      });
    }

    const transaction = await Transaction.create({
      userId: userId,
      walletId: wallet._id,
      type: 'send',
      amount: amount,
      token: token || { symbol: 'ETH', address: null, decimals: 18 },
      from: wallet.smartAccountAddress,
      to: to,
      network: network || wallet.network,
      chainId: network === 'polygon' ? 137 : 1,
      status: 'pending',
      fraudAnalysis: {
        riskScore: combinedRiskScore,
        isBlocked: isBlocked,
        mlModelVersion: fraudAnalysis.mlModelVersion,
        detectedPatterns: [
          ...fraudAnalysis.detectedPatterns,
          ...Object.entries(fraudSignals)
            .filter(([key, value]) => key.includes('_risk') && value !== 'low')
            .map(([key, value]) => `${key}: ${value}`)
        ],
        analyzedAt: fraudAnalysis.analyzedAt
      },
      biometricVerified: true,
      facialVerified: true,
      metadata: {
        ...metadata,
        fraudSignals: fraudSignals
      }
    });

    const callData = buildTransferCallData(to, amount, token?.address);

    const nonceData = await getSmartAccountNonce(wallet.smartAccountAddress, network || wallet.network);

    const userOpBuilder = createUserOpBuilder(network || wallet.network);
    userOpBuilder
      .setSender(wallet.smartAccountAddress)
      .setNonce(nonceData.nonce)
      .setCallData(callData);

    await userOpBuilder.setGasFees();

    let userOp = userOpBuilder.build();

    const sponsoredData = await sponsorUserOperation(userOp, network || wallet.network);

    userOp.paymasterAndData = sponsoredData.paymasterAndData;
    userOp.preVerificationGas = sponsoredData.preVerificationGas;
    userOp.verificationGasLimit = sponsoredData.verificationGasLimit;
    userOp.callGasLimit = sponsoredData.callGasLimit;

    const sendResult = await sendUserOperation(userOp, network || wallet.network);

    await transaction.markSubmitted(null, sendResult.userOpHash);

    logger.info(`Transaction submitted for user: ${userId}, userOpHash: ${sendResult.userOpHash}, riskScore: ${combinedRiskScore}`);

    return successResponse(res, 'Transaction submitted successfully', {
      transactionId: transaction._id,
      userOpHash: sendResult.userOpHash,
      status: 'submitted',
      fraudAnalysis: {
        riskScore: combinedRiskScore,
        isBlocked: isBlocked,
        signals: fraudSignals
      }
    }, 201);
  } catch (error) {
    logger.error('Send transaction error:', error);
    return errorResponse(res, 'Transaction failed', 500, 'TRANSACTION_ERROR');
  }
};

const swapTokens = async (req, res) => {
  try {
    const { fromToken, toToken, amount, slippage, biometricData, facialData } = req.body;
    const userId = req.userId;
    const user = req.user;

    if (!user.walletId) {
      return errorResponse(res, 'Wallet not found', 404, 'WALLET_NOT_FOUND');
    }

    const wallet = await Wallet.findById(user.walletId);

    if (!wallet) {
      return errorResponse(res, 'Wallet not found', 404, 'WALLET_NOT_FOUND');
    }

    const biometricResult = await verifyBiometric(biometricData, userId.toString());
    if (!biometricResult.verified) {
      return errorResponse(res, 'Biometric verification failed', 401, 'BIOMETRIC_FAILED');
    }

    const facialResult = await verifyFacial(facialData, userId.toString());
    if (!facialResult.verified) {
      return errorResponse(res, 'Facial verification failed', 401, 'FACIAL_FAILED');
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
    const { page = 1, limit = 20, status, type } = req.query;

    const filter = { userId };
    if (status) filter.status = status;
    if (type) filter.type = type;

    const result = await Transaction.getUserTransactions(userId, parseInt(page), parseInt(limit));

    return successResponse(res, 'Transactions retrieved successfully', result);
  } catch (error) {
    logger.error('Get transactions error:', error);
    return errorResponse(res, 'Failed to retrieve transactions', 500, 'GET_TRANSACTIONS_ERROR');
  }
};

const getTransaction = async (req, res) => {
  try {
    const { transactionId } = req.params;
    const userId = req.userId;

    const transaction = await Transaction.findOne({
      _id: transactionId,
      userId: userId
    }).populate('walletId', 'address smartAccountAddress');

    if (!transaction) {
      return errorResponse(res, 'Transaction not found', 404, 'TRANSACTION_NOT_FOUND');
    }

    return successResponse(res, 'Transaction retrieved successfully', transaction.toClientJSON());
  } catch (error) {
    logger.error('Get transaction error:', error);
    return errorResponse(res, 'Failed to retrieve transaction', 500, 'GET_TRANSACTION_ERROR');
  }
};

const cancelTransaction = async (req, res) => {
  try {
    const { transactionId } = req.params;
    const userId = req.userId;

    const transaction = await Transaction.findOne({
      _id: transactionId,
      userId: userId
    });

    if (!transaction) {
      return errorResponse(res, 'Transaction not found', 404, 'TRANSACTION_NOT_FOUND');
    }

    if (transaction.status !== 'pending') {
      return errorResponse(res, 'Transaction cannot be cancelled', 400, 'CANNOT_CANCEL');
    }

    await transaction.markFailed('Cancelled by user', 'USER_CANCELLED');

    logger.info(`Transaction cancelled: ${transactionId}`);

    return successResponse(res, 'Transaction cancelled successfully');
  } catch (error) {
    logger.error('Cancel transaction error:', error);
    return errorResponse(res, 'Failed to cancel transaction', 500, 'CANCEL_TRANSACTION_ERROR');
  }
};

const estimateGas = async (req, res) => {
  try {
    const { to, amount, token } = req.body;
    const userId = req.userId;
    const user = req.user;

    if (!user.walletId) {
      return errorResponse(res, 'Wallet not found', 404, 'WALLET_NOT_FOUND');
    }

    const wallet = await Wallet.findById(user.walletId);

    if (!wallet) {
      return errorResponse(res, 'Wallet not found', 404, 'WALLET_NOT_FOUND');
    }

    const gasEstimateService = require('../services/blockchain.service');
    const gasData = await gasEstimateService.estimateGas({
      from: wallet.smartAccountAddress,
      to: to,
      value: token ? '0' : amount
    }, wallet.network);

    return successResponse(res, 'Gas estimated successfully', {
      ...gasData,
      note: 'Transaction will be gasless via Biconomy'
    });
  } catch (error) {
    logger.error('Estimate gas error:', error);
    return errorResponse(res, 'Failed to estimate gas', 500, 'ESTIMATE_GAS_ERROR');
  }
};

const checkFraud = async (req, res) => {
  try {
    const { to, amount, token } = req.body;
    const userId = req.userId;
    const user = req.user;

    if (!user.walletId) {
      return errorResponse(res, 'Wallet not found', 404, 'WALLET_NOT_FOUND');
    }

    const wallet = await Wallet.findById(user.walletId);

    if (!wallet) {
      return errorResponse(res, 'Wallet not found', 404, 'WALLET_NOT_FOUND');
    }

    const fraudSignals = await calculateFraudSignals(userId, wallet.smartAccountAddress, to, amount);
    const localRiskScore = calculateOverallRiskScore(fraudSignals);

    const fraudAnalysis = await analyzeFraud({
      from: wallet.smartAccountAddress,
      to: to,
      amount: amount,
      token: token || { symbol: 'ETH' },
      network: wallet.network,
      userId: userId.toString(),
      signals: fraudSignals
    });

    const combinedRiskScore = (localRiskScore + fraudAnalysis.riskScore) / 2;

    return successResponse(res, 'Fraud check completed', {
      riskScore: combinedRiskScore,
      isBlocked: combinedRiskScore > 0.7 || fraudAnalysis.isBlocked,
      signals: fraudSignals,
      detectedPatterns: fraudAnalysis.detectedPatterns,
      recommendation: combinedRiskScore > 0.7 ? 'block' : fraudAnalysis.recommendation
    });
  } catch (error) {
    logger.error('Check fraud error:', error);
    return errorResponse(res, 'Fraud check failed', 500, 'FRAUD_CHECK_ERROR');
  }
};

const getPendingTransactions = async (req, res) => {
  try {
    const userId = req.userId;

    const pendingTransactions = await Transaction.getPendingTransactions(userId);

    return successResponse(res, 'Pending transactions retrieved', {
      transactions: pendingTransactions.map(tx => tx.toClientJSON())
    });
  } catch (error) {
    logger.error('Get pending transactions error:', error);
    return errorResponse(res, 'Failed to retrieve pending transactions', 500, 'GET_PENDING_ERROR');
  }
};

const getTransactionStatus = async (req, res) => {
  try {
    const { transactionId } = req.params;
    const userId = req.userId;

    const transaction = await Transaction.findOne({
      _id: transactionId,
      userId: userId
    });

    if (!transaction) {
      return errorResponse(res, 'Transaction not found', 404, 'TRANSACTION_NOT_FOUND');
    }

    if (transaction.userOpHash && transaction.status === 'submitted') {
      try {
        const receipt = await getUserOpReceipt(transaction.userOpHash, transaction.network);
        
        if (receipt) {
          await transaction.markConfirmed(receipt.blockNumber, receipt.actualGasUsed);
        }
      } catch (error) {
        logger.error('Error checking transaction status:', error);
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
    return errorResponse(res, 'Failed to retrieve transaction status', 500, 'GET_STATUS_ERROR');
  }
};

const retryTransaction = async (req, res) => {
  try {
    const { transactionId } = req.params;
    const userId = req.userId;

    const transaction = await Transaction.findOne({
      _id: transactionId,
      userId: userId
    });

    if (!transaction) {
      return errorResponse(res, 'Transaction not found', 404, 'TRANSACTION_NOT_FOUND');
    }

    if (transaction.status !== 'failed') {
      return errorResponse(res, 'Only failed transactions can be retried', 400, 'CANNOT_RETRY');
    }

    logger.info(`Transaction retry initiated: ${transactionId}`);

    return successResponse(res, 'Retry functionality coming soon');
  } catch (error) {
    logger.error('Retry transaction error:', error);
    return errorResponse(res, 'Failed to retry transaction', 500, 'RETRY_TRANSACTION_ERROR');
  }
};

module.exports = {
  sendTransaction,
  swapTokens,
  getTransactions,
  getTransaction,
  cancelTransaction,
  estimateGas,
  checkFraud,
  getPendingTransactions,
  getTransactionStatus,
  retryTransaction
};