require('dotenv').config();
const getEnvVar = (key, defaultValue = null) => {
  const value = process.env[key] || defaultValue;
  
  if (value === null) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  
  return value;
};


const config = {
  
  NODE_ENV: getEnvVar('NODE_ENV', 'development'),
  PORT: parseInt(getEnvVar('PORT', '5000'), 10),
  
  
  MONGODB_URI: getEnvVar('MONGODB_URI'),
  
  
  JWT_SECRET: getEnvVar('JWT_SECRET'),
  JWT_EXPIRE: getEnvVar('JWT_EXPIRE', '7d'),
  JWT_REFRESH_SECRET: getEnvVar('JWT_REFRESH_SECRET'),
  JWT_REFRESH_EXPIRE: getEnvVar('JWT_REFRESH_EXPIRE', '30d'),
  
  
  ALLOWED_ORIGINS: getEnvVar('ALLOWED_ORIGINS', '*'),
  
  
  BLOCKCHAIN_NETWORK: getEnvVar('BLOCKCHAIN_NETWORK', 'sepolia'),
  RPC_URL: getEnvVar('RPC_URL'),
  CHAIN_ID: parseInt(getEnvVar('CHAIN_ID', '11155111'), 10),
  BACKEND_WALLET_PRIVATE_KEY: getEnvVar('BACKEND_WALLET_PRIVATE_KEY'),
  

  BICONOMY_BUNDLER_URL: getEnvVar('BICONOMY_BUNDLER_URL'),
  BICONOMY_PAYMASTER_URL: getEnvVar('BICONOMY_PAYMASTER_URL'),
  BICONOMY_API_KEY: getEnvVar('BICONOMY_API_KEY'),
  ACCOUNT_FACTORY_ADDRESS: getEnvVar('ACCOUNT_FACTORY_ADDRESS'),
  ENTRY_POINT_ADDRESS: getEnvVar('ENTRY_POINT_ADDRESS'),
  
  
  ML_SERVICE_URL: getEnvVar('ML_SERVICE_URL', 'http://localhost:8000'),
  ML_SERVICE_API_KEY: getEnvVar('ML_SERVICE_API_KEY', ''),
  ML_FRAUD_DETECTION_ENDPOINT: getEnvVar('ML_FRAUD_DETECTION_ENDPOINT', '/api/v1/fraud-detection'),
  ML_BIOMETRIC_VERIFICATION_ENDPOINT: getEnvVar('ML_BIOMETRIC_VERIFICATION_ENDPOINT', '/api/v1/biometric-verification'),
  ML_SERVICE_TIMEOUT: parseInt(getEnvVar('ML_SERVICE_TIMEOUT', '30000'), 10),
  
 
  RATE_LIMIT_WINDOW_MS: parseInt(getEnvVar('RATE_LIMIT_WINDOW_MS', '900000'), 10),
  RATE_LIMIT_MAX_REQUESTS: parseInt(getEnvVar('RATE_LIMIT_MAX_REQUESTS', '100'), 10),
  
  
  LOG_LEVEL: getEnvVar('LOG_LEVEL', 'info'),
  LOG_FILE_PATH: getEnvVar('LOG_FILE_PATH', './logs'),
  
 
  BCRYPT_ROUNDS: parseInt(getEnvVar('BCRYPT_ROUNDS', '10'), 10),
  MAX_FILE_SIZE: parseInt(getEnvVar('MAX_FILE_SIZE', '10485760'), 10), // 10MB default
  
  
  FRAUD_SCORE_THRESHOLD: parseFloat(getEnvVar('FRAUD_SCORE_THRESHOLD', '0.7')),
  HIGH_RISK_AMOUNT_THRESHOLD: parseFloat(getEnvVar('HIGH_RISK_AMOUNT_THRESHOLD', '10000')),
};


const validateConfig = () => {
  const errors = [];
  
  
  if (config.NODE_ENV === 'production') {
    if (config.JWT_SECRET.includes('change-in-production')) {
      errors.push('JWT_SECRET must be changed in production');
    }
    if (config.JWT_REFRESH_SECRET.includes('change-in-production')) {
      errors.push('JWT_REFRESH_SECRET must be changed in production');
    }
  }
  

  if (config.PORT < 1 || config.PORT > 65535) {
    errors.push('PORT must be between 1 and 65535');
  }
  
 
  if (config.CHAIN_ID < 1) {
    errors.push('CHAIN_ID must be a positive integer');
  }
  
  
  if (config.FRAUD_SCORE_THRESHOLD < 0 || config.FRAUD_SCORE_THRESHOLD > 1) {
    errors.push('FRAUD_SCORE_THRESHOLD must be between 0 and 1');
  }
  
  
  if (config.BCRYPT_ROUNDS < 4 || config.BCRYPT_ROUNDS > 31) {
    errors.push('BCRYPT_ROUNDS must be between 4 and 31');
  }
  
  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
  }
};


validateConfig();

module.exports = config;