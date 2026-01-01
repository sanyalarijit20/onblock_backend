const { ethers } = require('ethers');
const logger = require('../utils/logger');
const { getProvider } = require('./provider');

class UserOpBuilder {
  constructor(network = 'polygon') {
    this.network = network;
    this.provider = getProvider(network);
    this.userOp = {
      sender: '',
      nonce: '0x0',
      initCode: '0x',
      callData: '0x',
      callGasLimit: '0x0',
      verificationGasLimit: '0x0',
      preVerificationGas: '0x0',
      maxFeePerGas: '0x0',
      maxPriorityFeePerGas: '0x0',
      paymasterAndData: '0x',
      signature: '0x'
    };
  }

  setSender(address) {
    this.userOp.sender = address;
    return this;
  }

  setNonce(nonce) {
    this.userOp.nonce = ethers.toBeHex(nonce);
    return this;
  }

  setInitCode(initCode) {
    this.userOp.initCode = initCode;
    return this;
  }

  setCallData(callData) {
    this.userOp.callData = callData;
    return this;
  }

  setCallGasLimit(gasLimit) {
    this.userOp.callGasLimit = ethers.toBeHex(gasLimit);
    return this;
  }

  setVerificationGasLimit(gasLimit) {
    this.userOp.verificationGasLimit = ethers.toBeHex(gasLimit);
    return this;
  }

  setPreVerificationGas(gas) {
    this.userOp.preVerificationGas = ethers.toBeHex(gas);
    return this;
  }

  setMaxFeePerGas(fee) {
    this.userOp.maxFeePerGas = ethers.toBeHex(fee);
    return this;
  }

  setMaxPriorityFeePerGas(fee) {
    this.userOp.maxPriorityFeePerGas = ethers.toBeHex(fee);
    return this;
  }

  setPaymasterAndData(data) {
    this.userOp.paymasterAndData = data;
    return this;
  }

  setSignature(signature) {
    this.userOp.signature = signature;
    return this;
  }

  async setGasLimits(callGasLimit, verificationGasLimit, preVerificationGas) {
    this.setCallGasLimit(callGasLimit);
    this.setVerificationGasLimit(verificationGasLimit);
    this.setPreVerificationGas(preVerificationGas);
    return this;
  }

  async setGasFees() {
    try {
      const feeData = await this.provider.getFeeData();
      
      if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
        this.setMaxFeePerGas(feeData.maxFeePerGas);
        this.setMaxPriorityFeePerGas(feeData.maxPriorityFeePerGas);
      } else if (feeData.gasPrice) {
        this.setMaxFeePerGas(feeData.gasPrice);
        this.setMaxPriorityFeePerGas(feeData.gasPrice);
      }
      
      return this;
    } catch (error) {
      logger.error('Set gas fees error:', error.message);
      throw new Error(`Failed to set gas fees: ${error.message}`);
    }
  }

  buildTransferCallData(to, amount, tokenAddress = null) {
    try {
      if (!tokenAddress) {
        const executeABI = ['function execute(address dest, uint256 value, bytes calldata func)'];
        const iface = new ethers.Interface(executeABI);
        const callData = iface.encodeFunctionData('execute', [to, amount, '0x']);
        this.setCallData(callData);
      } else {
        const erc20ABI = ['function transfer(address to, uint256 amount)'];
        const erc20Iface = new ethers.Interface(erc20ABI);
        const transferData = erc20Iface.encodeFunctionData('transfer', [to, amount]);
        
        const executeABI = ['function execute(address dest, uint256 value, bytes calldata func)'];
        const iface = new ethers.Interface(executeABI);
        const callData = iface.encodeFunctionData('execute', [tokenAddress, 0, transferData]);
        this.setCallData(callData);
      }
      
      return this;
    } catch (error) {
      logger.error('Build transfer call data error:', error.message);
      throw new Error(`Failed to build transfer call data: ${error.message}`);
    }
  }

  buildBatchCallData(calls) {
    try {
      const executeBatchABI = ['function executeBatch(address[] calldata dest, uint256[] calldata value, bytes[] calldata func)'];
      const iface = new ethers.Interface(executeBatchABI);
      
      const destinations = calls.map(call => call.to);
      const values = calls.map(call => call.value || 0);
      const funcs = calls.map(call => call.data || '0x');
      
      const callData = iface.encodeFunctionData('executeBatch', [destinations, values, funcs]);
      this.setCallData(callData);
      
      return this;
    } catch (error) {
      logger.error('Build batch call data error:', error.message);
      throw new Error(`Failed to build batch call data: ${error.message}`);
    }
  }

  getUserOpHash(entryPointAddress, chainId) {
    try {
      const packedUserOp = ethers.solidityPacked(
        ['address', 'uint256', 'bytes32', 'bytes32', 'uint256', 'uint256', 'uint256', 'uint256', 'uint256', 'bytes32'],
        [
          this.userOp.sender,
          this.userOp.nonce,
          ethers.keccak256(this.userOp.initCode),
          ethers.keccak256(this.userOp.callData),
          this.userOp.callGasLimit,
          this.userOp.verificationGasLimit,
          this.userOp.preVerificationGas,
          this.userOp.maxFeePerGas,
          this.userOp.maxPriorityFeePerGas,
          ethers.keccak256(this.userOp.paymasterAndData)
        ]
      );

      const encoded = ethers.solidityPacked(
        ['bytes32', 'address', 'uint256'],
        [ethers.keccak256(packedUserOp), entryPointAddress, chainId]
      );

      return ethers.keccak256(encoded);
    } catch (error) {
      logger.error('Get UserOp hash error:', error.message);
      throw new Error(`Failed to get UserOp hash: ${error.message}`);
    }
  }

  signUserOp(privateKey, entryPointAddress, chainId) {
    try {
      const userOpHash = this.getUserOpHash(entryPointAddress, chainId);
      const wallet = new ethers.Wallet(privateKey);
      const signature = wallet.signMessageSync(ethers.getBytes(userOpHash));
      
      this.setSignature(signature);
      return this;
    } catch (error) {
      logger.error('Sign UserOp error:', error.message);
      throw new Error(`Failed to sign UserOp: ${error.message}`);
    }
  }

  build() {
    if (!this.userOp.sender || this.userOp.sender === '') {
      throw new Error('Sender address is required');
    }
    
    if (!this.userOp.callData || this.userOp.callData === '0x') {
      throw new Error('Call data is required');
    }
    
    return { ...this.userOp };
  }

  reset() {
    this.userOp = {
      sender: '',
      nonce: '0x0',
      initCode: '0x',
      callData: '0x',
      callGasLimit: '0x0',
      verificationGasLimit: '0x0',
      preVerificationGas: '0x0',
      maxFeePerGas: '0x0',
      maxPriorityFeePerGas: '0x0',
      paymasterAndData: '0x',
      signature: '0x'
    };
    return this;
  }
}

const createUserOpBuilder = (network = 'polygon') => {
  return new UserOpBuilder(network);
};

module.exports = {
  UserOpBuilder,
  createUserOpBuilder
};