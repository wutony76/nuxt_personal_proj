# Engineering Evidence：其餘 7 款台彩遊戲同樣的結算時間窗風險

## 變更摘要

- **對應變更**：`fix-tw-lottery-stuck-settlement-clock-drift`
- **變更檔案**：`server/services/game/lottery/tw/{d539,dlt,m539,m649,p3,
  p4,superlotto}.ts`

### 問題

修完 bingo 的「永久卡在結算中」bug 後（見
[fix-bingo-stuck-settlement-clock-drift.md](fix-bingo-stuck-settlement-clock-drift.md)），
往下檢查發現其餘 7 款鏡射官方開獎的台彩遊戲都有完全相同的程式碼模式：

```ts
const { drawDate, cutoffAt, drawAt } = _nextDrawWindow(new Date(this.drawAt + 60_000))
```

用自己過去的內部舊值當基準，不是真實現在時間——跟 bingo 的根因完全一樣。

### 為什麼之前沒被注意到

這 7 款遊戲每天開獎一次（bingo 每 5 分鐘一次）。本機典型的隔夜休眠（通常
< 24 小時）常常讓 `_nextDrawWindow()` 逐日搜尋的邏輯「剛好」跨過休眠造成
的落差、直接找到真實現在時間所在的開獎日，症狀不容易被實際觀察到。但這
只是粒度夠粗、剛好蓋過落差的巧合，不是真的有自我校正機制——一旦休眠/暫停
時間超過一個完整開獎週期，同一個根因一樣會讓這些遊戲永久卡在「結算中」。

### 修法

7 個檔案都改成：

```ts
const { drawDate, cutoffAt, drawAt } = _nextDrawWindow(now)
```

`_attemptSettlement(now: Date)` 本身已經把真實現在時間當參數帶入，直接
沿用即可。

## 驗證

| 項目 | 方法 | 結果 |
|---|---|---|
| 程式碼模式確認 | grep 修正前後 | 7 個檔案皆從 `this.drawAt + 60_000` 改為 `now`，各檔案僅此一處符合舊模式 |
| 回歸測試 | `npm run test:{d539,dlt,m539,m649,p3,p4,superlotto}` | 全數通過 |
| 回歸測試 | `npm test` | 第一次跑 `test:6hc-cd`／`test:6hc-of`／`test:bg` 失敗，單獨重跑皆全過；確認是本次一次改動 7 個檔案觸發 Nitro 重啟、跟 dev-only 自動測試電池撞期的既有 transient 現象，與本次修正無關 |

本次修正屬於預防性修正——這 7 款遊戲沒有實際重現過卡死症狀，是檢查 bingo
的根因後主動排查發現的同類風險，提前消除。

## 風險與後續

- 無新增風險，純粹消除既有的潛在卡死風險
- 跟 bingo 一樣，不處理既有的期別序號狀態（這 7 款遊戲目前沒有觀察到序號
  超前的既成事實，純屬預防性修正）

## 封存前檢查

- [x] `validation.md` 結論為「通過」
- [x] 變更檔案、風險整理完成
- [x] 7 款遊戲各自回歸測試、`npm test` 回歸確認無關失敗項目已排除
- [ ] `openspec archive`
