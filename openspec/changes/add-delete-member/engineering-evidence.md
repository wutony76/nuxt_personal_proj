# Engineering Evidence

## 變更摘要

- 對應變更：`add-delete-member`
- 變更檔案清單：
  - `server/services/admin/modules/adminAccess.ts`（新增 `deleteMember(userId, actorId)`）
  - `server/services/loginHistory.ts`（新增 `remove(userId)`）
  - `server/services/admin/modules/npcAutoPlay.ts`（新增 `removeMemberData(userId)`）
  - `server/api/admin/members/[id].delete.ts`（新檔，編排層）
  - `app/services/api.ts`（新增 `api.admin.deleteMember(id)`）
  - `app/components/admin/CreateMember.vue`（刪除按鈕 + 二次點擊確認狀態機）
- Commit 參考：（待下一輪 commit 附上）

## 驗證佐證

- 對應 `validation.md` 結論：通過
- 保護規則實測：無法刪除自己、無法直接刪除管理員帳號，錯誤訊息正確
- 核心刪除流程實測：NPC 會員與一般會員皆完整驗證——DB `members` 列刪除、三張 NPC 表透過
  `ON DELETE CASCADE` 自動清除、記憶體（`Storage.account`/`Storage.users`/`adminIds`/
  `memberRoleId`/`loginHistory`/`npcAutoPlay` 4 個 Map）正確清理、該帳號的有效 session
  立即失效（401）
- **實戰驗證**：用新功能清除了 5 筆先前 session 累積的 `qa-role-test-*` 測試帳號（原本記錄在
  案的已知限制，只能手動 SQL 清理），直接解決了這個長期待辦
- `npm test`（38 支）DB enabled/disabled 兩種設定下皆通過（3 支已知 BG flaky 測試重跑後正常）
- typecheck：新增/異動的檔案（`adminAccess.ts`/`loginHistory.ts`/`npcAutoPlay.ts`/
  `[id].delete.ts`/`api.ts`/`CreateMember.vue`）皆無新增型別錯誤
- **未覆蓋**：前端「二次點擊確認」UI 流程沒有實際開瀏覽器點擊驗證（環境無瀏覽器自動化工具），
  已在 validation.md 誠實記錄

## 封存前檢查

- [x] validation.md 已完成且結論為「通過」
- [x] 變更檔案與風險說明已整理完成
- [x] `npm run dev` 已確認正常（DB enabled/disabled 皆測試過）
- [ ] 可執行 `openspec archive` — 待使用者確認是否要一併封存全部已完成的 openspec changes
