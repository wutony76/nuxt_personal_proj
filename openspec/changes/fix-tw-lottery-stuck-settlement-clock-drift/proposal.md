# Proposal

## 變更名稱

fix-tw-lottery-stuck-settlement-clock-drift — 修正其餘 7 款鏡射官方台彩
遊戲同樣存在的「結算後開獎時間窗未對齊真實時間」潛在問題

## 背景

`fix-bingo-stuck-settlement-clock-drift` 修正了賓果賓果的一個 bug：結算後
計算下一個開獎時間窗時，用自己過去的內部舊值（`this.drawAt`）當基準往後推，
不是真實現在時間，一旦內部時鐘因任何原因落後真實時間（最常見：本機休眠），
每次結算都只是在同一個落後基準上疊加，永遠追不上真實時間，`cutoffAt` 永遠
停在過去，遊戲永久卡在「結算中（等待官方資料）」無法下注。

修完 bingo 後，往下檢查其餘 7 款同樣「鏡射官方開獎」的台彩遊戲
（d539／dlt／m539／m649／p3／p4／superlotto），發現它們的
`_attemptSettlement()` 都有完全相同的程式碼模式：

```ts
const { drawDate, cutoffAt, drawAt } = _nextDrawWindow(new Date(this.drawAt + 60_000))
```

跟 bingo 的 `_nextFiveMinuteBoundary(new Date(this.drawAt + 1000))` 是同一種
寫法，只是用的輔助函式不同（`_nextDrawWindow` 找「下一個有效開獎日」，
`_nextFiveMinuteBoundary` 找「下一個 5 分鐘整點」）。

這 7 款遊戲都是「每天開獎一次」（不像賓果賓果每 5 分鐘一次），短暫的本機
休眠（例如隔夜，通常遠少於 24 小時）時，`_nextDrawWindow()` 逐日往前搜尋的
邏輯，常常能在同一次呼叫內就跨過休眠造成的落差、追上真實時間所在的那個
開獎日，使用者不容易真的觀察到症狀——但這只是「剛好幸運跨過去」，不是
設計上有自我校正能力：一旦休眠／暫停時間超過一個完整開獎週期（連續好幾天
沒開 dev server、部署平台的休眠喚醒機制等），同一個根因一樣會讓這些遊戲
永久卡在「結算中」。

## 目標

- 7 款遊戲都改成以真實現在時間為基準計算下一個開獎時間窗，消除「休眠/暫停
  超過一個開獎週期就永久卡死」的潛在風險，跟 bingo 的修法完全一致

## 範圍

- 包含：
  - `server/services/game/lottery/tw/{d539,dlt,m539,m649,p3,p4,superlotto}.ts`
    （各自 `_attemptSettlement()` 計算 `drawAt` 的那一行）
- 不包含：
  - 不處理任何既有的期別序號超前量（跟 bingo 一樣，序號本身不影響下注/
    結算正確性，純粹是顯示用標籤；這 7 款遊戲目前沒有觀察到實際發生過
    這個問題，純粹是預防性修正，不是在修復一個已知已經發生的超前量）

## 影響面

- 後端 API/Services：7 個 TW 台彩鏡射遊戲的 service 檔案
- 前端路由/頁面：無直接修改，但這些遊戲的對應頁面皆受益（排除潛在的永久
  卡死風險）

## 風險與對策

- 技術風險：與 `fix-bingo-stuck-settlement-clock-drift` 完全相同（見該
  change 的 `design.md`），這裡不重複——核心差異只在於「每天開獎一次」的
  較粗時間粒度，讓問題不容易在短暫休眠下被實際觀察到，但根因與風險性質
  相同
- UI/UX 風險：無——純粹修正一個潛在的永久卡死風險，不影響任何正常運作下
  的行為

## 驗證方式

- 回歸驗證：`npm run test:{d539,dlt,m539,m649,p3,p4,superlotto}` 全數通過；
  `npm test`（36 支既有測試腳本）全數通過或確認失敗項目與本次變更無關

## 成功標準

- [x] 7 款遊戲的結算時間窗計算皆改用真實現在時間為基準
- [x] 無新增重大 console / runtime error
- [x] 相關測試驗證完成
