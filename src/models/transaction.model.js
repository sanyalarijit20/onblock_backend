
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
    notes: String
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
    fraudAnalysis: {
      riskScore: this.fraudAnalysis.riskScore,
      isBlocked: this.fraudAnalysis.isBlocked
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

transactionSchema.pre('save', function(next) {
  
  if (this.from) this.from = this.from.toLowerCase();
  if (this.to) this.to = this.to.toLowerCase();
  if (this.txHash) this.txHash = this.txHash.toLowerCase();
  if (this.userOpHash) this.userOpHash = this.userOpHash.toLowerCase();
  
  next();
});



const Transaction = mongoose.model('Transaction', transactionSchema);

module.exports = Transaction;