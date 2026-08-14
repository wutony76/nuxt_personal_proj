import { Storage } from './storage'
import { LOTTERY, STATUS_TIME } from '~/config/constants'
import LOTTERY_BASE, { CYCLE_MS, TOTAL_ISSUES_PER_DAY, type OpenCodeRecord } from './lotteryBase'
import { MEMORY } from './base'
import { k3DiceOf, k3SumOf } from '#shared/config/k3'
import { k3OfMatchCount, k3OfPicksOf, K3_OF_PICK_COUNT, K3_OF_PRIZE_TIERS } from '#shared/config/k3-of'
import { judgeK3OgBet } from '#shared/config/k3og'
import { k3OgHasBetCode, k3OgQuotaOf, k3OgTabOddsOf, findK3OgTab } from '#shared/config/k3og/helpers'
import {
  K3_SHARED,
  k3AddIssuePool,
  k3EnsurePoolBase,
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
  /** 賠率制玩法：下注時鎖進注單的賠率（彩池玩法為 0） */
  odds?: number
  /** 賠率制玩法：注碼所屬分頁，結算讀該分頁 rtp 用 */
  tab_id?: number
}

type Group = {
  playTypeName?: string
  playKey?: string
  /** 賠率制玩法的分頁 id（彩池玩法不帶） */
  selectTabId?: number | string
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
  /** tie：賠率制的兩面玩法遇圍骰＝和局，退回本金（同 K3-CD） */
  winStatus: 'pending' | 'win' | 'lose' | 'tie'
  winAmount: number
  jackpotAmount: number
  /** 賠率制玩法：下注時鎖進注單的賠率（彩池玩法為 0，注單列顯示分層名稱） */
  odds?: number
  /** 賠率制玩法：注碼所屬分頁 */
  tabId?: number
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
const K3_OF_QUOTA = { item: { min: 2, max: 10000 }, issue: { max: 500000 } }

/**
 * 彩池玩法的 playKey
 *
 * 官方盤有兩套派彩並存：
 *   xuanhao —— 選 3 個點數，依命中顆數從共用彩池分層分配（K3_OF_PRIZE_TIERS）
 *   其餘     —— k3og 的 6 個賠率玩法（和值／三同號／三不同號／三連號／二同號／二不同號），
 *              賠率由 k3og.ts 依「公平賠率 × 分頁 rtp」推算，下注時鎖進注單
 * 判斷依據就是 playKey，兩條路互不干擾。
 */
const POOL_PLAY_KEY = 'xuanhao'
/** 該筆注單是不是彩池玩法 */
const _isPoolPlay = (playKey?: string) => String(playKey ?? POOL_PLAY_KEY) === POOL_PLAY_KEY

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
    pushClaimable: (userId: string, issue: string, amount: number, openCode: string[]) => void
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
      /**
       * 寫入某期的可領獎金（同一期重複呼叫會累加）
       *
       * 賠率制與彩池兩條結算路都會呼叫 —— 同一期若兩種玩法都中，金額要疊在同一筆上，
       * 玩家才不會看到同一期出現兩列可領。
       */
      pushClaimable: (userId: string, issue: string, amount: number, openCode: string[]) => {
        if (!(amount > 0)) return
        const record = this.handle.ensureUserRecord(this._get.user(userId))
        const idx = record.claimableIssues.findIndex((item) => String(item.issue) === String(issue))
        const old = record.claimableIssues[idx]
        if (idx >= 0 && old) {
          record.claimableIssues[idx] = {
            issue: String(old.issue),
            amount: Number((Number(old.amount ?? 0) + amount).toFixed(2)),
            openCode: [...openCode],
            createdAt: Number(old.createdAt ?? Date.now())
          }
          return
        }
        record.claimableIssues.push({
          issue: String(issue),
          amount: Number(amount.toFixed(2)),
          openCode: [...openCode],
          createdAt: Date.now()
        })
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
          jackpotAmount: 0,
          // 賠率制玩法：下注即鎖賠率，注單列要顯示（彩池玩法為 0）
          odds: Number(row.odds ?? 0),
          tabId: Number(row.tab_id ?? 0)
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
          const playKey = String(group?.playKey || POOL_PLAY_KEY)
          const tabId = Number(group?.selectTabId ?? 0)
          const isPool = _isPoolPlay(playKey)
          // 賠率制玩法讀該分頁的 quota；彩池玩法用伺端的 K3_OF_QUOTA
          const quota = isPool ? K3_OF_QUOTA : k3OgQuotaOf(playKey, tabId)
          if (!isPool && !findK3OgTab(playKey, tabId)) {
            this.handle.rejectBet(`玩法或分頁不存在（${playKey} / ${tabId}）`)
          }
          ;(Array.isArray(group?.playList) ? group.playList : []).forEach((play) => {
            let label = ''
            if (isPool) {
              const picks = k3OfPicksOf(Array.isArray(play?.codes) ? play.codes : [])
              if (!picks) {
                this.handle.rejectBet(`每注需選 ${K3_OF_PICK_COUNT} 個點數（1 ~ 6，可重複）`)
              }
              label = picks!.join(',')
            } else {
              // 賠率制：注碼一律用伺端的設定檔驗，不信任前端送的注數與賠率
              label = String(play?.label ?? play?.num ?? '').trim()
              if (!k3OgHasBetCode(playKey, tabId, label)) {
                this.handle.rejectBet(`「${label || '(空)'}」不在該分頁的注項內`)
              }
            }
            const rawCoin = Number(play?.amount ?? play?.coin ?? input.amount)
            const coin = Number.isFinite(rawCoin) && rawCoin > 0 ? rawCoin : Number(input.amount)
            if (coin < quota.item.min) {
              this.handle.rejectBet(`「${label}」單注最低 ${_money(quota.item.min)}，本次 ${_money(coin)}`)
            }
            if (coin > quota.item.max) {
              this.handle.rejectBet(`「${label}」單注上限 ${_money(quota.item.max)}，本次 ${_money(coin)}`)
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
          const playKey = String(group?.playKey || POOL_PLAY_KEY)
          const tabId = Number(group?.selectTabId ?? 0)
          const isPool = _isPoolPlay(playKey)
          const playList = Array.isArray(group?.playList) ? group.playList : []
          const total = playList.length
          playList.forEach((play, index) => {
            const orderId = this.handle.createOrderId(input.issue)
            const playCoin = Number(play?.amount ?? play?.coin ?? input.amount)
            const coin = Number.isFinite(playCoin) && playCoin > 0 ? playCoin : input.amount
            const base = {
              issue: input.issue,
              user_id: input.userId,
              bet_time: Date.now(),
              coin,
              order_id: `${orderId}(${index + 1}/${total})`,
              status: 'success' as const,
              play_key: playKey,
              play_type_name: playTypeName
            }
            if (isPool) {
              const picks = k3OfPicksOf(Array.isArray(play?.codes) ? play.codes : [])
              if (!picks) return
              // 升冪存檔，讓相同組合的注單長得一樣（方便比對與去重）
              rows.push({ ...base, bet_code: picks.map(String) })
              return
            }
            const label = String(play?.label ?? play?.num ?? '').trim()
            if (!label) return
            // 賠率鎖進注單：之後改 rtp 或設定也不會影響已成立的注單
            rows.push({ ...base, bet_code: [label], odds: k3OgTabOddsOf(playKey, tabId, label), tab_id: tabId })
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
      /**
       * 官方盤結算
       *
       * 兩條路並存，依 playKey 分流：
       *   賠率制玩法（k3og 的 6 個）→ judgeK3OgBet 逐注判定，賠率取注單鎖的值
       *   彩池玩法（xuanhao）      → 依命中顆數分層，從共用獎池按比例分配
       * ⚠️ 滾存（carry）只由彩池玩法那條計算 —— 賠率制的注單不吃池、也不影響滾存。
       */
      settleIssuePrize: (issue: string, openCode: string[]) => {
        const safeIssue = String(issue ?? '')
        if (!safeIssue) return
        const codes = Array.isArray(openCode) ? openCode : []
        const allOrders = (this._get.orders().get.orders.currentIssue(safeIssue) ?? []) as Array<{
          userId: string
          orderId: string
          coin: number
          betCode: string[]
          playKey?: string
          tabId?: number
          odds?: number
        }>

        // ── 賠率制玩法：逐注判定 ──
        const oddsOrders = allOrders.filter((row) => !_isPoolPlay(row.playKey))
        const oddsPayoutByUser = new Map<string, number>()
        oddsOrders.forEach((row) => {
          const coin = Number(row.coin ?? 0)
          const betCode = String((Array.isArray(row.betCode) ? row.betCode : [])[0] ?? '')
          const lockedOdds = Number(row.odds ?? 0)
          const judged = judgeK3OgBet(betCode, codes, coin, lockedOdds)
          // 無法辨識的注碼視為和局退還本金，不吞玩家注金
          const status = judged?.status ?? 'tie'
          const odds = judged?.odds ?? lockedOdds
          const payout = judged?.payout ?? coin

          const record = this.handle.ensureUserRecord(this._get.user(row.userId))
          const idx = record.betHistory.findIndex((item) => String(item.orderId) === String(row.orderId))
          const current = record.betHistory[idx]
          if (idx >= 0 && current) {
            record.betHistory[idx] = {
              ...current,
              openCode: [...codes],
              matchCount: status === 'win' ? 1 : 0,
              tierName: status === 'win' ? '中獎' : status === 'tie' ? '和局' : '',
              winStatus: status,
              winAmount: payout,
              odds
            }
          }
          if (payout > 0) {
            oddsPayoutByUser.set(
              row.userId,
              Number((Number(oddsPayoutByUser.get(row.userId) ?? 0) + payout).toFixed(2))
            )
          }
        })
        oddsPayoutByUser.forEach((amount, userId) => {
          this.handle.pushClaimable(userId, safeIssue, amount, codes)
        })

        // ── 彩池玩法：依命中顆數分層 ──
        const issueOrders = allOrders.filter((row) => _isPoolPlay(row.playKey))
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
          this.handle.pushClaimable(userId, safeIssue, amount, codes)
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
        // 沒有池底（或已被吃到低於頭獎保障門檻）就重骰，兩個盤口共用同一份
        k3EnsurePoolBase()
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
