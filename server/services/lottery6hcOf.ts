import { Storage } from './storage'
import { LOTTERY, STATUS_TIME } from '~/config/constants'
import { prdDbId } from './config'
import LOTTERY_BASE from './lotteryBase'

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
  bet_count: number
  bet_code: string[]
  dan_code?: string[]
  tuo_code?: string[]
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
  betCount: number
  betCode: string[]
  danCode?: string[]
  tuoCode?: string[]
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
  userId: string
  coin: number
  record?: UserRecord
}

// normalMatch = 需命中正碼數；needSpecial = 是否需要命中特別號
// minAmount：每單位最低保障（僅頭獎設定，避免「下全注獲利」漏洞）
type IssuePrizeTier =
  | { normalMatch: number; needSpecial: boolean; type: 'pool'; ratio: number; minAmount?: number }
  | { normalMatch: number; needSpecial: boolean; type: 'fixed'; amount: number }

// ── 池底設定：可調整此範圍 ──────────────────────────────────────
const ISSUE_PRIZE_TIERS: IssuePrizeTier[] = [
  { normalMatch: 6, needSpecial: false, type: 'pool', ratio: 0.70, minAmount: LOTTERY_BASE.BASE_FIRST_PRIZE }, // 頭獎
  { normalMatch: 5, needSpecial: true, type: 'pool', ratio: 0.20, minAmount: 50000 },                          // 二獎（最低50000）
  { normalMatch: 5, needSpecial: false, type: 'pool', ratio: 0.10, minAmount: 3500 },                           // 三獎（最低3500，高於四獎3000，避免逆序）
  { normalMatch: 4, needSpecial: true, type: 'fixed', amount: 3000 },                                           // 四獎
  { normalMatch: 4, needSpecial: false, type: 'fixed', amount: 200 },                                            // 五獎
  { normalMatch: 3, needSpecial: true, type: 'fixed', amount: 10 },                                             // 六獎
  { normalMatch: 3, needSpecial: false, type: 'fixed', amount: 5 },                                              // 七獎
]
// ────────────────────────────────────────────────────────────────

export default class LHC_OF extends LOTTERY_BASE {
  issueJackpotMap: Record<string, number>
  issueSettledMap: Record<string, boolean>
  carryJackpot: number
  jackpotBase: number
  jackpotBaseSetAt: number

  declare _get: LOTTERY_BASE['_get'] & {
    configPlay: () => Record<string, any> | undefined
    user: (userId: string) => UserStoreLike
    userRecord: (userId: string) => UserRecord
  }

  declare handle: LOTTERY_BASE['handle'] & {
    openCodePlay: (openCode: string[]) => Array<Record<string, unknown>>
    buildOrderRows: (input: { issue: string; userId: string; amount: number; groups: any[] }) => BetOrderItem[]
    buildRoadPlays: () => any[]
    addIssueJackpot: (issue: string, amount: number) => void
    getMatchResult: (betCode: string[], openCode: string[]) => { normalCount: number; hasSpecial: boolean }
    settleClosedIssueIfNeeded: () => void
    settleIssuePrize: (issue: string, openCode: string[]) => void
    pushBalanceChange: (userId: string, payload: { issue: string; type: 'bet' | 'claim'; amount: number; before: number; after: number; note: string }) => void
    appendBetHistory: (row: BetOrderItem) => void
    ensureUserRecord: (user: UserStoreLike) => UserRecord
  }

  declare get: LOTTERY_BASE['get'] & {
    currentStatus: () => string
    currentIssue: () => string
    currentOpenCode: () => string[]
    openCodeHistory: () => OpenCodeHistoryItem[]
    roadPlays: () => any[]
    userInfo: (userId: string) => any
    userDialogRecord: (userId: string) => any
    jackpotState: () => any
  }

  constructor() {
    super('LHC-OF', LOTTERY['LHC-OF'].id)
    this.issueJackpotMap = {}
    this.issueSettledMap = {}
    this.carryJackpot = 0
    this.jackpotBase = 0
    this.jackpotBaseSetAt = 0

    Object.assign(this._get, {
      configPlay: () => {
        return Storage.config.LHC as Record<string, any> | undefined
      },
      user: (userId: string) => {
        return Storage.get.user(userId) as UserStoreLike
      },
      userRecord: (userId: string) => {
        const user = this._get.user(userId)
        return this.handle.ensureUserRecord(user)
      }
    })

    const baseRefresh = this.handle.refreshCurrent
    Object.assign(this.handle, {
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
      buildOrderRows: (input: { issue: string; userId: string; amount: number; groups: any[] }) => {
        const groups = Array.isArray(input.groups) ? input.groups : []
        if (groups.length === 0) return [] as BetOrderItem[]

        const orderId = this.handle.createOrderId(input.issue)
        const total = groups.length
        const totalBetCount = groups.reduce((sum: number, g: any) => sum + Math.max(1, Number(g?.betCount ?? 1)), 0)
        const unitCoin = totalBetCount > 0 ? Number(input.amount) / totalBetCount : 0
        const betTime = Date.now()

        const toCode = (play: any): string => LOTTERY_BASE.normalizeBetCode(play)

        return groups.map((group: any, idx: number) => {
          const playList = Array.isArray(group?.playList) ? group.playList : []
          const bet_code = playList.map(toCode).filter(Boolean)
          const betCount = Math.max(1, Number(group?.betCount ?? 1))
          const coinPerRow = Number((unitCoin * betCount).toFixed(2))

          const danList = Array.isArray(group?.danList) ? group.danList : null
          const tuoList = Array.isArray(group?.tuoList) ? group.tuoList : null

          const row: BetOrderItem = {
            order_id: `${orderId}(${idx + 1}/${total})`,
            issue: input.issue,
            user_id: input.userId,
            bet_time: betTime,
            coin: coinPerRow,
            bet_count: betCount,
            bet_code,
            status: 'success'
          }
          if (danList && tuoList) {
            row.dan_code = danList.map(toCode).filter(Boolean)
            row.tuo_code = tuoList.map(toCode).filter(Boolean)
          }
          return row
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
      addIssueJackpot: (issue: string, amount: number) => {
        const safeIssue = String(issue ?? '')
        if (!safeIssue) return
        const current = Number(this.issueJackpotMap[safeIssue] ?? 0)
        this.issueJackpotMap[safeIssue] = Number((current + Number(amount ?? 0)).toFixed(2))
      },
      // openCode 結構：openCode[0..5] = 6 正碼（已排序），openCode[6] = 特別號
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
            // 按比例分配：prizePerUnit = tierPool / 所有中獎者下注總額
            // 僅頭獎設有 minAmount 最低保障，二/三獎純比例（避免下全注獲利漏洞）
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
            // 固定獎也按下注倍數發放
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
            const settled: UserBetHistory = {
              orderId: String(current.orderId),
              issue: String(current.issue),
              betTime: Number(current.betTime),
              coin: Number(current.coin),
              betCount: Math.max(1, Number(current.betCount ?? 1)),
              betCode: Array.isArray(current.betCode) ? current.betCode : [],
              openCode: [...openCode],
              matchCount: row.normalCount,
              specialMatch: row.hasSpecial,
              winStatus: row.payout > 0 ? 'win' : 'lose',
              winAmount: row.payout
            }
            if (current.danCode) settled.danCode = current.danCode
            if (current.tuoCode) settled.tuoCode = current.tuoCode
            record.betHistory[idx] = settled
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
      appendBetHistory: (row: BetOrderItem) => {
        if (!row?.user_id) return
        const user = this._get.user(row.user_id)
        const record = this.handle.ensureUserRecord(user)
        const historyItem: UserBetHistory = {
          orderId: String(row.order_id),
          issue: String(row.issue),
          betTime: Number(row.bet_time),
          coin: Number(row.coin ?? 0),
          betCount: Math.max(1, Number(row.bet_count ?? 1)),
          betCode: Array.isArray(row.bet_code) ? row.bet_code : [],
          openCode: [],
          matchCount: 0,
          specialMatch: false,
          winStatus: 'pending',
          winAmount: 0
        }
        if (row.dan_code) historyItem.danCode = row.dan_code
        if (row.tuo_code) historyItem.tuoCode = row.tuo_code
        record.betHistory.push(historyItem)
        if (record.betHistory.length > 5000) {
          record.betHistory = record.betHistory.slice(-4000)
        }
        record.updatedAt = Date.now()
      },
      refreshCurrent: (now = new Date()) => {
        baseRefresh(now)
        this.handle.settleClosedIssueIfNeeded()
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
    Storage.games[LOTTERY['LHC-OF'].key] = this
    console.log('LHC_OF.init.success', this.recordOpenCode)
    LOTTERY_BASE.getOrders(LOTTERY['LHC-OF'].id, LOTTERY['LHC-OF'].key)
  }

  override circle() {
    this.handle.refreshCurrent(new Date())
    this.handle.settleClosedIssueIfNeeded()
  }

  playBets(payload: any, _user: any) {
    console.log('class playBets.payload', _user)

    const amount = Number(payload.amount)
    const userId = String(_user.userId ?? '')
    const beforeCoin = Number(_user.coin ?? 0)
    _user.coin -= amount
    const afterCoin = Number(_user.coin ?? 0)

    const groups = Array.isArray(payload.groups) ? payload.groups : []
    const lhcConfig = this._get.configPlay()
    const issue = this.recordOpenCode[this.currentIndex]?.issue ?? ''
    const orderRows = this.handle.buildOrderRows({ issue, userId, amount, groups })
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

    return {
      orderId: orderRows[0]?.order_id.split('(')[0] ?? '',
      orders: orderRows
    }
  }

  _handle = {
    jackpotBase: () => {
      const random = LOTTERY_BASE.jackpotBase()
      this.jackpotBase = random
      this.jackpotBaseSetAt = Date.now()
      return random
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
