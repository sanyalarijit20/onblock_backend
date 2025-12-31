const axios = require('axios');
const logger = require('../utils/logger');

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
    const payload = {
      from: transactionData.from,
      to: transactionData.to,
      amount: transactionData.amount,
      token: transactionData.token || { symbol: 'ETH' },
      network: transactionData.network || 'polygon',
      userId: transactionData.userId,
      timestamp: new Date().toISOString(),
      metadata: transactionData.metadata || {}
    };

    const response = await mlClient.post('/api/fraud/analyze', payload);

    return {
      riskScore: response.data.riskScore || 0,
      isBlocked: response.data.isBlocked || false,
      mlModelVersion: response.data.modelVersion || 'v1.0',
      detectedPatterns: response.data.detectedPatterns || [],
      analyzedAt: new Date(),
      confidence: response.data.confidence || 0,
      recommendation: response.data.recommendation || 'allow'
    };

  } catch (error) {
    logger.error('ML Fraud Analysis Error:', error.message);
    
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      logger.warn('ML service unavailable, allowing transaction by default');
      return {
        riskScore: 0,
        isBlocked: false,
        mlModelVersion: 'unavailable',
        detectedPatterns: [],
        analyzedAt: new Date(),
        confidence: 0,
        recommendation: 'allow',
        error: 'ML service unavailable'
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