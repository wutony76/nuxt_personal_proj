import { sessionController } from 'serv/services/auth'

/**
 * 後台「遊戲試算」：列出刮刮樂 9 個 model 的名稱與各自支援的金額清單，
 * 直接轉呼叫使用者本機長期在跑的 Python 試算服務（見
 * replace-scratch-simulator-with-python-proxy），不在 Nuxt 內維護機率表。
 *
 * 純讀取、不碰任何玩家帳務，用 requireAdminView（白名單 admin 或 demoMode
 * 角色皆可通過），讓 Demo 角色也能唯讀使用這個試算工具，不用
 * requireAdmin 把 Demo 角色擋在外面。
 */
export default defineEventHandler(async (event) => {
  sessionController.requireAdminView(event)

  const base = process.env.SCRATCH_PY_API_BASE || 'http://127.0.0.1:8000'
  try {
    return await $fetch(`${base}/api/scratch/info`)
  } catch {
    throw createError({
      statusCode: 502,
      message: `無法連線到本機 Python 試算服務（${base}），請確認服務是否已啟動`
    })
  }
})
