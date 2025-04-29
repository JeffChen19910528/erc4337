const ethers = require('ethers');
const axios = require('axios');
const fs = require('fs');

async function main() {
    const RPC_URL = "http://localhost:8545";
    const provider = new ethers.JsonRpcProvider(RPC_URL);

    const deployInfo = JSON.parse(fs.readFileSync('deploy.json'));
    const ENTRY_POINT_ADDRESS = deployInfo.entryPoint;
    const COUNTER_ADDRESS = deployInfo.counter;
    const SIMPLE_WALLET_ADDRESS = deployInfo.wallet;

    console.log("📦 模擬 TOD - 使用 SimpleWallet 執行操作...");
    console.log("📦 Counter:    ", COUNTER_ADDRESS);
    console.log("📦 SimpleWallet:", SIMPLE_WALLET_ADDRESS);

    const counterInterface = new ethers.Interface([
        "function increase()",
        "function decrease()"
    ]);

    const walletInterface = new ethers.Interface([
        "function execute(address target, bytes data)"
    ]);

    const callDataDecrease = counterInterface.encodeFunctionData("decrease");
    const callDataIncrease = counterInterface.encodeFunctionData("increase");

    const walletCallDataDecrease = walletInterface.encodeFunctionData("execute", [
        COUNTER_ADDRESS, callDataDecrease
    ]);
    const walletCallDataIncrease = walletInterface.encodeFunctionData("execute", [
        COUNTER_ADDRESS, callDataIncrease
    ]);

    const nonce = await provider.getTransactionCount(SIMPLE_WALLET_ADDRESS);

    const baseUserOp = {
        sender: SIMPLE_WALLET_ADDRESS,
        initCode: "0x",
        callGasLimit: ethers.toBeHex(150000),
        verificationGasLimit: ethers.toBeHex(150000),
        preVerificationGas: ethers.toBeHex(20000),
        maxFeePerGas: ethers.toBeHex(10n ** 9n),
        maxPriorityFeePerGas: ethers.toBeHex(1n ** 9n),
        paymasterAndData: "0x",
        signature: "0x"
    };

    const userOp2 = {
        ...baseUserOp,
        nonce: ethers.toBeHex(nonce + 1),
        callData: walletCallDataDecrease
      };
    const userOp1 = {
        ...baseUserOp,
        nonce: ethers.toBeHex(nonce),
        callData: walletCallDataIncrease
      };
      

    await axios.post("http://localhost:3000/", {
        jsonrpc: "2.0",
        id: 1,
        method: "eth_sendUserOperation",
        params: [userOp1, ENTRY_POINT_ADDRESS]
    });

    await axios.post("http://localhost:3000/", {
        jsonrpc: "2.0",
        id: 2,
        method: "eth_sendUserOperation",
        params: [userOp2, ENTRY_POINT_ADDRESS]
    });

    console.log("📨 已送出兩筆 →decrease 再 →increase 的 UserOperations");
}

main().catch(console.error);
