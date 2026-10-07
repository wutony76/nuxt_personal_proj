# Engineering Evidence

## 變更摘要

- 對應變更：`migrate-login-history-postgres`
- 變更檔案清單：
  - `server/services/db/schema.ts`（新增 `login_history` 表）
  - `drizzle/0003_flaky_skrulls.sql` + `drizzle/meta/`
  - `server/services/loginHistory.ts`（新增 `snapshotAll()`，不改動既有 `record()`/`list()`）
  - `server/services/loginHistorySyncSource.ts`（新增，全量快照 SyncSource）
  - `server/plugins/init.ts`（註冊 `registerLoginHistorySyncSource()`）
- Commit 參考：（待下一輪 commit 附上）

## 驗證佐證

- 對應 `validation.md` 結論：通過
- 批次同步實測：真實登入流量（curl + 背景測試腳本）產生 22 筆記錄，下一輪排程同步後
  Postgres `login_history` 表正確落地 22 筆，欄位對應正確
- DB enabled/disabled 兩種設定下登入流程皆正常（登入本身跟 DB 無關，純記憶體操作）
- `npm test`（38 支）：35 支一次通過，3 支已知 flaky 測試（`6hc-cd`/`bg`/`bingo`）重跑後皆通過，
  確認與本次變更無關

## 封存前檢查

- [x] validation.md 已完成且結論為「通過」
- [x] 變更檔案與風險說明已整理完成
- [x] `npm run dev` 已確認正常（DB enabled/disabled 皆測試過）
- [ ] 可執行 `openspec archive` — 待使用者確認盤點清單其餘項目是否要繼續處理
