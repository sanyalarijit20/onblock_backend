const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  
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
    symbol: {
      type: String,
      required: true,
      default: 'ETH'
    },
    address: {
      type: String, 
      default: null
    },
    decimals: {
      type: Number,
      default: 18
    }
  },

  from: {
    type: String,
    required: true,
    lowercase: true
  },

  to: {
    type: String,
    required: true,
    lowercase: true
  },

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

  blockNumber: {
    type: Number,
    default: null
  },

  network: {
    type: String,
    required: true,
    default: 'polygon' 
  },

  chainId: {
    type: Number,
    required: true
  },

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
    sponsoredBy: {
      type: String,
      default: 'biconomy' 
    }
  },

  deviceInfo: {
    deviceId: {
      type: String,
      default: null
    },
    deviceType: {
      type: String,
      enum: ['mobile', 'tablet', 'desktop', 'unknown'],
      default: 'unknown'
    },
    osName: {
      type: String,
      default: null
    },
    osVersion: {
      type: String,
      default: null
    },
    browserName: {
      type: String,
      default: null
    },
    browserVersion: {
      type: String,
      default: null
    },
    deviceFingerprint: {
      type: String,
      default: null
    },
    ipAddress: {
      type: String,
      default: null
    },
    location: {
      country: String,
      state: String,
      city: String,
      coordinates: {
        latitude: Number,
        longitude: Number
      }
    },
    isNewDevice: {
      type: Boolean,
      default: false
    },
    deviceChanged: {
      type: Boolean,
      default: false
    },
    lastKnownDeviceId: {
      type: String,
      default: null
    },
    deviceTrustScore: {
      type: Number,
      min: 0,
      max: 1,
      default: 1
    }
  },

  fraudAnalysis: {
    riskScore: {
      type: Number,
      min: 0,
      max: 1,
      default: null 
    },
    isBlocked: {
      type: Boolean,
      default: false
    },
    mlModelVersion: {
      type: String,
      default: null
    },
    detectedPatterns: [{
      type: String 
    }],
    
    signals: {
      amountAnomaly: {
        detected: { type: Boolean, default: false },
        amountRatio: { type: Number, default: 0 },
        userAvgAmount: { type: String, default: '0' },
        riskLevel: { 
          type: String, 
          enum: ['low', 'medium', 'high', 'none'],
          default: 'none'
        }
      },
      
      transactionFrequency: {
        detected: { type: Boolean, default: false },
        txCountLast10Min: { type: Number, default: 0 },
        riskLevel: { 
          type: String, 
          enum: ['low', 'medium', 'high', 'none'],
          default: 'none'
        }
      },
      
      timeGap: {
        detected: { type: Boolean, default: false },
        secondsSinceLastTx: { type: Number, default: null },
        riskLevel: { 
          type: String, 
          enum: ['low', 'medium', 'high', 'none'],
          default: 'none'
        }
      },
      
      deviceChange: {
        detected: { type: Boolean, default: false },
        currentDeviceId: { type: String, default: null },
        lastDeviceId: { type: String, default: null },
        riskLevel: { 
          type: String, 
          enum: ['low', 'medium', 'high', 'none'],
          default: 'none'
        }
      },
      
      nightTimeTransaction: {
        detected: { type: Boolean, default: false },
        transactionHour: { type: Number, default: null },
        isNightTime: { type: Boolean, default: false },
        riskLevel: { 
          type: String, 
          enum: ['low', 'medium', 'high', 'none'],
          default: 'none'
        }
      },
      
      newReceiverAddress: {
        detected: { type: Boolean, default: false },
        receiverAddress: { type: String, default: null },
        isNewReceiver: { type: Boolean, default: false },
        riskLevel: { 
          type: String, 
          enum: ['low', 'medium', 'high', 'none'],
          default: 'none'
        }
      }
    },
    
    riskFactors: {
      deviceChange: {
        type: Boolean,
        default: false
      },
      newDevice: {
        type: Boolean,
        default: false
      },
      locationChange: {
        type: Boolean,
        default: false
      },
      unusualAmount: {
        type: Boolean,
        default: false
      },
      unusualTime: {
        type: Boolean,
        default: false
      },
      highFrequency: {
        type: Boolean,
        default: false
      },
      newReceiver: {
        type: Boolean,
        default: false
      },
      rapidTransactions: {
        type: Boolean,
        default: false
      }
    },
    
    analyzedAt: {
      type: Date,
      default: null
    }
  },

  biometricVerified: {
    type: Boolean,
    default: false
  },

  facialVerified: {
    type: Boolean,
    default: false
  },

  metadata: {
    description: String,
    category: String, 
    notes: String,
    transactionHour: Number,
    transactionDay: String,
    isRecurring: Boolean
  },

  errorMessage: {
    type: String,
    default: null
  },

  errorCode: {
    type: String,
    default: null
  },

  initiatedAt: {
    type: Date,
    default: Date.now
  },

  submittedAt: {
    type: Date,
    default: null
  },

  confirmedAt: {
    type: Date,
    default: null
  }

}, {
  timestamps: true, 
  collection: 'transactions'
});

transactionSchema.index({ userId: 1, createdAt: -1 });
transactionSchema.index({ walletId: 1, status: 1 });
transactionSchema.index({ txHash: 1 });
transactionSchema.index({ userOpHash: 1 });
transactionSchema.index({ 'fraudAnalysis.riskScore': 1, status: 1 });
transactionSchema.index({ 'deviceInfo.deviceId': 1 });
transactionSchema.index({ 'deviceInfo.ipAddress': 1 });
transactionSchema.index({ 'deviceInfo.deviceChanged': 1, status: 1 });
transactionSchema.index({ to: 1, userId: 1 });
transactionSchema.index({ userId: 1, initiatedAt: -1 });
transactionSchema.index({ 'fraudAnalysis.signals.amountAnomaly.riskLevel': 1 });
transactionSchema.index({ 'fraudAnalysis.signals.transactionFrequency.riskLevel': 1 });

transactionSchema.methods.markSubmitted = function(txHash, userOpHash) {
  this.status = 'submitted';
  this.txHash = txHash;
  this.userOpHash = userOpHash;
  this.submittedAt = new Date();
  return this.save();
};

transactionSchema.methods.markConfirmed = function(blockNumber, actualGasUsed) {
  this.status = 'confirmed';
  this.blockNumber = blockNumber;
  this.confirmedAt = new Date();
  if (actualGasUsed) {
    this.gas.actualGasUsed = actualGasUsed;
  }
  return this.save();
};

transactionSchema.methods.markFailed = function(errorMessage, errorCode) {
  this.status = 'failed';
  this.errorMessage = errorMessage;
  this.errorCode = errorCode;
  return this.save();
};

transactionSchema.methods.isHighRisk = function() {
  return this.fraudAnalysis.riskScore !== null && 
         this.fraudAnalysis.riskScore > 0.7;
};

transactionSchema.methods.hasDeviceChanged = function() {
  return this.deviceInfo.deviceChanged === true;
};

transactionSchema.methods.isFromNewDevice = function() {
  return this.deviceInfo.isNewDevice === true;
};

transactionSchema.methods.requiresAdditionalVerification = function() {
  return this.isHighRisk() || 
         this.hasDeviceChanged() || 
         this.isFromNewDevice() ||
         this.fraudAnalysis.signals.amountAnomaly.riskLevel === 'high' ||
         this.fraudAnalysis.signals.transactionFrequency.riskLevel === 'high' ||
         this.fraudAnalysis.signals.timeGap.riskLevel === 'high' ||
         parseFloat(this.amount) > 10000;
};

transactionSchema.methods.getHighRiskSignals = function() {
  const highRiskSignals = [];
  
  if (this.fraudAnalysis.signals.amountAnomaly.riskLevel === 'high') {
    highRiskSignals.push('Amount Anomaly');
  }
  if (this.fraudAnalysis.signals.transactionFrequency.riskLevel === 'high') {
    highRiskSignals.push('High Transaction Frequency');
  }
  if (this.fraudAnalysis.signals.timeGap.riskLevel === 'high') {
    highRiskSignals.push('Rapid Transactions');
  }
  if (this.fraudAnalysis.signals.deviceChange.riskLevel === 'medium' || 
      this.fraudAnalysis.signals.deviceChange.riskLevel === 'high') {
    highRiskSignals.push('Device Change');
  }
  if (this.fraudAnalysis.signals.nightTimeTransaction.riskLevel === 'medium' || 
      this.fraudAnalysis.signals.nightTimeTransaction.riskLevel === 'high') {
    highRiskSignals.push('Night-Time Transaction');
  }
  if (this.fraudAnalysis.signals.newReceiverAddress.riskLevel === 'medium' || 
      this.fraudAnalysis.signals.newReceiverAddress.riskLevel === 'high') {
    highRiskSignals.push('New Receiver Address');
  }
  
  return highRiskSignals;
};

transactionSchema.methods.toClientJSON = function() {
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
      signals: this.fraudAnalysis.signals,
      riskFactors: this.fraudAnalysis.riskFactors,
      highRiskSignals: this.getHighRiskSignals()
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

transactionSchema.statics.getUserTransactions = async function(userId, page = 1, limit = 20) {
  const skip = (page - 1) * limit;
  
  const transactions = await this.find({ userId })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('walletId', 'address')
    .lean();

  const total = await this.countDocuments({ userId });

  return {
    transactions,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

transactionSchema.statics.getPendingTransactions = function(userId) {
  return this.find({ 
    userId, 
    status: { $in: ['pending', 'submitted'] }
  }).sort({ createdAt: -1 });
};

transactionSchema.statics.getHighRiskTransactions = function(limit = 50) {
  return this.find({
    'fraudAnalysis.riskScore': { $gt: 0.7 },
    status: { $in: ['pending', 'submitted'] }
  })
  .sort({ 'fraudAnalysis.riskScore': -1 })
  .limit(limit)
  .populate('userId', 'email phoneNumber');
};

transactionSchema.statics.getDeviceChangedTransactions = function(userId, limit = 20) {
  return this.find({
    userId,
    'deviceInfo.deviceChanged': true,
    status: { $in: ['pending', 'submitted'] }
  })
  .sort({ createdAt: -1 })
  .limit(limit);
};

transactionSchema.statics.getLastUserDevice = async function(userId) {
  const lastTransaction = await this.findOne({
    userId,
    status: 'confirmed',
    'deviceInfo.deviceId': { $exists: true, $ne: null }
  })
  .sort({ confirmedAt: -1 })
  .select('deviceInfo')
  .lean();

  return lastTransaction ? lastTransaction.deviceInfo : null;
};

transactionSchema.statics.getUserAverageAmount = async function(userId) {
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
        avgAmount: { $avg: { $toDouble: '$amount' } },
        count: { $sum: 1 }
      }
    }
  ]);

  if (result.length > 0 && result[0].count > 0) {
    return result[0].avgAmount.toString();
  }
  return '0';
};

transactionSchema.statics.getTransactionCountLast10Min = async function(userId) {
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
  
  const count = await this.countDocuments({
    userId,
    initiatedAt: { $gte: tenMinutesAgo }
  });

  return count;
};

transactionSchema.statics.getLastTransactionTime = async function(userId) {
  const lastTx = await this.findOne({
    userId,
    status: { $ne: 'failed' }
  })
  .sort({ initiatedAt: -1 })
  .select('initiatedAt')
  .lean();

  return lastTx ? lastTx.initiatedAt : null;
};

transactionSchema.statics.hasReceiverBeenUsedBefore = async function(userId, receiverAddress) {
  const count = await this.countDocuments({
    userId,
    to: receiverAddress.toLowerCase(),
    status: 'confirmed'
  });

  return count > 0;
};

transactionSchema.statics.isNightTimeTransaction = function(date = new Date()) {
  const hour = date.getHours();
  return hour >= 0 && hour < 5;
};

transactionSchema.pre('save', function(next) {
  if (this.from) this.from = this.from.toLowerCase();
  if (this.to) this.to = this.to.toLowerCase();
  if (this.txHash) this.txHash = this.txHash.toLowerCase();
  if (this.userOpHash) this.userOpHash = this.userOpHash.toLowerCase();
  
  if (this.isNew || this.isModified('initiatedAt')) {
    const date = this.initiatedAt || new Date();
    this.metadata.transactionHour = date.getHours();
    this.metadata.transactionDay = date.toLocaleDateString('en-US', { weekday: 'long' });
  }
  
  next();
});

const Transaction = mongoose.model('Transaction', transactionSchema);

module.exports = Transaction;