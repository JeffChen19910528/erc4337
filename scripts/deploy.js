const hre = require("hardhat");
const fs = require("fs");
require("dotenv").config();

async function main() {
    const provider = hre.ethers.provider;

    const wallets = [
        {
            name: "A",
            privateKey: process.env.PRIVATE_KEY_A,
            signer: new hre.ethers.Wallet(process.env.PRIVATE_KEY_A, provider)
        },
        {
            name: "B",
            privateKey: process.env.PRIVATE_KEY_B,
            signer: new hre.ethers.Wallet(process.env.PRIVATE_KEY_B, provider)
        }
    ];

    const deployResult = {};

    // 部署 EntryPoint
    const EntryPoint = await hre.ethers.getContractFactory("EntryPoint");
    const entryPoint = await EntryPoint.deploy();
    await entryPoint.waitForDeployment();
    const entryPointAddress = await entryPoint.getAddress();
    console.log("✅ EntryPoint 部署完成:", entryPointAddress);
    deployResult.entryPoint = entryPointAddress;

    // 部署 Counter
    const Counter = await hre.ethers.getContractFactory("Counter");
    const counter = await Counter.deploy();
    await counter.waitForDeployment();
    const counterAddress = await counter.getAddress();
    console.log("✅ Counter 部署完成:", counterAddress);
    deployResult.counter = counterAddress;

    // 部署多個 SimpleWallet
    deployResult.wallets = [];
    const SimpleWallet = await hre.ethers.getContractFactory("SimpleWallet");

    for (const w of wallets) {
        const wallet = await SimpleWallet.connect(w.signer).deploy(await w.signer.getAddress(), entryPointAddress);
        await wallet.waitForDeployment();
        const walletAddress = await wallet.getAddress();
        console.log(`✅ SimpleWallet (${w.name}) 部署完成:`, walletAddress);

        deployResult.wallets.push({
            name: w.name,
            address: await w.signer.getAddress(),
            privateKey: w.privateKey,
            walletAddress: walletAddress
        });
    }

    fs.writeFileSync("deploy.json", JSON.stringify(deployResult, null, 2));
    console.log("\n📦 所有合約與錢包已部署完成，資訊已寫入 deploy.json");
}

main().catch((error) => {
    console.error("❌ 部署失敗:", error);
    process.exit(1);
});
