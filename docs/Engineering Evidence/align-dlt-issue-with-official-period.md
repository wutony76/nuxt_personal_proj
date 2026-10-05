# Engineering Evidence

## 變更摘要

- 對應變更：`align-dlt-issue-with-official-period` — DLT 內部期別格式對齊官方期別編號規則，
  並回填開獎歷史
- 變更檔案清單：
  - `server/services/game/lottery/tw/dlt.ts`
  - `server/services/game/lottery/tw/taiwanLotteryApi.ts`
  - `server/api/lottery-tw/dlt/opencode-history.get.ts`
  - `scripts/test-dlt.mjs`
  - `openspec/changes/align-dlt-issue-with-official-period/{proposal,design,tasks,validation}.md`
- Commit / PR 參考：`ef12d9c`

## 驗證佐證

- 對應 `validation.md` 結論：**通過**
- 佐證附件（截圖 / log / 測試輸出）：
  - `npm run test:dlt` 輸出：40 項全數通過（含新格式斷言、結算後期別正確推進）
  - `curl -s https://api.taiwanlottery.com/TLCAPIWeB/Lottery/LastNumber`：確認大樂透
    （gameCode 5118）目前最新一期為 `115000087`（民國 115 年第 87 期，2026-09-11 開獎），
    驗證了官方期別編號規則（民國年 3 碼＋該年度序號 6 碼）與本次實作一致
  - 登入後打 `/api/lottery-tw/dlt/opencode-history`：過濾「（測試）」紀錄後，成功回填
    11 筆真實歷史（`115000077`～`115000087`，含 bootstrap 種子期別本身），開獎日期正確落在週二/五，開獎號碼與直接
    `curl` `Lotto649Result?period=115000086` 拿到的官方資料一致
  - 修正「測試污染正式期別」問題後（`_attemptSettlement` 測試模式不再推進期別、
    `_settleIssue` 新增 `isTest` 繞過全域 `issueSettledMap` 鎖改逐注判斷），連續執行
    `npm run test:dlt` 3 次皆 40/40 全數通過，且期間 `currentIssue` 全程維持
    `115000088` 不變（登入查 `/api/lottery-tw/dlt/current` 交叉確認）

## 風險與後續追蹤

- 已知風險：
  - server 若長時間無法連上官方 API，DLT 會持續停在「準備中」不開放下注（刻意設計，非 bug）
  - `scripts/test-dlt.mjs` 對同一個長駐 dev server 連續重複執行可能累積狀態造成偶發假警報
    （本次驗證時觀察到一次「三種拒單情境皆未扣款」的假失敗，重跑即恢復正常，與本次變更
    的期別計算邏輯無關）
  - 回填只能回填同一民國年度內的期數，固定 10 筆（`DLT_BACKFILL_COUNT`）；跨年度回填
    需要另外評估安全的序號起點推算方式
- 後續追蹤事項（Open Questions 延伸）：
  - 若之後要讓 `test:dlt` 可重複執行不受歷史狀態影響，需另外設計「測試前重置」機制
  - 舊格式（YYYYMMDD）的 dev 測試資料不會回溯轉換（純記憶體資料，重啟即清空，非正式風險）
  - 若需要回填更多筆數或涵蓋跨年度，屬於獨立的後續調查（需先確認能否可靠推算跨年
    序號起點），不在本次範圍內

## 封存前檢查

- [x] validation.md 已完成且結論為「通過」
- [x] 變更檔案與風險說明已整理完成
- [x] `npm run dev`（既有 process）搭配 `npm run test:dlt` 已確認 40/40 全數通過
- [ ] 可執行 `openspec archive` 
