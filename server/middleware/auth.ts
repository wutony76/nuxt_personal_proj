import { sessionController } from '../services/auth'

const PROTECTED_PREFIXES = ['/api/lottery', '/api/taiwan-lottery']

/**
 * 彩池／爆池狀態是全站公開資訊（不含任何使用者資料，見各 `{jackpot,pool}.get.ts`
 * 只回 `Storage.games[...].get.creditJackpot()`／`.get.poolState()`），比照大廳未登入也要能看到
 * 彩池金額的需求，放行不需要登入——大廳頁（lottery-hall.vue）的 POOL_FETCHERS 靠這個才能在
 * 訪客狀態下正常抓到數字，其餘 `/api/lottery/*`（下注、注單、claim…）仍然要登入。
 */
const PUBLIC_LOTTERY_SUFFIXES = ['/jackpot', '/pool']

export default defineEventHandler((event) => {
  const pathname = getRequestURL(event).pathname
  const method = getMethod(event)

  if (method === 'OPTIONS' || pathname === '/api/login') {
    return
  }

  const isProtectedApi = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  if (!isProtectedApi) {
    return
  }

  const isPublicPoolApi = method === 'GET'
    && pathname.startsWith('/api/lottery/')
    && PUBLIC_LOTTERY_SUFFIXES.some((suffix) => pathname.endsWith(suffix))
  if (isPublicPoolApi) {
    return
  }

  sessionController.require(event)
})
