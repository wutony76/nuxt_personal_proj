import { sessionController } from 'serv/services/auth'
import { Storage } from 'serv/services/storage'

type Body = {
  crossTabIssueMax?: unknown
}

/**
 * 設定 6hc-cd 跨分頁單期總上限的全站預設值（`0` = 不限），見
 * openspec/changes/add-6hccd-quota-p2/design.md 第 4 節。
 */
export default defineEventHandler(async (event) => {
  sessionController.requireAdmin(event)

  const body = await readBody<Body>(event)
  const value = Number(body?.crossTabIssueMax)

  const crossTabIssueMax = await Storage.manager.lotteryBg.sixhccdQuota.setGlobalCrossTabIssueMax(value)
  return { crossTabIssueMax }
})
