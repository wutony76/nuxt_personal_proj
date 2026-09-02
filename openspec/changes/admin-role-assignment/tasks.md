## 1. Server：動態白名單

- [x] 1.1 新增 `adminAccessService`（種子自 `ADMIN_USER_IDS`，`isAdmin`／`listUsers`／`setRole`＋防呆）
- [x] 1.2 `sessionController.isAdmin`、`chatService` 改走 `adminAccessService.isAdmin`
- [x] 1.3 更新 `GET /api/admin/roles` 回傳全部帳號＋role；新增 `PATCH /api/admin/roles/:id`

## 2. Frontend

- [x] 2.1 `api.ts` 型別與 `listRoles`／`setRole` 
- [x] 2.2 新增 `AdminAccessPanel.vue`（左列表／右設定）並接到總覽
- [x] 2.3 更新 `roles.vue` 白名單顯示以相容新 API（若仍使用）

## 3. 驗證

- [ ] 3.1 手動：提升／降權、自我降權失敗、最後一位 admin 降權失敗
