# Tasks

## 1. 規格與設計確認

- [x] 完成 proposal 定稿（範圍/風險/驗證方式，已確認只動 `lottery-hall.vue`，排除所有
      需要登入態的頁面）
- [x] 完成 design 定稿（`useAsyncData` 轉換方式、SSR 初始值不觸發動畫的邊界、效能量測機制、
      歷史列表格式）
- [x] Figma 對照清單 — 不適用（無版面變動）

## 2. 基準量測（Implementation 開始前，先量「改造前」的數據）

- [x] 在目前 `main`（改造前）跑 `test/perf-ssr-lottery-hall.mjs`（這支腳本本身先寫好，
      再用 `git stash` 暫時還原頁面改動量到基準值）
- [x] 記錄 5 次量測結果與中位數（4526/4464/4419/4417/4415ms，中位數 4419ms）

## 3. `lottery-hall.vue` 改造

- [x] 新增 `useAsyncData('lottery-hall-pools', ...)`，fetcher 內容比照現有 `_fetchPools`
      的 try/catch 容錯邊界（單一彩種失敗回 `null`，不阻斷其他彩種）
- [x] `displayPools` 初始化邏輯：用 `initialPools.value` 直接賦值，不經過 `_animatePoolTo`/RAF
- [x] `onMounted` 內的 `_fetchPools()` 改成條件判斷：SSR 已有初始值就跳過、只掛 `setInterval`；
      沒有初始值才 fallback 呼叫一次
- [x] 確認 `setInterval(_fetchPools, 10000)`、`onBeforeUnmount` 清理、`_animatePoolTo` 動畫
      邏輯**完全沒有被刪除或精簡**
- [x]（規劃階段未預見、Implementation 時發現必須一併處理）`state.list` 的 `init()` 原本只在
      `onMounted` 呼叫，SSR 階段 `state.list` 是空的，導致 `games-grid` 整組卡片（連同剛做好
      的彩池 SSR 資料）都不會出現在 SSR 回應裡——`GET_CONT.lotteryAll()` 是讀靜態設定的純函式，
      已改成在 setup 階段同步呼叫一次，`onMounted` 不再重複呼叫
- [x]（規劃階段未預見、Implementation 時發現必須一併處理）`app/services/api.ts` 原本
      `import { $fetch } from 'ofetch'`，裸 ofetch 在 Node（SSR）環境呼叫相對路徑會直接噴
      `Failed to parse URL`（已實測確認），改成不自行 import、改用 Nuxt 自動注入且有 SSR
      情境感知能力的全域 `$fetch`——這個決定會讓影響面超出「只動 lottery-hall.vue」的原訂範圍

## 4. 錯誤處理與體驗

- [x] `initialPools.value` 為 `undefined`（SSR 失敗/被跳過）時的防呆：`displayPools` 初始化時
      用 `initialPools.value ?? {}` 擋，不讓整頁因此出錯
- [x] 確認 11 個彩種其中任一個 API 逾時/失敗時，SSR 回應不會被卡住太久：~~新增
      `withTimeout()` 包住每個 fetcher~~ **已在第 7 節第 3 項改成 ofetch 內建 `timeout`**，
      不讓單一卡住的端點拖垮整頁 SSR 回應

## 5. 效能量測（改造後）

- [x] 改造後跑 `test/perf-ssr-lottery-hall.mjs`（`SCENARIO=after`），5 次取中位數
      （682/189/174/215/178ms，中位數 189ms；第 1 次含瀏覽器冷啟動）
- [x] 把「改造前」「改造後」兩組數據一起寫進
      `docs/Engineering Evidence/ssr-performance-log.md`（新增列，不覆寫既有內容）

## 6. 驗證與交付檢查

- [x] `curl` 驗證 SSR 回應的 HTML 內含真實彩池數字（15 張卡片的 `data-pool-value` 屬性皆有
      正確金額）
- [x] 用 Playwright 檢查瀏覽器 console：`networkidle` 後無任何 hydration/mismatch 相關警告
- [x] 確認 `npm run dev` 正常啟動，`npm test`（36 支既有測試）全數通過不受影響
- [x] 抽查其他依賴 `app/services/api.ts` 的頁面（`/`、`/lottery-hall-taiwan`、`/game-hall`、
      `/admin`、`/login`）皆仍正常回應 HTTP 200
- [x] 變更檔案與風險說明整理完成，已進入 Validation 階段（見 `validation.md`）

## 7. Review 修正（4 項問題）

- [x] **效能數字框架誤導**：`test/perf-ssr-lottery-hall.mjs` 改版，同時量 TTFB／首次真實
      數字／settled／LCP 四項指標；重新確認「改造前」基準點是真正原始 CSR 版本（用
      `git show <commit>~1` 還原，不是中途已 commit 的半成品）；更正後數據：首次真實數字
      486ms→226ms（約 2.1 倍，真正的 SSR 效益），settled 4448ms→226ms（約 19.7 倍，但
      大部分來自跳過動畫，不是 SSR 本身），TTFB 17ms→20ms（本機幾乎無差異，正式環境
      換較慢服務會更明顯）
- [x] **「SSR 抓不到 cookie」錯誤觀念**：改寫 `proposal.md`／`docs/Architecture/README.md`
      對應段落，說明 `useRequestFetch()`／`useRequestHeaders(['cookie'])` 技術上可以轉發
      cookie，這次不轉換登入頁面是刻意的範圍限縮（分開驗證 SSR 資料獲取 vs SSR 登入態），
      不是技術做不到
- [x] **`withTimeout()` 計時器沒清掉、底層請求沒真的中止**：移除自刻的 `Promise.race`
      wrapper，改用 ofetch 內建 `timeout`（已讀原始碼確認用真正的 `AbortController`，
      完成時會 `clearTimeout`），把 `{ timeout: 3000 }` 加到 `api.ts` 24 個相關函式上
- [x] **`await useAsyncData` 卡住 client-side 導覽**：加上 `{ lazy: true }`，
      `displayPools` 初始化改成 `watch(initialPools, ..., { immediate: true })` 反應式
      灌值；用 Playwright 點擊真實 `NuxtLink` 驗證 client-side 導覽耗時 184ms、不被 15 個
      API 卡住
- [x] 修正後重新驗證：`curl` SSR 含真實數字、`npm test` 36/36 全過、Playwright 導覽與
      hydration 檢查皆過

## 8. 實機回饋：補回首次載入動畫（UX）

- [x] 確認「彩池金額沒有跳動」不是 bug：10 秒輪詢正常運作，是本機 dev 環境彩池數字本來
      就靜止（直接查 API 確認 5 秒內無變化）
- [x] 確認真正原因：首次載入刻意不經過 `_animatePoolTo`，犧牲了原本的視覺效果
- [x] 決定處理方式：SSR 仍顯示最終值，`onMounted` 後補一次
      從 0 跳到實值的動畫
- [x] 實作並用 Playwright 驗證：SSR 正確值 → 重置 0 → 平滑爬升回去，無 hydration
      mismatch，`npm test` 36/36 全過
