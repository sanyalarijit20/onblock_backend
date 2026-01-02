const axios = require('axios');
const logger = require('../utils/logger');

class BundlerClient {
  constructor({ bundlerUrl, apiKey, entryPoint }) {
    if (!bundlerUrl) throw new Error('bundlerUrl required');
    if (!entryPoint) throw new Error('entryPoint required');

    this.entryPoint = entryPoint;
    this.client = axios.create({
      baseURL: bundlerUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { 'x-api-key': apiKey } : {})
      }
    });
  }

  async rpc(method, params = []) {
    const payload = {
      jsonrpc: '2.0',
      id: Date.now(),
      method,
      params
    };

    const res = await this.client.post('/', payload);

    if (!res.data) {
      throw new Error('Empty bundler response');
    }

    if (res.data.error) {
      throw new Error(res.data.error.message || 'Bundler RPC error');
    }

    return res.data.result;
  }

  async sendUserOperation(userOp) {
    try {
      const hash = await this.rpc('eth_sendUserOperation', [
        userOp,
        this.entryPoint
      ]);

      return {
        userOpHash: hash
      };
    } catch (err) {
      logger.error('sendUserOperation failed:', err.message);
      throw err;
    }
  }

  async estimateUserOperationGas(userOp) {
    try {
      return await this.rpc('eth_estimateUserOperationGas', [
        userOp,
        this.entryPoint
      ]);
    } catch (err) {
      logger.error('estimateUserOperationGas failed:', err.message);
      throw err;
    }
  }

  async getUserOperationReceipt(userOpHash) {
    try {
      return await this.rpc('eth_getUserOperationReceipt', [userOpHash]);
    } catch (err) {
      if (err.message.toLowerCase().includes('not found')) {
        return null;
      }
      logger.error('getUserOperationReceipt failed:', err.message);
      throw err;
    }
  }

  async getUserOperationByHash(userOpHash) {
    try {
      return await this.rpc('eth_getUserOperationByHash', [userOpHash]);
    } catch (err) {
      logger.error('getUserOperationByHash failed:', err.message);
      throw err;
    }
  }

  async supportedEntryPoints() {
    return await this.rpc('eth_supportedEntryPoints');
  }

  async chainId() {
    return await this.rpc('eth_chainId');
  }

  async waitForReceipt(userOpHash, { timeoutMs = 120000, pollMs = 3000 } = {}) {
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
      const receipt = await this.getUserOperationReceipt(userOpHash);
      if (receipt) return receipt;
      await new Promise(r => setTimeout(r, pollMs));
    }

    throw new Error('UserOperation receipt timeout');
  }

  async healthCheck() {
    try {
      const [chainId, entryPoints] = await Promise.all([
        this.chainId(),
        this.supportedEntryPoints()
      ]);

      return {
        healthy: true,
        chainId,
        entryPoints,
        timestamp: new Date()
      };
    } catch (err) {
      return {
        healthy: false,
        error: err.message,
        timestamp: new Date()
      };
    }
  }
}

const createBundlerClient = ({ bundlerUrl, apiKey, entryPoint }) =>
  new BundlerClient({ bundlerUrl, apiKey, entryPoint });

module.exports = {
  BundlerClient,
  createBundlerClient
};
