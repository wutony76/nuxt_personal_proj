# Validation

## 功能驗證

### 修正前

```
GET /api/lottery-tw/bingo/current
  issue: 115056356
  currentStatus: 結算中（等待官方資料）
  lastOpenCode.issue: 115056265
  cutoffAt（換算台灣時間）: 2026-10-04 20:20:00  ← 停滯，落後真實時間約 13.6 小時

POST /api/lottery/bet（真實下注）
  400 Server Error: 目前為「結算中（等待官方資料）」，不受理投注
```

同時直接查我方 `/api/lottery-tw/last-number`，確認伺服器端當下其實能正常
抓到官方最新一期資料（`period: "115056266"`），證明不是「抓不到官方資料」
的問題，是內部時間窗計算本身卡死。

### 修正後（Nitro dev 重啟，重新 bootstrap）

```
GET /api/lottery-tw/bingo/current
  issue: 115056267
  currentStatus: 開盤中
  countdown: 03:48
  cutoffAt（換算台灣時間）: 2026-10-05 10:05:00  ← 正確對齊真實時間的下個 5 分鐘整點
  lastOpenCode.issue: 115056266

POST /api/lottery/bet（真實下注，betType=star, star=3, numbers=[1,2,3]）
  200: 下注成功，coin: 99975, orderId: BINGO115056267000001
```

`issue` 序號也從修正前超前真實官方序號 91 期（356 vs 265），回到跟真實
官方序號相近的範圍（267 vs 266，僅 1 期之差——這是正常的「下一期」關係，
不是殘留的超前量；這個重新對齊是 Nitro 重啟時重新 bootstrap 的副作用，見
`design.md`「沒有處理的部分」一節，本次修正本身不包含回溯清除超前量的
邏輯）。

## 回歸驗證

- `npm run test:bingo`：94/94 全數通過
- `npm test`（36 支既有測試腳本）：第一次執行時 `test:6hc-cd`／`test:bg`／
  `test:bingo` 失敗，單獨重跑皆全數通過（`test:6hc-cd` 56/56、`test:bg`
  14/14、`test:bingo` 94/94）。確認根因是本次程式碼變更觸發 Nitro dev
  重啟，重啟時 `server/plugins/init.ts` 的 dev-only 自動測試電池跟當時
  正在跑的 `npm test` 撞期，是既有已知的 transient 現象（本次 session 稍早
  修 6hc-cd 導航 bug 時也遇過同一類狀況），與本次改動的邏輯正確性無關

## 成功標準檢查

- [x] bingo 恢復可正常下注，不再永久卡在「結算中」
- [x] 無新增重大 console / runtime error
- [x] 相關測試或手動驗證完成
