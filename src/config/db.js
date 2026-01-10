const mongoose = require('mongoose');
const logger = require('../utils/logger');
const { MONGODB_URI, NODE_ENV } = require('./env');


const mongooseOptions = {
  
  maxPoolSize: 10,
  minPoolSize: 2,
  
  
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  
  
  autoIndex: NODE_ENV === 'development',
  

  retryWrites: true,
  w: 'majority',
};


const connectDB = async () => {
  try {
    
    mongoose.set('strictQuery', true); 

    
    const conn = await mongoose.connect(MONGODB_URI, mongooseOptions);

    logger.info(` MongoDB Connected: ${conn.connection.host}`);
    logger.info(` Database: ${conn.connection.name}`);

    
    if (NODE_ENV === 'development') {
      logger.info(` Connection Pool Size: ${mongooseOptions.maxPoolSize}`);
    }

  } catch (error) {
    logger.error(' MongoDB connection error:', error.message);
    
    
    if (NODE_ENV === 'production') {
      logger.info(' Retrying connection in 5 seconds...');
      setTimeout(connectDB, 5000);
    } else {
      
      process.exit(1);
    }
  }
};


mongoose.connection.on('connected', () => {
  logger.info(' Mongoose connected to MongoDB');
});

mongoose.connection.on('error', (err) => {
  logger.error(' Mongoose connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  logger.warn('  Mongoose disconnected from MongoDB');
  
  // Attempt to reconnect in production
  if (NODE_ENV === 'production') {
    logger.info(' Attempting to reconnect...');
    setTimeout(connectDB, 5000);
  }
});

mongoose.connection.on('reconnected', () => {
  logger.info(' Mongoose reconnected to MongoDB');
});


process.on('SIGINT', async () => {
  try {
    await mongoose.connection.close();
    logger.info(' MongoDB connection closed through app termination');
    process.exit(0);
  } catch (error) {
    logger.error(' Error closing MongoDB connection:', error);
    process.exit(1);
  }
});


const getConnectionStatus = () => {
  const state = mongoose.connection.readyState;
  const states = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };

  return {
    status: states[state] || 'unknown',
    host: mongoose.connection.host || 'N/A',
    database: mongoose.connection.name || 'N/A',
    collections: Object.keys(mongoose.connection.collections).length,
  };
};


const closeConnection = async () => {
  try {
    await mongoose.connection.close();
    logger.info(' MongoDB connection closed');
  } catch (error) {
    logger.error(' Error closing MongoDB connection:', error);
    throw error;
  }
};

module.exports = {
  connectDB,
  getConnectionStatus,
  closeConnection,
};