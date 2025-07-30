const express = require('express');
const ethers = require('ethers');
const bodyParser = require('body-parser');
const fs = require('fs');
const ExcelJS = require('exceljs');

// === 讀取部署資訊 ===
const deployInfo = JSON.parse(fs.readFileSync('deploy.json'));
const ENTRY_POINT_ADDRESS = deployInfo.entryPoint;
const COUNTER_ADDRESS = deployInfo.counter;

const RPC_URL = "http://localhost:8545";
const PRIVATE_KEY = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";
const PORT = 3000;
const JSON_LOG = "./tps-log.json";

const EXCEL_LOG = "./tps-log.xlsx";
const workbook = new ExcelJS.Workbook();
const worksheet = workbook.addWorksheet('TPS Log');

// 初始化表頭（只在一開始寫入）
worksheet.columns = [
    { header: 'Interval', key: 'interval', width: 10 },
    { header: 'Timestamp', key: 'timestamp', width: 25 },
    { header: 'UserOpsProcessed', key: 'userOpsProcessed', width: 20 },
    { header: 'TPS', key: 'tps', width: 10 },
    { header: 'TotalUserOpsProcessed', key: 'totalUserOpsProcessed', width: 25 },
];

// === ABI 定義 ===
const counterABI = [
    "function increase()",
    "function decrease()",
    "event NumberChanged(string action, uint256 newValue)"
];
const walletABI = ["function execute(address target, bytes data)"];
const entryPointABI = [
    "function handleOps((address,uint256,bytes,bytes,uint256,uint256,uint256,uint256,uint256,bytes,bytes)[] ops, address beneficiary)",
    "event UserOpHandled(address indexed sender, bool success, string reason)"
];

// === 初始化
const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

const counterInterface = new ethers.Interface(counterABI);
const walletInterface = new ethers.Interface(walletABI);
const entryPointInterface = new ethers.Interface(entryPointABI);

const app = express();
app.use(bodyParser.json());

let pendingUserOps = [];
let isHandling = false;

// === TPS 記錄用 ===
let intervalStartTime = Date.now();
let intervalIndex = 1;
let userOpsProcessed = 0;
let intervalLogs = [];
let totalUserOpsProcessed = 0;
let recentProcessed = 0; 

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

// === 每 3 秒處理一次批次
setInterval(async () => {
    if (pendingUserOps.length === 0 || isHandling) return;
    isHandling = true;

    try {
        pendingUserOps.sort((a, b) => {
            const aFee = BigInt(a.maxFeePerGas);
            const bFee = BigInt(b.maxFeePerGas);
            return aFee > bFee ? -1 : aFee < bFee ? 1 : 0;
        });

        console.log("🧾 正在處理 UserOperations（按 maxFeePerGas 排序）:");
        pendingUserOps.forEach((op, idx) => {
            try {
                const decoded = walletInterface.decodeFunctionData("execute", op.callData);
                const target = decoded.target;
                const innerData = decoded.data;
                let label = "unknown";
                if (target.toLowerCase() === COUNTER_ADDRESS.toLowerCase()) {
                    const parsed = counterInterface.parseTransaction({ data: innerData });
                    label = parsed.name;
                }
                console.log(`  #${idx} - nonce: ${parseInt(op.nonce)}, 呼叫: ${label}, maxFeePerGas: ${BigInt(op.maxFeePerGas)}`);
            } catch {
                console.log(`  #${idx} - nonce: ${parseInt(op.nonce)}, callData 無法解譯`);
            }
        });

        console.log("📦 傳送 handleOps(...) 中包含的 senders:");
        pendingUserOps.forEach(op => {
            console.log(`   - ${op.sender} | nonce: ${op.nonce}`);
        });

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

        const calldata = entryPointInterface.encodeFunctionData("handleOps", [userOpsArray, wallet.address]);

        const tx = await wallet.sendTransaction({
            to: ENTRY_POINT_ADDRESS,
            data: calldata,
            gasLimit: 3_000_000n
        });

        console.log(`📤 批次送出 ${pendingUserOps.length} 筆 UserOperation! txHash: ${tx.hash}`);
        const receipt = await tx.wait();

        recentProcessed += pendingUserOps.length;

        for (const log of receipt.logs) {
            try {
                const parsed = counterInterface.parseLog(log);
                console.log(`📊 [Counter 事件] ${parsed.args.action}: ${parsed.args.newValue.toString()}`);
            } catch {}
            try {
                const parsed = entryPointInterface.parseLog(log);
                if (parsed.name === "UserOpHandled") {
                    console.log(`📣 [UserOpHandled] sender=${parsed.args.sender} 成功=${parsed.args.success} 原因=${parsed.args.reason}`);
                }
            } catch {}
        }

    } catch (err) {
        console.error("❌ 批次送出失敗:", err.reason || err.message || err);
    } finally {
        console.log(`🧹 清空 pendingUserOps (${pendingUserOps.length} 筆)`);
        pendingUserOps = [];
        isHandling = false;
    }
}, 3000);

// === 每兩分鐘記錄一次 JSON
setInterval(() => {
    const now = Date.now();
    const elapsed = now - intervalStartTime;
    const secondsElapsed = elapsed / 1000;

    if (elapsed >= 2 * 60 * 1000) {
        const tps = recentProcessed / secondsElapsed;
        totalUserOpsProcessed += recentProcessed;

        const logEntry = {
            interval: intervalIndex,
            timestamp: new Date().toISOString(),
            userOpsProcessed: recentProcessed,
            tps: Number(tps.toFixed(2)),
            totalUserOpsProcessed
        };

        // 寫入 JSON
        intervalLogs.push(logEntry);
        fs.writeFileSync(JSON_LOG, JSON.stringify(intervalLogs, (_k, v) =>
            typeof v === 'bigint' ? v.toString() : v, 2));

        // 寫入 Excel
        worksheet.addRow(logEntry);

        // 寫入檔案（覆蓋方式，每次寫全檔）
        workbook.xlsx.writeFile(EXCEL_LOG)
            .then(() => console.log(`📄 Excel 檔已更新: ${EXCEL_LOG}`))
            .catch(err => console.error("寫入 Excel 時發生錯誤:", err));

        console.log(`📈 Interval #${intervalIndex}：共 ${recentProcessed} 筆，TPS: ${tps.toFixed(2)}，累計總量: ${totalUserOpsProcessed}`);

        intervalIndex++;
        intervalStartTime = now;
        recentProcessed = 0;
    }
}, 1000);


app.listen(PORT, () => {
    console.log(`🚀 Bundler server listening at http://localhost:${PORT}`);
});
