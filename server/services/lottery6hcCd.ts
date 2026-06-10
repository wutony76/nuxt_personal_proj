import { Storage } from './storage'
import { LOTTERY, STATUS_TIME } from '~/config/constants'
import LOTTERY_BASE from './lotteryBase'
import { MEMORY } from './base'

type OpenCodeHistoryItem = {
  issue: string
  openCode: string[]
  time: { start: string; end: string }
  startAt: number
  endAt: number
  status: 'opened' | 'pending'
}

type BetOrderRow = {
  issue: string
  user_id: string
  bet_time: number
  coin: number
  order_id: string
  status: 'success'
  bet_code: string[]
  play_key: string
  play_type_name: string
}

type Group = {
  playTypeName?: string
  playKey?: string
  playList?: Array<{ num?: number | string; label?: string | number }>
}

type PlayBetsPayload = {
  amount?: number
  groups?: Group[]
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
  specialMatch: boolean
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
  userId?: string
  coin?: number
  record?: UserRecord
}

type IssuePrizeTier =
  | { normalMatch: number; needSpecial: boolean; type: 'pool'; ratio: number; minAmount?: number }
  | { normalMatch: number; needSpecial: boolean; type: 'fixed'; amount: number }

const ISSUE_PRIZE_TIERS: IssuePrizeTier[] = [
  { normalMatch: 6, needSpecial: false, type: 'pool', ratio: 0.70, minAmount: LOTTERY_BASE.BASE_FIRST_PRIZE },
  { normalMatch: 5, needSpecial: true, type: 'pool', ratio: 0.20, minAmount: 50000 },
  { normalMatch: 5, needSpecial: false, type: 'pool', ratio: 0.10, minAmount: 3500 },
  { normalMatch: 4, needSpecial: true, type: 'fixed', amount: 3000 },
  { normalMatch: 4, needSpecial: false, type: 'fixed', amount: 200 },
  { normalMatch: 3, needSpecial: true, type: 'fixed', amount: 10 },
  { normalMatch: 3, needSpecial: false, type: 'fixed', amount: 5 },
]

export default class LHC_CD extends LOTTERY_BASE {
  issueJackpotMap: Record<string, number>
  issueSettledMap: Record<string, boolean>
  carryJackpot: number
  jackpotBase: number
  jackpotBaseSetAt: number

  declare _get: LOTTERY_BASE['_get'] & {
    user: (userId: string) => UserStoreLike
    userRecord: (userId: string) => UserRecord
  }

  declare handle: LOTTERY_BASE['handle'] & {
    openCodePlay: (openCode: string[]) => Array<Record<string, unknown>>
    buildOrderRows: (input: { issue: string; userId: string; amount: number; groups: Group[] }) => BetOrderRow[]
    addIssueJackpot: (issue: string, amount: number) => void
    getMatchResult: (betCode: string[], openCode: string[]) => { normalCount: number; hasSpecial: boolean }
    settleClosedIssueIfNeeded: () => void
    settleIssuePrize: (issue: string, openCode: string[]) => void
    pushBalanceChange: (userId: string, payload: { issue: string; type: 'bet' | 'claim'; amount: number; before: number; after: number; note: string }) => void
    appendBetHistory: (row: BetOrderRow) => void
    ensureUserRecord: (user: UserStoreLike) => UserRecord
  }

  declare get: LOTTERY_BASE['get'] & {
    currentStatus: () => string
    currentIssue: () => string
    currentOpenCode: () => string[]
    openCodeHistory: () => OpenCodeHistoryItem[]
    userInfo: (userId: string) => any
    userDialogRecord: (userId: string) => any
    jackpotState: () => any
  }

  constructor() {
    super(LOTTERY['LHC-CD'].key, LOTTERY['LHC-CD'].id)
    this.issueJackpotMap = {}
    this.issueSettledMap = {}
    this.carryJackpot = 0
    this.jackpotBase = 0
    this.jackpotBaseSetAt = 0

    Object.assign(this._get, {
      user: (userId: string) => {
        return Storage.get.user(userId) as UserStoreLike
      },
      userRecord: (userId: string) => {
        const user = this._get.user(userId)
        return this.handle.ensureUserRecord(user)
      }
    })

    Object.assign(this.handle, {
      openCodePlay: (openCode: string[]) => {
        return openCode
          .map((code) => {
            const num = Number(code)
            if (!Number.isFinite(num)) return null
            return (Storage.get.lotteryPlay(LOTTERY['6HC'].id, num) ?? null) as Record<string, unknown> | null
          })
          .filter((play): play is Record<string, unknown> => Boolean(play))
      },
      buildOrderRows: (input: { issue: string; userId: string; amount: number; groups: Group[] }): BetOrderRow[] => {
        const rows: BetOrderRow[] = []
        input.groups.forEach((group) => {
          const playTypeName = String(group?.playTypeName || '')
          const playKey = String(group?.playKey || '')
          const playList = Array.isArray(group?.playList) ? group.playList : []
          playList.forEach((play) => {
            const orderId = this.handle.createOrderId(input.issue)
            const betCode = LOTTERY_BASE.normalizeBetCode(play)
            if (!betCode) return
            rows.push({
              issue: input.issue,
              user_id: input.userId,
              bet_time: Date.now(),
              coin: input.amount,
              order_id: `${orderId}(1/1)`,
              status: 'success',
              bet_code: [betCode],
              play_key: playKey,
              play_type_name: playTypeName
            })
          })
        })
        if (rows.length > 0) return rows
        const orderId = this.handle.createOrderId(input.issue)
        return [{
          issue: input.issue,
          user_id: input.userId,
          bet_time: Date.now(),
          coin: input.amount,
          order_id: `${orderId}(1/1)`,
          status: 'success',
          bet_code: [],
          play_key: '',
          play_type_name: ''
        }]
      },
      addIssueJackpot: (issue: string, amount: number) => {
        const safeIssue = String(issue ?? '')
        if (!safeIssue) return
        const current = Number(this.issueJackpotMap[safeIssue] ?? 0)
        this.issueJackpotMap[safeIssue] = Number((current + Number(amount ?? 0)).toFixed(2))
      },
      getMatchResult: (betCode: string[], openCode: string[]) => {
        const normalCodes = (Array.isArray(openCode) ? openCode : []).slice(0, 6)
        const specialCode = (Array.isArray(openCode) ? openCode : [])[6] ?? ''
        const normalSet = new Set(normalCodes.map((c) => String(c).padStart(2, '0')))
        const specialPad = String(specialCode).padStart(2, '0')
        const betPadded = (Array.isArray(betCode) ? betCode : []).map((c) => String(c).padStart(2, '0'))
        const normalCount = betPadded.filter((c) => normalSet.has(c)).length
        const hasSpecial = Boolean(specialPad) && betPadded.includes(specialPad)
        return { normalCount, hasSpecial }
      },
      settleClosedIssueIfNeeded: () => {
        const maxSettleIndex = this.currentStatus === STATUS_TIME.OPENED
          ? this.currentIndex
          : (this.currentIndex - 1)
        if (maxSettleIndex < 0) return
        for (let i = 0; i <= maxSettleIndex; i++) {
          const record = this.recordOpenCode[i]
          if (!record?.issue) continue
          if (this.issueSettledMap[record.issue]) continue
          this.handle.settleIssuePrize(record.issue, record.openCode)
          this.issueSettledMap[record.issue] = true
        }
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
        const totalPool = LOTTERY_BASE.jackpotCalc(this.jackpotBase, issuePool, this.carryJackpot)
        const evaluateRows = issueOrders.map((row) => {
          const { normalCount, hasSpecial } = this.handle.getMatchResult(row.betCode, openCode)
          return { ...row, normalCount, hasSpecial, payout: 0 }
        })

        let carryNext = 0
        ISSUE_PRIZE_TIERS.forEach((tier) => {
          const winners = evaluateRows.filter(
            (row) => row.normalCount === tier.normalMatch && row.hasSpecial === tier.needSpecial
          )
          if (tier.type === 'pool') {
            const tierPool = Number((totalPool * tier.ratio).toFixed(2))
            if (winners.length === 0) {
              carryNext = Number((carryNext + tierPool).toFixed(2))
              return
            }
            const totalWinnerBets = Number(winners.reduce((s, r) => s + Number(r.coin ?? 0), 0).toFixed(2))
            const naturalPerUnit = totalWinnerBets > 0 ? tierPool / totalWinnerBets : 0
            const prizePerUnit = tier.minAmount !== undefined
              ? Math.max(naturalPerUnit, tier.minAmount)
              : naturalPerUnit
            winners.forEach((row) => {
              const coin = Number(row.coin ?? 1)
              row.payout = Number((row.payout + Number((prizePerUnit * coin).toFixed(2))).toFixed(2))
            })
          } else {
            winners.forEach((row) => {
              const coin = Number(row.coin ?? 1)
              row.payout = Number((row.payout + Number((tier.amount * coin).toFixed(2))).toFixed(2))
            })
          }
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
              matchCount: row.normalCount,
              specialMatch: row.hasSpecial,
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
      appendBetHistory: (row: BetOrderRow) => {
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
          specialMatch: false,
          winStatus: 'pending',
          winAmount: 0
        })
        if (record.betHistory.length > 5000) {
          record.betHistory = record.betHistory.slice(-4000)
        }
        record.updatedAt = Date.now()
      }
    })

    Object.assign(this.get, {
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
        const currentIssueJackpot = Number(this.issueJackpotMap[issue] ?? 0)
        const carryJackpot = Number(this.carryJackpot ?? 0)
        const totalReal = LOTTERY_BASE.jackpotCalc(this.jackpotBase, currentIssueJackpot, carryJackpot)

        if (totalReal < LOTTERY_BASE.BASE_FIRST_PRIZE) this._handle.jackpotBase()

        return {
          issue,
          currentIssueJackpot,
          carryJackpot,
          jackpotBase: this.jackpotBase,
          jackpotBaseSetAt: this.jackpotBaseSetAt
        }
      }
    })

    this.init()
  }

  init() {
    this._handle.jackpotBase()
    this.handle.prdOpenCode()
    Storage.games[this.key] = this
    LOTTERY_BASE.getOrders(this.id, this.key)
  }

  circle() {
    this.handle.refreshCurrent(MEMORY.now)
    this.handle.settleClosedIssueIfNeeded()
  }

  playBets(payload: PlayBetsPayload, user: UserStoreLike) {
    const amount = Number(payload?.amount ?? 0)
    const userId = String(user?.userId ?? '')
    const beforeCoin = Number(user?.coin ?? 0)
    user.coin = beforeCoin - amount
    const afterCoin = Number(user?.coin ?? 0)

    const issue = this.recordOpenCode[this.currentIndex]?.issue ?? this._get.latestIssue()
    const groups = Array.isArray(payload?.groups) ? payload.groups : []
    const rows = this.handle.buildOrderRows({ issue, userId, amount, groups })
    this.handle.addIssueJackpot(issue, amount)
    this.handle.pushBalanceChange(userId, {
      issue,
      type: 'bet',
      amount: -Math.abs(amount),
      before: beforeCoin,
      after: afterCoin,
      note: `下注 ${rows.length} 筆`
    })

    const orders = this._get.orders()
    rows.forEach((row) => {
      orders.add.record({
        issue: row.issue,
        userId: row.user_id,
        coin: row.coin,
        orderId: row.order_id,
        betCode: row.bet_code
      })
      this.handle.appendBetHistory(row)
    })

    return {
      orderId: rows[0]?.order_id ? String(rows[0].order_id).split('(')[0] : '',
      orders: rows
    }
  }

  _handle = {
    jackpotBase: () => {
      this.jackpotBase = LOTTERY_BASE.jackpotBase()
      this.jackpotBaseSetAt = Date.now()
      return this.jackpotBase
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

  analysis = {
    betsIssue: (issue: string = this._get.latestIssue(), userId: string) => {
      const _orders = this._get.orders()
      const _currentBets = _orders.get.members.issue(issue, userId) ?? 0
      const _backBets = _orders.get.members.issue(`${Number(this.recordOpenCode[this.currentIndex]?.issue) - 1}`, userId) ?? 0
      if (_backBets === 0 && _currentBets === 0) return '尚未投注'
      else if (_backBets === 0) return '比上期多了 100%'
      const _diff = _currentBets - _backBets
      const _diffPercent = (_diff / _backBets) * 100
      if (_diffPercent > 0) return `比上期多了 ${_diffPercent.toFixed(2)}%`
      else if (_diffPercent < 0) return `比上期少了 ${Math.abs(_diffPercent).toFixed(2)}%`
      else return '與上一期投注相同'
    }
  }
}
