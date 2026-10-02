# Validation

## 功能驗證

用 Playwright（cookie 注入登入，略過 UI 登入表單）重現並驗證兩種情境：

- 情境 A：`page.goto(..., { waitUntil: 'networkidle' })` 後才點擊「返回大廳」
  （非同步鏈大多已跑完才離開）
- 情境 B：`page.goto(..., { waitUntil: 'domcontentloaded' })` 後立刻點擊（非同步鏈仍在
  進行中就離開）

| 階段 | 情境 A（networkidle 後點擊） | 情境 B（domcontentloaded 後立刻點擊） |
| --- | --- | --- |
| 修正前 | 先到 `/lottery-hall`，約 1s 內被彈回 `tema` | 先到 `/lottery-hall`，約 1s 內被彈回 `tema` |
| Fix 1（僅 `isUnmounted`） | 仍被彈回（t≈3151ms 導回 `tema`） | 修正成功，穩定停留在 `/lottery-hall` |
| Fix 2（加 `_stillOnThisPage()`） | 修正成功，穩定停留在 `/lottery-hall` | 修正成功，穩定停留在 `/lottery-hall` |

Fix 2 最終驗證記錄（`framenavigated` 事件時間序列）：

```
--- 情境A：networkidle 後才點 ---
  t=163ms  -> /lottery/bg/6hc-cd/tema
  t=1726ms -> /lottery/bg/6hc-cd/tema
  t=1842ms -> /lottery/bg/6hc-cd/tema
  t=1854ms -> /lottery/bg/6hc-cd/tema
  t=2999ms -> /lottery/bg/6hc-cd/tema
  t=2999ms -> /lottery-hall
  最終網址: /lottery-hall（沒有再被彈回）

--- 情境B：domcontentloaded 就立刻點 ---
  t=32ms   -> /lottery/bg/6hc-cd/tema
  t=826ms  -> /lottery-hall
  t=1220ms -> /lottery-hall
  t=1298ms -> /lottery-hall
  t=1298ms -> /lottery-hall
  最終網址: /lottery-hall（沒有再被彈回）
```

兩種情境在 3 秒觀察窗內都只停留在 `/lottery-hall`，沒有再出現任何導回
`/lottery/bg/6hc-cd/*` 的 `framenavigated` 事件。

## 視覺驗證

不涉及（本次變更不影響任何畫面渲染或動畫邏輯）。

## 回歸驗證

`npm test`（36 支既有測試腳本）執行結果：34 支全數通過；`test:x5-cd`／`test:x5-of`
出現「等待開盤逾時」「目前為『已開獎』，不受理投注」類失敗——這是下注類測試對
「開獎期間視窗」的時機敏感性（測試腳本在下注前等待開盤，若測試執行當下剛好遇到
官方/內部期別切換到已開獎狀態，下注就會被伺服器正常拒絕），與本次只改動
`app/pages/lottery/bg/6hc-cd/[play].vue` 的前端頁面邏輯無關聯（該檔案不影響任何
後端下注/開獎時序）。

個別重跑驗證：

- `npm run test:x5-of` 單獨重跑：29/29 全過
- `npm run test:x5-cd` 第一次重跑：23/25（仍有 2 項時機性失敗）；第二次重跑：25/25
  全過

確認是既有的、與本次改動無關的時機性 flake，不是本次修正造成的回歸。

## 成功標準檢查

- [x] 功能符合需求且行為正確（兩種情境皆不再彈回大廳）
- [x] 無新增重大 console / runtime error
- [x] 相關測試或手動驗證完成（Playwright 兩情境 + `npm test` 34/36，其餘 2 支確認為
      既有時機性 flake）
