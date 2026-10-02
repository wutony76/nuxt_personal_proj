# Proposal

## 變更名稱

`add-ssr-admin-reports-cookie-forward` — 後台報表頁（5 頁）改用 `useAsyncData` + cookie 轉發做 SSR

## 背景

`add-ssr-lottery-hall-pools` 的 validation.md 在 code review 後的後續追蹤事項裡提到：
「挑一個需要登入的報表類頁面，用 `useRequestFetch()`/`useRequestHeaders(['cookie'])` 做第二個
SSR + cookie 轉發的示範」——這才是 `docs/Architecture/README.md` 原本真正在批評的那類場景
（`trend`/`bet_search` 這類報表頁白屏），`lottery-hall.vue` 當時刻意選的是公開頁面避開了
cookie 轉發這塊最該證明的難題。

本次就是補上這一步：`app/pages/admin/reports/` 底下 5 個報表頁（`index`/`fcoin`/`members`/
`plays`/`settlement`）全部是同一套「`onMounted` 才打 `api.admin.reports.*`」的 CSR 模式。

## 範圍比原先討論的「只做一個示範頁」大，原因

Implementation 過程中發現，只改報表頁本身的資料獲取**不夠**，因為：

1. 後台所有頁面共用的 `AdminShell.vue` 本身也有一層權限檢查（`useAuth`/`useAdminAuth`），
   這層檢查也是 client-only（`onMounted` 才跑），SSR 階段永遠顯示「正在確認管理員權限...」，
   把報表頁的 slot 內容整個蓋住——就算報表資料 SSR 抓到了，畫面上也看不出來。
2. 要讓 AdminShell 的權限檢查也在 SSR 階段跑，發現 `useAuth`/`useAdminAuth` 的內部狀態是
   **模組層級的單例 `reactive({})`**，在 SSR 下是整個 Nitro process 共用一份，若真的讓它們
   在 SSR 執行，會有不同使用者的登入狀態互相污染的風險（潛在、過去未觸發，因為從來沒人在
   SSR 呼叫過）。

以上兩點都有先用 `AskUserQuestion` 跟使用者確認過才動手（範圍、`useState` 改造的風險），
不是單方面擴大範圍。

## 目標

- 5 個後台報表頁的首次 SSR 回應就含真實報表資料（已登入管理員／demo 角色適用）
- `AdminShell` 的權限檢查也能在 SSR 階段正確運作，不再卡在「正在確認管理員權限...」
- 修掉 `useAuth`/`useAdminAuth` 原本潛在的 SSR 跨使用者狀態污染風險
- 全部沿用上一輪 `add-ssr-lottery-hall-pools` 的教訓：具體效能數據（不只一個容易誤導的
  指標）、cookie 轉發用 `useRequestHeaders(['cookie'])`、`useNuxtApp()` 只在同步階段呼叫

## 範圍

- 包含：
  - `app/services/api.ts`：`api.admin.reports.*`（4 個函式）、`api.auth.me`、`api.admin.me`
    加上可選的 `opts?: { headers?: HeadersInit }`，轉發給底層 `$fetch`
  - `app/services/authService.ts`：`fetchMe()` 跟著加轉發參數
  - 新增 `app/composables/useAdminReportData.ts`：5 個報表頁共用的 SSR 資料獲取 composable
  - `app/pages/admin/reports/{index,fcoin,members,plays,settlement}.vue`：改用上面這支
    composable，template 完全不變
  - `app/composables/useAuth.ts`、`app/composables/useAdminAuth.ts`：內部狀態從模組層級
    `reactive({})` 改成 `useState()`（SSR-safe），對外介面（`user`/`isLoggedIn`/`init()`/
    `refresh()`/`login()`/`logout()`/`checked`/`isAdmin`/`isDemo`/`check()`/`reset()`）完全
    不變，全站約 70+ 處既有呼叫點不用改
  - `app/components/admin/Shell.vue`：`_actions.guard()` 改成在 `<script setup>` 頂層
    `await`（取代 `onMounted`），用 `useRequestHeaders(['cookie'])` 轉發 cookie
  - 新增 `test/perf-ssr-admin-reports.mjs`：效能量測腳本
- 不包含：
  - 其他 `/admin/**` 頁面（角色/權限、遊戲設定、NPC）本身的資料獲取邏輯——這次只動
    AdminShell 這層共用的權限檢查，各頁面自己的內容抓取方式不變
  - `useGameAccess.ts`／`useSocket.ts`——同樣是模組層級單例，但這次沒有讓它們在 SSR 執行，
    維持現狀（client-only），不在本次範圍
  - 不修改任何伺服器端權限邏輯（`sessionController.requireAdmin`/`requireAdminView`）

## 風險與對策

- 技術風險：
  - 風險：`useNuxtApp()` 在 `await` 之後呼叫會丟出「called outside of a plugin...」
    （已實測踩到這個坑）
  - 對策：所有需要 `useNuxtApp()`/`useAuth()`/`useAdminAuth()` 的地方都在函式**最頂層、
    還沒遇到任何 await 之前**就呼叫並存起來，透過閉包在 async IIFE／finally 區塊裡沿用，
    不在 await 之後重新呼叫
  - 風險：`useAsyncData` 沒有 `await`，`lazy: true` 情境下 SSR 會渲染出 loading 快照
    （上一輪 `add-ssr-lottery-hall-pools` review 後也踩過一次，這次沿用同一個教訓）
  - 對策：`useAdminReportData` 內部的 `useAsyncData` 呼叫前面一定加 `await`
- UI/UX 風險：
  - 風險：改成頂層 `await` 後，`AdminShell` 變成 async 元件，依賴 Vue Suspense；若父層
    沒有 Suspense 邊界可能整頁炸掉
  - 對策：Nuxt 的 `<NuxtPage>` 預設就包了 Suspense，且 `lottery-hall.vue` 已經驗證過同一套
    「`<script setup>` 頂層 await」模式可以正常運作

## 驗證方式

- 功能驗證：
  - `curl` 帶 admin cookie 驗證 5 個報表頁 SSR 回應皆含真實數字
  - 匿名（無 cookie）驗證 SSR 直接顯示「登入已過期」，不再是「正在確認管理員權限...」
  - demo 帳號（test04）驗證唯讀後台體驗在 SSR 下也正確（KPI 可見、demo 提示可見）
- 效能驗證：
  - `test/perf-ssr-admin-reports.mjs` 量測 TTFB／首次真實數字／settled／LCP，改造前後對比
- 回歸驗證：
  - `npm test`（36 支既有測試，含 `test:roles` 直接涵蓋角色/權限/setRole 流程）
  - Playwright 檢查 hydration/mismatch 警告
  - client-side 導覽在多個 admin 頁面間切換，確認不被卡住、資料正確重新載入

## 成功標準

- [x] 5 個報表頁 SSR 回應皆含真實資料（curl 驗證）
- [x] `AdminShell` 權限檢查 SSR 階段正確運作（已登入/匿名/demo 三種情境皆驗證）
- [x] `useAuth`/`useAdminAuth` 改用 `useState()`，`npm test` 全數通過、全站無新增 console error
- [x] 效能數據寫入 `docs/Engineering Evidence/ssr-performance-log.md`（誠實呈現，含量測
      結果不如預期顯著的部分，不美化數字）
