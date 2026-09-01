import { Storage } from '../../../storage'
import { LOTTERY, STATUS_TIME } from '~/config/constants'
import LOTTERY_BASE from './base'
// ⚠️ 別跟同層的 ./base 搞混：這支是 services/base.ts（BaseClass 與 MEMORY 時鐘），
//    ./base 才是本層的彩票基底（期表／狀態機／訂單）
import { MEMORY } from '../../../base'
import { recordPoolReseed, recordFloorOverpay } from './poolAudit'
import { buildJackpotShares, type JackpotHitRecord, type JackpotRow } from '#shared/config/jackpot'
import { judgeKl8Bet, type Kl8BetResult,
  kl8JackpotHit,
  kl8JackpotLabel,
  KL8_JACKPOT_SETTINGS,
  KL8_JACKPOT_BASE_MIN,
  KL8_JACKPOT_BASE_MAX,
  kl8PoolPicksOf,
  kl8PoolMatchCount,
  KL8_POOL_PLAY_KEY,
  KL8_POOL_PICK_COUNT,
  KL8_POOL_PLAY_WEIGHT,
  KL8_POOL_BASE_MIN,
  KL8_POOL_BASE_MAX,
  KL8_POOL_RAKE_RATIO,
  KL8_POOL_QUOTA,
  KL8_POOL_PRIZE_TIERS,
  KL8_POOL_FLOOR
} from '#shared/config/kl8-cd'
import {
  kl8NumberLabel,
  kl8NumbersOf,
  kl8ParityZoneOf,
  kl8SumOf,
  kl8WuxingOf,
  kl8ZoneOf,
  KL8_BALL_COUNT,
  KL8_NUMBER_MAX
} from '#shared/config/kl8'
import { kl8QuotaOf, kl8RtpOf, kl8TabOddsOf, kl8HasBetCode, findKl8Tab, kl8JackpotWeightOf } from '#shared/config/kl8cd/helpers'

/**
 * 快樂8（KL8）信用盤
 *
 * ── 與 PC蛋蛋（eggs.ts）／快樂十分（kl10.ts）的關係：同一套骨架 ─────
 *   來源（bglottery `kl8/`）只有信用模式、沒有官方盤（該資料夾沒有 official 子目錄），
 *   因此不需要 *Shared.ts 共用期表／彩池那一層，直接用 LOTTERY_BASE 內建的
 *   `handle.prdOpenCode()` 產生當日期表即可 —— 只覆寫 `randomOpenCode`
 *   （80 取 20 不重複）與 `openCodePlay`（球號展示），不必像 k3Cd 整個 prdOpenCode 重寫。
 *
 * ── 與其他彩種的差異 ────────────────────────────────────
 *   開獎是 1~80 取 20 個**不重複**號碼（洗牌，同 kl10Cd 的做法，只是規模大 10 倍）。
 *   ⚠️ 「任選」是一注多碼的組合玩法（注碼像 `任三中三03,07,15`），
 *      但複式展開在前端就做完了（見 app/composables/useKl8.ts），
 *      送到這裡仍然是「一注一個注碼」—— 所以驗證／建單／結算／爆池都不必為它開特例。
 *   ⚠️ 選號彩池玩法（選 3 碼、依命中顆數分層）與既有爆池是兩條獨立的抽水線，
 *      比照 kl10.ts 的做法（見 `add-pool-play` 提案），一個 class 內同時維護兩組狀態。
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
  /** 下注時鎖定的賠率（含本金），結算派彩以此為準 */
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
    /** 彩池玩法（選號）專用：一注多碼，不走 label 那套（見 KL8_POOL_PLAY_KEY 分支） */
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
  matchCount: number
  specialMatch: boolean
  winStatus: 'pending' | 'win' | 'lose' | 'tie'
  winAmount: number
  odds: number
  jackpotAmount: number
}
type UserClaimableIssue = { issue: string; amount: number; openCode: string[]; createdAt: number }
type UserRecord = {
  balanceChanges: UserBalanceChange[]
  betHistory: UserBetHistory[]
  claimableIssues: UserClaimableIssue[]
  updatedAt: number
}
type UserStoreLike = { userId?: string; coin?: number; kl8Record?: UserRecord }

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

/**
 * 取一注的注碼；注項名稱本身就是注碼
 * （"大"、"大單"、"上下和"、"金"、"任三中三03,07,15"）
 * ⚠️ 不像 eggs 可以退回 `num` —— 快樂8的注碼一律是注項名稱或帶前綴的組合碼。
 */
function _resolveBetCode(play?: { label?: string | number }): string {
  return String(play?.label ?? '').trim()
}

/** 產生 20 顆球（1~80 不重複，洗牌後取前 20 個；格式一律補零兩位） */
function _kl8RandomOpenCode(): string[] {
  const source = Array.from({ length: KL8_NUMBER_MAX }, (_, i) => i + 1)
  for (let i = source.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = source[i] as number
    source[i] = source[j] as number
    source[j] = tmp
  }
  return source.slice(0, KL8_BALL_COUNT).map((num) => kl8NumberLabel(num))
}

export default class KL8 extends LOTTERY_BASE {
  issueSettledMap: Record<string, boolean>
  /**
   * 各期爆池抽水累積：issue → 金額
   * ⚠️ 快樂8沒有官方盤、沒有 Shared 層，只有這一個池 ——
   *    不像 k3 / pk10 / ssc 要區分「共用彩池」與「爆池」兩套帳。
   */
  issueJackpotMap: Record<string, number>
  /** 爆池未發放的滾存 */
  carryJackpot: number
  /** 最近一次爆池紀錄（供頁首與說明頁展示） */
  lastJackpotHit: JackpotHitRecord | null

  /**
   * 彩池玩法（選號）的獨立彩金池——跟上面的爆池是兩個池，互不影響
   * ⚠️ 只有一個 class，不需要 k3Shared.ts 那種跨 class 單例
   */
  poolBase: number
  poolBaseSetAt: number
  /** 各期彩池玩法抽水累積：issue → 金額（與爆池抽水並行，同一筆下注各自抽各自的） */
  issuePoolMap: Record<string, number>
  /** 彩池玩法未派出的滾存 */
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
  }
  declare get: LOTTERY_BASE['get'] & {
    userInfo: (userId: string) => { currentBets: number; totalBets: number; analysis: string }
    userDialogRecord: (userId: string) => {
      balanceChanges: UserBalanceChange[]
      betHistory: UserBetHistory[]
      claimableIssues: UserClaimableIssue[]
    }
    sumOf: (openCode: string[]) => number
    zoneOf: (openCode: string[]) => { sum: number; zone: string; parityZone: string; wuxing: string }
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
      prizeTiers: typeof KL8_POOL_PRIZE_TIERS
    }
  }

  constructor() {
    super(LOTTERY.KL8.key, LOTTERY.KL8.id)
    this.issueSettledMap = {}
    this.issueJackpotMap = {}
    // 開站一次性 seed 池底到滾存，讓玩家一進遊戲就看到非 0 的總彩池；之後照既有機制自然演化
    this.carryJackpot = LOTTERY_BASE.jackpotBase(KL8_JACKPOT_BASE_MIN, KL8_JACKPOT_BASE_MAX)
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
      // 快樂8開獎：1~80 取 20 個不重複號碼
      randomOpenCode: () => _kl8RandomOpenCode(),
      // 開獎球資料：20 顆球（快樂8無位置概念，只需要號碼本身）
      openCodePlay: (openCode: string[]) => {
        const nums = kl8NumbersOf(openCode)
        if (!nums) return []
        return nums.map((num, idx) => ({
          num,
          label: kl8NumberLabel(num),
          index: idx
        }))
      },
      ensureUserRecord: (user: UserStoreLike) => {
        // 與其他彩種分開存（kl8Record），互不干擾
        if (!user.kl8Record) {
          user.kl8Record = { balanceChanges: [], betHistory: [], claimableIssues: [], updatedAt: Date.now() }
        }
        if (!Array.isArray(user.kl8Record.balanceChanges)) user.kl8Record.balanceChanges = []
        if (!Array.isArray(user.kl8Record.betHistory)) user.kl8Record.betHistory = []
        if (!Array.isArray(user.kl8Record.claimableIssues)) user.kl8Record.claimableIssues = []
        user.kl8Record.updatedAt = Date.now()
        return user.kl8Record
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
          specialMatch: false,
          winStatus: 'pending',
          winAmount: 0,
          odds: Number(row.odds ?? 0),
          jackpotAmount: 0
        })
        if (record.betHistory.length > 5000) record.betHistory = record.betHistory.slice(-4000)
      },
      /** 統一的拒單方式（文案放 message；statusMessage 會被 h3 消毒掉中文，不要用） */
      rejectBet: (message: string): never => {
        throw createError({ statusCode: 400, message })
      },
      /** 限額與注項合法性驗證：任一注違規就整筆拒絕，且必須在扣款／建單之前呼叫 */
      validateBetQuota: (input: { issue: string; userId: string; amount: number; groups: Group[] }) => {
        const _money = (value: number) => Number(value).toLocaleString('zh-TW')
        const orders = this._get.orders() as unknown as {
          get: { issueTabCoin: (issue: string, userId: string, tabId: number) => number }
        }
        const newByTab = new Map<number, { playKey: string; coin: number }>()
        let poolNewCoin = 0
          ; (Array.isArray(input.groups) ? input.groups : []).forEach((group) => {
            const playKey = String(group?.playKey || '')
            if (playKey === KL8_POOL_PLAY_KEY) {
              ; (Array.isArray(group?.playList) ? group.playList : []).forEach((play) => {
                const picks = kl8PoolPicksOf(Array.isArray(play?.codes) ? play.codes : [])
                if (!picks) {
                  this.handle.rejectBet(
                    `選號（彩池）號碼不合法，需 ${KL8_POOL_PICK_COUNT} 碼、每碼 1~80、不重複`
                  )
                }
                const rawCoin = Number(play?.amount ?? play?.coin ?? input.amount)
                const coin = Number.isFinite(rawCoin) && rawCoin > 0 ? rawCoin : Number(input.amount)
                if (coin < KL8_POOL_QUOTA.item.min) {
                  this.handle.rejectBet(`選號（彩池）單注最低 ${_money(KL8_POOL_QUOTA.item.min)}，本次 ${_money(coin)}`)
                }
                if (coin > KL8_POOL_QUOTA.item.max) {
                  this.handle.rejectBet(`選號（彩池）單注上限 ${_money(KL8_POOL_QUOTA.item.max)}，本次 ${_money(coin)}`)
                }
                poolNewCoin += coin
              })
              return
            }
              ; (Array.isArray(group?.playList) ? group.playList : []).forEach((play) => {
                const tabId = _resolveTabId(play, group)
                const tabName = findKl8Tab(playKey, tabId)?.tabName ?? String(tabId)
                const betCode = _resolveBetCode(play)
                if (!betCode || !kl8HasBetCode(playKey, tabId, betCode)) {
                  this.handle.rejectBet(`${tabName}「${betCode || '(空白)'}」不是有效注項`)
                }
                const quota = kl8QuotaOf(playKey, tabId)
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
        newByTab.forEach(({ playKey, coin: newCoin }, tabId) => {
          const quota = kl8QuotaOf(playKey, tabId)
          if (!(quota.issue.max > 0)) return
          const used = Number(orders?.get?.issueTabCoin?.(input.issue, input.userId, tabId) ?? 0)
          if (used + newCoin > quota.issue.max) {
            const tabName = findKl8Tab(playKey, tabId)?.tabName ?? String(tabId)
            this.handle.rejectBet(
              `${tabName} 單期投注上限 ${_money(quota.issue.max)}，本期已投注 ${_money(used)}、本次 ${_money(newCoin)}`
            )
          }
        })
        if (poolNewCoin > 0 && KL8_POOL_QUOTA.issue.max > 0) {
          // 彩池玩法的 select_tab_id 固定為 0（見 buildOrderRows），單期上限用同一個 sentinel 查累積
          const used = Number(orders?.get?.issueTabCoin?.(input.issue, input.userId, 0) ?? 0)
          if (used + poolNewCoin > KL8_POOL_QUOTA.issue.max) {
            this.handle.rejectBet(
              `選號（彩池） 單期投注上限 ${_money(KL8_POOL_QUOTA.issue.max)}，`
              + `本期已投注 ${_money(used)}、本次 ${_money(poolNewCoin)}`
            )
          }
        }
      },
      buildOrderRows: (input: { issue: string; userId: string; amount: number; groups: Group[] }): BetOrderRow[] => {
        const rows: BetOrderRow[] = []
          ; (Array.isArray(input.groups) ? input.groups : []).forEach((group) => {
            const playTypeName = String(group?.playTypeName || '')
            const playKey = String(group?.playKey || '')
            const playList = Array.isArray(group?.playList) ? group.playList : []
            const total = playList.length
            if (playKey === KL8_POOL_PLAY_KEY) {
              // 彩池玩法：一注多碼（picks 陣列），不是「一注項一金額」，validateBetQuota 已驗證過合法性
              playList.forEach((play, index) => {
                const orderId = this.handle.createOrderId(input.issue)
                const picks = kl8PoolPicksOf(Array.isArray(play?.codes) ? play.codes : [])
                if (!picks) return
                const playCoin = Number(play?.amount ?? play?.coin ?? input.amount)
                rows.push({
                  issue: input.issue,
                  user_id: input.userId,
                  select_tab_id: 0,
                  bet_time: Date.now(),
                  coin: Number.isFinite(playCoin) && playCoin > 0 ? playCoin : input.amount,
                  order_id: `${orderId}(${index + 1}/${total})`,
                  status: 'success',
                  bet_code: picks.map(String),
                  play_key: playKey,
                  play_type_name: playTypeName,
                  // 彩池玩法非固定賠率結算，odds 欄位不使用（保留 0 只為滿足型別）
                  odds: 0
                })
              })
              return
            }
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
                // 賠率由 helpers 依該分頁 rtp 即時推算後鎖上注單，結算以此值派彩
                odds: kl8TabOddsOf(playKey, tabId, betCode)
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
      /** 信用盤結算：每注獨立、按注單鎖定的賠率派彩 */
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
        /** 爆池分配用的注單列（權重讀該注項的看板設定） */
        const jackpotRows: JackpotRow[] = []
        // 彩池玩法（選號）走獨立的分層結算，不能混進固定賠率的 judgeKl8Bet（picks 的裸數字無法辨識）
        const oddsOrders = issueOrders.filter((row) => String(row.playKey ?? '') !== KL8_POOL_PLAY_KEY)
        const poolOrders = issueOrders.filter((row) => String(row.playKey ?? '') === KL8_POOL_PLAY_KEY)

        oddsOrders.forEach((row) => {
          const coin = Number(row.coin ?? 0)
          const betCode = String((Array.isArray(row.betCode) ? row.betCode : [])[0] ?? '')
          const playKey = String(row.playKey ?? '')
          const tabId = Number(row.tabId ?? 0)
          const lockedOdds = Number(row.odds ?? 0)
          const judged = judgeKl8Bet(betCode, codes, coin, lockedOdds, kl8RtpOf(playKey, tabId))
          // 無法辨識的注項視為和局退還本金，避免吞掉玩家注金
          const result: Kl8BetResult = judged?.result ?? 'tie'
          const odds = lockedOdds > 0 ? lockedOdds : Number(judged?.odds ?? 0)
          const payout = result === 'win'
            ? Number((coin * odds).toFixed(2))
            : result === 'tie' ? coin : 0

          const record = this.handle.ensureUserRecord(this._get.user(row.userId))
          const idx = record.betHistory.findIndex((item) => String(item.orderId) === String(row.orderId))
          const current = record.betHistory[idx]
          if (idx >= 0 && current) {
            record.betHistory[idx] = {
              ...current,
              openCode: [...codes],
              matchCount: result === 'win' ? 1 : 0,
              specialMatch: false,
              winStatus: result,
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
            source: 'cd',
            // 有份條件：非未中（和局也算有份，與 6hc-cd / k3-cd / kl10-cd 同一套語意）
            eligible: result !== 'lose',
            // 權重讀該注項所屬群組的看板設定（注項 weight → 群組 weight → 0 不參與）
            weight: kl8JackpotWeightOf(playKey, tabId, betCode)
          })
        })

        // ── 彩池玩法：依命中顆數分層派彩（比照 kl10 的選號結算邏輯） ──
        const poolTotal = this.distributablePool(safeIssue)
        const poolRows = poolOrders.map((row) => ({
          ...row,
          matchCount: kl8PoolMatchCount(
            (Array.isArray(row.betCode) ? row.betCode : []).map((code) => Number(code)),
            codes
          ),
          payout: 0
        }))
        let carryPoolNext = 0
        KL8_POOL_PRIZE_TIERS.forEach((tier) => {
          const winners = poolRows.filter((row) => row.matchCount === tier.match)
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
            })
          } else {
            winners.forEach((row) => {
              row.payout = Number((tier.amount * Number(row.coin ?? 1)).toFixed(2))
            })
          }
        })
        poolRows.forEach((row) => {
          const record = this.handle.ensureUserRecord(this._get.user(row.userId))
          const idx = record.betHistory.findIndex((item) => String(item.orderId) === String(row.orderId))
          const current = record.betHistory[idx]
          if (idx >= 0 && current) {
            record.betHistory[idx] = {
              ...current,
              openCode: [...codes],
              matchCount: row.matchCount,
              specialMatch: false,
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
            source: 'cd',
            // 彩池玩法沒有和局，命中 ≥ 1（有派彩）才算有份，比照 kl10 的選號玩法
            eligible: row.payout > 0,
            // 查不到看板設定，用 fallback 常數（比照 KL10_POOL_PLAY_WEIGHT）
            weight: KL8_POOL_PLAY_WEIGHT
          })
        })
        this.carryPool = carryPoolNext
        this.issuePoolMap[safeIssue] = 0

        // ── 爆池發放（爆池期：奇偶一邊倒，見 KL8_JACKPOT_SETTINGS）──
        // ⚠️ share 必須在下面寫 claimableIssues 之前併進 payoutByUser，否則玩家領不到
        const jackpotPool = Number((
          Number(this.issueJackpotMap[safeIssue] ?? 0) + Number(this.carryJackpot ?? 0)
        ).toFixed(2))
        const jackpot = buildJackpotShares(
          jackpotRows,
          kl8JackpotHit(codes),
          jackpotPool,
          KL8_JACKPOT_SETTINGS
        )
        jackpot.shares.forEach((share) => {
          if (!(share.amount > 0)) return
          payoutByUser.set(
            share.userId,
            Number((Number(payoutByUser.get(share.userId) ?? 0) + share.amount).toFixed(2))
          )
          // 記在該注單上，供下注紀錄顯示「爆池加碼」
          const record = this.handle.ensureUserRecord(this._get.user(share.userId))
          const idx = record.betHistory.findIndex((item) => String(item.orderId) === share.orderId)
          const current = record.betHistory[idx]
          if (idx >= 0 && current) record.betHistory[idx] = { ...current, jackpotAmount: share.amount }
        })
        // 未發放的部分（含未觸發時的整池）滾存至下期
        this.carryJackpot = Number(jackpot.remain.toFixed(2))
        this.issueJackpotMap[safeIssue] = 0
        if (jackpot.triggered) {
          this.lastJackpotHit = {
            issue: safeIssue,
            openLabel: kl8JackpotLabel(codes),
            pool: jackpot.pool,
            payout: jackpot.payout,
            winners: new Set(jackpot.shares.map((share) => share.userId)).size,
            orders: jackpot.shares.length,
            createdAt: Date.now()
          }
        }

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
      /**
       * 爆池狀態（供頁首與說明頁顯示）
       * ⚠️ 快樂8只有這一個池，不像 k3 / pk10 / ssc 還要區分官方盤的共用彩池
       */
      creditJackpot: () => {
        const issue = this._get.latestIssue()
        const currentIssueJackpot = Number(this.issueJackpotMap[issue] ?? 0)
        return {
          issue,
          currentIssueJackpot,
          carryJackpot: Number(this.carryJackpot ?? 0),
          distributable: Number((currentIssueJackpot + Number(this.carryJackpot ?? 0)).toFixed(2)),
          rakeRatio: KL8_JACKPOT_SETTINGS.rakeRatio,
          payoutRatio: KL8_JACKPOT_SETTINGS.payoutRatio,
          minPool: KL8_JACKPOT_SETTINGS.minPool,
          hitLabel: KL8_JACKPOT_SETTINGS.hitLabel,
          hitRate: KL8_JACKPOT_SETTINGS.hitRate,
          lastHit: this.lastJackpotHit
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
      /** 該期開獎的總和（供前端顯示與冷熱分析） */
      sumOf: (openCode: string[]) => {
        const nums = kl8NumbersOf(openCode)
        return nums ? kl8SumOf(nums) : 0
      },
      /** 該期開獎的兩面特徵（總和／上下盤／奇偶盤／五行），供看板與路珠顯示 */
      zoneOf: (openCode: string[]) => {
        const nums = kl8NumbersOf(openCode)
        if (!nums) return { sum: 0, zone: '', parityZone: '', wuxing: '' }
        const sum = kl8SumOf(nums)
        return { sum, zone: kl8ZoneOf(nums), parityZone: kl8ParityZoneOf(nums), wuxing: kl8WuxingOf(sum) }
      },
      /** 彩池玩法狀態（供頁首與選號頁顯示；池底不足門檻時順便重骰） */
      poolState: () => {
        const issue = this._get.latestIssue()
        this.ensurePoolBase()
        return {
          issue,
          base: this.poolBase,
          carry: this.carryPool,
          issuePool: Number(this.issuePoolMap[issue] ?? 0),
          distributable: this.distributablePool(issue),
          prizeTiers: KL8_POOL_PRIZE_TIERS
        }
      }
    })

    this.init()
  }

  init() {
    console.log('TTT---RUN.KL8')
    this.handle.prdOpenCode()
    Storage.games[this.key] = this
    LOTTERY_BASE.getOrders(this.id, this.key)
    // 開機就把彩池玩法的池底生好，不依賴「剛好有人先呼叫 poolState()」這個隱含順序
    this.ensurePoolBase()
  }

  override circle() {
    this.handle.refreshCurrent(MEMORY.now)
    this.handle.settleClosedIssueIfNeeded()
  }

  /**
   * 確保彩池玩法的池底存在（沒有或已被吃到低於門檻就重骰）
   * 比照 kl10.ts 的 ensurePoolBase，但這裡只有一個 class，不需要跨 class 單例
   */
  ensurePoolBase(): number {
    const issue = this._get.latestIssue()
    const distributable = this.distributablePool(issue)
    if (this.poolBase > 0 && distributable >= KL8_POOL_FLOOR) return this.poolBase
    const before = distributable
    this.poolBase = LOTTERY_BASE.jackpotBase(KL8_POOL_BASE_MIN, KL8_POOL_BASE_MAX)
    this.poolBaseSetAt = Date.now()
    recordPoolReseed(this.key, issue, before, this.poolBase)
    return this.poolBase
  }

  /**
   * 彩池玩法可派發金額 =（池底 + 該期抽水 × 0.8 + 滾存）× 0.55
   * 複用既有的泛用工具 LOTTERY_BASE.jackpotCalc()（本來就不是 K3 專屬），0.8/0.55 為其預設值
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
    // 抽水入爆池（快樂8只有這一個爆池，沒有官方盤共用彩池）
    this.issueJackpotMap[issue] = Number((
      Number(this.issueJackpotMap[issue] ?? 0) + Number((amount * KL8_JACKPOT_SETTINGS.rakeRatio).toFixed(2))
    ).toFixed(2))
    // 同時抽水入彩池玩法的獨立彩金池（比照 kl10 兩條水並行，不限彩池玩法本身，任何分頁的下注都算）
    this.issuePoolMap[issue] = Number((
      Number(this.issuePoolMap[issue] ?? 0) + Number((amount * KL8_POOL_RAKE_RATIO).toFixed(2))
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
