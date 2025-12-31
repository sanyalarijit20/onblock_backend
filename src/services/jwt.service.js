const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

const generateAccessToken = (userId) => {
  try {
    const payload = {
      userId: userId,
      type: 'access',
      iat: Math.floor(Date.now() / 1000)
    };

    const token = jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    return token;
  } catch (error) {
    logger.error('Error generating access token:', error);
    throw new Error('Token generation failed');
  }
};

const generateRefreshToken = (userId) => {
  try {
    const payload = {
      userId: userId,
      type: 'refresh',
      iat: Math.floor(Date.now() / 1000)
    };

    const token = jwt.sign(
      payload,
      process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d' }
    );

    return token;
  } catch (error) {
    logger.error('Error generating refresh token:', error);
    throw new Error('Refresh token generation failed');
  }
};

const verifyToken = (token, isRefresh = false) => {
  try {
    const secret = isRefresh 
      ? (process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET)
      : process.env.JWT_SECRET;

    const decoded = jwt.verify(token, secret);
    return decoded;
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new Error('Token has expired');
    }
    if (error.name === 'JsonWebTokenError') {
      throw new Error('Invalid token');
    }
    logger.error('Error verifying token:', error);
    throw new Error('Token verification failed');
  }
};

const decodeToken = (token) => {
  try {
    const decoded = jwt.decode(token, { complete: true });
    return decoded;
  } catch (error) {
    logger.error('Error decoding token:', error);
    return null;
  }
};

const generateTokenPair = (userId) => {
  const accessToken = generateAccessToken(userId);
  const refreshToken = generateRefreshToken(userId);

  return {
    accessToken,
    refreshToken,
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  };
};

const refreshAccessToken = (refreshToken) => {
  try {
    const decoded = verifyToken(refreshToken, true);
    
    if (decoded.type !== 'refresh') {
      throw new Error('Invalid token type');
    }

    const newAccessToken = generateAccessToken(decoded.userId);
    
    return {
      accessToken: newAccessToken,
      expiresIn: process.env.JWT_EXPIRES_IN || '7d'
    };
  } catch (error) {
    logger.error('Error refreshing access token:', error);
    throw error;
  }
};

const getTokenExpiry = (token) => {
  try {
    const decoded = decodeToken(token);
    if (!decoded || !decoded.payload.exp) {
      return null;
    }
    return new Date(decoded.payload.exp * 1000);
  } catch (error) {
    logger.error('Error getting token expiry:', error);
    return null;
  }
};

const isTokenExpired = (token) => {
  try {
    const expiry = getTokenExpiry(token);
    if (!expiry) return true;
    return Date.now() >= expiry.getTime();
  } catch (error) {
    return true;
  }
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
  decodeToken,
  generateTokenPair,
  refreshAccessToken,
  getTokenExpiry,
  isTokenExpired
};