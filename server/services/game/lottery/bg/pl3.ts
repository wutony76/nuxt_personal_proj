import { Storage } from '../../../storage'
import { LOTTERY, STATUS_TIME } from '~/config/constants'
import LOTTERY_BASE from './base'
import { recordPoolReseed, recordFloorOverpay } from './poolAudit'
// ⚠️ 別跟同層的 ./base 搞混：這支是 services/base.ts（BaseClass 與 MEMORY 時鐘），
//    ./base 才是本層的彩票基底（期表／狀態機／訂單）
import { MEMORY } from '../../../base'
import { buildJackpotShares, type JackpotHitRecord, type JackpotRow } from '#shared/config/jackpot'
import { pl3DigitsOf, pl3SumOf } from '#shared/config/pl3'
import {
  judgePl3Bet,
  PL3_MAX_COMBO,
  PL3_OF_RAKE_RATIO,
  PL3_OF_PRIZE_TIERS,
  PL3_POOL_BASE_MIN,
  PL3_POOL_BASE_MAX,
  PL3_POOL_FLOOR,
  PL3_JACKPOT_SETTINGS,
  PL3_JACKPOT_BASE_MIN,
  PL3_JACKPOT_BASE_MAX,
  pl3SanxingMatchCount,
  pl3JackpotHit,
  pl3JackpotLabel
} from '#shared/config/pl3-of'
import {
  pl3HasBetCode,
  pl3QuotaOf,
  pl3TabOddsOf,
  findPl3Tab,
  pl3OfIsPoolTab,
  pl3JackpotWeightOf
} from '#shared/config/pl3of/helpers'

/**
 * 排列3官方盤（PL3）
 *
 * ── 為什麼長得像「SSC-OF 砍掉彩池」＋「EGGS 的單盤口外殼」──────
 *   來源（bglottery pl3）只有官方盤、沒有信用盤，也沒有任何彩池／爆池 UI 痕跡，
 *   是本專案目前唯一「官方盤單盤口」的形狀：
 *     判定／賠率／複式驗證 → 取 sscOf.ts 的「一般分頁」半套（固定賠率、逐注鎖賠率），
 *                            但**不含** sscOf 的彩池分頁分支（pl3 一個吃池的分頁都沒有）。
 *     檔案佈局             → 比照 eggs.ts：單一 class、沒有 *Shared.ts 共用期表層，
 *                            直接用 LOTTERY_BASE 內建的 prdOpenCode 產當日期表，
 *                            只覆寫 randomOpenCode（3 位 0~9）與 openCodePlay（三球展示）。
 *
 * ── 彩池機制（openspec/changes/add-pl3-jackpot/）────────────
 *   三星直選（複式＋單式）已改吃分層彩池，賠率不再固定——判定與分層比例沿用
 *   SSC-OF「後三直選」（結構相同：3 位、0~9、可重複、逐位比對），記帳骨架比照
 *   EGGS 的單 class 寫法（PL3 只有一個盤口，不需要跨 class 共用單例）。
 *   全站爆池（issueJackpotMap / carryJackpot）比照 EGGS：開豹子觸發、`buildJackpotShares`
 *   依權重分潤；三星直選池（poolBase / issuePoolMap / carryPool）比照 SSC-OF 的阻尼公式
 *   ＋池底重骰。兩個池各自獨立記帳，互不影響。
 *   資金來源：對整筆送單金額抽水，不篩選分頁——比照既有 SSC-OF／EGGS 慣例，非新例外。
 *
 * ── 複式的注碼從哪來 ────────────────────────────────────
 *   除了定位膽是單選分頁，其餘分頁都是複式：前端用 pl3ComboCodes() 把選號展開成
 *   一注一碼後送上來，伺端逐注用 pl3HasBetCode() 驗（複式分頁改驗「前綴符合 + 可判定」）。
 *   ⚠️ 伺端不信任前端送的注數與分頁 id：注數超過 PL3_MAX_COMBO 整筆拒絕，
 *      分頁 id 一律以 config（findPl3Tab）重解析，賠率由 pl3TabOddsOf() 重算後才鎖進注單。
 */

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
  /** 下注時鎖進注單的賠率（含本金），結算派彩以此為準 */
  odds: number
  /** 注碼所屬分頁，單期限額與結算都靠它 */
  tab_id: number
}

type Group = {
  playTypeName?: string
  playKey?: string
  selectTabId?: number | string
  playList?: Array<{
    playId?: number | string
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
  /** tie：排列3官方盤沒有真正的和局，僅在注碼無法辨識時退回本金 */
  winStatus: 'pending' | 'win' | 'lose' | 'tie'
  winAmount: number
  /** 下注時鎖進注單的賠率（三星直選吃彩池後為 0，改看 tierName/winAmount） */
  odds: number
  /** 注碼所屬分頁 */
  tabId: number
  /** 三星直選命中的分層名稱（頭獎／二獎／三獎），非三星直選注單固定空字串 */
  tierName: string
  /** 全站爆池加碼金額（未觸發或未參與分潤為 0） */
  jackpotAmount: number
}
type UserClaimableIssue = { issue: string; amount: number; openCode: string[]; createdAt: number }
type UserRecord = {
  balanceChanges: UserBalanceChange[]
  betHistory: UserBetHistory[]
  claimableIssues: UserClaimableIssue[]
  updatedAt: number
}
type UserStoreLike = { userId?: string; coin?: number; pl3Record?: UserRecord }

/** 取一注的注碼（官方盤的注碼一律是字串：三星直選123、大小單雙後二大單、百位7…） */
function _resolveBetCode(play?: { num?: number | string; label?: string | number }): string {
  const label = String(play?.label ?? '').trim()
  if (label) return label
  return String(play?.num ?? '').trim()
}

/** 產生 3 個號碼（0~9，可重複，比照 eggs 的三球開獎） */
function _pl3RandomOpenCode(): string[] {
  return Array.from({ length: 3 }, () => String(Math.floor(Math.random() * 10)))
}

export default class PL3 extends LOTTERY_BASE {
  issueSettledMap: Record<string, boolean>

  /** 全站爆池：各期抽水累積（issue → 金額） */
  issueJackpotMap: Record<string, number>
  /** 爆池未發放的滾存 */
  carryJackpot: number
  /** 最近一次爆池紀錄（供頁首與說明頁展示） */
  lastJackpotHit: JackpotHitRecord | null

  /** 三星直選分層彩池：池底（比照 SSC-OF，需要阻尼公式＋門檻重骰維持可持續派彩） */
  poolBase: number
  poolBaseSetAt: number
  /** 三星直選池：各期抽水累積（issue → 金額，與爆池抽水並行、互不影響） */
  issuePoolMap: Record<string, number>
  /** 三星直選池未派出的滾存 */
  carryPool: number

  declare _get: LOTTERY_BASE['_get'] & {
    user: (userId: string) => UserStoreLike
    userRecord: (userId: string) => UserRecord
  }
  declare handle: LOTTERY_BASE['handle'] & {
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
    userInfo: (userId: string) => { currentBets: number; totalBets: number; analysis: string }
    userDialogRecord: (userId: string) => {
      balanceChanges: UserBalanceChange[]
      betHistory: UserBetHistory[]
      claimableIssues: UserClaimableIssue[]
    }
    sumOf: (openCode: string[]) => number
    creditJackpot: () => {
      issue: string
      currentIssueJackpot: number
      carryJackpot: number
      distributable: number
      rakeRatio: number
      payoutRatio: number
      minPool: number
      hitLabel: string
      hitRate: number
      lastHit: JackpotHitRecord | null
    }
    poolState: () => {
      issue: string
      base: number
      carry: number
      issuePool: number
      distributable: number
      prizeTiers: typeof PL3_OF_PRIZE_TIERS
    }
  }

  constructor() {
    super(LOTTERY.PL3.key, LOTTERY.PL3.id)
    this.issueSettledMap = {}
    this.issueJackpotMap = {}
    // 開站一次性 seed 池底到滾存，讓玩家一進遊戲就看到非 0 的總彩池；之後照既有機制自然演化
    this.carryJackpot = LOTTERY_BASE.jackpotBase(PL3_JACKPOT_BASE_MIN, PL3_JACKPOT_BASE_MAX)
    this.lastJackpotHit = null
    this.poolBase = 0
    this.poolBaseSetAt = 0
    this.issuePoolMap = {}
    this.carryPool = 0

    Object.assign(this._get, {
      user: (userId: string) => Storage.get.user(userId) as UserStoreLike,
      userRecord: (userId: string) => this.handle.ensureUserRecord(this._get.user(userId))
    })

    Object.assign(this.handle, {
      // 排列3開獎：3 個號碼（可重複，0~9），比照 eggs 的三球，不像時時彩是 5 位
      randomOpenCode: () => _pl3RandomOpenCode(),
      // 開獎球資料：直接把 3 個號碼點數帶出去（百=0、十=1、個=2）
      openCodePlay: (openCode: string[]) => {
        const digits = pl3DigitsOf(openCode)
        if (!digits) return []
        return digits.map((num, idx) => ({ num, label: String(num), index: idx }))
      },
      ensureUserRecord: (user: UserStoreLike) => {
        // 與其他彩種分開存（pl3Record），各盤口的注單紀錄互不干擾
        if (!user.pl3Record) {
          user.pl3Record = { balanceChanges: [], betHistory: [], claimableIssues: [], updatedAt: Date.now() }
        }
        if (!Array.isArray(user.pl3Record.balanceChanges)) user.pl3Record.balanceChanges = []
        if (!Array.isArray(user.pl3Record.betHistory)) user.pl3Record.betHistory = []
        if (!Array.isArray(user.pl3Record.claimableIssues)) user.pl3Record.claimableIssues = []
        user.pl3Record.updatedAt = Date.now()
        return user.pl3Record
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
          winStatus: 'pending',
          winAmount: 0,
          odds: Number(row.odds ?? 0),
          tabId: Number(row.tab_id ?? 0),
          tierName: '',
          jackpotAmount: 0
        })
        if (record.betHistory.length > 5000) record.betHistory = record.betHistory.slice(-4000)
      },
      /** 統一的拒單方式（文案放 message；statusMessage 會被 h3 消毒掉中文，不要用） */
      rejectBet: (message: string): never => {
        throw createError({ statusCode: 400, message })
      },
      /**
       * 注碼與限額驗證（任一注違規就整筆拒絕，且必須在扣款／建單之前呼叫）
       *
       * 官方盤只有一種注碼形狀（字串），且 pl3 沒有彩池分頁，所以比 SSC-OF 更單純：
       *   單選分頁（定位膽）→ 注碼要在 groupList 內
       *   複式分頁          → 前綴符合該分頁的 combo 規則且能被 pl3-of.ts 判定
       * 限額一律讀該分頁的 config，伺端不信任前端送的注數與金額。
       */
      validateBetQuota: (input: { issue: string; userId: string; amount: number; groups: Group[] }) => {
        const _money = (value: number) => Number(value).toLocaleString('zh-TW')
        /** 本次送單依分頁累計，供單期限額比對 */
        const newByTab = new Map<number, { playKey: string; coin: number }>()
        ;(Array.isArray(input.groups) ? input.groups : []).forEach((group) => {
          const playKey = String(group?.playKey || '')
          const tab = findPl3Tab(playKey, group?.selectTabId)
          if (!tab) this.handle.rejectBet(`玩法或分頁不存在（${playKey} / ${group?.selectTabId ?? ''}）`)
          const safeTabId = Number(tab!.tabId)
          const tabName = String(tab!.tabName ?? safeTabId)
          const quota = pl3QuotaOf(playKey, safeTabId)
          const playList = Array.isArray(group?.playList) ? group.playList : []
          // 複式展開的上限：前端的 pl3ComboCodes() 已擋過一次，這裡是伺端的第二道
          if (playList.length > PL3_MAX_COMBO) {
            this.handle.rejectBet(`${tabName} 單次最多 ${_money(PL3_MAX_COMBO)} 注，本次 ${_money(playList.length)} 注`)
          }
          playList.forEach((play) => {
            const betCode = _resolveBetCode(play)
            if (!betCode || !pl3HasBetCode(playKey, safeTabId, betCode)) {
              this.handle.rejectBet(`${tabName}「${betCode || '(空白)'}」不在該分頁的注項內`)
            }
            const rawCoin = Number(play?.amount ?? play?.coin ?? input.amount)
            const coin = Number.isFinite(rawCoin) && rawCoin > 0 ? rawCoin : Number(input.amount)
            if (coin < quota.item.min) {
              this.handle.rejectBet(`${tabName}「${betCode}」單注最低 ${_money(quota.item.min)}，本次 ${_money(coin)}`)
            }
            if (coin > quota.item.max) {
              this.handle.rejectBet(`${tabName}「${betCode}」單注上限 ${_money(quota.item.max)}，本次 ${_money(coin)}`)
            }
            const prev = newByTab.get(safeTabId)
            newByTab.set(safeTabId, { playKey: prev?.playKey || playKey, coin: Number(prev?.coin ?? 0) + coin })
          })
        })
        // 單期投注額：同一玩家、同一期、同一分頁的既有注單 + 本次送單
        const orders = this._get.orders() as unknown as {
          get: { issueTabCoin: (issue: string, userId: string, tabId: number) => number }
        }
        newByTab.forEach(({ playKey, coin: newCoin }, tabId) => {
          const quota = pl3QuotaOf(playKey, tabId)
          if (!(quota.issue.max > 0)) return
          const used = Number(orders?.get?.issueTabCoin?.(input.issue, input.userId, tabId) ?? 0)
          if (used + newCoin > quota.issue.max) {
            const tabName = findPl3Tab(playKey, tabId)?.tabName ?? String(tabId)
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
          // 分頁 id 一律以 config 為準（前端沒帶就回該玩法第一個分頁），
          // 結算與單期限額都靠它，不能直接信前端送的數字
          const tabId = Number(findPl3Tab(playKey, group?.selectTabId)?.tabId ?? 0)
          const playList = Array.isArray(group?.playList) ? group.playList : []
          const total = playList.length
          playList.forEach((play, index) => {
            const orderId = this.handle.createOrderId(input.issue)
            const betCode = _resolveBetCode(play)
            if (!betCode) return
            const playCoin = Number(play?.amount ?? play?.coin ?? input.amount)
            rows.push({
              issue: input.issue,
              user_id: input.userId,
              bet_time: Date.now(),
              coin: Number.isFinite(playCoin) && playCoin > 0 ? playCoin : input.amount,
              order_id: `${orderId}(${index + 1}/${total})`,
              status: 'success',
              bet_code: [betCode],
              play_key: playKey,
              play_type_name: playTypeName,
              // 賠率鎖進注單：之後改 rtp 或設定也不會影響已成立的注單
              odds: pl3TabOddsOf(playKey, tabId, betCode),
              tab_id: tabId
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
      /** 寫入某期的可領獎金（同一期重複呼叫會累加，避免同一期出現多列可領） */
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
      /**
       * 官方盤結算：一般固定賠率分頁 + 三星直選分層彩池 + 全站爆池，三段分開跑
       *
       * ⚠️ 無法辨識的注碼視為和局退還本金，不吞玩家注金（比照 sscOf / eggs 的和局退款語意）。
       * ⚠️ 三星直選的注單「同時」參與分層彩池（自己的中獎判定）與全站爆池（有份就分潤），
       *    比照 EGGS 彩池玩法注單同時參與 EGGS 自己爆池的作法，兩段互不影響。
       */
      settleIssuePrize: (issue: string, openCode: string[]) => {
        const safeIssue = String(issue ?? '')
        if (!safeIssue) return
        const codes = Array.isArray(openCode) ? openCode : []
        const issueOrders = (this._get.orders().get.orders.currentIssue(safeIssue) ?? []) as Array<{
          userId: string
          orderId: string
          coin: number
          betCode: string[]
          playKey?: string
          tabId?: number
          odds?: number
        }>

        const payoutByUser = new Map<string, number>()
        /** 全站爆池分配用的注單列（一般分頁與三星直選都要收，權重讀該注項的看板設定） */
        const jackpotRows: JackpotRow[] = []

        const oddsOrders = issueOrders.filter((row) => !pl3OfIsPoolTab(row.playKey, row.tabId))
        const poolOrders = issueOrders.filter((row) => pl3OfIsPoolTab(row.playKey, row.tabId))

        // ── 一般固定賠率分頁（原邏輯不變）──
        oddsOrders.forEach((row) => {
          const coin = Number(row.coin ?? 0)
          const betCode = String((Array.isArray(row.betCode) ? row.betCode : [])[0] ?? '')
          const lockedOdds = Number(row.odds ?? 0)
          const judged = judgePl3Bet(betCode, codes, coin, lockedOdds)
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
            // 有份條件：非未中（和局也算有份，與其他彩種同一套語意）
            eligible: status !== 'lose',
            weight: pl3JackpotWeightOf(String(row.playKey ?? ''), Number(row.tabId ?? 0), betCode)
          })
        })

        // ── 三星直選（複式＋單式）：依命中位數分層派彩，比照 SSC-OF 後三直選 ──
        const poolTotal = this.distributablePool(safeIssue)
        const tierRows = poolOrders.map((row) => ({
          ...row,
          matchCount: pl3SanxingMatchCount(String((Array.isArray(row.betCode) ? row.betCode : [])[0] ?? ''), codes) ?? 0,
          payout: 0,
          tierName: ''
        }))

        let carryPoolNext = 0
        PL3_OF_PRIZE_TIERS.forEach((tier) => {
          const winners = tierRows.filter((row) => row.matchCount === tier.match)
          if (tier.type === 'pool') {
            const tierPool = Number((poolTotal * tier.ratio).toFixed(2))
            if (winners.length === 0) {
              // 該層沒人中 → 整塊滾存至下期
              carryPoolNext = Number((carryPoolNext + tierPool).toFixed(2))
              return
            }
            const totalWinnerBets = Number(winners.reduce((sum, row) => sum + Number(row.coin ?? 0), 0).toFixed(2))
            const naturalPerUnit = totalWinnerBets > 0 ? tierPool / totalWinnerBets : 0
            const prizePerUnit = tier.minAmount !== undefined
              ? Math.max(naturalPerUnit, tier.minAmount)
              : naturalPerUnit
            if (prizePerUnit > naturalPerUnit && totalWinnerBets > 0) {
              recordFloorOverpay(this.key, safeIssue, Number(((prizePerUnit - naturalPerUnit) * totalWinnerBets).toFixed(2)))
            }
            winners.forEach((row) => {
              row.payout = Number((prizePerUnit * Number(row.coin ?? 1)).toFixed(2))
              row.tierName = tier.name
            })
          } else {
            winners.forEach((row) => {
              row.payout = Number((tier.amount * Number(row.coin ?? 1)).toFixed(2))
              row.tierName = tier.name
            })
          }
        })

        tierRows.forEach((row) => {
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
              winAmount: row.payout,
              odds: 0
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
            // 分層彩池沒有和局，命中 ≥ 1 位（有派彩）才算有份
            eligible: row.payout > 0,
            weight: pl3JackpotWeightOf(
              String(row.playKey ?? ''), Number(row.tabId ?? 0),
              String((Array.isArray(row.betCode) ? row.betCode : [])[0] ?? '')
            )
          })
        })
        this.carryPool = carryPoolNext
        this.issuePoolMap[safeIssue] = 0

        // ── 全站爆池（開出豹子）：單一 class，不必等其他盤口交件，直接結算 ──
        const jackpotPool = Number((
          Number(this.issueJackpotMap[safeIssue] ?? 0) + Number(this.carryJackpot ?? 0)
        ).toFixed(2))
        const jackpot = buildJackpotShares(jackpotRows, pl3JackpotHit(codes), jackpotPool, PL3_JACKPOT_SETTINGS)
        jackpot.shares.forEach((share) => {
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
        this.carryJackpot = Number(jackpot.remain.toFixed(2))
        this.issueJackpotMap[safeIssue] = 0
        if (jackpot.triggered) {
          this.lastJackpotHit = {
            issue: safeIssue,
            openLabel: pl3JackpotLabel(codes),
            pool: jackpot.pool,
            payout: jackpot.payout,
            winners: new Set(jackpot.shares.map((share) => share.userId)).size,
            orders: jackpot.shares.length,
            createdAt: Date.now()
          }
        }

        payoutByUser.forEach((amount, userId) => {
          this.handle.pushClaimable(userId, safeIssue, amount, codes)
        })
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
        // 與上一期比較的投注變化（文案格式對齊 6hc / k3 / pk10 / ssc）
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
      userDialogRecord: (userId: string) => {
        const record = this.handle.ensureUserRecord(this._get.user(userId))
        return {
          balanceChanges: [...record.balanceChanges].reverse(),
          betHistory: [...record.betHistory].reverse(),
          claimableIssues: [...record.claimableIssues]
        }
      },
      /** 該期開獎的和值（0 ~ 27，供頁首與路珠顯示） */
      sumOf: (openCode: string[]) => {
        const digits = pl3DigitsOf(openCode)
        return digits ? pl3SumOf(digits) : 0
      },
      /** 全站爆池狀態（開出豹子觸發，供頁首與說明頁展示） */
      creditJackpot: () => {
        const issue = this._get.latestIssue()
        const currentIssueJackpot = Number(this.issueJackpotMap[issue] ?? 0)
        return {
          issue,
          currentIssueJackpot,
          carryJackpot: Number(this.carryJackpot ?? 0),
          distributable: Number((currentIssueJackpot + Number(this.carryJackpot ?? 0)).toFixed(2)),
          rakeRatio: PL3_JACKPOT_SETTINGS.rakeRatio,
          payoutRatio: PL3_JACKPOT_SETTINGS.payoutRatio,
          minPool: PL3_JACKPOT_SETTINGS.minPool,
          hitLabel: PL3_JACKPOT_SETTINGS.hitLabel,
          hitRate: PL3_JACKPOT_SETTINGS.hitRate,
          lastHit: this.lastJackpotHit
        }
      },
      /** 三星直選分層彩池狀態（供看板與說明頁顯示；池底不足門檻時順便重骰） */
      poolState: () => {
        const issue = this._get.latestIssue()
        this.ensurePoolBase()
        return {
          issue,
          base: this.poolBase,
          carry: this.carryPool,
          issuePool: Number(this.issuePoolMap[issue] ?? 0),
          distributable: this.distributablePool(issue),
          prizeTiers: PL3_OF_PRIZE_TIERS
        }
      }
    })

    this.init()
  }

  init() {
    console.log('TTT---RUN.PL3.官方')
    this.handle.prdOpenCode()
    Storage.games[this.key] = this
    LOTTERY_BASE.getOrders(this.id, this.key)
    // 開機就把三星直選池的池底生好，不依賴「剛好有人先呼叫 poolState()」這個隱含順序
    this.ensurePoolBase()
  }

  override circle() {
    this.handle.refreshCurrent(MEMORY.now)
    this.handle.settleClosedIssueIfNeeded()
  }

  /**
   * 確保三星直選池的池底存在（沒有或已被吃到低於門檻就重骰）
   * 比照 eggs.ts 的 ensurePoolBase，PL3 只有一個 class，不需要跨 class 單例
   */
  ensurePoolBase(): number {
    const issue = this._get.latestIssue()
    const distributable = this.distributablePool(issue)
    if (this.poolBase > 0 && distributable >= PL3_POOL_FLOOR) return this.poolBase
    const before = distributable
    this.poolBase = LOTTERY_BASE.jackpotBase(PL3_POOL_BASE_MIN, PL3_POOL_BASE_MAX)
    this.poolBaseSetAt = Date.now()
    recordPoolReseed(this.key, issue, before, this.poolBase)
    return this.poolBase
  }

  /**
   * 三星直選池可派發金額 =（池底 + 該期抽水 × 0.8 + 滾存）× 0.55
   * 複用既有的泛用工具 LOTTERY_BASE.jackpotCalc()，0.8/0.55 為其預設值（比照 SSC-OF／EGGS）
   */
  distributablePool(issue: string): number {
    return Number(
      LOTTERY_BASE.jackpotCalc(this.poolBase, Number(this.issuePoolMap[issue] ?? 0), this.carryPool).toFixed(2)
    )
  }

  playBets(payload: PlayBetsPayload, user: UserStoreLike) {
    // 期別狀態閘門：只有「開盤中」可受理投注（前端 disable 可被繞過，故伺端再擋一次）
    this.handle.refreshCurrent(new Date())
    if (this.currentStatus !== STATUS_TIME.OPEN) {
      const _msg = `目前為「${this.currentStatus}」，不受理投注`
      throw createError({ statusCode: 400, message: _msg })
    }

    const amount = Number(payload?.amount ?? 0)
    const userId = String(user?.userId ?? '')
    const issue = this.recordOpenCode[this.currentIndex]?.issue ?? this._get.latestIssue()
    const groups = Array.isArray(payload?.groups) ? payload.groups : []

    // 限額與注項合法性一律擋在扣款前
    this.handle.validateBetQuota({ issue, userId, amount, groups })

    const beforeCoin = Number(user?.coin ?? 0)
    user.coin = Number((beforeCoin - Math.abs(amount)).toFixed(2))
    const afterCoin = Number(user?.coin ?? 0)

    const rows = this.handle.buildOrderRows({ issue, userId, amount, groups })
    // 抽水入全站爆池（比照 EGGS，對整筆送單金額抽水，不篩選分頁）
    this.issueJackpotMap[issue] = Number((
      Number(this.issueJackpotMap[issue] ?? 0) + Number((amount * PL3_JACKPOT_SETTINGS.rakeRatio).toFixed(2))
    ).toFixed(2))
    // 抽水入三星直選池（比照 SSC-OF，同樣對整筆送單金額抽水，是兩條並行的水，互不影響）
    this.issuePoolMap[issue] = Number((
      Number(this.issuePoolMap[issue] ?? 0) + Number((amount * PL3_OF_RAKE_RATIO).toFixed(2))
    ).toFixed(2))
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
        // ⚠️ orderId 一定要帶：結算是用它回頭比對 betHistory 那一列（少了它注單會永遠停在 pending）
        orderId: row.order_id,
        // ⚠️ 記真正的 config 分頁 id：單期限額是 per 分頁比對，記錯就變成整個玩法共用一條限額
        tabId: Number(row.tab_id ?? 0),
        betCode: row.bet_code,
        playKey: row.play_key,
        odds: Number(row.odds ?? 0)
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
