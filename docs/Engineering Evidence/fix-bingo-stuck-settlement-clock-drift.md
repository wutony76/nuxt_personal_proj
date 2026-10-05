# Engineering Evidence：賓果賓果永久卡在「結算中」

## 變更摘要

- **對應變更**：`fix-bingo-stuck-settlement-clock-drift`
- **變更檔案**：`server/services/game/lottery/tw/bingo.ts`

### 問題

使用者回報「bingo 會一直卡在結算中，無法遊戲」。實測確認
`currentStatus: "結算中（等待官方資料）"`，真實下注一律被 400 拒絕。

### 根因

`_attemptSettlement()` 每次結算後計算下一個開獎時間窗：

```ts
const drawAt = _nextFiveMinuteBoundary(new Date(this.drawAt + 1000)).getTime()
```

用的是自己上一次的 `this.drawAt`（內部舊值）往後推 5 分鐘，不是真實現在
時間。一旦 `this.drawAt` 因為任何原因落後真實時間（本機開發最常見：筆電
休眠一段時間，Node process 暫停期間完全沒有 `circle()` 輪詢在跑），每次
結算都只是在同一個落後的基準上繼續疊加，落後的絕對時間差永遠不會縮小，
`cutoffAt` 永遠停在過去、狀態永久卡在「結算中」。

反觀 `lastKnownOfficialPeriod`（期別序號追蹤）是跟「外部官方 API 當下的
真相」比對，不依賴任何內部累積狀態，所以本身會自然校正回真實進度——這也
是為什麼實測當下能看到期別序號確實在正常前進，`currentStatus` 卻紋風不動。

實測當下 `cutoffAt` 停在「2026-10-04 20:20:00」，真實時間是「2026-10-05
09:58」，落後約 13.6 小時；`currentIssue` 的期別序號也因此被間接推到比
真實官方序號超前約 91 期（`_laterOfficialPeriod()` 取較大值，內部序號一旦
超前就回不去）。

### 修法

```ts
const drawAt = _nextFiveMinuteBoundary(now).getTime()
```

改用 `_attemptSettlement(now: Date)` 本身已經帶入的真實現在時間當基準，
跟 `_ensureIssue()` 的 bootstrap 路徑用同一個基準，確保每次結算都重新對齊
到「真正現在」的下一個 5 分鐘整點，不管中間累積了多少次暫停/延遲都能立刻
校正。

## 驗證

| 項目 | 方法 | 結果 |
|---|---|---|
| 修正前重現 | 查 `/api/lottery-tw/bingo/current`、真實下注 | `currentStatus` 卡在「結算中」，`cutoffAt` 落後真實時間 13.6 小時，下注被 400 拒絕 |
| 修正後 | Nitro dev 重啟重新 bootstrap，再查一次 | `currentStatus: 開盤中`，`cutoffAt` 正確對齊下個 5 分鐘整點，期別序號回到跟官方相近 |
| 真實下注 | 實際呼叫 `/api/lottery/bet` | 下注成功，正確扣款、產生訂單 |
| 回歸測試 | `npm run test:bingo` | 94/94 全數通過 |
| 回歸測試 | `npm test` | 第一次跑 `test:6hc-cd`／`test:bg`／`test:bingo` 失敗，單獨重跑皆全過；確認是本次改動觸發 Nitro 重啟、跟 dev-only 自動測試電池撞期的既有 transient 現象，與本次修正無關 |

## 風險與後續

- **期別序號超前量未回溯清除**：`currentIssue` 在 bug 存在期間已經累積
  約 91 期的超前量，本次修正後不會再繼續累積新的超前量，但不會回頭修正
  已經存在的落差；序號本身不影響下注/結算正確性，只是顯示標籤跟官方真實
  序號對不齊，如需對齊需另外評估手動重設內部序號基準
- **正式環境的對應風險**：本機最常見觸發情境是筆電休眠，正式環境的長駐
  server 較少遇到整段時間完全無法執行程式碼的情境，但任何讓 event loop
  長時間被阻塞或程序被暫停的狀況（部署平台的休眠/喚醒機制、容器被暫停等）
  都可能觸發同一個根因，修正後已具備自我校正能力，不需要再手動處理

## 封存前檢查

- [x] `validation.md` 結論為「通過」
- [x] 變更檔案、風險整理完成
- [x] `npm run test:bingo` 94/94、`npm test` 回歸確認無關失敗項目已排除
- [ ] `openspec archive`
