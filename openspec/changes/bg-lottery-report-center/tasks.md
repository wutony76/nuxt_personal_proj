## 1. 依賴套件安裝

- [x] 1.1 安裝 `vue-chartjs@5` 與 `chart.js@4`（`npm install vue-chartjs chart.js`）

## 2. 後端 API

- [x] 2.1 新增 `server/api/admin/reports/bg-summary.get.ts`：接受 `?month=YYYY-MM`，對 `Storage.lottery.orders` 進行月份聚合，回傳 `totalSales / totalOrders / commission / dailySales / gameRanking / playRanking / dataNote`
- [x] 2.2 在 `app/services/api.ts` 的 `api.admin` 底下新增 `reports: { bgSummary(month) }` 方法（TypeScript）

## 3. 路由重構

- [x] 3.1 將 `app/pages/admin/reports.vue` 重新命名為 `app/pages/admin/reports/index.vue`（報表中心入口頁，含 4 個子頁導覽卡）
- [x] 3.2 確認 Nuxt file-based routing `/admin/reports` 仍能正常導向 `reports/index.vue`

## 4. 共用元件

- [x] 4.1 新增 `app/components/admin/ReportsNav.vue`：報表子頁內部導覽列（Dashboard / 銷售分析 / 玩法分析 / 月結算），沿用 `abl-tabs` 同款樣式
- [x] 4.2 新增月份篩選器區塊（inline 於各子頁或抽成 `app/components/admin/MonthPicker.vue`）：上月 / 本月 / 下月按鈕 + 當前月份顯示

## 5. 營業 Dashboard 子頁

- [x] 5.1 新增 `app/pages/admin/reports/dashboard.vue`，使用 `<AdminShell active="reports">`
- [x] 5.2 實作月份 `ref` 狀態（`YYYY-MM`），預設當月，點擊上月/本月/下月切換
- [x] 5.3 呼叫 `api.admin.reports.bgSummary(month)` 取得資料，處理 loading / error / empty 三段狀態
- [x] 5.4 實作 4 個 KPI 卡片（月銷售額、月佣金、交易筆數、兌獎說明），沿用 `admin-panel + admin-grid1` 樣式
- [x] 5.5 以 `vue-chartjs` 的 `<Line>` 元件實作「本月銷售趨勢」折線圖，以 `<ClientOnly>` 包裹，X 軸每日、Y 軸銷售額，套用後台黑白配色
- [x] 5.6 實作「彩種排行」列表，以自製比例 bar 呈現（沿用 `abl-bar` 樣式），無資料時顯示 Empty 說明

## 6. 銷售分析子頁

- [x] 6.1 新增 `app/pages/admin/reports/sales.vue`，使用 `<AdminShell active="reports">`
- [x] 6.2 實作月份篩選器
- [x] 6.3 以 `vue-chartjs` 的 `<Bar>` 元件實作「月銷售趨勢」Bar Chart（X 軸：有資料的月份，Y 軸：銷售額），以 `<ClientOnly>` 包裹
- [x] 6.4 實作「玩法排行」Horizontal Bar Chart（`<Bar>` 設定 `indexAxis: 'y'`），顯示玩法名稱、銷售額、佔比；附加資料說明
- [x] 6.5 實作無資料 Empty 狀態

## 7. 玩法分析子頁

- [x] 7.1 新增 `app/pages/admin/reports/plays.vue`，使用 `<AdminShell active="reports">`
- [x] 7.2 實作月份篩選器
- [x] 7.3 以 `vue-chartjs` 的 `<Doughnut>` 元件實作「玩法佔比」Donut Chart，以 `<ClientOnly>` 包裹
- [x] 7.4 實作「玩法統計」表格（玩法名稱 / 銷售額 / 注數 / 佔比），沿用 `admin-table` 樣式
- [x] 7.5 無玩法資料時顯示 Empty 說明

## 8. 月結算子頁

- [x] 8.1 新增 `app/pages/admin/reports/settlement.vue`，使用 `<AdminShell active="reports">`
- [x] 8.2 實作月份篩選器
- [x] 8.3 呼叫 `api.admin.reports.bgSummary(month)` 取得結算摘要
- [x] 8.4 實作月結算摘要卡（銷售收入、估算佣金＋說明小字、交易筆數、兌獎說明），沿用 `admin-panel + admin-grid1` 樣式
- [x] 8.5 無資料時顯示 Empty 狀態，不顯示 $0

## 9. 樣式整合

- [x] 9.1 確認各 Chart 使用 `--ink / --muted / --line` token 作為配色（Chart.js 的 `backgroundColor / borderColor`），維持後台黑白風格
- [x] 9.2 確認 Responsive：KPI grid 在 ≤900px 改為單欄；Chart 設定 `responsive: true, maintainAspectRatio: false`
- [x] 9.3 確認所有新頁面 `<AdminShell active="reports">` 使得頂部導覽「報表分析」呈 active 狀態

## 10. 驗證

- [x] 10.1 `npm run build` 通過，無 ERROR
- [ ] 10.2 進行一次 BG 彩票（如 K3）投注，再進入 Dashboard，確認 KPI 顯示實際資料
- [ ] 10.3 確認月份切換上月/下月/本月資料正確更新
- [ ] 10.4 確認無資料月份顯示 Empty State，無 $0 假資料
- [ ] 10.5 確認 Chart 在 Desktop / Tablet / Mobile 縮放正常
