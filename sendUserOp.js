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

    const counterIface = new ethers.Interface(["function increase()", "function decrease()"]);
    const walletIface = new ethers.Interface(["function execute(address target, bytes data)"]);

    const increaseData = counterIface.encodeFunctionData("increase");
    const decreaseData = counterIface.encodeFunctionData("decrease");

    const walletCallData = {
        increase: walletIface.encodeFunctionData("execute", [COUNTER_ADDRESS, increaseData]),
        decrease: walletIface.encodeFunctionData("execute", [COUNTER_ADDRESS, decreaseData])
    };

    const nonceStart = await provider.getTransactionCount(SIMPLE_WALLET_ADDRESS);

    // 👉 修改這裡的順序和長度即可控制 TOD 模擬內容
    const actions = ["increase", "decrease", "decrease", "decrease"]; // 多筆或重複都可以

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

    await Promise.all(actions.map(async (action, idx) => {
        const userOp = {
            ...baseUserOp,
            nonce: ethers.toBeHex(nonceStart + idx),
            callData: walletCallData[action]
        };

        console.log(`📤 傳送 UserOp #${idx} (${action})`);
        await axios.post("http://localhost:3000/", {
            jsonrpc: "2.0",
            id: idx + 1,
            method: "eth_sendUserOperation",
            params: [userOp, ENTRY_POINT_ADDRESS]
        });
    }));

    console.log("✅ 所有 UserOperation 已送出");
}

main().catch(console.error);
