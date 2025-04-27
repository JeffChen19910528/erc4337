const ethers = require('ethers');
const axios = require('axios');

async function main() {
    const RPC_URL = "http://localhost:8545"; // 本地鏈RPC
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const signer = await provider.getSigner(1); // 使用第2個帳號（可自行改 index）

    const sender = await signer.getAddress();
    const nonce = await provider.getTransactionCount(sender); // 讀取nonce

    // 建立一個簡單的UserOperation
    const userOp = {
        sender: sender,
        nonce: ethers.toBeHex(nonce),  // 轉成Hex格式
        initCode: "0x",
        callData: "0x",
        callGasLimit: ethers.toBeHex(100000), // 轉成Hex
        verificationGasLimit: ethers.toBeHex(100000),
        preVerificationGas: ethers.toBeHex(10000),
        maxFeePerGas: ethers.toBeHex(1000000000), // 1 gwei
        maxPriorityFeePerGas: ethers.toBeHex(1000000000),
        paymasterAndData: "0x",
        signature: "0x" // 測試階段先留空
    };

    const response = await axios.post("http://localhost:3000/", {
        jsonrpc: "2.0",
        id: 1,
        method: "eth_sendUserOperation",
        params: [userOp, "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512"] // 記得替換地址
    });

    console.log("📩 Bundler回傳:", response.data);
}

main().catch(console.error);
