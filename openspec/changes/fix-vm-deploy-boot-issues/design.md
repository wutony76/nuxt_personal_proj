# Design

## 1. 健康檢查等待時間（`deploy/gcp-vm/remote-deploy.sh`）

### 現況

```bash
health_check() {
  for _ in $(seq 1 30); do   # 30 次 × 2 秒 = 60 秒
```

### 修改

新增環境變數 `HEALTH_TIMEOUT_SECONDS`（預設 180），由它換算重試次數：

```bash
HEALTH_TIMEOUT_SECONDS="${HEALTH_TIMEOUT_SECONDS:-180}"
HEALTH_INTERVAL_SECONDS=2

health_check() {
  local attempts=$(( HEALTH_TIMEOUT_SECONDS / HEALTH_INTERVAL_SECONDS ))
  for _ in $(seq 1 "$attempts"); do
```

- **為什麼是 180 秒**：e2-micro 共享 CPU 冷啟動差異大，首次部署（剛裝完套件、burst 額度用完）實測
  106 秒，第二次部署只要 12 秒。以最壞情況 106 秒為基準留約 70% 餘裕。
- 回滾時呼叫的是同一個 `health_check`，等待時間一致。
- 沿用既有 `HEALTH_URL`、`APP_DIR` 的「環境變數 + 預設值」寫法。

## 2. 純記憶體模式的 F 幣餘額回填（`server/services/admin/hfyyManage.ts`）

### 現況

```ts
const walletRows = await getDb().select().from(walletCoinTable)
for (const row of walletRows) { ... }
```

### 修改

```ts
if (isDbEnabled()) {
  const walletRows = await getDb().select().from(walletCoinTable)
  for (const row of walletRows) { ... }
}
```

- 同一個 try 區塊內其他回填函式（`roleDefs.rehydrateOrSeed`、`sixhccdQuotaService.rehydrateFromDb`
  等 9 個）都在函式第一行 `if (!isDbEnabled()) return`，這裡是唯一直接 inline 查詢的地方，
  直接在呼叫處加 guard，不另外抽函式（變更最小）。
- 修正後純記憶體模式下 try 區塊會完整跑完，`dbInitSucceeded = true`。後面
  `if (!isDbEnabled() || !dbInitSucceeded)` 因為 `!isDbEnabled()` 為 true，NPC 自動遊玩
  仍會被開啟，行為不變。
- 連帶效果：`sixhccdQuotaService.rehydrateFromDb()` 原本因為前面拋錯而被跳過，現在會被呼叫，
  但它本身第一行就會 return，沒有實際影響。

## 3. 文件（`docs/deployment/gcp-vm.md`）

- 「日常維運」補充：e2-micro 冷啟動約 100 秒，健康檢查預設等 180 秒，可用 `HEALTH_TIMEOUT_SECONDS` 調整
- 「上線前的已知事項」補充：不接資料庫的純記憶體部署方式

## 4. 測試與驗證策略

| 項目 | 方式 |
|---|---|
| 純記憶體開機 | 本機 production build，`DATABASE_URL=` 啟動，檢查 log |
| 接 DB 無回歸 | dev server + Postgres，`npm test`（等 server 內建的啟動測試跑完再執行） |
| 部署腳本 | `bash -n` 語法檢查；實際部署到 VM，確認健康檢查通過、未回滾 |
