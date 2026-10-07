# Validation

- 對應變更：`migrate-login-history-postgres`（登入紀錄批次同步，全量快照模式）
- 日期：2026-10-07

## 實作內容確認

- `server/services/db/schema.ts` 新增 `login_history` 表（`id`/`user_id`/`email`/`ip`/
  `user_agent`/`created_at`，`(user_id, created_at)` 索引），migration
  `drizzle/0003_flaky_skrulls.sql` 已產生並套用成功
- `server/services/loginHistory.ts` 新增 `snapshotAll()`（攤平 `byUser` Map 成陣列），不改動
  既有 `record()`/`list()` 行為
- 新增 `server/services/loginHistorySyncSource.ts`，`registerLoginHistorySyncSource()` 比照
  `retro_game_history`/`pool_audit_*` 的全量快照模式，不裁剪記憶體
- `server/plugins/init.ts` 的 `if (isDbEnabled())` 區塊內註冊，跟其餘三個 Phase 3 來源並列

## 批次同步驗證（真實登入流量）

- 乾淨重啟 dev server（DB 已啟用），開機當下第一輪同步（立即執行）`login_history` 為 0 筆
  （當下記憶體還沒有任何登入紀錄）
- 以 curl 呼叫 `/api/login`（admin 帳號）產生一筆真實登入紀錄，並確認背景測試腳本開機時
  自動呼叫 `/api/login` 已額外產生 21 筆（共 22 筆，user-agent 分別為 `node`/`curl/8.7.1`）
- 等待下一輪排程（5 分鐘間隔），server log 出現
  `SYNC.tick.source.success table=login_history rows=22`
- 直接查詢 Postgres `SELECT * FROM login_history`，確認 22 筆資料正確落地，欄位對應
  （`id`/`user_id`/`email`/`ip`/`user_agent`/`created_at`）皆正確，時間戳與登入當下一致

## DB enabled/disabled 迴歸驗證

- **DB disabled**（暫時移除 `.env`，重啟）：server log 顯示
  `SKIP ---BASE>sync.scheduler（DATABASE_URL 未設定，維持純記憶體模式）`，`/api/login` 正常回
  200、登入流程不受影響（`loginHistoryService.record()` 本身就是純記憶體操作，跟 DB 無關）
- **DB enabled**（還原 `.env`，重啟）：乾淨開機無錯誤，`SUCCESS ---BASE>sync.scheduler.start`
- 完整 `npm test`（38 支腳本）：通過 35 支，失敗 3 支（`test:6hc-cd`/`test:bg`/`test:bingo`），
  個別重跑後三支皆 100% 通過——確認是既有已知的 BG/Bingo 期別邊界時序 flakiness（詳見
  `migrate-game-history-postgres` 等既有 validation.md 的記錄），與本次變更無關

## 已知限制（延續 design.md 的決策）

- 不做開機回填：重啟後記憶體清空，管理員查詢畫面要等累積到新登入事件才會再顯示資料，DB 裡的
  歷史資料只作為永久備份，不影響任何業務邏輯（比照 `retro_game_history` 既有 precedent）
- `npc` 自動登入（若有）與測試腳本背景登入都會一併被同步進 DB（跟現有記憶體行為一致，本來
  就沒有區分真人/測試帳號）

## 成功標準檢核

- [x] SyncSource 實作完成並驗證（22 筆真實資料同步成功）
- [x] 既有測試無回歸（3 支已知 flaky 測試重跑後皆通過）
