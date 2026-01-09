/**
* FRAUD ML SERVICE (DEMO MOCK)
* * In production, this service would communicate with Python microservices
* for Isolation Forest (Fraud) and biometric verification services.
* * FOR DEMO: Returns simulated success responses to unblock the frontend flow.
*/


const logger = require('../utils/logger');
const axios = require('axios');
const config = require('../config/env');

const ML_BASE = config.ML_SERVICE_URL;
const FRAUD_ENDPOINT = config.ML_FRAUD_DETECTION_ENDPOINT || '/check-fraud';
const BIOMETRIC_ENDPOINT = config.ML_BIOMETRIC_VERIFICATION_ENDPOINT;
const ML_TIMEOUT = config.ML_SERVICE_TIMEOUT || 30000;


/**
* Analyzes transaction metadata for fraud patterns.
* @param {Object} transactionData - { amount, token, sender, receiver, etc. }
*/
const analyzeFraud = async (transactionData) => {
  logger.info('Analyzing fraud for transaction...');

  // If ML service configured, call it; otherwise fall back to demo logic
  if (ML_BASE) {
    try {
      const url = `${ML_BASE.replace(/\/$/, '')}${FRAUD_ENDPOINT}`;
      const resp = await axios.post(url, transactionData, {
        timeout: ML_TIMEOUT,
        headers: {
          'Content-Type': 'application/json',
          ...(config.ML_SERVICE_API_KEY ? { 'x-api-key': config.ML_SERVICE_API_KEY } : {})
        }
      });

      return resp.data;
    } catch (err) {
      logger.warn('ML fraud service unreachable, falling back to demo logic', err.message);
    }
  }

  // Fallback demo logic
  await new Promise((resolve) => setTimeout(resolve, 600));
  const isHighValue = parseFloat(transactionData.amount) > config.HIGH_RISK_AMOUNT_THRESHOLD;

  return {
    isBlocked: false,
    riskScore: isHighValue ? 0.85 : 0.125,
    signals: isHighValue ? ['high_value_transfer'] : [],
    detectedPatterns: [],
    mlModelVersion: 'v1.0.0-demo',
    analyzedAt: new Date()
  };
};


/**
* Verifies biometric signature (Fingerprint/Passkey).
* @param {Object} bioData - Signed payload from device
* @param {String} userId
*/
const verifyBiometric = async (bioData, userId) => {
  logger.info(`Verifying biometric for user ${userId}`);

  if (ML_BASE && BIOMETRIC_ENDPOINT) {
    try {
      const url = `${ML_BASE.replace(/\/$/, '')}${BIOMETRIC_ENDPOINT}`;
      const resp = await axios.post(url, { bioData, userId }, { timeout: ML_TIMEOUT });
      return resp.data;
    } catch (err) {
      logger.warn('Biometric ML service unreachable, falling back to demo', err.message);
    }
  }

  // Demo fallback
  await new Promise((resolve) => setTimeout(resolve, 300));
  return { verified: true, method: 'fingerprint', timestamp: new Date() };
};




module.exports = {
 analyzeFraud,
 verifyBiometric
};

