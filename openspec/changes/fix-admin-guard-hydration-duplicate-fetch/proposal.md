# Proposal

## 變更名稱

fix-admin-guard-hydration-duplicate-fetch — 修正 AdminShell 權限檢查在 client
hydration 階段重複呼叫 `/api/me`／`/api/admin/me` 的問題

## 背景

`add-ssr-admin-reports-cookie-forward` 把 `/admin/reports` 系列頁面改成 SSR 也會跑
權限檢查（`AdminShell.vue` 的 `guard()`），效能量測結果卻是「改造後中位數比改造前
還慢」（390ms → 485ms），當時誠實記錄了這個結果，但沒有深入追查原因，只推測是
「疊加兩個非同步相依（權限檢查 + 報表資料），SSR 沒有減少請求數」。

使用者重新 review 程式碼後指出更精確的根因：`guard()` 的實作是

```ts
guard: async () => {
  resetAdminAuth()                              // 把 SSR 傳過來的 useState 清掉
  await refreshAuth({ headers })                // /api/me：每次都打，不會跳過
  await check({ headers })                      // /api/admin/me：因為剛被 reset，一定會打
}
```

`useState` 雖然把 SSR 端算好的登入/權限結果序列化帶到了瀏覽器，但 `<script setup>`
頂層的 `await _actions.guard()` 在 client hydration 時會**整個重新執行一次**——
`resetAdminAuth()` 先把剛從 payload 水合進來的正確狀態洗掉，接著無條件依序打兩支
真實的 HTTP 請求（`/api/me`、`/api/admin/me`）。因為是放在元件頂層的 `await`，這兩次
往返完成之前，整個頁面都無法 hydrate／互動。

伺服器端的那次呼叫（SSR 階段）是同一個 Node process 內的記憶體操作，只要幾毫秒；真正
的成本在 client 端重複打一次一模一樣的請求。這是本次 SSR demo 系列裡已經處理過的
「伺服器抓一次、瀏覽器又抓一次」反模式（`add-ssr-lottery-hall-pools` 當初處理的是彩池
資料本身），這次是發生在「權限檢查」而非報表資料，先前漏看了。

用 Playwright 開 Network 面板重整 `/admin/reports` 驗證，hydration 期間確實各看到
一次 `/api/me`、`/api/admin/me`（總共兩次完全重複的請求）。

## 目標

- client hydration 時，若 SSR 階段的 `guard()` 已經完整跑過（`useState` 已經把正確
  結果帶到瀏覽器），就不要再重打 `/api/me`、`/api/admin/me`
- 不能犧牲既有設計意圖：使用者在後台頁面之間用內部連結切換（例如 `/admin/reports`
  → `/admin/roles`）時，**仍然要**老實重新向伺服器確認一次 session（這是刻意設計，
  避免 cookie 已過期但 client 端快取仍顯示已登入）——修法不能把這個行為也一併跳過

## 範圍

- 包含：
  - `app/components/admin/Shell.vue`（`guard()` 的 hydration 跳過判斷）
- 不包含：
  - 不改 `useAuth.ts`／`useAdminAuth.ts` 內部邏輯（`refresh()`／`check()` 本身的
    行為不變，只是呼叫端在特定條件下不呼叫它們）
  - 不改報表資料本身的 `useAsyncData`／`useAdminReportData.ts`（這次疊加的兩個
    相依中，報表資料那一個本來就只有 SSR 跑一次、hydration 不重打，沒有問題；
    有問題的只有權限檢查那一個）

## 影響面

- 前端元件/Composables：`app/components/admin/Shell.vue`
- 前端路由/頁面：無直接修改，但所有 `/admin/**` 頁面（都內嵌 `AdminShell`）皆受益
- 後端 API/Services：無
- 設定或常數：無

## 風險與對策

- 技術風險：
  - 風險：原本考慮直接把 `guard()` 包進 `useAsyncData('admin-guard', ...)`（更
    符合專案內其他 SSR 改造的慣用模式，見 `useAdminReportData.ts`），但實測發現
    `useAsyncData` 的共用快取是跨元件實例共用的——Vue Router 切換路由時，新頁面的
    `AdminShell` 在舊頁面的 `AdminShell` 真正卸載、快取被釋放（`_deps` 歸零）之前
    就已經掛載並讀到舊的 `status: 'success'` 快取，導致「後台頁面之間切換也會跳過
    重新驗證」——這跟本次目標直接衝突，已放棄這個做法
  - 對策：改用 `nuxtApp.isHydrating`（只在「client 接管 SSR 輸出」這一個瞬間為
    `true`，之後任何一次 client-side 導覽都是 `false`）搭配 `checked.value`（代表
    SSR 階段的 `check()` 已經完整跑過）做一次性判斷，不碰任何跨元件共用的快取
    機制，確保「每次掛載都重新驗證」的語意只在「這次掛載剛好是 hydration 本身」
    時才被跳過
  - 風險：若 SSR 階段判定為「未登入」（`isLoggedIn` 為 false），`check()` 本來就
    不會被呼叫，`checked.value` 永遠是初始值 `false`——這種情況下 hydration 時的
    跳過條件不會成立，仍會重打一次 `/api/me`（但不會打 `/api/admin/me`，因為
    `check()` 本來就要等 `isLoggedIn` 為 true 才會呼叫）
  - 對策：這是刻意接受的小範圍殘留成本——未登入是後台頁面的非典型情境（多數使用者
    是已登入才會停留在後台頁面），且只多一次 `/api/me`（不含 `/api/admin/me`），
    影響遠小於原本「兩次都重複」的問題，不值得為了這個邊界情況引入更複雑的邏輯
- UI/UX 風險：
  - 風險：無——跳過的判斷純粹是「不要重做已經做過的事」，不影響任何使用者可觀察
    的頁面行為或內容

## 驗證方式

- 功能驗證：
  - Playwright 重整 `/admin/reports`（已登入 cookie），確認 hydration 期間瀏覽器
    端發出的 `/api/me`／`/api/admin/me` 請求數為 0（原本各 1 次，共 2 次）
  - Playwright 從 `/admin/reports` 點擊內部連結導覽到 `/admin/roles`，確認
    `/api/me`／`/api/admin/me` 仍各打 1 次（維持「每次掛載都重新驗證」語意）
  - 兩種情境下頁面都正常顯示已登入/已通過權限檢查的內容（非 checking/expired/
    denied 卡住）
- 效能驗證：
  - `test/perf-ssr-admin-reports.mjs` 重新量測，對比 `add-ssr-admin-reports-
    cookie-forward` 當初記錄的「改造前 390ms」「改造後（有 bug）485ms」
- 回歸驗證：`npm test`（36 支既有測試腳本）全數通過或確認失敗項目與本次變更無關

## 成功標準

- [x] hydration 不再重複呼叫 `/api/me`／`/api/admin/me`
- [x] client-side 導覽仍會重新驗證 session（行為未退化）
- [x] 無新增重大 console / runtime error
- [x] 相關測試或手動驗證完成
