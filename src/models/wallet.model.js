

const mongoose = require('mongoose');


const walletSchema = new mongoose.Schema(
  {
    
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },

    
    walletType: {
      type: String,
      enum: ['smart_account', 'eoa'],
      default: 'smart_account',
      required: true,
    },

    
    network: {
      type: String,
      enum: ['mainnet', 'sepolia', 'goerli', 'polygon', 'mumbai', 'amoy', 'base', 'baseSepolia'],
      required: [true, 'Network is required'],
      index: true,
    },

    chainId: {
      type: Number,
      required: [true, 'Chain ID is required'],
    },

    
    address: {
      type: String,
      required: [true, 'Wallet address is required'],
      unique: true,
      lowercase: true,
      match: [/^0x[a-fA-F0-9]{40}$/, 'Please provide a valid Ethereum address'],
      index: true,
    },

    
    smartAccountConfig: {
      
      ownerAddress: {
        type: String,
        lowercase: true,
        match: [/^0x[a-fA-F0-9]{40}$/, 'Please provide a valid Ethereum address'],
      },

      
      factoryAddress: {
        type: String,
        lowercase: true,
        match: [/^0x[a-fA-F0-9]{40}$/, 'Please provide a valid Ethereum address'],
      },

      
      entryPointAddress: {
        type: String,
        lowercase: true,
        match: [/^0x[a-fA-F0-9]{40}$/, 'Please provide a valid Ethereum address'],
      },

      
      implementationAddress: {
        type: String,
        lowercase: true,
        match: [/^0x[a-fA-F0-9]{40}$/, 'Please provide a valid Ethereum address'],
      },

      
      deploymentTxHash: {
        type: String,
        lowercase: true,
      },

      
      isDeployed: {
        type: Boolean,
        default: false,
      },

      // Deployment date
      deployedAt: {
        type: Date,
      },
    },

    // Wallet Status
    isActive: {
      type: Boolean,
      default: true,
    },

    isPrimary: {
      type: Boolean,
      default: false, // One primary wallet per user per network
    },

    // Balance Tracking (cached from blockchain)
    balances: {
      native: {
        // Native currency balance (ETH, MATIC, etc.)
        amount: {
          type: String, // Store as string to avoid precision issues
          default: '0',
        },
        lastUpdated: {
          type: Date,
          default: Date.now,
        },
      },
      tokens: [
        {
          // ERC-20 token balances
          tokenAddress: {
            type: String,
            lowercase: true,
            match: [/^0x[a-fA-F0-9]{40}$/],
          },
          tokenSymbol: String,
          tokenName: String,
          decimals: {
            type: Number,
            default: 18,
          },
          balance: {
            type: String,
            default: '0',
          },
          lastUpdated: {
            type: Date,
            default: Date.now,
          },
        },
      ],
    },

    // Transaction Statistics
    statistics: {
      totalTransactions: {
        type: Number,
        default: 0,
      },
      totalSent: {
        type: String,
        default: '0',
      },
      totalReceived: {
        type: String,
        default: '0',
      },
      lastTransactionDate: {
        type: Date,
      },
    },

    // Security Features
    security: {
      // Daily spending limit (in native currency)
      dailyLimit: {
        amount: {
          type: String,
          default: '0', // 0 means no limit
        },
        spentToday: {
          type: String,
          default: '0',
        },
        lastResetDate: {
          type: Date,
          default: Date.now,
        },
      },

      // Whitelist of approved addresses
      whitelistedAddresses: [
        {
          address: {
            type: String,
            lowercase: true,
            match: [/^0x[a-fA-F0-9]{40}$/],
          },
          label: String,
          addedAt: {
            type: Date,
            default: Date.now,
          },
        },
      ],

      // Require biometric for transactions above this amount
      biometricThreshold: {
        type: String,
        default: '1000', // In native currency (e.g., 1000 INR worth)
      },

      // Multi-signature configuration (if enabled)
      multisig: {
        enabled: {
          type: Boolean,
          default: false,
        },
        threshold: {
          type: Number,
          min: 1,
        },
        signers: [
          {
            address: String,
            name: String,
          },
        ],
      },
    },

    // Wallet Metadata
    metadata: {
      label: {
        type: String,
        trim: true,
        maxlength: 50,
      },
      icon: String,
      color: String,
      description: String,
    },

    // Recovery Configuration
    recovery: {
      // Social recovery guardians
      guardians: [
        {
          address: String,
          email: String,
          phoneNumber: String,
          addedAt: Date,
        },
      ],
      recoveryThreshold: {
        type: Number,
        min: 1,
      },
    },

    // Gas Sponsorship Settings (for gasless transactions)
    gasSponsorship: {
      enabled: {
        type: Boolean,
        default: true,
      },
      paymasterAddress: {
        type: String,
        lowercase: true,
      },
      sponsorshipType: {
        type: String,
        enum: ['full', 'partial', 'none'],
        default: 'full',
      },
    },

    // Last Sync with Blockchain
    lastSyncedAt: {
      type: Date,
      default: Date.now,
    },

    // Nonce tracking for transaction ordering
    nonce: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ========================
// Virtual Fields
// ========================

/**
 * Get formatted native balance
 */
walletSchema.virtual('formattedBalance').get(function () {
  const balance = parseFloat(this.balances.native.amount);
  return balance.toFixed(4);
});

/**
 * Check if daily limit is reached
 */
walletSchema.virtual('isDailyLimitReached').get(function () {
  if (this.security.dailyLimit.amount === '0') {
    return false; // No limit set
  }
  
  const limit = parseFloat(this.security.dailyLimit.amount);
  const spent = parseFloat(this.security.dailyLimit.spentToday);
  
  return spent >= limit;
});



walletSchema.index({ userId: 1, network: 1 });
walletSchema.index({ userId: 1, isPrimary: 1 });
walletSchema.index({ address: 1 });
walletSchema.index({ network: 1, isActive: 1 });
walletSchema.index({ 'smartAccountConfig.ownerAddress': 1 });
walletSchema.index({ createdAt: -1 });

// Compound index for primary wallet per user per network
walletSchema.index({ userId: 1, network: 1, isPrimary: 1 }, { unique: true, partialFilterExpression: { isPrimary: true } });


walletSchema.pre('save', function (next) {
  const now = new Date();
  const lastReset = new Date(this.security.dailyLimit.lastResetDate);
  
  // Check if it's a new day
  if (now.toDateString() !== lastReset.toDateString()) {
    this.security.dailyLimit.spentToday = '0';
    this.security.dailyLimit.lastResetDate = now;
  }
  
  next();
});


walletSchema.methods.updateNativeBalance = async function (newBalance) {
  this.balances.native.amount = newBalance;
  this.balances.native.lastUpdated = Date.now();
  await this.save();
};


walletSchema.methods.updateTokenBalance = async function (tokenAddress, balance, tokenInfo = {}) {
  const existingToken = this.balances.tokens.find(
    t => t.tokenAddress.toLowerCase() === tokenAddress.toLowerCase()
  );

  if (existingToken) {
    existingToken.balance = balance;
    existingToken.lastUpdated = Date.now();
  } else {
    this.balances.tokens.push({
      tokenAddress: tokenAddress.toLowerCase(),
      tokenSymbol: tokenInfo.symbol || 'UNKNOWN',
      tokenName: tokenInfo.name || 'Unknown Token',
      decimals: tokenInfo.decimals || 18,
      balance,
      lastUpdated: Date.now(),
    });
  }

  await this.save();
};


walletSchema.methods.addSpending = async function (amount) {
  const currentSpent = parseFloat(this.security.dailyLimit.spentToday);
  const newSpent = currentSpent + parseFloat(amount);
  const limit = parseFloat(this.security.dailyLimit.amount);

  // Check if limit is set and would be exceeded
  if (limit > 0 && newSpent > limit) {
    return false;
  }

  this.security.dailyLimit.spentToday = newSpent.toString();
  await this.save();
  return true;
};


walletSchema.methods.addToWhitelist = async function (address, label) {
  const exists = this.security.whitelistedAddresses.some(
    w => w.address.toLowerCase() === address.toLowerCase()
  );

  if (!exists) {
    this.security.whitelistedAddresses.push({
      address: address.toLowerCase(),
      label,
      addedAt: Date.now(),
    });
    await this.save();
  }
};


walletSchema.methods.isWhitelisted = function (address) {
  return this.security.whitelistedAddresses.some(
    w => w.address.toLowerCase() === address.toLowerCase()
  );
};


walletSchema.methods.recordTransaction = async function (type, amount) {
  this.statistics.totalTransactions += 1;
  this.statistics.lastTransactionDate = Date.now();

  if (type === 'sent') {
    const currentTotal = parseFloat(this.statistics.totalSent);
    this.statistics.totalSent = (currentTotal + parseFloat(amount)).toString();
  } else if (type === 'received') {
    const currentTotal = parseFloat(this.statistics.totalReceived);
    this.statistics.totalReceived = (currentTotal + parseFloat(amount)).toString();
  }

  await this.save();
};


walletSchema.methods.markAsDeployed = async function (txHash) {
  this.smartAccountConfig.isDeployed = true;
  this.smartAccountConfig.deploymentTxHash = txHash;
  this.smartAccountConfig.deployedAt = Date.now();
  await this.save();
};


walletSchema.statics.findByAddress = function (address) {
  return this.findOne({ address: address.toLowerCase(), isActive: true });
};


walletSchema.statics.findUserWalletsByNetwork = function (userId, network) {
  return this.find({ userId, network, isActive: true });
};


walletSchema.statics.findPrimaryWallet = function (userId, network) {
  return this.findOne({ userId, network, isPrimary: true, isActive: true });
};


walletSchema.statics.getTotalBalance = async function (userId) {
  const wallets = await this.find({ userId, isActive: true });
  
  const balances = {};
  wallets.forEach(wallet => {
    if (!balances[wallet.network]) {
      balances[wallet.network] = 0;
    }
    balances[wallet.network] += parseFloat(wallet.balances.native.amount);
  });

  return balances;
};
const Wallet = mongoose.model('Wallet', walletSchema);

module.exports = Wallet;