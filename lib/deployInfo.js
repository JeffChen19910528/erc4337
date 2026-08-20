const fs = require("fs");

/**
 * 讀取 `scripts/deploy.js` 產生的 deploy.json，並確認必要欄位存在。
 * @param {string} filePath deploy.json 路徑，預設為當前工作目錄下的 deploy.json
 */
function loadDeployInfo(filePath = "./deploy.json") {
    const raw = fs.readFileSync(filePath, "utf8");
    const info = JSON.parse(raw);

    if (!info.entryPoint || !info.counter) {
        throw new Error(`deploy.json 缺少必要欄位 (entryPoint/counter): ${filePath}`);
    }

    return info;
}

module.exports = { loadDeployInfo };
