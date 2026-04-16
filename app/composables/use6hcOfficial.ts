import { cloneDeep } from 'lodash'
import { reactive } from 'vue'
import { GAME_6HC_OF, SORT } from '~/config/constants'
import { PLAYLIST } from '~/config/bg/6hc-of'

const state = reactive({
  // UI
  status: GAME_6HC_OF.SINGLE.key as string,
  playList: [] as any[],
  // INFO
  limit: { min: -1, max: -1 },
  isSelector: null as any,
  // Controller
  groupList: [] as any[],
  coin: 1,
})
const current = reactive({
  detail: []
})
const system = reactive({
  playList: [] as any[],
})
const analyze = reactive({
  status: SORT.DEFAULT,
})

const mockSystemCounts = (num: number) => {
  // Keep SSR/CSR initial render deterministic to avoid hydration mismatch.
  return {
    countIssue: (num * 7 + 3) % 40,
    countShow: (num * 11 + 5) % 99,
  }
}


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
  run: () => {
    handle.newGame(state.status)
    // TEST.DATA
    system.playList = cloneDeep(PLAYLIST.slice(0, 49)).map((item) => {
      const num = Number(item.num) || 0
      const counts = mockSystemCounts(num)
      return {
        ...item,
        ...counts,
      }
    })
    console.log('sys.playList', system.playList)
  }
}

state.isSelector = computed(() => {
  return state.playList.filter(item => item.selected)
})

init.run()

export function use6hcOfficial() {
  return { state, current, system, analyze, handle, init, click }
}