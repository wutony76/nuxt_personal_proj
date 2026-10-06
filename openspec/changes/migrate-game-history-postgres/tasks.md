# Tasks

> 本清單為 Implementation 階段的規劃草稿，**本次不執行**。待使用者明確要求後才會開始勾選/實作。
> 依賴 `add-postgres-docker`（Phase 1 連線層/ORM）與 `migrate-members-roledefs-postgres`（Phase 2，
> 若要參考 write-through 模式）先定案、落地。

## 1. 規格與設計確認

- [ ] 確認 Phase 1 ORM/migration 工具選型已定案
- [ ] 完成 proposal 定稿（範圍/風險/驗證方式）
- [ ] 完成 design 定稿（schema / 記憶體保留策略 / SyncSource 介面擴充）

## 2. Schema / Migration

- [ ] 建立 `game_orders` table migration（含 `idx_game_orders_game_issue`、`idx_game_orders_user_month`）
- [ ] 建立 `retro_game_history` table migration
- [ ] 建立 `pool_audit_reseed` / `pool_audit_overpay` table migration
- [ ] 建立 `retro_daily_grants` table migration（複合主鍵 upsert）

## 3. SyncSource 介面擴充與實作

- [ ] 擴充 `server/services/sync.ts` 的 `SyncSource` 介面，新增可選 `onSynced(rows)` 回呼
- [ ] 實作 `game_orders` 的 `SyncSource`：`snapshot()` 排除「目前期 + 前一期」，`onSynced()` 裁剪已同步
      的 issue
- [ ] 實作 `retro_game_history` 的 `SyncSource`：全量快照（沿用 Phase 2 模式，不需要 `onSynced`）
- [ ] 實作 `pool_audit_reseed` / `pool_audit_overpay` 的 `SyncSource`（全量快照）
- [ ] 將以上三個來源註冊進 `SyncScheduler` 的註冊表

## 4. `retro_daily_grants` write-through + 開機回填

- [ ] `retroGames.history` 的 `add.dailyGrant()` 改為 async，寫入順序：DB upsert → 記憶體累加
- [ ] server 啟動時從 DB 回填當天（`todayKey`）的 `dailyGrants` 到記憶體
- [ ] 確認 `DATABASE_URL` 未設定時，整段邏輯略過，退回現有純記憶體行為

## 5. 後台報表讀取路徑調整

- [ ] `members.get.ts` 改為合併查詢記憶體（近期）+ DB（已歸檔），回應格式不變
- [ ] `bg-summary.get.ts` 比照調整
- [ ] 確認合併查詢在記憶體/DB 邊界的月份有正確覆蓋，不重複計算、不漏算

## 6. 驗證

- [ ] 跨越一個 BG 期別後，上一期資料正確寫入 DB 且從記憶體移除
- [ ] 裁剪前後，同一份報表查詢結果一致
- [ ] 重啟後 `dailyGrants` 正確回填，無法重複領取當日上限
- [ ] DB 斷線一輪：下注流程不受影響，僅同步失敗記 log
- [ ] 既有 `npm test`（含 `test:bg`、`test:games`）全數通過，確認無回歸

## 7. 交付檢查

- [ ] 補齊 Validation 文件（`openspec/templates/validation.md`）
- [ ] 補齊 Engineering Evidence 文件（`openspec/templates/engineering-evidence.md`）

## 8. 後續（不在本 change 範圍，僅記錄於此供追蹤）

- [ ] 視需求開新 change：補上 `claimableIssues`（23 處）的上限/清理機制
- [ ] 視需求開新 change：quota P2 遺留待辦（跨分頁/跨期/全站配額規則擴充）
- [ ] 視需求開新 change（Phase 4）：評估是否疊加 Redis 做高頻計數器快取
