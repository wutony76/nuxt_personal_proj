import { getToyCatalog } from '../../../services/game/toys/catalog'
import { Storage } from '../../../services/storage'

export default defineEventHandler(() => ({
  ...getToyCatalog(),
  enabled: Storage.manager.lotteryTw.toyShop.isEnabled()
}))
