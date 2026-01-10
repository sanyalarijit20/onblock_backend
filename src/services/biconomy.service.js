const { ethers } = require('ethers');
const axios = require('axios');
const logger = require('../utils/logger');
const { getProvider } = require('../blockchain/provider');
const config = require('../config/env');

const BICONOMY_PAYMASTER_URL = config.BICONOMY_PAYMASTER_URL;
const BICONOMY_BUNDLER_URL = config.BICONOMY_BUNDLER_URL;
const BICONOMY_API_KEY = config.BICONOMY_API_KEY;

const ENTRY_POINT_ADDRESS = config.ENTRY_POINT_ADDRESS;
const ACCOUNT_FACTORY_ADDRESS = config.ACCOUNT_FACTORY_ADDRESS;

const ENTRY_POINT_ABI = [
  'function getNonce(address sender, uint192 key) view returns (uint256)'
];

const FACTORY_ABI = [
  'function createAccount(address owner, uint256 salt) returns (address)',
  'function getAddress(address owner, uint256 salt) view returns (address)'
];

const EXECUTE_ABI = [
  'function execute(address dest, uint256 value, bytes calldata func)'
];

const createSmartAccount = async (ownerAddress, network) => {
  const provider = getProvider(network);
  const factory = new ethers.Contract(
    ACCOUNT_FACTORY_ADDRESS,
    FACTORY_ABI,
    provider
  );

  const salt = 0;
  const smartAccountAddress = await factory.getAddress(ownerAddress, salt);

  const initCode =
    ACCOUNT_FACTORY_ADDRESS +
    factory.interface.encodeFunctionData('createAccount', [
      ownerAddress,
      salt
    ]).slice(2);

  return {
    smartAccountAddress,
    ownerAddress,
    salt,
    initCode
  };
};

const getSmartAccountNonce = async (smartAccountAddress, network) => {
  const provider = getProvider(network);
  const entryPoint = new ethers.Contract(
    ENTRY_POINT_ADDRESS,
    ENTRY_POINT_ABI,
    provider
  );

  const nonce = await entryPoint.getNonce(smartAccountAddress, 0);
  return nonce.toString();
};

const buildTransferCallData = (to, amount, tokenAddress = null) => {
  if (!tokenAddress) {
    const iface = new ethers.Interface(EXECUTE_ABI);
    return iface.encodeFunctionData('execute', [to, amount, '0x']);
  }

  const erc20Iface = new ethers.Interface([
    'function transfer(address to, uint256 amount)'
  ]);
  const transferData = erc20Iface.encodeFunctionData('transfer', [
    to,
    amount
  ]);

  const iface = new ethers.Interface(EXECUTE_ABI);
  return iface.encodeFunctionData('execute', [
    tokenAddress,
    0,
    transferData
  ]);
};

const buildUserOperation = async ({
  sender,
  nonce,
  initCode,
  callData,
  gasLimits,
  feeData
}) => {
  return {
    sender,
    nonce: ethers.toBeHex(nonce),
    initCode,
    callData,
    callGasLimit: ethers.toBeHex(gasLimits.callGasLimit),
    verificationGasLimit: ethers.toBeHex(gasLimits.verificationGasLimit),
    preVerificationGas: ethers.toBeHex(gasLimits.preVerificationGas),
    maxFeePerGas: ethers.toBeHex(feeData.maxFeePerGas),
    maxPriorityFeePerGas: ethers.toBeHex(feeData.maxPriorityFeePerGas),
    paymasterAndData: '0x',
    signature: '0x'
  };
};

const signUserOperation = async (userOp, signer) => {
  const encoded = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      [
        'address',
        'uint256',
        'bytes',
        'bytes',
        'uint256',
        'uint256',
        'uint256',
        'uint256',
        'uint256',
        'bytes'
      ],
      [
        userOp.sender,
        userOp.nonce,
        userOp.initCode,
        userOp.callData,
        userOp.callGasLimit,
        userOp.verificationGasLimit,
        userOp.preVerificationGas,
        userOp.maxFeePerGas,
        userOp.maxPriorityFeePerGas,
        userOp.paymasterAndData
      ]
    )
  );

  const signature = await signer.signMessage(ethers.getBytes(encoded));
  userOp.signature = signature;
  return userOp;
};

const sponsorUserOperation = async (userOp, network) => {
  const response = await axios.post(
    `${BICONOMY_PAYMASTER_URL}/api/v2/sponsor`,
    { userOp, network },
    {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': BICONOMY_API_KEY
      }
    }
  );

  return {
    ...userOp,
    paymasterAndData: response.data.paymasterAndData,
    preVerificationGas: response.data.preVerificationGas,
    verificationGasLimit: response.data.verificationGasLimit,
    callGasLimit: response.data.callGasLimit
  };
};

const sendUserOperation = async (userOp, network) => {
  const response = await axios.post(
    `${BICONOMY_BUNDLER_URL}/api/v2/submit`,
    { userOp, network },
    {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': BICONOMY_API_KEY
      }
    }
  );

  return {
    userOpHash: response.data.userOpHash,
    status: 'submitted'
  };
};

const getUserOpReceipt = async (userOpHash, network) => {
  try {
    const response = await axios.get(
      `${BICONOMY_BUNDLER_URL}/api/v2/receipt/${userOpHash}`,
      {
        params: { network },
        headers: { 'x-api-key': BICONOMY_API_KEY }
      }
    );

    return response.data;
  } catch (err) {
    if (err.response?.status === 404) return null;
    throw err;
  }
};

const checkPaymasterBalance = async (network) => {
  const response = await axios.get(
    `${BICONOMY_PAYMASTER_URL}/api/v2/balance`,
    {
      params: { network },
      headers: { 'x-api-key': BICONOMY_API_KEY }
    }
  );

  return response.data.balance;
};

module.exports = {
  createSmartAccount,
  getSmartAccountNonce,
  buildTransferCallData,
  buildUserOperation,
  signUserOperation,
  sponsorUserOperation,
  sendUserOperation,
  getUserOpReceipt,
  checkPaymasterBalance
};
