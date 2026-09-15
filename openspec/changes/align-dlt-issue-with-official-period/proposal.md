# Proposal

## 變更名稱

align-dlt-issue-with-official-period — DLT 內部期別格式對齊台灣彩券官方期別編號規則

## 背景

DLT（大樂透）原本的內部佔位期別（`currentIssue`）用純 `YYYYMMDD` 日曆日期字串（例如
`20260917`），跟官方真實期別（民國年 3 碼＋該年度序號 6 碼，例如 `115000087` = 民國 115 年
第 87 期）完全是兩套不同的編號空間。這是 `openspec/changes/add-dlt/design.md` Decision 3
的刻意選擇：因為官方「最新一期」端點只能查已開獎的期別，開獎前無法預先得知官方會分配的
期別字串，若猜錯編號規則會導致輪詢比對永遠對不上。

使用者從官方公開資料確認了實際編號規則（民國年 + 該年度序號，逐期 +1，跨年重置為 1），
要求 DLT 的期別對齊這套規則，才能真正跟官方 API 對得上——目前下注紀錄用的期別跟開獎歷史
（`recordOpenCode`，本來就用真實官方 period）是兩套不同格式，使用者很難拿下注紀錄的期別
去比對開獎歷史。

## 目標

- `currentIssue` 改用官方格式（民國年 3 碼＋序號 6 碼），並且序號能正確逐期遞增、跨年重置
- 在完全沒有任何官方資料基準之前，絕不瞎猜序號起點（沿用 Decision 3 的謹慎精神，只是把
  「猜測」換成「先跟官方要一次基準，之後純粹算術推進」）
- 確保 admin 測試端點（`dlt-test-draw`／`dlt-test-settle`）的假資料流程，不會讓 `currentIssue`
  意外撞回剛結算掉的舊期別（避免撞號的期別被 `issueSettledMap` 誤判成已結算，導致新一期注單
  永遠不會派彩）

## 範圍

- 包含：
  - `server/services/game/lottery/tw/dlt.ts`（期別計算／啟動時序）
  - `scripts/test-dlt.mjs`（更新格式斷言）
- 不包含：
  - 不改 `_settleIssue()` 判定/派彩邏輯本身
  - 不改前端顯示格式或 `useDlt.ts`（前端本來就不解析 `issue` 字串內部結構，純顯示不受影響）
  - 不處理既有（YYYYMMDD 格式）測試資料的格式轉換／遷移（純記憶體內的 dev 測試資料，重啟即可）

## 影響面

- 前端路由/頁面：無（`app/composables/useDlt.ts` 不解析 `issue` 格式，純顯示不受影響）
- 前端元件/Composables：無
- 後端 API/Services：`server/services/game/lottery/tw/dlt.ts`
- 設定或常數（`app/config/`）：無

## 風險與對策

- 技術風險：
  - 風險：server 啟動當下若完全無法連上官方 API（網路問題），`currentIssue` 會維持未分配狀態，
    下注會被擋下
  - 對策：這是刻意設計（見 Decision 3 的謹慎精神延伸）——`_bootstrapOfficialPeriod()` 失敗會
    每 5 秒自動重試，直到成功拿到一次真實官方期別才開放下注，不會用猜的期別頂著先開放
  - 風險：admin 測試端點連續呼叫（不更新 `lastKnownOfficialPeriod`）可能讓算出的下一期跟剛
    結算掉的舊期別撞號
  - 對策：`_laterOfficialPeriod()` 取「官方最新已知期別」與「剛結算掉的內部期別」兩者較大值
    當基準，保證 `currentIssue` 只會單調前進
- UI/UX 風險：
  - 風險：無（前端顯示邏輯不變，只是 `issue` 字串內容從 8 碼變 9 碼）

## 驗證方式

- 功能驗證：
  - `npm run test:dlt` 全數通過，包含新增/修正的格式斷言與「結算後 currentIssue 正確推進」
  - 手動確認 `_bootstrapOfficialPeriod()` 真的打到官方 API 並取得真實期別（本次已用
    `curl https://api.taiwanlottery.com/TLCAPIWeB/Lottery/LastNumber` 驗證即時官方資料，
    確認目前大樂透最新一期真的是 `115000087`）
- 視覺驗證：不涉及
- 回歸驗證：
  - 既有下注／拒單／8 獎項判定／A~E 多組互不影響／重複結算防護／開獎+結算整條流程全部維持通過

## 成功標準

- [x] 功能符合需求且行為正確
- [x] 無新增重大 console / runtime error
- [x] 相關測試或手動驗證完成（`npm run test:dlt` 40/40）
