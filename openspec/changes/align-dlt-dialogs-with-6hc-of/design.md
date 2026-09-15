# Design

## 1. Layout Structure（頁面結構）

- Route / Page：`app/pages/lottery/tw/dlt.vue`（不動版面骨架，只多傳一個 prop 給 `DialogOpenCode`）
- Sections：三個獨立 modal（沿用既有 `<Teleport>` 無關的 fixed-mask 寫法）
- Blocks：
  - `DialogUser`：摘要列（可領獎金＋領取按鈕）→ tabs → tab 內容（表格）
  - `DialogOpenCode`：期數查詢列 → 表格
  - `DialogRule`：頂部快捷導覽 → 分段內容 → 回頂部按鈕
- 響應式斷點策略：沿用 6hc-of 既有 `.dialog-table-wrap { overflow-x: auto }` 走橫向捲動，不另訂斷點

## 2. Component Breakdown（元件拆分）

- 既有元件調整（不新增檔案）：
  - `app/components/lottery/tw/dlt/block/DialogUser.vue`
  - `app/components/lottery/tw/dlt/block/DialogOpenCode.vue`
  - `app/components/lottery/tw/dlt/block/DialogRule.vue`
  - `app/pages/lottery/tw/dlt.vue`
- 職責與邊界：
  - `DialogUser`／`DialogOpenCode` 維持只讀 `useDlt()` 已有的 `userRecord`／`openCodeHistory`，不新增 composable state
  - 排序／篩選／分頁籤都是元件內部 local `ref`（純 UI state，不進 composable，比照 6hc-of 的 `DialogUser.vue` 寫法）
  - `DialogRule` 保持無 props（沿用現況），純靜態說明內容

## 3. State 設計

### local state（單一 reactive 為主）

- `DialogUser.vue`：
  - `activeTab: ref<'balance' | 'bets'>('balance')`
  - `betIssueFilter: ref('')`、`betSortField/betSortOrder`、`balanceSortActive/balanceSortOrder`（比照 6hc-of 命名）
- `DialogOpenCode.vue`：
  - `sortKey: ref<'issue'|'startAt'|'endAt'>('issue')`、`sortDir`、`issueQuery: ref('')`
- `DialogRule.vue`：
  - `dialogEl: ref<HTMLElement|null>`（供 `scrollToSection`／回頂部使用）

### global state（Pinia setup store）

- 不涉及；三個彈窗都只讀 `useDlt()` 既有的 module-level singleton（`userRecord`／`openCodeHistory`）

## 4. Interaction Flow（click / actions / _handlers）

- `DialogUser`：
  - `click.claim`（既有）→ `fetch.claimOneIssue()`
  - `toggleBalanceTimeSort()` / `toggleSort(field)`：純 UI 排序，不觸發任何 API
  - `computed selectedIssueOpenCode`：依 `betIssueFilter` 找出該期 `betHistory`，若已開獎則回傳 `openCode` 供 Ball 命中標記使用
- `DialogOpenCode`：
  - `toggleSort(key)`：純 UI 排序
  - `computed filteredList`：依 `issueQuery` 過�Filter `openCodeHistory.list`
  - `betIssueSet`：由頁面傳入的 `betIssues` prop 轉 `Set`，用於淡化「本期沒下注」的列
- `DialogRule`：
  - `scrollToSection(id)`：捲動至指定分段（不呼叫任何 action）

## 5. API Contract（JSDoc 必填）

不涉及新增/調整 API；沿用既有：

```js
/**
 * @returns {Promise<{ balanceChanges: LotteryUserBalanceChange[], betHistory: DltUserBetHistory[], claimableIssues: LotteryClaimableIssue[] }>}
 */
// api.lottery.userRecordDlt()

/**
 * @returns {Promise<{ history: LotteryOpenCodeHistoryItem[] }>}
 */
// api.lottery.openCodeHistoryDlt()
```

## 6. Token Mapping（對應 6hc-of 既有樣式）

- color：沿用 DLT 既有 `var(--color-red-main)` / `var(--color-red-desc)` / `var(--color-red-content)`（與 6hc-of 同一套全域 token，兩邊本來就是紅色系，不需要另外映射）
- typography／radius／shadow：直接複用 6hc-of `.report-table`／`.dialog-tab`／`.sortable-th`／`.rule-table` 的既有數值（12–13px 內文、0.25rem 圓角、999px pill 標籤）
- 開獎球：沿用 DLT 自己的 `Ball.vue`（`hit`/`muted`/`size` props），不換成 6hc-of 的 Ball 元件——兩邊視覺已經是同一顆紅色圓球，只是 DLT 版有更貼合語意的 `hit` prop

## 7. 錯誤處理與可觀測性

- loading / success / error state 定義：
  - `DialogUser`：`userRecord.isLoading` → 顯示「載入中...」；`userRecord.errorMessage` → 顯示錯誤列；皆無才渲染 tabs（比照 6hc-of `data.isLoading`/`data.errorMessage`）
  - `DialogOpenCode`：`openCodeHistory.isLoading`／`openCodeHistory.errorMessage` 同上
- 使用者提示方式（UI message）：純文字列，沿用 6hc-of 的 `.user-dialog-loading`／`.user-dialog-error` class 與文案風格
- 錯誤回傳或 state 落點：不變，仍是 `useDlt()` 既有的 `userRecord.errorMessage`／`openCodeHistory.errorMessage`

## 8. 測試與驗證策略

- 單元/整合測試範圍：無自動化測試（比照 6hc-of 現況，此類彈窗目前全專案都是手動驗證）
- 手動測試案例：見 `proposal.md` 的「驗證方式」
- 回歸風險與檢查點：確認「可領獎金」領取按鈕、開獎歷史清單資料筆數與現況一致（不因改版遺漏資料）
