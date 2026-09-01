import { Storage } from '../../../storage'
import { LOTTERY, STATUS_TIME } from '~/config/constants'
import LOTTERY_BASE, { CYCLE_MS, TOTAL_ISSUES_PER_DAY, type OpenCodeRecord } from './base'
import { recordFloorOverpay } from './poolAudit'
// ⚠️ 別跟同層的 ./base 搞混：這支是 services/base.ts（BaseClass 與 MEMORY 時鐘），
//    ./base 才是本層的彩票基底（期表／狀態機／訂單）
import { MEMORY } from '../../../base'
import { judgeX5OfBet } from '#shared/config/x5-of'
import { x5OfMatchCount, X5_OF_PRIZE_TIERS } from '#shared/config/x5-of'
import { x5JackpotHit, x5JackpotLabel, X5_JACKPOT_SETTINGS } from '#shared/config/x5-cd'
import { type JackpotRow } from '#shared/config/jackpot'
import { x5NumbersOf, x5SumOf } from '#shared/config/x5'
import {
  findX5OfTab,
  x5OfHasBetCode,
  x5OfIsPoolTab,
  x5OfJackpotWeightOf,
  x5OfQuotaOf,
  x5OfTabOddsOf
} from '#shared/config/x5of/helpers'
import {
  X5_SHARED,
  x5AddIssueJackpot,
  x5AddIssuePool,
  x5DistributablePool,
  x5EnsureDraw,
  x5EnsurePoolBase,
  x5IssuePool,
  x5JackpotState,
  x5RandomOpenCode,
  x5RegisterJackpotBoard,
  x5SettleJackpotIfReady,
  x5SubmitJackpotRows
} from './x5Shared'

/**
 * 11選5 官方盤（X5-OF）
 *
 * ── 與 X5-CD 的共用關係 ────────────────────────────────
 *   開獎號與彩池都放在 x5Shared 的 module 級單例：
 *   prdOpenCode 覆寫後，先啟動的那個 class 產生當日期表，後啟動的直接拿到同一個陣列參照。
 *   抽水一律進 X5_SHARED.pool，兩個盤口共同養同一個彩池。
 *
 * ── 兩條結算路並存 ──────────────────────────────────────
 *   賠率分頁（52 個）→ judgeX5OfBet 逐注判定，賠率取注單鎖的值（莊家賠付）
 *   彩池分頁（後三直選的複式 111101410 與單式 111101411）
 *                    → 依命中位數分層，從共用獎池按比例分配（X5_OF_PRIZE_TIERS）
 *   ⚠️ 滾存（carry）只由彩池那條計算 —— 賠率分頁的注單不吃池、也不影響滾存。
 *   ⚠️ 因為彩池共用，X5-OF 的結算會動到 X5-CD 也看得到的 carry。
 *
 * ── 爆池（兩個盤口共吃一池，狀態在 x5Shared.ts）──────────
 *   官方盤的注單也參與爆池分配。本 class 只負責：判定自己的注單 →
 *   x5SubmitJackpotRows('of') → 把 source === 'of' 的分配結果寫回自己的 record。
 *   ⚠️ 爆池與 X5_SHARED.pool 是兩個池，各自抽水、互不相吃。
 *
 * ── 與 SSC-OF 的差異 ────────────────────────────────────
 *   1. 號碼 01 ~ 11 不重複，注碼兩位一組（後三直選010203）
 *   2. 多了「任選 N 中 M」與「膽拖」；單式分頁的注碼由 conf 列舉給玩家選，不是文字輸入
 *   3. 彩池分頁有**兩個**（後三直選的複式與單式，注碼形狀相同），故用 x5OfIsPoolTab 判斷而非單一 tabId
 */

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
  /** 下注時鎖定的賠率（含本金）；彩池分頁為 0（那邊走分層） */
  odds: number
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
  matchCount: number
  /** 彩池分頁：命中分層名稱（頭獎／二獎／三獎）；賠率分頁：中獎／和局 */
  tierName: string
  /** tie：官方盤沒有真正的和局，僅在注碼無法辨識時退回本金 */
  winStatus: 'pending' | 'win' | 'lose' | 'tie'
  winAmount: number
  jackpotAmount: number
  /** 下注時鎖進注單的賠率 */
  odds: number
  /** 注碼所屬分頁 */
  tabId: number
}
type UserClaimableIssue = { issue: string; amount: number; openCode: string[]; createdAt: number }
type UserRecord = {
  balanceChanges: UserBalanceChange[]
  betHistory: UserBetHistory[]
  claimableIssues: UserClaimableIssue[]
  updatedAt: number
}
type UserStoreLike = { userId?: string; coin?: number; x5OfRecord?: UserRecord }

/**
 * 抽水比例：官方盤把較高比例撥入獎池（彩池分頁的獎金全部來自池，非莊家賠付）
 * ⚠️ 數值比照 SSC-OF / PK10-OF —— 那邊同樣只有一個玩法吃池、其餘走固定賠率。
 */
const X5_OF_RAKE_RATIO = 0.6

/** 該筆注單是不是彩池分頁（結算時據此分流到兩條路） */
const _isPoolRow = (playKey?: string, tabId?: number | string) => x5OfIsPoolTab(playKey, tabId)

/** 取分頁 id：優先每注帶的 selectTabId，其次群組層級，最後由 playId 前綴推回 */
function _resolveTabId(
  play?: { playId?: number | string; selectTabId?: number | string },
  group?: { selectTabId?: number | string }
): number {
  const candidates = [play?.selectTabId, group?.selectTabId, String(play?.playId ?? '').split('-')[0]]
  for (const candidate of candidates) {
    const id = Number(candidate)
    if (Number.isFinite(id) && id > 0) return id
  }
  return 0
}

/** 取一注的注碼（官方盤的注碼一律是字串：後三直選010203、任選三中三010203、第一球07…） */
function _resolveBetCode(play?: { num?: number | string; label?: string | number }): string {
  const label = String(play?.label ?? '').trim()
  if (label) return label
  return String(play?.num ?? '').trim()
}

export default class X5_OF extends LOTTERY_BASE {
  issueSettledMap: Record<string, boolean>

  declare _get: LOTTERY_BASE['_get'] & {
    user: (userId: string) => UserStoreLike
    userRecord: (userId: string) => UserRecord
  }
  declare handle: LOTTERY_BASE['handle'] & {
    buildDayRecords: (now: Date) => OpenCodeRecord[]
    ensureUserRecord: (user: UserStoreLike) => UserRecord
    pushBalanceChange: (userId: string, payload: Omit<UserBalanceChange, 'id' | 'createdAt'>) => void
    appendBetHistory: (row: BetOrderRow) => void
    rejectBet: (message: string) => never
    validateBetQuota: (input: { issue: string; userId: string; amount: number; groups: Group[] }) => void
    buildOrderRows: (input: { issue: string; userId: string; amount: number; groups: Group[] }) => BetOrderRow[]
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
    sumOf: (openCode: string[]) => number
    prizeTiers: () => typeof X5_OF_PRIZE_TIERS
    creditJackpot: () => ReturnType<typeof x5JackpotState>
  }

  constructor() {
    super(LOTTERY['X5-OF'].key, LOTTERY['X5-OF'].id)
    this.issueSettledMap = {}
    // 官方盤的注單也參與爆池分配（兩個盤口共吃一池，狀態在 x5Shared.ts）
    x5RegisterJackpotBoard('of')

    Object.assign(this._get, {
      user: (userId: string) => Storage.get.user(userId) as UserStoreLike,
      userRecord: (userId: string) => this.handle.ensureUserRecord(this._get.user(userId))
    })

    Object.assign(this.handle, {
      randomOpenCode: () => x5RandomOpenCode(),
      /**
       * 覆寫期表產生：改由 x5Shared 持有，與 X5-CD 共用同一份開獎號
       * ⚠️ 一定要把共用陣列「直接賦值」給 this.recordOpenCode（同一個參照）
       */
      prdOpenCode: (now = new Date()) => {
        const dateKey = this.timer.formatDateKey(now)
        this.recordOpenCode = x5EnsureDraw(dateKey, () => this.handle.buildDayRecords(now))
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
            openCode: x5RandomOpenCode(),
            time: { start: new Date(startAt).toISOString(), end: new Date(startAt + CYCLE_MS).toISOString() },
            startAt,
            endAt: startAt + CYCLE_MS
          })
        }
        return records
      },
      /** 開獎球資料：帶球位（1 ~ 5）與號碼 */
      openCodePlay: (openCode: string[]) => {
        const nums = x5NumbersOf(openCode)
        if (!nums) return []
        return nums.map((num, idx) => ({
          num,
          label: String(num).padStart(2, '0'),
          ball: idx + 1,
          index: idx
        }))
      },
      ensureUserRecord: (user: UserStoreLike) => {
        // 與信用盤（x5Record）分開存 —— 兩個盤口的注單紀錄互不干擾
        if (!user.x5OfRecord) {
          user.x5OfRecord = { balanceChanges: [], betHistory: [], claimableIssues: [], updatedAt: Date.now() }
        }
        if (!Array.isArray(user.x5OfRecord.balanceChanges)) user.x5OfRecord.balanceChanges = []
        if (!Array.isArray(user.x5OfRecord.betHistory)) user.x5OfRecord.betHistory = []
        if (!Array.isArray(user.x5OfRecord.claimableIssues)) user.x5OfRecord.claimableIssues = []
        user.x5OfRecord.updatedAt = Date.now()
        return user.x5OfRecord
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
      appendBetHistory: (row: BetOrderRow) => {
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
          odds: Number(row.odds ?? 0),
          tabId: Number(row.select_tab_id ?? 0)
        })
        if (record.betHistory.length > 5000) record.betHistory = record.betHistory.slice(-4000)
      },
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
      rejectBet: (message: string): never => {
        throw createError({ statusCode: 400, message })
      },
      /** 限額與注碼合法性驗證：任一注違規就整筆拒絕，且必須在扣款／建單之前呼叫 */
      validateBetQuota: (input: { issue: string; userId: string; amount: number; groups: Group[] }) => {
        const _money = (value: number) => Number(value).toLocaleString('zh-TW')
        const newByTab = new Map<number, { playKey: string; coin: number }>()
        ;(Array.isArray(input.groups) ? input.groups : []).forEach((group) => {
          const playKey = String(group?.playKey || '')
          ;(Array.isArray(group?.playList) ? group.playList : []).forEach((play) => {
            const tabId = _resolveTabId(play, group)
            const tabName = findX5OfTab(playKey, tabId)?.tabName ?? String(tabId)
            const betCode = _resolveBetCode(play)
            // 注碼必須通得過該分頁的 combo 規則（展開型與單式都靠這關擋前端亂送）
            if (!betCode || !x5OfHasBetCode(playKey, tabId, betCode)) {
              this.handle.rejectBet(`${tabName}「${betCode || '(空白)'}」不是有效注碼`)
            }
            const quota = x5OfQuotaOf(playKey, tabId)
            const rawCoin = Number(play?.amount ?? play?.coin ?? input.amount)
            const coin = Number.isFinite(rawCoin) && rawCoin > 0 ? rawCoin : Number(input.amount)
            if (coin < quota.item.min) {
              this.handle.rejectBet(`${tabName}「${betCode}」單注最低 ${_money(quota.item.min)}，本次 ${_money(coin)}`)
            }
            if (coin > quota.item.max) {
              this.handle.rejectBet(`${tabName}「${betCode}」單注上限 ${_money(quota.item.max)}，本次 ${_money(coin)}`)
            }
            const prev = newByTab.get(tabId)
            newByTab.set(tabId, { playKey: prev?.playKey || playKey, coin: Number(prev?.coin ?? 0) + coin })
          })
        })
        const orders = this._get.orders() as unknown as {
          get: { issueTabCoin: (issue: string, userId: string, tabId: number) => number }
        }
        newByTab.forEach(({ playKey, coin: newCoin }, tabId) => {
          const quota = x5OfQuotaOf(playKey, tabId)
          if (!(quota.issue.max > 0)) return
          const used = Number(orders?.get?.issueTabCoin?.(input.issue, input.userId, tabId) ?? 0)
          if (used + newCoin > quota.issue.max) {
            const tabName = findX5OfTab(playKey, tabId)?.tabName ?? String(tabId)
            this.handle.rejectBet(
              `${tabName} 單期投注上限 ${_money(quota.issue.max)}，本期已投注 ${_money(used)}、本次 ${_money(newCoin)}`
            )
          }
        })
      },
      buildOrderRows: (input: { issue: string; userId: string; amount: number; groups: Group[] }): BetOrderRow[] => {
        const rows: BetOrderRow[] = []
        ;(Array.isArray(input.groups) ? input.groups : []).forEach((group) => {
          const playTypeName = String(group?.playTypeName || '')
          const playKey = String(group?.playKey || '')
          const playList = Array.isArray(group?.playList) ? group.playList : []
          const total = playList.length
          playList.forEach((play, index) => {
            const orderId = this.handle.createOrderId(input.issue)
            const tabId = _resolveTabId(play, group)
            const betCode = _resolveBetCode(play)
            if (!betCode) return
            const playCoin = Number(play?.amount ?? play?.coin ?? input.amount)
            rows.push({
              issue: input.issue,
              user_id: input.userId,
              select_tab_id: tabId,
              bet_time: Date.now(),
              coin: Number.isFinite(playCoin) && playCoin > 0 ? playCoin : input.amount,
              order_id: `${orderId}(${index + 1}/${total})`,
              status: 'success',
              bet_code: [betCode],
              play_key: playKey,
              play_type_name: playTypeName,
              // 彩池分頁一律回 0（那邊走分層，不吃固定賠率）
              odds: x5OfTabOddsOf(playKey, tabId, betCode)
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
      /**
       * 官方盤結算
       *
       * 兩條路並存，依該注所屬分頁的 combo.pool 分流：
       *   賠率分頁（52 個）→ judgeX5OfBet 逐注判定，賠率取注單鎖的值
       *   彩池分頁（後三直選）→ 依命中位數分層，從共用獎池按比例分配
       * ⚠️ 滾存（carry）只由彩池那條計算 —— 賠率分頁的注單不吃池、也不影響滾存。
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

        // ── 賠率分頁：逐注判定 ──
        const oddsOrders = allOrders.filter((row) => !_isPoolRow(row.playKey, row.tabId))
        const payoutByUser = new Map<string, number>()
        /** 爆池分配用的注單列（兩種分頁都要收，權重讀該注項的看板設定） */
        const jackpotRows: JackpotRow[] = []
        oddsOrders.forEach((row) => {
          const coin = Number(row.coin ?? 0)
          const betCode = String((Array.isArray(row.betCode) ? row.betCode : [])[0] ?? '')
          const lockedOdds = Number(row.odds ?? 0)
          const judged = judgeX5OfBet(betCode, codes, coin, lockedOdds)
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
            payoutByUser.set(row.userId, Number((Number(payoutByUser.get(row.userId) ?? 0) + payout).toFixed(2)))
          }

          jackpotRows.push({
            orderId: String(row.orderId),
            userId: String(row.userId),
            coin,
            source: 'of',
            // 有份條件：非未中（和局也算有份，與信用盤同一套語意）
            eligible: status !== 'lose',
            weight: x5OfJackpotWeightOf(String(row.playKey ?? ''), Number(row.tabId ?? 0), betCode)
          })
        })

        // ── 彩池分頁（後三直選）：依命中位數分層 ──
        const poolOrders = allOrders.filter((row) => _isPoolRow(row.playKey, row.tabId))
        // 可發放獎池 = 池底 + 該期抽水 × 0.8 + 累積滾存（與 X5-CD 共用同一個池）
        const totalPool = x5DistributablePool(safeIssue)
        const rows = poolOrders.map((row) => ({
          ...row,
          matchCount: x5OfMatchCount(String((Array.isArray(row.betCode) ? row.betCode : [])[0] ?? ''), codes) ?? 0,
          payout: 0,
          tierName: ''
        }))

        let carryNext = 0
        X5_OF_PRIZE_TIERS.forEach((tier) => {
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
            if (prizePerUnit > naturalPerUnit && totalWinnerBets > 0) {
              recordFloorOverpay(this.key, safeIssue, Number(((prizePerUnit - naturalPerUnit) * totalWinnerBets).toFixed(2)))
            }
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

          jackpotRows.push({
            orderId: String(row.orderId),
            userId: String(row.userId),
            coin: Number(row.coin ?? 0),
            source: 'of',
            // 彩池分頁沒有和局，命中 ≥ 1 位（有派彩）才算有份
            eligible: row.payout > 0,
            weight: x5OfJackpotWeightOf(
              String(row.playKey ?? ''), Number(row.tabId ?? 0),
              String((Array.isArray(row.betCode) ? row.betCode : [])[0] ?? '')
            )
          })
        })

        // ── 爆池：交件給共用層，湊齊所有盤口後才分配 ──
        // ⚠️ 池與滾存都在共用層（與 X5-CD 共吃一池），本 class 只挑 source === 'of' 的份寫回自己的 record
        x5SubmitJackpotRows(safeIssue, 'of', jackpotRows)
        const jackpot = x5SettleJackpotIfReady(safeIssue, x5JackpotHit(codes), x5JackpotLabel(codes))
        jackpot?.shares.filter((share) => share.source === 'of').forEach((share) => {
          if (!(share.amount > 0)) return
          payoutByUser.set(
            share.userId,
            Number((Number(payoutByUser.get(share.userId) ?? 0) + share.amount).toFixed(2))
          )
          const record = this.handle.ensureUserRecord(this._get.user(share.userId))
          const idx = record.betHistory.findIndex((item) => String(item.orderId) === share.orderId)
          const current = record.betHistory[idx]
          if (idx >= 0 && current) record.betHistory[idx] = { ...current, jackpotAmount: share.amount }
        })

        // ⚠️ 爆池 share 必須在這之前併進 payoutByUser，否則玩家領不到爆池加碼
        payoutByUser.forEach((amount, userId) => {
          this.handle.pushClaimable(userId, safeIssue, amount, codes)
        })

        // 未派出的 pool 層滾存至下期；該期抽水已用掉，歸零
        // ⚠️ carry 是與 X5-CD 共用的，這裡寫回去兩邊都會看到
        X5_SHARED.pool.carry = carryNext
        X5_SHARED.pool.issueMap[safeIssue] = 0
      }
    })

    Object.assign(this.get, {
      /**
       * 投注統計（供 /api/lottery/userInfo 使用）
       * ⚠️ 那支路由是無條件呼叫 gameClass.get.userInfo()，沒實作就會 TypeError → 500
       */
      userInfo: (userId: string) => {
        const orders = this._get.orders()
        const issue = this.recordOpenCode[this.currentIndex]?.issue ?? ''
        const currentBets = Number(orders.get.members.issue(issue, userId) ?? 0)
        const totalBets = Number(orders.get.members.user(userId) ?? 0)
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
      /** 共用彩池狀態（與 X5-CD 讀到同一份） */
      poolState: () => {
        const issue = this._get.latestIssue()
        x5EnsurePoolBase()
        return {
          issue,
          base: X5_SHARED.pool.base,
          carry: X5_SHARED.pool.carry,
          issuePool: x5IssuePool(issue),
          distributable: x5DistributablePool(issue)
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
      /** 後三直選的獎金分層（畫面顯示用） */
      prizeTiers: () => X5_OF_PRIZE_TIERS,
      /** 爆池狀態（與 X5-CD 讀到同一份） */
      creditJackpot: () => x5JackpotState(this._get.latestIssue()),
      /** 該期開獎的總和（15 ~ 45） */
      sumOf: (openCode: string[]) => {
        const nums = x5NumbersOf(openCode)
        return nums ? x5SumOf(nums) : 0
      }
    })

    this.init()
  }

  init() {
    console.log('TTT---RUN.X5.官方')
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
      throw createError({ statusCode: 400, message: _msg })
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
    // 抽水入共用彩池（X5-CD 與 X5-OF 共同養同一個池，後三直選在吃）
    x5AddIssuePool(issue, Number((amount * X5_OF_RAKE_RATIO).toFixed(2)))
    // 另外再抽一份進爆池（與共用彩池是兩個池，兩個盤口共吃爆池）
    x5AddIssueJackpot(issue, Number((amount * X5_JACKPOT_SETTINGS.rakeRatio).toFixed(2)))
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
        betCode: row.bet_code,
        playKey: row.play_key,
        odds: row.odds
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
}
