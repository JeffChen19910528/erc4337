const { ethers } = require("ethers");

const { RPC_URL, BUNDLER_URL, DEPLOY_JSON_PATH } = require("./lib/config");
const { loadDeployInfo } = require("./lib/deployInfo");
const { DEFAULT_ACTIONS, buildWalletMap, buildCallData } = require("./lib/txActions");
const { buildUserOp, signUserOp } = require("./lib/userOperation");
const { sendUserOperation } = require("./lib/bundlerClient");

const SEGMENT_DURATION_MS = 2 * 60 * 1000;
const ROUND_PAUSE_MS = 3000;
const SEGMENT_COUNT = 10;

async function sendSegment(actions, walletMap, walletCallData, entryPointAddress) {
    const nonceMap = {};
    for (const name of Object.keys(walletMap)) {
        nonceMap[name] = await walletMap[name].contract.nonce();
    }

    const start = Date.now();
    let counter = 0;
    while (Date.now() - start < SEGMENT_DURATION_MS) {
        for (const { wallet: walletName, action, fee } of actions) {
            const { signer, walletAddress } = walletMap[walletName];

            const nonce = nonceMap[walletName];
            nonceMap[walletName] = nonce + 1n;

            const userOp = buildUserOp({
                sender: walletAddress,
                nonce,
                callData: walletCallData[action],
                maxFeePerGas: fee,
            });
            await signUserOp(userOp, signer);

            await sendUserOperation(userOp, entryPointAddress, BUNDLER_URL, counter++);
        }

        // === 每組交易送出後暫停一段時間
        await new Promise(resolve => setTimeout(resolve, ROUND_PAUSE_MS));
    }
}

async function main() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);

    const deployInfo = loadDeployInfo(DEPLOY_JSON_PATH);
    const { entryPoint: ENTRY_POINT_ADDRESS, counter: COUNTER_ADDRESS, wallets } = deployInfo;

    const walletCallData = buildCallData(COUNTER_ADDRESS);
    const walletMap = buildWalletMap(wallets, provider);

    for (let i = 1; i <= SEGMENT_COUNT; i++) {
        console.log(`\n🔁 開始第 ${i} 區段的送出`);
        await sendSegment(DEFAULT_ACTIONS, walletMap, walletCallData, ENTRY_POINT_ADDRESS);
    }
}

main().catch(console.error);
