# Validation

- 對應變更：`fix-member-balance-history-tw-gap`
- 日期：2026-10-07

## 實作內容確認

- `USER_BALANCE_SOURCES` 補齊 8 個台彩來源（`dltRecord`/`superlottoRecord`/`d539Record`/
  `m649Record`/`m539Record`/`p3Record`/`p4Record`/`bingoRecord`）
- `list()` 改 async，合併記憶體 + `wallet_balance_changes`（`queryArchivedWalletChangesForUser()`
  回傳全部 22 個 source，不只 `record`），以 `${source}:${id}` 去重（記憶體優先）
- `balance-changes.get.ts` 補 `await`

## 實測驗證（真實 API 呼叫）

- 查詢 admin 帳號的 `GET /api/admin/members/U0xA000001/balance-changes`：
  - 修正前：只會看到 14 個來源（`record`/各 BG 信用盤/官方盤），**完全看不到任何台彩下注/
    派彩紀錄**
  - 修正後：回應的 `changes` 陣列裡確認出現全部 22 個 source，含所有 8 個台彩玩法
    （`m539Record`/`m649Record`/`d539Record`/`superlottoRecord`/`dltRecord`/`p4Record`/
    `p3Record`/`bingoRecord`）
- **重啟後立即查詢**（記憶體幾乎清空）：回傳剛好 300 筆（`MAX_ROWS` 上限），證實資料來自
  DB 合併查詢，不是只讀記憶體（此時記憶體裡還沒有這麼多資料）

## DB enabled/disabled 迴歸驗證

- **DB disabled**（暫時移除 `.env`，重啟）：查詢正常回 200，純記憶體模式不受影響
- **DB enabled**（還原 `.env`，重啟）：乾淨開機無錯誤
- 完整 `npm test`（38 支腳本）：**全數通過，0 失敗**（含先前反覆出現的 BG/Bingo 期別邊界
  flaky 測試這次也一次通過，純屬運氣，不代表 flaky 問題已根治）

## 成功標準檢核

- [x] 8 個台彩來源補齊 + DB 合併查詢完成並驗證
- [x] 既有測試無回歸
