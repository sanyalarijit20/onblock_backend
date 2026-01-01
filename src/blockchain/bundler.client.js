const axios = require('axios');
const logger = require('../utils/logger');

class BundlerClient {
  constructor(bundlerUrl, apiKey, network = 'polygon') {
    this.bundlerUrl = bundlerUrl;
    this.apiKey = apiKey;
    this.network = network;
    
    this.client = axios.create({
      baseURL: bundlerUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey
      }
    });
  }

  async sendUserOperation(userOp, entryPoint) {
    try {
      const response = await this.client.post('/', {
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_sendUserOperation',
        params: [userOp, entryPoint]
      });

      if (response.data.error) {
        throw new Error(response.data.error.message || 'Bundler error');
      }

      return {
        userOpHash: response.data.result,
        network: this.network
      };
    } catch (error) {
      logger.error('Send UserOperation error:', error.message);
      throw new Error(`Failed to send user operation: ${error.message}`);
    }
  }

  async getUserOperationReceipt(userOpHash) {
    try {
      const response = await this.client.post('/', {
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_getUserOperationReceipt',
        params: [userOpHash]
      });

      if (response.data.error) {
        if (response.data.error.message.includes('not found')) {
          return null;
        }
        throw new Error(response.data.error.message || 'Bundler error');
      }

      return response.data.result;
    } catch (error) {
      logger.error('Get UserOperation receipt error:', error.message);
      throw new Error(`Failed to get user operation receipt: ${error.message}`);
    }
  }

  async getUserOperationByHash(userOpHash) {
    try {
      const response = await this.client.post('/', {
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_getUserOperationByHash',
        params: [userOpHash]
      });

      if (response.data.error) {
        throw new Error(response.data.error.message || 'Bundler error');
      }

      return response.data.result;
    } catch (error) {
      logger.error('Get UserOperation by hash error:', error.message);
      throw new Error(`Failed to get user operation by hash: ${error.message}`);
    }
  }

  async estimateUserOperationGas(userOp, entryPoint) {
    try {
      const response = await this.client.post('/', {
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_estimateUserOperationGas',
        params: [userOp, entryPoint]
      });

      if (response.data.error) {
        throw new Error(response.data.error.message || 'Bundler error');
      }

      return response.data.result;
    } catch (error) {
      logger.error('Estimate UserOperation gas error:', error.message);
      throw new Error(`Failed to estimate user operation gas: ${error.message}`);
    }
  }

  async getSupportedEntryPoints() {
    try {
      const response = await this.client.post('/', {
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_supportedEntryPoints',
        params: []
      });

      if (response.data.error) {
        throw new Error(response.data.error.message || 'Bundler error');
      }

      return response.data.result;
    } catch (error) {
      logger.error('Get supported entry points error:', error.message);
      throw new Error(`Failed to get supported entry points: ${error.message}`);
    }
  }

  async chainId() {
    try {
      const response = await this.client.post('/', {
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_chainId',
        params: []
      });

      if (response.data.error) {
        throw new Error(response.data.error.message || 'Bundler error');
      }

      return response.data.result;
    } catch (error) {
      logger.error('Get chain ID error:', error.message);
      throw new Error(`Failed to get chain ID: ${error.message}`);
    }
  }

  async waitForUserOperation(userOpHash, timeout = 60000, interval = 3000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      try {
        const receipt = await this.getUserOperationReceipt(userOpHash);
        
        if (receipt) {
          return receipt;
        }
        
        await new Promise(resolve => setTimeout(resolve, interval));
      } catch (error) {
        logger.error('Wait for UserOperation error:', error.message);
        await new Promise(resolve => setTimeout(resolve, interval));
      }
    }
    
    throw new Error('UserOperation receipt timeout');
  }

  async healthCheck() {
    try {
      const chainId = await this.chainId();
      const entryPoints = await this.getSupportedEntryPoints();
      
      return {
        healthy: true,
        chainId: chainId,
        entryPoints: entryPoints,
        network: this.network,
        timestamp: new Date()
      };
    } catch (error) {
      logger.error('Bundler health check error:', error.message);
      return {
        healthy: false,
        error: error.message,
        network: this.network,
        timestamp: new Date()
      };
    }
  }
}

const createBundlerClient = (bundlerUrl, apiKey, network = 'polygon') => {
  return new BundlerClient(bundlerUrl, apiKey, network);
};

module.exports = {
  BundlerClient,
  createBundlerClient
};