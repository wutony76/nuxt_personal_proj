import { sessionController } from 'serv/services/auth'
import { Storage } from 'serv/services/storage'

type Body = {
  dailyMaxSpend?: unknown
  topUpAmount?: unknown
  retroScoreMinPct?: unknown
  retroScoreMaxPct?: unknown
  bgWeight?: unknown
  retroWeight?: unknown
  bgBetAmountMin?: unknown
  bgBetAmountMax?: unknown
  activeTimeSlots?: unknown
  actionIntervalSec?: unknown
  actionJitterChancePct?: unknown
  actionJitterMaxSec?: unknown
}

/**
 * 後台：設定單一 NPC 會員的每日花費上限、自動儲值金額、經典遊戲模擬分數區間、
 * 玩經典遊戲／BG 彩票的權重、BG 單注金額區間、允許自動遊玩的時段、遊戲頻率／隨機延遲
 */
export default defineEventHandler(async (event) => {
  sessionController.requireAdmin(event)

  const userId = getRouterParam(event, 'userId') ?? ''
  const body = await readBody<Body>(event)

  return Storage.manager.admin.npcAutoPlay.setMemberSetting(userId, {
    dailyMaxSpend: body?.dailyMaxSpend !== undefined ? Number(body.dailyMaxSpend) : undefined,
    topUpAmount: body?.topUpAmount !== undefined ? Number(body.topUpAmount) : undefined,
    retroScoreMinPct: body?.retroScoreMinPct !== undefined ? Number(body.retroScoreMinPct) : undefined,
    retroScoreMaxPct: body?.retroScoreMaxPct !== undefined ? Number(body.retroScoreMaxPct) : undefined,
    bgWeight: body?.bgWeight !== undefined ? Number(body.bgWeight) : undefined,
    retroWeight: body?.retroWeight !== undefined ? Number(body.retroWeight) : undefined,
    bgBetAmountMin: body?.bgBetAmountMin !== undefined ? Number(body.bgBetAmountMin) : undefined,
    bgBetAmountMax: body?.bgBetAmountMax !== undefined ? Number(body.bgBetAmountMax) : undefined,
    activeTimeSlots: Array.isArray(body?.activeTimeSlots) ? body.activeTimeSlots.map(String) : undefined,
    actionIntervalSec: body?.actionIntervalSec !== undefined ? Number(body.actionIntervalSec) : undefined,
    actionJitterChancePct: body?.actionJitterChancePct !== undefined ? Number(body.actionJitterChancePct) : undefined,
    actionJitterMaxSec: body?.actionJitterMaxSec !== undefined ? Number(body.actionJitterMaxSec) : undefined
  })
})
