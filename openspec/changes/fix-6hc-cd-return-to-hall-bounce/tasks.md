# Tasks

## 1. 重現與根因診斷

- [x] 用 Playwright（cookie 注入登入）重現：進入 `/lottery/bg/6hc-cd/tema`，點擊
      `a[href="/lottery-hall"]`，記錄 `framenavigated` 事件時間序列
- [x] 確認症狀：t≈1889ms 導航到 `/lottery-hall`，t≈1969ms 又被導回
      `/lottery/bg/6hc-cd/tema`
- [x] 比對其他 BG 遊戲頁（k3-cd）確認只有 6hc-cd 有這個症狀
- [x] 根因定位：`onMounted` 非同步鏈在元件卸載後仍於背景繼續執行，最終
      `syncPlayByRoute()` 誤判 `route.params.play` 為 `undefined`，呼叫
      `router.replace()` 導回單一玩法頁

## 2. Fix 1：`isUnmounted` 旗標

- [x] 新增 `let isUnmounted = false`，於 `onBeforeUnmount` 設為 `true`
- [x] 在 `syncPlayByRoute()`、`watch(routePlayKey, ...)`、`onMounted` 鏈每個 `await`
      之後、`floatTimer` callback 內插入 `if (isUnmounted) return` 防護
- [x] Playwright 驗證：情境 B（`domcontentloaded` 後立刻點擊）修正成功，情境 A
      （`networkidle` 後才點擊）仍然失敗

## 3. 診斷時間差問題

- [x] 確認 Vue Router 的 route 反應式更新先於元件 `onBeforeUnmount` 發生，
      `isUnmounted` 在 `syncPlayByRoute()` 讀取當下可能仍是 `false`

## 4. Fix 2：`_stillOnThisPage()` 同步路由檢查

- [x] 新增 `_stillOnThisPage()`，同步檢查 `route.path.startsWith('/lottery/bg/6hc-cd')`
- [x] `syncPlayByRoute()` 三個續行點（函式開頭、`router.replace` 前、
      `fetchPlayByKey` 前）改為檢查 `isUnmounted || !_stillOnThisPage()`

## 5. 驗證

- [x] Playwright 兩情境重測：情境 A、情境 B 皆穩定停留在 `/lottery-hall`，不再彈回
- [x] `npm test`（36 支既有測試腳本）回歸：34 支全過；`test:x5-cd`／`test:x5-of`
      失敗項目與本次改動無關（下注時機類測試，受「開獎期間視窗」時機影響），
      個別重跑後皆轉為全過，確認是既有的時機性 flake、不是本次修正造成的回歸
- [x] 清除暫存診斷腳本（`__diag-6hc-fix2-tmp.mjs`）

## 6. 文件交付

- [x] 完成 `proposal.md`／`design.md`／`tasks.md`／`validation.md`
- [x] 新增 `docs/Engineering Evidence/fix-6hc-cd-return-to-hall-bounce.md`
