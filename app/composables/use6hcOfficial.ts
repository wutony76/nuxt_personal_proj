import { cloneDeep } from 'lodash'
import { reactive } from 'vue'
import { GAME_6HC_OF } from '~/config/constants'
import { PLAYLIST } from '~/config/bg/6hc-of'

const state = reactive({
  status: GAME_6HC_OF.SINGLE.key as string,
  playList: [] as any[],
  groupList: [] as any[],
})

const handle = {
  modeList: () => {
    return Object.values(GAME_6HC_OF).map(item => ({ key: item.key, label: item.name, sort: item.sort })).sort((a, b) => a.sort - b.sort)
  },
  newGame: (_status?: string | String | null) => {
    if (_status) state.status = String(_status)
    state.playList = init.playList(state.status)
  },
  toggleSelect: (num: number) => {
    const next = state.playList.map((item) => {
      if (Number(item.num) !== num) return item
      return { ...item, selected: !item.selected }
    })
    state.playList = next
  },
  clearSelect: () => {
    const next = state.playList.map((item) => ({ ...item, selected: false }))
    state.playList = next
  },
  randomSelect: (count = 7) => {
    const max = state.status === GAME_6HC_OF.SINGLE.key ? 7 : 20
    const targetCount = Math.max(1, Math.min(max, Number(count) || 7))
    const shuffled = [...state.playList].sort(() => Math.random() - 0.5)
    const selectedSet = new Set(shuffled.slice(0, targetCount).map((item) => Number(item.num)))
    const next = state.playList.map((item) => ({ ...item, selected: selectedSet.has(Number(item.num)) }))
    state.playList = next
  }
}

const click = {
  switch: (status: string) => {
    state.status = status
    handle.newGame(status)
  }
}

const init = {
  playList: (status: string) => {
    switch (status) {
      case GAME_6HC_OF.SINGLE.key:
        return cloneDeep(PLAYLIST.slice(0, 49))
      case GAME_6HC_OF.DUPLEX.key:
      case GAME_6HC_OF.DANTUO.key:
        return cloneDeep(PLAYLIST)
      default:
        return []
    }
  },
}

handle.newGame(state.status)

export function use6hcOfficial() {
  return { state, handle, click }
}