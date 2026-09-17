## Why

目前後台 `/admin/reports` 僅有佔位畫面（`AdminComingSoon`），尚未提供任何可用的報表功能。
BG 彩票系統已有投注、結算、彩池補貼等 in-memory 資料，適合以此為基礎展示真實的報表中心 Demo，
作為 Portfolio 展示「後台數據可視化」的核心能力。

## What Changes

- **新增** 報表中心主頁（`/admin/reports`）：取代 `AdminComingSoon`，展示 BG 彩票報表導覽
- **新增** 營業 Dashboard 子頁（`/admin/reports/dashboard`）：月份篩選 + KPI 卡片 + 銷售趨勢 Chart + 玩法排行
- **新增** 銷售分析子頁（`/admin/reports/sales`）：月銷售趨勢 Chart（全年度）+ 玩法排行（Horizontal Bar）
- **新增** 玩法分析子頁（`/admin/reports/plays`）：玩法佔比 Donut Chart + 玩法統計 Table
- **新增** 月結算子頁（`/admin/reports/settlement`）：依月份顯示銷售收入、兌獎支出、佣金彙總
- **新增** 後端 API `GET /api/admin/reports/bg-summary`：彙整 BG 彩票 in-memory 訂單資料，依月份回傳統計
- **修改** `app/pages/admin/reports.vue`：改為報表中心首頁（含子頁導覽）
- **新增** `app/components/admin/ReportsNav.vue`：報表子頁內部導覽列
- **不修改** 任何彩票玩法核心邏輯、投注、開獎、兌獎流程

## Capabilities

### New Capabilities

- `bg-report-summary-api`：後端 BG 彩票統計 API，從 in-memory 訂單資料依月份聚合 KPI（銷售額、兌獎額、佣金、筆數）與彩種排行
- `report-dashboard`：營業 Dashboard 頁，月份篩選 + 4 個 KPI 卡片 + 當月每日銷售趨勢折線圖 + 玩法排行
- `report-sales`：銷售分析頁，全年月銷售趨勢 Bar Chart + 玩法排行 Horizontal Bar Chart
- `report-plays`：玩法分析頁，玩法佔比 Donut Chart + 玩法統計表格（銷售額 / 注數 / 佔比）
- `report-settlement`：月結算頁，依月份顯示銷售收入 / 兌獎支出 / 佣金 / 淨收益

### Modified Capabilities

（無既有 spec 需要修改）

## Impact

**受影響的程式碼：**

| 路徑 | 動作 | 說明 |
|------|------|------|
| `app/pages/admin/reports.vue` | 修改 | 改為報表中心入口頁，含子頁導覽 |
| `app/pages/admin/reports/` | 新增目錄 | 放 dashboard / sales / plays / settlement 四個子頁 |
| `app/components/admin/ReportsNav.vue` | 新增 | 報表子頁共用內部導覽 |
| `server/api/admin/reports/bg-summary.get.ts` | 新增 | BG 彩票月度統計 API |
| `app/services/api.ts` | 修改（小幅擴充）| 在 `api.admin` 新增 `reports.bgSummary()` 方法 |

**資料限制（重要）：**

- BG 彩票訂單為 **in-memory**，伺服器重啟即清空
- 現有資料不含「兌獎支出」欄位（`winAmount` 在 user-record 層，非 orders 層）；月結算的「兌獎支出」目前資料不足，頁面須顯示明確說明
- 現有訂單無「玩法（playKey）」的百分之百完整紀錄（舊版玩法可能無 playKey），玩法排行以有 playKey 的訂單計算，並標示資料完整度
- **無圖表套件**：需新增一套 Chart 套件（建議 `vue-chartjs` + `chart.js`，輕量、Vue 友好）

**不受影響：**

- 彩票玩法邏輯、投注流程、開獎流程、兌獎流程
- 其他後台頁面（總覽、角色、遊戲設定）
- 前台彩票大廳、遊戲頁面
