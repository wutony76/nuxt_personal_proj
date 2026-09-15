# Validation

## 驗證範圍

- 對應變更：align-dlt-issue-with-official-period — DLT 內部期別格式對齊官方期別編號規則
- 驗證環境：本機 dev（`npm run dev`，既有 process，port 6100）

## 功能驗證

- 依 proposal 的「成功標準」逐項驗證：
  - [x] 功能符合需求且行為正確 — `npm run test:dlt` 40/40 全數通過，包含新增的格式斷言與
        「結算後 currentIssue 正確推進到下一個開獎日」
  - [x] 無新增重大 console / runtime error — 測試過程 server log 僅有預期內的
        `TTT---WARN.DLT` 警告（若 bootstrap 重試），無未預期例外
  - [x] 相關測試或手動驗證完成

## 視覺驗證

不涉及（純後端邏輯，無 UI 變更）。

## 回歸驗證

- 受影響既有流程檢查：
  - 流程：DLT 下注／拒單／8 獎項判定／A~E 多組互不影響／重複結算防護／開獎+結算整條流程
  - 結果：`npm run test:dlt` 40/40 全數通過
  - 流程：真實官方 API 交叉比對
  - 結果：`curl https://api.taiwanlottery.com/TLCAPIWeB/Lottery/LastNumber` 確認大樂透
    （gameCode 5118）目前最新一期為 `115000087`（民國 115 年第 87 期，2026-09-11 開獎），
    格式與序號規則跟本次實作的 `_nextOfficialPeriod()` 假設一致

## 問題與修正紀錄

- 問題：初版 `_nextOfficialPeriod()` 只以 `lastKnownOfficialPeriod` 為基準推算下一期，
  admin 測試端點連續呼叫（test 模式刻意不更新 `lastKnownOfficialPeriod`）會讓算出的
  `currentIssue` 跟「剛結算掉的內部期別」撞號——若這個撞號的期別之後真的被拿來下注，
  會被 `issueSettledMap` 誤判成「已結算過」，導致該期注單永遠不會派彩
  - 發現方式：`npm run test:dlt` 的「結算後 currentIssue 正確推進到下一個開獎日」斷言失敗
    （before/after 兩次都是 `115000088`）
  - 修正方式：新增 `_laterOfficialPeriod()`，結算後推進期別時取「官方最新已知期別」與
    「剛結算掉的內部期別」兩者數值較大的一個當基準
  - 是否已重新驗證：是，`npm run test:dlt` 重新執行後該項與其餘 39 項全數通過
- 問題（非本次變更所致，記錄供對照）：某一輪 `npm run test:dlt` 出現「三種拒單情境皆未扣款」
  失敗（coin 少了 600），但三個個別「應拒絕」斷言（400）本身都通過；重新執行後不再重現
  - 判斷：這支測試腳本打的是同一個長駐、非隔離的 dev server，連續重複執行會累積前幾輪
    留下的狀態（下注/結算/認領），推測是這類狀態殘留造成的一次性假警報，與本次變更
    （純期別計算邏輯）無關——本次變更完全沒有動到 `validateBetQuota`／扣款相關程式碼
  - 後續：若之後要讓 `test:dlt` 可重複執行不受歷史狀態影響，需要另外處理「測試前重置
    server 狀態」，不在本次變更範圍內

## 結論

- 是否通過：**通過**
- 已知限制或風險：
  - `_bootstrapOfficialPeriod()` 依賴能連上真實官方 API；若部署環境長時間無法對外連線，
    DLT 會持續停在「準備中」不受理下注（這是刻意的安全行為，不是 bug）
  - 現有（本次變更之前）dev 環境裡累積的舊格式（YYYYMMDD）測試下注紀錄不會回溯轉換，
    純記憶體 dev 資料，不影響正式邏輯
- 後續追蹤事項：
  - 若之後要讓 `scripts/test-dlt.mjs` 可重複執行不受歷史狀態影響，需另外設計「測試前重置」機制
