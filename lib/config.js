require("dotenv").config();

// 集中管理所有可設定項目，避免各腳本各自寫死相同的值。
// 每個值都可透過 .env 覆寫，未設定時則沿用原本程式碼中的預設值，行為不變。
const RPC_URL = process.env.RPC_URL || "http://localhost:8545";
const BUNDLER_PORT = Number(process.env.BUNDLER_PORT || 3000);
const BUNDLER_URL = process.env.BUNDLER_URL || `http://localhost:${BUNDLER_PORT}/`;
const BUNDLER_PRIVATE_KEY =
    process.env.BUNDLER_PRIVATE_KEY ||
    "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";
const BATCH_INTERVAL_MS = Number(process.env.BATCH_INTERVAL_MS || 3000);
const DEPLOY_JSON_PATH = process.env.DEPLOY_JSON_PATH || "./deploy.json";

module.exports = {
    RPC_URL,
    BUNDLER_PORT,
    BUNDLER_URL,
    BUNDLER_PRIVATE_KEY,
    BATCH_INTERVAL_MS,
    DEPLOY_JSON_PATH,
};
