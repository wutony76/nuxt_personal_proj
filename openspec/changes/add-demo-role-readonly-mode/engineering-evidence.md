# Engineering Evidence

## 變更摘要

- 對應變更：add-demo-role-readonly-mode — 新增「Demo」角色與唯讀（DEMO 模式）後台存取
- 變更檔案清單：
  - 角色定義：`server/services/admin/modules/roleDefs.ts`
    （`demoMode` 欄位、`demo` builtin 角色、鎖定邏輯）
  - 存取層：`server/services/admin/modules/adminAccess.ts`（新增 `accessLevel()`）、
    `server/services/auth.ts`（新增 `sessionController.requireAdminView()`）
  - 15 支後台 GET 端點改用 `requireAdminView`：
    `server/api/admin/games.get.ts`、`roles.get.ts`、`role-defs.get.ts`、
    `bg-lottery/pool-audit.get.ts`、`chat/schedules.get.ts`、`games/history.get.ts`、
    `npc/settings.get.ts`、`npc/activity-log.get.ts`、`toy-shop/settings.get.ts`、
    `reports/fcoin-summary.get.ts`、`reports/members.get.ts`、`reports/bg-summary.get.ts`、
    `reports/tw-lottery-payout.get.ts`、`role-defs/[id]/games.get.ts`、
    `members/[id]/balance-changes.get.ts`、`members/[id]/login-history.get.ts`
  - `server/api/admin/me.get.ts`（多回傳 `isDemo`）
  - `server/api/admin/role-defs/[id]/settings.patch.ts`（接受 `demoMode` patch）
  - 前端：`app/services/api.ts`（型別）、`app/composables/useAdminAuth.ts`
    （state 補 `isDemo`）、`app/components/admin/Shell.vue`
    （DEMO 橫幅 + fieldset 唯讀鎖定 + denied 文案）、
    `app/components/admin/RoleList.vue`（DEMO 模式設定開關）、
    `app/pages/admin/roles.vue`（頁面說明文字更新）
  - 文件：`docs/Architecture/README.md`（新增「後台存取模型」段落）
  - OpenSpec：`openspec/changes/add-demo-role-readonly-mode/`
    （proposal/design/tasks/validation/engineering-evidence）
- Commit / PR 參考：（尚未提交，待使用者確認後由使用者指示是否建立 commit）

## 驗證佐證

- 對應 `validation.md` 結論：通過
- 佐證附件（截圖 / log / 測試輸出，僅存於本次 session 執行紀錄，未落地檔案）：
  - `npx vue-tsc --noEmit` 全程零錯誤
  - Playwright 全流程腳本：admin 帳號建立測試會員 → 指派 `demo` 角色 → 切換
    登入 → `GET /api/admin/me` 回傳 `{"isAdmin":false,"isDemo":true}` →
    `/admin`、`/admin/roles` 正常渲染（非拒絕畫面）→ 5 種控制項
    （文字輸入框／按鈕／切換鈕／下拉選單）皆確認 `disabled` → 直接呼叫
    `PATCH /api/admin/role-defs/demo/settings` 回 `403 { code: 40003 }`
  - 回歸測試：既有白名單帳號（hfyy@cc.cc）重新登入，`isAdmin:true`／
    `isDemo:false`，控制項未被鎖定，無 DEMO 橫幅，行為與變更前一致
  - `grep -rl "requireAdminView" server/api/admin`（15 支）與
    `grep -rl "requireAdmin(event)" $(find server/api/admin -name "*.get.ts")`
    （0 支殘留）交叉核對，確認寫入端點完全未被誤改

## 風險與後續追蹤

- 已知風險：
  - `<fieldset disabled>` 為頁面內容區塊層級的一次性防呆，非寫入用途的
    純顯示控制項（例如篩選下拉選單）也會被一併鎖定
  - Teleport 到 `<body>` 的全域彈窗不在 fieldset 涵蓋範圍內（真正安全邊界
    仍在後端 `requireAdmin`，不影響安全性，只是這類彈窗若剛好有寫入按鈕，
    UI 層不會預先擋下，但送出後仍會被 API 拒絕）
- 後續追蹤事項（Open Questions 延伸）：
  - 若之後要讓 demo 帳號能操作「純顯示用篩選」，需要把 fieldset 邊界拆更細
  - 若之後新增後台 GET 端點，需要記得用 `requireAdminView`（唯讀）而非
    `requireAdmin`（白名單限定），否則 demo 帳號會在該頁被擋成 403；
    寫入端點永遠維持 `requireAdmin`

## 封存前檢查

- [x] validation.md 已完成且結論為「通過」
- [x] 變更檔案與風險說明已整理完成
- [x] `npm run dev`（既有 6100 進程）已確認正常，Playwright 全流程測試通過
- [ ] 可執行 `openspec archive`（待使用者確認變更內容後再封存）
