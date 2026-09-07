## 1. Server：角色清單服務

- [x] 1.1 新增 `roleDefsService`（種子 Admin/User/NPC，`list`／`exists`／`create`，防呆撞名／撞 `admin` id）
- [x] 1.2 `adminAccessService`：`UserRole` 改 `string`，新增 `memberRoleId`，`_toAdminUser`／`setRole`／`createMember` 改吃動態角色
- [x] 1.3 `HFYYManage` 掛上 `roleDefs`
- [x] 1.4 新增 `GET/POST /api/admin/role-defs`；`PATCH /api/admin/roles/:id`、`POST /api/admin/members` 角色驗證改查角色清單

## 2. Frontend

- [x] 2.1 `api.ts`：`UserRole` 放寬、新增 `RoleDef` 型別與 `roleDefs`／`createRoleDef`
- [x] 2.2 新增 `useRoleDefs()` composable（單例快取，比照 `useAdminAuth`）
- [x] 2.3 `AccessPanel.vue`：按鈕改角色下拉，防呆條件廣義化
- [x] 2.4 `CreateMember.vue`：新增表單角色下拉改吃動態清單，角色顯示改查清單
- [x] 2.5 新增 `RoleList.vue`（左列表／右「資訊、新增」分頁）
- [x] 2.6 `roles.vue` 改版：移除唯讀白名單表格，新增「管理員」「角色列表」兩區塊
- [x] 2.7 `index.vue`：「權限設定」按鈕文案與說明文字更新

## 3. 驗證

- [x] 3.1 API 手動測試：`GET/POST role-defs`、`PATCH roles/:id` 設 NPC、無效角色拒絕、自我降權拒絕
- [ ] 3.2 瀏覽器手動測試：`/admin/roles` 角色下拉切換、新增角色即時出現在下拉、`設定角色` 按鈕導向 `/admin#ao-perms`
