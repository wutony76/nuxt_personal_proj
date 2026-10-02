# SSR / 效能改造量測歷史

> 這份文件是**跨變更持續累積的歷史列表**，跟其他 `docs/Engineering Evidence/*.md`
> （一個變更一份、寫完就定案的快照文件）不同——任何頁面做 SSR 轉換或其他效能相關改造，
> 都直接在下面的表格「新增一列」，不要另開新檔案、不要修改或刪除既有列。
> 若某次量測事後發現數據有誤，在「備註」欄註明並補一列更正紀錄，保留原始列不刪除。

## 量測歷史

| 日期 | 頁面 | 變更 | 情境 | 量測方式 | 關鍵指標 | 對應 change / commit | 備註 |
|---|---|---|---|---|---|---|---|
| 2026-10-02 | `/lottery-hall` | 彩池首次抓取改用 `useAsyncData`；`state.list` 初始化（`init()`）從 `onMounted` 移到 setup 階段同步執行 | SSR 改造前 | `test/perf-ssr-lottery-hall.mjs`，`BASE_URL=http://localhost:6100`，5 次取中位數 | `domcontentloaded` 到 `.gc__pool-val` 第一個元素文字連續 300ms 不再變動的毫秒數：中位數 **4419ms**（5 次樣本：4526/4464/4419/4417/4415） | `add-ssr-lottery-hall-pools` | 用 `git stash` 暫時還原 `app/pages/lottery-hall.vue`／`app/services/api.ts` 量出的基準值；4 秒上下的數字主要來自 `_animatePoolTo` 的 `POOL_ANIM_MS=4000` 動畫時間，不是網路延遲 |
| 2026-10-02 | `/lottery-hall` | 同上 | SSR 改造後 | `test/perf-ssr-lottery-hall.mjs`，同上，5 次取中位數 | 同上定義：中位數 **189ms**（5 次樣本：682/189/174/215/178，第 1 次含瀏覽器冷啟動） | `add-ssr-lottery-hall-pools` | SSR 回應的 HTML 已直接含真實數字（`curl` 驗證過 15 張卡片的 `data-pool-value` 屬性皆有正確金額），數字從第一次渲染就是最終值、未觸發動畫，約為改造前的 **1/23**（189ms vs 4419ms） |

## 欄位說明

- **變更**：對應的 openspec change id（例如 `add-ssr-lottery-hall-pools`）
- **情境**：`SSR 改造前` / `SSR 改造後`，同一次變更至少要有一前一後兩列才能對比
- **量測方式**：寫清楚用什麼工具/指令、跑幾次取什麼統計量（例如「`test/perf-ssr-lottery-hall.mjs`，5 次取中位數」）
- **關鍵指標**：不同變更可能量測不同指標（例如「`domcontentloaded` 到真實數字出現的毫秒數」、
  「SSR 回應 HTML 是否含真實資料（是/否）」），各自把單位與定義寫清楚，不要只寫數字
- **對應 change / commit**：方便回頭查對應的 openspec change 或 git commit

---
建立：2026-10-02（隨 `add-ssr-lottery-hall-pools` 規劃階段一併建立，尚未有實際量測數據）
