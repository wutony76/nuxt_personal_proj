import { getToyCatalog } from '../../../services/game/toys/catalog'
import { Storage } from '../../../services/storage'

export default defineEventHandler(() => {
  const catalog = getToyCatalog()
  return {
    ...catalog,
    items: catalog.items.filter((item) => Storage.manager.lotteryTw.toyShop.isGameEnabled(item.slug)),
    enabled: Storage.manager.lotteryTw.toyShop.isEnabled()
  }
})
