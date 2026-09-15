# Proposal

## 變更名稱

align-dlt-dialogs-with-6hc-of — 大樂透（DLT）三個彈窗對齊 6hc-of 的功能與樣式

## 背景

DLT（大樂透）頁面的 `DialogUser`／`DialogOpenCode`／`DialogRule` 是比照 6hc-of 的雛形早期先做出的簡化版：
只有單一列表、沒有分頁籤、沒有排序、沒有期數篩選、也沒有把 composable 裡已經在抓的
`isLoading`／`errorMessage` 顯示出來。6hc-of 那一版經過多輪迭代後功能明顯更完整，
使用者要求把 DLT 這三個彈窗「拉齊」到跟 bg 系列（以 6hc-of 為準）一致的水準。

## 目標

- `DialogUser`：補上分頁籤（餘額變動表／下注紀錄）、排序、期數篩選、開獎球命中標記、loading/error 顯示
- `DialogOpenCode`：補上排序（期數/開始/結束時間）、期數查詢、「該期是否有下注」淡化標記、loading/error 顯示
- `DialogRule`：改成 6hc-of 那種「頂部快捷導覽 + 分段 + 回頂部」結構，但內容維持 DLT 自己的真實規則
  （官方鏡射、無彩池、無自建賠率——不可照抄 6hc-of 的彩池/獎池滾存章節）

## 範圍

- 包含：
  - `app/components/lottery/tw/dlt/block/DialogUser.vue`
  - `app/components/lottery/tw/dlt/block/DialogOpenCode.vue`
  - `app/components/lottery/tw/dlt/block/DialogRule.vue`
  - `app/pages/lottery/tw/dlt.vue`（補傳 `betIssues` 給 `DialogOpenCode`，比照 6hc-of.vue:194-195）
- 不包含：
  - 不新增／調整後端 API（`userRecordDlt`／`openCodeHistoryDlt` 既有欄位已足夠支撐這次的 UI 需求）
  - 不動 `useDlt.ts` 的資料結構
  - 不處理 6hc-of 專屬、DLT 不適用的概念（彩池、獎池滾存、賠率估算）

## 影響面

- 前端路由/頁面：`app/pages/lottery/tw/dlt.vue`
- 前端元件/Composables：上述三個 Dialog 元件；`useDlt()` 只讀不改
- 後端 API/Services：無
- 設定或常數（`app/config/`）：無

## 風險與對策

- 技術風險：
  - 風險：DLT 是官方鏡射玩法，沒有彩池/獎池滾存，若直接複製 6hc-of 的 DialogRule 內容會出現不存在的機制說明，誤導玩家
  - 對策：`DialogRule` 只抄「結構」（導覽/分段/回頂部/table 樣式），內容改寫成 DLT 實際規則（官方鏡射、8 獎項對中條件、每週二五 20:00 截止 20:30 開獎、結算等待官方資料）
- UI/UX 風險：
  - 風險：DLT 沒有複式/膽拖玩法（6hc-of 有 danCode/tuoCode 顯示邏輯），照抄會產生用不到的分支
  - 對策：`DialogUser` 的下注明細只保留單式 6+1 顯示，不搬 danCode/tuoCode 相關程式碼

## 驗證方式

- 功能驗證：
  - 開啟會員彈窗，切換餘額變動表／下注紀錄分頁籤，排序與期數篩選皆可運作
  - 開啟開獎歷史彈窗，排序與期數查詢皆可運作，未下注期數淡化顯示
  - 開啟玩法說明彈窗，快捷導覽可捲動至對應分段，回頂部按鈕可用
- 視覺驗證：
  - 三個彈窗的 table／tab／排序箭頭樣式與 6hc-of 對應元件一致（同一套 `.report-table`／`.dialog-tab`／`.rule-table` 視覺語言）
- 回歸驗證：
  - `curl` 確認 `/lottery/tw/dlt` 頁面仍可正常編譯回應
  - 既有「可領獎金」領取流程不受影響

## 成功標準

- [ ] 功能符合需求且行為正確
- [ ] UI 與 6hc-of 對應元件一致
- [ ] 無新增重大 console / runtime error
- [ ] 相關測試或手動驗證完成
