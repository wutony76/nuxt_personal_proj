# Validation

## 驗證範圍

- 對應變更：add-demo-role-readonly-mode — 新增「Demo」角色與唯讀（DEMO 模式）後台存取
- 驗證環境：本機 dev（既有 `nuxt dev --port 6100` 進程），Playwright 全流程自動化測試
  （真實登入 → 建立測試帳號 → 指派角色 → 切換帳號 → 檢查畫面與 API）

## 功能驗證

依 proposal 的「成功標準」逐項驗證：

- [x] 角色列表看得到新的「Demo」角色，且 DEMO 模式開關鎖定為開啟、不可關閉 — 實際結果：
      `/admin/roles`「角色列表」正確顯示 Admin／User／NPC／Demo 四個內建角色；
      `roleDefsService.updateSettings('demo', { demoMode: false })` 會拋 400
      「Demo 角色的唯讀模式固定為開啟，不可關閉。」（程式碼審查確認，比照 npc 鎖定寫法）
- [x] 非白名單帳號指派 demo 角色後，可以登入看到完整後台畫面 — 實際結果：
      用 admin 帳號經 `POST /api/admin/members` 建立全新測試帳號（非白名單），
      經 `PATCH /api/admin/roles/:id` 指派 `role: 'demo'`，登出並用該帳號登入後，
      `GET /api/admin/me` 回傳 `{"isAdmin":false,"isDemo":true}`，`/admin`／
      `/admin/roles` 皆正常渲染（非 40003 拒絕畫面），畫面上可看到完整導覽
      （總覽／角色權限／遊戲設定／NPC／資料統計）
- [x] demo 帳號在 UI 上看不到任何可操作的表單控制項；直接打寫入 API 一律 403 — 實際結果：
      `/admin/roles` 頁面實測 5 種控制項：「角色名稱」輸入框、「新增」按鈕、
      遊戲權限「開啟」切換鈕、篩選下拉選單、會員角色下拉選單，皆回傳
      `isDisabled() === true`；直接對 `PATCH /api/admin/role-defs/demo/settings`
      發送請求，回應 `403 { code: 40003, message: "無管理員權限" }`，角色設定
      實際未被更動
- [x] 既有白名單管理員的所有既有行為不受影響 — 實際結果：用既有白名單帳號
      （hfyy@cc.cc）重新登入，`GET /api/admin/me` 回傳
      `{"isAdmin":true,"isDemo":false}`，`/admin/roles` 的角色下拉選單
      `isDisabled() === false`，畫面上沒有 DEMO 橫幅，行為與變更前完全一致

## 視覺驗證

- DEMO 模式橫幅（紅底、比照 `.ash-notice` 版型延伸出 `.ash-notice-demo`）正確顯示在
  頁首導覽下方，文案「DEMO 模式：目前僅供瀏覽，畫面上所有操作都已鎖定，任何修改
  都會被伺服器拒絕。」
- 使用者資訊區塊文字從「Admin whitelist」正確切換為「Demo · read-only」
- 截圖確認 `/admin`（總覽）與 `/admin/roles`（角色權限，含新增的 Demo 角色列表項）
  版面正常、無破版

## 回歸驗證

- 受影響既有流程檢查：
  - 流程：15 支後台 GET 端點的權限檢查（games/roles/role-defs/reports/npc/
    toy-shop/chat/members 等）
  - 結果：全部從 `requireAdmin` 換成 `requireAdminView`，用 grep 逐一核對
    （`grep -rl "requireAdminView" server/api/admin` 精準列出這 15 支，
    `grep -rl "requireAdmin(event)" $(find server/api/admin -name "*.get.ts")`
    確認沒有任何 `.get.ts` 還留著舊呼叫）；所有寫入端點
    （`*.post.ts`／`*.patch.ts`／`*.put.ts`／`*.delete.ts`）完全沒被觸碰，
    繼續使用 `requireAdmin`（白名單限定）
  - 流程：既有白名單管理員的登入、`GET /api/admin/me`、`/admin/roles` 操作
  - 結果：實測確認與變更前行為一致（見上方功能驗證第 4 項）
  - 流程：`setRole()` 既有的「不可自我降級」「至少保留一位 admin」防呆
  - 結果：程式碼審查確認 `setRole()` 完全沒有被修改，這兩條規則只針對
    `next !== 'admin'` 分支，跟本次新增的 `demo` 角色走同一條既有邏輯路徑，
    不需額外處理

## 問題與修正紀錄

- 問題：`vue-tsc --noEmit` 型別檢查
  - 發現方式：每次改動後主動執行
  - 修正方式：無需修正，全程零錯誤
- 問題：測試腳本第一版誤判「DEMO 橫幅不存在」
  - 發現方式：`bodyText.includes('DEMO 模式')` 查詢範圍是 `main.ash-main`，
    但橫幅 `.ash-notice` 實際上是 `<main>` 的手足元素，不在查詢範圍內
  - 修正方式：改用 `.ash-notice-demo` class 選擇器直接檢查，確認橫幅確實存在
    且可見；屬於測試腳本本身的誤判，非產品程式碼問題

## 結論

- 是否通過：是
- 已知限制或風險：
  - `<fieldset disabled>` 是「整個頁面內容區塊」層級的防呆，連同「篩選下拉選單」
    這類非寫入、純顯示用的控制項也一併被鎖定（demo 帳號無法切換篩選條件），
    是簡化實作換取全站覆蓋率的已知取捨，不影響安全性（真正邊界在後端）
  - Teleport 到 `<body>` 的彈窗（例如全域 `$dialog`）不在 fieldset 範圍內；
    真正的安全邊界仍是後端 `requireAdmin`，即使前端沒擋到，寫入 API 呼叫
    也會被拒絕
- 後續追蹤事項：若之後要讓 demo 帳號仍可操作「純顯示用篩選」，可以把
  fieldset 拆更細（例如篩選區塊移到 fieldset 外），目前為求覆蓋率與實作
  簡單性，先整塊鎖定
