## ADDED Requirements

### Requirement: 玩法佔比 Donut Chart

玩法分析頁 SHALL 顯示「玩法佔比」Donut Chart。
資料來自選定月份的 `playRanking`。
各玩法以不同顏色區分，圖例列出玩法名稱與百分比。

#### Scenario: 有玩法資料時顯示甜甜圈圖

- **WHEN** 選定月份 playRanking 非空
- **THEN** Donut Chart 顯示各玩法佔比，圖例顯示玩法名稱與百分比

#### Scenario: 無玩法資料時顯示說明

- **WHEN** 選定月份 playRanking 為空陣列
- **THEN** 顯示「目前月份沒有含玩法識別碼的訂單」

### Requirement: 玩法統計表格

玩法分析頁 SHALL 在 Donut Chart 下方顯示「玩法統計」表格。
欄位：玩法名稱、銷售額（coin）、注數、佔比。
僅顯示有 playKey 的訂單統計，並附加說明文字。

#### Scenario: 顯示玩法統計

- **WHEN** 選定月份 playRanking 非空
- **THEN** 表格顯示各玩法的銷售額、注數、佔比，按銷售額降冪

### Requirement: 月份篩選（玩法分析）

玩法分析頁 SHALL 提供月份篩選器（與 Dashboard 相同互動方式）。

#### Scenario: 切換月份重新載入

- **WHEN** 管理員切換月份
- **THEN** Donut Chart 與統計表格均依新月份重新載入

