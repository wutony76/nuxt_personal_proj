# Tasks

## 1. 規格與設計確認

- [x] 完成 proposal 定稿（範圍/風險/驗證方式）
- [x] 完成 design 定稿（state/flow/API/token mapping）
- [x] 研究現有角色/權限架構（見對話中 Explore agent 報告），確認採用
      「demo 角色獨立於白名單、直接靠角色開放唯讀存取」方案

## 2. 角色定義（roleDefs.ts）

- [x] `RoleDef` 型別新增 `demoMode: boolean`
- [x] `_defaultSettings()` 補上 `demoMode: false`
- [x] `BUILTIN_ROLES` 新增 `demo` 角色，`demoMode: true`
- [x] `updateSettings()` 支援 `demoMode` patch，`demo` 角色鎖定不可關閉
      （比照既有 `LOCKED_ON_ROLE_ID` 對 npc 的寫法）

## 3. 存取層（adminAccess.ts / auth.ts）

- [x] `adminAccessService` 新增 `accessLevel(userId): 'admin' | 'demo' | 'none'`
- [x] `sessionController` 新增 `requireAdminView(event)`（admin 或 demo 皆可通過）
- [x] `requireAdmin()` 維持不變（白名單限定，繼續是所有寫入端點的守門）

## 4. 後台 GET 端點換成 requireAdminView（純白名單→admin-or-demo）

- [x] `server/api/admin/games.get.ts`
- [x] `server/api/admin/roles.get.ts`
- [x] `server/api/admin/role-defs.get.ts`
- [x] `server/api/admin/bg-lottery/pool-audit.get.ts`
- [x] `server/api/admin/chat/schedules.get.ts`
- [x] `server/api/admin/games/history.get.ts`
- [x] `server/api/admin/npc/settings.get.ts`
- [x] `server/api/admin/npc/activity-log.get.ts`
- [x] `server/api/admin/toy-shop/settings.get.ts`
- [x] `server/api/admin/reports/fcoin-summary.get.ts`
- [x] `server/api/admin/reports/members.get.ts`
- [x] `server/api/admin/reports/bg-summary.get.ts`
- [x] `server/api/admin/reports/tw-lottery-payout.get.ts`
- [x] `server/api/admin/role-defs/[id]/games.get.ts`
- [x] `server/api/admin/members/[id]/balance-changes.get.ts`
- [x] `server/api/admin/members/[id]/login-history.get.ts`
- [x] 確認其餘所有 `*.post.ts`／`*.patch.ts`／`*.put.ts`／`*.delete.ts` 完全不動
      （繼續 `requireAdmin`，白名單限定）

## 5. me 端點與角色設定 API

- [x] `server/api/admin/me.get.ts` 多回傳 `isDemo`
- [x] `server/api/admin/role-defs/[id]/settings.patch.ts` 接受並傳遞 `demoMode` patch

## 6. 前端

- [x] `app/services/api.ts`：`RoleDef` 補 `demoMode`；`admin.me()` 回應型別補
      `isDemo`；`setRoleSettings` patch 型別補 `demoMode`
- [x] `app/composables/useAdminAuth.ts`：state 補 `isDemo`，401 時一併重置
- [x] `app/components/admin/Shell.vue`：
  - [x] `status` 判斷改成 `(isAdmin || isDemo) ? 'ok' : 'denied'`
  - [x] 新增 DEMO 模式橫幅
  - [x] `<slot />` 包一層 `<fieldset :disabled="isDemo">`（含 CSS reset）
  - [x] `denied` 畫面文案同步更新（不再只提「白名單」）
- [x] `app/components/admin/RoleList.vue`：
  - [x] `RoleSettingsPatch` 型別補 `demoMode`
  - [x] 設定分頁新增「DEMO 模式」開關列，`demo` 角色鎖定顯示「（固定開啟）」

## 7. 文件

- [x] `docs/Architecture/README.md` 補充後台存取模型（白名單 admin ／ demoMode
      唯讀角色）說明

## 8. 視覺與互動驗證

- [x] `npm run dev` 確認無編譯錯誤
- [x] 建立一個測試帳號、指派 `demo` 角色，實際登入跑過一輪：能看到後台、
      所有控制項皆 disabled、直接打寫入 API 回 403
- [x] 白名單帳號的既有流程（登入、指派角色、自我降級防呆）不受影響

## 9. 交付檢查

- [x] 確認 `npm run dev` 可正常啟動
- [x] 補齊 `validation.md`、`engineering-evidence.md`
- [x] 變更檔案清單整理完成
