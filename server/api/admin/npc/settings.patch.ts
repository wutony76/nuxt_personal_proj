import { sessionController } from 'serv/services/auth'
import { Storage } from 'serv/services/storage'
import type { NpcSchedule } from 'serv/services/admin/modules/npcAutoPlay'

type Body = {
  enabled?: unknown
  schedule?: Partial<Record<keyof NpcSchedule, unknown>>
}

/**
 * 後台：切換 NPC 自動遊玩總開關，與/或更新排程參數（未帶到的欄位維持原值）
 */
export default defineEventHandler(async (event) => {
  sessionController.requireAdmin(event)

  const npc = Storage.manager.admin.npcAutoPlay
  const body = await readBody<Body>(event)

  if (typeof body?.enabled === 'boolean') {
    npc.setEnabled(body.enabled)
  }
  if (body?.schedule && typeof body.schedule === 'object') {
    const patch: Partial<NpcSchedule> = {}
    for (const [field, value] of Object.entries(body.schedule)) {
      if (value !== undefined) (patch as Record<string, number>)[field] = Number(value)
    }
    npc.updateSchedule(patch)
  }

  return {
    enabled: npc.isEnabled(),
    schedule: npc.getSchedule()
  }
})
