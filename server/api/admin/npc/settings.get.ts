import { sessionController } from 'serv/services/auth'
import { Storage } from 'serv/services/storage'

/**
 * 後台：NPC 自動遊玩總開關、排程參數、四分類遊戲清單、可勾選的時段清單、
 * 保存的遊戲勾選範本、NPC 會員清單
 */
export default defineEventHandler((event) => {
  sessionController.requireAdmin(event)

  const npc = Storage.manager.admin.npcAutoPlay
  return {
    enabled: npc.isEnabled(),
    schedule: npc.getSchedule(),
    games: npc.listGames(),
    timeSlots: npc.listTimeSlots(),
    gamePresets: npc.listGamePresets(),
    members: npc.listMembers()
  }
})
