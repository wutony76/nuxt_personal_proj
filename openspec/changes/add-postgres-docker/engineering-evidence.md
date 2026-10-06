# Engineering Evidence

## 變更摘要

- 對應變更：`add-postgres-docker`（Phase 1：Docker Compose + 連線層 + 通用批次同步機制地基）
- 變更檔案清單：
  - `docker-compose.yml`（新增）
  - `.env.example`（新增）
  - `server/services/db.ts`（新增：連線 pool singleton、`isDbEnabled()`、`ping()`）
  - `server/services/sync.ts`（新增：`SyncScheduler`、`SyncSource` 介面、`registerSyncSource()`、
    `runSyncTick()`）
  - `server/plugins/init.ts`（調整：`isDbEnabled()` 為 true 時啟動 `ping()` + `SyncScheduler`，否則
    維持純記憶體模式）
  - `package.json` / `package-lock.json`（新增依賴：`drizzle-orm`、`postgres`、`drizzle-kit`）
  - `README.md`（新增「選用：接上 PostgreSQL（Docker）」章節）
  - `openspec/changes/add-postgres-docker/tasks.md`（勾選完成項目）
- Commit / PR 參考：（本次對話尚未 commit，待下一輪 commit 時附上 commit hash）

## 驗證佐證

- 對應 `validation.md` 結論：通過
- 佐證附件（本次驗證用的輔助腳本皆為暫時性、驗證後已刪除，未留在 repo；以下為驗證當下的實際輸出摘錄）：
  - `docker compose ps` 顯示 `nuxt_personal_proj-postgres-1` 狀態為 `Up ... (healthy)`
  - server log：`SUCCESS ---BASE>db.ping`、`SUCCESS ---BASE>sync.scheduler.start`、
    `SYNC.tick.done sources=0 rows=0 durationMs=0`（Phase 1 註冊表為空，符合預期）
  - server log（DB 未啟用情境）：`SKIP ---BASE>sync.scheduler（DATABASE_URL 未設定，維持純記憶體模式）`
  - `npm test` 兩種設定（DB enabled / disabled）各自跑出 38/38 全過的穩定結果
  - Volume 持久化測試：`docker compose down` → `up -d` 後，手動寫入的測試資料列完整保留
  - Upsert 冪等性測試：假 `SyncSource` 連跑 3 輪同步，目標 table 恆為 2 筆、值正確更新為最新快照

## 風險與後續追蹤

- 已知風險：
  - 「DB 連線中斷導致同步失敗」的實際容錯行為，因 Phase 1 無真實 `SyncSource` 而未能完整實測，留待
    Phase 2/3 真正接上資料來源時一併驗證
  - 既有測試套件存在與本次變更無關的低機率時序性 flaky（詳見 validation.md 問題紀錄），已確認重跑可
    穩定通過，但建議日後有餘力時另行追查根因
- 後續追蹤事項（Open Questions 延伸）：
  - Phase 2：`migrate-members-roledefs-postgres`（members/role-defs write-through + 開機回填）—
    design/tasks 已規劃完成，待使用者明確要求後進入 Implementation
  - Phase 3：`migrate-game-history-postgres`（遊戲紀錄/配額批次同步 + 記憶體裁剪）— design/tasks 已
    規劃完成，待使用者明確要求後進入 Implementation
  - Phase 4（視需求）：Redis 快取層，尚無任何設計

## 封存前檢查

- [x] validation.md 已完成且結論為「通過」
- [x] 變更檔案與風險說明已整理完成
- [x] `npm run dev` 已確認正常（兩種 DB 設定皆驗證過）
- [ ] 可執行 `openspec archive` — 暫緩：Phase 2/3 仍會持續擴充 `add-postgres-docker` 定義的
      `SyncSource`/`isDbEnabled()` 介面，待三個 Phase 全部完成後再一併封存，避免中途封存導致後續
      Phase 的 design.md 找不到對應的「進行中」變更可參照
