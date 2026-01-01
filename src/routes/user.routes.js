const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const { authenticate, requireWallet } = require('../middlewares/auth.middleware');
const { generalLimiter } = require('../middlewares/rate_limiter');

router.use(authenticate);
router.use(generalLimiter);

router.get('/profile', userController.getProfile);

router.put('/profile', userController.updateProfile);

router.get('/wallet', requireWallet, userController.getWallet);

router.post('/wallet/create', userController.createWallet);

router.get('/wallet/balance', requireWallet, userController.getBalance);

router.get('/wallet/tokens', requireWallet, userController.getTokenBalances);

router.post('/wallet/backup', requireWallet, userController.backupWallet);

router.get('/security', userController.getSecuritySettings);

router.put('/security', userController.updateSecuritySettings);

router.get('/activity', userController.getActivityLog);

router.get('/notifications', userController.getNotifications);

router.put('/notifications/:id/read', userController.markNotificationAsRead);

router.delete('/notifications/:id', userController.deleteNotification);

router.get('/settings', userController.getSettings);

router.put('/settings', userController.updateSettings);

module.exports = router;