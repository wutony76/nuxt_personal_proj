import { Storage } from '../../../services/storage'

type RoadPlay = {
  id?: number
  num?: number | string
  label?: string
  countIssue?: number
  countShow?: number
  selected?: boolean
  colorY?: boolean
}

export default defineEventHandler(() => {
  const source = Storage.config.LHC as Record<string, RoadPlay> | undefined
  if (!source) {
    return { plays: [] as RoadPlay[] }
  }

  const plays = Object.values(source)
    .filter((item) => Number(item?.num) > 0 && Number(item?.num) <= 49)
    .sort((a, b) => Number(a.num) - Number(b.num))
    .map((item) => ({
      ...item,
      selected: true
    }))

  return { plays }
})
