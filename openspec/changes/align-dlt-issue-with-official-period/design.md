# Design

## 1. Layout Structure（頁面結構）

不涉及頁面/版面變更，純後端期別計算邏輯調整。

## 2. Component Breakdown（元件拆分）

- 既有檔案調整：
  - `server/services/game/lottery/tw/dlt.ts`
  - `scripts/test-dlt.mjs`
- 職責與邊界：
  - `_parseOfficialPeriod()`／`_nextOfficialPeriod()`／`_laterOfficialPeriod()`：純函式，只做
    期別字串的解析／推算／比大小，不碰任何 class 狀態
  - `_bootstrapOfficialPeriod()`：唯一「打官方 API 取得期別基準」的入口，成功後才允許
    `_ensureIssue()` 分配 `currentIssue`

## 3. State 設計

### local state（單一 reactive 為主）

不涉及；本次變更全部在既有 `DltClass` 的欄位上調整（見下方 global state）。

### global state（DltClass instance 欄位，module-level singleton）

- `currentIssue: string`：改為官方格式（民國年 3 碼＋序號 6 碼），`isBootstrapped` 為 false
  時恆為空字串
- `isBootstrapped: boolean`（新增）：server 啟動後是否已成功取得過一次官方最新期別
- `lastKnownOfficialPeriod: string`：語意不變，只是現在從「純比對用」升級為「推算下一期的
  基準來源」

## 4. Interaction Flow（click / actions / _handlers）

- `init()` → `_bootstrapOfficialPeriod()`（新增，取代原本直接呼叫 `_ensureIssue()`）：
  - 打 `fetchTaiwanLotteryLastNumberOf(DLT_GAME_CODE)` 拿目前官方最新一期
  - 成功：設定 `lastKnownOfficialPeriod`、`isBootstrapped = true`，才呼叫 `_ensureIssue()`
  - 失敗（含逾時／官方回傳無效資料）：5 秒後遞迴重試，`isBootstrapped` 維持 false
- `circle()`（每 300ms）→ `_ensureIssue(now)`：
  - `isBootstrapped === false` → `currentStatus = PREPARE`，直接 return（不分配 currentIssue）
  - 否則沿用原本邏輯：`currentIssue` 為空時才用 `_nextOfficialPeriod(drawDate, lastKnownOfficialPeriod)`
    分配一次
- `playBets()` → 呼叫 `_ensureIssue()` 後檢查 `currentStatus === OPEN`：
  - bootstrap 尚未完成時 `currentStatus` 停在 `PREPARE`，行為等同「目前為『準備中』，不受理投注」
    （沿用既有錯誤訊息機制，不需要新增分支）
- `_attemptSettlement()` 結算完成後推進期別：
  - `settledIssue = this.currentIssue`（結算前先存一份，供下面推進序號用）
  - 非測試模式：`lastKnownOfficialPeriod = period`（沿用原行為）
  - `seedPeriod = _laterOfficialPeriod(lastKnownOfficialPeriod, settledIssue)`（新增）
  - `currentIssue = _nextOfficialPeriod(nextDrawDate, seedPeriod)`

## 5. API Contract（JSDoc 必填）

不涉及新增/調整對外 API；沿用既有官方 API 呼叫：

```js
/**
 * @returns {Promise<{ period: string, lotNumber: number[] } | null>}
 */
// fetchTaiwanLotteryLastNumberOf(5118) — server/services/game/lottery/tw/taiwanLotteryApi.ts
```

新增純函式（僅供 `dlt.ts` 內部使用，不對外匯出）：

```ts
/** @returns 官方期別字串的 { rocYear, seq }，格式不符回傳 null */
function _parseOfficialPeriod(period: string): { rocYear: number; seq: number } | null

/** @returns 依 drawDate 與已知期別，推算下一期的官方格式期別字串 */
function _nextOfficialPeriod(drawDate: Date, lastKnownOfficialPeriod: string): string

/** @returns 兩個官方格式期別字串中數值較大的那個 */
function _laterOfficialPeriod(a: string, b: string): string
```

## 6. Token Mapping（Figma 對應）

不涉及。

## 7. 錯誤處理與可觀測性

- `_bootstrapOfficialPeriod()` 失敗：`console.warn` 記錄錯誤原因，5 秒後自動重試，不拋出、
  不中斷 server（沿用 `_attemptSettlement()` 既有的 `console.warn` + 自動重試風格）
- bootstrap 未完成期間的下注請求：沿用既有「目前為『準備中』，不受理投注」錯誤訊息，
  使用者體驗上跟平常「準備中」狀態無法區分（刻意如此，不需要額外解釋內部原因）

## 8. 測試與驗證策略

- 單元/整合測試範圍：`scripts/test-dlt.mjs`（既有 40 項端到端測試，本次新增/修正 1 項格式斷言）
- 手動測試案例：
  - 觀察 server 啟動 log 確認 `_bootstrapOfficialPeriod()` 有成功拿到官方期別
  - 直接 `curl` 官方 API 交叉比對，確認算出的 `currentIssue` 序號規則正確
- 回歸風險與檢查點：admin 測試端點連續呼叫（`dlt-test-draw`）不能讓 `currentIssue` 撞號
  （已用 `_laterOfficialPeriod()` 解決，並由 `npm run test:dlt` 的「結算後 currentIssue
  正確推進到下一個開獎日」驗證）
