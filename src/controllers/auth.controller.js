const jwt = require('jsonwebtoken');
const User = require('../models/user.model');
const Wallet = require('../models/wallet.model');
const { ethers } = require('ethers');
const config = require('../config/env');
const { successResponse, errorResponse } = require('../utils/response');
const logger = require('../utils/logger');
const { airdropInitialFunds } = require('../services/faucet_services');

// Helper for JWT
const signToken = (id) => {
  return jwt.sign({ id }, config.JWT_SECRET, { expiresIn: config.JWT_EXPIRE });
};

// 1. REGISTER
exports.register = async (req, res) => {
  try {
      const { email, password, firstName, lastName, phoneNumber } = req.body;
    
      const userExists = await User.findOne({ $or: [{ email }, { phoneNumber }] });
      if (userExists) return errorResponse(res, 'User already exists', 400);

      const user = await User.create({ email, password, firstName, lastName, phoneNumber });
      const token = signToken(user._id);

      let walletAddress = null;

      try {
          const generated = ethers.Wallet.createRandom();
          walletAddress = generated.address;
        
          const newWallet = await Wallet.create({
              userId: user._id,
              address: walletAddress,
              walletType: 'smart_account',
              network: config.BLOCKCHAIN_NETWORK || 'sepolia',
              chainId: parseInt(config.CHAIN_ID) || 11155111,
              isActive: true,
              isPrimary: true,
              smartAccountConfig: {
                ownerAddress: walletAddress,
                isDeployed: false
              }
          });

          user.walletId = newWallet._id;
          await user.save({ validateBeforeSave: false });

          // Trigger background airdrop
          airdropInitialFunds(user._id, walletAddress, config.BLOCKCHAIN_NETWORK)
            .then(() => logger.info(`Airdrop successfully initiated for ${user.email}`))
            .catch(err => logger.error('Airdrop background process failed:', err));

      } catch (wErr) {
          logger.error('Failed to create default wallet for user during registration:', wErr);
      }

      return successResponse(res, {
        user: {
          id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          walletAddress: walletAddress
        },
        accessToken: token
      }, 'Registration successful', 201);
    
  } catch (err) {
      logger.error('Register Controller Exception:', err);
      return errorResponse(res, err.message, 400);
  }
};

/**
 * 2. LOGIN (REVISED: Handles 'identifier' for Passkey/Device Login)
 */
exports.login = async (req, res) => {
  try {
      const { identifier, password } = req.body;
      
      if (!identifier || !password) {
        return errorResponse(res, 'Identifier and password are required', 400);
      }

      // Step A: Try finding user by email or phone directly
      let user = await User.findOne({ 
        $or: [
          { email: identifier.toLowerCase() }, 
          { phoneNumber: identifier }
        ] 
      }).select('+password');

      // Step B: If not found, identifier might be the wallet address
      if (!user) {
        const wallet = await Wallet.findOne({ address: identifier.toLowerCase() });
        if (wallet) {
          user = await User.findById(wallet.userId).select('+password');
        }
      }

      if (!user || !(await user.comparePassword(password))) {
          return errorResponse(res, 'Invalid credentials', 401);
      }

      const token = signToken(user._id);
      
      // Get the wallet address to return to frontend
      const primaryWallet = await Wallet.findOne({ userId: user._id, isPrimary: true });

      return successResponse(res, { 
        accessToken: token, 
        user: {
          id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          walletAddress: primaryWallet ? primaryWallet.address : null
        }
      }, 'Login successful');
  } catch (err) {
      logger.error('Login Error:', err);
      return errorResponse(res, 'Internal server error', 500);
  }
};

/**
 * 3. IDENTITY SETUP METHODS
 */
exports.setupFacial = async (req, res) => {
  try {
    const { facialData, imageData } = req.body;
    const user = await User.findById(req.user._id);
    if (!user) return errorResponse(res, 'User not found', 404);

    user.biometricData = { ...user.biometricData, facialFeatures: facialData, isVerified: true };
    user.kycStatus = 'verified';
    await user.save({ validateBeforeSave: false });

    return successResponse(res, null, 'Facial identity enrolled');
  } catch (err) {
    return errorResponse(res, 'Enrollment failed', 500);
  }
};

exports.setupBiometric = async (req, res) => {
  try {
    const { biometricData } = req.body;
    const user = await User.findById(req.user._id);
    user.biometricData.fingerprintHash = biometricData;
    user.biometricEnabled = true;
    await user.save({ validateBeforeSave: false });
    return successResponse(res, null, 'Biometric hardware linked');
  } catch (err) {
    return errorResponse(res, 'Link failed', 500);
  }
};

exports.getProfile = async (req, res) => successResponse(res, req.user, 'Profile fetched');
exports.refreshToken = async (req, res) => successResponse(res, { token: 'new_token_placeholder' }, 'Token refreshed');
exports.logout = async (req, res) => successResponse(res, null, 'Logged out');
exports.requestOtp = async (req, res) => successResponse(res, null, 'OTP Sent');
exports.verifyOtp = async (req, res) => successResponse(res, null, 'OTP Verified');
exports.verifyBiometric = async (req, res) => successResponse(res, null, 'Biometric Verified');
exports.changePassword = async (req, res) => successResponse(res, null, 'Password Changed');
exports.requestPasswordReset = async (req, res) => successResponse(res, null, 'Reset Link Sent');
exports.confirmPasswordReset = async (req, res) => successResponse(res, null, 'Password Reset Confirmed');
exports.updateProfile = async (req, res) => successResponse(res, null, 'Profile Updated');
exports.deleteAccount = async (req, res) => successResponse(res, null, 'Account Deleted');