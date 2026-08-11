import { Storage } from './storage'
import { LOTTERY, STATUS_TIME } from '~/config/constants'
import LOTTERY_BASE, { CYCLE_MS, TOTAL_ISSUES_PER_DAY, type OpenCodeRecord } from './lotteryBase'
import { MEMORY } from './base'
import { k3DiceOf, k3SumOf } from '#shared/config/k3'
import { k3OfMatchCount, k3OfPicksOf, K3_OF_PICK_COUNT, K3_OF_PRIZE_TIERS } from '#shared/config/k3-of'
import {
  K3_SHARED,
  k3AddIssuePool,
  k3DistributablePool,
  k3EnsureDraw,
  k3IssuePool,
  k3RandomOpenCode
} from './k3Shared'

/**
 * 快3 官方盤（K3-OF）
 *
 * ── 與 K3-CD 的共用關係 ─────────────────────────────────
 *   開獎號：兩邊的 recordOpenCode 都指向 k3Shared 的同一個陣列（prdOpenCode 已覆寫），
 *           所以同一期的期別、骰子點數、倒數完全一致。
 *   彩池  ：抽水一律進 K3_SHARED.pool，兩個盤口共同養同一個池；
 *           派彩後未發放的部分寫回 K3_SHARED.pool.carry 滾存至下期。
 *   ⚠️ 因為彩池共用，K3-OF 的結算會動到 K3-CD 也看得到的 carry ——
 *      這是刻意的（使用者要求共用），不是 bug。
 *
 * ── 派彩方式：獎池分層（同 6hc-of）─────────────────────
 *   一注 = 選 3 個點數（可重複），依命中顆數分層：
 *     3 顆 → 頭獎（池 70%，每單位下注有最低保障）
 *     2 顆 → 二獎（池 20%，純比例）
 *     1 顆 → 三獎（固定倍數）
 *   未產生中獎者的 pool 層，該層整塊滾存至下期。
 */

type BetOrderItem = {
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
  playList?: Array<{
    playId?: number | string
    num?: number | string
    label?: string | number
    amount?: number | string
    coin?: number | string
    /** 官方盤一注帶 3 個點數 */
    codes?: Array<number | string>
  }>
}

type PlayBetsPayload = { amount?: number; groups?: Group[] }

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
  /** 命中顆數（0 ~ 3） */
  matchCount: number
  /** 命中分層名稱（頭獎／二獎／三獎），未中為空字串 */
  tierName: string
  winStatus: 'pending' | 'win' | 'lose'
  winAmount: number
  jackpotAmount: number
}
type UserClaimableIssue = { issue: string; amount: number; openCode: string[]; createdAt: number }
type UserRecord = {
  balanceChanges: UserBalanceChange[]
  betHistory: UserBetHistory[]
  claimableIssues: UserClaimableIssue[]
  updatedAt: number
}
type UserStoreLike = { userId?: string; coin?: number; k3OfRecord?: UserRecord }

/** 抽水比例：官方盤把較高比例撥入獎池（獎金全部來自池，非莊家賠付） */
const K3_OF_RAKE_RATIO = 0.6

/** 單注限額（官方盤注項固定為「選 3 個點數」，不像信用盤有分頁差異） */
const K3_OF_QUOTA = { item: { min: 10, max: 5000 }, issue: { max: 500000 } }

export default class K3_OF extends LOTTERY_BASE {
  issueSettledMap: Record<string, boolean>

  declare _get: LOTTERY_BASE['_get'] & {
    user: (userId: string) => UserStoreLike
    userRecord: (userId: string) => UserRecord
  }
  declare handle: LOTTERY_BASE['handle'] & {
    buildDayRecords: (now: Date) => OpenCodeRecord[]
    ensureUserRecord: (user: UserStoreLike) => UserRecord
    pushBalanceChange: (userId: string, payload: Omit<UserBalanceChange, 'id' | 'createdAt'>) => void
    appendBetHistory: (row: BetOrderItem) => void
    rejectBet: (message: string) => never
    validateBetQuota: (input: { issue: string; userId: string; amount: number; groups: Group[] }) => void
    buildOrderRows: (input: { issue: string; userId: string; amount: number; groups: Group[] }) => BetOrderItem[]
    settleClosedIssueIfNeeded: () => void
    settleIssuePrize: (issue: string, openCode: string[]) => void
  }
  declare get: LOTTERY_BASE['get'] & {
    poolState: () => { issue: string; base: number; carry: number; issuePool: number; distributable: number }
    userInfo: (userId: string) => { currentBets: number; totalBets: number; analysis: string }
    userDialogRecord: (userId: string) => {
      balanceChanges: UserBalanceChange[]
      betHistory: UserBetHistory[]
      claimableIssues: UserClaimableIssue[]
    }
    prizeTiers: () => typeof K3_OF_PRIZE_TIERS
  }

  constructor() {
    super(LOTTERY['K3-OF'].key, LOTTERY['K3-OF'].id)
    this.issueSettledMap = {}

    Object.assign(this._get, {
      user: (userId: string) => Storage.get.user(userId) as UserStoreLike,
      userRecord: (userId: string) => this.handle.ensureUserRecord(this._get.user(userId))
    })

    Object.assign(this.handle, {
      randomOpenCode: () => k3RandomOpenCode(),
      /**
       * 與 K3-CD 完全相同的覆寫：期表交給 k3Shared
       * 先啟動的 class 產生、後啟動的直接沿用同一個陣列參照
       */
      prdOpenCode: (now = new Date()) => {
        const dateKey = this.timer.formatDateKey(now)
        this.recordOpenCode = k3EnsureDraw(dateKey, () => this.handle.buildDayRecords(now))
        this.currentIndex = 0
        this.currentStatus = STATUS_TIME.PREPARE
      },
      buildDayRecords: (now: Date): OpenCodeRecord[] => {
        const dayStart = this.timer.getStartOfDay(now).getTime()
        const dateKey = this.timer.formatDateKey(now)
        const records: OpenCodeRecord[] = []
        for (let i = 0; i < TOTAL_ISSUES_PER_DAY; i++) {
          const startAt = dayStart + i * CYCLE_MS
          records.push({
            issue: `${dateKey}${String(i + 1).padStart(3, '0')}`,
            openCode: k3RandomOpenCode(),
            time: { start: new Date(startAt).toISOString(), end: new Date(startAt + CYCLE_MS).toISOString() },
            startAt,
            endAt: startAt + CYCLE_MS
          })
        }
        return records
      },
      openCodePlay: (openCode: string[]) => {
        const dice = k3DiceOf(openCode)
        if (!dice) return []
        return dice.map((num, idx) => ({ num, label: String(num), index: idx }))
      },
      ensureUserRecord: (user: UserStoreLike) => {
        // 與 K3-CD（k3Record）、6hc（record）分開存，三邊注單紀錄互不干擾
        if (!user.k3OfRecord) {
          user.k3OfRecord = { balanceChanges: [], betHistory: [], claimableIssues: [], updatedAt: Date.now() }
        }
        if (!Array.isArray(user.k3OfRecord.balanceChanges)) user.k3OfRecord.balanceChanges = []
        if (!Array.isArray(user.k3OfRecord.betHistory)) user.k3OfRecord.betHistory = []
        if (!Array.isArray(user.k3OfRecord.claimableIssues)) user.k3OfRecord.claimableIssues = []
        user.k3OfRecord.updatedAt = Date.now()
        return user.k3OfRecord
      },
      pushBalanceChange: (userId: string, payload: Omit<UserBalanceChange, 'id' | 'createdAt'>) => {
        if (!userId) return
        const record = this.handle.ensureUserRecord(this._get.user(userId))
        record.balanceChanges.push({
          id: `${payload.issue}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
          createdAt: Date.now(),
          ...payload
        })
        if (record.balanceChanges.length > 5000) record.balanceChanges = record.balanceChanges.slice(-4000)
      },
      appendBetHistory: (row: BetOrderItem) => {
        const record = this.handle.ensureUserRecord(this._get.user(row.user_id))
        record.betHistory.push({
          orderId: String(row.order_id),
          issue: String(row.issue),
          betTime: Number(row.bet_time),
          coin: Number(row.coin ?? 0),
          betCode: Array.isArray(row.bet_code) ? row.bet_code : [],
          openCode: [],
          matchCount: 0,
          tierName: '',
          winStatus: 'pending',
          winAmount: 0,
          jackpotAmount: 0
        })
        if (record.betHistory.length > 5000) record.betHistory = record.betHistory.slice(-4000)
      },
      rejectBet: (message: string): never => {
        throw createError({ statusCode: 400, statusMessage: message, message })
      },
      /**
       * 注碼與限額驗證：一注必須是 3 個 1~6 的點數
       * 伺端不信任前端送的注數，每一注都在這裡獨立驗證
       */
      validateBetQuota: (input: { issue: string; userId: string; amount: number; groups: Group[] }) => {
        const _money = (value: number) => Number(value).toLocaleString('zh-TW')
        let newCoin = 0
        ;(Array.isArray(input.groups) ? input.groups : []).forEach((group) => {
          ;(Array.isArray(group?.playList) ? group.playList : []).forEach((play) => {
            const picks = k3OfPicksOf(Array.isArray(play?.codes) ? play.codes : [])
            if (!picks) {
              this.handle.rejectBet(`每注需選 ${K3_OF_PICK_COUNT} 個點數（1 ~ 6，可重複）`)
            }
            const rawCoin = Number(play?.amount ?? play?.coin ?? input.amount)
            const coin = Number.isFinite(rawCoin) && rawCoin > 0 ? rawCoin : Number(input.amount)
            if (coin < K3_OF_QUOTA.item.min) {
              this.handle.rejectBet(`「${picks.join(',')}」單注最低 ${_money(K3_OF_QUOTA.item.min)}，本次 ${_money(coin)}`)
            }
            if (coin > K3_OF_QUOTA.item.max) {
              this.handle.rejectBet(`「${picks.join(',')}」單注上限 ${_money(K3_OF_QUOTA.item.max)}，本次 ${_money(coin)}`)
            }
            newCoin += coin
          })
        })
        if (K3_OF_QUOTA.issue.max > 0) {
          const orders = this._get.orders() as unknown as {
            get: { issueTabCoin: (issue: string, userId: string, tabId: number) => number }
          }
          const used = Number(orders?.get?.issueTabCoin?.(input.issue, input.userId, this.id) ?? 0)
          if (used + newCoin > K3_OF_QUOTA.issue.max) {
            this.handle.rejectBet(
              `單期投注上限 ${_money(K3_OF_QUOTA.issue.max)}，本期已投注 ${_money(used)}、本次 ${_money(newCoin)}`
            )
          }
        }
      },
      buildOrderRows: (input: { issue: string; userId: string; amount: number; groups: Group[] }): BetOrderItem[] => {
        const rows: BetOrderItem[] = []
        ;(Array.isArray(input.groups) ? input.groups : []).forEach((group) => {
          const playTypeName = String(group?.playTypeName || '選號')
          const playKey = String(group?.playKey || 'xuanhao')
          const playList = Array.isArray(group?.playList) ? group.playList : []
          const total = playList.length
          playList.forEach((play, index) => {
            const picks = k3OfPicksOf(Array.isArray(play?.codes) ? play.codes : [])
            if (!picks) return
            const orderId = this.handle.createOrderId(input.issue)
            const playCoin = Number(play?.amount ?? play?.coin ?? input.amount)
            rows.push({
              issue: input.issue,
              user_id: input.userId,
              bet_time: Date.now(),
              coin: Number.isFinite(playCoin) && playCoin > 0 ? playCoin : input.amount,
              order_id: `${orderId}(${index + 1}/${total})`,
              status: 'success',
              // 升冪存檔，讓相同組合的注單長得一樣（方便比對與去重）
              bet_code: picks.map(String),
              play_key: playKey,
              play_type_name: playTypeName
            })
          })
        })
        return rows
      },
      settleClosedIssueIfNeeded: () => {
        const maxSettleIndex = this.currentStatus === STATUS_TIME.OPENED
          ? this.currentIndex
          : this.currentIndex - 1
        if (maxSettleIndex < 0) return
        for (let i = 0; i <= maxSettleIndex; i++) {
          const record = this.recordOpenCode[i]
          if (!record?.issue) continue
          if (this.issueSettledMap[record.issue]) continue
          this.handle.settleIssuePrize(record.issue, record.openCode)
          this.issueSettledMap[record.issue] = true
        }
      },
      /** 官方盤結算：依命中顆數分層，從共用獎池按比例分配 */
      settleIssuePrize: (issue: string, openCode: string[]) => {
        const safeIssue = String(issue ?? '')
        if (!safeIssue) return
        const codes = Array.isArray(openCode) ? openCode : []
        const issueOrders = (this._get.orders().get.orders.currentIssue(safeIssue) ?? []) as Array<{
          userId: string
          orderId: string
          coin: number
          betCode: string[]
        }>

        // 可發放獎池 = 該期抽水 + 累積滾存（與 K3-CD 共用同一個池）
        const totalPool = k3DistributablePool(safeIssue)
        const rows = issueOrders.map((row) => ({
          ...row,
          matchCount: k3OfMatchCount(row.betCode, codes) ?? 0,
          payout: 0,
          tierName: ''
        }))

        let carryNext = 0
        K3_OF_PRIZE_TIERS.forEach((tier) => {
          const winners = rows.filter((row) => row.matchCount === tier.match)
          if (tier.type === 'pool') {
            const tierPool = Number((totalPool * tier.ratio).toFixed(2))
            if (winners.length === 0) {
              // 該層沒人中 → 整塊滾存至下期
              carryNext = Number((carryNext + tierPool).toFixed(2))
              return
            }
            // 按下注額比例分配；僅頭獎設 minAmount 最低保障（避免下全注套利）
            const totalWinnerBets = Number(winners.reduce((sum, row) => sum + Number(row.coin ?? 0), 0).toFixed(2))
            const naturalPerUnit = totalWinnerBets > 0 ? tierPool / totalWinnerBets : 0
            const prizePerUnit = tier.minAmount !== undefined
              ? Math.max(naturalPerUnit, tier.minAmount)
              : naturalPerUnit
            winners.forEach((row) => {
              row.payout = Number((row.payout + Number((prizePerUnit * Number(row.coin ?? 1)).toFixed(2))).toFixed(2))
              row.tierName = tier.name
            })
          } else {
            winners.forEach((row) => {
              row.payout = Number((row.payout + Number((tier.amount * Number(row.coin ?? 1)).toFixed(2))).toFixed(2))
              row.tierName = tier.name
            })
          }
        })

        const payoutByUser = new Map<string, number>()
        rows.forEach((row) => {
          const record = this.handle.ensureUserRecord(this._get.user(row.userId))
          const idx = record.betHistory.findIndex((item) => String(item.orderId) === String(row.orderId))
          const current = record.betHistory[idx]
          if (idx >= 0 && current) {
            record.betHistory[idx] = {
              ...current,
              openCode: [...codes],
              matchCount: row.matchCount,
              tierName: row.tierName,
              winStatus: row.payout > 0 ? 'win' : 'lose',
              winAmount: row.payout
            }
          }
          if (row.payout > 0) {
            payoutByUser.set(row.userId, Number((Number(payoutByUser.get(row.userId) ?? 0) + row.payout).toFixed(2)))
          }
        })

        payoutByUser.forEach((amount, userId) => {
          if (amount <= 0) return
          const record = this.handle.ensureUserRecord(this._get.user(userId))
          const issueIdx = record.claimableIssues.findIndex((item) => String(item.issue) === safeIssue)
          const old = record.claimableIssues[issueIdx]
          if (issueIdx >= 0 && old) {
            record.claimableIssues[issueIdx] = {
              issue: String(old.issue),
              amount: Number((Number(old.amount ?? 0) + amount).toFixed(2)),
              openCode: [...codes],
              createdAt: Number(old.createdAt ?? Date.now())
            }
          } else {
            record.claimableIssues.push({
              issue: safeIssue,
              amount: Number(amount.toFixed(2)),
              openCode: [...codes],
              createdAt: Date.now()
            })
          }
        })

        // 未派出的 pool 層滾存至下期；該期抽水已用掉，歸零
        // ⚠️ carry 是與 K3-CD 共用的，這裡寫回去兩邊都會看到
        K3_SHARED.pool.carry = carryNext
        K3_SHARED.pool.issueMap[safeIssue] = 0
      }
    })

    Object.assign(this.get, {
      /**
       * 投注統計（供 /api/lottery/userInfo 使用）
       * ⚠️ 那支路由是無條件呼叫 gameClass.get.userInfo()，
       *    沒實作就會 TypeError → 500，新增彩種一定要補這支
       */
      userInfo: (userId: string) => {
        const orders = this._get.orders()
        const issue = this.recordOpenCode[this.currentIndex]?.issue ?? ''
        const currentBets = Number(orders.get.members.issue(issue, userId) ?? 0)
        const totalBets = Number(orders.get.members.user(userId) ?? 0)
        // 與上一期比較的投注變化（文案格式對齊 6hc）
        const prevIssue = String(Number(issue) - 1)
        const prevBets = Number(orders.get.members.issue(prevIssue, userId) ?? 0)
        let analysis = '尚未投注'
        if (prevBets === 0 && currentBets > 0) analysis = '比上期多了 100%'
        else if (prevBets > 0) {
          const percent = ((currentBets - prevBets) / prevBets) * 100
          analysis = percent > 0
            ? `比上期多了 ${percent.toFixed(2)}%`
            : percent < 0 ? `比上期少了 ${Math.abs(percent).toFixed(2)}%` : '與上一期投注相同'
        }
        return { currentBets, totalBets, analysis }
      },
      poolState: () => {
        const issue = this._get.latestIssue()
        return {
          issue,
          base: K3_SHARED.pool.base,
          carry: K3_SHARED.pool.carry,
          issuePool: k3IssuePool(issue),
          distributable: k3DistributablePool(issue)
        }
      },
      userDialogRecord: (userId: string) => {
        const record = this.handle.ensureUserRecord(this._get.user(userId))
        return {
          balanceChanges: [...record.balanceChanges].reverse(),
          betHistory: [...record.betHistory].reverse(),
          claimableIssues: [...record.claimableIssues]
        }
      },
      prizeTiers: () => K3_OF_PRIZE_TIERS
    })

    this.init()
  }

  init() {
    console.log('TTT---RUN.K3.官方')
    this.handle.prdOpenCode()
    Storage.games[this.key] = this
    LOTTERY_BASE.getOrders(this.id, this.key)
  }

  override circle() {
    this.handle.refreshCurrent(MEMORY.now)
    this.handle.settleClosedIssueIfNeeded()
  }

  playBets(payload: PlayBetsPayload, user: UserStoreLike) {
    this.handle.refreshCurrent(new Date())
    if (this.currentStatus !== STATUS_TIME.OPEN) {
      const _msg = `目前為「${this.currentStatus}」，不受理投注`
      throw createError({ statusCode: 400, statusMessage: _msg, message: _msg })
    }

    const amount = Number(payload?.amount ?? 0)
    const userId = String(user?.userId ?? '')
    const issue = this.recordOpenCode[this.currentIndex]?.issue ?? this._get.latestIssue()
    const groups = Array.isArray(payload?.groups) ? payload.groups : []

    this.handle.validateBetQuota({ issue, userId, amount, groups })

    const beforeCoin = Number(user?.coin ?? 0)
    user.coin = Number((beforeCoin - Math.abs(amount)).toFixed(2))
    const afterCoin = Number(user?.coin ?? 0)

    const rows = this.handle.buildOrderRows({ issue, userId, amount, groups })
    // 官方盤的獎金全部來自獎池，故抽水比例遠高於信用盤
    k3AddIssuePool(issue, Number((amount * K3_OF_RAKE_RATIO).toFixed(2)))
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
        tabId: this.id,
        betCode: row.bet_code,
        playKey: row.play_key
      })
      this.handle.appendBetHistory(row)
    })

    return {
      orderId: rows[0]?.order_id ? String(rows[0].order_id).split('(')[0] : '',
      orders: rows
    }
  }

  actions = {
    claimOneIssue: (userId: string) => {
      const user = this._get.user(userId)
      const record = this.handle.ensureUserRecord(user)
      const target = [...record.claimableIssues]
        .filter((item) => Number(item.amount) > 0)
        .sort((a, b) => String(a.issue).localeCompare(String(b.issue)))[0]
      if (!target) {
        return { ok: false, message: '目前沒有可領取獎金', issue: '', amount: 0, coin: Number(user.coin ?? 0) }
      }
      const before = Number(user.coin ?? 0)
      const gain = Number(Number(target.amount ?? 0).toFixed(2))
      user.coin = Number((before + gain).toFixed(2))
      record.claimableIssues = record.claimableIssues.filter((item) => String(item.issue) !== String(target.issue))
      this.handle.pushBalanceChange(userId, {
        issue: String(target.issue),
        type: 'claim',
        amount: gain,
        before,
        after: Number(user.coin ?? 0),
        note: `領取第${target.issue}期獎金`
      })
      return { ok: true, message: '領取成功', issue: String(target.issue), amount: gain, coin: Number(user.coin ?? 0) }
    }
  }

  analysis = {
    /** 該期開獎的和值（官方盤看板也會顯示） */
    sumOf: (openCode: string[]) => {
      const dice = k3DiceOf(openCode)
      return dice ? k3SumOf(dice) : 0
    }
  }
}
