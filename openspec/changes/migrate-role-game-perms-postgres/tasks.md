# Tasks

> Implementation 已完成（見 validation.md / engineering-evidence.md）。

## 1. Schema / Migration

- [x] 新增 `role_game_perms`（`role_id` FK `ON DELETE CASCADE`）與 `game_global_disabled` 表
- [x] `npm run db:generate` + `npm run db:migrate`

## 2. Write-through

- [x] `toggleGlobal()`/`toggle()` 改 async，DB 啟用時先寫 DB 再更新記憶體
- [x] 新增 `rehydrateFromDb()`
- [x] `hfyyManage.ts` 呼叫 `rehydrateFromDb()`（排在 `roleDefs.rehydrateOrSeed()` 之後）
- [x] 2 個 API handler（`games.patch.ts`、`role-defs/[id]/games.patch.ts`）補 `await`

## 3. 驗證

- [x] 切換角色權限 + 全站總閘後重啟，設定正確存活
- [x] 刪除角色後 `role_game_perms` 對應列被 `ON DELETE CASCADE` 自動刪除（實測確認）
- [x] DB enabled/disabled 兩種設定下 `npm test`（38 支）皆通過

## 4. 交付檢查

- [x] 補齊 validation.md / engineering-evidence.md
