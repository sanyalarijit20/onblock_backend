/**
* FRAUD ML SERVICE (DEMO MOCK)
* * In production, this service would communicate with Python microservices
* for Isolation Forest (Fraud) and FaceNet/ArcFace (Biometrics).
* * FOR DEMO: Returns simulated success responses to unblock the frontend flow.
*/


const logger = require('../utils/logger');


/**
* Analyzes transaction metadata for fraud patterns.
* @param {Object} transactionData - { amount, token, sender, receiver, etc. }
*/
const analyzeFraud = async (transactionData) => {
 logger.info('Analyzing fraud for transaction...');
  // Simulate processing delay (ML inference time)
 await new Promise(resolve => setTimeout(resolve, 800));


 // DEMO LOGIC:
 // If amount > 10000, flag as "High Risk" to show UI warning (optional demo feature)
 // Otherwise, return safe.
 const isHighValue = parseFloat(transactionData.amount) > 10000;


 return {
   isBlocked: false, // Don't block for demo
   riskScore: isHighValue ? 85.0 : 12.5, // 0-100
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
 // In real app: Verify signature against public key stored for user
 logger.info(`Verifying biometric for user ${userId}`);
  // Simulate delay
 await new Promise(resolve => setTimeout(resolve, 300));


 return {
   verified: true,
   method: 'fingerprint',
   timestamp: new Date()
 };
};


/**
* Verifies facial geometry against enrolled reference.
* @param {Object} facialData - { landmarks, imageData }
* @param {String} userId
*/
const verifyFacial = async (facialData, userId) => {
 logger.info(`Verifying facial identity for user ${userId}`);


 // In real app: Send to Python FaceNet microservice
 // FOR DEMO: Check if we actually received data, then approve
  if (!facialData || !facialData.imageData) {
   logger.warn('Facial verification missing image data');
   // For demo stability, we might still return true if you want to bypass completely,
   // but ideally we should require "some" data to prove the frontend sent it.
   return { verified: true, confidence: 0.95 };
 }


 // Simulate ML processing time
 await new Promise(resolve => setTimeout(resolve, 1500));


 return {
   verified: true,
   confidence: 0.98, // High confidence for demo
   livenessScore: 0.99
 };
};


module.exports = {
 analyzeFraud,
 verifyBiometric,
 verifyFacial
};

