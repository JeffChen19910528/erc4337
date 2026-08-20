# ERC-4337 Meta-Transaction 專案操作流程

## 專案結構

```
contracts/          Solidity 合約（EntryPoint / SimpleWallet / Counter）
scripts/deploy.js   部署腳本
lib/                各腳本共用的邏輯（設定、ABI、UserOperation、批次處理…）
test/                lib/ 的單元測試（Node.js 內建測試框架）

bundler.js           最小可用 bundler（HTTP 伺服器 + 定時批次送出 handleOps）
bundler-tps.js        bundler.js 的 TPS 統計版本（額外輸出 tps-log.json / .xlsx）
sendUserOp.js         送出一組交錯的 UserOperation（A/B 兩個帳戶各自 increase/decrease）
sendUserOp-tps.js      sendUserOp.js 的長時間壓力測試版本（重複送出多個區段）
checkCounter.js       查詢 Counter 數值與 EntryPoint 的 UserOpHandled 事件
fundWallet.js         幫已部署的 SimpleWallet 轉入測試用 ETH
```

`lib/` 底下的模組職責：

| 模組 | 用途 |
| --- | --- |
| `lib/config.js` | 集中管理 RPC_URL、PORT、私鑰等可設定項目（可用 `.env` 覆寫） |
| `lib/abi.js` | 共用的合約 ABI 片段 |
| `lib/deployInfo.js` | 讀取並驗證 `deploy.json` |
| `lib/userOperation.js` | 建立 / 簽章 / 雜湊 UserOperation，轉換成 `handleOps` 所需格式 |
| `lib/bundlerClient.js` | 呼叫 bundler 的 `eth_sendUserOperation` |
| `lib/batchProcessor.js` | 依 `maxFeePerGas` 排序、解析單筆 UserOperation 供 log 顯示 |
| `lib/bundlerServer.js` | bundler 核心邏輯（收件、批次送出），`bundler.js` 與 `bundler-tps.js` 共用 |
| `lib/tpsTracker.js` | 固定時間窗內的 TPS 統計 |
| `lib/txActions.js` | `sendUserOp.js` / `sendUserOp-tps.js` 共用的 A/B 帳戶交錯動作與 callData 建構 |

## 安裝與部署步驟

1. 安裝依賴
   ```bash
   npm install
   ```

2. （選用）複製 `.env.example` 為 `.env` 並依需求調整
   ```bash
   cp .env.example .env
   ```

3. 啟動本地節點（開啟 Hardhat Network）
   ```bash
   npx hardhat node
   ```

4. 編譯合約
   ```bash
   npx hardhat compile
   ```

5. 部署合約至本地網路
   ```bash
   npx hardhat run scripts/deploy.js --network localhost
   ```

6. 啟動 Bundler
   ```bash
   node bundler.js
   # 或使用會額外輸出 TPS 統計（tps-log.json / tps-log.xlsx）的版本
   node bundler-tps.js
   ```

7. 為錢包地址添加資金
   ```bash
   node fundWallet.js
   ```

8. 傳送 UserOperation（模擬交易）
   ```bash
   node sendUserOp.js
   # 或長時間、多區段的壓力測試版本
   node sendUserOp-tps.js
   ```

9. 檢查 Counter 狀態
   ```bash
   node checkCounter.js
   ```

---

## 測試

`lib/` 內與網路無關的核心邏輯（UserOperation 建立/簽章/雜湊、批次排序與解析、TPS 統計、deploy.json 驗證、A/B 帳戶動作設定）皆有對應的單元測試，使用 Node.js 內建的 `node:test`：

```bash
npm test
```

---

## 驗證 SimpleWallet 的擁有者

1. 進入 Hardhat Console：
   ```bash
   npx hardhat console --network localhost
   ```

2. 查詢 SimpleWallet 擁有者地址：
   ```js
   const wallet = await ethers.getContractAt("SimpleWallet", "0x你部署的SimpleWallet地址");
   await wallet.owner();
   ```

---

> 💡 請確認你部署的 `SimpleWallet` 地址是否正確，並與 `deploy.json` 中記錄的一致。
