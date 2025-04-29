const hre = require("hardhat");
const fs = require("fs");

async function main() {
    const [deployer] = await hre.ethers.getSigners();

    const EntryPoint = await hre.ethers.getContractFactory("MinimalEntryPoint");
    const entryPoint = await EntryPoint.deploy();
    await entryPoint.waitForDeployment();

    const Counter = await hre.ethers.getContractFactory("Counter");
    const counter = await Counter.deploy();
    await counter.waitForDeployment();

    const SimpleWallet = await hre.ethers.getContractFactory("SimpleWallet");
    const wallet = await SimpleWallet.deploy(deployer.address, await entryPoint.getAddress());
    await wallet.waitForDeployment();

    const obj = {
        entryPoint: await entryPoint.getAddress(),
        counter: await counter.getAddress(),
        wallet: await wallet.getAddress()
    };

    fs.writeFileSync("deploy.json", JSON.stringify(obj, null, 2));
    console.log("✅ Contracts deployed:", obj);
}

main().catch(console.error);
