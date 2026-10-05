# Tasks

## 1. 重現與根因診斷

- [x] 用登入 cookie 直接查 `/api/lottery-tw/bingo/current`，確認
      `currentStatus: "結算中（等待官方資料）"`，真實下注被 400 拒絕
- [x] 直接 curl 官方 API（`https://api.taiwanlottery.com/TLCAPIWeB/Lottery/
      LastNumber`）確認 bingo 資料本身在 `content.bingo`（不在
      `content.lastNumberList` 裡），且 `fetchTaiwanLotteryLastNumber()` 已
      經正確處理這個特例，排除「抓不到官方資料」這個假設
- [x] 查我方 `/api/lottery-tw/last-number` 確認伺服器端確實能正常抓到最新
      官方期別，排除「對外請求本身失敗」這個假設
- [x] 比對 `cutoffAt`（停在「2026-10-04 20:20:00」）與真實時間（「2026-10-05
      09:58」），確認落後約 13.6 小時
- [x] 讀 `_attemptSettlement()` 原始碼，定位到
      `_nextFiveMinuteBoundary(new Date(this.drawAt + 1000))` 用自己過去的
      值當基準，不是真實 `now`，是永久卡死的根因

## 2. 修正

- [x] 改成 `_nextFiveMinuteBoundary(now)`，與 `_ensureIssue()` 的 bootstrap
      路徑用同一個基準

## 3. 驗證

- [x] Nitro dev 重啟後（程式碼變更觸發）重新查
      `/api/lottery-tw/bingo/current`：`currentStatus` 恢復「開盤中」，
      `cutoffAt` 正確對齊真實時間的下一個 5 分鐘整點，`issue` 序號回到跟
      真實官方序號相近（不再超前 91 期）
- [x] 真實下注：成功（`下注成功`，正確扣款、產生訂單）
- [x] `npm run test:bingo`：94/94 全數通過
- [x] `npm test`（36 支既有測試腳本）：`test:6hc-cd`／`test:bg`／
      `test:bingo` 第一次跑時失敗，單獨重跑皆全數通過，確認是已知的
      「Nitro 重啟觸發 `server/plugins/init.ts` 的 dev-only 自動測試電池
      跟手動測試跑在同一時間撞期」的既有 transient 現象，與本次改動無關

## 4. 文件交付

- [x] 完成 `proposal.md`／`design.md`／`tasks.md`／`validation.md`
- [x] 新增 `docs/Engineering Evidence/fix-bingo-stuck-settlement-clock-drift.md`
