import { Storage } from '../../services/storage'
import { sessionController } from '../../services/auth'
import { LOTTERY } from '~/config/constants'

export default defineEventHandler((event) => {
  const _login = sessionController.require(event)
  const _user = Storage.get.user(_login.id)
  // console.log('TTT2.API bet.post.user', _user)
  const query = getQuery(event)
  const lotteryKey = query.lottery as string || LOTTERY['LHC-OF'].key
  const gameClass = Storage.games[lotteryKey]
  const res = gameClass.get.userInfo(_user.userId)

  return {
    coin: _user.coin,
    currentBets: res.currentBets,
    totalBets: res.totalBets,
    analysis: res.analysis,
  }
})
