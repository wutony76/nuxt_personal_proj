import { Storage } from './storage'
import { LOTTERY, STATUS_TIME } from '~/config/constants'
import OrdersClass from './orders'
import { prdDbId } from './config'

type OpenCodeRecord = {
  issue: string
  openCode: string[]
  time: {
    start: string
    end: string
  }
  startAt: number
  endAt: number
}

type CurrentInfo = OpenCodeRecord & {
  currentStatus: string
  issueCurrent: string
  issueLatest: string
  countdown: string
  statusEndAt: number
  openCodePlay: Array<Record<string, unknown>>
}

type OpenCodeHistoryItem = {
  issue: string
  openCode: string[]
  time: {
    start: string
    end: string
  }
  startAt: number
  endAt: number
  status: 'opened' | 'pending'
}

type BetOrderItem = {
  order_id: string
  issue: string
  user_id: string
  bet_time: number
  coin: number
  bet_code: string[]
  status: 'success'
}

type UserBalanceChange = {
  id: string
  issue: string
  type: 'bet' | 'claim'
  amount: number
  before: number
  after: number
  createdAt: number
  note: string
}

type UserBetHistory = {
  orderId: string
  issue: string
  betTime: number
  coin: number
  betCode: string[]
  openCode: string[]
  matchCount: number
  winStatus: 'pending' | 'win' | 'lose'
  winAmount: number
}

type UserClaimableIssue = {
  issue: string
  amount: number
  openCode: string[]
  createdAt: number
}

type UserRecord = {
  balanceChanges: UserBalanceChange[]
  betHistory: UserBetHistory[]
  claimableIssues: UserClaimableIssue[]
  updatedAt: number
}

type UserStoreLike = {
  userId: string
  coin: number
  record?: UserRecord
}

type IssuePrizeTier = {
  matchCount: number
  ratio: number
}

const ISSUE_PRIZE_TIERS: IssuePrizeTier[] = [
  { matchCount: 7, ratio: 0.4 },
  { matchCount: 6, ratio: 0.2 },
  { matchCount: 5, ratio: 0.15 },
  { matchCount: 4, ratio: 0.1 },
  { matchCount: 3, ratio: 0.08 },
  { matchCount: 2, ratio: 0.07 }
]

const CYCLE_SECONDS = 7 * 60
const CYCLE_MS = CYCLE_SECONDS * 1000
const TOTAL_ISSUES_PER_DAY = 205

export default class LHC_OF {
  id: number
  recordOpenCode: OpenCodeRecord[]
  currentIndex: number
  currentStatus: string
  issueOrderSeqMap: Record<string, number>
  issueJackpotMap: Record<string, number>
  issueSettledMap: Record<string, boolean>
  carryJackpot: number

  constructor() {
    this.id = LOTTERY['LHC-OF'].id
    this.recordOpenCode = []
    this.currentIndex = -1
    this.currentStatus = STATUS_TIME.PREPARE
    this.issueOrderSeqMap = {}
    this.issueJackpotMap = {}
    this.issueSettledMap = {}
    this.carryJackpot = 0
    this.init()
  }

  init() {
    this.handle.prdOpenCode()
    Storage.games[LOTTERY['LHC-OF'].key] = this
    console.log('LHC_OF.init.success', this.recordOpenCode)
    new OrdersClass({ id: LOTTERY['LHC-OF'].id, key: LOTTERY['LHC-OF'].key })
  }

  circle() {
    // console.log('RUN: LHC_OF.circle.Task')
    this.handle.refreshCurrent(new Date())
    this.handle.settleClosedIssueIfNeeded()
  }

  // USERPLAY.
  playBets(payload: any, _user: any) {
    console.log('class playBets.payload', _user)

    // HANDLE COIN
    const amount = Number(payload.amount)
    const userId = String(_user.userId ?? '')
    const beforeCoin = Number(_user.coin ?? 0)
    _user.coin -= amount
    const afterCoin = Number(_user.coin ?? 0)

    // HANDLE CONFIG PLAY INFO
    const groups = Array.isArray(payload.groups) ? payload.groups : []
    const lhcConfig = this._get.configPlay()
    const issue = this.recordOpenCode[this.currentIndex]?.issue ?? ''
    const orderRows = this.handle.buildOrderRows({
      issue,
      userId,
      amount,
      groups
    })
    this.handle.addIssueJackpot(issue, amount)
    this.handle.pushBalanceChange(userId, {
      issue,
      type: 'bet',
      amount: -Math.abs(amount),
      before: beforeCoin,
      after: afterCoin,
      note: `下注 ${orderRows.length} 筆`
    })

    groups.forEach((group: any) => {
      const playList = Array.isArray(group?.playList) ? group.playList : []
      playList.forEach((play: any) => {
        const num = Number(play?.num ?? play?.label)
        if (!Number.isFinite(num) || num <= 0) return
        const dbId = prdDbId(LOTTERY['6HC'].id, num)
        if (!dbId) return
        const target = lhcConfig?.[dbId]
        if (!target) return
        target.countShow = Number(target.countShow ?? 0) + 1
      })
    })

    // HANDLE ORDERS RECORD
    const _orders = this._get.orders()
    orderRows.forEach((row) => {
      _orders.add.record({
        issue: row.issue,
        userId: row.user_id,
        coin: row.coin,
        orderId: row.order_id,
        betCode: row.bet_code
      })
      this.handle.appendBetHistory(row)
    })

    // console.log('class USER', _user)
    // console.log('LHC_OF.ORDERS.ALL', _orders.get.orders.all())
    // console.log('LHC_OF.ORDERS.CURRENT_ISSUE', _orders.get.orders.currentIssue(this.recordOpenCode[this.currentIndex]?.issue))
    // console.log('----------LHC_OF----------')
    // console.log('LHC_OF.ORDERS.CURRENT_ISSUE_MEMBERS', _orders.get.members.user(_user.userId))
    // console.log('LHC_OF.ORDERS.CURRENT_ISSUE_MEMBERS', _orders.get.members.issue(this.recordOpenCode[this.currentIndex]?.issue, _user.userId))
    return {
      orderId: orderRows[0]?.order_id.split('(')[0] ?? '',
      orders: orderRows
    }
  }
  _get = {
    configPlay: () => {
      const lhcConfig = Storage.config.LHC as Record<string, any> | undefined
      return lhcConfig
    },
    latestIssue: () => {
      if (this.recordOpenCode.length === 0) return '19900101001'
      return this.recordOpenCode[this.currentIndex]?.issue ?? this.recordOpenCode[0]?.issue ?? '19900101001'
    },
    orders: () => {
      const key = LOTTERY['LHC-OF'].key
      const map = Storage.lottery.orders as Record<string, OrdersClass | undefined>
      if (!map[key]) {
        map[key] = new OrdersClass({ id: LOTTERY['LHC-OF'].id, key })
      }
      return map[key] as OrdersClass
    },
    user: (userId: string) => {
      return Storage.get.user(userId) as UserStoreLike
    },
    userRecord: (userId: string) => {
      const user = this._get.user(userId)
      return this.handle.ensureUserRecord(user)
    }
  }
  get = {
    currentInfo: () => {
      this.handle.refreshCurrent(new Date())
      const current = this.recordOpenCode[this.currentIndex]
      if (!current) {
        return null
      }
      const latestOpenRecord =
        this.currentStatus === STATUS_TIME.OPENED
          ? current
          : (this.recordOpenCode[this.currentIndex - 1] ?? current)
      const nowMs = Date.now()
      const remain = Math.max(0, Math.floor((current.endAt - nowMs) / 1000))
      const statusEndAt = this.timer.getStatusEndAt(current, nowMs)
      return {
        ...latestOpenRecord,
        currentStatus: this.currentStatus,
        issueCurrent: current.issue,
        issueLatest: latestOpenRecord.issue,
        countdown: this.timer.formatCountdown(remain),
        statusEndAt,
        openCodePlay: this.handle.openCodePlay(latestOpenRecord.openCode)
      } satisfies CurrentInfo
    },
    currentStatus: () => {
      this.handle.refreshCurrent(new Date())
      return this.currentStatus
    },
    currentIssue: () => {
      this.handle.refreshCurrent(new Date())
      return this.recordOpenCode[this.currentIndex]?.issue ?? ''
    },
    currentOpenCode: () => {
      this.handle.refreshCurrent(new Date())
      return this.recordOpenCode[this.currentIndex]?.openCode ?? []
    },
    openCodeHistory: () => {
      this.handle.refreshCurrent(new Date())
      const lastOpenedIndex = this.currentStatus === STATUS_TIME.OPENED
        ? this.currentIndex
        : Math.max(this.currentIndex - 1, -1)
      return this.recordOpenCode
        .slice(0, Math.max(lastOpenedIndex + 1, 0))
        .map((item, idx) => ({
          issue: String(item.issue),
          openCode: Array.isArray(item.openCode) ? item.openCode : [],
          time: {
            start: String(item.time?.start ?? ''),
            end: String(item.time?.end ?? '')
          },
          startAt: Number(item.startAt ?? 0),
          endAt: Number(item.endAt ?? 0),
          status: idx <= lastOpenedIndex ? 'opened' : 'pending'
        } satisfies OpenCodeHistoryItem))
    },
    roadPlays: () => {
      this.handle.refreshCurrent(new Date())
      return this.handle.buildRoadPlays()
    },
    userInfo: (userId: string) => {
      const _orders = this._get.orders()
      const issue = this.recordOpenCode[this.currentIndex]?.issue ?? ''
      return {
        currentBets: _orders.get.members.issue(issue, userId),
        totalBets: _orders.get.members.user(userId),
        analysis: this.analysis.betsIssue(this._get.latestIssue(), userId),
      }
    },
    userDialogRecord: (userId: string) => {
      const record = this._get.userRecord(userId)
      const balanceChanges = [...record.balanceChanges]
        .sort((a, b) => b.createdAt - a.createdAt)
      const betHistory = [...record.betHistory]
        .sort((a, b) => b.betTime - a.betTime)
      const claimableIssues = [...record.claimableIssues]
        .filter((item) => Number(item.amount) > 0)
        .sort((a, b) => String(a.issue).localeCompare(String(b.issue)))
      return {
        balanceChanges,
        betHistory,
        claimableIssues
      }
    },
    jackpotState: () => {
      const issue = this.recordOpenCode[this.currentIndex]?.issue ?? ''
      return {
        issue,
        currentIssueJackpot: Number(this.issueJackpotMap[issue] ?? 0),
        carryJackpot: Number(this.carryJackpot ?? 0)
      }
    }
  }
  actions = {
    claimOneIssue: (userId: string) => {
      const user = this._get.user(userId)
      const record = this.handle.ensureUserRecord(user)
      const sorted = [...record.claimableIssues]
        .filter((item) => Number(item.amount) > 0)
        .sort((a, b) => String(a.issue).localeCompare(String(b.issue)))
      const target = sorted[0]
      if (!target) {
        return {
          ok: false,
          message: '目前沒有可領取獎金',
          issue: '',
          amount: 0,
          coin: Number(user.coin ?? 0)
        }
      }

      const before = Number(user.coin ?? 0)
      const gain = Number(Number(target.amount ?? 0).toFixed(2))
      user.coin = Number((before + gain).toFixed(2))
      record.claimableIssues = record.claimableIssues
        .filter((item) => String(item.issue) !== String(target.issue))
      this.handle.pushBalanceChange(userId, {
        issue: String(target.issue),
        type: 'claim',
        amount: gain,
        before,
        after: Number(user.coin ?? 0),
        note: `領取第${target.issue}期中獎金`
      })

      return {
        ok: true,
        message: `成功領取第${target.issue}期獎金`,
        issue: target.issue,
        amount: gain,
        coin: Number(user.coin ?? 0)
      }
    }
  }
  timer = {
    getStartOfDay: (now: Date) => {
      const at = new Date(now)
      at.setHours(0, 0, 0, 0)
      return at
    },
    formatDateKey: (date: Date) => {
      const y = date.getFullYear().toString()
      const m = String(date.getMonth() + 1).padStart(2, '0')
      const d = String(date.getDate()).padStart(2, '0')
      return `${y}${m}${d}`
    },
    secondsFromIssueStart: (record: OpenCodeRecord, nowMs: number) => {
      return Math.floor((nowMs - record.startAt) / 1000)
    },
    getStatusBySeconds: (sec: number) => {
      if (sec < 30) return STATUS_TIME.PREPARE
      if (sec < 340) return STATUS_TIME.OPEN
      // if (sec < 335) return STATUS_TIME.PREPARE_CLOSE
      // if (sec < 336) return STATUS_TIME.PREPARE_CLOSE_5
      // if (sec < 337) return STATUS_TIME.PREPARE_CLOSE_4
      // if (sec < 338) return STATUS_TIME.PREPARE_CLOSE_3
      // if (sec < 339) return STATUS_TIME.PREPARE_CLOSE_2
      // if (sec < 340) return STATUS_TIME.PREPARE_CLOSE_1
      if (sec < 350) return STATUS_TIME.CLOSED
      if (sec < 360) return STATUS_TIME.PREPARE_OPEN
      if (sec < 375) return STATUS_TIME.OPENING
      return STATUS_TIME.OPENED
    },
    formatCountdown: (seconds: number) => {
      const safe = Math.max(0, seconds)
      const min = Math.floor(safe / 60)
      const sec = safe % 60
      return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
    },
    getStatusEndAt: (record: OpenCodeRecord, nowMs: number) => {
      const sec = this.timer.secondsFromIssueStart(record, nowMs)
      let endSec = CYCLE_SECONDS
      if (sec < 30) endSec = 30
      // else if (sec < 330) endSec = 330
      // else if (sec < 335) endSec = 335
      // else if (sec < 336) endSec = 336
      // else if (sec < 337) endSec = 337
      // else if (sec < 338) endSec = 338
      // else if (sec < 339) endSec = 339
      else if (sec < 340) endSec = 340
      else if (sec < 350) endSec = 350
      else if (sec < 360) endSec = 360
      else if (sec < 375) endSec = 375
      return record.startAt + endSec * 1000
    }
  }
  analysis = {
    betsIssue: (issue: string = this._get.latestIssue(), userId: string) => {
      // console.log('---LHC_OF.analysis', issue)
      const _orders = this._get.orders()
      const _currentBets = _orders.get.members.issue(issue, userId) ?? 0
      const _backBets = _orders.get.members.issue(`${Number(this.recordOpenCode[this.currentIndex]?.issue) - 1}`, userId) ?? 0
      // console.log('---LHC_OF.analysis2', _currentBets)
      // console.log('---LHC_OF.analysis3', _backBets)
      if (_backBets === 0 && _currentBets === 0) return '尚未投注'
      else if (_backBets === 0) return '比上期多了 100%'
      const _diff = _currentBets - _backBets
      const _diffPercent = (_diff / _backBets) * 100
      if (_diffPercent > 0) return `比上期多了 ${_diffPercent.toFixed(2)}%`
      else if (_diffPercent < 0) return `比上期少了 ${Math.abs(_diffPercent).toFixed(2)}%`
      else return '與上一期投注相同'
    }
  }
  handle = {
    ensureUserRecord: (user: UserStoreLike) => {
      if (!user.record) {
        user.record = {
          balanceChanges: [],
          betHistory: [],
          claimableIssues: [],
          updatedAt: Date.now()
        }
      }
      if (!Array.isArray(user.record.balanceChanges)) user.record.balanceChanges = []
      if (!Array.isArray(user.record.betHistory)) user.record.betHistory = []
      if (!Array.isArray(user.record.claimableIssues)) user.record.claimableIssues = []
      user.record.updatedAt = Date.now()
      return user.record
    },
    pushBalanceChange: (userId: string, payload: {
      issue: string
      type: 'bet' | 'claim'
      amount: number
      before: number
      after: number
      note: string
    }) => {
      if (!userId) return
      const user = this._get.user(userId)
      const record = this.handle.ensureUserRecord(user)
      record.balanceChanges.push({
        id: `${payload.issue}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
        issue: payload.issue,
        type: payload.type,
        amount: Number(payload.amount),
        before: Number(payload.before),
        after: Number(payload.after),
        createdAt: Date.now(),
        note: payload.note
      })
      if (record.balanceChanges.length > 5000) {
        record.balanceChanges = record.balanceChanges.slice(-4000)
      }
      record.updatedAt = Date.now()
    },
    appendBetHistory: (row: BetOrderItem) => {
      if (!row?.user_id) return
      const user = this._get.user(row.user_id)
      const record = this.handle.ensureUserRecord(user)
      record.betHistory.push({
        orderId: String(row.order_id),
        issue: String(row.issue),
        betTime: Number(row.bet_time),
        coin: Number(row.coin ?? 0),
        betCode: Array.isArray(row.bet_code) ? row.bet_code : [],
        openCode: [],
        matchCount: 0,
        winStatus: 'pending',
        winAmount: 0
      })
      if (record.betHistory.length > 5000) {
        record.betHistory = record.betHistory.slice(-4000)
      }
      record.updatedAt = Date.now()
    },
    addIssueJackpot: (issue: string, amount: number) => {
      const safeIssue = String(issue ?? '')
      if (!safeIssue) return
      const current = Number(this.issueJackpotMap[safeIssue] ?? 0)
      this.issueJackpotMap[safeIssue] = Number((current + Number(amount ?? 0)).toFixed(2))
    },
    getMatchCount: (betCode: string[], openCode: string[]) => {
      const openSet = new Set(
        (Array.isArray(openCode) ? openCode : [])
          .map((item) => String(item).padStart(2, '0'))
      )
      return (Array.isArray(betCode) ? betCode : [])
        .map((item) => String(item).padStart(2, '0'))
        .filter((code) => openSet.has(code)).length
    },
    settleClosedIssueIfNeeded: () => {
      const settleIndex = this.currentStatus === STATUS_TIME.OPENED
        ? this.currentIndex
        : (this.currentIndex - 1)
      if (settleIndex < 0) return
      const closedRecord = this.recordOpenCode[settleIndex]
      if (!closedRecord?.issue) return
      if (this.issueSettledMap[closedRecord.issue]) return
      this.handle.settleIssuePrize(closedRecord.issue, closedRecord.openCode)
      this.issueSettledMap[closedRecord.issue] = true
    },
    settleIssuePrize: (issue: string, openCode: string[]) => {
      const safeIssue = String(issue ?? '')
      if (!safeIssue) return
      const _orders = this._get.orders()
      const issueOrders = (_orders.get.orders.currentIssue(safeIssue) ?? []) as Array<{
        issue: string
        userId: string
        orderId: string
        coin: number
        betCode: string[]
      }>
      const issuePool = Number(this.issueJackpotMap[safeIssue] ?? 0)
      const totalPool = Number((issuePool + this.carryJackpot).toFixed(2))
      const evaluateRows = issueOrders.map((row) => ({
        ...row,
        matchCount: this.handle.getMatchCount(row.betCode, openCode),
        payout: 0
      }))

      let carryNext = 0
      ISSUE_PRIZE_TIERS.forEach((tier) => {
        const tierAmount = Number((totalPool * tier.ratio).toFixed(2))
        const winners = evaluateRows.filter((row) => row.matchCount === tier.matchCount)
        if (winners.length === 0) {
          carryNext = Number((carryNext + tierAmount).toFixed(2))
          return
        }
        const each = Number((tierAmount / winners.length).toFixed(2))
        winners.forEach((row) => {
          row.payout = Number((row.payout + each).toFixed(2))
        })
      })

      const payoutByUser = new Map<string, number>()
      evaluateRows.forEach((row) => {
        const user = this._get.user(row.userId)
        const record = this.handle.ensureUserRecord(user)
        const idx = record.betHistory.findIndex((item) => String(item.orderId) === String(row.orderId))
        if (idx >= 0) {
          const current = record.betHistory[idx]
          if (!current) return
          record.betHistory[idx] = {
            orderId: String(current.orderId),
            issue: String(current.issue),
            betTime: Number(current.betTime),
            coin: Number(current.coin),
            betCode: Array.isArray(current.betCode) ? current.betCode : [],
            openCode: [...openCode],
            matchCount: row.matchCount,
            winStatus: row.payout > 0 ? 'win' : 'lose',
            winAmount: row.payout
          }
        }
        if (row.payout > 0) {
          const prev = Number(payoutByUser.get(row.userId) ?? 0)
          payoutByUser.set(row.userId, Number((prev + row.payout).toFixed(2)))
        }
      })

      payoutByUser.forEach((amount, userId) => {
        if (amount <= 0) return
        const user = this._get.user(userId)
        const record = this.handle.ensureUserRecord(user)
        const issueIdx = record.claimableIssues.findIndex((item) => String(item.issue) === safeIssue)
        if (issueIdx >= 0) {
          const old = record.claimableIssues[issueIdx]
          if (!old) return
          record.claimableIssues[issueIdx] = {
            issue: String(old.issue),
            amount: Number((Number(old.amount ?? 0) + amount).toFixed(2)),
            openCode: [...openCode],
            createdAt: Number(old.createdAt ?? Date.now())
          }
        } else {
          record.claimableIssues.push({
            issue: safeIssue,
            amount: Number(amount.toFixed(2)),
            openCode: [...openCode],
            createdAt: Date.now()
          })
        }
      })

      this.carryJackpot = Number(carryNext.toFixed(2))
      this.issueJackpotMap[safeIssue] = 0
    },
    openCodePlay: (openCode: string[]) => {
      const roadMap = new Map(
        this.handle.buildRoadPlays().map((play) => [Number(play?.num), play])
      )
      return openCode
        .map((code) => {
          const num = Number(code)
          if (!Number.isFinite(num)) return null
          const play = roadMap.get(num) ?? Storage.get.lotteryPlay(LOTTERY['6HC'].id, num)
          return (play ?? null) as Record<string, unknown> | null
        })
        .filter((play): play is Record<string, unknown> => Boolean(play))
    },
    createOrderId: (issue: string) => {
      const safeIssue = String(issue ?? '').trim() || this._get.latestIssue()
      const next = Number(this.issueOrderSeqMap[safeIssue] ?? 0) + 1
      this.issueOrderSeqMap[safeIssue] = next
      const serial = String(next).padStart(6, '0')
      return `LHC-OF${safeIssue}${serial}`
    },
    buildOrderRows: (input: { issue: string; userId: string; amount: number; groups: any[] }) => {
      const groups = Array.isArray(input.groups) ? input.groups : []
      if (groups.length === 0) return [] as BetOrderItem[]

      const orderId = this.handle.createOrderId(input.issue)
      const total = groups.length
      const coinPerRow = Number((Number(input.amount) / total).toFixed(2))
      const betTime = Date.now()

      return groups.map((group: any, idx: number) => {
        const playList = Array.isArray(group?.playList) ? group.playList : []
        const bet_code = playList
          .map((play: any) => {
            const num = Number(play?.num ?? play?.label)
            if (!Number.isFinite(num) || num <= 0) return ''
            return String(num).padStart(2, '0')
          })
          .filter(Boolean)

        return {
          order_id: `${orderId}(${idx + 1}/${total})`,
          issue: input.issue,
          user_id: input.userId,
          bet_time: betTime,
          coin: coinPerRow,
          bet_code,
          status: 'success'
        } satisfies BetOrderItem
      })
    },
    buildRoadPlays: () => {
      const source = Storage.config.LHC as Record<string, any> | undefined
      const basePlays = source
        ? Object.values(source)
          .filter((item) => Number(item?.num) > 0 && Number(item?.num) <= 49)
          .sort((a, b) => Number(a.num) - Number(b.num))
        : []

      const statsMap = new Map<number, { countShow: number; countIssue: number }>()
      for (let num = 1; num <= 49; num++) {
        statsMap.set(num, { countShow: 0, countIssue: 0 })
      }

      const closedIndex = this.currentStatus === STATUS_TIME.OPENED
        ? this.currentIndex
        : Math.max(this.currentIndex - 1, -1)
      const records = this.recordOpenCode.slice(0, closedIndex + 1)
      const lastSeenMap = new Map<number, number>()
      const showCountMap = new Map<number, number>()

      records.forEach((record, issueIdx) => {
        record.openCode.forEach((code) => {
          const num = Number(code)
          if (!Number.isFinite(num) || num < 1 || num > 49) return
          showCountMap.set(num, Number(showCountMap.get(num) ?? 0) + 1)
          lastSeenMap.set(num, issueIdx)
        })
      })

      for (let num = 1; num <= 49; num++) {
        const countShow = Number(showCountMap.get(num) ?? 0)
        const lastSeenIdx = Number(lastSeenMap.get(num) ?? -1)
        const countIssue = lastSeenIdx < 0 ? records.length : (records.length - 1 - lastSeenIdx)
        statsMap.set(num, { countShow, countIssue })
      }

      return basePlays.map((play) => {
        const num = Number(play?.num ?? 0)
        const stats = statsMap.get(num) ?? { countShow: 0, countIssue: 0 }
        return {
          ...play,
          countShow: stats.countShow,
          countIssue: stats.countIssue,
          selected: true
        }
      })
    },
    randomOpenCode: () => {
      const source = Array.from({ length: 49 }, (_, i) => String(i + 1).padStart(2, '0'))
      for (let i = source.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        const tmp = source[i]
        source[i] = source[j] as string
        source[j] = tmp as string
      }
      return source.slice(0, 7).sort((a, b) => Number(a) - Number(b))
    },
    refreshCurrent: (now = new Date()) => {
      if (this.recordOpenCode.length === 0) {
        this.handle.prdOpenCode(now)
      }
      const first = this.recordOpenCode[0]
      if (!first) {
        this.currentIndex = -1
        this.currentStatus = STATUS_TIME.PREPARE
        return
      }

      const dayKey = this.timer.formatDateKey(now)
      if (!first.issue.startsWith(dayKey)) {
        this.handle.prdOpenCode(now)
      }

      const dayStartMs = this.timer.getStartOfDay(now).getTime()
      const nowMs = now.getTime()
      const diffMs = Math.max(0, nowMs - dayStartMs)
      const nextIndex = Math.min(TOTAL_ISSUES_PER_DAY - 1, Math.floor(diffMs / CYCLE_MS))
      this.currentIndex = nextIndex

      const current = this.recordOpenCode[this.currentIndex]
      if (!current) {
        this.currentStatus = STATUS_TIME.PREPARE
        return
      }
      const sec = this.timer.secondsFromIssueStart(current, nowMs)
      this.currentStatus = this.timer.getStatusBySeconds(sec)
      this.handle.settleClosedIssueIfNeeded()
    },
    // 205 
    prdOpenCode: (now = new Date()) => {
      const dayStart = this.timer.getStartOfDay(now).getTime()
      const dateKey = this.timer.formatDateKey(now)
      this.recordOpenCode = []
      for (let i = 0; i < TOTAL_ISSUES_PER_DAY; i++) {
        const record = this.handle.addOpenCodeItem()
        const startAt = dayStart + i * CYCLE_MS
        const endAt = startAt + CYCLE_MS
        record.issue = `${dateKey}${String(i + 1).padStart(3, '0')}`
        record.openCode = this.handle.randomOpenCode()
        record.time.start = new Date(startAt).toISOString()
        record.time.end = new Date(endAt).toISOString()
        record.startAt = startAt
        record.endAt = endAt
        this.recordOpenCode.push(record)
      }
      this.currentIndex = 0
      this.currentStatus = STATUS_TIME.PREPARE
    },
    addOpenCodeItem: () => {
      return {
        issue: '',
        openCode: [],
        time: {
          start: '',
          end: ''
        },
        startAt: 0,
        endAt: 0
      } as OpenCodeRecord
    }
  }
}