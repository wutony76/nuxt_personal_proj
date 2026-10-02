# Tasks

## 1. 規格與設計確認

- [x] 完成 proposal 定稿（範圍已跟使用者確認兩次：先確認只做「真正適合 SSR 的頁面」
      而非全部需登入頁面，後確認 AdminShell／useAuth 的 SSR 化方式）
- [x] 完成 design 定稿（useNuxtApp 同步呼叫規則、useState 轉換、Shell 頂層 await、
      composable 設計、await useAsyncData 的必要性）

## 2. API 層：補 cookie 轉發參數

- [x] `app/services/api.ts`：`api.admin.reports.{bgSummary,fCoinSummary,twLotteryPayout,
      memberSummary}` 加上 `opts?: { headers?: HeadersInit }`
- [x] `app/services/api.ts`：`api.auth.me`、`api.admin.me` 同樣加上 `opts`
- [x] `app/services/authService.ts`：`fetchMe(opts?)` 跟著轉發

## 3. useAuth / useAdminAuth：SSR-safe 狀態

- [x] `useAuth.ts`：`reactive({})` 改 `useState('auth-state', ...)`
- [x] `useAuth.ts`：`initPromise` 模組層級 `let` 改 `WeakMap<nuxtApp, Promise>`
- [x] `useAuth.ts`：`init()`/`refresh()`/`clearSession()`/`logout()` 的 `useNuxtApp()`
      呼叫全部移到函式最頂層（await 之前），避免 context-lost 例外
- [x] `useAdminAuth.ts`：同樣的 `useState` + `WeakMap` 轉換
- [x] `useAdminAuth.ts`：`check()` catch 區塊呼叫 `useAuth().clearSession()` 改成在
      `useAdminAuth()` 頂層先解構出 `clearSession`，async IIFE 內用閉包沿用

## 4. AdminShell.vue

- [x] `useRequestHeaders(['cookie'])` 移到最頂層（任何 await 之前）
- [x] `refreshAuth({ headers })`／`check({ headers })` 轉發
- [x] `onMounted(() => guard())` 改成 `<script setup>` 頂層 `await _actions.guard()`

## 5. 報表頁共用 composable 與 5 個頁面改造

- [x] 新增 `app/composables/useAdminReportData.ts`
- [x] `index.vue`／`fcoin.vue`／`members.vue`／`plays.vue`／`settlement.vue`：
      改用 `await useAdminReportData(key, fetcher)`，移除手刻的
      `month`/`status`/`error`/`summary` ref + `_actions.fetch` + `watch`/`onMounted`，
      template 完全不變
- [x] 移除 5 個頁面不再需要的 `dayjs`／`ref`／`watch`／`onMounted` import

## 6. 驗證

- [x] `curl` 帶 admin cookie：5 個報表頁 SSR 回應皆含真實數字
- [x] `curl` 不帶 cookie：SSR 直接顯示「登入已過期」（不再是「正在確認管理員權限...」
      卡住不動）
- [x] Playwright：admin 登入後直接 SSR 載入 `/admin/reports`，hydration 警告 0 筆
- [x] Playwright：client-side 導覽 `/admin` → `/admin/roles` → `/admin/reports`，
      真實點擊 `<NuxtLink>`（非 `page.goto()`），確認不被卡住、資料正確重新顯示
- [x] Playwright：demo 帳號（test04）載入 `/admin/reports`，KPI 可見、demo 唯讀提示可見，
      hydration 警告 0 筆
- [x] 確認 `/login` 頁面既有的 hydration mismatch 警告（與本次改動無關）：用
      `git stash` 暫時還原 `useAuth.ts`/`useAdminAuth.ts` 後重測，警告依然存在，
      證實是既有問題、非本次引入
- [x] `npm test`（36 支既有測試）全數通過，含 `test:roles`（直接涵蓋角色/權限/setRole，
      對 `useAuth`/`useAdminAuth` 改動是很好的間接回歸信號）

## 7. 效能量測

- [x] 改造前基準：`git stash` 還原全部相關檔案後跑 `test/perf-ssr-admin-reports.mjs`
- [x] 改造後：還原變更後重跑
- [x] 誠實記錄結果（含「跟 lottery-hall 不同，這次效益不如預期顯著」的分析）到
      `docs/Engineering Evidence/ssr-performance-log.md`

## 8. 交付檢查

- [x] 變更檔案與風險說明整理完成，進入 Validation 階段
- [ ] 尚未 commit——等使用者確認後再建立
