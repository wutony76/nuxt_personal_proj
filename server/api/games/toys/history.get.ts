import { sessionController } from '../../../services/auth'
import { walletBalanceService } from '../../../services/walletBalance'

/** 柑仔店櫥仔（尪仔標、抽抽樂等玩具）自己的下注／結算紀錄 */
export default defineEventHandler((event) => {
  const login = sessionController.require(event)
  const records = walletBalanceService.listByTypes(login.id, ['toy-bet', 'toy-reward'])
  return { records }
})
