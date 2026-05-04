import { Storage } from '../../../services/storage'
import { LOTTERY } from '~/config/constants'

type OpenCodeHistoryItem = {
  issue: string
  openCode: string[]
  time: {
    start: string
    end: string
  }
  startAt: number
  endAt: number
  status: 'opened' | 'pending'
}

export default defineEventHandler(() => {
  const game = Storage.games[LOTTERY['LHC-OF'].key] as {
    get?: {
      openCodeHistory?: () => OpenCodeHistoryItem[]
    }
  } | undefined
  const history = game?.get?.openCodeHistory?.() ?? []
  return {
    history
  }
})
