# Tasks

## 1. 問題確認（使用者 code review 提出）

- [x] 讀 `Shell.vue`／`useAuth.ts`／`useAdminAuth.ts` 現況程式碼，確認使用者指出的
      根因屬實：`resetAdminAuth()` 把 `checked` 洗回 `false`，`refreshAuth()`
      （`useAuth.ts` 的 `refresh()`）本身完全沒有跳過判斷
- [x] Playwright 驗證：重整 `/admin/reports`，hydration 期間 `/api/me`、
      `/api/admin/me` 各出現一次（總共 2 次重複請求）

## 2. 嘗試 Option 1（`useAsyncData` 包住 `guard()`）

- [x] 實作：把 `resetAdminAuth()`／`refreshAuth()`／`check()` 包進
      `useAsyncData('admin-guard', ...)`
- [x] Playwright 驗證 hydration：`/api/me`／`/api/admin/me` 重複請求歸零 ✅
- [x] Playwright 驗證 client-side 導覽（`/admin/reports` → `/admin/roles`）：
      發現 `/api/me`／`/api/admin/me` 完全沒有重打 ❌——意外廢掉「每次掛載都重新
      驗證 session」的既有設計
- [x] 讀 `node_modules/nuxt/dist/app/composables/asyncData.js` 原始碼確認根因：
      `nuxtApp._asyncData[key]` 是跨元件實例共用的快取，新頁面的 `AdminShell`
      在舊頁面卸載、快取釋放前就已經掛載並讀到舊的 `status: 'success'`
- [x] 跟使用者確認（`AskUserQuestion`）：放棄 Option 1，改用 Option 2

## 3. 實作 Option 2（`nuxtApp.isHydrating` + `checked.value` 判斷）

- [x] `Shell.vue`：捕捉 `const nuxtApp = useNuxtApp()`（元件頂層、還沒遇到任何
      `await` 之前）
- [x] `guard()` 開頭加入 `if (nuxtApp.isHydrating && checked.value) { sessionReady
      .value = true; return }`

## 4. 驗證

- [x] Playwright 驗證 hydration：`/api/me`／`/api/admin/me` 重複請求歸零，
      無 hydration mismatch 警告，頁面正常顯示已登入/已通過權限檢查內容
- [x] Playwright 驗證 client-side 導覽（`/admin/reports` → `/admin/roles`）：
      `/api/me`／`/api/admin/me` 各正常重打一次，確認「每次掛載都重新驗證」
      行為維持不變
- [x] 效能重新量測（`test/perf-ssr-admin-reports.mjs`，5 次取中位數）：
      settled/首次真實數字中位數從「改造前 390ms」「改造後（有 bug）485ms」
      變成「修正後 280ms」——這次是真正的淨改善，不只是恢復到改造前水準
- [x] `npm test`（36 支既有測試腳本）回歸：`6hc-cd`／`6hc-of` 單獨重跑皆
      全數通過（確認是跟本次改動無關的既有時機性 flake）；`m539`／`m649`
      確認是本次工作階段重複執行測試腳本，累積把真實 currentIssue 的下注
      配額（160 注上限）打滿導致，純屬測試環境狀態累積問題，與
      `Shell.vue` 的改動無關（`m539`／`m649` 的服務程式碼完全未被觸碰）
- [x] 清除暫存診斷腳本（`__diag-admin-guard-tmp.mjs`、
      `__diag-admin-guard-nav-tmp.mjs`、`__diag-admin-guard-nav2-tmp.mjs`）

## 5. 文件交付

- [x] 完成 `proposal.md`／`design.md`／`tasks.md`／`validation.md`
- [x] 新增 `docs/Engineering Evidence/fix-admin-guard-hydration-duplicate-fetch.md`
- [x] `docs/Engineering Evidence/ssr-performance-log.md` 追加新列（不覆寫既有
      內容），誠實記錄「改造後曾經變慢，追查後發現是 hydration 重複請求，修正後
      變成真正的淨改善」這個完整故事
- [x] 回頭更新 `add-ssr-admin-reports-cookie-forward` 的
      `engineering-evidence.md`「後續追蹤事項」，加上指向本次變更的追蹤紀錄
