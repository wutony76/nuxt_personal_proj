# Tasks

> 本清單為 Implementation 階段的規劃草稿，**本次不執行**。待使用者明確要求後才會開始勾選/實作。
> 依賴 `add-postgres-docker`（Phase 1）的連線層與 ORM/migration 選型先定案、落地。

## 1. 規格與設計確認

- [ ] 確認 `add-postgres-docker` 的 ORM/migration 工具選型已定案
- [ ] 完成 proposal 定稿（範圍/風險/驗證方式）
- [ ] 完成 design 定稿（schema / write-through 架構 / 開機回填邏輯）

## 2. Schema / Migration

- [ ] 建立 `role_defs` table migration
- [ ] 建立 `members` table migration（`role_id` FK `ON DELETE SET DEFAULT 'user'`、`email` UNIQUE、
      `is_admin` 獨立欄位）

## 3. Write-through 改造

- [ ] `roleDefsService`（`create`/`updateSettings`/`remove`）改為 async，寫入順序：前置檢查 → DB
      transaction → 記憶體 mutation
- [ ] `adminAccessService`（`createMember`/`setEmail`/`setPassword`/`setRole`/`adjustCoin` 等）改為
      async，同樣順序
- [ ] email 唯一性檢查改用 DB unique constraint 錯誤轉換，移除 `_assertEmailAvailable()` 的全表掃描
- [ ] 刪除角色改用單一 transaction（`DELETE FROM role_defs` 搭配 FK `ON DELETE SET DEFAULT` 自動退回
      會員角色），移除手動呼叫 `clearRoleAssignments()`
- [ ] `roleGamePerms.clearRole(id)` 維持記憶體呼叫，確認放在 DB transaction commit 成功之後執行

## 4. 開機回填

- [ ] `hfyyManage.ts` 的 `setStartData()` 改為：`COUNT(*)` 判斷 `role_defs`/`members` 是否為空
- [ ] 空 → 執行現有種子邏輯並寫回 DB；非空 → 從 DB 查詢重建記憶體 Map/Set/Record，不跑種子
- [ ] 確認 `isDbEnabled()` 為 false 時，整段回填邏輯與 write-through 的 DB 步驟都略過，退回現有純記憶體行為

## 5. 驗證

- [ ] 全新 DB 啟動：種子資料正確寫入且記憶體行為與現狀一致
- [ ] 重啟（DB 已有資料）：記憶體從 DB 回填、不重複跑種子、手動新增過的角色/會員仍在
- [ ] 刪除角色：受影響 members 正確退回 `user`，transaction 原子性驗證（刻意製造中途失敗）
- [ ] 斷開 DB 連線時新增會員：API 回傳錯誤，記憶體不被更新
- [ ] 既有 `npm test`（含 `test:roles`）全數通過，確認無回歸

## 6. 交付檢查

- [ ] README 補充（若開機流程有新增環境變數需求）
- [ ] 補齊 Validation 文件（`openspec/templates/validation.md`）
- [ ] 補齊 Engineering Evidence 文件（`openspec/templates/engineering-evidence.md`）

## 7. 後續（不在本 change 範圍，僅記錄於此供追蹤）

- [ ] 視需求開新 change：搬遷 `role_game_perms`（角色遊戲權限開關）本體到 DB
- [ ] 視需求開新 change：搬遷 `login_history` / `member_balance_change` 明細資料（需評估歸檔/分頁策略）
- [ ] 視需求開新 change：NPC 專屬欄位（`dailyMaxSpend`/`topUpAmount`/`bgWeight`）持久化
