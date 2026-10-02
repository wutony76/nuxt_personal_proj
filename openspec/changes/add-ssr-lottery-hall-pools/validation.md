# Validation

## 驗證範圍

- 對應變更：`add-ssr-lottery-hall-pools`
- 驗證環境：本機 dev server（`http://localhost:6100`，既有長跑的 dev server，非另開新 port）

## 功能驗證

- 依 proposal 的「成功標準」逐項驗證：
  - [x] `lottery-hall.vue` 首次 SSR 回應的 HTML 內含真實彩池數字 — 實際結果：
    `curl -s http://localhost:6100/lottery-hall | grep -o 'data-pool-value="[A-Za-z0-9-]*"[^<]*>[0-9,]*'`
    印出 15 筆（含 CD/OF 共用池重複顯示的卡片），每一筆都有正確金額，例如
    `data-pool-value="6HC-OF" ...>2,301,430`
  - [x] 既有 10 秒輪詢與數字動畫行為不變 — 實際結果：程式碼走讀確認
    `setInterval(_fetchPools, 10000)`、`_animatePoolTo`、`onBeforeUnmount` 清理這三段
    完全沒有被刪除或改寫，只有 `onMounted` 內是否要「立即補呼叫一次」多了一個條件判斷
  - [x] `test/perf-ssr-lottery-hall.mjs` 量測出具體數據 — 實際結果：見下方「回歸驗證」
        與 `docs/Engineering Evidence/ssr-performance-log.md`
  - [x] 具體效能數據寫入歷史列表文件 — 實際結果：已新增兩列（改造前/改造後）到
        `ssr-performance-log.md`，未覆寫既有內容

## 視覺驗證

- 不適用（沒有版面/Figma 變動，純資料獲取時機改變）

## 回歸驗證

- 受影響既有流程檢查：
  - 流程：`lottery-hall.vue` 本身的所有互動（進場按鈕 `click.start`、10 秒輪詢更新、
    數字動畫）
  - 結果：Playwright 檢查瀏覽器 console（`networkidle` 後等待 1 秒）無任何
    hydration/mismatch 相關警告；程式碼層面輪詢與動畫邏輯未變動
  - 流程：效能量測（改造前 baseline vs 改造後）
  - 結果：
    - 改造前（`git stash` 暫時還原後量測）：5 次樣本 `4526/4464/4419/4417/4415ms`，
      中位數 **4419ms**
    - 改造後：5 次樣本 `682/189/174/215/178ms`，中位數 **189ms**（第 1 次含瀏覽器冷啟動，
      拿掉後 4 次樣本落在 174~215ms 區間，相當穩定）
    - 改善幅度：約為改造前的 1/23
  - 流程：`app/services/api.ts` 這個全站共用檔案被改動（移除 `ofetch` 顯式 import）
  - 結果：
    - `npm test`（36 支既有 `test:*` 腳本，涵蓋台彩/BG/retro/童玩/角色權限/聊天室）全數通過，
      這些腳本雖然不透過 `api.ts`（它們是獨立打 HTTP 的 Node 腳本），但能確認 server 端
      行為與既有功能未受影響
    - 抽查其他依賴 `api.ts` 的頁面：`/`、`/lottery-hall-taiwan`（有實際 api 呼叫：
      `api.games.toys.catalog()`）、`/game-hall`、`/admin`、`/login` 皆回應 HTTP 200

## 問題與修正紀錄

- 問題：Implementation 開始後發現 `state.list`（驅動 `games-grid` 卡片列表）只在
  `onMounted` 初始化，SSR 階段永遠是空陣列，導致即使彩池資料 SSR 成功，畫面上也沒有
  卡片可以顯示這些數字（`games-grid` 整組是空的）
  - 發現方式：第一次 `curl` 驗證時，`__NUXT_DATA__` payload 裡確實看到 11 個彩種的真實數字，
    但 HTML 裡 `games-grid` 是空的、找不到任何 `data-pool-value`
  - 修正方式：確認 `GET_CONT.lotteryAll()` 是讀靜態設定的純函式、無瀏覽器相依，把 `init()`
    的呼叫從 `onMounted` 移到 setup 階段同步執行
  - 是否已重新驗證：已重新驗證，修正後 `curl` 可以在 HTML 裡找到全部 15 張卡片的
    `data-pool-value` 與正確金額
- 問題：`app/services/api.ts` 用裸 `ofetch` 的 `$fetch`，在 SSR 呼叫相對路徑會直接噴
  `Failed to parse URL`
  - 發現方式：對照 `app/middleware/game-access.global.ts` 既有註解提到「SSR 這裡用的是
    裸 $fetch，不會帶到瀏覽器目前的 session cookie」，進一步追查後用純 Node 腳本實測
    確認裸 ofetch 對相對路徑在 Node 環境必定失敗（非只是不帶 cookie，是整個請求失敗）
  - 修正方式：這個修正會讓影響面超出原訂「只動 `lottery-hall.vue`」的範圍，**先用
    AskUserQuestion 跟使用者確認**（選項：改 api.ts 一行 / 在 lottery-hall.vue 本地重寫
    11 個端點呼叫 / 先暫停），使用者選擇「改 api.ts 一行（建議）」後才動手
  - 是否已重新驗證：已重新驗證，見上方「回歸驗證」

## 結論

- 是否通過：**通過**
- 已知限制或風險：
  - 效能量測在本機 dev 環境進行（非正式站），數字僅供「改前改後相對比較」參考；
    正式站的網路延遲、伺服器負載與本機不同，絕對數字會不一樣，但「SSR 消除 4 秒動畫
    等待」這個結構性改善不受環境影響
  - `withTimeout()` 的 3 秒逾時門檻是經驗值，沒有實際量測過 11 個彩種 API 在各種負載下
    的真實回應時間分布，之後若發現誤判（正常回應被判定逾時）需要回頭調整
- 後續追蹤事項：
  - `app/pages/lottery-hall-taiwan.vue` 的 `api.games.toys.catalog()`（proposal.md
    列為候選、本次不做）：可以用同樣的模式比照辦理，等這次的方法論穩定後再評估
  - `app/services/api.ts` 的 SSR 相容性問題已經修好（拿掉裸 ofetch import），理論上
    之後任何頁面想比照這次的模式做 SSR 轉換，都不會再卡在這個問題上——這是這次意外
    修掉的一個全站層級的基礎設施問題，值得之後有需要時再利用
