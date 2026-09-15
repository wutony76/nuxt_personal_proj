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
  - 流程：開獎歷史回填
  - 結果：登入後打 `/api/lottery-tw/dlt/opencode-history`，過濾掉「（測試）」紀錄後剩下
    11 筆真實資料（期別 `115000077`～`115000087`，含 bootstrap 當下的最新一期本身），
    開獎日期正確落在週二/五（2026-08-07 ～ 2026-09-11），開獎號碼皆為 7 碼且與 `curl`
    直接查詢 `Lotto649Result?period=115000086` 拿到的 `drawNumberSize` 一致

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
- 問題：`_backfillHistory()` 只回填「比 `lastKnownOfficialPeriod` 更舊」的期別，導致
  bootstrap 當下已知的最新一期本身（例如 `115000087`）永遠不會被記進 `recordOpenCode`——
  它既不在回填範圍內，往後的正常結算流程也只會記錄「比它更新」的期別，這期就這樣被漏掉
  - 發現方式：使用者實際查看「開獎歷史」，回報最新一期（`115000087`）沒有出現
  - 修正方式：抽出共用的 `_recordDraw()`，在 `_bootstrapOfficialPeriod()` 成功拿到最新一期
    的當下就順手把它自己也記進 `recordOpenCode`（該筆資料本來就已經有了，不需要多打一次
    API），`_backfillHistory()` 改呼叫同一個 helper
  - 是否已重新驗證：是，登入後打 `/api/lottery-tw/dlt/opencode-history` 確認 `115000087`
    已出現在真實歷史清單最前面（共 11 筆），`npm run test:dlt` 重新執行後 40/40 全數通過
- 問題：使用者回報「測試後的期號不能影響正式的」——`dlt-test-draw` 原本會讓真正的
  `currentIssue`／`cutoffAt`／`drawAt` 跟著每次測試呼叫一起推進，反覆執行測試腳本會讓
  站上顯示的期號跟官方真實序號脫鉤（實測從 `115000088` 一路被推到 `115000091`），且無法
  回復（只能重啟 server）
  - 修正方式：`_attemptSettlement()` 測試模式在 `_settleIssue()` 判定/派彩完成後直接
    `return`，不再往下動 `currentIssue`／`cutoffAt`／`drawAt`／`lastKnownOfficialPeriod`
  - 這個修正本身又衍生出第二個問題：`currentIssue` 不再推進後，反覆執行測試腳本會一直
    對「同一個」真正的期別呼叫 `_settleIssue()`，而 `issueSettledMap` 這把「整期只結算
    一次」的鎖是全域性的——第一次測試呼叫就會把這個真正的期別永久標記成「已結算」，
    之後：(a) 同一期別下一次測試呼叫的新注單會被這把鎖擋下、永遠卡在 pending；
    (b) 更嚴重的是，這期真正開獎時，真實的 `_attemptSettlement()` 呼叫 `_settleIssue()`
    也會被同一把鎖擋下，導致這期所有真實注單永遠不會被真正結算
    - 發現方式：`npm run test:dlt` 的「透過真實 /api/lottery/bet 送出的注單，經開獎+結算
      流程後正確判定頭獎」在連續執行第二次後開始穩定失敗（`winStatus` 停在 `pending`）
    - 修正方式：`_settleIssue()` 新增 `isTest` 參數——測試模式不檢查/不寫入
      `issueSettledMap`，改成逐注判斷：只處理該注目前仍是 `pending` 的注單，已經測試過
      （win/lose）的注單不重複派彩，避免反覆測試呼叫重複發錢；真實結算路徑（`isTest`
      預設 `false`）完全不受影響，`issueSettledMap` 的鎖對真正的期別依然有效
    - 是否已重新驗證：是，`npm run test:dlt` 連續執行 3 次皆 40/40 全數通過，
      `currentIssue` 全程維持 `115000088` 不變
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
  - 回填只能回填「同一民國年度」內的期數，且回填筆數固定 10 筆（`DLT_BACKFILL_COUNT`）；
    跨年度或需要更多歷史筆數需另外評估（跨年反推序號沒有安全依據，見 proposal 的排除項）
- 後續追蹤事項：
  - 若之後要讓 `scripts/test-dlt.mjs` 可重複執行不受歷史狀態影響，需另外設計「測試前重置」機制
  - 若使用者希望回填筆數更多或涵蓋跨年度，需先確認官方是否有其他方式可靠推算/驗證跨年
    序號起點，屬於獨立的後續調查，不在本次範圍內
