

const logger = require('../utils/logger');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const analyzeFraud = async (transactionData) => {
  logger.info('FRAUD_ML_DEMO: analyzeFraud started');

  
  await sleep(800);

  const amount = Number(transactionData?.amount || 0);
  const high = amount > 10000;

  const result = {
    isBlocked: false, 
    riskScore: high ? 85.0 : 12.5,
    signals: high ? ['high_value_transfer'] : [],
    detectedPatterns: [],
    mlModelVersion: 'v1.0.0-demo',
    analyzedAt: new Date()
  };

  logger.info('FRAUD_ML_DEMO: analyzeFraud completed');
  return result;
};

const verifyBiometric = async (bioData, userId) => {
  logger.info(`FRAUD_ML_DEMO: verifyBiometric started for user ${userId}`);

  // Simulate biometric verification delay
  await sleep(300);

  return {
    verified: true,
    method: 'fingerprint',
    timestamp: new Date()
  };
};

const verifyFacial = async (facialData, userId) => {
  logger.info(`FRAUD_ML_DEMO: verifyFacial started for user ${userId}`);

  // Facial verification is OPTIONAL in demo
  if (!facialData || !facialData.imageData) {
    logger.warn(
      `FRAUD_ML_DEMO: Facial data missing for user ${userId}, bypassing verification`
    );

    return {
      verified: true
    };
  }

  // Simulate heavier ML inference
  await sleep(1500);

  return {
    verified: true,
    confidence: 0.98,
    livenessScore: 0.99
  };
};

module.exports = {
  analyzeFraud,
  verifyBiometric,
  verifyFacial
};
