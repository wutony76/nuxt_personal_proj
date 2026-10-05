import { sessionController } from 'serv/services/auth'

/**
 * 後台「遊戲試算」：刮刮樂 model01~09 試算，直接轉呼叫使用者本機長期在跑
 * 的 Python 試算服務（見 replace-scratch-simulator-with-python-proxy），
 * 不在 Nuxt 內維護機率表／消費邏輯／卡片素材——連同已經算好、渲染好的
 * `b64card` 卡片圖都是 Python 服務回傳的原始內容，原封不動轉給前端。
 *
 * query: { model: '01'~'09', coin: number, count?: number }
 * 金額合法性、張數上限 50 的夾擠，都交給 Python 服務本身做，這裡只負責
 * 轉發與把它的錯誤訊息轉成前端看得懂的格式。
 */
export default defineEventHandler(async (event) => {
  sessionController.requireAdmin(event)

  const query = getQuery(event)
  const model = String(query.model ?? '').trim()
  const coin = String(query.coin ?? '').trim()
  const count = String(query.count ?? '1').trim()

  const base = process.env.SCRATCH_PY_API_BASE || 'http://127.0.0.1:8000'
  try {
    return await $fetch(`${base}/api/scratch/${model}`, {
      query: { coin, count, image: 1 }
    })
  } catch (err: unknown) {
    const fetchErr = err as { response?: { status?: number; _data?: { error?: string } } }
    const status = fetchErr?.response?.status
    if (status) {
      throw createError({
        statusCode: status,
        message: fetchErr.response?._data?.error ?? '試算服務回傳錯誤'
      })
    }
    throw createError({
      statusCode: 502,
      message: `無法連線到本機 Python 試算服務（${base}），請確認服務是否已啟動`
    })
  }
})
