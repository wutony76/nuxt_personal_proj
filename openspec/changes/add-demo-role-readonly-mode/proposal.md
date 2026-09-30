# Proposal

## 變更名稱

add-demo-role-readonly-mode — 新增「Demo」角色與唯讀（DEMO 模式）後台存取

## 背景

後台目前「能不能進 `/admin/**`」完全由寫死在 `server/config/admin.ts` 的 `ADMIN_USER_IDS`
白名單決定，角色（`role` 欄位）只是白名單內外的一個顯示標籤，完全不影響存取範圍
（見 `roleDefs.ts:47-48` 註解：「這裡新增的角色一律 builtin:false，不會取得 admin 權限」）。

這個專案是個人作品集，希望能開一個「Demo」身份，讓不在白名單裡的人（例如訪客、
面試官）也能登入瀏覽整個後台，但完全不能做任何修改——不需要為了展示後台就把人
加進白名單常數、重新部署。

## 目標

- 新增一個內建角色 `demo`，會出現在「角色列表」頁面
- 角色定義新增一個可通用的 `demoMode` 開關（比照既有 `testMode`／`npcMode` 設計），
  `demo` 角色固定鎖定開啟、不可關閉；其他自訂角色理論上也能被標記為 `demoMode`
- 被指派 `demo` 角色（或任何 `demoMode: true` 的角色）的帳號，**不需要在白名單內**
  也能登入看到整個後台畫面
- 這類帳號對所有後台寫入操作（新增／修改／刪除）一律被拒絕，不論是從 UI 操作
  還是直接呼叫 API

## 範圍

- 包含：
  - `server/services/admin/modules/roleDefs.ts`：`RoleDef` 新增 `demoMode` 欄位，
    新增 `demo` builtin 角色，`updateSettings` 支援調整/鎖定 `demoMode`
  - `server/services/admin/modules/adminAccess.ts`：新增 `accessLevel()` 判斷
    `'admin' | 'demo' | 'none'`
  - `server/services/auth.ts`：新增 `sessionController.requireAdminView()`
    （admin 或 demo 皆可通過，只給唯讀端點用）；既有 `requireAdmin()`（白名單限定）
    不變，繼續當所有寫入端點的守門
  - 15 支後台 GET 端點從 `requireAdmin` 換成 `requireAdminView`
    （見 tasks.md 完整清單）
  - `server/api/admin/me.get.ts` 多回傳 `isDemo`
  - 前端：`useAdminAuth`／`Shell.vue`（唯讀模式橫幅 + 用 `<fieldset disabled>`
    包住頁面內容區塊擋掉所有表單操作）／`RoleList.vue`（角色設定新增 DEMO 模式
    開關）／`api.ts`（型別同步）
  - `docs/Architecture/README.md` 補充後台存取模型說明
- 不包含：
  - 不逐一修改每個後台頁面/元件個別加 disabled 判斷（改用 `<fieldset disabled>`
    在 Shell 層級一次擋掉所有原生表單控制項，涵蓋率已足夠；programmatic API
    呼叫的真正防線在後端 `requireAdmin` 維持白名單限定，不受前端影響）
  - 不處理「白名單帳號」與「demo 角色帳號」之間的角色互轉檢查以外的既有安全規則
    （自我降級、至少一位 admin 等既有規則維持不變、不受影響）
  - 不新增 in-memory 以外的持久化（跟現有角色系統一樣重啟即回復種子）

## 影響面

- 前端路由/頁面：`app/pages/admin/**`（透過共用的 `Shell.vue` 生效，各頁面
  檔案本身不用修改）
- 前端元件/Composables：`useAdminAuth.ts`、`Shell.vue`、`RoleList.vue`
- 後端 API/Services：`roleDefs.ts`、`adminAccess.ts`、`auth.ts`、15 支
  `*.get.ts` 端點、`me.get.ts`、`role-defs/[id]/settings.patch.ts`
- 設定或常數（`app/config/`）：無（`server/config/admin.ts` 的白名單常數不變）

## 風險與對策

- 技術風險：
  - 風險：漏改到某支後台 GET 端點，demo 帳號進到該頁時被擋成 40003，體驗不一致
  - 對策：先用 `grep` 列出全部 `server/api/admin/**/*.get.ts`，逐一確認並在
    tasks.md 列表打勾，只換 GET，寫入端點（POST/PATCH/PUT/DELETE）完全不動
  - 風險：`<fieldset disabled>` 不會擋到 Teleport 到 `<body>` 的彈窗（例如
    `$dialog`／某些 Modal），demo 帳號理論上仍可能觸發到彈窗內的操作
  - 對策：真正的安全邊界在後端 `requireAdmin`（仍是白名單限定），任何寫入
    API 呼叫對 demo 帳號一律 40003，就算 UI 沒擋到，資料也不會被改動
- UI/UX 風險：
  - 風險：demo 帳號完全看不出自己在唯讀模式，操作被擋卻不知道為什麼
  - 對策：`Shell.vue` 新增顯眼的「DEMO 模式：僅供瀏覽」橫幅，取代/並存於既有
    「In-memory only」提示

## 驗證方式

- 功能驗證：
  - 在「使用者列表」把一個非白名單帳號指派成 `demo` 角色
  - 用該帳號登入，確認能看到 `/admin` 各頁（總覽／角色權限／遊戲設定／NPC／
    資料統計），但畫面上所有按鈕/輸入框都是 disabled 狀態
  - 直接對寫入端點打 API（例如 `PATCH /api/admin/role-defs/xxx/settings`），
    確認回 403（40003），資料未被更動
  - 用真正白名單帳號確認一切操作不受影響（fieldset 只在 `isDemo` 時套用）
- 視覺驗證：
  - DEMO 模式橫幅樣式與既有 `.ash-notice` 一致，不破版
- 回歸驗證：
  - 既有白名單帳號的登入、角色指派、自我降級防呆、至少一位 admin 等規則
    皆維持原行為

## 成功標準

- [ ] 角色列表看得到新的「Demo」角色，且 DEMO 模式開關鎖定為開啟、不可關閉
- [ ] 非白名單帳號指派 demo 角色後，可以登入看到完整後台畫面
- [ ] demo 帳號在 UI 上看不到任何可操作的表單控制項；直接打寫入 API 一律 403
- [ ] 既有白名單管理員的所有既有行為不受影響
