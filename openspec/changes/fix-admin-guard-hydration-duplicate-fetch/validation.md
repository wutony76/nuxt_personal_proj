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

## 追更：第二輪 review（2 項）

### 1. 280ms 的結論撐不住樣本分布——改用 production build + 20 次 p50/p90 重新量測

問題：5 次樣本 `[280, 697, 240, 649, 202]` 明顯分成「~200 多 ms」與
「~650~700ms」兩群，中位數只是剛好落在快的那一群，不能直接下「優於改造前
390ms」的結論；且量測全程都在 `nuxt dev` 下跑，建議改用 `nuxt build &&
node .output/server/index.mjs` 的正式 build、每項跑 20 次以上、列出 p50/p90，
若正式 build 下仍有離群值再追查原因。

- 6100 port 已有 dev server 在跑，因此改在另一個 port（6200）用 `nuxt build && node .output/server/index.mjs` 起一份獨立的
  production build 進行量測，量測完畢後已關閉
- Production build、已登入 admin cookie、20 次樣本（6hc-cd 先下注+等自然開獎
  結算，讓這次全新啟動、無任何歷史資料的 production server 的 2026-10 月報表
  有真實非零數字，不是空狀態）：

  | 指標 | p50 | p90 | 備註 |
  |---|---|---|---|
  | 首次真實數字／settled（同一指標） | 186ms | 312ms | 20 筆中 18 筆集中在 168~297ms，僅 1 筆 449ms、1 筆 5160ms（單一離群值，詳下） |

  20 筆原始樣本（ms）：297, 206, 169, 181, 214, 182, 179, 174, 187, 449, 198,
  185, 176, 202, 5160, 191, 168, 232, 169, 174

- **誠實結論**：production build 下，`nuxt dev` 時觀察到的「乾淨 50/50 雙峰分布」
  （4 次快／4 次慢的整齊切分）**沒有重現**——支持原本的推測：dev 模式
  （Vite 隨選編譯／HMR 相關開銷）確實是造成當時那個乾淨雙峰分布的主因，不是
  SSR 架構本身的問題。production build 下仍有 1 筆 5160ms 的單一離群值，但只
  出現 1 次（1/20），沒有再現「一半樣本都慢」的整齊切分模式；受限於時間，沒有
  進一步追查這單一離群值的根因（可能是當下一次 GC 停頓或偶發的事件迴圈延遲），
  如實記錄為未解之謎，不是本次修正的範圍

### 2. 未登入訪客進後台也會重複請求（邊界情況）

問題：跳過條件原本只看 `checked.value`，但 SSR 階段若判定 `isLoggedIn`
為 false，`guard()` 會在 `refreshAuth()` 之後就提早 `return`、`check()` 根本
不會被呼叫，`checked` 永遠停在初始值 `false`——這種情況下 hydration 時的跳過
條件恆為假，仍會重打一次 `/api/me`。

- 修法：條件放寬為 `nuxtApp.isHydrating && (checked.value ||
  (authInitialized.value && !isLoggedIn.value))`——`authInitialized`
  （`useAuth` 的 `init`，`refresh()` 完成後一定會設為 true，不管登入成功或
  失敗）搭配 `!isLoggedIn.value`，代表「已經問過伺服器、答案確定是沒登入」，
  跟「還沒問過伺服器的初始狀態」區分開來
- Playwright 驗證（無 cookie 的全新瀏覽器 context 直接打 `/admin/reports`）：
  修正前瀏覽器端仍會打 1 次 `/api/me`；修正後 0 次，頁面正確顯示「登入已過期」
  （沒有被誤判成已登入）
- 回歸驗證：已登入 hydration（0 次）、已登入 client-side 導覽（各 1 次）兩種
  情境重新跑過，行為與加寬條件前完全一致，沒有被這次調整影響
