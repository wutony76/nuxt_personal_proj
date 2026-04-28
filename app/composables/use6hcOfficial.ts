import { cloneDeep } from 'lodash'
import { reactive } from 'vue'
import { GAME_6HC_OF, LOTTERY, SORT } from '~/config/constants'
import { PLAYLIST } from '~/config/bg/6hc-of'
import { api, type Lottery6hcOfCurrent, type Lottery6hcRoadPlay, type BetRecord } from '~/services/api'

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
  detail: [],
  runtime: null as Lottery6hcOfCurrent | null,
})
const road = reactive({
  plays: [] as Lottery6hcRoadPlay[],
})
const wallet = reactive({
  name: 'USER',
  coin: 0,
  currentBets: 0,
  totalBets: 0,
  analysis: '-',
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
let refreshTimer: ReturnType<typeof setTimeout> | null = null
const MIN_REFRESH_DELAY_MS = 250

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
  },
  clearCurrentInfoTimer: () => {
    if (refreshTimer) {
      clearTimeout(refreshTimer)
      refreshTimer = null
    }
  },
  scheduleNextCurrentInfoFetch: (statusEndAt?: number) => {
    handle.clearCurrentInfoTimer()
    if (!statusEndAt) {
      refreshTimer = setTimeout(() => {
        fetch.refreshCurrentInfo()
      }, 1000)
      return
    }
    const delay = Math.max(MIN_REFRESH_DELAY_MS, statusEndAt - time.nowMs + 50)
    refreshTimer = setTimeout(() => {
      fetch.refreshCurrentInfo()
    }, delay)
  }
}

const fetch = {
  currentInfo: async () => {
    const result = await api.lottery.current6hcOf()
    current.runtime = result
    init.setStatusEndAt(result.statusEndAt)
    return result
  },
  refreshCurrentInfo: async () => {
    try {
      const data = await fetch.currentInfo()
      handle.scheduleNextCurrentInfoFetch(data?.statusEndAt)
    } catch {
      // Keep page usable even when runtime data is temporarily unavailable.
      handle.scheduleNextCurrentInfoFetch()
    }
  },
  startCurrentInfoPolling: async () => {
    await fetch.refreshCurrentInfo()
  },
  stopCurrentInfoPolling: () => {
    handle.clearCurrentInfoTimer()
  },
  // LHC球號分析
  roadPlays: async () => {
    const result = await api.lottery.road6hcOf()
    road.plays = Array.isArray(result?.plays) ? result.plays : []
    return road.plays
  },
  walletState: async () => {
    const result = await api.lottery.userInfo()
    console.log('TTT2.API userInfo.res', result)
    wallet.coin = Number(result.coin ?? 0)
    wallet.currentBets = Number(result.currentBets ?? 0)
    wallet.totalBets = Number(result.totalBets ?? 0)
    wallet.analysis = String(result.analysis ?? '-')
    return result
  },
  // betMeta: async () => {
  //   if (wallet.betGameId > 0) return wallet.betGameId
  //   const result = await api.lottery.games()
  //   const games = result?.games ?? []
  //   const target = games.find((item) => item.key === '6hc') ?? games[0]
  //   if (!target) return 0
  //   wallet.betGameId = Number(target.id)
  //   wallet.betType = String(target.playTypes?.[0] ?? '特碼')
  //   return wallet.betGameId
  // },
  bets: async (coin: number) => {
    const groups = [...state.groupList]
    const amount = Math.max(1, Math.trunc(Number(coin) || 0)) * groups.length
    await api.lottery.bet({
      lottery: LOTTERY['LHC-OF'],
      groups,
      amount
    })
    state.groupList = []
    await fetch.walletState()
    return { ok: true, message: '下注成功' }
  },
  initPageData: async () => {
    await Promise.all([
      fetch.refreshCurrentInfo(),
      fetch.roadPlays(),
      fetch.walletState(),
      // fetch.betMeta(),
    ])
  },
  // Keep backward compatibility with old typo usage.
  crrentInfo: async () => fetch.refreshCurrentInfo()
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
    // console.log('sys.playList', system.playList)
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
    handle.clearCurrentInfoTimer()
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
  return { state, current, road, wallet, system, analyze, time, handle, init, click, fetch }
}