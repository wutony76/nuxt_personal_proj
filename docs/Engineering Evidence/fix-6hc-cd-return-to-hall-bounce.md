# Engineering Evidence：6hc-cd 返回大廳被彈回單一玩法頁

## 變更摘要

- **對應變更**：`fix-6hc-cd-return-to-hall-bounce`
- **Commit**：`378c1f5`
- **變更檔案**：`app/pages/lottery/bg/6hc-cd/[play].vue`

### 問題

在 `/lottery/bg/6hc-cd/tema` 點「返回大廳」，會先到 `/lottery-hall`，約 1 秒內又被導回 `/lottery/bg/6hc-cd/tema`。

### 根因

`onMounted` 和 `syncPlayByRoute()` 裡有多個 `await`。使用者在這串非同步流程跑完前離開頁面，流程不會被取消，會繼續執行到 `syncPlayByRoute()`。這時路由已經是 `/lottery-hall`，`route.params.play` 是 `undefined`，被判定為「網址帶的玩法 key 不合法」，於是 `router.replace('/lottery/bg/6hc-cd/tema')` 把人導回來。

### 修法

1. **`isUnmounted` 旗標**：每個 `await` 之後先確認元件還在，不在就不再操作路由或共用狀態。
2. **`_stillOnThisPage()` 同步路由檢查**：Vue Router 會先更新 route，元件卸載晚一步才發生。這個空檔裡 `watch(routePlayKey)` 已經觸發，但 `isUnmounted` 還是 false，只靠旗標攔不住。所以改成直接檢查目前路由是否仍在 `/lottery/bg/6hc-cd` 底下。

## 驗證

用 Playwright 記錄 `framenavigated` 的時間序列（以 cookie 注入登入）：

| 版本 | 情境 A（`networkidle` 後點擊） | 情境 B（`domcontentloaded` 後立刻點擊） |
|---|---|---|
| 修正前 | 被彈回 | 被彈回 |
| 只加 `isUnmounted` | t≈3151ms 仍被彈回 | 修正成功 |
| 加上 `_stillOnThisPage()` | 3 秒觀察期內穩定停在 `/lottery-hall` | 同左 |

`npm test`：34/36 通過。`test:x5-cd`、`test:x5-of` 個別重跑後全過（29/29、25/25），屬於下注測試撞到開獎期間的既有時機性失敗。

## 風險與後續

- `_stillOnThisPage()` 的路徑字串是寫死的，之後改路由時需要同步修改。
- 其他 14 個 BG 遊戲頁沒有「玩法 key 不合法就 `router.replace`」的邏輯，所以沒有觸發這個症狀，但同樣存在「卸載後非同步流程繼續跑」的風險。本次不擴大範圍，之後視需要再評估。

## 封存前檢查

- [x] `validation.md` 結論為「通過」
- [x] 變更檔案、風險整理完成
- [ ] `openspec archive`
