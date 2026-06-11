import { Storage } from '../../services/storage'
import { sessionController } from '../../services/auth'
import { LOTTERY } from '~/config/constants'
import type Users from '../../services/users'

export default defineEventHandler((event) => {
  const _login = sessionController.require(event)
  const _user = Storage.get.user(_login.id) as Users
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
