import { cloneDeep } from 'lodash'
import { reactive } from 'vue'
import { GAME_6HC_OF, SORT } from '~/config/constants'
import { PLAYLIST } from '~/config/bg/6hc-of'
import { api } from '~/services/api'

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
const time = reactive({
  syncedAtServerMs: 0,
  syncedAtClientMs: 0,
  nowMs: Date.now(),
  statusEndAt: 0,
  statusRemainSec: 0,
  statusRemainLabel: '00:00'
})

let tickTimer: ReturnType<typeof setInterval> | null = null
let syncTimer: ReturnType<typeof setInterval> | null = null

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
  updateStatusRemain: () => {
    if (!time.statusEndAt) {
      time.statusRemainSec = 0
      time.statusRemainLabel = '00:00'
      return
    }
    const remainSec = Math.max(0, Math.floor((time.statusEndAt - time.nowMs) / 1000))
    time.statusRemainSec = remainSec
    const min = Math.floor(remainSec / 60)
    const sec = remainSec % 60
    time.statusRemainLabel = `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  },
  tickServerNow: () => {
    if (time.syncedAtServerMs <= 0 || time.syncedAtClientMs <= 0) {
      time.nowMs = Date.now()
    } else {
      time.nowMs = time.syncedAtServerMs + (Date.now() - time.syncedAtClientMs)
    }
    handle.updateStatusRemain()
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
  },
  syncServerTime: async () => {
    try {
      const result = await api.system.servTime()
      time.syncedAtServerMs = result.serverTime
      time.syncedAtClientMs = Date.now()
      handle.tickServerNow()
    } catch {
      // Keep previous offset and continue local ticking.
    }
  },
  startServerTimeSync: async () => {
    if (tickTimer) return
    await init.syncServerTime()
    tickTimer = setInterval(() => {
      handle.tickServerNow()
    }, 1000)
    syncTimer = setInterval(() => {
      init.syncServerTime()
    }, 3000)
  },
  stopServerTimeSync: () => {
    if (tickTimer) {
      clearInterval(tickTimer)
      tickTimer = null
    }
    if (syncTimer) {
      clearInterval(syncTimer)
      syncTimer = null
    }
  },
  setStatusEndAt: (endAt: number) => {
    time.statusEndAt = endAt
    handle.updateStatusRemain()
  }
}

state.isSelector = computed(() => {
  return state.playList.filter(item => item.selected)
})

init.run()

export function use6hcOfficial() {
  return { state, current, system, analyze, time, handle, init, click }
}