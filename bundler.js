const express = require('express');
const ethers = require('ethers');
const bodyParser = require('body-parser');

// === 自訂參數 ===
const RPC_URL = "http://localhost:8545"; // 你的RPC URL
const ENTRY_POINT_ADDRESS = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512"; // 替換成你的EntryPoint地址
const PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"; // Bundler的私鑰（可以是Hardhat帳號）
const PORT = 3000; // Bundler HTTP端口

// === 初始化 provider 和 signer ===
const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

// === 初始化 Express app ===
const app = express();
app.use(bodyParser.json());

// === Bundler收UserOperation的handler ===
app.post('/', async (req, res) => {
    const { method, params } = req.body;

    if (method !== 'eth_sendUserOperation') {
        return res.status(400).send({ error: 'Only eth_sendUserOperation is supported' });
    }

    const [userOp, entryPointAddr] = params;

    if (entryPointAddr.toLowerCase() !== ENTRY_POINT_ADDRESS.toLowerCase()) {
        return res.status(400).send({ error: 'EntryPoint address mismatch' });
    }

    try {
        console.log("✅ 收到 UserOperation");

        const iface = new ethers.Interface([
            "function handleOps((address,uint256,bytes,bytes,uint256,uint256,uint256,uint256,uint256,bytes,bytes)[] ops, address beneficiary)"
        ]);

        // 按正確順序轉成 tuple array
        const userOpArray = [
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
            userOp.signature
        ];

        const calldata = iface.encodeFunctionData("handleOps", [[userOpArray], wallet.address]);

        // 發送交易
        const tx = await wallet.sendTransaction({
            to: ENTRY_POINT_ADDRESS,
            data: calldata,
            gasLimit: 1000000n // ethers v6 要用 BigInt
        });

        console.log(`📤 交易送出！txHash: ${tx.hash}`);
        res.send({ txHash: tx.hash });

    } catch (err) {
        console.error("❌ Bundler錯誤:", err);
        res.status(500).send({ error: err.toString() });
    }
});

// === 啟動 server ===
app.listen(PORT, () => {
    console.log(`🚀 Bundler server listening at http://localhost:${PORT}`);
});
