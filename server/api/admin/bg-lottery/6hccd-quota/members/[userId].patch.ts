import { sessionController } from 'serv/services/auth'
import { Storage } from 'serv/services/storage'

type Body = {
  /** 傳數字設定覆寫值；傳 null 清除覆寫、改回跟隨全站預設 */
  crossTabIssueMax?: unknown
}

/**
 * 設定（或清除）單一玩家的 6hc-cd 跨分頁單期總上限覆寫，見
 * openspec/changes/add-6hccd-quota-p2/design.md 第 4 節。
 */
export default defineEventHandler(async (event) => {
  sessionController.requireAdmin(event)

  const userId = String(getRouterParam(event, 'userId') ?? '').trim()
  if (!userId) throw createError({ statusCode: 400, message: '缺少會員 id。' })

  const body = await readBody<Body>(event)
  const value = body?.crossTabIssueMax === null ? null : Number(body?.crossTabIssueMax)

  const crossTabIssueMax = await Storage.manager.lotteryBg.sixhccdQuota.setMemberCrossTabIssueMax(userId, value)
  return { userId, crossTabIssueMax }
})
