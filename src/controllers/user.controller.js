const User = require('../models/user.model');
const Wallet = require('../models/wallet.model');
const { successResponse, errorResponse } = require('../utils/response');
const { getBalance, getTokenBalance } = require('../services/blockchain.service');
const { createSmartAccount } = require('../services/biconomy.service');
const logger = require('../utils/logger');
const { ethers } = require('ethers');

const getProfile = async (req, res) => {
  try {
    const user = req.user;

    const userData = {
      id: user._id,
      email: user.email,
      phoneNumber: user.phoneNumber,
      fullName: user.fullName,
      biometricEnabled: user.biometricEnabled,
      facialRecognitionEnabled: user.facialRecognitionEnabled,
      walletId: user.walletId,
      isActive: user.isActive,
      lastLogin: user.lastLogin,
      createdAt: user.createdAt
    };

    return successResponse(res, 'Profile retrieved successfully', userData);
  } catch (error) {
    logger.error('Get profile error:', error);
    return errorResponse(res, 'Failed to retrieve profile', 500, 'GET_PROFILE_ERROR');
  }
};

const updateProfile = async (req, res) => {
  try {
    const { fullName, phoneNumber } = req.body;
    const userId = req.userId;

    const updateData = {};
    if (fullName) updateData.fullName = fullName;
    if (phoneNumber) updateData.phoneNumber = phoneNumber;

    const user = await User.findByIdAndUpdate(userId, updateData, { new: true });

    logger.info(`Profile updated for user: ${userId}`);

    return successResponse(res, 'Profile updated successfully', {
      id: user._id,
      email: user.email,
      phoneNumber: user.phoneNumber,
      fullName: user.fullName
    });
  } catch (error) {
    logger.error('Update profile error:', error);
    return errorResponse(res, 'Failed to update profile', 500, 'UPDATE_PROFILE_ERROR');
  }
};

const getWallet = async (req, res) => {
  try {
    const user = req.user;

    if (!user.walletId) {
      return errorResponse(res, 'Wallet not found', 404, 'WALLET_NOT_FOUND');
    }

    const wallet = await Wallet.findById(user.walletId);

    if (!wallet) {
      return errorResponse(res, 'Wallet not found', 404, 'WALLET_NOT_FOUND');
    }

    const walletData = {
      id: wallet._id,
      address: wallet.address,
      smartAccountAddress: wallet.smartAccountAddress,
      network: wallet.network,
      isActive: wallet.isActive,
      createdAt: wallet.createdAt
    };

    return successResponse(res, 'Wallet retrieved successfully', walletData);
  } catch (error) {
    logger.error('Get wallet error:', error);
    return errorResponse(res, 'Failed to retrieve wallet', 500, 'GET_WALLET_ERROR');
  }
};

const createWallet = async (req, res) => {
  try {
    const userId = req.userId;
    const user = req.user;

    if (user.walletId) {
      return errorResponse(res, 'Wallet already exists', 400, 'WALLET_EXISTS');
    }

    const wallet = ethers.Wallet.createRandom();
    const ownerAddress = wallet.address;
    const privateKey = wallet.privateKey;

    const network = req.body.network || 'polygon';

    const smartAccount = await createSmartAccount(ownerAddress, network);

    const newWallet = await Wallet.create({
      userId: userId,
      address: ownerAddress,
      smartAccountAddress: smartAccount.smartAccountAddress,
      network: network,
      isActive: true
    });

    await User.findByIdAndUpdate(userId, { walletId: newWallet._id });

    logger.info(`Wallet created for user: ${userId}`);

    return successResponse(res, 'Wallet created successfully', {
      id: newWallet._id,
      address: newWallet.address,
      smartAccountAddress: newWallet.smartAccountAddress,
      network: newWallet.network,
      privateKey: privateKey
    }, 201);
  } catch (error) {
    logger.error('Create wallet error:', error);
    return errorResponse(res, 'Failed to create wallet', 500, 'CREATE_WALLET_ERROR');
  }
};

const getBalance = async (req, res) => {
  try {
    const user = req.user;

    if (!user.walletId) {
      return errorResponse(res, 'Wallet not found', 404, 'WALLET_NOT_FOUND');
    }

    const wallet = await Wallet.findById(user.walletId);

    if (!wallet) {
      return errorResponse(res, 'Wallet not found', 404, 'WALLET_NOT_FOUND');
    }

    const balanceService = require('../services/blockchain.service');
    const balanceData = await balanceService.getBalance(wallet.smartAccountAddress, wallet.network);

    return successResponse(res, 'Balance retrieved successfully', balanceData);
  } catch (error) {
    logger.error('Get balance error:', error);
    return errorResponse(res, 'Failed to retrieve balance', 500, 'GET_BALANCE_ERROR');
  }
};

const getTokenBalances = async (req, res) => {
  try {
    const user = req.user;

    if (!user.walletId) {
      return errorResponse(res, 'Wallet not found', 404, 'WALLET_NOT_FOUND');
    }

    const wallet = await Wallet.findById(user.walletId);

    if (!wallet) {
      return errorResponse(res, 'Wallet not found', 404, 'WALLET_NOT_FOUND');
    }

    const tokenAddresses = req.body.tokenAddresses || [];

    const tokenBalances = [];

    for (const tokenAddress of tokenAddresses) {
      try {
        const balance = await getTokenBalance(wallet.smartAccountAddress, tokenAddress, wallet.network);
        tokenBalances.push(balance);
      } catch (error) {
        logger.error(`Failed to get balance for token ${tokenAddress}:`, error);
      }
    }

    return successResponse(res, 'Token balances retrieved successfully', { tokens: tokenBalances });
  } catch (error) {
    logger.error('Get token balances error:', error);
    return errorResponse(res, 'Failed to retrieve token balances', 500, 'GET_TOKEN_BALANCES_ERROR');
  }
};

const backupWallet = async (req, res) => {
  try {
    const user = req.user;

    if (!user.walletId) {
      return errorResponse(res, 'Wallet not found', 404, 'WALLET_NOT_FOUND');
    }

    const wallet = await Wallet.findById(user.walletId);

    if (!wallet) {
      return errorResponse(res, 'Wallet not found', 404, 'WALLET_NOT_FOUND');
    }

    logger.info(`Wallet backup requested for user: ${user._id}`);

    return successResponse(res, 'Wallet backup data retrieved', {
      address: wallet.address,
      smartAccountAddress: wallet.smartAccountAddress,
      network: wallet.network,
      backupTimestamp: new Date()
    });
  } catch (error) {
    logger.error('Backup wallet error:', error);
    return errorResponse(res, 'Failed to backup wallet', 500, 'BACKUP_WALLET_ERROR');
  }
};

const getSecuritySettings = async (req, res) => {
  try {
    const user = req.user;

    const securitySettings = {
      biometricEnabled: user.biometricEnabled,
      facialRecognitionEnabled: user.facialRecognitionEnabled,
      twoFactorEnabled: user.securityFlags.twoFactorEnabled || false,
      loginAlerts: user.securityFlags.loginAlerts || false,
      transactionAlerts: user.securityFlags.transactionAlerts || false,
      lastLogin: user.lastLogin
    };

    return successResponse(res, 'Security settings retrieved', securitySettings);
  } catch (error) {
    logger.error('Get security settings error:', error);
    return errorResponse(res, 'Failed to retrieve security settings', 500, 'GET_SECURITY_ERROR');
  }
};

const updateSecuritySettings = async (req, res) => {
  try {
    const { twoFactorEnabled, loginAlerts, transactionAlerts } = req.body;
    const userId = req.userId;

    const updateData = {};
    if (typeof twoFactorEnabled !== 'undefined') updateData['securityFlags.twoFactorEnabled'] = twoFactorEnabled;
    if (typeof loginAlerts !== 'undefined') updateData['securityFlags.loginAlerts'] = loginAlerts;
    if (typeof transactionAlerts !== 'undefined') updateData['securityFlags.transactionAlerts'] = transactionAlerts;

    await User.findByIdAndUpdate(userId, updateData);

    logger.info(`Security settings updated for user: ${userId}`);

    return successResponse(res, 'Security settings updated successfully');
  } catch (error) {
    logger.error('Update security settings error:', error);
    return errorResponse(res, 'Failed to update security settings', 500, 'UPDATE_SECURITY_ERROR');
  }
};

const getActivityLog = async (req, res) => {
  try {
    const userId = req.userId;
    const { page = 1, limit = 20 } = req.query;

    logger.info(`Activity log requested for user: ${userId}`);

    const activities = [];

    return successResponse(res, 'Activity log retrieved', {
      activities,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: 0,
        pages: 0
      }
    });
  } catch (error) {
    logger.error('Get activity log error:', error);
    return errorResponse(res, 'Failed to retrieve activity log', 500, 'GET_ACTIVITY_ERROR');
  }
};

const getNotifications = async (req, res) => {
  try {
    const userId = req.userId;
    const { page = 1, limit = 20 } = req.query;

    logger.info(`Notifications requested for user: ${userId}`);

    const notifications = [];

    return successResponse(res, 'Notifications retrieved', {
      notifications,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: 0,
        pages: 0
      }
    });
  } catch (error) {
    logger.error('Get notifications error:', error);
    return errorResponse(res, 'Failed to retrieve notifications', 500, 'GET_NOTIFICATIONS_ERROR');
  }
};

const markNotificationAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    logger.info(`Notification ${id} marked as read for user: ${userId}`);

    return successResponse(res, 'Notification marked as read');
  } catch (error) {
    logger.error('Mark notification as read error:', error);
    return errorResponse(res, 'Failed to mark notification as read', 500, 'MARK_NOTIFICATION_ERROR');
  }
};

const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    logger.info(`Notification ${id} deleted for user: ${userId}`);

    return successResponse(res, 'Notification deleted');
  } catch (error) {
    logger.error('Delete notification error:', error);
    return errorResponse(res, 'Failed to delete notification', 500, 'DELETE_NOTIFICATION_ERROR');
  }
};

const getSettings = async (req, res) => {
  try {
    const user = req.user;

    const settings = {
      notifications: {
        email: true,
        push: true,
        sms: false
      },
      privacy: {
        showProfile: true,
        showActivity: false
      },
      preferences: {
        language: 'en',
        currency: 'USD',
        theme: 'light'
      }
    };

    return successResponse(res, 'Settings retrieved', settings);
  } catch (error) {
    logger.error('Get settings error:', error);
    return errorResponse(res, 'Failed to retrieve settings', 500, 'GET_SETTINGS_ERROR');
  }
};

const updateSettings = async (req, res) => {
  try {
    const userId = req.userId;
    const settings = req.body;

    logger.info(`Settings updated for user: ${userId}`);

    return successResponse(res, 'Settings updated successfully');
  } catch (error) {
    logger.error('Update settings error:', error);
    return errorResponse(res, 'Failed to update settings', 500, 'UPDATE_SETTINGS_ERROR');
  }
};

module.exports = {
  getProfile,
  updateProfile,
  getWallet,
  createWallet,
  getBalance,
  getTokenBalances,
  backupWallet,
  getSecuritySettings,
  updateSecuritySettings,
  getActivityLog,
  getNotifications,
  markNotificationAsRead,
  deleteNotification,
  getSettings,
  updateSettings
};