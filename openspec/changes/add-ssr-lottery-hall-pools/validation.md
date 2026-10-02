# Validation

## 驗證範圍

- 對應變更：`add-ssr-lottery-hall-pools`
- 驗證環境：本機 dev server（`http://localhost:6100`，既有長跑的 dev server，非另開新 port）
- 本檔案分兩階段：第一次 Implementation 後的驗證（第 1~2 節），以及**事後 code review
  發現 4 個問題、逐一修正後的第二次驗證**（第 3 節）——後者是本檔案的主要內容，
  第一版的效能數字已確認**框架誤導**（見下方），已更正。

## 功能驗證

- 依 proposal 的「成功標準」逐項驗證：
  - [x] `lottery-hall.vue` 首次 SSR 回應的 HTML 內含真實彩池數字 — 實際結果：
    `curl -s http://localhost:6100/lottery-hall | grep -o 'data-pool-value="[A-Za-z0-9-]*"[^<]*>[0-9,]*'`
    印出 15 筆（含 CD/OF 共用池重複顯示的卡片），每一筆都有正確金額，例如
    `data-pool-value="6HC-OF" ...>2,301,430`
  - [x] 既有 10 秒輪詢與數字動畫行為不變 — 實際結果：程式碼走讀確認
    `setInterval(_fetchPools, 10000)`、`_animatePoolTo`、`onBeforeUnmount` 清理這三段
    完全沒有被刪除或改寫
  - [x] 效能量測出具體數據 — 見第 3 節（更正版，4 項指標）
  - [x] 具體效能數據寫入歷史列表文件 — 已新增 4 列（2 列原始、2 列更正）到
        `ssr-performance-log.md`，未覆寫或刪除既有內容，照文件自己定的政策處理

## 視覺驗證

- 不適用（沒有版面/Figma 變動，純資料獲取時機改變）

## 回歸驗證（第一次 Implementation 後）

- 流程：`app/services/api.ts` 這個全站共用檔案被改動
- 結果：
  - `npm test`（36 支既有 `test:*` 腳本）全數通過
  - 抽查其他依賴 `api.ts` 的頁面：`/`、`/lottery-hall-taiwan`、`/game-hall`、`/admin`、
    `/login` 皆回應 HTTP 200

## 問題與修正紀錄（第一次 Implementation，規劃階段未預見）

- 問題：`state.list`（驅動 `games-grid` 卡片列表）只在 `onMounted` 初始化，SSR 階段永遠是
  空陣列，導致即使彩池資料 SSR 成功，畫面上也沒有卡片可以顯示這些數字
  - 發現方式：`curl` 驗證時 `__NUXT_DATA__` payload 裡有真實數字，但 HTML 裡 `games-grid`
    是空的
  - 修正方式：確認 `GET_CONT.lotteryAll()` 是讀靜態設定的純函式，把 `init()` 移到 setup
    階段同步執行
  - 是否已重新驗證：已驗證，`curl` 可找到全部 15 張卡片
- 問題：`app/services/api.ts` 用裸 `ofetch` 的 `$fetch`，在 SSR 呼叫相對路徑會直接噴
  `Failed to parse URL`
  - 發現方式：用純 Node 腳本實測確認
  - 修正方式：影響面超出原訂範圍，**先用 AskUserQuestion 跟使用者確認**，選擇「改 api.ts
    一行（建議）」後才動手
  - 是否已重新驗證：已驗證

## 第二次驗證：使用者 code review 後的 4 項修正

使用者在看過第一版 commit 後做了一次完整 review，指出 4 個問題，逐一處理如下。

### 1. 「改善 23 倍」的效能數字框架誤導

- **問題**：第一版量測只量「數字停止變動」一個指標（改造前 4419ms → 改造後 189ms，
  約 23 倍），但改造前的 4419ms 裡約 4000ms 是 `_animatePoolTo` 的 `POOL_ANIM_MS=4000`
  動畫時間，不是網路延遲或 CSR waterfall 的成本。拿這個倍數講 SSR 效益，等於把「拿掉
  動畫」的效果也算進 SSR 頭上，經不起「扣掉動畫還剩多少」這種追問。
- **修正**：重寫 `test/perf-ssr-lottery-hall.mjs`，同時量 4 個指標：
  - **TTFB**：SSR 的代價（伺服器要等資料回來才能送出 HTML）
  - **firstRealNumberMs**：第一次看到非 0 真實數字的時間（真正的 CSR waterfall 成本，
    動畫套用前的瞬間）
  - **settledMs**：數字完全停止變動的時間（含動畫，若有）
  - **lcpMs**：Largest Contentful Paint（瀏覽器原生 PerformanceObserver）
- **重新量測結果**（5 次取中位數，詳細樣本見 `ssr-performance-log.md`）：

  | 指標 | 改造前 | 改造後 | 差異 |
  |---|---|---|---|
  | TTFB | 17ms | 20ms | 幾乎無差異（本機同進程 API，延遲趨近 0；正式環境換成較慢服務會更明顯） |
  | 首次真實數字（waterfall 成本） | 486ms | 226ms | **約 2.1 倍**——這才是 SSR 資料獲取本身的效益 |
  | 完全停止變動（含動畫） | 4448ms | 226ms | 約 19.7 倍，但大部分來自「跳過動畫」，不是 SSR 本身 |
  | LCP | 296ms | 336ms | 幾乎無差異，在量測雜訊範圍內 |

  第一版「改造前基準」實測方法論本身也有誤：量測時不慎用 `git stash` 回退到已經
  commit 的 SSR-v1 版本（還是有 `useAsyncData`），不是真正原始 CSR 版本——這次改用
  `git show <commit>~1` 取出真正原始檔案內容重新量測，確認過真的有看到 0→真實數字的
  動畫過程才採信數據（見下方「問題與修正紀錄」）。
- 是否已重新驗證：已驗證，`ssr-performance-log.md` 新增 2 列更正資料並標註原始 2 列
  「數字正確但框架誤導」

### 2. 「SSR 抓不到 cookie」的錯誤觀念

- **問題**：proposal.md 跟 commit 訊息都寫「需要登入的頁面 SSR 階段抓不到瀏覽器 session
  cookie」，這個說法不精確——Nuxt 的 `useRequestFetch()`／`useRequestHeaders(['cookie'])`
  正是設計來把原始請求的 cookie 轉送給 SSR 階段內部 API 呼叫用的，不是做不到。
- **修正**：改寫 `proposal.md`「背景」與「不包含」兩個段落，明確說明真正的原因是
  （a）`game-access.global.ts` 現有邏輯目前寫死只在 client 端跑，要轉 SSR 需要額外處理
  cookie 轉發，是獨立的一塊工作；（b）這次刻意只示範一個低風險的公開頁面，把 SSR
  資料獲取跟 SSR 登入態轉發這兩個不同難度的問題分開驗證，不要混在一起。`docs/
  Architecture/README.md` 的對應段落同步更正。
- **後續追蹤**：下一次示範建議挑一個需要登入、資料量大的報表類頁面，用
  `useRequestFetch()` 實際做一次 cookie 轉發的 SSR 轉換，這才是架構文件原本真正在
  批評的那類場景（`trend`/`bet_search`），這次的大廳公開頁避開了最該證明的那一類，
  是刻意的範圍限縮，不是迴避。
- 是否已重新驗證：文件修正，不涉及程式碼，無需額外功能驗證

### 3. `withTimeout()` 計時器沒有清掉、底層請求沒有真的中止

- **問題**：第一版用 `Promise.race([fetcher(), new Promise((_,reject)=>setTimeout(...))])`
  包單一彩種逾時，就算 fetch 成功了，那個 `setTimeout` 還是會跑滿 3 秒才被回收；
  如果真的逾時，底層的 HTTP 請求本身也沒有被中止，只是 JS 這層放棄等待，實際請求
  繼續在背景空轉浪費資源。
- **修正**：改用 ofetch 內建的 `timeout` 選項（實測確認其底層用真正的 `AbortController`
  中止請求，且完成時會 `clearTimeout` 自己的計時器，見 `node_modules/ofetch` 原始碼）。
  把 `{ timeout: 3000 }` 直接加到 `app/services/api.ts` 裡這次用到的 24 個彩池/爆池
  相關函式的 `$fetch` 呼叫上（這些函式本來就被另外 20 處呼叫，一併受惠於這個逾時保護，
  不只是 SSR 這次用到的 15 個），完全移除 `lottery-hall.vue` 裡自己刻的 `withTimeout()`。
- 是否已重新驗證：已驗證，`curl` 確認 SSR 回應仍正常含真實數字；`npm test` 36 支
  既有測試重跑全數通過（這些函式被其他 20 處呼叫，確認沒有因為加上 timeout 而破壞
  既有頁面）

### 4. `await useAsyncData` 會卡住 client-side 導覽

- **問題**：用 `await useAsyncData(...)` 時，從別的頁面用 client-side 導覽切到
  `/lottery-hall`，Vue Router 的導覽會被卡住，要等 15 個彩池 API 全部回來（最壞情況
  接近之前量到的 ~500ms，若網路狀況差可能更久）才會真的換頁，使用者體感是「點了連結
  沒反應」。
- **修正**：`useAsyncData` 加上 `{ lazy: true }`——SSR 階段仍然照樣等資料回來才送出
  HTML（這次要的效果不變），但 client-side 導覽不會被卡住。副作用：`initialPools.value`
  在 lazy 情境下一開始會是 `null`（資料在背景抓，還沒到），原本「setup 階段讀一次
  `.value` 做初始化」的寫法不再夠用，改成 `watch(initialPools, ..., { immediate: true })`
  反應式地在資料到達（不管是 SSR 已經有、還是 lazy 之後才到）的當下才把值灌進
  `displayPools`。
- **驗證方式**：用 Playwright 點擊 `/game-hall` 上真正的 `NuxtLink`（client-side 導覽，
  非 `page.goto()` 模擬的整頁載入）切到 `/lottery-hall`，量「網址變更完成」的時間：
  **184ms**（遠低於等 15 個 API 全部回來的時間，證明導覽沒有被卡住）；資料本身在
  329ms 內補齊（彩池數字從 0 變成真實值）。無 hydration/mismatch 警告。
- 是否已重新驗證：已驗證（見上）

## 結論

- 是否通過：**通過**（含 4 項 review 修正後重新驗證）
- 已知限制或風險：
  - 效能量測在本機 dev 環境進行（非正式站），TTFB 幾乎無差異是因為這些 API 都是同進程
    Nitro 記憶體操作；正式環境換成較慢的外部服務時，SSR 的 TTFB 代價會更明顯，必須
    誠實揭露這個取捨
  - ofetch 的 3 秒逾時門檻是經驗值，未實際量測過 24 個函式在各種負載下的真實回應時間
    分布，之後若發現誤判需要回頭調整
  - cookie 轉發（`useRequestFetch()`）尚未實際示範過，下一次若要轉換需要登入的頁面，
    這塊是全新、未驗證過的風險
- 後續追蹤事項：
  - `app/pages/lottery-hall-taiwan.vue` 的 toy catalog 抓取可比照辦理（候選、本次不做）
  - 挑一個需要登入的報表類頁面，用 `useRequestFetch()` 做第二個 SSR + cookie 轉發的示範
    （已完成，見 `add-ssr-admin-reports-cookie-forward`）
  - `app/services/api.ts` 的 SSR 相容性問題與 24 個函式的逾時保護已經修好，之後其他
    頁面比照辦理不會再卡住

## 第三次驗證：使用者實測後要求補回首次載入動畫（UX 回饋）

使用者實際瀏覽頁面後回報「彩池金額沒有跳動，動畫需要跑動」。追查後確認**不是 bug**：

- 10 秒輪詢機制本身運作正常，只是本機 dev 環境沒有真實下注發生，彩池數字
  （`carryJackpot`/`jackpotBase`）本來就是靜止的，直接查 API 間隔 5 秒 3 次皆完全相同，
  輪詢到的值沒變化，自然沒有動畫可跑
- 真正的原因是：這次 SSR 改造刻意讓首次載入直接顯示最終值、不經過 `_animatePoolTo`
  （見本檔第 1 節設計），使用者看到的是「數字一開始就是靜止的」，這是當初為了呼應
  「SSR 省掉 waterfall」而做的設計選擇，但犧牲了原本「數字從 0 跳到定值」的視覺效果

跟使用者確認後（`AskUserQuestion`，選擇「SSR 當下就是最終值，hydrate 後再補一次從 0
跳到實值的視覺效果」），在 `onMounted` 裡補上：先把 `displayPools` 目前已經正確的值
記下來，重置成 0，再用既有的 `_animatePoolTo` 動畫回去。

- **不影響 SSR 本身的正確性**：HTML 回應仍然是正確數字（curl 可驗證），這段重置動畫
  是 mount **之後**才執行的一般 reactive 更新，不是 hydration 當下的比對內容，不會造成
  hydration mismatch
- **實測驗證**（Playwright，輪詢 `.gc__pool-val` 文字變化）：t=321ms 先看到 SSR 正確值
  `3,019,406`（確認 SSR 內容本身沒被動到）→ t=662ms 重置為 `0` → 之後約 4 秒內平滑爬升
  回到原本的數字，`hydration/mismatch` 警告 0 筆
- 重跑一次確認：第一次測試出現一筆單次、不可重現的瞬時負值（`-75,809`），重跑後乾淨
  顯示 `0 → 平滑爬升`，判斷是 Playwright 輪詢當下讀到 DOM patch 過程中的瞬時文字節點，
  不是應用程式邏輯的 bug（已用第二次乾淨的重現結果排除真正的邏輯問題）
- `npm test` 36/36 支既有測試全過，確認這個追加的視覺效果沒有破壞其他功能

**結論**：首次載入的「跳動」視覺效果已經補回來，且不影響 SSR 本身「HTML 回應含真實
資料」這個核心效益——兩者可以並存，不是互斥的取捨。
