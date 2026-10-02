# Proposal

## 變更名稱

fix-6hc-cd-return-to-hall-bounce — 修正 6hc-cd 單玩法頁「返回大廳」導航被彈回的 bug

## 背景

使用者回報：「bg 彩票 進入單玩法 點擊 返回 大廳 跳轉到大廳又會轉回單玩法 無法順利跳轉到
大廳」。用 Playwright 重現確認：進入 `/lottery/bg/6hc-cd/tema`、點擊「返回大廳」連結，
確實先導航到 `/lottery-hall`，但隨即（約 1 秒內）又被導回
`/lottery/bg/6hc-cd/tema`——使用者完全無法停留在大廳頁。

進一步用 Playwright 的 `framenavigated` 事件記錄時間序列，並比對其他 BG 遊戲頁（例如
k3-cd）確認這個症狀只出現在 6hc-cd，根因是 `onMounted` 內有一條很長的非同步鏈
（`await init()` → `await use6hc.init.startServerTimeSync()` →
`await mxFetch.initPageData(_userId)` → `await _actions.syncPlayByRoute()`）。

JavaScript 不會因為元件卸載就取消還在執行中的 `async` 函式——使用者如果在這條鏈還沒跑完
之前就點擊「返回大廳」離開，舊元件的這條鏈會在背景繼續跑完。跑到最後
`syncPlayByRoute()` 讀 `routePlayKey`（衍生自 `route.params.play`）時，route 早就已經變成
`/lottery-hall`（`params.play` 是 `undefined`），函式誤判成「網址帶的玩法 key 不合法」，
於是呼叫 `router.replace('/lottery/bg/6hc-cd/tema')` 把使用者導回單一玩法頁——這就是「返回
大廳又被彈回」的真正成因，問題不在返回連結本身，而是舊元件卡著還沒死透的非同步鏈搶著
下指令。

## 目標

- 使用者點擊「返回大廳」後，必須穩定停留在 `/lottery-hall`，不會被任何背景殘留的非同步
  邏輯導回單一玩法頁
- 不能只靠元件卸載旗標解決——實測發現 Vue Router 的 `route` 物件反應式更新（會觸發
  `watch(routePlayKey, ...)`）發生在元件真正 `onBeforeUnmount` 之前（route 更新是同步的，
  元件卸載走 Vue 的渲染排程、慢一拍），單靠「元件是否已卸載」這個旗標攔不住這個時間差
- 所有會改動路由或呼叫共用 store 動作的續行程式碼，都要先確認「目前路由是否還在
  6hc-cd 底下」，不是才不執行

## 範圍

- 包含：
  - `app/pages/lottery/bg/6hc-cd/[play].vue`（`onMounted` 非同步鏈、`syncPlayByRoute()`、
    `watch(routePlayKey, ...)`）
- 不包含：
  - 不改其他 14 個 BG 遊戲頁（例如 k3-cd）——這些頁面目前沒有這個症狀是因為它們沒有
    「網址帶的玩法 key 不合法就自動 `router.replace`」這段邏輯，雖然理論上同樣的
    「舊元件非同步鏈卡著繼續跑」風險模式存在，但範圍先限縮在實際觸發症狀的 6hc-cd，
    其餘頁面是否需要同樣的防護留待另外評估，不在本次變更內隨意擴大範圍
  - 不改 `lottery-hall.vue` 或返回連結本身（連結本身沒有問題）

## 影響面

- 前端路由/頁面：`app/pages/lottery/bg/6hc-cd/[play].vue`
- 前端元件/Composables：無（不改 `use6hc`/`mxFetch` 內部邏輯，只在呼叫端加防護）
- 後端 API/Services：無
- 設定或常數（`app/config/`）：無

## 風險與對策

- 技術風險：
  - 風險：只用 `isUnmounted` 旗標（在 `onBeforeUnmount` 設為 `true`）防護，在「route 先變、
    元件卸載渲染排程晚一步」的時間窗內形同虛設
  - 對策：額外新增 `_stillOnThisPage()` 同步檢查 `route.path.startsWith('/lottery/bg/6hc-cd')`，
    `syncPlayByRoute()` 每個會改動路由/共用狀態的續行點都同時檢查 `isUnmounted` 與
    `_stillOnThisPage()`
- UI/UX 風險：
  - 風險：無——修正範圍純粹是「不該執行的動作不要執行」，不影響任何正常情境下的頁面
    行為或動畫

## 驗證方式

- 功能驗證：
  - Playwright 重現腳本，兩種情境皆驗證：
    - 情境 A：頁面 `networkidle`（非同步鏈大多已跑完）後才點擊返回大廳
    - 情境 B：頁面剛 `domcontentloaded`（非同步鏈仍在進行中）就立刻點擊返回大廳
  - 兩種情境修正後皆穩定停留在 `/lottery-hall`，不再彈回
- 視覺驗證：不涉及
- 回歸驗證：`npm test`（36 支既有測試腳本）全數通過或確認失敗項目與本次變更無關

## 成功標準

- [x] 功能符合需求且行為正確（兩種情境皆不再彈回大廳）
- [x] 無新增重大 console / runtime error
- [x] 相關測試或手動驗證完成
