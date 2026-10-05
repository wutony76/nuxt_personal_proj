# Engineering Evidence：AdminShell 權限檢查在 hydration 時重複請求

## 變更摘要

- **對應變更**：`fix-admin-guard-hydration-duplicate-fetch`
- **Commit**：`f17b143`（主要修正）、`6b09cf9`（未登入邊界情況、production 量測）
- **變更檔案**：`app/components/admin/Shell.vue`

### 問題

後台報表頁改成 SSR（`add-ssr-admin-reports-cookie-forward`）後，「首次真實數字」反而從 390ms 變慢到 485ms。

原因在 `Shell.vue` 的 `guard()`：client hydration 時它會再跑一次，而且一開始就呼叫 `resetAdminAuth()`，把 SSR 透過 `useState` 帶過來的結果清掉，再從瀏覽器依序打 `/api/me`、`/api/admin/me`。`guard()` 是頂層 `await`，所以 hydration 必須等這兩次網路往返完成。

### 修法

```ts
if (nuxtApp.isHydrating && (checked.value || (authInitialized.value && !isLoggedIn.value))) {
  sessionReady.value = true
  return
}
```

- `nuxtApp.isHydrating` 只在 hydration 當下為 true，之後 client 端切換頁面時都是 false，所以「每次進後台頁面都重新驗證 session」的設計不受影響。
- 跳過重打的前提是 SSR 已經有明確結果：
  - **已登入**：`checked.value` 為 true（SSR 完整跑過 `check()`）。
  - **未登入**：`authInitialized && !isLoggedIn`。SSR 判定未登入時 `check()` 不會被呼叫，`checked` 維持 false，必須另外判斷。

### 考慮過但放棄的做法

用 `useAsyncData('admin-guard', ...)` 包住整段 `guard()`，寫法跟 `useAdminReportData.ts` 一致，也能解決 hydration 重複請求。

但實測發現 client 端切換後台頁面時，權限檢查也一起被跳過。讀 `node_modules/nuxt/dist/app/composables/asyncData.js` 確認：`nuxtApp._asyncData[key]` 由所有元件實例共用，新頁面掛載時舊頁面的快取還沒釋放，因此直接沿用了。這不符合「每次進頁面都重新驗證」的設計，所以放棄。

## 驗證

| 項目 | 方法 | 結果 |
|---|---|---|
| 重新整理不再重複請求 | Playwright 重新整理 `/admin/reports`，記錄瀏覽器端請求 | `/api/me`、`/api/admin/me` 各 1 次 → 0 次 |
| 切換頁面仍重新驗證 | Playwright 從 `/admin/reports` 點連結到 `/admin/roles` | 兩支 API 各打 1 次，行為與修正前相同 |
| 未登入訪客 | Playwright 匿名開啟 `/admin/reports` | hydration 不再重打 `/api/me`，正確顯示「登入已過期」 |
| Hydration mismatch | 檢查 console | 無警告 |
| 效能 | `test/perf-ssr-admin-reports.mjs` | dev 5 次中位數 280ms；production build 20 次 p50 186ms / p90 312ms |
| 回歸測試 | `npm test` | 34/36 通過；`test:m539`、`test:m649` 失敗是測試環境的下注額度累積用完，與本次改動無關 |

完整數據見 [ssr-performance-log.md](ssr-performance-log.md)。

## 風險與後續

- production 20 筆樣本中有 1 筆 5160ms 離群值，尚未追查原因。
- 「改造前」的基準只有 dev 數據，尚未在 production build 下重新量測。
- 原本考慮把權限檢查與報表資料合併成一次請求；消除重複請求後效益已經足夠，不再推進。

## 封存前檢查

- [x] `validation.md` 結論為「通過」
- [x] 變更檔案、風險整理完成
- [ ] 補 production build 的改造前基準
- [ ] `openspec archive`
