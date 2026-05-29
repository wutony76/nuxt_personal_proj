import { Storage } from '../../../services/storage'
import { LOTTERY } from '~/config/constants'

type Lottery6hcOfService = {
  get: {
    jackpotState?: () => {
      issue: string
      currentIssueJackpot: number
      carryJackpot: number
      jackpotBase: number
    }
  }
}

export default defineEventHandler(() => {
  const game = Storage.games[LOTTERY['LHC-OF'].key] as Lottery6hcOfService | undefined
  const jackpot = game?.get?.jackpotState?.() ?? { issue: '', currentIssueJackpot: 0, carryJackpot: 0, jackpotBase: 0 }
  return jackpot
})
