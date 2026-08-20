const fs = require("fs");
const ExcelJS = require("exceljs");

const { RPC_URL, BUNDLER_PORT, BUNDLER_PRIVATE_KEY, BATCH_INTERVAL_MS, DEPLOY_JSON_PATH } = require("./lib/config");
const { loadDeployInfo } = require("./lib/deployInfo");
const { createBundler } = require("./lib/bundlerServer");
const { TpsTracker } = require("./lib/tpsTracker");

const JSON_LOG = "./tps-log.json";
const EXCEL_LOG = "./tps-log.xlsx";
const TPS_WINDOW_MS = 2 * 60 * 1000;

const workbook = new ExcelJS.Workbook();
const worksheet = workbook.addWorksheet("TPS Log");
worksheet.columns = [
    { header: "Interval", key: "interval", width: 10 },
    { header: "Timestamp", key: "timestamp", width: 25 },
    { header: "UserOpsProcessed", key: "userOpsProcessed", width: 20 },
    { header: "TPS", key: "tps", width: 10 },
    { header: "TotalUserOpsProcessed", key: "totalUserOpsProcessed", width: 25 },
];

const deployInfo = loadDeployInfo(DEPLOY_JSON_PATH);
console.log("🛠️ Bundler 啟動中，使用 EntryPoint 地址:", deployInfo.entryPoint);

const tracker = new TpsTracker({ intervalMs: TPS_WINDOW_MS });

const bundler = createBundler({
    rpcUrl: RPC_URL,
    port: BUNDLER_PORT,
    privateKey: BUNDLER_PRIVATE_KEY,
    entryPointAddress: deployInfo.entryPoint,
    counterAddress: deployInfo.counter,
    batchIntervalMs: BATCH_INTERVAL_MS,
    onBatchProcessed: count => tracker.recordProcessed(count),
});

// === 每兩分鐘記錄一次 JSON / Excel
setInterval(() => {
    const entry = tracker.tick();
    if (!entry) return;

    fs.writeFileSync(
        JSON_LOG,
        JSON.stringify(tracker.logs, (_k, v) => (typeof v === "bigint" ? v.toString() : v), 2)
    );

    worksheet.addRow(entry);
    workbook.xlsx
        .writeFile(EXCEL_LOG)
        .then(() => console.log(`📄 Excel 檔已更新: ${EXCEL_LOG}`))
        .catch(err => console.error("寫入 Excel 時發生錯誤:", err));

    console.log(
        `📈 Interval #${entry.interval}：共 ${entry.userOpsProcessed} 筆，TPS: ${entry.tps}，累計總量: ${entry.totalUserOpsProcessed}`
    );
}, 1000);

bundler.start();
