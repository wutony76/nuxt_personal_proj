## Why

總覽「權限設定」目前只顯示唯讀管理員白名單，無法在後台把帳號設成 admin 或 user。營運需要可在 UI 調整身分，不必改程式碼重部署。

## What Changes

- 管理員白名單改為 in-memory 可異動（啟動時以 `ADMIN_USER_IDS` 常數初始化；重啟回復預設）
- 新增列出全部帳號＋設定角色 API
- 總覽權限設定：左方帳號列表、右方可將選中帳號設為 Admin／User
- 防呆：不可移除最後一位 admin；不可把自己降成 user

## Capabilities

### New Capabilities

- `admin-access`: 後台帳號角色（admin／user）查詢與設定

### Modified Capabilities

（無既有 archived spec 需改；實作層替換唯讀白名單呈現）

## Impact

- `server/config/admin.ts`（改為種子預設）
- 新增 `server/services/admin/adminAccess.ts`
- `sessionController.isAdmin`、`chatService` 改讀動態白名單
- `GET/PATCH /api/admin/roles`
- `app/components/admin/AdminAccessPanel.vue`、`app/pages/admin/index.vue`、`app/services/api.ts`
- `app/pages/admin/roles.vue` 白名單區塊改接新 API 形狀（若仍顯示）
