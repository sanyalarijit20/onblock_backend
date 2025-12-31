const { ethers } = require('ethers');
const logger = require('../utils/logger');
const { getProvider } = require('../blockchain/provider');

const getBalance = async (address, network = 'polygon') => {
  try {
    const provider = getProvider(network);
    const balance = await provider.getBalance(address);
    
    return {
      balance: balance.toString(),
      balanceInEth: ethers.formatEther(balance),
      address: address,
      network: network
    };
  } catch (error) {
    logger.error('Get Balance Error:', error.message);
    throw new Error(`Failed to get balance: ${error.message}`);
  }
};

const getTokenBalance = async (walletAddress, tokenAddress, network = 'polygon') => {
  try {
    const provider = getProvider(network);
    
    const erc20ABI = [
      'function balanceOf(address owner) view returns (uint256)',
      'function decimals() view returns (uint8)',
      'function symbol() view returns (string)'
    ];
    
    const tokenContract = new ethers.Contract(tokenAddress, erc20ABI, provider);
    
    const [balance, decimals, symbol] = await Promise.all([
      tokenContract.balanceOf(walletAddress),
      tokenContract.decimals(),
      tokenContract.symbol()
    ]);
    
    return {
      balance: balance.toString(),
      balanceFormatted: ethers.formatUnits(balance, decimals),
      decimals: decimals,
      symbol: symbol,
      tokenAddress: tokenAddress,
      walletAddress: walletAddress,
      network: network
    };
  } catch (error) {
    logger.error('Get Token Balance Error:', error.message);
    throw new Error(`Failed to get token balance: ${error.message}`);
  }
};

const getTransactionReceipt = async (txHash, network = 'polygon') => {
  try {
    const provider = getProvider(network);
    const receipt = await provider.getTransactionReceipt(txHash);
    
    if (!receipt) {
      return null;
    }
    
    return {
      transactionHash: receipt.hash,
      blockNumber: receipt.blockNumber,
      blockHash: receipt.blockHash,
      from: receipt.from,
      to: receipt.to,
      gasUsed: receipt.gasUsed.toString(),
      status: receipt.status,
      contractAddress: receipt.contractAddress,
      logs: receipt.logs,
      timestamp: receipt.timestamp || null
    };
  } catch (error) {
    logger.error('Get Transaction Receipt Error:', error.message);
    throw new Error(`Failed to get transaction receipt: ${error.message}`);
  }
};

const getTransaction = async (txHash, network = 'polygon') => {
  try {
    const provider = getProvider(network);
    const tx = await provider.getTransaction(txHash);
    
    if (!tx) {
      return null;
    }
    
    return {
      hash: tx.hash,
      from: tx.from,
      to: tx.to,
      value: tx.value.toString(),
      valueInEth: ethers.formatEther(tx.value),
      gasLimit: tx.gasLimit.toString(),
      gasPrice: tx.gasPrice ? tx.gasPrice.toString() : null,
      maxFeePerGas: tx.maxFeePerGas ? tx.maxFeePerGas.toString() : null,
      maxPriorityFeePerGas: tx.maxPriorityFeePerGas ? tx.maxPriorityFeePerGas.toString() : null,
      nonce: tx.nonce,
      data: tx.data,
      chainId: tx.chainId,
      blockNumber: tx.blockNumber,
      blockHash: tx.blockHash
    };
  } catch (error) {
    logger.error('Get Transaction Error:', error.message);
    throw new Error(`Failed to get transaction: ${error.message}`);
  }
};

const estimateGas = async (txParams, network = 'polygon') => {
  try {
    const provider = getProvider(network);
    
    const gasEstimate = await provider.estimateGas({
      from: txParams.from,
      to: txParams.to,
      value: txParams.value || '0',
      data: txParams.data || '0x'
    });
    
    const feeData = await provider.getFeeData();
    
    return {
      gasLimit: gasEstimate.toString(),
      gasPrice: feeData.gasPrice ? feeData.gasPrice.toString() : null,
      maxFeePerGas: feeData.maxFeePerGas ? feeData.maxFeePerGas.toString() : null,
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas ? feeData.maxPriorityFeePerGas.toString() : null,
      estimatedCost: feeData.gasPrice ? (gasEstimate * feeData.gasPrice).toString() : null,
      network: network
    };
  } catch (error) {
    logger.error('Estimate Gas Error:', error.message);
    throw new Error(`Failed to estimate gas: ${error.message}`);
  }
};

const getCurrentGasPrice = async (network = 'polygon') => {
  try {
    const provider = getProvider(network);
    const feeData = await provider.getFeeData();
    
    return {
      gasPrice: feeData.gasPrice ? feeData.gasPrice.toString() : null,
      maxFeePerGas: feeData.maxFeePerGas ? feeData.maxFeePerGas.toString() : null,
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas ? feeData.maxPriorityFeePerGas.toString() : null,
      network: network,
      timestamp: new Date()
    };
  } catch (error) {
    logger.error('Get Gas Price Error:', error.message);
    throw new Error(`Failed to get gas price: ${error.message}`);
  }
};

const getBlockNumber = async (network = 'polygon') => {
  try {
    const provider = getProvider(network);
    const blockNumber = await provider.getBlockNumber();
    
    return {
      blockNumber: blockNumber,
      network: network,
      timestamp: new Date()
    };
  } catch (error) {
    logger.error('Get Block Number Error:', error.message);
    throw new Error(`Failed to get block number: ${error.message}`);
  }
};

const getBlock = async (blockNumberOrHash, network = 'polygon') => {
  try {
    const provider = getProvider(network);
    const block = await provider.getBlock(blockNumberOrHash);
    
    if (!block) {
      return null;
    }
    
    return {
      number: block.number,
      hash: block.hash,
      parentHash: block.parentHash,
      timestamp: block.timestamp,
      nonce: block.nonce,
      difficulty: block.difficulty,
      gasLimit: block.gasLimit.toString(),
      gasUsed: block.gasUsed.toString(),
      miner: block.miner,
      transactions: block.transactions,
      network: network
    };
  } catch (error) {
    logger.error('Get Block Error:', error.message);
    throw new Error(`Failed to get block: ${error.message}`);
  }
};

const waitForTransaction = async (txHash, network = 'polygon', confirmations = 1) => {
  try {
    const provider = getProvider(network);
    const receipt = await provider.waitForTransaction(txHash, confirmations);
    
    return {
      transactionHash: receipt.hash,
      blockNumber: receipt.blockNumber,
      status: receipt.status,
      gasUsed: receipt.gasUsed.toString(),
      confirmations: confirmations,
      network: network
    };
  } catch (error) {
    logger.error('Wait For Transaction Error:', error.message);
    throw new Error(`Failed to wait for transaction: ${error.message}`);
  }
};

const isContractAddress = async (address, network = 'polygon') => {
  try {
    const provider = getProvider(network);
    const code = await provider.getCode(address);
    
    return {
      isContract: code !== '0x',
      address: address,
      network: network
    };
  } catch (error) {
    logger.error('Is Contract Address Error:', error.message);
    throw new Error(`Failed to check if address is contract: ${error.message}`);
  }
};

const validateAddress = (address) => {
  try {
    return {
      isValid: ethers.isAddress(address),
      checksumAddress: ethers.isAddress(address) ? ethers.getAddress(address) : null
    };
  } catch (error) {
    return {
      isValid: false,
      checksumAddress: null
    };
  }
};

module.exports = {
  getBalance,
  getTokenBalance,
  getTransactionReceipt,
  getTransaction,
  estimateGas,
  getCurrentGasPrice,
  getBlockNumber,
  getBlock,
  waitForTransaction,
  isContractAddress,
  validateAddress
};