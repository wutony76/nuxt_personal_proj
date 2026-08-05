import { Storage } from './storage'
import { LOTTERY, STATUS_TIME } from '~/config/constants'
import LOTTERY_BASE from './lotteryBase'
import { MEMORY } from './base'
import { creditTemaOddsOf, judgeCreditTemaBet, shengxiaoAll, type CreditBetResult } from '#shared/config/6hc-cd'

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
  select_tab_id: number
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
  selectTabId?: number | string
  playList?: Array<{
    playId?: number | string
    selectTabId?: number | string
    num?: number | string
    label?: string | number
    amount?: number | string
    coin?: number | string
  }>
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
  /** 信用盤：tie = 和局退還本金（特碼兩面開出 49） */
  winStatus: 'pending' | 'win' | 'lose' | 'tie'
  /** 派彩金額（含本金） */
  winAmount: number
  /** 該注賠率（含本金），未結算為 0 */
  odds: number
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

// 取分頁 id（tabId）：優先每注帶的 selectTabId，其次群組層級，最後由 playId 前綴（如 2000-001）推回
function _resolveTabId(play?: { playId?: number | string; selectTabId?: number | string }, group?: { selectTabId?: number | string }): number {
  const candidates = [
    play?.selectTabId,
    group?.selectTabId,
    String(play?.playId ?? '').split('-')[0]
  ]
  for (const candidate of candidates) {
    const id = Number(candidate)
    if (Number.isFinite(id) && id > 0) return id
  }
  return 0
}

export default class LHC_CD extends LOTTERY_BASE {
  issueJackpotMap: Record<string, number>
  issueSettledMap: Record<string, boolean>
  carryJackpot: number
  jackpotBase: number
  jackpotBaseSetAt: number
  animal: string
  _animalMapCache: { animal: string; map: Record<string, string> } | null

  declare _get: LOTTERY_BASE['_get'] & {
    user: (userId: string) => UserStoreLike
    userRecord: (userId: string) => UserRecord
  }
  declare handle: LOTTERY_BASE['handle'] & {
    animalByNumber: () => Record<string, string>
    openCodePlay: (openCode: string[]) => Array<Record<string, unknown>>
    buildOrderRows: (input: { issue: string; userId: string; amount: number; groups: Group[] }) => BetOrderRow[]
    addIssueJackpot: (issue: string, amount: number) => void
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
    roadPlays: () => Array<Record<string, unknown>>
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
    this.animal = MEMORY.animal
    this._animalMapCache = null

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
      // 依當年生肖建立「號碼 → 生肖」對照表（以 animal 為 key 快取）
      animalByNumber: () => {
        if (this._animalMapCache?.animal === this.animal) return this._animalMapCache.map
        const table = shengxiaoAll(this.animal)
        const map: Record<string, string> = {}
        Object.entries(table).forEach(([sx, nums]) => {
          nums.forEach((n) => { map[String(n).padStart(2, '0')] = sx })
        })
        this._animalMapCache = { animal: this.animal, map }
        return map
      },
      openCodePlay: (openCode: string[]) => {
        const animalMap = this.handle.animalByNumber()
        return openCode
          .map((code) => {
            const num = Number(code)
            if (!Number.isFinite(num)) return null
            const play = Storage.get.lotteryPlay(LOTTERY['6HC'].id, num)
            if (!play) return null
            const key = String(code).padStart(2, '0')
            return { ...(play as Record<string, unknown>), animal: animalMap[key] ?? '' } as Record<string, unknown>
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
            // 每注各自金額（fallback 到整體 amount）
            const playCoin = Number(play?.amount ?? play?.coin ?? input.amount)
            rows.push({
              issue: input.issue,
              user_id: input.userId,
              select_tab_id: _resolveTabId(play, group),
              bet_time: Date.now(),
              coin: Number.isFinite(playCoin) && playCoin > 0 ? playCoin : input.amount,
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
          select_tab_id: 0,
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
      // 信用盤結算：每注獨立、以特別號按賠率派彩（非官方盤的獎池分層）
      settleIssuePrize: (issue: string, openCode: string[]) => {
        const safeIssue = String(issue ?? '')
        if (!safeIssue) return
        const codes = Array.isArray(openCode) ? openCode : []
        const specialCode = codes[6] ?? ''
        const _orders = this._get.orders()
        const issueOrders = (_orders.get.orders.currentIssue(safeIssue) ?? []) as Array<{
          issue: string
          userId: string
          orderId: string
          coin: number
          betCode: string[]
        }>

        const payoutByUser = new Map<string, number>()
        issueOrders.forEach((row) => {
          const coin = Number(row.coin ?? 0)
          const betCode = Array.isArray(row.betCode) ? String(row.betCode[0] ?? '') : ''
          const judged = judgeCreditTemaBet(betCode, specialCode, coin)
          // 無法辨識的注項（尚未支援的玩法）視為和局退還本金，避免吞掉玩家注金
          const result: CreditBetResult = judged?.result ?? 'tie'
          const payout = judged?.payout ?? coin
          const odds = judged?.odds ?? 0

          const user = this._get.user(row.userId)
          const record = this.handle.ensureUserRecord(user)
          const idx = record.betHistory.findIndex((item) => String(item.orderId) === String(row.orderId))
          if (idx >= 0) {
            const current = record.betHistory[idx]
            if (current) {
              record.betHistory[idx] = {
                orderId: String(current.orderId),
                issue: String(current.issue),
                betTime: Number(current.betTime),
                coin: Number(current.coin),
                betCode: Array.isArray(current.betCode) ? current.betCode : [],
                openCode: [...codes],
                matchCount: result === 'win' ? 1 : 0,
                specialMatch: result === 'win' && judged?.kind === 'number',
                winStatus: result,
                winAmount: payout,
                odds
              }
            }
          }

          if (payout > 0) {
            const prev = Number(payoutByUser.get(row.userId) ?? 0)
            payoutByUser.set(row.userId, Number((prev + payout).toFixed(2)))
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

        // 信用盤以賠率派彩、不從獎池扣款，獎池僅作展示用：
        // 當期投注額結算後滾入累積滾存，Header 的「總獎金 / 預估頭獎」才會持續累積
        const issuePool = Number(this.issueJackpotMap[safeIssue] ?? 0)
        this.carryJackpot = Number((Number(this.carryJackpot ?? 0) + issuePool).toFixed(2))
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
          winAmount: 0,
          // 下注時即記錄該注賠率，供下注紀錄顯示（未支援的玩法為 0）
          odds: creditTemaOddsOf(String(row.bet_code?.[0] ?? ''))
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
      // 球號分析（路珠）：49 顆球 + 相隔期數 / 攪出次數，並帶上當年生肖
      roadPlays: () => {
        this.handle.refreshCurrent(new Date())
        const animalMap = this.handle.animalByNumber()
        return this.handle.buildRoadPlays().map((play) => {
          const key = String(play?.num ?? '').padStart(2, '0')
          return { ...play, animal: animalMap[key] ?? '' }
        })
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

  override circle() {
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
        tabId: row.select_tab_id,
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
