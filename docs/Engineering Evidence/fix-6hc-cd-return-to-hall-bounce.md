# Engineering Evidence

## 變更摘要

- 對應變更：`fix-6hc-cd-return-to-hall-bounce` — 修正 6hc-cd 單玩法頁「返回大廳」導航
  被彈回單一玩法頁的 bug
- 變更檔案清單：
  - `app/pages/lottery/bg/6hc-cd/[play].vue`
  - `openspec/changes/fix-6hc-cd-return-to-hall-bounce/{proposal,design,tasks,validation}.md`
- Commit / PR 參考：（尚未 commit，待使用者確認後再建立）

## 驗證佐證

- 對應 `validation.md` 結論：**通過**
- 佐證附件（截圖 / log / 測試輸出）：
  - Playwright `framenavigated` 時間序列（cookie 注入登入，進入
    `/lottery/bg/6hc-cd/tema` → 點擊「返回大廳」）：
    - 修正前：先到 `/lottery-hall`，約 1 秒內被彈回 `/lottery/bg/6hc-cd/tema`
    - 僅 `isUnmounted` 旗標（Fix 1）：情境 B（`domcontentloaded` 後立刻點擊）修正成功；
      情境 A（`networkidle` 後才點擊）仍於 t≈3151ms 被彈回
    - 加上 `_stillOnThisPage()` 同步路由檢查（Fix 2）：情境 A、情境 B 皆在 3 秒觀察窗
      內穩定停留在 `/lottery-hall`，不再出現任何導回 `/lottery/bg/6hc-cd/*` 的
      `framenavigated` 事件
  - `npm test`（36 支既有測試腳本）：34 支全數通過；`test:x5-cd`／`test:x5-of` 個別
    重跑後皆轉為全過（`test:x5-of` 29/29，`test:x5-cd` 25/25），確認是下注類測試對
    「開獎期間視窗」的既有時機性 flake，與本次只改動前端頁面邏輯的範圍無關

## 風險與後續追蹤

- 已知風險：無新增風險——本次修正純粹是「補齊『元件已離開這個路由』的判斷，不該執行
  的 side effect 就不要執行」，沒有改變任何正常情境下的行為
- 後續追蹤事項：
  - 其餘 14 個 BG 遊戲頁（例如 k3-cd）目前沒有「網址帶的玩法 key 不合法就自動
    `router.replace`」這段邏輯，所以沒有觸發本次症狀，但理論上相同的「舊元件非同步鏈
    卡著繼續跑」風險模式依然存在——是否需要同樣補上 `isUnmounted`／路由守衛防護，
    留待之後視實際需求另外評估，本次刻意不擴大範圍

## 封存前檢查

- [x] validation.md 已完成且結論為「通過」
- [x] 變更檔案與風險說明已整理完成
- [x] Playwright 兩情境驗證通過，`npm test` 34/36（其餘 2 支確認為既有時機性 flake）
- [ ] 可執行 `openspec archive` — 建議使用者確認後再封存
