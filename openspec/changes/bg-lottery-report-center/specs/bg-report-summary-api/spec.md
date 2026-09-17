## ADDED Requirements

### Requirement: BG 彩票月度統計 API

後端 SHALL 提供 `GET /api/admin/reports/bg-summary` 端點，接受管理員 session 才能存取。
查詢參數 `month`（格式 `YYYY-MM`）為必填；未提供時回傳 HTTP 400。

回傳結構：
```
{
  month: string,             // YYYY-MM
  totalSales: number,        // 月總銷售 coin（所有 BG 彩種加總）
  totalOrders: number,       // 月總注單筆數
  commission: number,        // 估算佣金 = totalSales × 0.07
  dailySales: [{ day: "YYYY-MM-DD", sales: number }],  // 當月每日銷售（未有資料的日子 sales=0）
  gameRanking: [{ key, name, sales, orders, ratio }],  // 依 sales 降冪排列，最多 11 筆
  playRanking: [{ key, name, sales, orders, ratio }],  // 依 sales 降冪排列，僅含有 playKey 的訂單
  dataNote: string           // 例：「資料為 in-memory，伺服器重啟後清空」
}
```

#### Scenario: 月份有資料時回傳統計

- **WHEN** 管理員以 `?month=2026-09` 呼叫 API，且 BG 彩票 in-memory 訂單存在 2026-09 的資料
- **THEN** 回傳 HTTP 200，`totalSales > 0`，`dailySales` 長度等於該月天數，`gameRanking` 按 sales 降冪

#### Scenario: 月份無資料時回傳空統計

- **WHEN** 管理員以 `?month=2000-01` 呼叫 API，且無任何訂單屬於此月份
- **THEN** 回傳 HTTP 200，`totalSales = 0`、`totalOrders = 0`、`dailySales` 每日 sales = 0、`gameRanking = []`

#### Scenario: 未登入者無法存取

- **WHEN** 未附帶管理員 session 呼叫此 API
- **THEN** 回傳 HTTP 401 或 403

#### Scenario: month 格式錯誤時回傳錯誤

- **WHEN** 呼叫 API 時帶入 `?month=2026/09` 或省略 `month`
- **THEN** 回傳 HTTP 400 並附帶錯誤說明

### Requirement: Issue 字串日期解析

後端 SHALL 以 issue 字串前 8 碼（格式 `YYYYMMDD`）判斷訂單所屬日期。
無法解析（長度不足 8 或非數字）的 issue SHALL 被跳過，不納入統計。

#### Scenario: 有效 issue 字串正確對應日期

- **WHEN** 訂單 issue 為 `20260917-001`
- **THEN** 後端解析日期為 2026-09-17，納入 2026-09 統計

#### Scenario: 無效 issue 字串跳過不計

- **WHEN** 訂單 issue 為 `TW-UNKNOWN`
- **THEN** 後端跳過此訂單，不影響其他訂單統計

