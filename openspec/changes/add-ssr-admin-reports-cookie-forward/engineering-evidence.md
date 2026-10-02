# Engineering Evidence

## 變更摘要

- 對應變更：`add-ssr-admin-reports-cookie-forward`
- 變更檔案清單：
  - `app/services/api.ts`（修改：`api.admin.reports.*`、`api.auth.me`、`api.admin.me`
    加上 `opts?: { headers?: HeadersInit }`）
  - `app/services/authService.ts`（修改：`fetchMe(opts?)`）
  - `app/composables/useAuth.ts`（修改：`reactive({})` → `useState()`，
    `initPromise` → `WeakMap`）
  - `app/composables/useAdminAuth.ts`（修改：同上）
  - `app/composables/useAdminReportData.ts`（新增：5 個報表頁共用的 SSR composable）
  - `app/components/admin/Shell.vue`（修改：`onMounted` → 頂層 `await`，
    cookie 轉發）
  - `app/pages/admin/reports/{index,fcoin,members,plays,settlement}.vue`（修改：
    改用 `useAdminReportData`，移除手刻邏輯）
  - `test/perf-ssr-admin-reports.mjs`（新增：效能量測腳本）
  - `docs/Engineering Evidence/ssr-performance-log.md`（新增列）
- Commit / PR 參考：（待 commit 後補上 hash）

## 驗證佐證

- 對應 `validation.md` 結論：通過（架構正確性），效能數據誠實呈現為不如預期顯著
- 佐證附件：
  - curl 驗證 5 個報表頁 SSR 皆含真實數字（已登入）、匿名顯示「登入已過期」
  - Playwright：hydration 警告 0 筆（已登入直接載入、client-side 導覽、demo 帳號
    三種情境皆驗證）
  - Playwright：client-side 導覽 `/admin` → `/admin/roles`（111ms）→
    `/admin/reports`（68ms），不被卡住
  - `npm test`：36/36 支既有測試通過
  - 效能數據（5 次取中位數）：

    | 指標 | 改造前 | 改造後 |
    |---|---|---|
    | TTFB | 12ms | 25ms |
    | 首次真實數字 | 390ms | 485ms |
    | settled | 390ms | 485ms |
    | LCP | 384ms | 460ms |

    誠實記錄：這次效能數據不如 `add-ssr-lottery-hall-pools` 顯著，推測原因是這次疊加了
    兩個非同步相依（AdminShell 權限檢查 + 報表資料），詳見 `validation.md` 的分析

## 風險與後續追蹤

- 已知風險：
  - 效能量測樣本數小、變異大，未深入排查
  - `useGameAccess.ts`/`useSocket.ts` 仍是模組層級單例（本次未處理）
- 後續追蹤事項：
  - ~~考慮合併「權限檢查」與「報表資料」成一次請求，減少關鍵路徑請求數~~
    **（追蹤完成，見 `fix-admin-guard-hydration-duplicate-fetch`）**：真正的根因
    不是「兩個相依疊加」，而是 `AdminShell.vue` 的 `guard()` 在 client hydration
    階段會無條件重打 `/api/me`／`/api/admin/me`（把 SSR 已經水合進來的正確狀態
    洗掉）；修正重複請求後，效能從「改造後 485ms（比改造前 390ms 還慢）」變成
    「280ms（真正的淨改善）」，不需要再往合併單一請求的方向推進
  - 其餘 `/admin/**` 頁面可視需要比照辦理

## 封存前檢查

- [x] validation.md 已完成，結論為「通過（架構正確性）」
- [x] 變更檔案與風險說明已整理完成
- [x] `npm run dev` 確認正常
- [x] 效能數據已寫入 `ssr-performance-log.md`，誠實呈現、未美化
- [ ] 尚未 commit——等使用者確認後再建立
