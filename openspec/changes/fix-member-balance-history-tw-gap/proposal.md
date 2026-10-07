# Proposal

## 變更名稱

`fix-member-balance-history-tw-gap` — 補齊會員個人異動明細缺漏的 8 個台彩來源 + 接上 DB 合併查詢

## 背景

`migrate-wallet-and-reports-postgres` 完成後，使用者要求把「DB 還未處理的部分」一併處理。
盤點該批次的 validation.md/design.md，明確記錄了一項延後處理的缺口：

`memberBalanceHistoryService.list()`（`GET /api/admin/members/[id]/balance-changes`，後台
會員個人異動明細）的 `USER_BALANCE_SOURCES` 清單只有 14 個來源，**完全沒有 8 個台彩玩法**
（`dltRecord`/`superlottoRecord`/`d539Record`/`m649Record`/`m539Record`/`p3Record`/
`p4Record`/`bingoRecord`）——這是既有缺陷（遷移前就存在，不是本次持久化工作造成），加上這支
查詢路徑也還沒像遊戲紀錄/彩池稽核/F幣統計/台彩派彩那樣接上 `wallet_balance_changes` 的 DB
合併查詢。

## 範圍

- 補上 8 個台彩來源到 `USER_BALANCE_SOURCES`
- `list()` 改 async，合併記憶體 + `wallet_balance_changes`（全部 22 個 source，不只
  `record`），比照既有 `queryArchivedWalletChangesForUser()` 樣板
- API 路由補 `await`

## 驗證方式

- 查詢一個有台彩下注紀錄的會員，確認 8 個台彩來源的異動正確出現在清單
- 重啟後（記憶體清空）立即查詢，確認 DB 歷史資料正確合併顯示
- DB enabled/disabled 兩種設定下 `npm test` 皆通過

## 成功標準

- [ ] 8 個台彩來源補齊 + DB 合併查詢完成並驗證
- [ ] 既有測試無回歸
