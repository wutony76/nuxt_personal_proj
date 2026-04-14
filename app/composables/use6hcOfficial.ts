import { cloneDeep } from 'lodash'
import { reactive } from 'vue'
import { GAME_6HC_OF } from '~/config/constants'
import { PLAYLIST } from '~/config/bg/6hc-of'

const state = reactive({
  // UI
  status: GAME_6HC_OF.SINGLE.key as string,
  playList: [] as any[],
  // INFO
  limit: { min: -1, max: -1 },
  isSelector: [],
  // Controller
  groupList: [] as any[],
  coin: 1,
})

const handle = {
  modeList: () => {
    return Object.values(GAME_6HC_OF).map(item => ({ key: item.key, label: item.name, sort: item.sort })).sort((a, b) => a.sort - b.sort)
  },
  newGame: (_status?: string | String | null) => {
    if (_status) state.status = String(_status)
    state.playList = init.playList(state.status)
    state.groupList = []
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
        state.limit.min = 7
        state.limit.max = 7
        return cloneDeep(PLAYLIST.slice(0, 49))
      case GAME_6HC_OF.DUPLEX.key:
      case GAME_6HC_OF.DANTUO.key:
        return cloneDeep(PLAYLIST)
      default:
        return []
    }
  },
}

state.isSelector = computed(() => {
  return state.playList.filter(item => item.selected)
})


handle.newGame(state.status)

export function use6hcOfficial() {
  return { state, handle, click }
}