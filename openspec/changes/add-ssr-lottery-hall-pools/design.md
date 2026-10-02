# Design

## 1. 現況程式碼（不動的部分，先列出來當基準）

```ts
// app/pages/lottery-hall.vue（現況）
const POOL_FETCHERS: Record<string, () => Promise<number>> = { /* 11 個彩種 */ }

const _animatePoolTo = (key: string, target: number) => { /* requestAnimationFrame 數字跑動畫 */ }

const _fetchPools = async () => {
  await Promise.all(Object.entries(POOL_FETCHERS).map(async ([key, fetcher]) => {
    try {
      _animatePoolTo(key, await fetcher())
    } catch { /* 該彩種彩池取不到不阻斷畫面，維持上一次的顯示值 */ }
  }))
}

let poolTimer: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  init()
  _fetchPools()
  poolTimer = setInterval(_fetchPools, 10000)
})

onBeforeUnmount(() => {
  if (poolTimer) clearInterval(poolTimer)
  Object.values(_poolRaf).forEach((id) => cancelAnimationFrame(id))
})
```

`setInterval`／`_animatePoolTo`／`onBeforeUnmount` 清理這整段**原封不動**，本次只動「第一次」
資料從哪裡來、什麼時候來。

## 2. State 設計

- 新增 `const { data: initialPools } = await useAsyncData('lottery-hall-pools', async () => {
  const entries = await Promise.all(Object.entries(POOL_FETCHERS).map(async ([key, fetcher]) => {
    try { return [key, await fetcher()] as const } catch { return [key, null] as const }
  }))
  return Object.fromEntries(entries)
})`
  - 容錯邊界整個照搬 `_fetchPools` 既有的 try/catch（單一彩種失敗回 `null`，不阻斷其他彩種）
- `displayPools`（既有 reactive 物件，目前由 `_animatePoolTo` 寫入）新增一個初始化步驟：
  在 setup 階段（SSR 與 client 都會跑到）用 `initialPools.value` **直接賦值**（不經過
  `_animatePoolTo`／RAF），讓 SSR 渲染出來的 HTML 就是最終數字，client hydrate 時也是
  同一份數字，不會有 hydration mismatch，也不會「先 0 再跑一次動畫」
- `onMounted` 裡的 `_fetchPools()` 這一行**改成條件判斷**：如果 `initialPools` 已經有值
  （代表 SSR 階段已經抓過），略過這次 client 端的重複抓取，直接進入
  `poolTimer = setInterval(_fetchPools, 10000)`；如果 `initialPools` 沒值（例如 SSR 被
  跳過、或是 client-only 導覽進來），才 fallback 呼叫一次 `_fetchPools()` 補上

## 3. Interaction Flow（click / actions / _handlers）

不變。`click.start`（進入某個玩法）、`_handlers.buildCards`／`hasPool`／`enterDelay` 這些
都跟資料獲取時機無關，不需要調整。

## 4. API Contract

### `useAsyncData('lottery-hall-pools', fetcher)`

- key：固定字串 `'lottery-hall-pools'`（跟路由無關，因為這個頁面只有一個，不需要動態 key）
- fetcher 回傳：`Record<string, number | null>`（彩種 key → 金額，取不到回 `null`）
- error 處理：fetcher 內部已經用 try/catch 吞掉單一彩種的失敗，`useAsyncData` 本身的
  `error` 不預期會有值（除非 11 個全部同時失敗這種極端情況），仍然要在 template 或
  `displayPools` 初始化那段對 `initialPools.value` 可能是 `undefined`（SSR 失敗/被跳過）
  做防呆，fallback 成全部 0（不要讓整頁因此 500 或白畫面）

## 5. 錯誤處理與可觀測性

- loading / success / error state：
  - `useAsyncData` 本身的 `pending` 不需要特別處理 loading UI（SSR 直接吐最終數字，
    不會有「前端 loading 中」這個狀態給使用者看到）
  - error：單一彩種層級已經吞掉；`useAsyncData` 整體 fetcher 拋出例外（理論上不會，
    因為內部已經 try/catch 每一項）屬於防禦性邊界，記錄 console.error 即可，不阻斷頁面
- 使用者提示方式：不需要新增任何 UI 提示，行為對使用者而言應該「看不出差異」，
  差異只在「首次看到數字的時間點」

## 6. 測試與驗證策略（含效能量測機制設計）

### 6.1 功能驗證

- `curl -s http://localhost:6100/lottery-hall | grep -oE '"displayPools":\{[^}]*\}'`
  或直接搜尋某個已知會出現的金額格式，改造前應該抓不到（只有骨架），改造後抓得到
- 人工瀏覽器驗證：Network 分頁節流成 Slow 3G，確認首屏不再有「數字從 0 跳到真實值」的
  現象（那個現象應該只在 10 秒輪詢更新時出現，不該在首次載入出現）

### 6.2 效能量測腳本：`test/perf-ssr-lottery-hall.mjs`

延續 `test/` 資料夾既有慣例（獨立可執行的 `.mjs`，不依賴測試框架），用專案已經裝好但
從未實際使用過的 `playwright`：

```js
// 概念骨架，Implementation 階段再寫實際程式碼
import { chromium } from 'playwright'

const browser = await chromium.launch()
const page = await browser.newPage()

const t0 = Date.now()
await page.goto('http://localhost:6100/lottery-hall', { waitUntil: 'domcontentloaded' })
// 用實際金額欄位的 selector（視改造後的 template 決定，例如 [data-pool-value]）
await page.waitForFunction(() => {
  const el = document.querySelector('[data-pool-value]')
  return el && el.textContent.trim() !== '' && el.textContent.trim() !== '0'
})
const t1 = Date.now()

console.log(JSON.stringify({ scenario: process.env.SCENARIO ?? 'unknown', msUntilRealNumber: t1 - t0 }))
await browser.close()
```

- 跑法：
  - 改造前（baseline）：`git stash` 回到改造前的程式碼（或在 feature branch 上對 `main`
    跑一次），`SCENARIO=before node test/perf-ssr-lottery-hall.mjs`
  - 改造後：`SCENARIO=after node test/perf-ssr-lottery-hall.mjs`
  - 兩種情境各跑 5 次取中位數，避免單次量測被系統抖動誤導
- 量測的是「`domcontentloaded` 到『畫面出現非零真實數字』的時間差」，這個指標直接對應
  「使用者感受到的首屏資料就緒時間」，比單純比較 TTFB 更貼近實際體感差異

### 6.3 效能數據記錄格式：`docs/Engineering Evidence/ssr-performance-log.md`

這份文件**不是**本次變更專屬的一次性快照，是跨變更持續累積的歷史列表——之後任何頁面做
SSR 或其他效能相關改造，都直接往同一張表加列，不要另開新檔案、不要覆寫或刪除既有列：

```markdown
# SSR / 效能改造量測歷史

> 持續累積的歷史列表。新增量測結果請在表格「新增一列」，不要修改或刪除既有列；
> 若某次量測發現先前數據有誤，在「備註」欄註明並補一列更正紀錄，保留原始列。

| 日期 | 頁面 | 變更 | 情境 | 量測方式 | 關鍵指標 | 對應 change / commit | 備註 |
|---|---|---|---|---|---|---|---|
| （本次變更 Implementation 完成後才會有第一列） | | | | | | | |
```

- 欄位說明：
  - 「變更」：對應的 openspec change id（例如 `add-ssr-lottery-hall-pools`）
  - 「情境」：`SSR 改造前` / `SSR 改造後`，同一次變更至少要有一前一後兩列才能對比
  - 「量測方式」：寫清楚用什麼工具/指令（例如 `test/perf-ssr-lottery-hall.mjs`，5 次取中位數）
  - 「關鍵指標」：本次是「`domcontentloaded` 到真實數字出現的毫秒數」，其他變更可能用
    不同指標，各自寫清楚單位
