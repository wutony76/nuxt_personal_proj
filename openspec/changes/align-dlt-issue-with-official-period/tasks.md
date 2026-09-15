# Tasks

## 1. 規格與設計確認

- [x] 完成 proposal 定稿（範圍/風險/驗證方式）
- [x] 完成 design 定稿（state/flow/API）

## 2. 期別計算核心

- [x] 新增 `_parseOfficialPeriod()`／`_nextOfficialPeriod()`／`_laterOfficialPeriod()` 純函式，
      取代舊的 `_dateKey()`
- [x] 新增 `isBootstrapped` 欄位＋ `_bootstrapOfficialPeriod()`：啟動時先取得一次官方期別基準，
      失敗 5 秒後自動重試
- [x] `_ensureIssue()` 在 `isBootstrapped === false` 時不分配 `currentIssue`（`currentStatus`
      停在 PREPARE，下注會被擋下）
- [x] `_attemptSettlement()` 結算後推進期別改用 `_laterOfficialPeriod(lastKnownOfficialPeriod,
      settledIssue)` 當基準，避免測試模式連續呼叫撞號

## 3. 開獎歷史回填

- [x] `taiwanLotteryApi.ts` 新增 `fetchTaiwanLotteryDrawOf()`（單期查詢真實開獎號碼＋開獎日期）
- [x] `dlt.ts` 新增 `_prevOfficialPeriods()`（同民國年度往回推算期別，不跨年瞎猜）
- [x] `dlt.ts` 新增 `_backfillHistory()`，由 `_bootstrapOfficialPeriod()` 成功後觸發
      （fire-and-forget，不阻塞下注開放）
- [x] 更新 `opencode-history.get.ts` 過時的 Decision 4 註解

## 4. 測試

- [x] `scripts/test-dlt.mjs` 更新期別格式斷言（8 碼 YYYYMMDD → 官方 9 碼格式）
- [x] `npm run test:dlt` 全數通過（40/40）
- [x] 登入後打 `/api/lottery-tw/dlt/opencode-history`，確認回填＋bootstrap 種子共 11 筆真實歷史
      （`115000077`～`115000087`（含 bootstrap 種子期別本身））資料正確、不與測試/真實紀錄衝突

## 5. 交付檢查

- [x] 手動 `curl` 官方 API 交叉比對真實期別，確認算出的序號規則正確
- [x] 變更檔案與風險說明整理完成
- [x] 補 `validation.md` 與 `docs/Engineering Evidence/` 文件
