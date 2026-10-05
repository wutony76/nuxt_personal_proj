# Design

根因分析、為什麼「用自己過去的值當基準」會永久卡死、為什麼「跟外部真相
比對」的狀態（`lastKnownOfficialPeriod`）天生能自我校正而時間窗不行，完整
說明見 `fix-bingo-stuck-settlement-clock-drift` 的 `design.md`，這裡不重複，
只記錄這 7 款遊戲跟 bingo 的差異點。

## 跟 bingo 的差異：為什麼症狀不容易被觀察到

bingo 每 5 分鐘開獎一次，`_nextFiveMinuteBoundary()` 的搜尋粒度是 5 分鐘；
這 7 款遊戲每天開獎一次（或更低頻率），`_nextDrawWindow()` 的搜尋粒度是
「天」。兩者的根因完全相同（用 `this.drawAt` 加一個小增量當 `_nextXxx()`
的起點，不是真實 `now`），差別只在「用落後的起點去搜尋下一個有效時間窗」
這件事，對粗粒度（天）跟細粒度（5 分鐘）的影響不一樣：

- bingo：若休眠造成的落差是 13.6 小時（遠大於 5 分鐘），`_nextFiveMinuteBoundary`
  只能從落後的起點往後推「一個 5 分鐘」，離真實現在還差了 13.6 小時扣掉
  5 分鐘，幾乎沒追上
- 這 7 款遊戲：若休眠造成的落差是典型的隔夜情境（例如 10~16 小時，通常
  < 24 小時），`_nextDrawWindow()` 從落後的起點（例如「昨天 20:31」）往前
  搜尋，常常會直接找到「今天」這個開獎日，而「今天」這個開獎日的截止時間
  在真實現在時間看來可能還沒到——於是「剛好」追上了，使用者不會實際看到
  卡住的症狀

但這只是粒度夠粗、剛好蓋過落差的巧合，不是真的有自我校正機制。只要休眠/
暫停時間超過一個完整開獎週期（例如連續好幾天沒開 dev server，或是
`_nextDrawWindow()` 逐日搜尋的那個迴圈剛好因為假日/週末跳過開獎日而需要
搜尋更多天），同一個「落後的起點只會疊加、不會對齊真實現在」的根因，一樣
會讓這些遊戲永久卡在「結算中」。

## 修法

跟 bingo 完全一致，一行改動：

```ts
const { drawDate, cutoffAt, drawAt } = _nextDrawWindow(now)
```

取代

```ts
const { drawDate, cutoffAt, drawAt } = _nextDrawWindow(new Date(this.drawAt + 60_000))
```

7 個檔案（`d539.ts`／`dlt.ts`／`m539.ts`／`m649.ts`／`p3.ts`／`p4.ts`／
`superlotto.ts`）的 `_attemptSettlement(now: Date)` 本身都已經把真實現在
時間當參數帶進來，直接沿用即可，不需要額外取得。
