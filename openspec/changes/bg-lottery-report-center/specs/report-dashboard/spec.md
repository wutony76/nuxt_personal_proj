## ADDED Requirements

### Requirement: 報表中心入口頁

`/admin/reports` SHALL 顯示報表中心入口，包含四個子頁快速連結卡：
「營業 Dashboard」、「銷售分析」、「玩法分析」、「月結算」。

#### Scenario: 已登入管理員看到入口

- **WHEN** 管理員導覽至 `/admin/reports`
- **THEN** 頁面顯示四個子頁卡片，各自有標題、說明文字與進入連結

### Requirement: 月份篩選器

Dashboard 頁 SHALL 在頁面頂部提供「月份篩選器」，顯示目前選定月份（格式 `YYYY / MM`），
並提供「‹ 上月」與「下月 ›」兩個按鈕，以及「本月」快速捷徑。

月份篩選器 SHALL NOT 提供日期範圍、今日、昨日、本週等其他選項。

#### Scenario: 進入 Dashboard 時顯示當月

- **WHEN** 管理員進入 `/admin/reports/dashboard`
- **THEN** 月份篩選器預設顯示當月（如 `2026 / 09`）

#### Scenario: 點擊上月切換到前一個月

- **WHEN** 管理員點擊「‹ 上月」按鈕
- **THEN** 月份顯示切換為前一個月，KPI 與 Chart 重新載入

#### Scenario: 點擊本月回到當月

- **WHEN** 管理員先切換到非當月，再點擊「本月」按鈕
- **THEN** 月份切換回當月

### Requirement: KPI 卡片

Dashboard 頁 SHALL 顯示 4 個 KPI 卡片：月銷售額、月佣金、交易筆數，以及「兌獎資料說明」。
所有數值基於 `bg-summary` API 回傳資料。

月銷售額格式：`$N,NNN,NNN`（千位逗號，不含小數）  
月佣金格式：`$N,NNN,NNN`  
交易筆數格式：`N,NNN`  
兌獎欄位：顯示「詳見玩家紀錄」說明，不顯示 $0 假資料。

#### Scenario: 有資料時顯示實際數值

- **WHEN** 選定月份有 BG 彩票訂單資料
- **THEN** 月銷售額顯示實際 totalSales，格式化為千位逗號金額

#### Scenario: 無資料時顯示 Empty 狀態

- **WHEN** 選定月份無任何 BG 彩票訂單資料
- **THEN** 4 個 KPI 卡片顯示「目前月份沒有可用的銷售資料」說明，不顯示 $0

#### Scenario: 載入中顯示 Loading 狀態

- **WHEN** API 呼叫尚未完成
- **THEN** 顯示 loading 指示，KPI 數值區域顯示骨架或 loading 文字

### Requirement: 當月銷售趨勢折線圖

Dashboard 頁 SHALL 在 KPI 卡片下方顯示「本月銷售趨勢」折線圖。
- X 軸：當月每一天（`09/01` ～ `09/30`）
- Y 軸：每日銷售金額（coin）
- 使用 `vue-chartjs` + `chart.js` 渲染，以 `<ClientOnly>` 包裹

#### Scenario: 顯示當月每日銷售

- **WHEN** 選定月份有資料
- **THEN** 折線圖顯示 dailySales 資料，有銷售的日子顯示對應金額

#### Scenario: 無資料時折線圖顯示 Empty

- **WHEN** 選定月份無資料
- **THEN** 不顯示折線圖，顯示「目前月份沒有可用的銷售資料」

### Requirement: 玩法排行（彩種維度）

Dashboard 頁下方 SHALL 顯示「彩種排行」，列出目前月份各彩種銷售排行。
資料來自 `bg-summary` API 的 `gameRanking`。

#### Scenario: 有資料時顯示排行

- **WHEN** 選定月份有資料
- **THEN** 顯示各彩種名稱、銷售金額、佔比 bar，按銷售額降冪

#### Scenario: 無資料時顯示說明

- **WHEN** 選定月份 gameRanking 為空陣列
- **THEN** 顯示「目前月份沒有彩種銷售資料」

