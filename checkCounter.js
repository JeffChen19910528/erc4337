const { ethers } = require("ethers");

const { RPC_URL, DEPLOY_JSON_PATH } = require("./lib/config");
const { loadDeployInfo } = require("./lib/deployInfo");
const { COUNTER_ABI, ENTRY_POINT_ABI } = require("./lib/abi");

const RECENT_BLOCK_WINDOW = 1000;

async function main() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);

    const deployInfo = loadDeployInfo(DEPLOY_JSON_PATH);
    const COUNTER_ADDRESS = deployInfo.counter;
    const ENTRY_POINT_ADDRESS = deployInfo.entryPoint;

    const counter = new ethers.Contract(COUNTER_ADDRESS, COUNTER_ABI, provider);
    const entryPoint = new ethers.Contract(ENTRY_POINT_ADDRESS, ENTRY_POINT_ABI, provider);

    const value = await counter.number();
    console.log("📈 Counter 現在的數值是:", value.toString());

    console.log("🔍 解析 EntryPoint 中最近的 UserOpHandled 事件...");

    const latest = await provider.getBlockNumber();
    const startBlock = Math.max(0, latest - RECENT_BLOCK_WINDOW);

    const logs = await entryPoint.queryFilter("UserOpHandled", startBlock, latest);

    if (logs.length === 0) {
        console.log("⚠️ 沒有找到 UserOpHandled 事件");
    } else {
        logs.sort((a, b) => a.blockNumber - b.blockNumber || a.transactionIndex - b.transactionIndex);

        for (const log of logs) {
            const { sender, success, reason } = log.args;
            const block = await log.getBlock();
            const ts = new Date(block.timestamp * 1000).toISOString();
            console.log(`🧾 [${ts}] block=${log.blockNumber} txIndex=${log.transactionIndex}`);
            console.log(`   ↳ sender=${sender}`);
            console.log(`   ↳ 成功=${success}`);
            console.log(`   ↳ 原因=${reason || "(空)"}`);
        }
    }
}

main().catch(console.error);
