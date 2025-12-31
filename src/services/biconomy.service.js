const { ethers } = require('ethers');
const axios = require('axios');
const logger = require('../utils/logger');
const { getProvider } = require('../blockchain/provider');

const BICONOMY_PAYMASTER_URL = process.env.BICONOMY_PAYMASTER_URL;
const BICONOMY_BUNDLER_URL = process.env.BICONOMY_BUNDLER_URL;
const BICONOMY_API_KEY = process.env.BICONOMY_API_KEY;

const createSmartAccount = async (ownerAddress, network = 'polygon') => {
  try {
    const provider = getProvider(network);
    
    const factoryAddress = process.env.ACCOUNT_FACTORY_ADDRESS;
    const factoryABI = [
      'function createAccount(address owner, uint256 salt) returns (address)',
      'function getAddress(address owner, uint256 salt) view returns (address)'
    ];
    
    const factory = new ethers.Contract(factoryAddress, factoryABI, provider);
    const salt = 0;
    
    const smartAccountAddress = await factory.getAddress(ownerAddress, salt);
    
    return {
      smartAccountAddress: smartAccountAddress,
      ownerAddress: ownerAddress,
      factory: factoryAddress,
      network: network,
      salt: salt
    };
  } catch (error) {
    logger.error('Create Smart Account Error:', error.message);
    throw new Error(`Failed to create smart account: ${error.message}`);
  }
};

const buildUserOperation = async (userOpParams) => {
  try {
    const {
      sender,
      nonce,
      initCode,
      callData,
      callGasLimit,
      verificationGasLimit,
      preVerificationGas,
      maxFeePerGas,
      maxPriorityFeePerGas,
      paymasterAndData,
      signature
    } = userOpParams;
    
    const userOp = {
      sender: sender,
      nonce: nonce || '0x0',
      initCode: initCode || '0x',
      callData: callData,
      callGasLimit: callGasLimit || '0x0',
      verificationGasLimit: verificationGasLimit || '0x0',
      preVerificationGas: preVerificationGas || '0x0',
      maxFeePerGas: maxFeePerGas || '0x0',
      maxPriorityFeePerGas: maxPriorityFeePerGas || '0x0',
      paymasterAndData: paymasterAndData || '0x',
      signature: signature || '0x'
    };
    
    return userOp;
  } catch (error) {
    logger.error('Build UserOp Error:', error.message);
    throw new Error(`Failed to build user operation: ${error.message}`);
  }
};

const sponsorUserOperation = async (userOp, network = 'polygon') => {
  try {
    const paymasterClient = axios.create({
      baseURL: BICONOMY_PAYMASTER_URL,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': BICONOMY_API_KEY
      }
    });
    
    const response = await paymasterClient.post('/api/v2/sponsor', {
      userOp: userOp,
      network: network,
      sponsorshipInfo: {
        webhookData: {},
        smartAccountInfo: {
          name: 'BICONOMY',
          version: '2.0.0'
        }
      }
    });
    
    return {
      paymasterAndData: response.data.paymasterAndData,
      preVerificationGas: response.data.preVerificationGas,
      verificationGasLimit: response.data.verificationGasLimit,
      callGasLimit: response.data.callGasLimit
    };
  } catch (error) {
    logger.error('Sponsor UserOp Error:', error.message);
    throw new Error(`Failed to sponsor user operation: ${error.message}`);
  }
};

const sendUserOperation = async (userOp, network = 'polygon') => {
  try {
    const bundlerClient = axios.create({
      baseURL: BICONOMY_BUNDLER_URL,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': BICONOMY_API_KEY
      }
    });
    
    const response = await bundlerClient.post('/api/v2/submit', {
      userOp: userOp,
      network: network
    });
    
    return {
      userOpHash: response.data.userOpHash,
      status: 'submitted',
      timestamp: new Date()
    };
  } catch (error) {
    logger.error('Send UserOp Error:', error.message);
    throw new Error(`Failed to send user operation: ${error.message}`);
  }
};

const getUserOpReceipt = async (userOpHash, network = 'polygon') => {
  try {
    const bundlerClient = axios.create({
      baseURL: BICONOMY_BUNDLER_URL,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': BICONOMY_API_KEY
      }
    });
    
    const response = await bundlerClient.get(`/api/v2/receipt/${userOpHash}`, {
      params: { network }
    });
    
    return {
      userOpHash: response.data.userOpHash,
      transactionHash: response.data.transactionHash,
      blockNumber: response.data.blockNumber,
      success: response.data.success,
      actualGasUsed: response.data.actualGasUsed,
      actualGasCost: response.data.actualGasCost,
      timestamp: response.data.timestamp
    };
  } catch (error) {
    if (error.response && error.response.status === 404) {
      return null;
    }
    logger.error('Get UserOp Receipt Error:', error.message);
    throw new Error(`Failed to get user operation receipt: ${error.message}`);
  }
};

const estimateUserOpGas = async (userOp, network = 'polygon') => {
  try {
    const bundlerClient = axios.create({
      baseURL: BICONOMY_BUNDLER_URL,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': BICONOMY_API_KEY
      }
    });
    
    const response = await bundlerClient.post('/api/v2/estimate', {
      userOp: userOp,
      network: network
    });
    
    return {
      preVerificationGas: response.data.preVerificationGas,
      verificationGasLimit: response.data.verificationGasLimit,
      callGasLimit: response.data.callGasLimit
    };
  } catch (error) {
    logger.error('Estimate UserOp Gas Error:', error.message);
    throw new Error(`Failed to estimate user operation gas: ${error.message}`);
  }
};

const buildTransferCallData = (to, amount, tokenAddress = null) => {
  try {
    if (!tokenAddress) {
      const executeABI = ['function execute(address dest, uint256 value, bytes calldata func)'];
      const iface = new ethers.Interface(executeABI);
      const callData = iface.encodeFunctionData('execute', [to, amount, '0x']);
      return callData;
    } else {
      const erc20ABI = ['function transfer(address to, uint256 amount)'];
      const erc20Iface = new ethers.Interface(erc20ABI);
      const transferData = erc20Iface.encodeFunctionData('transfer', [to, amount]);
      
      const executeABI = ['function execute(address dest, uint256 value, bytes calldata func)'];
      const iface = new ethers.Interface(executeABI);
      const callData = iface.encodeFunctionData('execute', [tokenAddress, 0, transferData]);
      return callData;
    }
  } catch (error) {
    logger.error('Build Transfer CallData Error:', error.message);
    throw new Error(`Failed to build transfer call data: ${error.message}`);
  }
};

const getSmartAccountNonce = async (smartAccountAddress, network = 'polygon') => {
  try {
    const provider = getProvider(network);
    const entryPointAddress = process.env.ENTRYPOINT_ADDRESS;
    const entryPointABI = ['function getNonce(address sender, uint192 key) view returns (uint256)'];
    
    const entryPoint = new ethers.Contract(entryPointAddress, entryPointABI, provider);
    const nonce = await entryPoint.getNonce(smartAccountAddress, 0);
    
    return {
      nonce: nonce.toString(),
      smartAccountAddress: smartAccountAddress,
      network: network
    };
  } catch (error) {
    logger.error('Get Smart Account Nonce Error:', error.message);
    throw new Error(`Failed to get smart account nonce: ${error.message}`);
  }
};

const checkPaymasterBalance = async (network = 'polygon') => {
  try {
    const paymasterClient = axios.create({
      baseURL: BICONOMY_PAYMASTER_URL,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': BICONOMY_API_KEY
      }
    });
    
    const response = await paymasterClient.get('/api/v2/balance', {
      params: { network }
    });
    
    return {
      balance: response.data.balance,
      network: network,
      timestamp: new Date()
    };
  } catch (error) {
    logger.error('Check Paymaster Balance Error:', error.message);
    throw new Error(`Failed to check paymaster balance: ${error.message}`);
  }
};

module.exports = {
  createSmartAccount,
  buildUserOperation,
  sponsorUserOperation,
  sendUserOperation,
  getUserOpReceipt,
  estimateUserOpGas,
  buildTransferCallData,
  getSmartAccountNonce,
  checkPaymasterBalance
};