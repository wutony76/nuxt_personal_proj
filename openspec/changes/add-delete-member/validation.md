# Validation

- 對應變更：`add-delete-member`（補齊刪除會員功能）
- 日期：2026-10-07

## 實作內容確認

- `adminAccessService.deleteMember(userId, actorId)`：write-through delete（`members` 表，
  既有 `ON DELETE CASCADE` 自動清 `npc_member_settings`/`npc_member_games`/`npc_daily_spent`）
  + 記憶體清理（`Storage.account`/`Storage.users`/`adminIds`/`memberRoleId`）+ session 失效
- `loginHistoryService.remove(userId)`、`npcAutoPlayService.removeMemberData(userId)`：純記憶體
  清理
- 新增 `server/api/admin/members/[id].delete.ts`，依序編排上述三個呼叫
- `app/services/api.ts` 新增 `api.admin.deleteMember(id)`
- `CreateMember.vue` 加刪除按鈕，比照 `RoleList.vue` 的二次點擊確認模式
  （`confirmingId`/`removingId` 狀態機）

## 保護規則實測（真實 API 呼叫）

- `DELETE /api/admin/members/U0xA000001`（刪除自己，操作者正是 admin 本人）→ 400「不可刪除
  自己的帳號。」
- `DELETE /api/admin/members/U0xA666666`（直接刪除另一位管理員帳號）→ 400「不可直接刪除管理員
  帳號，請先降級為一般角色再刪除。」

## 核心刪除流程實測（真實 API 呼叫 + 真實資料）

- **NPC 會員**（既有測試遺留帳號 `U0XA0C21016C43`/CamilaMadelyn）：
  1. 刪除前先登入該帳號取得一個有效 session，確認 `GET /api/admin/me` 回 200
     （`isAdmin:false`，一般會員 session 正常）
  2. admin 呼叫 `DELETE /api/admin/members/U0XA0C21016C43` → `{ ok: true }`
  3. 用步驟 1 的 session cookie 再打一次 `GET /api/admin/me` → **401「登入已過期」**，確認
     session 立即失效
  4. `GET /api/admin/roles` 的會員清單不再包含此帳號
  5. 直接查詢 Postgres：`members`/`npc_member_settings`/`npc_member_games`/`npc_daily_spent`
     四張表皆無此 `user_id` 的任何列——CASCADE 正確運作
  6. `GET /api/admin/members/U0XA0C21016C43/balance-changes` → 404「找不到該帳號」，確認
     `memberBalanceHistoryService` 的既有存在性檢查對已刪除帳號正確運作
- **一般會員**（`role:'user'`，新建立的 `delTestUser`）：建立→查詢 DB 確認存在→刪除→查詢 DB
  確認 `members` 列消失，流程與 NPC 會員一致
- **既有已知限制的實戰驗證**：專案裡先前測試遺留、文件記錄為「需要手動 SQL 清理」的 5 筆
  `qa-role-test-*@test.cc` 帳號，這次直接用新功能的 API 逐一刪除，全部清乾淨
  （`SELECT count(*) FROM members WHERE email LIKE 'qa-%'` 歸零）——這是本次新增功能對既有
  已知限制的直接實戰解決，不只是理論驗證

## DB enabled/disabled 迴歸驗證

- **DB disabled**（暫時移除 `.env`，重啟）：建立+刪除測試會員流程正常運作，純記憶體模式不受
  影響
- **DB enabled**（還原 `.env`，重啟）：乾淨開機無錯誤
- 完整 `npm test`（38 支腳本）：通過 35 支，失敗 3 支（`test:6hc-of`/`test:bg`/`test:bingo`），
  個別重跑後三支皆 100% 通過——確認是既有已知的 BG 期別邊界時序 flakiness，與本次變更無關

## 未覆蓋項目（誠實揭露）

本次沒有實際開瀏覽器點擊「刪除會員」按鈕走一次 UI 流程——這個環境沒有瀏覽器自動化工具可用。
已驗證的是：① API 層的完整行為（`CreateMember.vue` 呼叫的就是這支 API，前端沒有額外的業務
邏輯，純粹是「二次點擊確認」的狀態機包裝）、② typecheck 通過（確認 Vue 元件的 TypeScript 型別
正確）。UI 的二次點擊確認狀態機文字/樣式本身是複製 `RoleList.vue` 已經在生產環境驗證過的既有
pattern，風險較低，但「畫面上點兩次按鈕」這個操作本身沒有人工或自動化驗證過。

## 已知限制（延續 design.md 的決策）

- `game_orders`/`retro_game_history`/`retro_daily_grants`/`login_history`/
  `chat_schedules.created_by` 的 DB 列不會被清除，刪除會員後變成孤兒資料（刻意決策，見
  design.md 第 2 節）
- 23 款彩種/30 款復古遊戲的記憶體歷史紀錄（`OrdersClass`/`RetroHistoryClass`）、
  `toys/pool.ts`/`toys/whistleCandy.ts`/`chatService.ts` 的小型 per-user Map 不會被清除
  （純粹殘留，不影響功能）
- 不支援批次刪除

## 成功標準檢核

- [x] `DELETE /api/admin/members/[id]` 完成並通過上述驗證
- [x] 既有測試無回歸（3 支已知 flaky 測試重跑後皆通過）
