import { sessionController } from 'serv/services/auth'
import { Storage } from 'serv/services/storage'

type Body = {
  testMode?: unknown
  npcMode?: unknown
  dailyCoinReward?: {
    enabled?: unknown
    amount?: unknown
  }
}

/**
 * 更新角色開關設定：測試模式／NPC模式／每日自動加F幣。
 * @returns role（更新後的角色定義）
 */
export default defineEventHandler(async (event) => {
  sessionController.requireAdmin(event)
  const id = String(getRouterParam(event, 'id') ?? '').trim()
  if (!id) throw createError({ statusCode: 400, message: '缺少角色 id。' })

  const body = await readBody<Body>(event)
  const patch: {
    testMode?: boolean
    npcMode?: boolean
    dailyCoinReward?: { enabled?: boolean; amount?: number }
  } = {}

  if (typeof body?.testMode === 'boolean') patch.testMode = body.testMode
  if (typeof body?.npcMode === 'boolean') patch.npcMode = body.npcMode
  if (body?.dailyCoinReward) {
    patch.dailyCoinReward = {}
    if (typeof body.dailyCoinReward.enabled === 'boolean') patch.dailyCoinReward.enabled = body.dailyCoinReward.enabled
    if (typeof body.dailyCoinReward.amount === 'number') patch.dailyCoinReward.amount = body.dailyCoinReward.amount
  }

  const role = Storage.manager.admin.roleDefs.updateSettings(id, patch)
  return { role }
})
