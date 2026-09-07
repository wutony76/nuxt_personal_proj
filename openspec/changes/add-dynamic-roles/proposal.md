## Why

`/admin/roles` 目前只是唯讀說明頁（白名單表格 + 權限判斷流程 + 登入導向說明），角色本身寫死在
`UserRole = 'admin' | 'user'` 二元型別裡，實際只是 `adminIds` 白名單的有無。營運需要一個真正的
「角色權限」管理頁：角色清單要能新增（先加 NPC，之後陸續會有更多用途角色），會員角色指派要能在
三個以上角色間切換，版面比照既有「會員管理」左列表右操作 pattern。

## What Changes

- 角色從寫死二選一改成真正可擴充的角色清單（種子：Admin／User／NPC），新增 `role-defs` 查詢／新增 API
- 會員角色指派（`AdminAccessPanel`）從「設為 Admin／User」兩顆按鈕改成角色下拉，選項來自角色清單
- `/admin/roles` 頁新增「管理員」（會員角色指派）與「角色列表」（角色清單＋新增角色）兩個區塊，取代原本唯讀白名單表格
- 新增會員（`AdminCreateMember`）角色欄位改吃動態角色清單，可直接建立 NPC 帳號
- 安全設計：新增的自訂角色一律不授予後台權限，只有內建 `admin` id 才會加入 `adminIds`

## Capabilities

### New Capabilities

- `role-defs`: 角色清單查詢與新增（Admin／User／NPC 種子 + 自訂角色）

### Modified Capabilities

- `admin-access`（見 `openspec/changes/admin-role-assignment/specs/admin-access/spec.md`）：角色型別由
  `'admin' | 'user'` 放寬為角色 id 字串，`setRole` 改為驗證角色 id 是否存在於 `role-defs`

## Impact

- 新增 `server/services/admin/modules/roleDefs.ts`、`server/api/admin/role-defs.get.ts`、`server/api/admin/role-defs.post.ts`
- `server/services/admin/modules/adminAccess.ts`：`UserRole` 型別、`memberRoleId` 儲存非 admin 角色、`setRole`／`createMember` 改吃動態角色
- `server/services/admin/hfyyManage.ts`、`server/api/admin/roles/[id].patch.ts`、`server/api/admin/members.post.ts`
- 新增 `app/composables/useRoleDefs.ts`、`app/components/admin/RoleList.vue`
- `app/components/admin/AccessPanel.vue`、`app/components/admin/CreateMember.vue`、`app/pages/admin/roles.vue`、`app/pages/admin/index.vue`、`app/services/api.ts`

## Out of Scope

- NPC 自動遊玩／自動下注引擎（獨立 proposal）
- 報表把 NPC 下注/獎金分列統計
- 角色重新命名／刪除
