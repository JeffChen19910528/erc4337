const { RPC_URL, BUNDLER_PORT, BUNDLER_PRIVATE_KEY, BATCH_INTERVAL_MS, DEPLOY_JSON_PATH } = require("./lib/config");
const { loadDeployInfo } = require("./lib/deployInfo");
const { createBundler } = require("./lib/bundlerServer");

const deployInfo = loadDeployInfo(DEPLOY_JSON_PATH);
console.log("🛠️ Bundler 啟動中，使用 EntryPoint 地址:", deployInfo.entryPoint);

const bundler = createBundler({
    rpcUrl: RPC_URL,
    port: BUNDLER_PORT,
    privateKey: BUNDLER_PRIVATE_KEY,
    entryPointAddress: deployInfo.entryPoint,
    counterAddress: deployInfo.counter,
    batchIntervalMs: BATCH_INTERVAL_MS,
});

bundler.start();
