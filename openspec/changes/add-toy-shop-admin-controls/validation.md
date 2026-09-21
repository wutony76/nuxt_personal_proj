# Validation

## 驗證範圍

- 對應變更：add-toy-shop-admin-controls
- 驗證環境：本機 dev（`npm run dev`，port 6100），以 admin 帳號（admin@example.com）手動 curl
  + Playwright 驗證

## 功能驗證

- 依 proposal 的「成功標準」逐項驗證：
  - [x] 功能符合需求且行為正確 — 實際結果：
    - `GET /api/admin/toy-shop/settings` 回傳 `enabled: true` 與 8 款玩法賠率（預設皆為 1）
    - `PATCH /api/admin/toy-shop/settings` 設 `enabled: false` 後，`POST
      /api/games/toys/pog/roll` 直接回 403「柑仔店櫥仔目前暫停開放。」
    - 關閉期間 `GET /api/games/toys/catalog` 回應 `enabled: false`
    - 前台 `/lottery-hall-taiwan` 貨架的柑仔店櫥仔 `<section>` 整塊從 DOM 移除（含標題／
      購買紀錄按鈕），非僅顯示提示文字（使用者要求改為整塊隱藏後已重新驗證，`#tw-shelf`
      在關閉時 `locator` 命中數為 0，開啟後恢復為 1）
    - 重新 `PATCH enabled: true` 後下注恢復正常
    - 將 `whistle-candy` 賠率倍數設為 3，實際下注觸發一次 `win`（reward 顯示 19 = 10 注 ×
      1.9 倍賠率），確認 wallet 帳本（`GET /api/games/toys/history`）記錄的 `toy-reward`
      實際入帳金額為 57（= 19 × 3），驗證後將倍數改回 1
  - [x] UI 與 Figma 規格一致 — 實際結果：本變更未涉入新 Figma 稿（proposal 已聲明沿用既有
    `admin-*` token），視覺比對改列在下一項
  - [x] 無新增重大 console / runtime error — 實際結果：開發過程中曾因 JSDoc 註解內出現
    `*/roll.post.ts` 字面字串，被 esbuild 誤判為註解結束字元，觸發一次 transform 錯誤
    （500）；已改寫註解移除該字串，重新請求恢復 200，之後未再出現
  - [x] 相關測試或手動驗證完成 — 實際結果：見上方逐項 curl／Playwright 驗證

## 視覺驗證

- 與設計稿 / Figma / 既有規格比對：
  - 項目：「柑仔店櫥仔設定」區塊（開關 + 賠率表）
  - 結果：沿用 `admin-panel`／`admin-table`／`admin-input`／`admin-btn-primary` 既有 class，
    與頁面其餘區塊（KPI 卡片、玩法明細、中獎明細）視覺一致，Playwright 截圖確認排版正常
- 響應式斷點檢查：未特別測試窄螢幕（沿用既有 `.atl-*` 版型慣例，跟同頁其他表格行為一致）

## 回歸驗證

- 受影響既有流程檢查：
  - 流程：「彩運來」既有中獎明細／玩法明細報表（`tw-lottery-payout`）
    結果：不受影響，資料來源獨立（台彩鏡射玩法 vs 柑仔店櫥仔是兩套資料）
  - 流程：「經典遊戲」既有 coin 常數編輯功能
    結果：未修改對應檔案，不受影響
  - 流程：柑仔店櫥仔既有 8 款玩法下注／購買紀錄
    結果：開關開啟、賠率倍數為預設值 1 時，行為與變更前一致（僅多了一層乘 1 的運算，
    無實際差異）

## 問題與修正紀錄

- 問題：`server/services/admin/modules/toyShop.ts` 的 JSDoc 註解內文字含
  `server/api/games/toys/*/roll.post.ts`，其中 `*/` 被 esbuild 解讀為註解結束，導致後續
  程式碼被誤判成語法錯誤（`Expected ";" but found "wallet"`），API 回 500
  - 發現方式：實作後第一次呼叫 `GET /api/admin/toy-shop/settings` 驗證時發現
  - 修正方式：改寫註解，避免路徑字串中出現連續的 `*/`
  - 是否已重新驗證：是，修正後重新呼叫恢復 200，並完成後續全部功能驗證

## 結論

- 是否通過：是
- 已知限制或風險：
  - 開關與賠率皆為 in-memory，伺服器重啟後回復程式碼預設值（`enabled: true`、賠率 1），
    與專案現況其他後台可調參數（coin 常數等）行為一致，非本變更新增風險
  - 賠率倍數目前對 8 款玩法一視同仁地乘在最終派彩金額上，不影響下注扣款與各玩法內部機率
    判定；若未來需要「調整中獎機率」而非「調整派彩倍數」，需另開變更處理
- 後續追蹤事項：
  - 目前只有「整個柑仔店」一顆總開關，尚無單一玩法各自開關（proposal 已聲明不含在本次範圍）
