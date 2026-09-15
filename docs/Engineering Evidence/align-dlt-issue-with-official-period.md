# Engineering Evidence

## 變更摘要

- 對應變更：`align-dlt-issue-with-official-period` — DLT 內部期別格式對齊官方期別編號規則
- 變更檔案清單：
  - `server/services/game/lottery/tw/dlt.ts`
  - `scripts/test-dlt.mjs`
  - `openspec/changes/align-dlt-issue-with-official-period/{proposal,design,tasks,validation}.md`
- Commit / PR 參考：（尚未 commit，待使用者確認後再建立）

## 驗證佐證

- 對應 `validation.md` 結論：**通過**
- 佐證附件（截圖 / log / 測試輸出）：
  - `npm run test:dlt` 輸出：40 項全數通過（含新格式斷言、結算後期別正確推進）
  - `curl -s https://api.taiwanlottery.com/TLCAPIWeB/Lottery/LastNumber`：確認大樂透
    （gameCode 5118）目前最新一期為 `115000087`（民國 115 年第 87 期，2026-09-11 開獎），
    驗證了官方期別編號規則（民國年 3 碼＋該年度序號 6 碼）與本次實作一致

## 風險與後續追蹤

- 已知風險：
  - server 若長時間無法連上官方 API，DLT 會持續停在「準備中」不開放下注（刻意設計，非 bug）
  - `scripts/test-dlt.mjs` 對同一個長駐 dev server 連續重複執行可能累積狀態造成偶發假警報
    （本次驗證時觀察到一次「三種拒單情境皆未扣款」的假失敗，重跑即恢復正常，與本次變更
    的期別計算邏輯無關）
- 後續追蹤事項（Open Questions 延伸）：
  - 若之後要讓 `test:dlt` 可重複執行不受歷史狀態影響，需另外設計「測試前重置」機制
  - 舊格式（YYYYMMDD）的 dev 測試資料不會回溯轉換（純記憶體資料，重啟即清空，非正式風險）

## 封存前檢查

- [x] validation.md 已完成且結論為「通過」
- [x] 變更檔案與風險說明已整理完成
- [x] `npm run dev`（既有 process）搭配 `npm run test:dlt` 已確認 40/40 全數通過
- [ ] 可執行 `openspec archive` — 建議使用者確認後再封存
