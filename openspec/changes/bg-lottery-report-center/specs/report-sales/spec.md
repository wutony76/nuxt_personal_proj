## ADDED Requirements

### Requirement: 月銷售趨勢 Bar Chart（年度視角）

銷售分析頁 SHALL 顯示「月銷售趨勢」Bar Chart，X 軸為月份（有資料的月份），Y 軸為每月銷售金額。
僅顯示實際有資料的月份，不補假資料。

#### Scenario: 顯示有資料的月份

- **WHEN** 管理員進入 `/admin/reports/sales`
- **THEN** Bar Chart 顯示 BG 彩票 in-memory 訂單中有記錄的每個月份銷售額（跨月份彙整）

#### Scenario: 完全無資料時顯示 Empty

- **WHEN** BG 彩票無任何 in-memory 訂單
- **THEN** 不顯示 Bar Chart，顯示「目前沒有可用的銷售資料，請先進行投注操作」

### Requirement: 玩法排行 Horizontal Bar Chart

銷售分析頁 SHALL 顯示「玩法排行」Horizontal Bar Chart。
- 資料來自選定月份的 `playRanking`（有 playKey 的訂單）
- 每列顯示：玩法名稱、銷售金額、注數、佔比
- 附加說明：「僅計算含玩法識別碼的訂單」

#### Scenario: 有玩法資料時顯示排行

- **WHEN** 選定月份有含 playKey 的訂單
- **THEN** Horizontal Bar Chart 顯示各玩法銷售排行

#### Scenario: 無玩法資料時顯示說明

- **WHEN** 選定月份 playRanking 為空陣列
- **THEN** 不顯示 Chart，顯示「目前月份沒有含玩法識別碼的訂單」

### Requirement: 月份篩選（銷售分析）

銷售分析頁 SHALL 提供月份篩選器（與 Dashboard 相同互動方式）。
不提供其他 Filter（無彩種、玩法、搜尋等）。

#### Scenario: 切換月份重新載入資料

- **WHEN** 管理員切換月份
- **THEN** 月銷售趨勢 Bar Chart 與玩法排行均依新月份重新載入

