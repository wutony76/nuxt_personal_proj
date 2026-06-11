export { LHC_COLORS } from '#shared/config/6hc-cd'

export type PlaylistItem = {
  id: number
  num: number
  countIssue: number
  countShow: number
  odds: number
  label: string
  show: boolean
  colorY: boolean
  selected: boolean
  dbId?: string
}

export const PLAYLIST: PlaylistItem[] = Array.from({ length: 50 }, (_, i) => {
  const num = i + 1
  return {
    id: num,
    num,
    countIssue: -1,
    countShow: -1,
    odds: -1,
    label: String(num).padStart(2, '0'),
    show: true,
    colorY: false,
    selected: false,
  }
})
