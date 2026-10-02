# Proposal

## 變更名稱

`add-ssr-lottery-hall-pools` — 彩票大廳（`lottery-hall.vue`）彩池首次抓取改用 `useAsyncData`

## 背景

`docs/Architecture/README.md`「為什麼選用 Nuxt」一節批評舊公司專案「完全沒用到 Nuxt 的
`useAsyncData`/`useFetch`，資料永遠在 `onMounted` 裡才打 API，造成 CSR waterfall、白屏」。
實際盤點（本次 session 調查）確認本 repo 目前也是同樣的模式：

- 全專案 `app/` 下 `useFetch(`／`useAsyncData(` 使用次數皆為 **0**
- 94 個 `.vue` 頁面中 74 個用 `onMounted` 才開始抓資料，`nuxt.config.ts` 沒有 `routeRules`
  （SSR 預設開著，但因為發 request 的時機卡在 client-only 生命週期，實質等於全站 CSR）

但**不是所有頁面都該轉**：多數頁面（`lottery/tw/*.vue`、`lottery/bg/*.vue`、`game/*.vue`）
需要登入態判斷，且 `app/middleware/game-access.global.ts` 的既有註解已經明講「SSR 這裡用的是
裸 `$fetch`，不會帶到瀏覽器目前的 session cookie，SSR 側一律會被判定成訪客」——硬轉這些頁面
會造成 hydration mismatch（SSR 吐訪客畫面、client hydrate 後變已登入畫面），且這些頁面本來就
不該被爬蟲看到，SEO 價值是負的。

逐一確認「大廳/選單」類頁面後，真正符合「公開可瀏覽、有真實資料、目前用 `onMounted` 抓」
三個條件的只有 `app/pages/lottery-hall.vue`：

| 頁面 | 是否需登入 | 是否有資料抓取 | 結論 |
|---|---|---|---|
| `lottery-hall.vue` | 否 | 是（11 個彩池/爆池並行 `$fetch`，見 `_fetchPools`） | **本次目標** |
| `taiwan-lottery-hall.vue` | 否 | 否（純 `redirect` 到 `lottery-hall-taiwan.vue`，無內容） | 不適用 |
| `lottery-hall-taiwan.vue` | 否 | 是（`api.games.toys.catalog()`，一次性無輪詢） | 候選，本次不做（見下方「不包含」） |
| `game-hall.vue` | 部分（社交面板需登入） | 否（本身無 `api.*` 呼叫，只有時鐘 `setInterval` 與 `useAuth()`） | 不適用 |

## 目標

- `lottery-hall.vue` 的彩池金額在**首次 SSR 回應的 HTML** 裡就是真實數字，不是 loading 骨架
- 既有「每 10 秒輪詢更新 + 數字跑動畫」的體驗完全保留，不因為改 SSR 而退化
- 留下可重複驗證、會持續累積的效能量測記錄（歷史列表，不是一次性快照，之後其他頁面
  做同樣的改造可以繼續往同一份文件加列）

## 範圍

- 包含：
  - `app/pages/lottery-hall.vue`：`_fetchPools()` 首次呼叫改用 `useAsyncData`，`onMounted`
    內的 `setInterval(_fetchPools, 10000)` 輪詢機制**原封不動保留**，不刪除、不精簡
  - 新增 `test/perf-ssr-lottery-hall.mjs`：用既有裝好但從未使用過的 `playwright`
    （devDependency）量測「DOM 出現真實彩池數字」的時間點，SSR 改造前後各跑一次
  - 新增 `docs/Engineering Evidence/ssr-performance-log.md`：持續累積的效能量測歷史列表
    （非本次變更專屬的一次性快照，往後任何頁面做 SSR/效能相關改造都可以繼續往這份文件加列）
- 不包含：
  - `lottery-hall-taiwan.vue` 的 toy catalog 抓取——候選但本次先不做，等這次的模式驗證過
    （有實際效能數據佐證）後再評估是否比照辦理，避免一次改太多頁面、稀釋驗證重點
  - 任何需要登入態的頁面（`lottery/tw/*`、`lottery/bg/*`、`game/*`、`admin/*`）——
    cookie 轉發與 hydration mismatch 風險不在本次範圍，是否要做需要另外評估 SSR 端
    如何安全轉發 session cookie（`useRequestHeaders(['cookie'])`），風險明顯更高
  - 不移除、不簡化既有的 `setInterval` 輪詢與 `requestAnimationFrame` 動畫邏輯

## 影響面

- 前端頁面：`app/pages/lottery-hall.vue`
- 新增測試/量測腳本：`test/perf-ssr-lottery-hall.mjs`
- 新增文件：`docs/Engineering Evidence/ssr-performance-log.md`（歷史列表）
- **範圍調整（Implementation 階段發現，已跟使用者確認過才動手）**：`app/services/api.ts`
  第一行 `import { $fetch } from 'ofetch'` 改掉——裸 ofetch 在 SSR（Node）環境呼叫相對路徑
  會直接丟錯（已實測確認），不改這一行，`useAsyncData` 轉換完全無法運作。改成不自行
  import、讓 Nuxt 自動注入有 SSR 情境感知能力的全域 `$fetch`，client 端呼叫行為不變
  （同一套 ofetch 底層），但技術上這支 2446 行的檔案被這個全站共用層的 16+ 個頁面引用，
  已抽查其中幾個（`/`、`/lottery-hall-taiwan`、`/game-hall`、`/admin`、`/login`）確認
  仍正常運作，詳見 `tasks.md` 第 3 節與 `validation.md`

## 風險與對策

- 技術風險：
  - 風險：SSR 階段呼叫 11 個彩池 API 若有一個逾時/失敗，可能拖慢或擋住整個 SSR 回應
  - 對策：延用 `_fetchPools` 既有的「單一彩種取失敗不阻斷畫面，維持上一次顯示值」設計
    （見現有程式碼 `catch { /* 該彩種彩池取不到不阻斷畫面 */ }`），`useAsyncData` 轉換後
    一樣要保留這個容錯邊界，並個別評估是否需要幫 SSR 這條路徑加逾時上限
  - 風險：首次 SSR 渲染沒有 `requestAnimationFrame`（伺服器端不存在動畫概念），直接顯示
    最終數字；如果沒處理好，client hydrate 時可能會「又從 0 跑一次動畫」，觀感上倒退
  - 對策：hydrate 後的既有 10 秒輪詢屬於「後續更新」，動畫邏輯只在這類後續更新時觸發；
    SSR 帶來的初始值視為「起始狀態」而非「一次更新」，不應該觸發動畫，需要在 design 階段
    明確定義這個邊界
- UI/UX 風險：
  - 風險：無，公開頁面、無個人化內容差異，不存在 hydration mismatch 的資料面風險

## 驗證方式

- 功能驗證：
  - `curl -s http://localhost:6100/lottery-hall` 的原始 HTML 內要能直接 grep 到當下真實的
    彩池數字（改造前 grep 不到，只有骨架/loading 文案；改造後 grep 得到）
  - 手動在瀏覽器開關 JS 網路節流，確認首屏數字不再是空白/loading，且 10 秒輪詢與動畫效果
    跟改造前主觀體驗一致
- 視覺驗證：不適用（沒有版面/Figma 變動，純資料獲取時機改變）
- 回歸驗證：
  - 確認既有「單一彩種取失敗不阻斷畫面」容錯邏輯在 SSR 路徑一樣成立
  - 確認 10 秒輪詢、動畫、`onBeforeUnmount` 清理計時器等既有行為不受影響

## 成功標準

- [x] `lottery-hall.vue` 首次 SSR 回應的 HTML 內含真實彩池數字（curl 已驗證，15 張卡片皆有
      正確金額）
- [x] 既有 10 秒輪詢與數字動畫行為不變（程式碼未刪除，邏輯僅改「首次資料從哪來」）
- [x] `test/perf-ssr-lottery-hall.mjs` 量測出改造前後「真實數字出現時間」的具體數據
      （改造前中位數 4419ms → 改造後中位數 189ms）
- [x] 具體效能數據寫入 `docs/Engineering Evidence/ssr-performance-log.md`，以歷史列表形式
      呈現（新增列，不覆寫/不刪除既有列）
