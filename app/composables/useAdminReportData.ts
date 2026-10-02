import { ref, watch } from 'vue'
import dayjs from 'dayjs'

type FetchStatus = 'idle' | 'loading' | 'success' | 'error'

/**
 * 後台報表頁（app/pages/admin/reports/*.vue）共用的 SSR 資料獲取 composable。
 *
 * 這 5 頁原本都是同一套手刻 pattern：`month` ref + `status`/`error`/`summary` ref +
 * `_actions.fetch()`（async、try/catch）+ `watch(month, fetch)` + `onMounted(fetch)`——
 * 純 client-only，SSR 回應永遠是空殼。抽成這支 composable，對外維持一模一樣的
 * `{ month, status, error, summary }` 介面，讓 5 個頁面的 template 完全不用改，
 * script setup 只要把手刻邏輯換成呼叫這支即可。
 *
 * ⚠️ cookie 轉發：這些報表端點（`server/api/admin/reports/*.get.ts`）都走
 * `sessionController.requireAdminView(event)`，只認該次請求自帶的 `portfolio_auth_token`
 * cookie。SSR 階段 `useAsyncData` 的 fetcher 是 Nitro 發出的新內部請求，不會自動帶到
 * 瀏覽器原始請求的 cookie，必須用 `useRequestHeaders(['cookie'])` 手動轉發；client 端
 * 瀏覽器同源請求本來就會自動帶 cookie，`useRequestHeaders` 在 client 端回空物件，
 * 轉發與否对 client 端沒有影響（見 add-ssr-admin-reports-cookie-forward）。
 *
 * ⚠️ `lazy: true` + 一定要 `await`：`lazy: true` 讓 client-side 導覽切到其他後台頁時
 * 不會卡住導覽；但 `lazy` 本身**不會**讓 SSR 內容變成「資料到位才渲染」——沒有
 * `await`，程式碼會立刻往下跑去建立 watcher，此時 `pending` 還是 true、`data` 還是
 * null，SSR 輸出就會停在「載入中…」（第一版漏了 await 導致的真實 bug：資料確實有
 * 抓到、`__NUXT_DATA__` payload 裡看得到，但畫面上看不出來，因為 watcher 第一次執行
 * 時捕捉到的是 loading 快照）。補上 `await` 後，SSR 階段這行會先等 fetcher 真的跑完
 * 才繼續往下建立 watcher，watcher 的 `{ immediate: true }` 才會立刻拿到 success 快照；
 * `{ watch: [month] }` 讓月份切換時（不管 SSR 首次還是 client 之後）都會自動重新呼叫
 * fetcher，取代原本手刻的 `watch(month, fetch)`。
 *
 * @param key useAsyncData 的唯一 key，每頁要給不同值，避免彼此快取互相覆蓋
 * @param fetcher 實際的 `api.admin.reports.xxx` 呼叫，接收 month 字串與轉發用 headers
 */
export async function useAdminReportData<T>(
  key: string,
  fetcher: (month: string, opts?: { headers?: HeadersInit }) => Promise<T>
) {
  const month = ref(dayjs().format('YYYY-MM'))
  const status = ref<FetchStatus>('idle')
  const error = ref('')
  const summary = ref<T | null>(null)

  const forwardedHeaders = useRequestHeaders(['cookie'])

  const { data, pending, error: asyncError } = await useAsyncData<T>(
    key,
    () => fetcher(month.value, { headers: forwardedHeaders }),
    { watch: [month], lazy: true }
  )

  watch([data, pending, asyncError], () => {
    if (pending.value) {
      status.value = 'loading'
      error.value = ''
      return
    }
    if (asyncError.value) {
      status.value = 'error'
      error.value = asyncError.value?.message ?? '載入失敗'
      summary.value = null
      return
    }
    if (data.value) {
      summary.value = data.value
      status.value = 'success'
      error.value = ''
    }
  }, { immediate: true })

  return { month, status, error, summary }
}
