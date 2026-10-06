# Engineering Evidence

## 變更摘要

- 對應變更：`migrate-game-history-postgres`（Phase 3：遊戲紀錄批次同步 + 記憶體裁剪 +
  dailyGrants write-through）
- 變更檔案清單：
  - `server/services/db/schema.ts`（新增 `gameOrders`/`retroGameHistory`/`poolAuditReseed`/
    `poolAuditOverpay`/`retroDailyGrants` 五張表）
  - `drizzle/0001_wild_spyke.sql` + `drizzle/meta/`（新增 migration）
  - `server/services/sync.ts`（`SyncSource` 介面新增可選 `onSynced`；修正 `_buildUpsertSql()`
    不支援 `Date` 參數的 bug）
  - `server/services/game/lottery/ordersSyncSource.ts`（新增：`game_orders` 增量同步 + 裁剪）
  - `server/services/game/retro/historySyncSource.ts`（新增：`retro_game_history` 全量快照）
  - `server/services/game/lottery/bg/poolAuditSyncSource.ts`（新增：`pool_audit_*` 全量快照）
  - `server/services/game/lottery/gameOrdersReportQuery.ts`（新增：後台報表的 DB 歸檔資料查詢 helper）
  - `server/services/game/retro/history.ts`（`dailyGrant()` 改 async write-through，新增
    `rehydrateTodayDailyGrantsFromDb()`）
  - `server/services/game/retro/base.ts`（`actions.record`/`settleReward` 改 async）
  - `server/services/admin/modules/npcAutoPlay.ts`（NPC 背景遊玩改 fire-and-forget + catch；
    `testPlayAll()` 改 async）
  - `server/plugins/init.ts`（註冊三個新 SyncSource + dailyGrants 開機回填，皆僅 `isDbEnabled()` 時執行）
  - `server/api/admin/reports/members.get.ts`、`bg-summary.get.ts`（合併記憶體 + DB 查詢）
  - `server/api/admin/npc/members/[userId]/test-play.post.ts`（補 `await`）
  - 30 支 `server/api/games/retro/*/history.post.ts`（批次補上 `await`，結構機械化一致）
  - `openspec/changes/migrate-game-history-postgres/tasks.md`（勾選完成項目）
- Commit / PR 參考：（本次對話尚未 commit，待下一輪 commit 時附上 commit hash）

## 驗證佐證

- 對應 `validation.md` 結論：通過
- 佐證附件（驗證用輔助腳本/請求皆為暫時性，驗證後已清理，未留在 repo；以下為實際輸出摘錄）：
  - 真實背景測試流量下的同步結果：`game_orders` 312→326 筆、`retro_game_history` 30 筆、
    `pool_audit_reseed` 9 筆、`pool_audit_overpay` 12 筆
  - 兩處 Date 參數 bug 的錯誤訊息與修正後重新驗證通過的紀錄
  - DB 斷線：四個來源皆記錄 `SYNC.tick.source.failed` 但主流程不受影響，恢復後下一輪自動同步成功
  - 後台報表合併查詢：`members.get.ts`/`bg-summary.get.ts` 實測回傳 200 與合理數字
  - `dailyGrants` 重啟回填：重啟前 3825 → 重啟後 +50 局 → 3875（確認從回填值累加，非歸零重算）
  - `npm test`（38 支）多輪執行，DB enabled/disabled 兩種設定皆驗證過

## 風險與後續追蹤

- 已知風險：
  - 重啟遺失進行中期別的 orders（design.md 已知限制，刻意取捨，非本次解決範圍）
  - `game_orders.created_at` 對 BG 玩法無實際意義，只是同步時間戳（見 validation.md）
  - `claimableIssues` 無上限、quota 跨分頁/跨期擴充，延續既有待辦
- 後續追蹤事項（Open Questions 延伸）：
  - Phase 4（Redis 快取層）視需求另行規劃
  - 視需求：補上 BG `OrderRow` 的真實下注時間戳欄位（目前只有 TW 有）
  - 視需求：`claimableIssues` 上限/清理機制、quota P2 擴充

## 封存前檢查

- [x] validation.md 已完成且結論為「通過」
- [x] 變更檔案與風險說明已整理完成
- [x] `npm run dev` 已確認正常（DB enabled/disabled 兩種設定皆驗證過，含 DB 斷線容錯）
- [ ] 可執行 `openspec archive` — 本次是目前規劃的最後一個 Phase（Phase 4 僅視需求、尚無設計），
      待使用者確認三個 Phase（`add-postgres-docker`/`migrate-members-roledefs-postgres`/
      `migrate-game-history-postgres`）都可以封存後再一併執行
