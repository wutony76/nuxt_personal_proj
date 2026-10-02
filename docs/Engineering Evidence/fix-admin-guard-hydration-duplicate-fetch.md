# Engineering Evidence

## 變更摘要

- 對應變更：`fix-admin-guard-hydration-duplicate-fetch` — 修正 AdminShell 權限
  檢查在 client hydration 階段重複呼叫 `/api/me`／`/api/admin/me` 的問題
- 變更檔案清單：
  - `app/components/admin/Shell.vue`
  - `openspec/changes/fix-admin-guard-hydration-duplicate-fetch/{proposal,design,tasks,validation}.md`
  - `docs/Engineering Evidence/ssr-performance-log.md`（追加列）
  - `openspec/changes/add-ssr-admin-reports-cookie-forward/engineering-evidence.md`
    （追加「後續追蹤事項」指向本次變更）
- Commit / PR 參考：（尚未 commit，待使用者確認後再建立）

## 驗證佐證

- 對應 `validation.md` 結論：**通過**
- 佐證附件（截圖 / log / 測試輸出）：
  - Playwright 重整 `/admin/reports`：修正前瀏覽器端 `/api/me`、`/api/admin/me`
    各重複呼叫 1 次（共 2 次冗餘請求）；修正後 0 次，無 hydration mismatch 警告
  - Playwright client-side 導覽（`/admin/reports` → `/admin/roles`）：修正後
    `/api/me`、`/api/admin/me` 仍各正常重打 1 次，確認「每次掛載都重新驗證
    session」的既有設計未被破壞
  - 曾經嘗試用 `useAsyncData` 包住整段 `guard()`（風格更貼近 `useAdminReportData.ts`
    的既有模式），但實測發現它會讓 client-side 導覽也一併跳過重新驗證（讀
    `node_modules/nuxt/dist/app/composables/asyncData.js` 原始碼確認：快取物件
    跨元件實例共用，新頁面掛載早於舊頁面釋放快取），已放棄，改用不碰共用快取的
    `nuxtApp.isHydrating` + `checked.value` 判斷
  - 效能重新量測（`test/perf-ssr-admin-reports.mjs`，5 次取中位數）：
    改造前 390ms → 改造後（有本次這個 bug）485ms → 本次修正後 280ms，完整故事線
    記錄在 `ssr-performance-log.md`
  - `npm test`：36 支既有測試腳本，與本次改動無關的失敗項目（`test:6hc-cd`／
    `test:6hc-of` 單獨重跑皆過；`test:m539`／`test:m649` 確認是測試環境累積的
    下注配額耗盡，與 `Shell.vue` 無關）已在 `validation.md` 詳細記錄原因

## 風險與後續追蹤

- 已知風險：
  - SSR 階段判定「未登入」時，`checked.value` 永遠是初始值 `false`，hydration
    時仍會重打一次 `/api/me`（但不含 `/api/admin/me`）——刻意接受的小範圍殘留
    成本，影響遠小於修正前「兩者皆重複」的問題
- 後續追蹤事項：
  - 無新增；原本 `add-ssr-admin-reports-cookie-forward` 記錄的「考慮合併權限檢查
    與報表資料成一次請求」，本次透過消除重複請求已部分達成同等效果，不需要再
    往合併單一請求的方向推進

## 封存前檢查

- [x] validation.md 已完成且結論為「通過」
- [x] 變更檔案與風險說明已整理完成
- [x] Playwright 兩情境驗證通過，效能數據從「改造後變慢」修正為「真正的淨改善」
- [x] `npm test` 34/36（其餘 2 支確認為與本次改動無關的測試環境狀態累積問題）
- [ ] 可執行 `openspec archive` — 建議使用者確認後再封存
