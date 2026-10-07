# Tasks

## 地基（schema + sync + 回填）
- [x] `server/services/db/schema.ts` 新增 `wallet_coin`/`wallet_balance_changes`/
      `tw_payout_events` 三張表 + migration
- [x] 新增 `server/services/walletSyncSource.ts`，註冊三個 SyncSource（全量快照，不裁剪）
- [x] `server/plugins/init.ts` 呼叫 `registerWalletSyncSources()`
- [x] `hfyyManage.ts` 新增 `coin` 開機回填（讀 `wallet_coin` 套用到 `Storage.get.user().coin`）

## Area A：遊戲紀錄查詢路徑
- [x] 新增 `queryArchivedRetroHistoryForUser(userId)`
- [x] `gameHistory.ts` 的 `list()` 改 async，合併記憶體+DB（records 與 balanceChanges 兩半）
- [x] `games/history.get.ts` 補 `await`

## Area B：彩池稽核查詢路徑
- [x] 新增 `queryArchivedPoolAuditEvents(...)`
- [x] `poolAudit.ts` 的 `list()` 改 async，合併記憶體+DB
- [x] `pool-audit.get.ts` 補 `await`

## Area C：F幣統計報表
- [x] 新增 `queryArchivedWalletChangesForMonth(month, source)`
- [x] `fcoin-summary.get.ts` 改 async，合併記憶體+DB，`dataNote` 更新

## Area D：台彩派彩統計報表
- [x] 新增 `queryArchivedTwPayoutsForMonth(month)`
- [x] `tw-lottery-payout.get.ts` 改 async，合併記憶體+DB，`dataNote` 更新

## 驗證
- [x] 重啟後確認 `coin` 正確回填（不再變回 100000）
- [x] 下一輪同步後確認三張新表正確寫入真實資料（實測需要等到第三輪 5 分鐘同步，前兩輪
      剛好卡在「資料還沒產生」的時間窗）
- [x] 四條查詢路徑分別驗證合併結果正確（重啟後記憶體幾乎清空的當下，四條路徑皆正確顯示
      DB 歷史資料，證實合併查詢真的在運作，不是只讀記憶體）
- [x] DB enabled/disabled 兩種設定下 `npm test` 通過
- [x] 補齊 validation.md / engineering-evidence.md
