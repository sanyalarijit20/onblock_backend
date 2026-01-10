const { ethers } = require('ethers');
const logger = require('../utils/logger');
const { getCurrentNetwork } = require('../config/network');

const providers = new Map();

const createProvider = () => {
  const network = getCurrentNetwork();

  if (!network.rpcUrl || !network.chainId) {
    throw new Error('Invalid network configuration');
  }

  return new ethers.JsonRpcProvider(network.rpcUrl, {
    chainId: network.chainId,
    name: network.name
  });
};

const getProvider = () => {
  const network = getCurrentNetwork();
  const key = `${network.chainId}`;

  if (providers.has(key)) {
    return providers.get(key);
  }

  const provider = createProvider();
  providers.set(key, provider);

  logger.info(`RPC provider initialized`, {
    chainId: network.chainId,
    name: network.name
  });

  return provider;
};

const resetProviders = () => {
  providers.clear();
};

const checkProviderConnection = async () => {
  try {
    const provider = getProvider();
    const blockNumber = await provider.getBlockNumber();

    return {
      connected: true,
      chainId: provider._network.chainId,
      blockNumber,
      timestamp: new Date()
    };
  } catch (error) {
    return {
      connected: false,
      error: error.message,
      timestamp: new Date()
    };
  }
};

const getNetworkInfo = async () => {
  const provider = getProvider();
  const network = await provider.getNetwork();
  const feeData = await provider.getFeeData();
  const blockNumber = await provider.getBlockNumber();

  return {
    name: network.name,
    chainId: Number(network.chainId),
    blockNumber,
    gasPrice: feeData.gasPrice?.toString() || null,
    maxFeePerGas: feeData.maxFeePerGas?.toString() || null,
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas?.toString() || null
  };
};

const getSigner = (privateKey) => {
  if (!privateKey) {
    throw new Error('Private key required for signer');
  }

  const provider = getProvider();
  return new ethers.Wallet(privateKey, provider);
};

module.exports = {
  getProvider,
  getSigner,
  checkProviderConnection,
  getNetworkInfo,
  resetProviders
};
