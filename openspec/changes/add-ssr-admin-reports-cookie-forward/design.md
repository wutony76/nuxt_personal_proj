# Design

## 1. 整體流程

```
GET /admin/reports（帶 portfolio_auth_token cookie）
  │
  ├─ index.vue 的 setup()：
  │    const { month, status, error, summary } = await useAdminReportData(
  │      'admin-report-index', api.admin.reports.bgSummary
  │    )
  │    └─ 內部：useRequestHeaders(['cookie']) → await useAsyncData(key, fetcher, {watch:[month], lazy:true})
  │         → fetcher 轉發 cookie 呼叫 /api/admin/reports/bg-summary
  │
  └─ <AdminShell> 子元件的 setup()：
       const forwardedHeaders = useRequestHeaders(['cookie'])
       ...
       await _actions.guard()
         → refreshAuth({ headers: forwardedHeaders })  // /api/me
         → check({ headers: forwardedHeaders })          // /api/admin/me
```

`index.vue` 自己的 `await useAdminReportData(...)` 與 `<AdminShell>` 內部的
`await _actions.guard()` 是**兩個獨立的非同步相依**，都掛在同一個 Vue Suspense 邊界下
（Nuxt 的 `<NuxtPage>` 預設提供），SSR 渲染完成前兩者都要 resolve。

## 2. 為什麼不能在 await 之後呼叫 useNuxtApp()

Nuxt 的 composable context（`useNuxtApp()`/`useRequestHeaders()`/`useState()` 等）綁定在
目前這次 SSR 請求的 async context 上，只在**從 setup() 開始、還沒遇到任何 `await` 之前的
同步執行範圍**內保證存在。一旦跨過一個 `await`，继续執行的是「之后的 continuation」，
Nuxt 沒辦法再保證這個 continuation 跟原本哪一個請求綁在一起（因為同一個 Node process
同時在處理多個請求），所以 `useNuxtApp()` 在這之後呼叫會直接丟
`[nuxt] A composable that requires access to the Nuxt instance was called outside of
a plugin, Nuxt hook, Nuxt middleware, or Vue setup function.`（Implementation 階段
實測踩到，見 `validation.md`）。

**規則**：任何需要呼叫 `useNuxtApp()`（或依賴它的 composable）的地方，一律在函式最頂層、
還沒 `await` 之前就呼叫一次存成變數，後面透過閉包沿用，不要在 async IIFE 的 `finally`
或是 await 之後的任何程式碼裡重新呼叫。`useAuth.ts`／`useAdminAuth.ts`／
`useAdminReportData.ts`／`Shell.vue` 都遵守這個規則。

## 3. useAuth／useAdminAuth：reactive({}) → useState()

### 問題

```ts
// 原本：模組層級單例，整個 Nitro process 共用一份
const state = reactive({ user: null, init: false })
```

這份狀態只被 client-only 的 `onMounted` 呼叫時是安全的（SSR 從不執行）。一旦
`AdminShell` 也在 SSR 呼叫這兩支 composable，多個使用者的並行請求會共用同一份
`state`，造成 session 互相污染（User A 的 SSR render 寫入 `isAdmin=true`，
User B 緊接著的請求有可能讀到）。

### 修法

```ts
function useAuthState() {
  return useState('auth-state', () => ({ user: null, init: false }))
}
export const useAuth = () => {
  const state = useAuthState()
  ...
}
```

`useState(key, init)` 的語意：
- **Server**：每個請求都是全新的 Nuxt app 實例，`useState` 回傳的是這個實例專屬的狀態，
  天生不會跨請求共用
- **Client**：整個 app 生命週期共用同一個 Nuxt app 實例，`useState` 行為等同原本的模組
  單例（多個元件呼叫 `useAuth()` 拿到的是同一份 reactive 狀態）
- 對外的 `user`/`isLoggedIn`/`initialized` 等 computed、`init()`/`refresh()`/`login()`/
  `logout()`/`clearSession()` 等方法簽章完全不變，全站約 70+ 處既有呼叫點（彩票頁、
  遊戲頁、登入頁等）不用改一行

### initPromise／checkPromise 的對應處理

原本是模組層級的 `let initPromise`，用來讓多個元件同時 mount 時只打一次 `/api/me`。
這個也有跟 `state` 一樣的跨請求共用問題，改成 `WeakMap<object, Promise<void>>`，
以**當下的 `nuxtApp` 實例**當 key——SSR 下每個請求是不同的 nuxtApp 實例（天生隔離），
client 端整個 session 共用同一個 nuxtApp 實例（維持原本去重效果）。

## 4. AdminShell.vue：onMounted → 頂層 await

```ts
// 之前
onMounted(() => { _actions.guard() })

// 之後
const forwardedHeaders = useRequestHeaders(['cookie'])  // 必須在任何 await 之前
...
await _actions.guard()  // 頂層 await，讓這個元件變成 async 元件
```

- SSR：Nuxt 的渲染流程本來就會等元件自己的 async setup resolve 完才算渲染完成，
  所以這裡的 `await` 讓 SSR 回應真的等 cookie 驗證完成才送出
- Client 初次 hydrate：SSR 已經 resolve 過的狀態會透過 payload 直接 hydrate，不需要
  重新執行 fetch（這是 Nuxt SSR + payload 機制本身的行為，不是這裡刻意做的）
- Client-side 導覽到另一個 admin 頁面：`<AdminShell>` 是**各頁面各自內嵌一個實例**
  （不是跨路由共用同一個元件實例），導覽到新頁面會建立新的 Shell 實例、重新跑一次
  `setup()`，所以 `await _actions.guard()` 又會重新執行一次——這跟原本
  `onMounted(() => guard())` 的語意一致（「每次掛載都重新跟伺服器確認一次 session，
  避免 cookie 已過期但 client 端快取仍顯示已登入」），只是現在用頂層 await 達成，
  不再用 onMounted

## 5. useAdminReportData.ts：共用 composable 設計

5 個報表頁原本是同一套手刻 pattern（`month`/`status`/`error`/`summary` ref +
`_actions.fetch()` + `watch(month)` + `onMounted`）。抽成一支 composable，對外維持
完全相同的 `{ month, status, error, summary }` 介面，讓 5 個頁面的 template 一行都不用改：

```ts
export async function useAdminReportData<T>(
  key: string,
  fetcher: (month: string, opts?: { headers?: HeadersInit }) => Promise<T>
) {
  const month = ref(dayjs().format('YYYY-MM'))
  const status = ref<'idle'|'loading'|'success'|'error'>('idle')
  const error = ref('')
  const summary = ref<T | null>(null)

  const forwardedHeaders = useRequestHeaders(['cookie'])
  const { data, pending, error: asyncError } = await useAsyncData<T>(
    key,
    () => fetcher(month.value, { headers: forwardedHeaders }),
    { watch: [month], lazy: true }
  )

  watch([data, pending, asyncError], () => {
    if (pending.value) { status.value = 'loading'; error.value = ''; return }
    if (asyncError.value) { status.value = 'error'; error.value = asyncError.value?.message ?? '載入失敗'; summary.value = null; return }
    if (data.value) { summary.value = data.value; status.value = 'success'; error.value = '' }
  }, { immediate: true })

  return { month, status, error, summary }
}
```

- `{ watch: [month] }` 取代原本手刻的 `watch(month, () => _actions.fetch())`——月份切換
  （不管 SSR 首次還是 client 之後）自動重新呼叫 fetcher
- `{ lazy: true }`：client-side 導覽到其他 admin 頁面不會被卡住
- **一定要 `await`**：沒有 await，SSR 階段 `watch(..., {immediate:true})` 建立時
  `pending`/`data` 還是初始值（loading/null），watcher 捕捉到的是 loading 快照，
  SSR 輸出就會停在「載入中…」——即使資料最終有抓到、payload 裡看得到，畫面上也看不出來
  （Implementation 階段實測踩到這個坑，見 `validation.md`）

## 6. 測試與驗證策略

- 功能驗證：`curl` 帶 cookie／不帶 cookie 分別驗證 SSR 輸出內容
- Playwright：hydration 警告檢查、demo 帳號驗證、client-side 導覽驗證（用真實
  `<NuxtLink>` 點擊，不是 `page.goto()` 模擬）
- 效能驗證：`test/perf-ssr-admin-reports.mjs`，方法論同 `perf-ssr-lottery-hall.mjs`
  （TTFB／首次真實數字／settled／LCP 四項指標，不只看單一指標）
