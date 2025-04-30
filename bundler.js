const express = require('express');
const ethers = require('ethers');
const bodyParser = require('body-parser');
const fs = require('fs');

// === 讀取部署資訊 ===
const deployInfo = JSON.parse(fs.readFileSync('deploy.json'));
const ENTRY_POINT_ADDRESS = deployInfo.entryPoint;
const COUNTER_ADDRESS = deployInfo.counter;

const RPC_URL = "http://localhost:8545";
const PRIVATE_KEY = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";
const PORT = 3000;

// === ABI 定義 ===
const counterABI = [
    "function increase()",
    "function decrease()",
    "event NumberChanged(string action, uint256 newValue)"
];

const walletABI = [
    "function execute(address target, bytes data)"
];

// === 初始化 provider 和 signer ===
const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

// === 初始化 Interface
const counterInterface = new ethers.Interface(counterABI);
const walletInterface = new ethers.Interface(walletABI);

// === Express 啟動 ===
const app = express();
app.use(bodyParser.json());

let pendingUserOps = [];

console.log("🛠️ Bundler 啟動中，使用 EntryPoint 地址:", ENTRY_POINT_ADDRESS);

app.post('/', async (req, res) => {
    const { method, params } = req.body;

    if (method !== 'eth_sendUserOperation') {
        return res.status(400).send({ error: 'Only eth_sendUserOperation is supported' });
    }

    const [userOp, entryPointAddr] = params;

    if (entryPointAddr.toLowerCase() !== ENTRY_POINT_ADDRESS.toLowerCase()) {
        console.error(`❌ EntryPoint mismatch！收到: ${entryPointAddr} 期待: ${ENTRY_POINT_ADDRESS}`);
        return res.status(400).send({ error: 'EntryPoint address mismatch' });
    }

    console.log("✅ 收到 UserOperation");
    pendingUserOps.push(userOp);
    res.send({ result: "UserOperation queued" });
});

// === 每3秒執行一次 handleOps ===
setInterval(async () => {
    if (pendingUserOps.length === 0) return;

    try {
        console.log("🧾 正在處理 UserOperations:");

        // 嘗試解析 callData 內容
        pendingUserOps.forEach((op, idx) => {
            try {
                const decodedWalletCall = walletInterface.decodeFunctionData("execute", op.callData);
                const target = decodedWalletCall.target;
                const innerData = decodedWalletCall.data;

                let label = "unknown";
                if (target.toLowerCase() === COUNTER_ADDRESS.toLowerCase()) {
                    try {
                        const parsed = counterInterface.parseTransaction({ data: innerData });
                        label = parsed.name;
                    } catch {}
                }

                console.log(`  #${idx} - nonce: ${parseInt(op.nonce)}, 呼叫: ${label}`);
            } catch {
                console.log(`  #${idx} - nonce: ${parseInt(op.nonce)}, callData 無法解譯`);
            }
        });

        // 呼叫 handleOps
        const userOpsArray = pendingUserOps.map(op => [
            op.sender,
            op.nonce,
            op.initCode,
            op.callData,
            op.callGasLimit,
            op.verificationGasLimit,
            op.preVerificationGas,
            op.maxFeePerGas,
            op.maxPriorityFeePerGas,
            op.paymasterAndData,
            op.signature
        ]);

        const entryPointInterface = new ethers.Interface([
            "function handleOps((address,uint256,bytes,bytes,uint256,uint256,uint256,uint256,uint256,bytes,bytes)[] ops, address beneficiary)"
        ]);

        const calldata = entryPointInterface.encodeFunctionData("handleOps", [userOpsArray, wallet.address]);

        const tx = await wallet.sendTransaction({
            to: ENTRY_POINT_ADDRESS,
            data: calldata,
            gasLimit: 3_000_000n
        });

        console.log(`📤 批次送出 ${pendingUserOps.length} 筆 UserOperation! txHash: ${tx.hash}`);

        const receipt = await tx.wait();

        // 印出 Counter 合約的事件
        for (const log of receipt.logs) {
            try {
                const parsed = counterInterface.parseLog(log);
                console.log(`📊 [Counter 事件] ${parsed.args.action}: ${parsed.args.newValue.toString()}`);
            } catch (e) {
                // 非 counter 事件，忽略
            }
        }

    } catch (err) {
        console.error("❌ 批次送出失敗:", err.reason || err.message || err);
    } finally {
        // 清空佇列
        pendingUserOps = [];
    }
}, 3000);

// === 啟動伺服器 ===
app.listen(PORT, () => {
    console.log(`🚀 Bundler server listening at http://localhost:${PORT}`);
});
