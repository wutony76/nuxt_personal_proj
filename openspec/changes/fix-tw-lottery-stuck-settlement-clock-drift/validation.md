# Validation

## 功能驗證

這 7 款遊戲沒有實際重現過卡死症狀（純屬預防性修正，根因與修法已在
`fix-bingo-stuck-settlement-clock-drift` 實測確認過），因此本次驗證以
「程式碼模式確認一致」與「回歸測試」為主，不另外模擬休眠情境。

- 修正前：7 個檔案的 `_attemptSettlement()` 皆為
  `_nextDrawWindow(new Date(this.drawAt + 60_000))`（grep 確認）
- 修正後：7 個檔案皆改為 `_nextDrawWindow(now)`（grep 確認，各檔案僅此
  一處符合舊模式，替換前後數量一致）

## 回歸驗證

- `npm run test:d539`／`test:dlt`／`test:m539`／`test:m649`／`test:p3`／
  `test:p4`／`test:superlotto`：全數通過
- `npm test`（36 支既有測試腳本）：第一次執行時 `test:6hc-cd`／
  `test:6hc-of`／`test:bg` 失敗，單獨重跑皆全數通過（56/56、24/24、
  14/14）。確認根因是本次一次改動 7 個檔案觸發 Nitro dev 重啟，重啟時
  `server/plugins/init.ts` 的 dev-only 自動測試電池跟當時正在跑的
  `npm test` 撞期，是既有已知的 transient 現象，與本次改動的邏輯正確性
  無關

## 成功標準檢查

- [x] 7 款遊戲的結算時間窗計算皆改用真實現在時間為基準
- [x] 無新增重大 console / runtime error
- [x] 相關測試驗證完成
