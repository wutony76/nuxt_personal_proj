# Design

## 問題拆解

`[play].vue` 的 `onMounted` 是一條線性非同步鏈：

```
onMounted(async () => {
  await init()
  await use6hc.init.startServerTimeSync()
  await mxFetch.initPageData(_userId)
  await _actions.syncPlayByRoute()
  // ... 進場動畫
})
```

這條鏈全部跑完大約需要 1~2 秒（視 API 回應時間）。使用者在這段期間點擊「返回大廳」，
Vue Router 會立刻切換路由並開始卸載舊元件，但：

1. JS 的 `async` 函式一旦開始執行，不會因為呼叫它的元件「被卸載」而自動中止——`await`
   之後的程式碼仍然會在對的時間點（micro/macrotask queue 排到）繼續執行。
2. `syncPlayByRoute()` 讀的 `routePlayKey` 是衍生自 `route.params.play` 的 computed，而
   `route` 是全域共用的反應式物件。一旦路由切換確認，`route.params.play` 立刻變成
   `undefined`（大廳頁沒有這個參數），不需要等舊元件卸載完成。
3. `playKeySet.value.has(undefined)` 為 `false` → 誤判成「不合法的玩法 key」→
   `router.replace('/lottery/bg/6hc-cd/tema')` 把使用者導回去。

## 決策 1：雙重防護旗標，而非單一 `isUnmounted`

最初只加 `isUnmounted`（`onBeforeUnmount` 設為 `true`）防護，解決了「使用者在
`domcontentloaded` 剛完成、非同步鏈仍大量堆積時就點擊」的情境，但實測「頁面已經
`networkidle`、非同步鏈接近尾聲時才點擊」的情境仍然失敗。

用 Playwright 搭配 `framenavigated` 事件記錄時間序列，確認原因：**Vue Router 的路由
切換確認（route 物件更新、觸發 `watch(routePlayKey)`）是同步發生在導航當下，而元件的
`onBeforeUnmount` 是透過 Vue 的渲染排程非同步觸發的，兩者之間有一個小時間窗**——在這個
窗口內，`route` 已經指向大廳，但 `isUnmounted` 仍然是 `false`。

因此改用兩個獨立判斷：

- `isUnmounted`：攔「元件已確定卸載」之後的殘留回呼（例如 `floatTimer` 的
  `setTimeout` callback，這類不涉及 route 反應性、純粹是「元件還在不在」的問題）
- `_stillOnThisPage()`：同步檢查 `route.path.startsWith('/lottery/bg/6hc-cd')`，攔「route
  已經變了，但元件卸載還沒排到」的時間窗——這個檢查不依賖元件生命週期狀態，只看
  「現在路由實際上是什麼」，所以沒有時間差問題

`syncPlayByRoute()` 內每一個會造成外部副作用（`router.replace`、
`use6hc.actions.fetchPlayByKey`）的續行點，都同時檢查 `isUnmounted || !_stillOnThisPage()`。

## 決策 2：防護點放在哪裡

防護分散在兩層：

1. `onMounted` 鏈本身：每個 `await` 之後都檢查 `isUnmounted`（這條鏈目前沒有牽涉
   `route.path` 判斷的邏輯，單純是「元件還在不在就不要再動 state／呼叫 store」，
   `isUnmounted` 已足夠）
2. `syncPlayByRoute()`／`watch(routePlayKey, ...)`：因為這裡的觸發源頭正是 route 變化
   本身，需要 `_stillOnThisPage()` 這層更精確的檢查

沒有把 `_stillOnThisPage()` 也套用到 `onMounted` 鏈的每個點，是因為 `onMounted` 鏈本身
不會因為「route 變了但元件還沒卸載」這個時間窗產生錯誤行為——它最終還是會呼叫
`syncPlayByRoute()`，而 `syncPlayByRoute()` 內部已經有完整防護；重複加在外層只會增加
程式碼而不增加正確性。

## 範圍邊界

只修 6hc-cd。其餘 14 個 BG 遊戲頁沒有「網址帶的玩法 key 不合法就自動 `router.replace`」
這段邏輯，所以同樣的非同步鏈卡著繼續跑，不會產生「被導回」這個可觀察症狀——但理論上
相同的風險模式（舊元件的非同步鏈在卸載後仍在背景跑、可能呼叫其他有副作用的動作）依然
存在，留待之後視需要再評估，不在本次隨意擴大範圍。
