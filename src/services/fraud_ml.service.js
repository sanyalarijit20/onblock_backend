const axios = require('axios');
const logger = require('../utils/logger');
const Transaction = require('../models/transaction.model');

const ML_SERVICE_BASE_URL = process.env.ML_SERVICE_URL || 'http://localhost:5000';
const ML_API_TIMEOUT = parseInt(process.env.ML_API_TIMEOUT, 10) || 10000;

const mlClient = axios.create({
  baseURL: ML_SERVICE_BASE_URL,
  timeout: ML_API_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': process.env.ML_SERVICE_API_KEY || ''
  }
});

/**
 * SINGLE SOURCE OF TRUTH — derive all fraud signals here
 */
const deriveSignals = async (transactionData) => {
  const userId = transactionData.userId;

  const [
    userAvgAmount,
    txCountLast10Min,
    lastTxTime,
    lastDevice
  ] = await Promise.all([
    Transaction.getUserAverageAmount(userId),
    Transaction.getTransactionCountLast10Min(userId),
    Transaction.getLastTransactionTime(userId),
    Transaction.getLastUserDevice(userId)
  ]);

  const isNewReceiver =
    !(await Transaction.hasReceiverBeenUsedBefore(userId, transactionData.to));

  const isNightTime = Transaction.isNightTimeTransaction(new Date());

  const currentAmount = Number(transactionData.amount);
  const avgAmount = Number(userAvgAmount) || 1;
  const amountRatio = avgAmount > 0 ? currentAmount / avgAmount : 0;

  let timeGapSeconds = null;
  if (lastTxTime) {
    timeGapSeconds = Math.floor(
      (Date.now() - new Date(lastTxTime).getTime()) / 1000
    );
  }

  const currentDeviceId = transactionData.deviceInfo?.deviceId || null;
  const lastDeviceId = lastDevice?.deviceId || null;
  const deviceChanged =
    Boolean(currentDeviceId && lastDeviceId && currentDeviceId !== lastDeviceId);

  return {
    raw: {
      userAvgAmount,
      txCountLast10Min,
      lastTxTime,
      isNewReceiver,
      isNightTime,
      amountRatio,
      timeGapSeconds,
      deviceChanged,
      currentDeviceId,
      lastDeviceId
    },
    signals: {
      amountAnomaly: {
        detected: amountRatio >= 2,
        amountRatio,
        userAvgAmount,
        riskLevel:
          amountRatio < 2 ? 'low' : amountRatio < 5 ? 'medium' : 'high'
      },
      transactionFrequency: {
        detected: txCountLast10Min > 2,
        txCountLast10Min,
        riskLevel:
          txCountLast10Min <= 2
            ? 'low'
            : txCountLast10Min <= 5
            ? 'medium'
            : 'high'
      },
      timeGap: {
        detected: timeGapSeconds !== null && timeGapSeconds < 10,
        secondsSinceLastTx: timeGapSeconds,
        riskLevel:
          timeGapSeconds !== null && timeGapSeconds < 10 ? 'high' : 'low'
      },
      deviceChange: {
        detected: deviceChanged,
        currentDeviceId,
        lastDeviceId,
        riskLevel: deviceChanged ? 'medium' : 'none'
      },
      nightTimeTransaction: {
        detected: isNightTime,
        transactionHour: new Date().getHours(),
        isNightTime,
        riskLevel: isNightTime ? 'medium' : 'none'
      },
      newReceiverAddress: {
        detected: isNewReceiver,
        receiverAddress: transactionData.to,
        isNewReceiver,
        riskLevel: isNewReceiver ? 'medium' : 'none'
      }
    }
  };
};
const computeLocalRiskScore = (raw) => {
  let score = 0;

  if (raw.amountRatio >= 5) score += 0.3;
  else if (raw.amountRatio >= 2) score += 0.15;

  if (raw.txCountLast10Min > 5) score += 0.25;
  else if (raw.txCountLast10Min > 2) score += 0.1;

  if (raw.timeGapSeconds !== null && raw.timeGapSeconds < 10) score += 0.2;
  if (raw.deviceChanged) score += 0.15;
  if (raw.isNightTime) score += 0.1;
  if (raw.isNewReceiver) score += 0.1;

  return Math.min(score, 1);
};

const analyzeFraud = async (transactionData) => {
  const { raw, signals } = await deriveSignals(transactionData);

  const payload = {
    from: transactionData.from,
    to: transactionData.to,
    amount: transactionData.amount,
    token: transactionData.token || { symbol: 'ETH' },
    network: transactionData.network || 'polygon',
    userId: transactionData.userId,
    timestamp: new Date().toISOString(),
    metadata: transactionData.metadata || {},
    fraudSignals: raw,
    deviceInfo: transactionData.deviceInfo || {}
  };

  try {
    const response = await mlClient.post('/api/fraud/analyze', payload);

    return {
      riskScore: response.data.riskScore || 0,
      isBlocked: response.data.isBlocked || false,
      mlModelVersion: response.data.modelVersion || 'v1.0',
      detectedPatterns: response.data.detectedPatterns || [],
      signals,
      analyzedAt: new Date(),
      confidence: response.data.confidence || 0,
      recommendation: response.data.recommendation || 'allow'
    };
  } catch (error) {
    logger.error('ML Fraud Analysis Error:', error.message);

    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      const localRiskScore = computeLocalRiskScore(raw);

      return {
        riskScore: localRiskScore,
        isBlocked: localRiskScore >= 0.7,
        mlModelVersion: 'local-fallback-v1.0',
        detectedPatterns: [],
        signals,
        analyzedAt: new Date(),
        confidence: 0.5,
        recommendation: localRiskScore >= 0.7 ? 'block' : 'allow',
        error: 'ML service unavailable - local fallback used'
      };
    }

    throw new Error(`Fraud analysis failed: ${error.message}`);
  }
};

const verifyBiometric = async (biometricData, userId) => {
  const response = await mlClient.post('/api/biometric/verify', {
    biometricData,
    userId,
    timestamp: new Date().toISOString()
  });

  return {
    verified: response.data.verified || false,
    confidence: response.data.confidence || 0,
    matchScore: response.data.matchScore || 0,
    message: response.data.message || '',
    timestamp: new Date()
  };
};

const verifyFacial = async (facialData, userId, imageData = null) => {
  const response = await mlClient.post('/api/facial/verify', {
    facialData,
    userId,
    imageData,
    timestamp: new Date().toISOString()
  });

  return {
    verified: response.data.verified || false,
    confidence: response.data.confidence || 0,
    matchScore: response.data.matchScore || 0,
    livenessCheck: response.data.livenessCheck || false,
    message: response.data.message || '',
    timestamp: new Date()
  };
};

const enrollBiometric = async (biometricData, userId) => {
  const response = await mlClient.post('/api/biometric/enroll', {
    biometricData,
    userId,
    timestamp: new Date().toISOString()
  });

  return {
    success: response.data.success || false,
    biometricId: response.data.biometricId || null,
    message: response.data.message || '',
    timestamp: new Date()
  };
};

const enrollFacial = async (facialData, userId, imageData = null) => {
  const response = await mlClient.post('/api/facial/enroll', {
    facialData,
    userId,
    imageData,
    timestamp: new Date().toISOString()
  });

  return {
    success: response.data.success || false,
    facialId: response.data.facialId || null,
    message: response.data.message || '',
    timestamp: new Date()
  };
};

const getMLServiceHealth = async () => {
  try {
    const response = await mlClient.get('/health');
    return {
      status: response.data.status || 'unknown',
      uptime: response.data.uptime || 0,
      version: response.data.version || 'unknown',
      timestamp: new Date()
    };
  } catch (error) {
    return {
      status: 'unavailable',
      uptime: 0,
      version: 'unknown',
      timestamp: new Date(),
      error: error.message
    };
  }
};

const batchAnalyzeFraud = async (transactionsData) => {
  const response = await mlClient.post('/api/fraud/batch-analyze', {
    transactions: transactionsData,
    timestamp: new Date().toISOString()
  });

  return response.data.results || [];
};

module.exports = {
  analyzeFraud,
  verifyBiometric,
  verifyFacial,
  enrollBiometric,
  enrollFacial,
  getMLServiceHealth,
  batchAnalyzeFraud
};

