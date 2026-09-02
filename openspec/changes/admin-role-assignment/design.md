## Context

既有 `ADMIN_USER_IDS` 為程式碼常數，`requireAdmin`／管理者發言皆依此判斷。後台設定多為 in-memory，重啟回復預設。

## Goals / Non-Goals

**Goals:**

- 後台可將任一既有帳號設為 admin 或 user
- 左列表／右設定的雙欄 UI
- 動態白名單供 `isAdmin` 與聊天室 `asAdmin` 使用

**Non-Goals:**

- 不持久化到檔案／DB（重啟回種子常數）
- 不做細部權限分級（仍只有 admin／user）
- 不新增／刪除帳號

## Decisions

### 1. 動態白名單服務 `adminAccessService`

- 啟動以 `ADMIN_USER_IDS` 複製進 `Set`
- `isAdmin(id)`、`listUsers()`、`setRole(id, role, actorId)`
- 替代各處直接讀常數陣列

### 2. 防呆

- 禁止把「目前唯一的 admin」降成 user
- 禁止操作者把自己降成 user（避免鎖死當前 session）

### 3. UI

- 左：全部帳號列表（顯示名稱、role tag），點選
- 右：選中帳號詳情＋ Admin／User 切換

## Risks / Trade-offs

- [Risk] 重啟後角色回復種子 → 與後台其餘 in-memory 設定一致，文案標明
- [Risk] 誤降唯一 admin → API／UI 雙重擋

## Open Questions

- （無）
