const { ethers } = require('ethers');
const Transaction = require('../models/transaction.model');
const Wallet = require('../models/wallet.model');
const logger = require('../utils/logger');

/**
 * Service to handle the initial USDC airdrop to new users.
 * This function handles the blockchain transfer AND database logging.
 */
const airdropInitialFunds = async (userId, smartAccountAddress, network) => {
  try {
    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    const treasurySigner = new ethers.Wallet(process.env.BACKEND_WALLET_PRIVATE_KEY, provider);

    const usdcAbi = [
      "function transfer(address to, uint256 amount) public returns (bool)",
      "function balanceOf(address owner) view returns (uint256)",
      "function decimals() view returns (uint8)"
    ];
    
    const usdcContract = new ethers.Contract(
      process.env.USDC_CONTRACT_ADDRESS, 
      usdcAbi, 
      treasurySigner
    );

    // 1. Prepare Amount (0.1 USDC with 6 decimals)
    const amountStr = process.env.AIRDROP_AMOUNT || "0.1";
    const amount = ethers.parseUnits(amountStr, 6);

    // 2. Check Treasury Balance
    const balance = await usdcContract.balanceOf(treasurySigner.address);
    if (balance.lt(amount)) {
      throw new Error("Treasury insufficient balance for airdrop");
    }

    logger.info(`Airdropping ${amountStr} USDC bonus to ${smartAccountAddress}`);

    // 3. Execute On-Chain Transfer
    const tx = await usdcContract.transfer(smartAccountAddress, amount);
    
    // 4. Record in Database (So it shows in transaction history)
    // We get the walletId to link the transaction properly
    const wallet = await Wallet.findOne({ smartAccountAddress });

    const dbTransaction = await Transaction.create({
      userId,
      walletId: wallet ? wallet._id : null,
      type: 'receive',
      amount: amountStr,
      token: {
        symbol: 'USDC',
        address: process.env.USDC_CONTRACT_ADDRESS,
        decimals: 6
      },
      from: treasurySigner.address.toLowerCase(),
      to: smartAccountAddress.toLowerCase(),
      network: network || 'sepolia',
      chainId: 11155111,
      status: 'submitted',
      userOpHash: null,
      txHash: tx.hash,
      metadata: {
        description: 'Sign-up Bonus',
        category: 'Rewards'
      }
    });

    // 5. Wait for blockchain confirmation asynchronously
    tx.wait().then(async (receipt) => {
      await dbTransaction.markConfirmed(receipt.blockNumber);
      logger.info(`Airdrop confirmed for ${smartAccountAddress}`);
    });

    return { 
      success: true, 
      txHash: tx.hash, 
      transactionId: dbTransaction._id 
    };
  } catch (error) {
    logger.error("Faucet Airdrop Failed:", error);
    return { success: false, error: error.message };
  }
};

module.exports = { airdropInitialFunds };