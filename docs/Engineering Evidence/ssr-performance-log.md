# SSR / 效能改造量測歷史

> 這份文件是**跨變更持續累積的歷史列表**，跟其他 `docs/Engineering Evidence/*.md`
> （一個變更一份、寫完就定案的快照文件）不同——任何頁面做 SSR 轉換或其他效能相關改造，
> 都直接在下面的表格「新增一列」，不要另開新檔案、不要修改或刪除既有列。
> 若某次量測事後發現數據有誤，在「備註」欄註明並補一列更正紀錄，保留原始列不刪除。

## 量測歷史

| 日期 | 頁面 | 變更 | 情境 | 量測方式 | 關鍵指標 | 對應 change / commit | 備註 |
|---|---|---|---|---|---|---|---|
| 2026-10-02 | `/lottery-hall` | 彩池首次抓取改用 `useAsyncData`；`state.list` 初始化（`init()`）從 `onMounted` 移到 setup 階段同步執行 | SSR 改造前 | `test/perf-ssr-lottery-hall.mjs`，`BASE_URL=http://localhost:6100`，5 次取中位數 | `domcontentloaded` 到 `.gc__pool-val` 第一個元素文字連續 300ms 不再變動的毫秒數：中位數 **4419ms**（5 次樣本：4526/4464/4419/4417/4415） | `add-ssr-lottery-hall-pools` | ⚠️ **此列數字本身正確，但框架誤導，見下方更正列**：只量「數字停止變動」一個指標，裡面約 4000ms 其實是 `_animatePoolTo` 的 4 秒動畫時間，不是 CSR waterfall 本身的成本，單獨拿這個指標講改善倍數會失真 |
| 2026-10-02 | `/lottery-hall` | 同上 | SSR 改造後 | `test/perf-ssr-lottery-hall.mjs`，同上，5 次取中位數 | 同上定義：中位數 **189ms**（5 次樣本：682/189/174/215/178，第 1 次含瀏覽器冷啟動） | `add-ssr-lottery-hall-pools` | ⚠️ **此列數字本身正確，但框架誤導，見下方更正列**：「約為改造前 1/23」這個倍數主要反映「拿掉動畫」的效果，不是 SSR 資料獲取本身的效益，容易被誤解或被問倒 |
| 2026-10-02 | `/lottery-hall` | 同上（+ 移除 `withTimeout` 自刻計時器改用 ofetch 內建 `timeout`／`useAsyncData` 加 `lazy: true`） | SSR 改造前（更正版：同時量 4 個指標，且重新確認基準點確實是尚未套用任何 SSR 改動的原始版本，不是中途某個已 commit 的半成品） | `test/perf-ssr-lottery-hall.mjs`（已改版同時輸出 4 項指標），5 次取中位數；基準版本取自 `git show <SSR commit>~1` 還原成實際檔案後量測 | **TTFB** 中位數 17ms；**首次出現真實數字**（未套動畫前的瞬間，代表真正的 CSR waterfall 成本）中位數 486ms；**數字完全停止變動**（含動畫）中位數 4448ms；**LCP** 中位數 296ms | `add-ssr-lottery-hall-pools` | 5 次樣本：TTFB=[65,14,17,11,17]、首次真實數字=[666,469,486,565,460]、settled=[4587,4406,4421,4524,4448]、LCP=[704,264,272,372,296] |
| 2026-10-02 | `/lottery-hall` | 同上 | SSR 改造後（更正版，同一支改版腳本） | 同上 | **TTFB** 中位數 20ms（跟改造前幾乎沒差，見下）；**首次出現真實數字** 中位數 226ms（真正代表 SSR 省下的 waterfall 時間，約 **2.1 倍**，486ms → 226ms）；**數字完全停止變動** 中位數 226ms（因為沒有動畫所以等於上一欄；約為改造前的 **1/19.7**，但這個倍數裡混了「省掉 waterfall」+「拿掉動畫」兩件事，不要只講這一個數字）；**LCP** 中位數 336ms（跟改造前幾乎沒差，在量測雜訊範圍內，不是退步也不是進步） | `add-ssr-lottery-hall-pools` | 5 次樣本：TTFB=[266,20,22,19,19]、首次真實數字=[575,205,226,305,216]、settled 同首次真實數字、LCP=[988,304,336,444,320]（第 1 次皆含瀏覽器冷啟動，中位數取法已排除離群值影響）。**誠實結論**：TTFB 在本機幾乎沒有代價，是因為這些彩池 API 都是同進程 Nitro 記憶體操作、延遲本來就趨近於 0；正式環境如果换成較慢的外部服務或真實網路呼叫，TTFB 的代價會更明顯，這是 SSR 真實存在、必須誠實揭露的取捨，不能只講好處 |
| 2026-10-02 | `/admin/reports` | 5 個後台報表頁彩首次抓取改用 `useAsyncData`＋`useRequestHeaders(['cookie'])` 轉發；`AdminShell` 權限檢查從 `onMounted` 改成頂層 `await`；`useAuth`/`useAdminAuth` 內部狀態改 `useState()` | SSR 改造前 | `test/perf-ssr-admin-reports.mjs`（沿用 `perf-ssr-lottery-hall.mjs` 同一套 4 指標方法論），已登入 admin cookie，5 次取中位數 | **TTFB** 12ms；**首次真實數字**（`.ard-kpi-num` 第一個元素）390ms；**settled** 390ms；**LCP** 384ms | `add-ssr-admin-reports-cookie-forward` | 5 次樣本：TTFB=[388,13,12,11,11]、首次真實數字=[1158,378,390,365,390]、settled 同首次真實數字、LCP=[1164,400,384,368,380]。基準版本取自 `git stash` 還原全部相關檔案（含 `useAuth.ts`/`useAdminAuth.ts`/`Shell.vue`/5 個報表頁/`api.ts`） |
| 2026-10-02 | `/admin/reports` | 同上 | SSR 改造後 | 同上 | **TTFB** 25ms；**首次真實數字** 485ms；**settled** 485ms；**LCP** 460ms | `add-ssr-admin-reports-cookie-forward` | 5 次樣本：TTFB=[266,25,23,26,21]、首次真實數字=[485,769,611,158,179]、settled 同首次真實數字、LCP=[460,744,596,144,160]（樣本變異明顯比 lottery-hall 大）。**誠實結論：這次中位數比改造前還慢（390ms→485ms），不是進步**。推測原因：這次疊加了兩個非同步相依（AdminShell 權限檢查 2 次 API + 報表資料 1 次 API），SSR 把請求從 client 搬到 server 並沒有減少關鍵路徑的請求數，淨改善天生比 lottery-hall（只有 1 個相依）小；另外用 Playwright 診斷確認畫面內容從第一次偵測到就是穩定值、無 CSR waterfall 典型的「先錯後對」症狀，也用 curl 確認過 SSR 原始回應確實含正確資料——架構正確性是成立的，只是這次瀏覽器端時間指標沒有同步展現優勢，如實記錄不美化 |
| 2026-10-02 | `/admin/reports` | **（追更正）** 使用者重新 code review 指出：上一列「比改造前還慢」的真正原因不是「疊加兩個非同步相依」這個模糊推測，而是 `AdminShell.vue` 的 `guard()` 在 client hydration 階段會無條件重打 `/api/me`、`/api/admin/me`——`resetAdminAuth()` 把 SSR 已經透過 `useState` 水合進來的正確狀態洗掉，等於「伺服器抓一次、瀏覽器又重複抓一次」。修法：`guard()` 開頭加 `if (nuxtApp.isHydrating && checked.value) { sessionReady.value = true; return }`，只在 hydration 這一個時間點跳過重打，client-side 導覽到其他後台頁面時仍會老實重新驗證（曾嘗試用 `useAsyncData` 包住整段 `guard()`，更貼近 `useAdminReportData.ts` 既有模式，但實測發現它的跨元件共用快取會讓「後台頁面間切換重新驗證」也被意外跳過，已放棄改用前述做法，見 `fix-admin-guard-hydration-duplicate-fetch` 的 `design.md`） | 修正後 | `test/perf-ssr-admin-reports.mjs`，同上方法論，5 次取中位數 | **TTFB** 47ms；**首次真實數字** 280ms；**settled** 280ms；**LCP** 248ms——**較改造前 390ms、較改造後有 bug 時的 485ms 都快，這次才是真正的淨改善** | `fix-admin-guard-hydration-duplicate-fetch` | 5 次樣本：TTFB=[64,24,76,30,47]、首次真實數字=[280,697,240,649,202]、settled 同首次真實數字、LCP=[248,652,212,636,188]。驗證方式：Playwright 重整 `/admin/reports`，確認瀏覽器端 `/api/me`／`/api/admin/me` 呼叫數從修正前的各 1 次（共 2 次冗餘）歸零；另外驗證 client-side 導覽到 `/admin/roles` 時兩者仍各正常重打 1 次，確認「每次掛載都重新驗證 session」的既有設計沒有被破壞。**完整故事**：SSR 做了卻一度變慢，追查後發現是 hydration 階段的重複請求，不是 SSR 架構本身的問題；修正重複請求後，才顯現出 SSR 應有的效益 |

## 欄位說明

- **變更**：對應的 openspec change id（例如 `add-ssr-lottery-hall-pools`）
- **情境**：`SSR 改造前` / `SSR 改造後`，同一次變更至少要有一前一後兩列才能對比
- **量測方式**：寫清楚用什麼工具/指令、跑幾次取什麼統計量（例如「`test/perf-ssr-lottery-hall.mjs`，5 次取中位數」）
- **關鍵指標**：不同變更可能量測不同指標（例如「`domcontentloaded` 到真實數字出現的毫秒數」、
  「SSR 回應 HTML 是否含真實資料（是/否）」），各自把單位與定義寫清楚，不要只寫數字
- **對應 change / commit**：方便回頭查對應的 openspec change 或 git commit

---
建立：2026-10-02（隨 `add-ssr-lottery-hall-pools` 規劃階段一併建立，尚未有實際量測數據）
