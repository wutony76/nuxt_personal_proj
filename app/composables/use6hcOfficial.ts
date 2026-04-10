import { reactive } from 'vue'
import { GAME_6HC_OF } from '~/config/constants'
import { PLAYLIST } from '~/config/bg/6hc-of'

export type PlayModeKey = 'single' | 'duplex' | 'dantuo' | 'number'

type ModeItem = {
  key: PlayModeKey
  label: string
}

const modeList: ModeItem[] = [
  { key: 'single', label: '自選單式' },
  { key: 'duplex', label: '自選複式' },
  { key: 'dantuo', label: '自選膽拖' },
  { key: 'number', label: '運財號碼' }
]

const cloneList = <T>(list: T[]): T[] => structuredClone(list)

const statusToMode = (status: string): PlayModeKey => {
  if (status === GAME_6HC_OF.DUPLEX) return 'duplex'
  if (status === GAME_6HC_OF.DANTUO) return 'dantuo'
  return 'single'
}

const modeToStatus = (mode: PlayModeKey) => {
  if (mode === 'duplex') return GAME_6HC_OF.DUPLEX
  if (mode === 'dantuo') return GAME_6HC_OF.DANTUO
  return GAME_6HC_OF.SINGLE
}

const state = reactive({
  mode: 'single' as PlayModeKey,
  status: GAME_6HC_OF.SINGLE as string,
  playlist: [] as any[],
  playList: [] as any[],
})

const handle = {
  newGame: (_status?: string | String | null) => {
    if (_status) state.status = String(_status)
    // state.mode = statusToMode(state.status)
    state.playlist = init.playList(state.status)
    state.playList = state.playlist
  },
  toggleSelect: (num: number) => {
    const next = state.playlist.map((item) => {
      if (Number(item.num) !== num) return item
      return { ...item, selected: !item.selected }
    })
    state.playlist = next
    state.playList = next
  },
  clearSelect: () => {
    const next = state.playlist.map((item) => ({ ...item, selected: false }))
    state.playlist = next
    state.playList = next
  },
  randomSelect: (count = 7) => {
    const max = state.status === GAME_6HC_OF.SINGLE ? 7 : 20
    const targetCount = Math.max(1, Math.min(max, Number(count) || 7))
    const shuffled = [...state.playlist].sort(() => Math.random() - 0.5)
    const selectedSet = new Set(shuffled.slice(0, targetCount).map((item) => Number(item.num)))
    const next = state.playlist.map((item) => ({ ...item, selected: selectedSet.has(Number(item.num)) }))
    state.playlist = next
    state.playList = next
  }
}

const setMode = (mode: PlayModeKey) => {
  state.mode = mode
  state.status = modeToStatus(mode)
  handle.newGame(state.status)
}

const init = {
  playList: (status: string) => {
    switch (status) {
      case GAME_6HC_OF.SINGLE:
        return cloneList(PLAYLIST.slice(0, 49))
      case GAME_6HC_OF.DUPLEX:
      case GAME_6HC_OF.DANTUO:
        return cloneList(PLAYLIST)
      default:
        return []
    }
  },
}

handle.newGame(state.status)

export function use6hcOfficial() {
  return { state, handle, modeList, setMode }
}