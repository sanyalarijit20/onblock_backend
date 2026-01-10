const { ethers } = require('ethers');
const logger = require('../utils/logger');
const { getProvider } = require('../blockchain/provider');

class UserOpBuilder {
  constructor() {
    this.provider = getProvider();
    this.reset();
  }

  reset() {
    this.userOp = {
      sender: ethers.ZeroAddress,
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

  setSender(address) {
    this.userOp.sender = ethers.getAddress(address);
    return this;
  }

  setNonce(nonce) {
    this.userOp.nonce = ethers.toBeHex(BigInt(nonce));
    return this;
  }

  setInitCode(code) {
    this.userOp.initCode = code || '0x';
    return this;
  }

  setCallData(data) {
    this.userOp.callData = data;
    return this;
  }

  setGasLimits(callGas, verificationGas, preVerificationGas) {
    this.userOp.callGasLimit = ethers.toBeHex(BigInt(callGas));
    this.userOp.verificationGasLimit = ethers.toBeHex(BigInt(verificationGas));
    this.userOp.preVerificationGas = ethers.toBeHex(BigInt(preVerificationGas));
    return this;
  }

  async setGasFees() {
    const feeData = await this.provider.getFeeData();

    if (!feeData.maxFeePerGas || !feeData.maxPriorityFeePerGas) {
      throw new Error('EIP-1559 gas data unavailable');
    }

    this.userOp.maxFeePerGas = ethers.toBeHex(feeData.maxFeePerGas);
    this.userOp.maxPriorityFeePerGas = ethers.toBeHex(feeData.maxPriorityFeePerGas);

    return this;
  }

  setPaymasterAndData(data) {
    this.userOp.paymasterAndData = data || '0x';
    return this;
  }

  buildTransferCallData(to, amount, tokenAddress = null) {
    if (!tokenAddress) {
      const abi = ['function execute(address,uint256,bytes)'];
      const iface = new ethers.Interface(abi);
      this.userOp.callData = iface.encodeFunctionData('execute', [
        ethers.getAddress(to),
        BigInt(amount),
        '0x'
      ]);
    } else {
      const erc20Abi = ['function transfer(address,uint256)'];
      const erc20Iface = new ethers.Interface(erc20Abi);
      const transferData = erc20Iface.encodeFunctionData('transfer', [
        ethers.getAddress(to),
        BigInt(amount)
      ]);

      const abi = ['function execute(address,uint256,bytes)'];
      const iface = new ethers.Interface(abi);
      this.userOp.callData = iface.encodeFunctionData('execute', [
        ethers.getAddress(tokenAddress),
        0,
        transferData
      ]);
    }
    return this;
  }

  buildBatchCallData(calls) {
    const abi = ['function executeBatch(address[],uint256[],bytes[])'];
    const iface = new ethers.Interface(abi);

    const dest = calls.map(c => ethers.getAddress(c.to));
    const values = calls.map(c => BigInt(c.value || 0));
    const data = calls.map(c => c.data || '0x');

    this.userOp.callData = iface.encodeFunctionData('executeBatch', [
      dest,
      values,
      data
    ]);

    return this;
  }

  getUserOpHash(entryPoint, chainId) {
    const packed = ethers.solidityPacked(
      [
        'address',
        'uint256',
        'bytes32',
        'bytes32',
        'uint256',
        'uint256',
        'uint256',
        'uint256',
        'uint256',
        'bytes32'
      ],
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

    return ethers.keccak256(
      ethers.solidityPacked(
        ['bytes32', 'address', 'uint256'],
        [ethers.keccak256(packed), entryPoint, BigInt(chainId)]
      )
    );
  }

  sign(privateKey, entryPoint, chainId) {
    const hash = this.getUserOpHash(entryPoint, chainId);
    const wallet = new ethers.Wallet(privateKey);
    this.userOp.signature = wallet.signMessageSync(ethers.getBytes(hash));
    return this;
  }

  build() {
    if (this.userOp.sender === ethers.ZeroAddress) {
      throw new Error('sender missing');
    }
    if (this.userOp.callData === '0x') {
      throw new Error('callData missing');
    }
    return { ...this.userOp };
  }
}

const createUserOpBuilder = () => new UserOpBuilder();

module.exports = {
  UserOpBuilder,
  createUserOpBuilder
};
