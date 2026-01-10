const mongoose = require('mongoose');

const walletSchema = new mongoose.Schema(
 {
   userId: {
     type: mongoose.Schema.Types.ObjectId,
     ref: 'User',
     required: [true, 'User ID is required'],
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
         tokenAddress: { type: String, lowercase: true },
         tokenSymbol: String,
         balance: { type: String, default: '0' },
         decimals: { type: Number, default: 18 },
       },
     ],
   },

   statistics: {
     totalTransactions: { type: Number, default: 0 },
     lastTransactionDate: Date,
   },
 },
 {
   timestamps: true,
   toJSON: { virtuals: true },
   toObject: { virtuals: true },
 }
);

/* ========= STATIC METHODS (CRITICAL FIX) ========= */

/**
 * Finds the primary wallet for a user on a specific network.
 * This is called by requireWallet middleware.
 */
walletSchema.statics.findPrimaryWallet = function (userId, network) {
  return this.findOne({
    userId,
    network,
    isPrimary: true,
    isActive: true,
  });
};

/* ========= INDEXES ========= */
walletSchema.index({ userId: 1, network: 1 });
walletSchema.index(
 { userId: 1, network: 1, isPrimary: 1 },
 { unique: true, partialFilterExpression: { isPrimary: true } }
);

/* ========= VIRTUALS ========= */

// Used by the Flutter app to display the active blockchain address
walletSchema.virtual('smartAccountAddress').get(function () {
  return (this.smartAccountConfig && this.smartAccountConfig.ownerAddress) || this.address;
});

const Wallet = mongoose.model('Wallet', walletSchema);
module.exports = Wallet;