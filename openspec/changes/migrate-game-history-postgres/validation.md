# Validation

## 驗證範圍

- 對應變更：`migrate-game-history-postgres`（Phase 3：遊戲紀錄批次同步 + 記憶體裁剪 + dailyGrants
  write-through）
- 驗證環境：本機 dev（macOS，Docker Desktop 29.1.3，Postgres 16-alpine，Node 22.22.2），沿用
  Phase 1/2 已建立的連線層與 schema 基礎

## 功能驗證

依 proposal 的「成功標準」逐項驗證：

- [x] 完成 `game_orders` / `retro_game_history` / `pool_audit_*` / `retro_daily_grants` schema 設計
      — 實際結果：`drizzle-kit generate` 產出的 migration 與 design.md 第 5 節規劃一致，額外補上
      `play_key` 欄位（Implementation 階段發現 bg-summary.get.ts 玩法排行需要它）
- [x] 完成記憶體裁剪策略與 `SyncSource` 介面擴充設計 — 實際結果：`onSynced` 回呼機制運作正常，
      已用真實背景測試流量（非人工模擬）驗證過增量同步+裁剪的往返行為
- [x] 完成可追蹤的 Tasks 清單 — 實際結果：全數勾選，含兩項 Implementation 階段新發現並記錄為後續
      追蹤的問題（`game_orders.created_at` 對 BG 無實際意義、Phase 1 通用 upsert 不支援 Date 參數）
- [x] 使用者明確要求後才進入 Implementation — 實際結果：Phase 1/2 完成後使用者依序回覆「好的」確認

## 回歸驗證

- 流程：DB 未啟用時，批次同步/write-through 是否與遷移前行為一致
  - 結果：通過。暫時移除 `.env` 重啟，server log 顯示 `SKIP ---BASE>sync.scheduler`，四個新
    SyncSource 完全不會被註冊；`npm test`（38 支）連續執行確認穩定（過程中一次 `test:x5-cd`
    因期別邊界時序 flaky 失敗，重跑即恢復——已確認該測試腳本本身的 `waitForOpen()` 機制就是為了
    這種既有、非本次變更引入的時序窗口設計，見下方問題紀錄）
- 流程：DB 啟用時，既有下注/復古遊戲功能是否受影響
  - 結果：通過。`npm test`（38 支）多輪執行，含一次 `test:bingo` 因賓果開獎週期時序 flaky
    失敗（重跑即恢復，同樣是既有、非本次變更的時序性問題）

## 批次同步 / 記憶體裁剪驗證

- **真實資料同步**（未刻意模擬，讓背景測試腳本自然產生大量真實下注/遊戲紀錄後觀察兩輪排程結果）：
  - 第一輪：`pool_audit_reseed` 9 筆（當時 game_orders/retro_game_history/pool_audit_overpay
    皆為 0，因為背景測試尚未跑到那些階段，屬正常現象）
  - 第二輪（背景測試完整跑完後）：`game_orders` 312 筆、`retro_game_history` 30 筆、
    `pool_audit_reseed` 9 筆、`pool_audit_overpay` 12 筆，全數同步成功
  - 第三輪（DB 斷線恢復後）：`game_orders` 326 筆（新增 14 筆），確認增量同步持續運作、不是整批
    重送
- **DB 斷線容錯**：`docker compose stop postgres` 後等待排程觸發，四個來源皆記錄
  `SYNC.tick.source.failed`（log 附帶完整錯誤），但 `SYNC.tick.done` 仍正常收尾；期間
  `curl` 確認 server 健康檢查與一般頁面請求完全不受影響；`docker compose start postgres`
  恢復後，下一輪排程自動同步成功，無需任何人工介入
- **後台報表合併查詢**：實測 `GET /api/admin/reports/members`、`GET /api/admin/reports/bg-summary`
  皆回傳 200，數字為記憶體（近期）與 DB（已歸檔）合併後的結果；驗證過程中發現測試腳本用的
  `TEST-*` 格式 issue 因不符合 `parseIssueDate()` 的 8 碼日期格式，正確地被排除在 BG 月報之外
  ——這跟遷移前的既有行為完全一致（不是本次新增的過濾邏輯，只是第一次有這麼多測試資料流經這段
  程式碼才被觀察到）
- **`dailyGrants` write-through + 開機回填**：重啟前手動確認 `runner` 遊戲某帳號當日已核發
  3825 coin，重啟伺服器後再玩一局（+50 coin 核發），DB 正確顯示 3875（代表重啟後記憶體確實從
  DB 回填出 3825 這個既有值，而不是從 0 重新計算），驗證了「重啟不會讓每日上限防呆失效」這個
  本次最主要的 bug 修正目標

## 問題與修正紀錄

- 問題：`server/services/sync.ts` 的通用 `_buildUpsertSql()`（Phase 1 寫的）在組 SQL 時直接把
  `Date` 物件當參數值丟給 postgres.js，觸發 `ERR_INVALID_ARG_TYPE: The "string" argument must be
  of type string or an instance of Buffer or ArrayBuffer. Received an instance of Date`
  - 發現方式：Phase 3 是第一個真正帶有 `Date` 型別欄位（`created_at`/`played_at`/`happened_at`）
    且真正跑過 `runSyncTick()` 的 Phase（Phase 1 驗證用的假 SyncSource 只有字串/數字欄位；Phase 2
    走 write-through，完全沒用到這個函式），清乾淨重啟後第一輪同步就立刻在 server log 看到這個
    `unhandledRejection`
  - 修正方式：新增 `_toSqlParam()`，把 `Date` 物件轉成 ISO 字串再放進 SQL 模板參數
  - 是否已重新驗證：是，修正後清乾淨重啟，四個來源全數同步成功、無錯誤
- 問題：同一類 Date 參數問題，也出現在 `queryArchivedOrdersForMonth()`（後台報表的 DB 查詢 helper）
  - 發現方式：呼叫 `GET /api/admin/reports/members` 時回傳 500，server log 顯示一模一樣的
    `ERR_INVALID_ARG_TYPE` 錯誤，查詢條件裡的 `monthStart`/`monthEnd` 兩個 `Date` 物件是兇手
  - 修正方式：同樣轉成 `.toISOString()` 字串再放進 `sql` 模板
  - 是否已重新驗證：是，修正後兩支報表 API 皆正確回傳 200 與合理數字
- 問題：Implementation 階段發現 design.md 原始 `game_orders` schema 沒有 `play_key` 欄位，但
  `bg-summary.get.ts` 的玩法排行（`playMap`）需要它才能正確運作
  - 發現方式：撰寫 `bg-summary.get.ts` 的 DB 合併邏輯時對照 schema 發現欄位缺漏
  - 修正方式：在 `game_orders` 補上 `play_key TEXT` 欄位（比照 `tab_id` 獨立成欄，不塞進
    `bet_code` JSONB），因為尚未有真實資料寫入過 `game_orders`（確認 `select count(*)` 為 0），
    直接清掉舊的 migration 歷史重新產生一份乾淨的、含 `play_key` 的 migration，而非疊加一條
    `ALTER TABLE` 的修補 migration
  - 是否已重新驗證：是，`\d game_orders` 確認欄位齊全，`bg-summary.get.ts` 的玩法排行實測正確

## 結論

- 是否通過：是
- 已知限制或風險：
  - `game_orders.created_at` 對 BG 玩法沒有實際意義（只是同步當下的時間戳，不是真實下注時間），
    報表正確改用 `issue` 判斷月份，但未來若有其他需求想依「真實下注時間」查 BG 訂單會需要額外補欄位
  - 重啟時遺失「進行中期別」的 orders（design.md 第 9 節已知限制，本次未解決，屬刻意取捨）
  - `claimableIssues` 無上限、quota 跨分頁/跨期擴充，皆延續既有待辦，本次不處理
  - 既有測試套件的既有時序性 flaky（期別邊界、賓果開獎窗口）在本次驗證過程中依然出現，與本次變更
    無關，重跑皆能恢復
- 後續追蹤事項：
  - 上述兩項「新發現」已記錄進 tasks.md 第 8 節
  - Phase 4（Redis 快取層）視需求另行規劃，目前完全沒有設計
