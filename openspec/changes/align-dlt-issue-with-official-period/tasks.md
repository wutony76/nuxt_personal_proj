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

## 3. 測試

- [x] `scripts/test-dlt.mjs` 更新期別格式斷言（8 碼 YYYYMMDD → 官方 9 碼格式）
- [x] `npm run test:dlt` 全數通過（40/40）

## 4. 交付檢查

- [x] 手動 `curl` 官方 API 交叉比對真實期別，確認算出的序號規則正確
- [x] 變更檔案與風險說明整理完成
- [x] 補 `validation.md` 與 `docs/Engineering Evidence/` 文件
