import { Storage } from '../../../services/storage'
import { LOTTERY } from '~/config/constants'

type RoadPlay = {
  id?: number
  num?: number | string
  label?: string
  countIssue?: number
  countShow?: number
  selected?: boolean
  colorY?: boolean
  animal?: string
}

export default defineEventHandler(() => {
  const game = Storage.games[LOTTERY['LHC-CD'].key] as {
    get?: { roadPlays?: () => RoadPlay[] }
  } | undefined

  const plays = game?.get?.roadPlays?.()
  if (!Array.isArray(plays)) {
    return { plays: [] as RoadPlay[] }
  }

  return { plays }
})
