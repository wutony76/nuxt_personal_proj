# Validation

## 驗證範圍

- 對應變更：align-dlt-dialogs-with-6hc-of — DLT 三個彈窗對齊 6hc-of
- 驗證環境：本機 dev（`npm run dev`，既有 process，port 6100）

## 功能驗證

- 依 proposal 的「成功標準」逐項驗證：
  - [x] 功能符合需求且行為正確 — 三個元件的排序／篩選／分頁籤／命中標記邏輯皆複製自已上線且長期運作的 6hc-of 對應實作，只替換資料來源為 `useDlt()` 既有欄位，欄位型別（`DltUserBetHistory`／`LotteryUserBalanceChange`／`LotteryOpenCodeHistoryItem`）與 6hc-of 對應型別的欄位語意一致
  - [x] UI 與 6hc-of 對應元件一致 — table/tab/排序箭頭/sticky 表頭/淡化列樣式皆沿用同一套 class 結構與數值
  - [x] 無新增重大 console / runtime error — `curl` 驗證頁面持續回 200，且渲染內容無 500/exception 字樣
  - [ ] 相關測試或手動驗證完成 — API 層以 `npm run test:dlt`（40 項）驗證下注/結算未受影響；**三個彈窗的實際互動需要登入帳號在瀏覽器操作，本次執行環境無法登入，未完成手動點擊驗證**（見下方已知限制）

## 視覺驗證

- 與設計稿 / Figma / 既有規格比對：
  - 項目：DLT 三個彈窗 vs `app/components/lottery/bg/6hc/of/block/{DialogUser,DialogOpenCode,DialogRule}.vue`
  - 結果：class 命名（`.dialog-tab`／`.report-table`／`.sortable-th`／`.rule-table`／`.rule-nav-btn`…）與樣式數值（字級、圓角、pill 標籤、sticky 表頭陰影）逐一比對後複製，僅將色票替換為 DLT 既有 `--color-red-*` token（與 6hc-of 本來就是同一組全域 token，數值相同）
- 響應式斷點檢查：沿用 6hc-of 既有 `.dialog-table-wrap { overflow-x: auto }`／`.timeline-table-wrap`／`.prize-table-wrap` 橫向捲動策略，未額外新增斷點

## 回歸驗證

- 受影響既有流程檢查：
  - 流程：DLT 下注／結算／領獎（`npm run test:dlt`）
  - 結果：40 項全數通過，涵蓋下注扣款、8 獎項判定、A~E 多組互不影響、重複結算冪等性、開獎+結算整條流程；本次改動未觸碰 `useDlt.ts`／server 端邏輯，符合預期
  - 流程：`/lottery/tw/dlt` 頁面編譯與渲染
  - 結果：`curl -o /dev/null -w '%{http_code}'` 持續回 200

## 問題與修正紀錄

- 問題：`DialogUser.vue` 初版誤留一段無作用的 `.claim-btn:disabled ~ .no-records` 空規則（複製過程的殘留）
  - 發現方式：自我 review 時發現
  - 修正方式：移除該段 CSS
  - 是否已重新驗證：是（移除後頁面仍正常回應 200）

## 結論

- 是否通過：**有條件通過**
- 已知限制或風險：
  - 本次執行環境無登入憑證，無法在瀏覽器實際開啟三個彈窗操作排序／篩選／分頁籤／命中標記，僅完成程式碼層級比對與頁面編譯層級驗證；建議使用者實際登入後手動驗證一次（比照過去每次改動的慣例提醒）
  - `DialogRule.vue` 的內容為改寫而非照搬 6hc-of（DLT 無彩池機制），文字需使用者確認是否貼近既有官方玩法說明用語
- 後續追蹤事項：
  - 若使用者手動驗證發現排版或互動落差，回頭調整對應 class
