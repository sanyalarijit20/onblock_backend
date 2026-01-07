const mongoose = require('mongoose');

const walletSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      // indexed via compound indexes below
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
      // indexed via compound indexes below
    },

    chainId: {
      type: Number,
      required: [true, 'Chain ID is required'],
    },

    address: {
      type: String,
      required: [true, 'Wallet address is required'],
      unique: true, // ✅ single canonical unique index
      lowercase: true,
      match: [/^0x[a-fA-F0-9]{40}$/, 'Please provide a valid Ethereum address'],
    },

    smartAccountConfig: {
      ownerAddress: {
        type: String,
        lowercase: true,
        match: [/^0x[a-fA-F0-9]{40}$/],
      },
      factoryAddress: {
        type: String,
        lowercase: true,
        match: [/^0x[a-fA-F0-9]{40}$/],
      },
      entryPointAddress: {
        type: String,
        lowercase: true,
        match: [/^0x[a-fA-F0-9]{40}$/],
      },
      implementationAddress: {
        type: String,
        lowercase: true,
        match: [/^0x[a-fA-F0-9]{40}$/],
      },
      deploymentTxHash: String,
      isDeployed: { type: Boolean, default: false },
      deployedAt: Date,
    },

    isActive: { type: Boolean, default: true },
    isPrimary: { type: Boolean, default: false },

    balances: {
      native: {
        amount: { type: String, default: '0' },
        lastUpdated: { type: Date, default: Date.now },
      },
      tokens: [
        {
          tokenAddress: {
            type: String,
            lowercase: true,
            match: [/^0x[a-fA-F0-9]{40}$/],
          },
          tokenSymbol: String,
          tokenName: String,
          decimals: { type: Number, default: 18 },
          balance: { type: String, default: '0' },
          lastUpdated: { type: Date, default: Date.now },
        },
      ],
    },

    statistics: {
      totalTransactions: { type: Number, default: 0 },
      totalSent: { type: String, default: '0' },
      totalReceived: { type: String, default: '0' },
      lastTransactionDate: Date,
    },

    security: {
      dailyLimit: {
        amount: { type: String, default: '0' },
        spentToday: { type: String, default: '0' },
        lastResetDate: { type: Date, default: Date.now },
      },
      whitelistedAddresses: [
        {
          address: { type: String, lowercase: true },
          label: String,
          addedAt: { type: Date, default: Date.now },
        },
      ],
      biometricThreshold: { type: String, default: '1000' },
      multisig: {
        enabled: { type: Boolean, default: false },
        threshold: { type: Number, min: 1 },
        signers: [{ address: String, name: String }],
      },
    },

    metadata: {
      label: { type: String, trim: true, maxlength: 50 },
      icon: String,
      color: String,
      description: String,
    },

    recovery: {
      guardians: [
        {
          address: String,
          email: String,
          phoneNumber: String,
          addedAt: Date,
        },
      ],
      recoveryThreshold: { type: Number, min: 1 },
    },

    gasSponsorship: {
      enabled: { type: Boolean, default: true },
      paymasterAddress: String,
      sponsorshipType: {
        type: String,
        enum: ['full', 'partial', 'none'],
        default: 'full',
      },
    },

    lastSyncedAt: { type: Date, default: Date.now },
    nonce: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

/* ========= INDEXES (NON-DUPLICATE, PURPOSEFUL) ========= */

// User wallets per network
walletSchema.index({ userId: 1, network: 1 });

// Primary wallet constraint (one per user per network)
walletSchema.index(
  { userId: 1, network: 1, isPrimary: 1 },
  { unique: true, partialFilterExpression: { isPrimary: true } }
);

// Fast lookups
walletSchema.index({ network: 1, isActive: 1 });
walletSchema.index({ 'smartAccountConfig.ownerAddress': 1 });
walletSchema.index({ createdAt: -1 });

/* ========= VIRTUALS, HOOKS, METHODS UNCHANGED ========= */

// Expose a convenient property for smart account address
walletSchema.virtual('smartAccountAddress').get(function () {
  return (this.smartAccountConfig && this.smartAccountConfig.ownerAddress) || this.address;
});

const Wallet = mongoose.model('Wallet', walletSchema);
module.exports = Wallet;
