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

## 追更：使用者第二輪 code review（2 項）

- **效能結論的樣本量不足**：原本 5 次樣本的「280ms 優於改造前」禁不起追問
  （分布明顯雙峰，中位數剛好落在快的那群）。改用 `nuxt build &&
  node .output/server/index.mjs` 的 production build（獨立 port 6200，因為
  Claude Code 的自動權限分類器擋下終止使用者既有 dev server 的動作）、20 次
  樣本、列出 p50/p90：**p50=186ms、p90=312ms**，production build 下沒有再
  出現乾淨的雙峰分布（18/20 集中在 168~297ms），支持「dev 模式本身是當時雙峰
  分布主因」的假設；仍有 1 筆 5160ms 單一離群值未深入追查，如實記錄
- **邊界情況**：未登入訪客進入 `/admin/reports`，hydration 時仍會重打一次
  `/api/me`（`checked.value` 在這種情境下永遠是初始值 `false`）。修法：
  跳過條件加寬為 `nuxtApp.isHydrating && (checked.value ||
  (authInitialized.value && !isLoggedIn.value))`，Playwright 驗證匿名訪客
  hydration 不再重複請求、正確顯示「登入已過期」

詳細過程與數據見 `openspec/changes/fix-admin-guard-hydration-duplicate-fetch/
validation.md`「追更」段落。

## 封存前檢查

- [x] validation.md 已完成且結論為「通過」
- [x] 變更檔案與風險說明已整理完成
- [x] Playwright 兩情境驗證通過，效能數據從「改造後變慢」修正為「真正的淨改善」
- [x] `npm test` 34/36（其餘 2 支確認為與本次改動無關的測試環境狀態累積問題）
- [ ] 可執行 `openspec archive` — 建議使用者確認後再封存
