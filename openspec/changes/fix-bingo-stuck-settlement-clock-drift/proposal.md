# Proposal

## 變更名稱

fix-bingo-stuck-settlement-clock-drift — 修正賓果賓果結算後的開獎時間窗沒有
對齊真實時間，導致永久卡在「結算中」無法下注的問題

## 背景

使用者回報：「bingo 會一直卡在結算中，無法遊戲」。實測確認 `/api/lottery-tw/
bingo/current` 回應 `currentStatus: "結算中（等待官方資料）"`，下注一律被
拒絕（`400`：「目前為『結算中（等待官方資料）』，不受理投注」）。

追查發現 `bingo.ts` 的 `_attemptSettlement()` 在每次成功結算、計算「下一個
開獎時間窗」時：

```ts
const drawAt = _nextFiveMinuteBoundary(new Date(this.drawAt + 1000)).getTime()
```

用的是**自己上一次的 `this.drawAt`**（內部舊值）往後推 5 分鐘，不是真實的
現在時間。一旦 `this.drawAt` 因為任何原因落後真實時間（最常見的情境：本機
休眠一整晚，Node process 暫停期間完全沒有 `circle()` 輪詢在跑），每次結算
都只會從「自己原本就落後的那個值」再往後推 5 分鐘——落後的絕對時間差永遠
不會縮小，`cutoffAt`／`drawAt` 就永遠停在過去的某個時間點。

`_refreshStatus()` 的判斷式 `nowMs < this.cutoffAt` 因此永遠為假，狀態永久
停在「結算中（等待官方資料）」，無法再回到「開盤中」。

反觀 `lastKnownOfficialPeriod`（真正跟外部官方 API 比對最新期別序號的狀態）
本身會隨每次輪詢自然校正回真實進度（因為判斷依據是「跟上次記錄的官方期別
是否不同」，不是跟內部時鐘比較）——這也是為什麼實測當下能看到
`lastOpenCode.issue` 確實在正常前進（265→266），但 `currentStatus` 卻紋風
不動，兩個狀態各自獨立運作、沒有互相校正。

實測當下的 `cutoffAt` 停在「2026-10-04 20:20:00」，而真實時間是「2026-10-05
09:58」——落後約 13.6 小時，`currentIssue` 的期別序號也因此被這個 bug 間接
推到比真實官方序號超前 91 期（`_laterOfficialPeriod()` 取較大值，內部序號
一旦超前就回不去）。

## 目標

- 每次成功結算後，計算下一個開獎時間窗要以**真正的現在時間**為基準，不是
  疊加自己過去可能已經落後的值
- 不論中間經歷多久的暫停/延遲（本機休眠、process 被掛起等），下一次輪詢都
  能立刻校正回正確的開盤/結算狀態，不需要手動重啟才能恢復

## 範圍

- 包含：
  - `server/services/game/lottery/tw/bingo.ts`（`_attemptSettlement()` 計算
    `drawAt` 的那一行）
- 不包含：
  - 不處理 `currentIssue` 期別序號已經累積的超前量（這是過去 bug 發生時
    遺留下來的既成事實，序號本身不影響下注/結算邏輯是否正常運作，純粹是
    顯示用的期別標籤跟真實官方序號對不齊；本次只確保「之後」不會再繼續
    累積新的超前量）
  - 不改 `lastKnownOfficialPeriod` 的追蹤邏輯（這部分本來就是對的，會自然
    校正回真實進度）

## 影響面

- 後端 API/Services：`server/services/game/lottery/tw/bingo.ts`
- 前端路由/頁面：無直接修改，但 bingo 相關頁面皆受益（恢復可正常下注）

## 風險與對策

- 技術風險：
  - 風險：改用真實 `now` 當基準後，若某次輪詢本身就延遲了幾秒（例如官方
    API 回應慢），下一個開獎時間窗會是「從實際偵測到的那一刻」算起的下個
    5 分鐘整點，可能跟官方真正的整點排程有些微秒級落差
  - 對策：這個落差本來就存在於原始設計（`_ensureIssue` 的 bootstrap 路徑
    本來就是用真實 `now` 算的），不是本次新增的風險，而且落差頂多幾秒，
    遠小於原本「永久卡死」的問題
- UI/UX 風險：
  - 風險：無——純粹修正一個會讓遊戲永久不可用的邏輯錯誤，不影響任何正常
    運作下的行為

## 驗證方式

- 功能驗證：
  - 實測重現：確認修正前 `cutoffAt` 停在過去、`currentStatus` 永久卡在
    「結算中」、真實下注被拒絕
  - 套用修正（Nitro dev 重啟後自動重新 bootstrap）：確認 `currentStatus`
    恢復「開盤中」、`cutoffAt` 正確對齊真實時間的下一個 5 分鐘整點、真實
    下注成功
- 回歸驗證：`npm run test:bingo`（94 項）全數通過；`npm test`（36 支既有
  測試腳本）全數通過或確認失敗項目與本次變更無關

## 成功標準

- [x] bingo 恢復可正常下注，不再永久卡在「結算中」
- [x] 無新增重大 console / runtime error
- [x] 相關測試或手動驗證完成
