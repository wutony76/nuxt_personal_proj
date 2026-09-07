## Context

`admin-role-assignment` change 已建立 `adminAccessService`（`adminIds` 白名單 + admin/user 二元角色）與
`AdminAccessPanel` 雙欄 UI。這次要把角色本身變成可擴充清單，同時不能破壞既有的 admin 權限判斷與防呆邏輯。

## Goals / Non-Goals

**Goals:**

- 角色清單可查詢／新增，種子固定為 Admin／User／NPC
- 會員角色指派可在任意角色間切換（不再限二選一）
- `/admin/roles` 頁面成為角色管理的入口（會員角色指派 + 角色清單）

**Non-Goals:**

- 不做角色重新命名／刪除
- 不做角色對應的細部權限（除了 `admin` id，其餘角色權限一律等同 user）
- 不做 NPC 自動下注／報表分列（後續 change）
- 不持久化到檔案／DB（沿用既有 in-memory、重啟回種子的慣例）

## Decisions

### 1. 角色清單服務 `roleDefsService`（新模組，不併入 `adminAccessService`）

- module-level `Map<string, RoleDef>`，種子 `admin`/`user`/`npc`（`builtin:true`）
- `list()`／`exists(id)`／`create({name})`：name 轉 slug id，撞名或撞 `'admin'` id 拒絕
- 獨立成模組是因為「角色清單」與「帳號↔角色指派」是兩種不同的資料生命週期，比照
  `memberBalanceHistoryService` 與 `adminAccessService` 平行掛在 `HFYYManage` 底下的既有分層方式

### 2. 安全邊界：自訂角色永遠不是 admin

- `roleDefsService.create()` 回傳的角色一律 `builtin:false`
- `adminAccessService.setRole()` 只認字面 `'admin'` id 才會 `adminIds.add()`；其餘角色一律進
  `memberRoleId` 這個「非 admin 角色」映射，`isAdmin()` 判斷完全不受影響
- 好處：後台操作者新增角色（例如打錯字、之後要開放更多分類）不會意外產生後台權限漏洞

### 3. `UserRole` 型別從聯集改成 `string`

- 前後端 `UserRole` 型別皆放寬為角色 id 字串；既有 `=== 'admin'` 比較維持不變（admin 判斷本來就是特例），
  原本的 `=== 'user'` 比較全部廣義化為 `!== 'admin'`（「是不是離開 admin」而非「是不是特定的 user」）

### 4. UI：沿用既有雙欄 pattern，兩個面板共用同一份角色清單

- `AdminAccessPanel` 的「設為 Admin/User」兩顆按鈕改成一個 `<select>`，選項來自 `useRoleDefs()`
- 新增 `useRoleDefs()` composable（比照 `useAdminAuth.ts` 的單例 reactive 模式），`AccessPanel`／
  `CreateMember`／新的 `RoleList` 三個元件共用同一份快取，新增角色後呼叫 `refresh()` 讓另外兩個面板
  的下拉即時看到新角色，不用整頁重新整理
- `/admin/roles` 新增「管理員」「角色列表」兩區塊；`/admin` 總覽頁既有的「權限設定」面板不搬移，
  只更新按鈕文案與說明文字，避免破壞既有導覽路徑

## Risks / Trade-offs

- [Risk] 角色清單同樣是 in-memory，重啟後自訂角色消失、已指派該角色的會員角色顯示回退為
  `memberRoleId` 記錄的 id（若該 id 不在種子清單內，前端 `roleLabel` 退回顯示原始 id 字串）——
  跟現有「重啟回種子預設」慣例一致，文案已標明
- [Risk] `_slug()` 用簡單正規化＋隨機尾碼避免碰撞，非人類可讀性最佳化，但符合「角色 id 只需穩定、
  不需美觀」的目前需求

## Open Questions

- NPC 未來的「自動下注」與「報表分列」需求，角色 id 目前設計為穩定字串（`'npc'`），足夠作為後續
  filter 的鍵值；實際排程/引擎設計留待獨立 proposal
