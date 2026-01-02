const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },

    walletId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Wallet',
      required: true,
      index: true
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

    txHash: { type: String, sparse: true, lowercase: true },
    userOpHash: { type: String, sparse: true, lowercase: true },

    blockNumber: { type: Number, default: null },

    network: { type: String, required: true, default: 'polygon' },
    chainId: { type: Number, required: true },

    status: {
      type: String,
      enum: ['pending', 'submitted', 'confirmed', 'failed', 'rejected'],
      default: 'pending',
      index: true
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
        amountAnomaly: {
          detected: Boolean,
          amountRatio: Number,
          userAvgAmount: String,
          riskLevel: String
        },
        transactionFrequency: {
          detected: Boolean,
          txCountLast10Min: Number,
          riskLevel: String
        },
        timeGap: {
          detected: Boolean,
          secondsSinceLastTx: Number,
          riskLevel: String
        },
        deviceChange: {
          detected: Boolean,
          currentDeviceId: String,
          lastDeviceId: String,
          riskLevel: String
        },
        nightTimeTransaction: {
          detected: Boolean,
          transactionHour: Number,
          isNightTime: Boolean,
          riskLevel: String
        },
        newReceiverAddress: {
          detected: Boolean,
          receiverAddress: String,
          isNewReceiver: Boolean,
          riskLevel: String
        }
      },

      riskFactors: {
        deviceChange: Boolean,
        newDevice: Boolean,
        locationChange: Boolean,
        unusualAmount: Boolean,
        unusualTime: Boolean,
        highFrequency: Boolean,
        newReceiver: Boolean,
        rapidTransactions: Boolean
      },

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

/* INDEXES */
transactionSchema.index({ userId: 1, createdAt: -1 });
transactionSchema.index({ walletId: 1, status: 1 });
transactionSchema.index({ txHash: 1 });
transactionSchema.index({ userOpHash: 1 });
transactionSchema.index({ 'fraudAnalysis.riskScore': 1, status: 1 });
transactionSchema.index({ 'deviceInfo.deviceId': 1 });
transactionSchema.index({ 'deviceInfo.ipAddress': 1 });
transactionSchema.index({ to: 1, userId: 1 });

/* INSTANCE HELPERS — NO DECISIONS */
transactionSchema.methods.markSubmitted = function (txHash, userOpHash) {
  this.status = 'submitted';
  this.txHash = txHash;
  this.userOpHash = userOpHash;
  this.submittedAt = new Date();
  return this.save();
};

transactionSchema.methods.markConfirmed = function (blockNumber, actualGasUsed) {
  this.status = 'confirmed';
  this.blockNumber = blockNumber;
  this.confirmedAt = new Date();
  if (actualGasUsed) this.gas.actualGasUsed = actualGasUsed;
  return this.save();
};

transactionSchema.methods.markFailed = function (errorMessage, errorCode) {
  this.status = 'failed';
  this.errorMessage = errorMessage;
  this.errorCode = errorCode;
  return this.save();
};

transactionSchema.methods.isHighRisk = function () {
  return Boolean(this.fraudAnalysis?.isBlocked);
};

transactionSchema.methods.hasDeviceChanged = function () {
  return Boolean(this.deviceInfo?.deviceChanged);
};

transactionSchema.methods.isFromNewDevice = function () {
  return Boolean(this.deviceInfo?.isNewDevice);
};

transactionSchema.methods.requiresAdditionalVerification = function () {
  return Boolean(this.fraudAnalysis?.isBlocked);
};

transactionSchema.methods.getHighRiskSignals = function () {
  return Object.entries(this.fraudAnalysis?.signals || {})
    .filter(([, v]) => v?.riskLevel === 'high' || v?.riskLevel === 'medium')
    .map(([k]) => k);
};

transactionSchema.methods.toClientJSON = function () {
  return {
    id: this._id,
    type: this.type,
    amount: this.amount,
    token: this.token,
    from: this.from,
    to: this.to,
    txHash: this.txHash,
    status: this.status,
    network: this.network,
    chainId: this.chainId,
    blockNumber: this.blockNumber,
    deviceInfo: {
      deviceType: this.deviceInfo.deviceType,
      isNewDevice: this.deviceInfo.isNewDevice,
      deviceChanged: this.deviceInfo.deviceChanged,
      location: this.deviceInfo.location
    },
    fraudAnalysis: {
      riskScore: this.fraudAnalysis.riskScore,
      isBlocked: this.fraudAnalysis.isBlocked,
      signals: this.fraudAnalysis.signals
    },
    verified: {
      biometric: this.biometricVerified,
      facial: this.facialVerified
    },
    metadata: this.metadata,
    initiatedAt: this.initiatedAt,
    confirmedAt: this.confirmedAt,
    createdAt: this.createdAt
  };
};

/* STATICS — DATA ACCESS ONLY */
transactionSchema.statics.getLastUserDevice = async function (userId) {
  const tx = await this.findOne({
    userId,
    status: 'confirmed',
    'deviceInfo.deviceId': { $exists: true, $ne: null }
  })
    .sort({ confirmedAt: -1 })
    .select('deviceInfo')
    .lean();

  return tx ? tx.deviceInfo : null;
};

transactionSchema.statics.getUserAverageAmount = async function (userId) {
  const result = await this.aggregate([
    {
      $match: {
        userId: mongoose.Types.ObjectId(userId),
        status: 'confirmed',
        type: 'send'
      }
    },
    {
      $group: {
        _id: null,
        avgAmount: { $avg: { $toDouble: '$amount' } }
      }
    }
  ]);

  return result.length ? String(result[0].avgAmount) : '0';
};

transactionSchema.statics.getTransactionCountLast10Min = async function (userId) {
  return this.countDocuments({
    userId,
    initiatedAt: { $gte: new Date(Date.now() - 10 * 60 * 1000) }
  });
};

transactionSchema.statics.getLastTransactionTime = async function (userId) {
  const tx = await this.findOne({ userId })
    .sort({ initiatedAt: -1 })
    .select('initiatedAt')
    .lean();
  return tx ? tx.initiatedAt : null;
};

transactionSchema.statics.hasReceiverBeenUsedBefore = async function (
  userId,
  receiver
) {
  const count = await this.countDocuments({
    userId,
    to: receiver.toLowerCase(),
    status: 'confirmed'
  });
  return count > 0;
};

transactionSchema.statics.isNightTimeTransaction = function (date = new Date()) {
  const hour = date.getHours();
  return hour >= 0 && hour < 5;
};

transactionSchema.pre('save', function (next) {
  if (this.from) this.from = this.from.toLowerCase();
  if (this.to) this.to = this.to.toLowerCase();
  if (this.txHash) this.txHash = this.txHash.toLowerCase();
  if (this.userOpHash) this.userOpHash = this.userOpHash.toLowerCase();

  if (this.isNew || this.isModified('initiatedAt')) {
    const d = this.initiatedAt || new Date();
    this.metadata.transactionHour = d.getHours();
    this.metadata.transactionDay = d.toLocaleDateString('en-US', {
      weekday: 'long'
    });
  }

  next();
});

module.exports = mongoose.model('Transaction', transactionSchema);
