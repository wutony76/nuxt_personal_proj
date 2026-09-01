import { sessionController } from '../services/auth'

const PROTECTED_PREFIXES = ['/api/lottery', '/api/taiwan-lottery', '/api/games']

/**
 * 彩池／爆池狀態是全站公開資訊（不含任何使用者資料，見各 `{jackpot,pool}.get.ts`
 * 只回 `Storage.games[...].get.creditJackpot()`／`.get.poolState()`），比照大廳未登入也要能看到
 * 彩池金額的需求，放行不需要登入——大廳頁（lottery-hall.vue）的 POOL_FETCHERS 靠這個才能在
 * 訪客狀態下正常抓到數字，其餘 `/api/lottery/*`（下注、注單、claim…）仍然要登入。
 */
const PUBLIC_LOTTERY_SUFFIXES = ['/jackpot', '/pool']

/**
 * 復古遊戲的 coin 兌換比（coinRate／coinCapPerRun／coinDailyCap）是公開設定，不含使用者資料，
 * 讓訪客也能在遊戲頁面看到「登入後可賺多少 coin」藉此引導登入，比照上面 PUBLIC_LOTTERY_SUFFIXES
 * 的公開模式；其餘 `/api/games/*`（history 讀寫）仍然要登入。
 */
const PUBLIC_GAME_PATHS = ['/api/games/retro/rates', '/api/games/retro/pacman/maze-templates']

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

  const isPublicGameApi = method === 'GET' && PUBLIC_GAME_PATHS.includes(pathname)
  if (isPublicGameApi) {
    return
  }

  sessionController.require(event)
})
