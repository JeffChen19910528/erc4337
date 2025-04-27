const { ethers } = require("hardhat");

async function main() {
    const EntryPoint = await ethers.getContractFactory("EntryPoint");
    const entryPoint = await EntryPoint.deploy(); // 直接 deploy
    await entryPoint.waitForDeployment();         // 注意！新版Hardhat用 waitForDeployment

    console.log(`EntryPoint deployed at: ${await entryPoint.getAddress()}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
