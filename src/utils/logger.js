const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');
const { NODE_ENV, LOG_LEVEL, LOG_FILE_PATH } = require('../config/env');

// Detect if we are running on Vercel
const isVercel = process.env.VERCEL === '1';

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.printf(({ timestamp, level, message, stack }) => {
    const logMessage = `${timestamp} [${level.toUpperCase()}]: ${message}`;
    return stack ? `${logMessage}\n${stack}` : logMessage;
  })
);

const consoleFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, stack }) => {
    const logMessage = `${timestamp} [${level}]: ${message}`;
    return stack ? `${logMessage}\n${stack}` : logMessage;
  })
);

const transports = [];

// Always add Console transport for both local (Elitebook) and cloud (Vercel)
transports.push(new winston.transports.Console({
  format: consoleFormat,
}));

// ONLY add File Transports if we are NOT on Vercel
if (!isVercel && (NODE_ENV === 'production' || process.env.ENABLE_FILE_LOGGING === 'true')) {
  // We wrap this in a check because LOG_FILE_PATH might be invalid in serverless
  if (LOG_FILE_PATH) {
    const errorFileTransport = new DailyRotateFile({
      filename: path.join(LOG_FILE_PATH, 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxSize: '20m',
      maxFiles: '14d',
      format: logFormat,
    });

    const combinedFileTransport = new DailyRotateFile({
      filename: path.join(LOG_FILE_PATH, 'combined-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',
      format: logFormat,
    });

    transports.push(errorFileTransport);
    transports.push(combinedFileTransport);

    errorFileTransport.on('rotate', (oldFilename, newFilename) => {
      logger.info(`Log file rotated: ${oldFilename} -> ${newFilename}`);
    });
  }
}

const logger = winston.createLogger({
  level: LOG_LEVEL || 'info',
  format: logFormat,
  transports,
  exitOnError: false,
});

// Helper Methods
logger.logRequest = (req, statusCode, responseTime) => {
  const message = `${req.method} ${req.originalUrl} - ${statusCode} - ${responseTime}ms - ${req.ip}`;
  if (statusCode >= 500) logger.error(message);
  else if (statusCode >= 400) logger.warn(message);
  else logger.info(message);
};

logger.logTransaction = (action, details) => {
  logger.info(`Blockchain Transaction [${action}]:`, { ...details, timestamp: new Date().toISOString() });
};

logger.logMLService = (endpoint, result) => {
  logger.info(`ML Service Call [${endpoint}]:`, { ...result, timestamp: new Date().toISOString() });
};

logger.logAuth = (event, userId, details = {}) => {
  logger.info(`Auth Event [${event}] - User: ${userId}`, { ...details, timestamp: new Date().toISOString() });
};

logger.logFraud = (fraudDetails) => {
  const level = fraudDetails.isFraud ? 'warn' : 'info';
  logger[level]('Fraud Detection:', { ...fraudDetails, timestamp: new Date().toISOString() });
};

logger.stream = {
  write: (message) => logger.info(message.trim()),
};

// Initialization info (Console only)
if (isVercel) {
  logger.info('Logger initialized in VERCEL cloud mode (Console logging only)');
} else {
  logger.info(`Logger initialized in ${NODE_ENV.toUpperCase()} mode`);
}

module.exports = logger;