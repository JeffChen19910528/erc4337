const { ethers } = require("ethers");

// 與 EntryPoint.sol 的 handleOps 中 userOpHash 計算方式對應的欄位型別。
const USEROP_HASH_TYPES = [
    "address", "uint256", "bytes", "bytes",
    "uint256", "uint256", "uint256",
    "uint256", "uint256", "bytes",
];

/**
 * 建立一筆尚未簽章的 UserOperation。
 */
function buildUserOp({
    sender,
    nonce,
    callData,
    callGasLimit = 150000,
    verificationGasLimit = 150000,
    preVerificationGas = 20000,
    maxFeePerGas,
    maxPriorityFeePerGas = 1e9,
}) {
    return {
        sender,
        nonce: ethers.toBeHex(nonce),
        initCode: "0x",
        callData,
        callGasLimit: ethers.toBeHex(callGasLimit),
        verificationGasLimit: ethers.toBeHex(verificationGasLimit),
        preVerificationGas: ethers.toBeHex(preVerificationGas),
        maxFeePerGas: ethers.toBeHex(maxFeePerGas),
        maxPriorityFeePerGas: ethers.toBeHex(maxPriorityFeePerGas),
        paymasterAndData: "0x",
        signature: "0x",
    };
}

/**
 * 計算與 EntryPoint.handleOps 相同演算法的 userOpHash（不含 signature）。
 */
function hashUserOp(userOp) {
    return ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(USEROP_HASH_TYPES, [
            userOp.sender,
            BigInt(userOp.nonce),
            userOp.initCode,
            userOp.callData,
            BigInt(userOp.callGasLimit),
            BigInt(userOp.verificationGasLimit),
            BigInt(userOp.preVerificationGas),
            BigInt(userOp.maxFeePerGas),
            BigInt(userOp.maxPriorityFeePerGas),
            userOp.paymasterAndData,
        ])
    );
}

/**
 * 以 signer 對 userOp 簽章，簽章結果會寫入 userOp.signature 並回傳同一物件。
 */
async function signUserOp(userOp, signer) {
    const hash = hashUserOp(userOp);
    userOp.signature = await signer.signMessage(ethers.getBytes(hash));
    return userOp;
}

/**
 * 將 userOp 轉換成 EntryPoint.handleOps 所需的 tuple 陣列格式。
 */
function toHandleOpsArgs(userOp) {
    return [
        userOp.sender,
        userOp.nonce,
        userOp.initCode,
        userOp.callData,
        userOp.callGasLimit,
        userOp.verificationGasLimit,
        userOp.preVerificationGas,
        userOp.maxFeePerGas,
        userOp.maxPriorityFeePerGas,
        userOp.paymasterAndData,
        userOp.signature,
    ];
}

module.exports = { buildUserOp, hashUserOp, signUserOp, toHandleOpsArgs, USEROP_HASH_TYPES };
