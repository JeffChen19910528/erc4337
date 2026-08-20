const { ethers } = require("ethers");

const { RPC_URL, DEPLOY_JSON_PATH } = require("./lib/config");
const { loadDeployInfo } = require("./lib/deployInfo");

const FUND_AMOUNT_ETH = "1.0";

async function main() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const signer = await provider.getSigner(0); // ✅ 使用 Hardhat node 的第 0 個帳戶作為出資者

    const deployInfo = loadDeployInfo(DEPLOY_JSON_PATH);
    const wallets = deployInfo.wallets;

    if (!wallets || wallets.length === 0) {
        console.error("❌ deploy.json 中未找到任何 wallets");
        return;
    }

    for (const w of wallets) {
        console.log(`💰 正在轉帳到 SimpleWallet (${w.name}) 地址: ${w.walletAddress}`);

        const tx = await signer.sendTransaction({
            to: w.walletAddress,
            value: ethers.parseEther(FUND_AMOUNT_ETH),
        });

        console.log(`✅ 已轉帳給 ${w.name}；txHash: ${tx.hash}`);
    }

    console.log("\n🎉 所有 SimpleWallet 已轉帳完成");
}

main().catch(console.error);
