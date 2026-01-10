const User = require('../models/user.model');
const Wallet = require('../models/wallet.model');
const { successResponse, errorResponse } = require('../utils/response');
const {
  getBalance: getChainBalance,
  getTokenBalance
} = require('../services/blockchain.service');
const { createSmartAccount } = require('../services/biconomy.service');
const logger = require('../utils/logger');
const { ethers } = require('ethers');

/* =======================
   Helpers
======================= */

const loadUserWallet = async (user) => {
  if (!user.walletId) {
    throw { status: 404, code: 'WALLET_NOT_FOUND', message: 'Wallet not found' };
  }

  const wallet = await Wallet.findById(user.walletId);
  if (!wallet) {
    throw { status: 404, code: 'WALLET_NOT_FOUND', message: 'Wallet not found' };
  }

  return wallet;
};

const handleError = (res, error, fallbackMessage, fallbackCode) => {
  logger.error(fallbackMessage, error);
  return errorResponse(
    res,
    error.message || fallbackMessage,
    error.status || 500,
    error.code || fallbackCode
  );
};

/* =======================
   Profile
======================= */

const getProfile = async (req, res) => {
  try {
    const u = req.user;
    return successResponse(res, 'Profile retrieved successfully', {
      id: u._id,
      email: u.email,
      phoneNumber: u.phoneNumber,
      fullName: u.fullName,
      biometricEnabled: u.biometricEnabled,
      walletId: u.walletId,
      isActive: u.isActive,
      lastLogin: u.lastLogin,
      createdAt: u.createdAt
    });
  } catch (e) {
    return handleError(res, e, 'Failed to retrieve profile', 'GET_PROFILE_ERROR');
  }
};

const updateProfile = async (req, res) => {
  try {
    const updates = {};
    if (req.body.fullName) updates.fullName = req.body.fullName;
    if (req.body.phoneNumber) updates.phoneNumber = req.body.phoneNumber;

    const user = await User.findByIdAndUpdate(req.userId, updates, { new: true });

    return successResponse(res, 'Profile updated successfully', {
      id: user._id,
      email: user.email,
      phoneNumber: user.phoneNumber,
      fullName: user.fullName
    });
  } catch (e) {
    return handleError(res, e, 'Failed to update profile', 'UPDATE_PROFILE_ERROR');
  }
};

/* =======================
   Wallet
======================= */

const getWallet = async (req, res) => {
  try {
    const wallet = await loadUserWallet(req.user);
    return successResponse(res, 'Wallet retrieved successfully', {
      id: wallet._id,
      address: wallet.address,
      smartAccountAddress: wallet.smartAccountAddress,
      network: wallet.network,
      isActive: wallet.isActive,
      createdAt: wallet.createdAt
    });
  } catch (e) {
    return handleError(res, e, 'Failed to retrieve wallet', 'GET_WALLET_ERROR');
  }
};

const createWallet = async (req, res) => {
  try {
    if (req.user.walletId) {
      return errorResponse(res, 'Wallet already exists', 400, 'WALLET_EXISTS');
    }

    const wallet = ethers.Wallet.createRandom();
    const network = req.body.network || 'polygon';

    const smartAccount = await createSmartAccount(wallet.address, network);

    const newWallet = await Wallet.create({
      userId: req.userId,
      address: wallet.address,
      smartAccountAddress: smartAccount.smartAccountAddress,
      network,
      isActive: true
    });

    await User.findByIdAndUpdate(req.userId, { walletId: newWallet._id });

    return successResponse(res, 'Wallet created successfully', {
      id: newWallet._id,
      address: newWallet.address,
      smartAccountAddress: newWallet.smartAccountAddress,
      network,
      privateKey: wallet.privateKey
    }, 201);
  } catch (e) {
    return handleError(res, e, 'Failed to create wallet', 'CREATE_WALLET_ERROR');
  }
};

/* =======================
   Balances
======================= */

const getBalance = async (req, res) => {
  try {
    const wallet = await loadUserWallet(req.user);
    const balance = await getChainBalance(
      wallet.smartAccountAddress,
      wallet.network
    );

    return successResponse(res, 'Balance retrieved successfully', balance);
  } catch (e) {
    return handleError(res, e, 'Failed to retrieve balance', 'GET_BALANCE_ERROR');
  }
};

const getTokenBalances = async (req, res) => {
  try {
    const wallet = await loadUserWallet(req.user);
    const tokens = req.body.tokenAddresses || [];

    const results = await Promise.allSettled(
      tokens.map(t =>
        getTokenBalance(wallet.smartAccountAddress, t, wallet.network)
      )
    );

    return successResponse(res, 'Token balances retrieved successfully', {
      tokens: results
        .filter(r => r.status === 'fulfilled')
        .map(r => r.value)
    });
  } catch (e) {
    return handleError(res, e, 'Failed to retrieve token balances', 'GET_TOKEN_BALANCES_ERROR');
  }
};

/* =======================
   Stubs (unchanged behavior)
======================= */

const backupWallet = async (req, res) =>
  successResponse(res, 'Wallet backup data retrieved', {
    backupTimestamp: new Date()
  });

const getSecuritySettings = async (req, res) =>
  successResponse(res, 'Security settings retrieved', req.user.securityFlags || {});

const updateSecuritySettings = async (req, res) =>
  successResponse(res, 'Security settings updated successfully');

const getActivityLog = async (req, res) =>
  successResponse(res, 'Activity log retrieved', { activities: [] });

const getNotifications = async (req, res) =>
  successResponse(res, 'Notifications retrieved', { notifications: [] });

const markNotificationAsRead = async (req, res) =>
  successResponse(res, 'Notification marked as read');

const deleteNotification = async (req, res) =>
  successResponse(res, 'Notification deleted');

const getSettings = async (req, res) =>
  successResponse(res, 'Settings retrieved', {});

const updateSettings = async (req, res) =>
  successResponse(res, 'Settings updated successfully');

/* =======================
   Exports
======================= */

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
