import { sessionController } from 'serv/services/auth'
import { Storage } from 'serv/services/storage'

/**
 * 取得彩池補貼追蹤資料（池底重骰＋保底超付事件列表＋摘要統計）
 * @param lotteryKey 篩選彩種 key（可選，空字串＝全部）
 * @param range 時間區間：7d / 30d / all（預設 all）
 */
export default defineEventHandler((event) => {
  sessionController.requireAdmin(event)

  const query = getQuery(event)
  const filterKey = String(query.lotteryKey ?? '').trim()
  const range = String(query.range ?? 'all').trim()

  return Storage.manager.lotteryBg.poolAudit.list(filterKey, range)
})
