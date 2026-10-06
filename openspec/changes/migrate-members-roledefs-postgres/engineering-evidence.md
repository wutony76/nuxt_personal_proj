# Engineering Evidence

## 變更摘要

- 對應變更：`migrate-members-roledefs-postgres`（Phase 2：members/role-defs write-through + 開機回填）
- 變更檔案清單：
  - `server/services/db/schema.ts`（新增：Drizzle schema，`roleDefs`/`members` 兩張表）
  - `drizzle.config.ts`（新增：drizzle-kit 設定）
  - `drizzle/0000_perpetual_sage.sql` + `drizzle/meta/`（新增：migration 檔案）
  - `server/services/db.ts`（調整：`getDb()` 改用帶 schema 的 typed drizzle instance）
  - `server/services/admin/modules/roleDefs.ts`（改寫：`create`/`remove`/`updateSettings` 改 async
    write-through，新增 `rehydrateOrSeed()`）
  - `server/services/admin/modules/adminAccess.ts`（改寫：`createMember`/`setPassword`/`setEmail`/
    `setRole` 改 async write-through，新增 `hasExistingDbMembers()`/`seedBootAdminsToDb()`/
    `rehydrateFromDb()`）
  - `server/services/admin/modules/npcAutoPlay.ts`（調整：`autoCreateMember()` 改 async）
  - `server/services/admin/hfyyManage.ts`（改寫：`init()`/`setStartData()` 改 async，整合開機回填判斷）
  - `server/services/storage.ts`（調整：新增 `Storage.adminInitPromise`，`Storage.init()` 簽名不變）
  - `server/plugins/init.ts`（調整：改為 async plugin，`await Storage.adminInitPromise`）
  - `server/api/admin/members.post.ts`、`members/[id].patch.ts`、`role-defs.post.ts`、
    `role-defs/[id].delete.ts`、`role-defs/[id]/settings.patch.ts`、`roles/[id].patch.ts`、
    `npc/members/auto-create.post.ts`（調整：呼叫改 async service 方法處補上 `await`）
  - `package.json`（新增 `db:generate`/`db:migrate` script）
  - `openspec/changes/migrate-members-roledefs-postgres/tasks.md`（勾選完成項目）
- Commit / PR 參考：（本次對話尚未 commit，待下一輪 commit 時附上 commit hash）

## 驗證佐證

- 對應 `validation.md` 結論：通過
- 佐證附件（驗證用的輔助腳本/請求皆為暫時性，驗證後已清理，未留在 repo；以下為驗證當下的實際輸出摘錄）：
  - `drizzle-kit generate` 產出的 SQL 與 design.md schema 規劃完全一致（FK/UNIQUE/`ON DELETE SET
    DEFAULT` 皆正確）
  - 全新 DB 種子：`role_defs` 4 筆、`members` 27 筆，含修正 `seedBootAdminsToDb()` primary key
    衝突 bug 前後的對照（見 validation.md 問題紀錄）
  - 既有資料回填：自訂角色跨重啟存活、members 數量維持 27（未重複種子）
  - 刪除角色：`role_defs` 筆數從 5 正確降回 4
  - DB 斷線：`POST /api/admin/members` 回傳 500，記憶體未被污染（`leaked = false`）
  - `npm test`（38 支）：DB enabled/disabled 兩種設定下皆驗證過；`test:roles`/`test:chat` 各自連續
    3 輪 100% 穩定通過

## 風險與後續追蹤

- 已知風險：
  - `test-roles.mjs` 的臨時 QA 會員沒有清理機制，會在 `members` 表持續累積（見 validation.md）
  - DB 層錯誤目前直接把原始訊息透傳給前端（dev 模式），正式環境建議另外包一層錯誤訊息轉換
  - 既有測試套件既有的低機率時序性 flaky 尚未解決根因（與本次變更無關，Phase 1 驗證時已發現同一問題）
- 後續追蹤事項（Open Questions 延伸）：
  - Phase 3：`migrate-game-history-postgres`（遊戲紀錄/配額批次同步 + 記憶體裁剪）— design/tasks 已
    規劃完成，待使用者明確要求後進入 Implementation
  - 視需求：後台補上「刪除會員」能力，或讓 `test-roles.mjs` 改用可清理的測試資料策略
  - 視需求：`role_game_perms`、`login_history`、`member_balance_change`、NPC 專屬欄位的持久化
    （皆已在 proposal.md 明確排除在本次範圍外）

## 封存前檢查

- [x] validation.md 已完成且結論為「通過」
- [x] 變更檔案與風險說明已整理完成
- [x] `npm run dev` 已確認正常（DB enabled/disabled 兩種設定皆驗證過）
- [ ] 可執行 `openspec archive` — 暫緩：Phase 3 仍在規劃階段，且 `add-postgres-docker` 本身也尚未
      封存（見該 change 的 engineering-evidence.md），待三個 Phase 全部完成後再一併封存
