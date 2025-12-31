const app = require('./app');
const { connectDB } = require('./config/db');
const logger = require('./utils/logger');
const { PORT, NODE_ENV } = require('./config/env');


const startServer = async () => {
  try {
    
    await connectDB();
    logger.info(' Database connection established');

    
    const server = app.listen(PORT, () => {
      logger.info(` Server running in ${NODE_ENV} mode on port ${PORT}`);
      logger.info(` Health check available at http://localhost:${PORT}/health`);
    });

    
    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        logger.error(` Port ${PORT} is already in use`);
      } else {
        logger.error(' Server error:', error);
      }
      process.exit(1);
    });

    
    const gracefulShutdown = async (signal) => {
      logger.info(`\n${signal} received. Starting graceful shutdown...`);
      
      server.close(async () => {
        logger.info(' HTTP server closed');
        
        try {
          
          const mongoose = require('mongoose');
          await mongoose.connection.close();
          logger.info(' Database connection closed');
          
          logger.info(' Graceful shutdown completed');
          process.exit(0);
        } catch (error) {
          logger.error(' Error during shutdown:', error);
          process.exit(1);
        }
      });

      
      setTimeout(() => {
        logger.error('  Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    
    process.on('uncaughtException', (error) => {
      logger.error(' Uncaught Exception:', error);
      process.exit(1);
    });

    
    process.on('unhandledRejection', (reason, promise) => {
      logger.error(' Unhandled Rejection at:', promise, 'reason:', reason);
      process.exit(1);
    });

  } catch (error) {
    logger.error(' Failed to start server:', error);
    process.exit(1);
  }
};


startServer();