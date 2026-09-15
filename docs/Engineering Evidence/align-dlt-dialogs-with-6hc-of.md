# Engineering Evidence

## 變更摘要

- 對應變更：`align-dlt-dialogs-with-6hc-of` — 大樂透（DLT）三個彈窗對齊 6hc-of 的功能與樣式
- 變更檔案清單：
  - `app/components/lottery/tw/dlt/block/DialogUser.vue`
  - `app/components/lottery/tw/dlt/block/DialogOpenCode.vue`
  - `app/components/lottery/tw/dlt/block/DialogRule.vue`
  - `app/pages/lottery/tw/dlt.vue`
  - `openspec/changes/align-dlt-dialogs-with-6hc-of/{proposal,design,tasks,validation}.md`
- Commit / PR 參考：（尚未 commit，待使用者確認後再建立）

## 驗證佐證

- 對應 `validation.md` 結論：**有條件通過**——程式碼/樣式比對與 API 回歸測試皆完成，唯三個彈窗的實際點擊互動因執行環境無登入憑證而未能手動操作
- 佐證附件（截圖 / log / 測試輸出）：
  - `npm run test:dlt` 輸出：40 項全數通過（下注扣款、8 獎項判定、A~E 多組互不影響、重複結算冪等性、開獎+結算整條流程）
  - `curl -o /dev/null -w '%{http_code}' http://localhost:6100/lottery/tw/dlt` 持續回 `200`

## 風險與後續追蹤

- 已知風險：
  - 三個彈窗的排序／篩選／分頁籤／命中標記僅完成程式碼層級驗證，尚未由使用者在瀏覽器實際操作確認
  - `DialogRule.vue` 內容為改寫（DLT 無彩池，不可照搬 6hc-of 的獎池滾存章節），文字用語需使用者確認是否符合預期
- 後續追蹤事項（Open Questions 延伸）：
  - 使用者登入後手動驗證三個彈窗的互動與排版，若有落差再回頭調整
  - 若後續要幫 DLT 補自動化 UI 測試（目前 `test:dlt` 只測 API/結算邏輯，不含彈窗互動），可另開變更處理

## 封存前檢查

- [x] validation.md 已完成且結論為「有條件通過」（非純「通過」，因彈窗互動待使用者手動確認）
- [x] 變更檔案與風險說明已整理完成
- [x] `npm run dev`（既有 process）已確認 `/lottery/tw/dlt` 回應正常；`npm run test:dlt` 40 項全數通過
- [ ] 可執行 `openspec archive` — 建議等使用者完成手動互動驗證後再封存
