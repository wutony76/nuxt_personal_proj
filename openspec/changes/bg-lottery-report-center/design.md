## Context

目前後台（`/admin/**`）已完整建立：
- `AdminShell`：共用 Layout（黑白極簡編輯風）含頂部導覽（總覽／角色權限／遊戲設定／**報表分析**）
- CSS Token：`--ink / --paper / --line / --muted / --wash`，完整的 `admin-*` 工具 class
- 現有子頁：`/admin/index`（總覽）、`/admin/roles`（角色）、`/admin/bg-lottery`（BG 彩票補貼）
- BG 彩票 in-memory 訂單資料：`Storage.lottery.orders[lotteryKey]`，每一筆 `OrderRow` 含 `{ issue, userId, coin, orderId, betCode, tabId, playKey, odds }`

**資料現況：**

| 資料種類 | 來源 | 可用性 |
|---------|------|--------|
| 投注金額（coin）| `Storage.lottery.orders[key]` | ✅ 完整，每筆訂單有 coin |
| 彩種（lotteryKey）| 同上，以 key 分類 | ✅ LHC-OF / LHC-CD / K3 / PK10 / SSC / X5 / EGGS / KL10 / KL8 / FC3D / PL3 |
| 下注期號（issue） | 同上 | ✅ 含時間資訊（issue 字串通常含日期，如 `20260917-001`） |
| 玩法（playKey） | 同上，部分訂單有值 | ⚠️ 有 playKey 的才能統計玩法排行 |
| 兌獎支出（winAmount）| `user-record` API，非 orders 層 | ❌ 無法在後端聚合（需逐人查詢） |
| 佣金 | 無獨立欄位 | ❌ 需定義比率後自行計算（固定比率公式） |
| 月份對應 | issue 字串前 8 碼（YYYYMMDD）| ✅ 可以 parse |

**圖表套件：** 目前無安裝，需新增。

## Goals / Non-Goals

**Goals:**

- 在不修改任何彩票核心邏輯的情況下，在 `/admin/reports` 展示報表中心
- 沿用 `AdminShell` Layout 與所有 `admin-*` CSS class
- 使用 BG 彩票 in-memory 訂單為真實資料來源
- 顯示 Loading / Empty / Error 三段狀態
- 月份篩選器操作一致（上月 / 本月 / 下月，只有月份）
- 安裝 `vue-chartjs` + `chart.js` 渲染折線圖、長條圖、甜甜圈圖
- 以 JavaScript（非 TypeScript）撰寫新的 Vue 元件與 composable

**Non-Goals:**

- 不做日期範圍篩選
- 不做玩法 / 彩種 / 店員 / 搜尋等 Filter
- 不做銷售明細表格與 Pagination
- 不做兌獎支出的精確計算（資料不足，改以佔比估算說明）
- 不連外部資料庫
- 不實作 Mock Data 填補空白

## Decisions

### Decision 1：Chart 套件選用 `vue-chartjs` + `chart.js`

**選擇：** `vue-chartjs@5` + `chart.js@4`

**理由：**
- `chart.js` 業界標準，體積小（~170 KB gzip），支援折線／長條／甜甜圈
- `vue-chartjs` 是官方 Vue 3 wrapper，`<script setup>` 友好
- 無需 SSR 特殊配置，可用 `ClientOnly` 包裹避免水合問題
- 相比 ECharts 或 ApexCharts，bundle size 更小，無過度設計

**替代方案：**
- ECharts（`vue-echarts`）：功能最強，但 bundle 過大（~1 MB gzip）
- Pure CSS bar（自製）：適合簡單 ranking bar，彩種排行可用，但折線圖不適合

### Decision 2：後端 API `GET /api/admin/reports/bg-summary`

**選擇：** 新增一個彙整 API，接收 `?month=YYYY-MM` 參數，回傳：

```ts
{
  month: string           // YYYY-MM
  totalSales: number      // 月總銷售（coin）
  totalOrders: number     // 月總筆數
  commission: number      // 估算佣金（totalSales × 0.07）
  dailySales: Array<{ day: string; sales: number }>  // 當月每日銷售
  gameRanking: Array<{ key: string; name: string; sales: number; orders: number; ratio: number }>  // 彩種排行
  playRanking: Array<{ key: string; name: string; sales: number; orders: number; ratio: number }>  // 玩法排行（有 playKey 才計）
  dataNote: string        // 說明：in-memory 資料、重啟清空
}
```

**佣金計算：** `totalSales × 0.07`（固定比率展示用，實際依業務調整）

**兌獎支出：** 由於 `winAmount` 分散在 user-record 層，月結算頁面顯示：「兌獎資料目前不支援月度彙整，詳見彩票玩法頁的玩家紀錄」

**理由：** 保持後端單一入口，讓前端各報表子頁共用同一組資料（或依 month 各自呼叫），避免重複計算。

### Decision 3：月份篩選 UI

使用目前 `admin-input` + 兩顆 `admin-btn-secondary` 按鈕（「‹ 上月」/ 「下月 ›」）+ 一個文字顯示目前月份，
不使用原生 `<input type="month">`（跨瀏覽器樣式差異大，與 admin 風格不符）。

### Decision 4：報表子頁路由

```
/admin/reports              → 入口總覽（4 個子頁快速連結卡）
/admin/reports/dashboard    → 營業 Dashboard
/admin/reports/sales        → 銷售分析
/admin/reports/plays        → 玩法分析
/admin/reports/settlement   → 月結算
```

使用 Nuxt 4 file-based routing：`app/pages/admin/reports/` 目錄下各建立子頁。
原 `app/pages/admin/reports.vue` 改為目錄 `app/pages/admin/reports/index.vue`。

### Decision 5：不修改彩種判斷邏輯

`issue` 字串格式因彩種不同，部分為 `YYYYMMDD-NNN`，部分為官方期號（民國年格式）。
後端 API 僅處理 `Storage.lottery.orders[key]`（BG 彩票），不包含 TW 彩票訂單（TW 訂單結構不同）。

### Decision 6：Language — JavaScript

新建的 Vue 元件（`.vue`）與 composable 一律使用 `<script setup>`（不加 `lang="ts"`），
後端新 API 仍用 TypeScript（Nitro 規範，保持一致）。

## Risks / Trade-offs

| 風險 | 緩解措施 |
|------|---------|
| In-memory 資料重啟清空，Demo 時資料可能為零 | Empty State 明確說明「目前無資料，請先進行投注操作」 |
| Issue 字串格式不一致，日期 parse 失敗 | 後端做 defensive parse，無法解析的 issue 跳過並記 `dataNote` |
| `vue-chartjs` 5.x 在 SSR 環境水合不匹配 | 全部 Chart 用 `<ClientOnly>` 包裹 |
| 玩法排行只有有 `playKey` 的訂單參與統計 | 排行表加 dataNote 欄說明：「僅計算含玩法識別碼的訂單」 |
| `vue-chartjs` bundle size 增加 | 僅在報表頁 lazy import，使用 `defineAsyncComponent` 或 dynamic import |

## Migration Plan

1. `npm install vue-chartjs chart.js`
2. 新增後端 API（不影響任何既有路由）
3. 重構 `app/pages/admin/reports.vue` → `app/pages/admin/reports/index.vue`
4. 新增子頁、Nav 元件、Composable
5. `api.ts` 小幅擴充（`admin.reports.bgSummary`）

**Rollback：** 若有問題，只需將 `reports/index.vue` 改回 `reports.vue` 並還原 `api.ts`；後端 API 刪除不影響任何既有功能。

## Open Questions

- 月份選擇是否限制為「有資料的月份」或「任意月份」？→ 初版為任意月份，Empty State 提示即可
- 佣金比率 7% 是否需要後台可設定？→ 初版固定，後續可加入 admin 設定
- `vue-chartjs` 或改用純 CSS bar 展示排行是否已足夠？→ 初版用 `vue-chartjs`，排行也可用自製 bar

