const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');

// Import utilities and config
const logger = require('./src/utils/logger');
const { NODE_ENV, PORT } = require('./src/config/env');
const { connectDB } = require('./src/config/db');
const { successResponse, errorResponse } = require('./src/utils/response');

// Import Routes
const authRoutes = require('./src/routes/auth.routes');
const userRoutes = require('./src/routes/user.routes');
const transactionRoutes = require('./src/routes/transaction.routes');

const app = express();

// Database Connection - Triggered immediately on startup
connectDB()
  .then(() => logger.info('Database connection established'))
  .catch((err) => logger.error('Database connection failed:', err));

app.set('trust proxy', 1);
app.use(helmet());

// CORS Configuration
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

// Rate Limiting
const globalLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  standardHeaders: true,
  legacyHeaders: false
});
app.use(globalLimiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request ID Middleware
app.use((req, res, next) => {
  req.requestId = crypto.randomUUID();
  res.setHeader('X-Request-ID', req.requestId);
  next();
});

// Logging
if (NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(
    morgan('combined', {
      stream: { write: message => logger.info(message.trim()) }
    })
  );
}

// Routes
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

// 404 Handler
app.use((req, res) => {
  return errorResponse(res, `Cannot ${req.method} ${req.path}`, 404, 'ROUTE_NOT_FOUND');
});

// Global Error Handler
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

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal server error';
  return errorResponse(
    res,
    NODE_ENV === 'production' ? 'Internal server error' : message,
    statusCode,
    err.errorCode || 'INTERNAL_ERROR'
  );
});

// CONDITIONAL LISTEN: Only runs locally, not on Vercel
if (process.env.VERCEL !== '1') {
  app.listen(PORT || 5000, () => {
    logger.info(`Local Server running on port ${PORT || 5000}`);
  });
}

// Required for Vercel
module.exports = app;