import { sessionController } from 'serv/services/auth'
import { Storage } from 'serv/services/storage'

/**
 * 後台：柑仔店櫥仔目前開關狀態與各玩法賠率倍數
 */
export default defineEventHandler((event) => {
  sessionController.requireAdminView(event)

  return {
    enabled: Storage.manager.lotteryTw.toyShop.isEnabled(),
    odds: Storage.manager.lotteryTw.toyShop.listOdds()
  }
})
