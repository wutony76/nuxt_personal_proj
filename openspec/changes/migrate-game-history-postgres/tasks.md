# Tasks

> Implementation 已完成（見 validation.md / engineering-evidence.md）。

## 1. 規格與設計確認

- [x] 確認 Phase 1 ORM/migration 工具選型已定案（Drizzle）
- [x] 完成 proposal 定稿（範圍/風險/驗證方式）
- [x] 完成 design 定稿（schema / 記憶體保留策略 / SyncSource 介面擴充）

## 2. Schema / Migration

- [x] 建立 `game_orders` table migration（含 `idx_game_orders_game_issue`、`idx_game_orders_user_month`、
      另加 `play_key` 欄位——design.md 原始 schema 沒列，Implementation 階段發現 bg-summary.get.ts
      的玩法排行需要它才補上）
- [x] 建立 `retro_game_history` table migration
- [x] 建立 `pool_audit_reseed` / `pool_audit_overpay` table migration
- [x] 建立 `retro_daily_grants` table migration（複合主鍵 upsert）

## 3. SyncSource 介面擴充與實作

- [x] 擴充 `server/services/sync.ts` 的 `SyncSource` 介面，新增可選 `onSynced(rows)` 回呼
- [x] 實作 `game_orders` 的 `SyncSource`（`server/services/game/lottery/ordersSyncSource.ts`）：
      `snapshot()` 用「issue 字串排序後取最後 2 個視為保護」排除目前期+前一期，`onSynced()` 裁剪
      已同步的 issue
- [x] 實作 `retro_game_history` 的 `SyncSource`（`historySyncSource.ts`）：全量快照（沿用 Phase 2
      模式，不需要 `onSynced`）
- [x] 實作 `pool_audit_reseed` / `pool_audit_overpay` 的 `SyncSource`（`poolAuditSyncSource.ts`，全量快照）
- [x] 將以上三個來源註冊進 `SyncScheduler` 的註冊表（`server/plugins/init.ts`，僅 `isDbEnabled()` 時註冊）

## 4. `retro_daily_grants` write-through + 開機回填

- [x] `retroGames.history` 的 `add.dailyGrant()` 改為 async：DB 啟用時用 `ON CONFLICT DO UPDATE SET
      amount = amount + $delta` 原子遞增，寫入成功後用 DB 回傳的最新值更新記憶體（避免併發下記憶體用
      本地計算值互相覆蓋）
- [x] server 啟動時從 DB 回填當天（`todayKey`）的 `dailyGrants` 到記憶體
      （`rehydrateTodayDailyGrantsFromDb()`）
- [x] 確認 `isDbEnabled()` 為 false 時，開機回填與 write-through 的 DB 步驟都略過，退回現有純記憶體行為
- [x] **範圍擴充**：`RETRO_GAME_BASE.actions.record()`/`settleReward()` 因此改為 async，連帶需要
      30 支 `server/api/games/retro/*/history.post.ts` 補上 `await`；`npcAutoPlay.ts` 的 NPC 背景
      自動遊玩改用 fire-and-forget + `.catch()`（不適合把整條 300ms tick 迴圈都改 async），
      `testPlayAll()`（後台「測試執行」功能）改為 async 並正確 await

## 5. 後台報表讀取路徑調整

- [x] `members.get.ts` 改為合併查詢記憶體（近期）+ DB（已歸檔），回應格式不變
- [x] `bg-summary.get.ts` 比照調整，額外抽出共用的 `accumulate()` 函式讓記憶體/DB 兩個迴圈共用同一套
      分桶邏輯（避免邏輯重複兩份）
- [x] 確認合併查詢在記憶體/DB 邊界的月份有正確覆蓋：BG 用 issue 前綴（`parseIssueDate`，跟記憶體路徑
      同一套函式）、TW 用 `created_at` 區間，兩者用 game_key 類別交叉驗證避免「BG 資料的同步時間戳
      巧合落在 TW 查詢區間」誤判

## 6. 驗證

- [x] 等待真實 SyncScheduler 週期觸發（未刻意跨越單一 BG 期別，而是讓背景測試自然產生大量真實期別/
      訂單後觀察）：確認 `game_orders` 正確同步（326 筆）、`retro_game_history`（30 筆）、
      `pool_audit_reseed`/`overpay`（9/12 筆）
- [x] 後台報表合併查詢：實測 `members.get.ts`/`bg-summary.get.ts` 回傳 200，BG/TW 數字為記憶體+DB
      合併結果，數字量級合理（test 腳本用的 `TEST-*` issue 因不符合 `parseIssueDate` 格式，正確被
      排除在 BG 月報之外，跟遷移前的既有行為一致）
- [x] 重啟後 `dailyGrants` 正確回填：重啟前 `runner` 遊戲某帳號 amount=3825，重啟後再玩一局 +50，
      DB 正確變成 3875（從回填值繼續累加，不是從 0 重新計算）
- [x] DB 斷線一輪：手動 `docker compose stop postgres`，等到排程觸發，4 個來源皆記錄
      `SYNC.tick.source.failed`，但 tick 仍完整跑完（`SYNC.tick.done`），server 與下注流程不受影響；
      `docker compose start postgres` 後下一輪自動恢復成功，無需人工介入
- [x] 既有 `npm test`（38 支，含 `test:bg`、`test:games`）全數通過，確認無回歸（DB enabled/disabled
      兩種設定皆驗證過）

## 7. 交付檢查

- [x] 補齊 Validation 文件（`openspec/templates/validation.md`）
- [x] 補齊 Engineering Evidence 文件（`openspec/templates/engineering-evidence.md`）

## 8. 後續（不在本 change 範圍，僅記錄於此供追蹤）

- [ ] 視需求開新 change：補上 `claimableIssues`（23 處）的上限/清理機制
- [ ] 視需求開新 change：quota P2 遺留待辦（跨分頁/跨期/全站配額規則擴充）
- [ ] 視需求開新 change（Phase 4）：評估是否疊加 Redis 做高頻計數器快取
- [ ] **新發現**：`game_orders.created_at` 對 BG 玩法沒有實際意義（BG `OrderRow` 本身沒有時間戳，
      snapshot 時只能填同步當下的時間），報表月份判斷正確地改用 `issue` 字串而非這個欄位，但若未來有
      其他需求想用「真實下注時間」查 BG 訂單，需要先幫 BG 的 `OrderRow` 補上 `createdAt` 欄位（比照
      TW 已有的做法）
- [ ] **新發現**：`server/services/sync.ts` 的通用 `_buildUpsertSql()`（Phase 1 寫的）原本不會正確
      處理 `Date` 物件參數（postgres.js 在這種組 SQL 的方式下無法編碼 Date，會丟
      `ERR_INVALID_ARG_TYPE`），本次 Implementation 過程中發現並修正（統一轉 ISO 字串）；Phase 1/2
      當時沒有測資料到讓這個問題現形（Phase 1 驗證用的欄位都是字串/數字，Phase 2 走 write-through
      沒有用到這個函式）
