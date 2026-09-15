# Tasks

## 1. 規格與設計確認

- [x] 完成 proposal 定稿（範圍/風險/驗證方式）
- [x] 完成 design 定稿（state/flow/token mapping）

## 2. DialogUser.vue

- [x] 加上 `isLoading`／`errorMessage` 顯示（比照 6hc-of）
- [x] 加上分頁籤：餘額變動表／下注紀錄
- [x] 餘額變動表：時間欄位可排序
- [x] 下注紀錄：期數篩選、注單序號／中獎金額可排序、開獎球命中標記（用 DLT 自己的 `Ball` + `hit` prop）
- [x] 移除 6hc-of 專屬但 DLT 不適用的 danCode/tuoCode 分支與彩池摘要列

## 3. DialogOpenCode.vue

- [x] 加上 `isLoading`／`errorMessage` 顯示
- [x] 加上期數查詢輸入框
- [x] 加上期數／開始時間／結束時間排序
- [x] 加上 `betIssues` prop，未下注期數整列淡化

## 4. dlt.vue

- [x] `DialogOpenCode` 補傳 `:bet-issues="userRecord.betHistory.map(b => b.issue)"`（比照 6hc-of.vue:194-195）

## 5. DialogRule.vue

- [x] 改成「頂部快捷導覽 + 分段 + 回頂部」結構
- [x] 內容改寫為 DLT 實際規則（不搬彩池/獎池滾存章節）：遊戲簡介／開獎流程（官方每週二五 20:00 截止 20:30 開獎）／投注玩法（A~E 單式）／8 獎項對中條件／特別說明

## 6. 視覺與互動驗證

- [x] 三元件 table／tab／排序箭頭樣式與 6hc-of 對應元件一致（同一套 class 命名與樣式數值）
- [ ] 手動開啟三個彈窗逐項互動驗證——**需要登入瀏覽器操作，本次未能執行**，見 validation.md 已知限制

## 7. 交付檢查

- [x] 確認 `npm run dev`（既有 dev server, port 6100）可正常回應 `/lottery/tw/dlt`
- [x] `npm run test:dlt`（40 項）全數通過，確認未影響下注/結算邏輯
- [x] 變更檔案與風險說明整理完成
- [x] 補 `validation.md` 與 `docs/Engineering Evidence/` 文件
