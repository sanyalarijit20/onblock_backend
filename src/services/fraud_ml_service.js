const axios = require('axios');
const logger = require('../utils/logger');
const Transaction = require('../models/transaction.model');

const ML_SERVICE_BASE_URL = process.env.ML_SERVICE_URL || 'http://localhost:5000';
const ML_API_TIMEOUT = parseInt(process.env.ML_API_TIMEOUT) || 10000;

const mlClient = axios.create({
  baseURL: ML_SERVICE_BASE_URL,
  timeout: ML_API_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': process.env.ML_SERVICE_API_KEY || ''
  }
});

const analyzeFraud = async (transactionData) => {
  try {
    const userAvgAmount = await Transaction.getUserAverageAmount(transactionData.userId);
    const txCountLast10Min = await Transaction.getTransactionCountLast10Min(transactionData.userId);
    const lastTxTime = await Transaction.getLastTransactionTime(transactionData.userId);
    const isNewReceiver = !(await Transaction.hasReceiverBeenUsedBefore(transactionData.userId, transactionData.to));
    const isNightTime = Transaction.isNightTimeTransaction(new Date());
    
    const currentAmount = parseFloat(transactionData.amount);
    const avgAmount = parseFloat(userAvgAmount) || 1;
    const amountRatio = avgAmount > 0 ? currentAmount / avgAmount : 0;
    
    let timeGapSeconds = null;
    if (lastTxTime) {
      timeGapSeconds = Math.floor((Date.now() - new Date(lastTxTime).getTime()) / 1000);
    }
    
    const currentDeviceId = transactionData.deviceInfo?.deviceId || null;
    const lastDevice = await Transaction.getLastUserDevice(transactionData.userId);
    const lastDeviceId = lastDevice?.deviceId || null;
    const deviceChanged = currentDeviceId && lastDeviceId && currentDeviceId !== lastDeviceId;
    
    const payload = {
      from: transactionData.from,
      to: transactionData.to,
      amount: transactionData.amount,
      token: transactionData.token || { symbol: 'ETH' },
      network: transactionData.network || 'polygon',
      userId: transactionData.userId,
      timestamp: new Date().toISOString(),
      metadata: transactionData.metadata || {},
      
      fraudSignals: {
        amountAnomaly: {
          currentAmount: transactionData.amount,
          userAvgAmount: userAvgAmount,
          amountRatio: amountRatio
        },
        transactionFrequency: {
          txCountLast10Min: txCountLast10Min
        },
        timeGap: {
          secondsSinceLastTx: timeGapSeconds
        },
        deviceChange: {
          currentDeviceId: currentDeviceId,
          lastDeviceId: lastDeviceId,
          deviceChanged: deviceChanged
        },
        nightTimeTransaction: {
          transactionHour: new Date().getHours(),
          isNightTime: isNightTime
        },
        newReceiverAddress: {
          receiverAddress: transactionData.to,
          isNewReceiver: isNewReceiver
        }
      },
      
      deviceInfo: transactionData.deviceInfo || {}
    };

    const response = await mlClient.post('/api/fraud/analyze', payload);

    const signals = {
      amountAnomaly: {
        detected: amountRatio >= 2,
        amountRatio: amountRatio,
        userAvgAmount: userAvgAmount,
        riskLevel: amountRatio < 2 ? 'low' : amountRatio < 5 ? 'medium' : 'high'
      },
      transactionFrequency: {
        detected: txCountLast10Min > 2,
        txCountLast10Min: txCountLast10Min,
        riskLevel: txCountLast10Min <= 2 ? 'low' : txCountLast10Min <= 5 ? 'medium' : 'high'
      },
      timeGap: {
        detected: timeGapSeconds !== null && timeGapSeconds < 10,
        secondsSinceLastTx: timeGapSeconds,
        riskLevel: timeGapSeconds !== null && timeGapSeconds < 10 ? 'high' : 'low'
      },
      deviceChange: {
        detected: deviceChanged,
        currentDeviceId: currentDeviceId,
        lastDeviceId: lastDeviceId,
        riskLevel: deviceChanged ? 'medium' : 'none'
      },
      nightTimeTransaction: {
        detected: isNightTime,
        transactionHour: new Date().getHours(),
        isNightTime: isNightTime,
        riskLevel: isNightTime ? 'medium' : 'none'
      },
      newReceiverAddress: {
        detected: isNewReceiver,
        receiverAddress: transactionData.to,
        isNewReceiver: isNewReceiver,
        riskLevel: isNewReceiver ? 'medium' : 'none'
      }
    };

    return {
      riskScore: response.data.riskScore || 0,
      isBlocked: response.data.isBlocked || false,
      mlModelVersion: response.data.modelVersion || 'v1.0',
      detectedPatterns: response.data.detectedPatterns || [],
      signals: signals,
      riskFactors: {
        deviceChange: deviceChanged,
        newDevice: transactionData.deviceInfo?.isNewDevice || false,
        locationChange: false,
        unusualAmount: amountRatio >= 5,
        unusualTime: isNightTime,
        highFrequency: txCountLast10Min > 5,
        newReceiver: isNewReceiver,
        rapidTransactions: timeGapSeconds !== null && timeGapSeconds < 10
      },
      analyzedAt: new Date(),
      confidence: response.data.confidence || 0,
      recommendation: response.data.recommendation || 'allow'
    };

  } catch (error) {
    logger.error('ML Fraud Analysis Error:', error.message);
    
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      logger.warn('ML service unavailable, performing local fraud check');
      
      const userAvgAmount = await Transaction.getUserAverageAmount(transactionData.userId);
      const txCountLast10Min = await Transaction.getTransactionCountLast10Min(transactionData.userId);
      const lastTxTime = await Transaction.getLastTransactionTime(transactionData.userId);
      const isNewReceiver = !(await Transaction.hasReceiverBeenUsedBefore(transactionData.userId, transactionData.to));
      const isNightTime = Transaction.isNightTimeTransaction(new Date());
      
      const currentAmount = parseFloat(transactionData.amount);
      const avgAmount = parseFloat(userAvgAmount) || 1;
      const amountRatio = avgAmount > 0 ? currentAmount / avgAmount : 0;
      
      let timeGapSeconds = null;
      if (lastTxTime) {
        timeGapSeconds = Math.floor((Date.now() - new Date(lastTxTime).getTime()) / 1000);
      }
      
      const currentDeviceId = transactionData.deviceInfo?.deviceId || null;
      const lastDevice = await Transaction.getLastUserDevice(transactionData.userId);
      const lastDeviceId = lastDevice?.deviceId || null;
      const deviceChanged = currentDeviceId && lastDeviceId && currentDeviceId !== lastDeviceId;
      
      let localRiskScore = 0;
      if (amountRatio >= 5) localRiskScore += 0.3;
      else if (amountRatio >= 2) localRiskScore += 0.15;
      
      if (txCountLast10Min > 5) localRiskScore += 0.25;
      else if (txCountLast10Min > 2) localRiskScore += 0.1;
      
      if (timeGapSeconds !== null && timeGapSeconds < 10) localRiskScore += 0.2;
      
      if (deviceChanged) localRiskScore += 0.15;
      if (isNightTime) localRiskScore += 0.1;
      if (isNewReceiver) localRiskScore += 0.1;
      
      const signals = {
        amountAnomaly: {
          detected: amountRatio >= 2,
          amountRatio: amountRatio,
          userAvgAmount: userAvgAmount,
          riskLevel: amountRatio < 2 ? 'low' : amountRatio < 5 ? 'medium' : 'high'
        },
        transactionFrequency: {
          detected: txCountLast10Min > 2,
          txCountLast10Min: txCountLast10Min,
          riskLevel: txCountLast10Min <= 2 ? 'low' : txCountLast10Min <= 5 ? 'medium' : 'high'
        },
        timeGap: {
          detected: timeGapSeconds !== null && timeGapSeconds < 10,
          secondsSinceLastTx: timeGapSeconds,
          riskLevel: timeGapSeconds !== null && timeGapSeconds < 10 ? 'high' : 'low'
        },
        deviceChange: {
          detected: deviceChanged,
          currentDeviceId: currentDeviceId,
          lastDeviceId: lastDeviceId,
          riskLevel: deviceChanged ? 'medium' : 'none'
        },
        nightTimeTransaction: {
          detected: isNightTime,
          transactionHour: new Date().getHours(),
          isNightTime: isNightTime,
          riskLevel: isNightTime ? 'medium' : 'none'
        },
        newReceiverAddress: {
          detected: isNewReceiver,
          receiverAddress: transactionData.to,
          isNewReceiver: isNewReceiver,
          riskLevel: isNewReceiver ? 'medium' : 'none'
        }
      };
      
      return {
        riskScore: Math.min(localRiskScore, 1),
        isBlocked: localRiskScore >= 0.7,
        mlModelVersion: 'local-fallback-v1.0',
        detectedPatterns: [],
        signals: signals,
        riskFactors: {
          deviceChange: deviceChanged,
          newDevice: transactionData.deviceInfo?.isNewDevice || false,
          locationChange: false,
          unusualAmount: amountRatio >= 5,
          unusualTime: isNightTime,
          highFrequency: txCountLast10Min > 5,
          newReceiver: isNewReceiver,
          rapidTransactions: timeGapSeconds !== null && timeGapSeconds < 10
        },
        analyzedAt: new Date(),
        confidence: 0.5,
        recommendation: localRiskScore >= 0.7 ? 'block' : 'allow',
        error: 'ML service unavailable - using local fallback'
      };
    }

    throw new Error(`Fraud analysis failed: ${error.message}`);
  }
};

const verifyBiometric = async (biometricData, userId) => {
  try {
    const payload = {
      biometricData: biometricData,
      userId: userId,
      timestamp: new Date().toISOString()
    };

    const response = await mlClient.post('/api/biometric/verify', payload);

    return {
      verified: response.data.verified || false,
      confidence: response.data.confidence || 0,
      matchScore: response.data.matchScore || 0,
      message: response.data.message || '',
      timestamp: new Date()
    };

  } catch (error) {
    logger.error('Biometric Verification Error:', error.message);
    throw new Error(`Biometric verification failed: ${error.message}`);
  }
};

const verifyFacial = async (facialData, userId, imageData = null) => {
  try {
    const payload = {
      facialData: facialData,
      userId: userId,
      imageData: imageData,
      timestamp: new Date().toISOString()
    };

    const response = await mlClient.post('/api/facial/verify', payload);

    return {
      verified: response.data.verified || false,
      confidence: response.data.confidence || 0,
      matchScore: response.data.matchScore || 0,
      livenessCheck: response.data.livenessCheck || false,
      message: response.data.message || '',
      timestamp: new Date()
    };

  } catch (error) {
    logger.error('Facial Verification Error:', error.message);
    throw new Error(`Facial verification failed: ${error.message}`);
  }
};

const enrollBiometric = async (biometricData, userId) => {
  try {
    const payload = {
      biometricData: biometricData,
      userId: userId,
      timestamp: new Date().toISOString()
    };

    const response = await mlClient.post('/api/biometric/enroll', payload);

    return {
      success: response.data.success || false,
      biometricId: response.data.biometricId || null,
      message: response.data.message || '',
      timestamp: new Date()
    };

  } catch (error) {
    logger.error('Biometric Enrollment Error:', error.message);
    throw new Error(`Biometric enrollment failed: ${error.message}`);
  }
};

const enrollFacial = async (facialData, userId, imageData = null) => {
  try {
    const payload = {
      facialData: facialData,
      userId: userId,
      imageData: imageData,
      timestamp: new Date().toISOString()
    };

    const response = await mlClient.post('/api/facial/enroll', payload);

    return {
      success: response.data.success || false,
      facialId: response.data.facialId || null,
      message: response.data.message || '',
      timestamp: new Date()
    };

  } catch (error) {
    logger.error('Facial Enrollment Error:', error.message);
    throw new Error(`Facial enrollment failed: ${error.message}`);
  }
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
    logger.error('ML Service Health Check Error:', error.message);
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
  try {
    const payload = {
      transactions: transactionsData,
      timestamp: new Date().toISOString()
    };

    const response = await mlClient.post('/api/fraud/batch-analyze', payload);

    return response.data.results || [];

  } catch (error) {
    logger.error('Batch Fraud Analysis Error:', error.message);
    throw new Error(`Batch fraud analysis failed: ${error.message}`);
  }
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