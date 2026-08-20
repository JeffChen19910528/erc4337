const express = require("express");
const bodyParser = require("body-parser");
const { ethers } = require("ethers");

const { COUNTER_ABI, SIMPLE_WALLET_ABI, ENTRY_POINT_ABI } = require("./abi");
const { sortByFeeDesc, describeOp } = require("./batchProcessor");
const { toHandleOpsArgs } = require("./userOperation");

/**
 * 建立一個最小可用的 ERC-4337 bundler：
 * - 接收 eth_sendUserOperation
 * - 每隔 batchIntervalMs 依 maxFeePerGas 排序後批次送出 handleOps
 *
 * `onBatchProcessed(count)` 為選用的 callback，於每次成功送出批次後呼叫，
 * 讓上層（如 TPS 統計版本）可以附加額外行為而不需重寫批次處理邏輯。
 */
function createBundler({
    rpcUrl,
    port,
    privateKey,
    entryPointAddress,
    counterAddress,
    batchIntervalMs,
    onBatchProcessed,
}) {
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);

    const counterInterface = new ethers.Interface(COUNTER_ABI);
    const walletInterface = new ethers.Interface(SIMPLE_WALLET_ABI);
    const entryPointInterface = new ethers.Interface(ENTRY_POINT_ABI);

    const app = express();
    app.use(bodyParser.json());

    let pendingUserOps = [];
    let isHandling = false;

    app.post("/", (req, res) => {
        const { method, params } = req.body;
        if (method !== "eth_sendUserOperation") {
            return res.status(400).send({ error: "Only eth_sendUserOperation is supported" });
        }

        const [userOp, entryPointAddr] = params;
        if (entryPointAddr.toLowerCase() !== entryPointAddress.toLowerCase()) {
            console.error(`❌ EntryPoint mismatch！收到: ${entryPointAddr} 期待: ${entryPointAddress}`);
            return res.status(400).send({ error: "EntryPoint address mismatch" });
        }

        console.log("✅ 收到 UserOperation");
        pendingUserOps.push(userOp);
        res.send({ result: "UserOperation queued" });
    });

    async function processBatch() {
        if (pendingUserOps.length === 0 || isHandling) return;
        isHandling = true;

        try {
            pendingUserOps = sortByFeeDesc(pendingUserOps);

            console.log("🧾 正在處理 UserOperations（按 maxFeePerGas 排序）:");
            pendingUserOps.forEach((op, idx) => {
                const info = describeOp(op, { walletInterface, counterInterface, counterAddress });
                console.log(
                    info.label
                        ? `  #${idx} - nonce: ${info.nonce}, 呼叫: ${info.label}, maxFeePerGas: ${info.maxFeePerGas}`
                        : `  #${idx} - nonce: ${info.nonce}, callData 無法解譯`
                );
            });

            console.log("📦 傳送 handleOps(...) 中包含的 senders:");
            pendingUserOps.forEach(op => console.log(`   - ${op.sender} | nonce: ${op.nonce}`));

            const userOpsArray = pendingUserOps.map(toHandleOpsArgs);
            const calldata = entryPointInterface.encodeFunctionData("handleOps", [userOpsArray, wallet.address]);

            const tx = await wallet.sendTransaction({
                to: entryPointAddress,
                data: calldata,
                gasLimit: 3_000_000n,
            });

            console.log(`📤 批次送出 ${pendingUserOps.length} 筆 UserOperation! txHash: ${tx.hash}`);
            const receipt = await tx.wait();

            for (const log of receipt.logs) {
                try {
                    const parsed = counterInterface.parseLog(log);
                    console.log(`📊 [Counter 事件] ${parsed.args.action}: ${parsed.args.newValue.toString()}`);
                } catch {}
                try {
                    const parsed = entryPointInterface.parseLog(log);
                    if (parsed.name === "UserOpHandled") {
                        console.log(
                            `📣 [UserOpHandled] sender=${parsed.args.sender} 成功=${parsed.args.success} 原因=${parsed.args.reason}`
                        );
                    }
                } catch {}
            }

            if (onBatchProcessed) onBatchProcessed(pendingUserOps.length);
        } catch (err) {
            console.error("❌ 批次送出失敗:", err.reason || err.message || err);
        } finally {
            console.log(`🧹 清空 pendingUserOps (${pendingUserOps.length} 筆)`);
            pendingUserOps = [];
            isHandling = false;
        }
    }

    const intervalHandle = setInterval(processBatch, batchIntervalMs);

    function start() {
        return app.listen(port, () => {
            console.log(`🚀 Bundler server listening at http://localhost:${port}`);
        });
    }

    function stop() {
        clearInterval(intervalHandle);
    }

    return { app, start, stop };
}

module.exports = { createBundler };
