const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');
const { NODE_ENV, LOG_LEVEL, LOG_FILE_PATH } = require('../config/env');

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


const consoleTransport = new winston.transports.Console({
  format: consoleFormat,
});


const transports = [];


if (NODE_ENV === 'development') {
  transports.push(consoleTransport);
}


if (NODE_ENV === 'production' || process.env.ENABLE_FILE_LOGGING === 'true') {
  transports.push(errorFileTransport);
  transports.push(combinedFileTransport);
}

if (transports.length === 0) {
  transports.push(consoleTransport);
}

const logger = winston.createLogger({
  level: LOG_LEVEL || 'info',
  format: logFormat,
  transports,
  exitOnError: false,
});


errorFileTransport.on('rotate', (oldFilename, newFilename) => {
  logger.info(`Log file rotated: ${oldFilename} -> ${newFilename}`);
});

combinedFileTransport.on('rotate', (oldFilename, newFilename) => {
  logger.info(`Log file rotated: ${oldFilename} -> ${newFilename}`);
});


logger.logRequest = (req, statusCode, responseTime) => {
  const message = `${req.method} ${req.originalUrl} - ${statusCode} - ${responseTime}ms - ${req.ip}`;
  
  if (statusCode >= 500) {
    logger.error(message);
  } else if (statusCode >= 400) {
    logger.warn(message);
  } else {
    logger.info(message);
  }
};


logger.logTransaction = (action, details) => {
  logger.info(`Blockchain Transaction [${action}]:`, {
    ...details,
    timestamp: new Date().toISOString(),
  });
};


logger.logMLService = (endpoint, result) => {
  logger.info(`ML Service Call [${endpoint}]:`, {
    ...result,
    timestamp: new Date().toISOString(),
  });
};


logger.logAuth = (event, userId, details = {}) => {
  logger.info(`Auth Event [${event}] - User: ${userId}`, {
    ...details,
    timestamp: new Date().toISOString(),
  });
};


logger.logFraud = (fraudDetails) => {
  const level = fraudDetails.isFraud ? 'warn' : 'info';
  logger[level]('Fraud Detection:', {
    ...fraudDetails,
    timestamp: new Date().toISOString(),
  });
};


logger.stream = {
  write: (message) => {
    logger.info(message.trim());
  },
};


if (NODE_ENV === 'development') {
  logger.info(' Logger initialized in DEVELOPMENT mode');
  logger.info(` Log level: ${LOG_LEVEL || 'info'}`);
} else {
  logger.info(' Logger initialized in PRODUCTION mode');
  logger.info(` Log level: ${LOG_LEVEL || 'info'}`);
  logger.info(` Log files location: ${LOG_FILE_PATH}`);
}

module.exports = logger;