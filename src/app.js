const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');

const logger = require('./utils/logger');
const { NODE_ENV } = require('./config/env');
const { successResponse, errorResponse } = require('./utils/response');

const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const transactionRoutes = require('./routes/transaction.routes');

const app = express();

app.set('trust proxy', 1);

app.use(helmet());

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);

      const allowedOrigins =
        NODE_ENV === 'production'
          ? process.env.ALLOWED_ORIGINS?.split(',') || []
          : ['*'];

      if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('CORS_NOT_ALLOWED'));
      }
    },
    credentials: true
  })
);

const globalLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  standardHeaders: true,
  legacyHeaders: false
});
app.use(globalLimiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use((req, res, next) => {
  req.requestId = crypto.randomUUID();
  res.setHeader('X-Request-ID', req.requestId);
  next();
});

if (NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(
    morgan('combined', {
      stream: {
        write: message => logger.info(message.trim())
      }
    })
  );
}

app.get('/health', (req, res) => {
  const healthCheck = {
    uptime: process.uptime(),
    message: 'OK',
    timestamp: Date.now(),
    environment: NODE_ENV,
    requestId: req.requestId
  };

  return successResponse(res, healthCheck, 'Server is healthy', 200);
});

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/transactions', transactionRoutes);

app.get('/', (req, res) => {
  return successResponse(
    res,
    {
      name: 'OnBlock Backend API',
      version: '1.0.0',
      description: 'Blockchain-based transaction platform with biometric security'
    },
    'Welcome to OnBlock API'
  );
});

app.use((req, res) => {
  return errorResponse(
    res,
    `Cannot ${req.method} ${req.path}`,
    404,
    'ROUTE_NOT_FOUND'
  );
});

app.use((err, req, res, next) => {
  logger.error('Global error handler:', {
    requestId: req.requestId,
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method
  });

  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(e => e.message);
    return errorResponse(res, errors, 400, 'VALIDATION_ERROR');
  }

  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern)[0];
    return errorResponse(res, `${field} already exists`, 409, 'DUPLICATE_ERROR');
  }

  if (err.name === 'JsonWebTokenError') {
    return errorResponse(res, 'Invalid token', 401, 'INVALID_TOKEN');
  }

  if (err.name === 'TokenExpiredError') {
    return errorResponse(res, 'Token expired', 401, 'TOKEN_EXPIRED');
  }

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal server error';
  const errorCode = err.errorCode || 'INTERNAL_ERROR';

  return errorResponse(
    res,
    NODE_ENV === 'production' ? 'Internal server error' : message,
    statusCode,
    errorCode,
    NODE_ENV === 'development' ? err.stack : undefined
  );
});

module.exports = app;
