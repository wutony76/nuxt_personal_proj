# Tasks

> Implementation 已完成（見 validation.md / engineering-evidence.md）。

## 1. 規格與設計確認

- [x] 確認 `add-postgres-docker` 的 ORM/migration 工具選型已定案（Drizzle）
- [x] 完成 proposal 定稿（範圍/風險/驗證方式）
- [x] 完成 design 定稿（schema / write-through 架構 / 開機回填邏輯）

## 2. Schema / Migration

- [x] 建立 `role_defs` table migration（`drizzle/0000_perpetual_sage.sql`）
- [x] 建立 `members` table migration（`role_id` FK `ON DELETE SET DEFAULT 'user'`、`email` UNIQUE、
      `is_admin` 獨立欄位）

## 3. Write-through 改造

- [x] `roleDefsService`（`create`/`updateSettings`/`remove`）改為 async，寫入順序：前置檢查 → DB
      → 記憶體 mutation；另加 `rehydrateOrSeed()` 供開機回填使用
- [x] `adminAccessService`（`createMember`/`setEmail`/`setPassword`/`setRole`）改為 async，同樣順序；
      `adjustCoin` 維持不變（錢包餘額不在本次範圍，見 proposal.md）
- [x] email 唯一性：**保留** `_assertEmailAvailable()` 的記憶體前置檢查（而非移除），另外疊加 DB
      unique constraint 違反時的錯誤轉換（`_rethrowAsEmailTaken()`）作為 race condition 下的最後一道
      防線——這跟原 tasks.md 草稿的「移除」字面描述不同，是 Implementation 階段的設計調整：前置檢查
      對單一 request 內的使用者輸入仍是最快的回饋路徑，DB constraint 只在極端併發下才會真正觸發
- [x] 刪除角色改用單一 DB 操作（`DELETE FROM role_defs` 搭配 FK `ON DELETE SET DEFAULT` 自動退回
      會員角色），`clearRoleAssignments()` 改為「鏡射 DB 已經做的事」到記憶體 `memberRoleId` Map，
      而非主動驅動刪除（見 design.md 第 4 節刪除角色的交易邊界）
- [x] `roleGamePerms.clearRole(id)` 維持記憶體呼叫，在 `roleDefs.remove()` 與
      `access.clearRoleAssignments()` 之後執行（`role-defs/[id].delete.ts`）

## 4. 開機回填

- [x] `hfyyManage.ts` 的 `setStartData()` 改為：先 `roleDefs.rehydrateOrSeed()`（role_defs 須先於
      members，FK 依賴），再用 `access.hasExistingDbMembers()` 判斷 members 是否為空
- [x] 空 → 執行現有種子邏輯（write-through 自然寫回 DB）＋ `seedBootAdminsToDb()` 補寫 `Storage.init()`
      直接建立、沒走過 `createMember()` 的 2 筆種子 admin；非空 → `rehydrateFromDb()` 從 DB 查詢
      重建記憶體，完全跳過種子迴圈
- [x] 確認 `isDbEnabled()` 為 false 時，整段回填邏輯與 write-through 的 DB 步驟都略過，退回現有純記憶體行為
- [x] `Storage.init()` 簽名維持同步不變（新增 `Storage.adminInitPromise` 讓
      `server/plugins/init.ts` 在啟動序列裡 await，不影響既有 ~20 處 `this.init()` 防呆呼叫）

## 5. 驗證

- [x] 全新 DB 啟動：種子資料（4 role_defs + 27 members）正確寫入且記憶體行為與現狀一致
- [x] 重啟（DB 已有資料）：記憶體從 DB 回填、不重複跑種子、手動新增過的自訂角色仍在（實測：自訂角色
      `qa-持久化測試角色` 重啟後仍可查詢，members 維持 27 筆不變）
- [x] 刪除角色：受影響 members 正確退回 `user`（透過 FK `ON DELETE SET DEFAULT` 驗證）
- [x] 斷開 DB 連線時新增會員：API 回傳 500，記憶體不被更新（實測確認未洩漏進會員清單）
- [x] 既有 `npm test`（含 `test:roles`、`test:chat`）全數通過，確認無回歸（DB enabled/disabled 兩種
      設定皆驗證過；`test:roles`/`test:chat` 個別連續跑 3 輪均 100% 穩定通過）

## 6. 交付檢查

- [x] README（本次無新增環境變數，沿用 Phase 1 的 `.env.example`）
- [x] 補齊 Validation 文件（`openspec/templates/validation.md`）
- [x] 補齊 Engineering Evidence 文件（`openspec/templates/engineering-evidence.md`）

## 7. 後續（不在本 change 範圍，僅記錄於此供追蹤）

- [ ] 視需求開新 change：搬遷 `role_game_perms`（角色遊戲權限開關）本體到 DB
- [ ] 視需求開新 change：搬遷 `login_history` / `member_balance_change` 明細資料（需評估歸檔/分頁策略）
- [ ] 視需求開新 change：NPC 專屬欄位（`dailyMaxSpend`/`topUpAmount`/`bgWeight`）持久化
- [ ] **新發現**：後台目前沒有「刪除會員」的 API/UI，`test-roles.mjs` 每次執行都會建立一個臨時 QA
      會員且從不刪除——持久化之前這無害（重啟即消失），現在會永久留在 `members` 表。建議之後補上
      member 刪除能力，或讓測試腳本改用交易回滾/專屬清理步驟
