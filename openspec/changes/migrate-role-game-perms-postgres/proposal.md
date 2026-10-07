# Proposal

## 變更名稱

`migrate-role-game-perms-postgres` — 角色遊戲權限開關（`roleGamePerms`）持久化

## 背景

`server/services/admin/modules/roleGamePerms.ts` 管理兩種開關：角色對遊戲/盤口的權限（自訂角色
可個別關閉）、全站總閘（不分角色全部關閉）。目前完全是純記憶體（`disabledByRole`/`disabledGlobally`
兩個 Map/Set），重啟即歸零。

這份資料在性質上跟 Phase 2 的 `role_defs` 幾乎相同：管理員低頻手動操作、不可接受遺失、資料量極小
（稀疏表示法，只記「被關閉」的項目）。使用者在盤點「哪些後台功能該接 DB」時，把這項列為優先建議，
已獲確認要處理。

## 目標

套用與 Phase 2 相同的 write-through 模式，讓角色遊戲權限開關跨重啟存活。

## 範圍

- 包含：
  - `role_game_perms` 表（`role_id`/`category`/`key` 複合主鍵，`role_id` FK 到 `role_defs.id`，
    `ON DELETE CASCADE`——取代現有 `clearRole()` 需要被動呼叫的模式）
  - `game_global_disabled` 表（`category`/`key` 複合主鍵）
  - `toggle()`/`toggleGlobal()` 改為 async write-through
  - 開機回填：`rehydrateFromDb()`，DB 啟用時用 DB 內容重建記憶體 Map/Set（此資料沒有「種子」概念，
    空 DB 天然對應「全部開啟」的預設狀態，不需要 Phase 2 那種「空就跑種子」的分支）
  - 2 個 API handler（`games.patch.ts`、`role-defs/[id]/games.patch.ts`）補上 `await`
- 不包含：
  - `role_defs`/`members` 既有邏輯不變
  - 其他後台功能（F幣餘額、登入紀錄等，見盤點清單）留待個別決定是否處理

## 影響面

- `server/services/db/schema.ts`（新增 2 張表）
- `server/services/admin/modules/roleGamePerms.ts`（write-through + rehydrate）
- `server/services/admin/hfyyManage.ts`（開機回填呼叫，沿用既有的 DB 初始化 try/catch）
- 2 個 API handler 補 `await`

## 風險與對策

- 風險：`clearRole()`（刪除角色時呼叫）目前是純記憶體操作，改用 DB `ON DELETE CASCADE` 後，
  若 API handler 忘記同時更新記憶體，會有記憶體/DB 不一致
- 對策：維持現有 `clearRole()` 純記憶體呼叫不變（鏡射 DB cascade 的結果），跟 Phase 2
  `clearRoleAssignments()` 處理 `members.role_id` cascade 的模式完全一致

## 驗證方式

- 切換角色遊戲權限/總閘後重啟，確認設定存活
- 刪除角色後確認對應的 `role_game_perms` 列被 cascade 刪除
- DB enabled/disabled 兩種設定下 `npm test` 皆通過

## 成功標準

- [ ] write-through + 開機回填實作完成
- [ ] 重啟後設定正確存活
- [ ] 既有測試無回歸
