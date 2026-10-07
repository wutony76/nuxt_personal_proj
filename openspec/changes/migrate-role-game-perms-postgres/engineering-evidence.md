# Engineering Evidence

## 變更摘要

- 對應變更：`migrate-role-game-perms-postgres`
- 變更檔案清單：
  - `server/services/db/schema.ts`（新增 `role_game_perms`/`game_global_disabled` 表）
  - `drizzle/0002_concerned_norman_osborn.sql` + `drizzle/meta/`
  - `server/services/admin/modules/roleGamePerms.ts`（`toggle`/`toggleGlobal` 改 async
    write-through，新增 `rehydrateFromDb()`）
  - `server/services/admin/hfyyManage.ts`（呼叫 `rehydrateFromDb()`）
  - `server/api/admin/games.patch.ts`、`server/api/admin/role-defs/[id]/games.patch.ts`（補 `await`）
- Commit 參考：（待下一輪 commit 附上）

## 驗證佐證

- 對應 `validation.md` 結論：通過
- write-through 實測：DB 正確寫入角色權限與全站總閘各 1 筆
- 開機回填實測：重啟後兩項設定正確從 DB 回填
- cascade 刪除實測：刪除角色後 `role_game_perms` 筆數歸零
- `npm test`（38 支）DB enabled/disabled 兩種設定下皆通過

## 封存前檢查

- [x] validation.md 已完成且結論為「通過」
- [x] 變更檔案與風險說明已整理完成
- [x] `npm run dev` 已確認正常
- [ ] 可執行 `openspec archive` — 待使用者確認盤點清單其餘項目是否要繼續處理
