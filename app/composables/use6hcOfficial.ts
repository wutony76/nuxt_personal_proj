import { cloneDeep } from 'lodash'
import { computed, reactive } from 'vue'
import { GAME_6HC_OF, LOTTERY, SORT } from '~/config/constants'
import { PLAYLIST } from '~/config/bg/6hc-of'
import { type Lottery6hcOfCurrent, type Lottery6hcRoadPlay, type LotteryBetOrder } from '~/services/api'
import { useLhcDb, type Order, type Status } from '~/composables/useLhcDb'
import { Lottery6hcOfficialService } from '~/services/lottery6hcOfficialService'

type CurrentDetailRow = {
  id: string
  time: string
  bets: string[]
  coin: number
  status: Status
}

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
  detail: [] as CurrentDetailRow[],
  runtime: null as Lottery6hcOfCurrent | null,
  orderCache: {
    isLoading: false,
    isSuccess: false,
    errorMessage: ''
  }
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
const lhcDb = useLhcDb()
const officialService = new Lottery6hcOfficialService()
let orderDetailUnsubscribe: null | (() => void) = null
const orderDetailQuery = reactive({
  userId: '',
  issue: ''
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
  toDetailRows: (orders: Order[]) => {
    return orders.map((order) => ({
      id: String(order.order_id),
      time: handle.formatTime(order.bet_time),
      bets: Array.isArray(order.bet_code) ? order.bet_code : [],
      coin: Number(order.coin ?? 0),
      status: order.status ?? 'pending'
    }))
  },
  formatTime: (timestamp: number) => {
    if (!Number.isFinite(timestamp) || timestamp <= 0) return '--:--:--'
    const date = new Date(timestamp)
    const hh = String(date.getHours()).padStart(2, '0')
    const mm = String(date.getMinutes()).padStart(2, '0')
    const ss = String(date.getSeconds()).padStart(2, '0')
    return `${hh}:${mm}:${ss}`
  },
  normalizeUserId: (userId?: string | number | null) => {
    return String(userId ?? '').trim()
  },
  extractBetCode: (groups: Array<Record<string, unknown>>) => {
    return groups
      .flatMap((group) => {
        const playList = Array.isArray(group?.playList) ? group.playList : []
        return playList.map((play) => {
          const raw = (play as { label?: unknown; num?: unknown })?.label ?? (play as { num?: unknown })?.num
          const normalized = Number(raw)
          if (!Number.isFinite(normalized)) return ''
          return String(normalized).padStart(2, '0')
        })
      })
      .filter(Boolean)
  },
  normalizeOrderRows: (rows: LotteryBetOrder[]) => {
    return rows
      .map((row) => ({
        order_id: String(row?.order_id ?? '').trim(),
        user_id: String(row?.user_id ?? '').trim(),
        issue: String(row?.issue ?? '').trim(),
        bet_time: Number(row?.bet_time ?? Date.now()),
        coin: Number(row?.coin ?? 0),
        bet_code: Array.isArray(row?.bet_code) ? row.bet_code.map((code) => String(code).padStart(2, '0')) : [],
        status: (row?.status ?? 'success') as Status
      }))
      .filter((row) => Boolean(row.order_id) && Boolean(row.user_id) && Boolean(row.issue))
  },
  setOrderCacheState: (next: Partial<typeof current.orderCache>) => {
    current.orderCache.isLoading = next.isLoading ?? current.orderCache.isLoading
    current.orderCache.isSuccess = next.isSuccess ?? current.orderCache.isSuccess
    current.orderCache.errorMessage = next.errorMessage ?? current.orderCache.errorMessage
  },
  stopOrderDetailSync: () => {
    if (!orderDetailUnsubscribe) return
    orderDetailUnsubscribe()
    orderDetailUnsubscribe = null
  },
  startOrderDetailSync: (userId: string, issue: string) => {
    handle.stopOrderDetailSync()
    orderDetailUnsubscribe = lhcDb.watchOrders({
      userId,
      issue,
      limit: 20,
      onChange: (records) => {
        current.detail = handle.toDetailRows(records)
      }
    })
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
    const result = await officialService.fetchCurrentInfo()
    current.runtime = result
    init.setStatusEndAt(result.statusEndAt)
    const userId = handle.normalizeUserId(orderDetailQuery.userId)
    const issue = String(result?.issueCurrent ?? '')
    if (userId && issue) {
      orderDetailQuery.issue = issue
      handle.startOrderDetailSync(userId, issue)
    }
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
  orderDetailFromCache: async (userId: string, issue?: string) => {
    const normalizedUserId = handle.normalizeUserId(userId)
    if (!normalizedUserId) {
      current.detail = []
      return []
    }

    handle.setOrderCacheState({
      isLoading: true,
      isSuccess: false,
      errorMessage: ''
    })

    try {
      const records = await lhcDb.fetchOrders({
        userId: normalizedUserId,
        issue,
        limit: 20
      })
      current.detail = handle.toDetailRows(records)
      handle.setOrderCacheState({
        isLoading: false,
        isSuccess: true,
        errorMessage: ''
      })
      return records
    } catch (error: unknown) {
      current.detail = []
      handle.setOrderCacheState({
        isLoading: false,
        isSuccess: false,
        errorMessage: (error as Error)?.message || '讀取本地紀錄失敗'
      })
      return []
    }
  },
  cacheBetOrders: async (payload: {
    userId: string
    issue: string
    amount: number
    groups: Array<Record<string, unknown>>
    rows: LotteryBetOrder[]
  }) => {
    const normalizedUserId = handle.normalizeUserId(payload.userId)
    const issue = String(payload.issue ?? '')
    if (!normalizedUserId || !issue) return false

    try {
      const rows = handle.normalizeOrderRows(payload.rows)
      if (rows.length === 0) {
        const fallbackSerial = String(Date.now()).slice(-6)
        const fallbackRow: Order = {
          order_id: `LHC-OF${issue}${fallbackSerial}(1/1)`,
          user_id: normalizedUserId,
          issue,
          bet_time: Date.now(),
          coin: Number(payload.amount ?? 0),
          bet_code: handle.extractBetCode(payload.groups),
          status: 'success'
        }
        await lhcDb.saveOrder(fallbackRow)
      } else {
        await Promise.all(rows.map((row) => lhcDb.saveOrder(row)))
      }
      await lhcDb.cleanupOrders(normalizedUserId)
      return true
    } catch {
      // Cache failure should not block successful betting UX.
      return false
    }
  },
  stopOrderDetailSync: () => {
    handle.stopOrderDetailSync()
  },
  // LHC球號分析
  roadPlays: async () => {
    const result = await officialService.fetchRoadPlays()
    road.plays = Array.isArray(result?.plays) ? result.plays : []
    system.playList = [...road.plays]
    return road.plays
  },
  walletState: async () => {
    const result = await officialService.fetchWalletState()
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
  bets: async (coin: number, userId?: string | number | null) => {
    const groups = [...state.groupList]
    if (groups.length === 0) return { ok: false, message: '請先選擇號碼' }
    const amount = Math.max(1, Math.trunc(Number(coin) || 0)) * groups.length

    const normalizedUserId = handle.normalizeUserId(userId)
    const issue = String(current.runtime?.issueCurrent ?? '')

    const betResult = await officialService.submitBet({
      lottery: LOTTERY['LHC-OF'],
      groups,
      amount
    })
    await fetch.cacheBetOrders({
      userId: normalizedUserId,
      issue,
      amount,
      groups,
      rows: Array.isArray(betResult?.orders) ? betResult.orders : []
    })

    state.groupList = []
    await Promise.all([
      fetch.walletState(),
      fetch.orderDetailFromCache(normalizedUserId, issue)
    ])

    if (normalizedUserId && issue) {
      orderDetailQuery.userId = normalizedUserId
      orderDetailQuery.issue = issue
      handle.startOrderDetailSync(normalizedUserId, issue)
    }

    return { ok: true, message: String(betResult?.message ?? '下注成功') }
  },
  initPageData: async (userId?: string | number | null) => {
    const normalizedUserId = handle.normalizeUserId(userId)
    orderDetailQuery.userId = normalizedUserId
    await fetch.orderDetailFromCache(normalizedUserId)

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
    system.playList = cloneDeep(PLAYLIST.slice(0, 49))
  },
  syncServerTime: async () => {
    try {
      const result = await officialService.fetchServerTime()
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
    handle.stopOrderDetailSync()
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