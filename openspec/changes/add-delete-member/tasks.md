# Tasks

- [x] `adminAccessService.deleteMember(userId, actorId)`：write-through delete + 記憶體清理
      + session 失效
- [x] `loginHistoryService.remove(userId)`
- [x] `npcAutoPlayService.removeMemberData(userId)`
- [x] 新增 `server/api/admin/members/[id].delete.ts`，編排上述三個呼叫
- [x] `app/services/api.ts` 新增 `api.admin.deleteMember(id)`
- [x] `CreateMember.vue` 加刪除按鈕，比照 `RoleList.vue` 的二次點擊確認模式
- [x] 驗證：刪除一般會員，DB `members` 列消失、記憶體清乾淨
- [x] 驗證：刪除 NPC 會員，`npc_member_settings`/`npc_member_games`/`npc_daily_spent`
      透過 CASCADE 自動清除
- [x] 驗證：刪除後該會員的 session 立即失效（下一次請求被拒絕）
- [x] 驗證：無法刪除自己、無法直接刪除管理員帳號（正確的錯誤訊息）
- [x] 驗證：真實清理掉 5 筆先前測試遺留的 `qa-role-test-*` 帳號（既有已知限制的實戰驗證）
- [ ] 驗證：前台瀏覽器實測二次點擊確認 UX（已走完 API 層，未另外開瀏覽器點擊驗證）
- [x] DB enabled/disabled 兩種設定下 `npm test` 通過
- [x] 補齊 validation.md / engineering-evidence.md
