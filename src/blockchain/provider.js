const { ethers } = require('ethers');
const logger = require('../utils/logger');
const { networks } = require('../config/network');

const providers = {};

const initializeProvider = (network) => {
  try {
    const networkConfig = networks[network];
    
    if (!networkConfig) {
      throw new Error(`Network ${network} not configured`);
    }

    if (providers[network]) {
      return providers[network];
    }

    const provider = new ethers.JsonRpcProvider(
      networkConfig.rpcUrl,
      {
        chainId: networkConfig.chainId,
        name: networkConfig.name
      }
    );

    providers[network] = provider;
    logger.info(`Provider initialized for network: ${network}`);

    return provider;
  } catch (error) {
    logger.error(`Provider initialization error for ${network}:`, error.message);
    throw new Error(`Failed to initialize provider for ${network}: ${error.message}`);
  }
};

const getProvider = (network = 'polygon') => {
  if (providers[network]) {
    return providers[network];
  }
  return initializeProvider(network);
};

const getAllProviders = () => {
  const availableNetworks = Object.keys(networks);
  availableNetworks.forEach(network => {
    if (!providers[network]) {
      initializeProvider(network);
    }
  });
  return providers;
};

const checkProviderConnection = async (network = 'polygon') => {
  try {
    const provider = getProvider(network);
    const blockNumber = await provider.getBlockNumber();
    
    return {
      connected: true,
      network: network,
      blockNumber: blockNumber,
      timestamp: new Date()
    };
  } catch (error) {
    logger.error(`Provider connection check failed for ${network}:`, error.message);
    return {
      connected: false,
      network: network,
      error: error.message,
      timestamp: new Date()
    };
  }
};

const getNetworkInfo = async (network = 'polygon') => {
  try {
    const provider = getProvider(network);
    const networkData = await provider.getNetwork();
    const blockNumber = await provider.getBlockNumber();
    const feeData = await provider.getFeeData();
    
    return {
      name: networkData.name,
      chainId: networkData.chainId,
      blockNumber: blockNumber,
      gasPrice: feeData.gasPrice ? feeData.gasPrice.toString() : null,
      maxFeePerGas: feeData.maxFeePerGas ? feeData.maxFeePerGas.toString() : null,
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas ? feeData.maxPriorityFeePerGas.toString() : null
    };
  } catch (error) {
    logger.error(`Get network info error for ${network}:`, error.message);
    throw new Error(`Failed to get network info for ${network}: ${error.message}`);
  }
};

const switchNetwork = (network) => {
  try {
    const provider = getProvider(network);
    return {
      network: network,
      provider: provider,
      switched: true
    };
  } catch (error) {
    logger.error(`Switch network error to ${network}:`, error.message);
    throw new Error(`Failed to switch to network ${network}: ${error.message}`);
  }
};

const getSigner = (privateKey, network = 'polygon') => {
  try {
    const provider = getProvider(network);
    const wallet = new ethers.Wallet(privateKey, provider);
    
    return wallet;
  } catch (error) {
    logger.error(`Get signer error for ${network}:`, error.message);
    throw new Error(`Failed to get signer for ${network}: ${error.message}`);
  }
};

module.exports = {
  initializeProvider,
  getProvider,
  getAllProviders,
  checkProviderConnection,
  getNetworkInfo,
  switchNetwork,
  getSigner
};