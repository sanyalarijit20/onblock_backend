const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },

    walletId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Wallet',
      required: true
    },

    type: {
      type: String,
      enum: ['send', 'receive', 'swap', 'deposit', 'withdrawal'],
      required: true
    },

    amount: {
      type: String,
      required: true
    },

    token: {
      symbol: { type: String, required: true, default: 'ETH' },
      address: { type: String, default: null },
      decimals: { type: Number, default: 18 }
    },

    from: { type: String, required: true, lowercase: true },
    to: { type: String, required: true, lowercase: true },

    txHash: {
      type: String,
      sparse: true,
      lowercase: true
    },

    userOpHash: {
      type: String,
      sparse: true,
      lowercase: true
    },

    blockNumber: { type: Number, default: null },

    network: { type: String, required: true, default: 'polygon' },
    chainId: { type: Number, required: true },

    status: {
      type: String,
      enum: ['pending', 'submitted', 'confirmed', 'failed', 'rejected'],
      default: 'pending'
    },

    gas: {
      gasLimit: String,
      gasPrice: String,
      maxFeePerGas: String,
      maxPriorityFeePerGas: String,
      actualGasUsed: String,
      sponsoredBy: { type: String, default: 'biconomy' }
    },

    deviceInfo: {
      deviceId: { type: String, default: null },
      deviceType: {
        type: String,
        enum: ['mobile', 'tablet', 'desktop', 'unknown'],
        default: 'unknown'
      },
      osName: String,
      osVersion: String,
      browserName: String,
      browserVersion: String,
      deviceFingerprint: String,
      ipAddress: String,
      location: {
        country: String,
        state: String,
        city: String,
        coordinates: {
          latitude: Number,
          longitude: Number
        }
      },
      isNewDevice: { type: Boolean, default: false },
      deviceChanged: { type: Boolean, default: false },
      lastKnownDeviceId: { type: String, default: null },
      deviceTrustScore: { type: Number, min: 0, max: 1, default: 1 }
    },

    fraudAnalysis: {
      riskScore: { type: Number, min: 0, max: 1, default: null },
      isBlocked: { type: Boolean, default: false },
      mlModelVersion: { type: String, default: null },
      detectedPatterns: [{ type: String }],
      signals: {
        amountAnomaly: {},
        transactionFrequency: {},
        timeGap: {},
        deviceChange: {},
        nightTimeTransaction: {},
        newReceiverAddress: {}
      },
      riskFactors: {},
      analyzedAt: Date
    },

    biometricVerified: { type: Boolean, default: false },
    facialVerified: { type: Boolean, default: false },

    metadata: {
      description: String,
      category: String,
      notes: String,
      transactionHour: Number,
      transactionDay: String,
      isRecurring: Boolean
    },

    errorMessage: String,
    errorCode: String,

    initiatedAt: { type: Date, default: Date.now },
    submittedAt: Date,
    confirmedAt: Date
  },
  {
    timestamps: true,
    collection: 'transactions'
  }
);

/* ========= INDEXES (CANONICAL, NON-DUPLICATE) ========= */

// Core access paths
transactionSchema.index({ userId: 1, createdAt: -1 });
transactionSchema.index({ walletId: 1, status: 1 });
transactionSchema.index({ status: 1 });

// Hash lookups (sparse, optional)
transactionSchema.index({ txHash: 1 }, { sparse: true });
transactionSchema.index({ userOpHash: 1 }, { sparse: true });

// Risk & device analysis
transactionSchema.index({ 'fraudAnalysis.riskScore': 1, status: 1 });
transactionSchema.index({ 'deviceInfo.deviceId': 1 });
transactionSchema.index({ 'deviceInfo.ipAddress': 1 });

// Receiver reuse detection
transactionSchema.index({ to: 1, userId: 1 });

/* ========= METHODS & STATICS UNCHANGED ========= */

module.exports = mongoose.model('Transaction', transactionSchema);
