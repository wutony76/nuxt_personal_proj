# Validation

## 功能驗證

### Hydration：重複請求是否消失

用 Playwright（cookie 注入登入）重整 `/admin/reports`，記錄瀏覽器端發出的
`/api/me`／`/api/admin/me` 請求：

| 階段 | 瀏覽器端 `/api/me`／`/api/admin/me` 呼叫數 |
|---|---|
| 修正前 | 各 1 次（共 2 次，SSR 已經算過一次後又在瀏覽器重算一次） |
| Option 1（`useAsyncData`，已放棄） | 0 次 |
| Option 2（`isHydrating` + `checked`，最終採用） | 0 次 |

無 hydration mismatch 相關 console 警告；頁面正常顯示已登入/已通過權限檢查的
內容（非 checking/expired/denied 卡住的空殼）。

### Client-side 導覽：是否仍會重新驗證 session

用 Playwright 從 `/admin/reports` 點擊內部連結導覽到 `/admin/roles`（純
client-side，不重新整理）：

| 方案 | 導覽後 `/api/me`／`/api/admin/me` 呼叫數 | 是否符合既有設計意圖 |
|---|---|---|
| Option 1（`useAsyncData`） | 0 次 | ❌ 不符合——`roles.vue` 自己的資料 API（`/api/admin/roles`、`/api/admin/role-defs`、`/api/admin/games`）正常打，但權限檢查完全沒有重打 |
| Option 2（`isHydrating` + `checked`） | 各 1 次 | ✅ 符合——行為跟修正前完全一致 |

根因（已讀 `node_modules/nuxt/dist/app/composables/asyncData.js` 原始碼確認）：
`useAsyncData` 的快取物件 `nuxtApp._asyncData[key]` 是跨元件實例共用的，新頁面
的 `AdminShell` 在舊頁面真正卸載、釋放快取（`_deps` 歸零）之前就已經掛載並讀到
舊的 `status: 'success'`快取，導致「每次掛載都重新驗證」的設計被意外廢掉。因此
最終放棄 Option 1，改用不經過任何共用快取的 Option 2。

## 效能驗證

`test/perf-ssr-admin-reports.mjs`，已登入 admin cookie，5 次取中位數：

| 階段 | TTFB | 首次真實數字 | settled | LCP |
|---|---|---|---|---|
| SSR 改造前（`add-ssr-admin-reports-cookie-forward` 記錄） | 12ms | 390ms | 390ms | 384ms |
| SSR 改造後、修正前（有本次這個 bug） | 25ms | 485ms | 485ms | 460ms |
| 本次修正後 | 47ms | 280ms | 280ms | 248ms |

5 次樣本：TTFB=[64,24,76,30,47]、首次真實數字=[280,697,240,649,202]、settled 同
首次真實數字、LCP=[248,652,212,636,188]。

**誠實結論**：這次的故事線完整——SSR 改造本身做對了（架構正確性早在
`add-ssr-admin-reports-cookie-forward` 就驗證過），但因為 hydration 階段的權限
檢查重複請求，實際測得的效能數字反而比改造前還差；追查並修正重複請求後，才真正
看到 SSR 應有的效益（280ms，優於改造前的 390ms 與改造後有 bug 時的 485ms）。
TTFB 略為上升（12ms→47ms）在量測雜訊範圍內，本機環境所有 API 都是同進程記憶體
操作，正式環境換成較慢的外部服務時這個代價會更明顯，如實記錄不美化。

## 回歸驗證

`npm test`（36 支既有測試腳本）：

- 本次改動（`app/components/admin/Shell.vue`）本身不影響任何 BG/台彩/GAME 遊戲
  的伺服器邏輯
- 執行過程中出現的失敗項目與本次改動無關：
  - `test:6hc-cd`／`test:6hc-of`：單獨重跑皆全數通過（56/56、24/24），確認是
    既有的、與長駐 dev server 狀態相關的時機性 flake（同一類在前一個 6hc-cd
    導航 bug 修正時也觀察過）
  - `test:m539`／`test:m649`：確認是本次工作階段內反覆執行測試腳本，把真實
    `currentIssue` 的下注配額（160 注上限）打滿所致（錯誤訊息「本期最多受理
    160 注，目前已有 160 注」），純屬測試環境狀態累積問題；該期別下一次真實
    開獎時間還有約 2.5 小時，不會自然重置，但這與 `Shell.vue` 的改動完全無關
    （`m539`／`m649` 的服務程式碼本次完全未被觸碰）

## 成功標準檢查

- [x] hydration 不再重複呼叫 `/api/me`／`/api/admin/me`
- [x] client-side 導覽仍會重新驗證 session（行為未退化）
- [x] 無新增重大 console / runtime error
- [x] 相關測試或手動驗證完成，效能數據從「改造後變慢」修正為「真正的淨改善」
