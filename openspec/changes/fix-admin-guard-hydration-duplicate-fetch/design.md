# Design

## 問題拆解

`Shell.vue` 的 `<script setup>` 頂層執行 `await _actions.guard()`，這段程式碼在以下
兩個時機點都會完整執行一次：

1. SSR 階段（伺服器 render 這個頁面的請求處理過程中）
2. client hydration 階段（瀏覽器接管 SSR 產出的 HTML、把它變成互動頁面的過程中，
   Vue 會重新執行一次元件的 `setup()`）

這是 Vue/Nuxt 的正常機制，不是 bug——`useState()` 存在的目的正是讓第 2 次執行時，
能直接讀到第 1 次（SSR）算好的結果，不需要重新計算。但 `guard()` 本身的實作完全沒有
利用到這一點：

```ts
guard: async () => {
  resetAdminAuth()                     // 無條件重置
  await refreshAuth({ headers })       // 無條件重打
  if (!isLoggedIn.value) return
  await check({ headers })             // 無條件重打
}
```

`resetAdminAuth()` 把 `admin-auth-state`（`useState` 承載、剛從 SSR payload 水合
進來的正確值）的 `checked` 欄位重設回 `false`；`refreshAuth()`（`useAuth.ts` 的
`refresh()`）本身連跳過判斷都沒有，一定會打。所以即使 `check()` 內部其實已經有
`if (state.value.checked) return` 這層保護，也會因為上一行的 `resetAdminAuth()`
把 `checked` 洗掉而永遠失效。

## 決策 1：用什麼訊號判斷「這次執行是不是 hydration 本身」

Nuxt 的 `nuxtApp.isHydrating` 布林值，語意精確符合需求：只在「client 正在把 SSR
輸出接管成互動頁面」這個瞬間為 `true`，一旦 hydration 完成（不論之後經過多少次
client-side 導覽），永遠是 `false`。這跟我們要的判斷完全對應：**只有這一次**可以
安全地略過重打，之後每一次重新掛載都必須老實重新驗證。

曾經考慮的替代方案：把整個 `guard()` 包進 `useAsyncData('admin-guard', fetcher)`，
讓 Nuxt 內建的 hydration 快取機制（`fetchOnServer && nuxtApp.isHydrating &&
(asyncData.error.value || asyncData.data.value !== void 0)` 這個判斷式，見
`node_modules/nuxt/dist/app/composables/asyncData.js`）自動處理跳過邏輯——這是
`useAdminReportData.ts` 已經在用的模式，風格更一致。

但實測發現這個做法有嚴重副作用：`useAsyncData` 的快取是以 `nuxtApp._asyncData[key]`
這個**跨元件實例共用**的物件儲存，不是跟著單一元件實例的生命週期走。Vue Router
切換路由時，新頁面的 `AdminShell` 元件在舊頁面的 `AdminShell` 真正觸發
`onScopeDispose`（進而讓 `_deps` 歸零、釋放快取）之前，就已經掛載並呼叫了
`useAsyncData('admin-guard', ...)`——這時候快取 entry 還在、`status` 還是
`'success'`，新實例直接判定「已經有資料」就跳過 fetch。等舊元件真正卸載、快取
才被釋放時已經太晚。

實測結果：`/admin/reports` → 點擊連結 → `/admin/roles`，`roles.vue` 自己的資料
API（`/api/admin/roles`、`/api/admin/role-defs`、`/api/admin/games`）都正常打，但
`/api/me`、`/api/admin/me` 完全沒有再打——等於「後台頁面之間切換要重新驗證 session」
這個刻意設計的行為被意外廢掉了。這跟本次要修的 bug 完全是兩回事：一個是「該跳過
時沒跳過」，一個會變成「不該跳過時也跳過」，後者是更嚴重的問題（session 安全性
相關），所以放棄這個做法。

最終採用 `nuxtApp.isHydrating`，不經過任何跨元件共用的快取，判斷完全是「這一次
`guard()` 呼叫，是不是碰巧發生在 hydration 這個特定時間點」，不依賴任何會在元件
之間殘留的狀態。

## 決策 2：為什麼額外加 `checked.value` 這個條件

單看 `nuxtApp.isHydrating` 還不夠精確：如果 SSR 階段判定使用者未登入
（`isLoggedIn.value` 為 `false`），`guard()` 會在 `refreshAuth()` 之後就
`return`，根本不會呼叫 `check()`——這種情況下 `checked.value` 會維持初始值
`false`，代表「SSR 根本沒有機會把一個有意義的權限檢查結果序列化到 payload 裡」。
如果這時候 hydration 也跳過，瀏覽器會永遠不知道使用者有沒有登入／有沒有權限，
頁面會卡在不正確的狀態。

所以跳過條件是 `nuxtApp.isHydrating && checked.value`——兩個條件都成立，才代表
「這是 hydration，而且 SSR 階段真的把完整的檢查結果準備好了」，此時才安全跳過。

這個額外條件帶來一個刻意接受的小殘留成本：SSR 判定未登入的情況下，hydration 仍會
重打一次 `/api/me`（但不會打 `/api/admin/me`，因為 `check()` 本來就要等
`isLoggedIn` 為 true 才會呼叫）。這是後台頁面的非典型情境（多數到達後台頁面的
使用者本來就是已登入狀態），影響範圍遠小於原本「兩次都無條件重複」的問題，不值得
為了這個邊界情況再加一層判斷邏輯。

## 實作

```ts
guard: async () => {
  if (nuxtApp.isHydrating && checked.value) {
    sessionReady.value = true
    return
  }
  sessionReady.value = false
  resetAdminAuth()
  await refreshAuth({ headers: forwardedHeaders })
  sessionReady.value = true
  if (!isLoggedIn.value) return
  await check({ headers: forwardedHeaders })
}
```

`nuxtApp` 本身的取得方式沿用本系列 SSR 改造已經建立的規則：在元件 `<script
setup>` 頂層、還沒遇到任何 `await` 之前就呼叫 `useNuxtApp()` 並存成變數
（`const nuxtApp = useNuxtApp()`），不要留到 async 函式內部才呼叫——這是
`useAuth.ts`／`useAdminAuth.ts` 已經踩過的教訓（見這兩個檔案的註解）。
