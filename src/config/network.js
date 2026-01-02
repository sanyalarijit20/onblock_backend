const { BLOCKCHAIN_NETWORK, CHAIN_ID, RPC_URL } = require('./env');

const NETWORKS = {
  
  mainnet: {
    name: 'Ethereum Mainnet',
    chainId: 1,
    rpcUrl: 'https://eth-mainnet.g.alchemy.com/v2/your-api-key',
    explorerUrl: 'https://etherscan.io',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
    isTestnet: false,
  },

  
  sepolia: {
    name: 'Sepolia Testnet',
    chainId: 11155111,
    rpcUrl: 'https://eth-sepolia.g.alchemy.com/v2/your-api-key',
    explorerUrl: 'https://sepolia.etherscan.io',
    nativeCurrency: {
      name: 'Sepolia Ether',
      symbol: 'SepoliaETH',
      decimals: 18,
    },
    isTestnet: true,
  },

  
  goerli: {
    name: 'Goerli Testnet',
    chainId: 5,
    rpcUrl: 'https://eth-goerli.g.alchemy.com/v2/your-api-key',
    explorerUrl: 'https://goerli.etherscan.io',
    nativeCurrency: {
      name: 'Goerli Ether',
      symbol: 'GoerliETH',
      decimals: 18,
    },
    isTestnet: true,
  },

  
  polygon: {
    name: 'Polygon Mainnet',
    chainId: 137,
    rpcUrl: 'https://polygon-mainnet.g.alchemy.com/v2/your-api-key',
    explorerUrl: 'https://polygonscan.com',
    nativeCurrency: {
      name: 'MATIC',
      symbol: 'MATIC',
      decimals: 18,
    },
    isTestnet: false,
  },

  
  mumbai: {
    name: 'Mumbai Testnet',
    chainId: 80001,
    rpcUrl: 'https://polygon-mumbai.g.alchemy.com/v2/your-api-key',
    explorerUrl: 'https://mumbai.polygonscan.com',
    nativeCurrency: {
      name: 'MATIC',
      symbol: 'MATIC',
      decimals: 18,
    },
    isTestnet: true,
  },

  
  amoy: {
    name: 'Amoy Testnet',
    chainId: 80002,
    rpcUrl: 'https://rpc-amoy.polygon.technology',
    explorerUrl: 'https://amoy.polygonscan.com',
    nativeCurrency: {
      name: 'MATIC',
      symbol: 'MATIC',
      decimals: 18,
    },
    isTestnet: true,
  },

  
  base: {
    name: 'Base Mainnet',
    chainId: 8453,
    rpcUrl: 'https://mainnet.base.org',
    explorerUrl: 'https://basescan.org',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
    isTestnet: false,
  },

  
  baseSepolia: {
    name: 'Base Sepolia Testnet',
    chainId: 84532,
    rpcUrl: 'https://sepolia.base.org',
    explorerUrl: 'https://sepolia.basescan.org',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
    isTestnet: true,
  },
};


const getCurrentNetwork = () => {
  const networkConfig = NETWORKS[BLOCKCHAIN_NETWORK];

  if (!networkConfig) {
    throw new Error(`Unsupported network: ${BLOCKCHAIN_NETWORK}`);
  }

  
  return {
    ...networkConfig,
    chainId: CHAIN_ID || networkConfig.chainId,
    rpcUrl: RPC_URL || networkConfig.rpcUrl,
  };
};


const getNetworkByChainId = (chainId) => {
  const network = Object.values(NETWORKS).find(n => n.chainId === chainId);
  return network || null;
};


const isTestnet = () => {
  const network = getCurrentNetwork();
  return network.isTestnet;
};


const getExplorerTxUrl = (txHash) => {
  const network = getCurrentNetwork();
  return `${network.explorerUrl}/tx/${txHash}`;
};


const getExplorerAddressUrl = (address) => {
  const network = getCurrentNetwork();
  return `${network.explorerUrl}/address/${address}`;
};


const getSupportedNetworks = () => {
  return Object.keys(NETWORKS);
};


const validateNetworkConfig = () => {
  const network = getCurrentNetwork();

  if (!network.chainId || network.chainId <= 0) {
    throw new Error('Invalid chain ID in network configuration');
  }

  if (!network.rpcUrl || !network.rpcUrl.startsWith('http')) {
    throw new Error('Invalid RPC URL in network configuration');
  }

  if (!network.explorerUrl || !network.explorerUrl.startsWith('http')) {
    throw new Error('Invalid explorer URL in network configuration');
  }
};


validateNetworkConfig();

module.exports = {
  NETWORKS,
  getCurrentNetwork,
  getNetworkByChainId,
  isTestnet,
  getExplorerTxUrl,
  getExplorerAddressUrl,
  getSupportedNetworks,
  validateNetworkConfig,
};