# Engineering Evidence

## 變更摘要

- 對應變更：`migrate-wallet-and-reports-postgres`
- 變更檔案清單：
  - `server/services/db/schema.ts`（新增 `wallet_coin`/`wallet_balance_changes`/
    `tw_payout_events` 三張表）
  - `drizzle/0007_wise_bug.sql` + `drizzle/meta/`
  - `server/services/walletSyncSource.ts`（新檔，三個 SyncSource）
  - `server/services/walletReportQuery.ts`（新檔，`queryArchivedWalletChangesForUser/Month`、
    `queryArchivedTwPayoutsForMonth`）
  - `server/services/game/retro/historyReportQuery.ts`（新檔，`queryArchivedRetroHistoryForUser`）
  - `server/services/game/lottery/bg/poolAuditReportQuery.ts`（新檔，
    `queryArchivedPoolAuditEvents`）
  - `server/plugins/init.ts`（呼叫 `registerWalletSyncSources()`）
  - `server/services/admin/hfyyManage.ts`（`coin` 開機回填）
  - `server/services/admin/modules/gameHistory.ts`、`server/api/admin/games/history.get.ts`
    （Area A，改 async 合併查詢）
  - `server/services/admin/modules/poolAudit.ts`、
    `server/api/admin/bg-lottery/pool-audit.get.ts`（Area B，改 async 合併查詢）
  - `server/api/admin/reports/fcoin-summary.get.ts`（Area C，改 async 合併查詢）
  - `server/api/admin/reports/tw-lottery-payout.get.ts`（Area D，改 async 合併查詢）
- Commit 參考：（待下一輪 commit 附上）

## 驗證佐證

- 對應 `validation.md` 結論：通過
- 核心架構決策驗證：完全不觸碰 23 款遊戲裡 71 個既有 coin/balanceChanges 寫入點，透過新增
  獨立表 + 批次同步達成持久化，風險可控
- `wallet_coin`/`wallet_balance_changes`/`tw_payout_events` 三張表皆用真實背景測試流量
  （非人工模擬）驗證過同步正確性，`tw_payout_events` 的筆數與記憶體報表的 `totalCount`
  完全吻合
- `coin` 開機回填實測：重啟後正確從 DB 回填，不再退回舊痛點的 100000 預設值
- 四條查詢路徑（遊戲紀錄/彩池稽核/F幣統計/台彩派彩）皆用「重啟後記憶體幾乎清空、立刻查詢」
  的方式驗證合併查詢確實在讀 DB 歷史資料，不是只讀記憶體
- `npm test`（38 支）DB enabled/disabled 兩種設定下皆通過（2 支已知 BG flaky 測試重跑後
  皆 100% 通過）
- typecheck：新增/異動檔案無新增型別錯誤

## 封存前檢查

- [x] validation.md 已完成且結論為「通過」
- [x] 變更檔案與風險說明已整理完成
- [x] `npm run dev` 已確認正常（DB enabled/disabled 皆測試過）
- [ ] 可執行 `openspec archive` — 待使用者確認是否要一併封存全部已完成的 openspec changes
      （至此，使用者盤點的「後台功能 vs DB 持久化」清單已全數完成）
