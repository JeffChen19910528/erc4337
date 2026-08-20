const { ethers } = require("ethers");

const { RPC_URL, BUNDLER_URL, DEPLOY_JSON_PATH } = require("./lib/config");
const { loadDeployInfo } = require("./lib/deployInfo");
const { DEFAULT_ACTIONS, buildWalletMap, buildCallData } = require("./lib/txActions");
const { buildUserOp, signUserOp } = require("./lib/userOperation");
const { sendUserOperation } = require("./lib/bundlerClient");

async function main() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);

    const deployInfo = loadDeployInfo(DEPLOY_JSON_PATH);
    const { entryPoint: ENTRY_POINT_ADDRESS, counter: COUNTER_ADDRESS, wallets } = deployInfo;

    if (!wallets || wallets.length === 0) {
        console.error("❌ deploy.json 中未找到任何 wallets");
        return;
    }

    const walletCallData = buildCallData(COUNTER_ADDRESS);
    const walletMap = buildWalletMap(wallets, provider);

    // 預抓每個 wallet 的 nonce 起點
    const nonceMap = {};
    for (const name of Object.keys(walletMap)) {
        nonceMap[name] = await walletMap[name].contract.nonce();
    }

    for (let i = 0; i < DEFAULT_ACTIONS.length; i++) {
        const { wallet: walletName, action, fee } = DEFAULT_ACTIONS[i];
        const { signer, walletAddress } = walletMap[walletName];

        const nonce = nonceMap[walletName];
        nonceMap[walletName] = nonce + 1n; // 遞增

        const userOp = buildUserOp({
            sender: walletAddress,
            nonce,
            callData: walletCallData[action],
            maxFeePerGas: fee,
        });
        await signUserOp(userOp, signer);

        console.log(`📤 傳送 UserOp #${i + 1} | ${walletName} | ${action} | fee=${fee / 1e9} gwei`);
        await sendUserOperation(userOp, ENTRY_POINT_ADDRESS, BUNDLER_URL, i + 1);
    }

    console.log("✅ 所有交錯 UserOperations 已送出");
}

main().catch(console.error);
