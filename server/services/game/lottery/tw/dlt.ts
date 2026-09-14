import { Storage } from '../../../storage'
import { LOTTERY, STATUS_TIME } from '~/config/constants'
import LOTTERY_BASE from './base'
import { MEMORY } from '../../../base'
import {
  DLT_BET_AMOUNT,
  DLT_MAX_SLOTS,
  DLT_DRAW_WEEKDAYS,
  DLT_CUTOFF_HOUR,
  DLT_CUTOFF_MINUTE,
  DLT_DRAW_HOUR,
  DLT_DRAW_MINUTE,
  DLT_QUOTA_FALLBACK_COIN,
  DLT_TIERS,
  dltTierOf,
  dltNormalizeBetCode,
  type DltTierKey
} from '#shared/config/dlt'
import { dltQuotaOf } from '#shared/config/dlt/helpers'
import {
  fetchTaiwanLotteryLastNumberOf,
  fetchTaiwanLotteryPrize,
  type TaiwanLotteryPrizeTier
} from './taiwanLotteryApi'

/**
 * 大樂透（DLT）——唯一「完全鏡射官方台彩」的玩法。
 *
 * ── 跟其他所有彩種最大的不同：不自建開獎、不自建賠率 ──────────────
 *   開獎號碼＝官方大樂透（gameCode 5118）當期實際開出的號碼；8 個獎項的派彩金額＝官方當期
 *   實際 perPrize。本站只負責「判定一注屬於哪個獎項」（見 shared/config/dlt.ts），派彩金額
 *   完全照抄官方數字，不套用任何賠率公式、不做彩池、不做摃龜滾存
 *   （見 openspec/changes/add-dlt/design.md Decision 2）。
 *
 * ── 期別模型：內部佔位 issue（下注用）與官方 period（結算/歷史用）分開 ──
 *   Decision 3 說「期別直接沿用官方 period」，但官方 period 在開獎前查不到（last-number.get.ts
 *   只能查「已開獎」的最新一期），沒辦法在下注開放當下就預先知道它。若靠「猜測官方期別編號
 *   規則、自己遞增」來預先分配 issue，一旦格式猜錯（例如跨年編號規則變動），輪詢比對永遠
 *   對不上、會卡死在 pending-settlement。因此本站的下注階段使用一個純內部的佔位期別
 *   （純 `YYYYMMDD`，為該次開獎的日曆日期；不再額外加 `DLT-` 前綴，避免和 `createOrderId()` 自動加的 `this.key`（DLT）前綴重複造成 orderId 出現 "DLTDLT"），開獎後輪詢時「不管三七二十一」直接
 *   問官方目前最新一期是誰（`fetchTaiwanLotteryLastNumberOf`）——只要那個 period 跟我們
 *   上次記錄的不一樣，就代表官方已經開出新一期，直接拿那個真實 period 去查獎金、結算、
 *   寫進 `recordOpenCode`（歷史紀錄用官方真實 period，滿足 Decision 3 的精神），
 *   不需要事先猜對官方期別字串長什麼樣子。
 *
 * ── 一次送單可含 A~E 最多 5 組（見 design.md Decision 8/9）──────────
 *   每組都是一次獨立、完整的 6 碼投注，各自固定 50 coin、各自獨立判定與派彩，不是複式。
 */

const DLT_GAME_CODE = 5118

type Slot = { numbers?: Array<number | string> }
type PlayBetsPayload = { amount?: number; slots?: Slot[] }

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
  tierKey: DltTierKey | null
  tierLabel: string
  winStatus: 'pending' | 'win' | 'lose'
  winAmount: number
}
type UserClaimableIssue = { issue: string; amount: number; openCode: string[]; createdAt: number }
type UserRecord = {
  balanceChanges: UserBalanceChange[]
  betHistory: UserBetHistory[]
  claimableIssues: UserClaimableIssue[]
  updatedAt: number
}
type UserStoreLike = { userId?: string; coin?: number; dltRecord?: UserRecord }

type BetOrderRow = {
  issue: string
  user_id: string
  bet_time: number
  coin: number
  order_id: string
  bet_code: string
}

/** 官方欄位 key → 判定/顯示要用的中文標籤，直接沿用 shared/config/dlt.ts 的 DLT_TIERS */
const TIER_LABEL: Record<DltTierKey, string> = Object.fromEntries(
  DLT_TIERS.map((t) => [t.key, t.label])
) as Record<DltTierKey, string>

function _dateKey(now: Date): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}${m}${d}`
}

/**
 * 找出「以 fromDate 為基準，下一個尚未截止投注的開獎日」，回傳當天的鎖單時間與開獎時間
 * （皆為 epoch ms）。⚠️ 絕不 mutate 傳入的 fromDate（呼叫端可能直接傳 MEMORY.now 這個
 * 全站共用的 Date 物件，`Date.prototype.setHours` 是原地修改，絕對不能對它呼叫）。
 */
function _nextDrawWindow(fromDate: Date): { drawDate: Date; cutoffAt: number; drawAt: number } {
  const fromMs = fromDate.getTime()
  for (let i = 0; i <= 13; i++) {
    const probe = new Date(fromDate)
    probe.setDate(probe.getDate() + i)
    probe.setHours(0, 0, 0, 0)
    if (!DLT_DRAW_WEEKDAYS.includes(probe.getDay())) continue
    const cutoffAt = new Date(probe).setHours(DLT_CUTOFF_HOUR, DLT_CUTOFF_MINUTE, 0, 0)
    if (fromMs >= cutoffAt) continue // 這天的鎖單時間已過，找下一個開獎日
    const drawAt = new Date(probe).setHours(DLT_DRAW_HOUR, DLT_DRAW_MINUTE, 0, 0)
    return { drawDate: probe, cutoffAt, drawAt }
  }
  // 理論上 14 天內必有開獎日（每週二、五至少各一次），這裡只是型別安全網，不應該真的走到
  const probe = new Date(fromDate)
  const fallbackCutoff = new Date(probe).setHours(DLT_CUTOFF_HOUR, DLT_CUTOFF_MINUTE, 0, 0)
  const fallbackDraw = new Date(probe).setHours(DLT_DRAW_HOUR, DLT_DRAW_MINUTE, 0, 0)
  return { drawDate: probe, cutoffAt: fallbackCutoff, drawAt: fallbackDraw }
}

export default class DltClass extends LOTTERY_BASE {
  /** 目前受理下注的內部佔位期別（純 YYYYMMDD，不帶 DLT- 前綴），MUST NOT 拿去跟官方 period 比對 */
  currentIssue: string
  cutoffAt: number
  drawAt: number
  /** 開始等待官方資料的時間點，用來算「超過 3 小時降頻」 */
  pendingSince: number
  /** 下一次允許嘗試輪詢官方 API 的時間點（節流，避免每 300ms circle tick 都打一次） */
  nextPollAt: number
  /** 是否正在輪詢中（避免同時重疊發出多個請求） */
  isSettling: boolean
  /** 已確認的官方最新一期（用來判斷官方是否已經開出新一期） */
  lastKnownOfficialPeriod: string
  /** 已結算的內部佔位期別，避免重複結算 */
  issueSettledMap: Record<string, boolean>
  /** 追蹤到的「最近一次真的有人中頭獎」金額，尚無歷史時用回退預設值（見 Decision 3） */
  lastJackpotPrize: number

  declare _get: LOTTERY_BASE['_get'] & {
    user: (userId: string) => UserStoreLike
    userRecord: (userId: string) => UserRecord
  }
  declare handle: LOTTERY_BASE['handle'] & {
    ensureUserRecord: (user: UserStoreLike) => UserRecord
    pushBalanceChange: (userId: string, payload: Omit<UserBalanceChange, 'id' | 'createdAt'>) => void
    appendBetHistory: (row: BetOrderRow) => void
    rejectBet: (message: string) => never
    validateBetQuota: (input: { issue: string; userId: string; slots: Slot[] }) => string[]
    pushClaimable: (userId: string, issue: string, amount: number, openCode: string[]) => void
  }
  declare get: LOTTERY_BASE['get'] & {
    userInfo: (userId: string) => { currentBets: number; totalBets: number; analysis: string }
    userDialogRecord: (userId: string) => {
      balanceChanges: UserBalanceChange[]
      betHistory: UserBetHistory[]
      claimableIssues: UserClaimableIssue[]
    }
    currentInfo: () => {
      issue: string
      currentStatus: string
      cutoffAt: number
      drawAt: number
      countdown: string
      quotaIssueMaxCoin: number
      quotaIssueMaxBets: number
      lastOpenCode: { issue: string; openCode: string[] } | null
    }
    tiers: () => Array<{ key: DltTierKey; label: string; desc: string | null }>
  }

  constructor() {
    super(LOTTERY.DLT.key, LOTTERY.DLT.id)
    this.currentIssue = ''
    this.cutoffAt = 0
    this.drawAt = 0
    this.pendingSince = 0
    this.nextPollAt = 0
    this.isSettling = false
    this.lastKnownOfficialPeriod = ''
    this.issueSettledMap = {}
    this.lastJackpotPrize = DLT_QUOTA_FALLBACK_COIN

    Object.assign(this._get, {
      user: (userId: string) => Storage.get.user(userId) as UserStoreLike,
      userRecord: (userId: string) => this.handle.ensureUserRecord(this._get.user(userId))
    })

    Object.assign(this.handle, {
      ensureUserRecord: (user: UserStoreLike) => {
        if (!user.dltRecord) {
          user.dltRecord = { balanceChanges: [], betHistory: [], claimableIssues: [], updatedAt: Date.now() }
        }
        if (!Array.isArray(user.dltRecord.balanceChanges)) user.dltRecord.balanceChanges = []
        if (!Array.isArray(user.dltRecord.betHistory)) user.dltRecord.betHistory = []
        if (!Array.isArray(user.dltRecord.claimableIssues)) user.dltRecord.claimableIssues = []
        user.dltRecord.updatedAt = Date.now()
        return user.dltRecord
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
          betCode: [row.bet_code],
          openCode: [],
          tierKey: null,
          tierLabel: '',
          winStatus: 'pending',
          winAmount: 0
        })
        if (record.betHistory.length > 5000) record.betHistory = record.betHistory.slice(-4000)
      },
      rejectBet: (message: string): never => {
        throw createError({ statusCode: 400, message })
      },
      /**
       * 驗證一次送單的 1~5 組注碼，回傳正規化後的注碼字串陣列（供 playBets 建單使用）。
       * 任一組不合法就整筆拒絕；單期（本站佔位期別）總注數不得超過依頭獎金額算出的上限。
       */
      validateBetQuota: (input: { issue: string; userId: string; slots: Slot[] }): string[] => {
        const _money = (value: number) => Number(value).toLocaleString('zh-TW')
        const slots = Array.isArray(input.slots) ? input.slots : []
        if (slots.length < 1 || slots.length > DLT_MAX_SLOTS) {
          this.handle.rejectBet(`一次送單需為 1~${DLT_MAX_SLOTS} 組，本次 ${slots.length} 組`)
        }
        const betCodes = slots.map((slot) => {
          const normalized = dltNormalizeBetCode(Array.isArray(slot?.numbers) ? slot.numbers : [])
          if (!normalized) this.handle.rejectBet('每組需選滿 6 個不重複的 1~49 號碼')
          return normalized as string
        })

        const quota = dltQuotaOf()
        const issueMaxBets = this.quotaIssueMaxBets()
        const orders = this._get.orders() as unknown as {
          get: { orders: { currentIssue: (issue: string) => Array<{ userId: string }> | undefined } }
        }
        const existing = (orders?.get?.orders?.currentIssue?.(input.issue) ?? []).length
        if (existing + betCodes.length > issueMaxBets) {
          this.handle.rejectBet(
            `本期最多受理 ${_money(issueMaxBets)} 注，目前已有 ${_money(existing)} 注、本次 ${_money(betCodes.length)} 注`
          )
        }
        // 每注固定金額，quota.item.min === quota.item.max === DLT_BET_AMOUNT，這裡不接受任何浮動
        void quota
        return betCodes
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
      }
    })

    Object.assign(this.get, {
      userInfo: (userId: string) => {
        const orders = this._get.orders()
        const issue = this.currentIssue
        const currentBets = Number(orders.get.members.issue(issue, userId) ?? 0)
        const totalBets = Number(orders.get.members.user(userId) ?? 0)
        return { currentBets, totalBets, analysis: currentBets > 0 ? '本期已投注' : '尚未投注' }
      },
      userDialogRecord: (userId: string) => {
        const record = this.handle.ensureUserRecord(this._get.user(userId))
        return {
          balanceChanges: [...record.balanceChanges].reverse(),
          betHistory: [...record.betHistory].reverse(),
          claimableIssues: [...record.claimableIssues]
        }
      },
      currentInfo: () => {
        const last = this.recordOpenCode[this.recordOpenCode.length - 1] ?? null
        const now = MEMORY.now.getTime()
        const remainMs = this.currentStatus === STATUS_TIME.OPEN ? Math.max(0, this.cutoffAt - now) : 0
        const remainSec = Math.floor(remainMs / 1000)
        const dd = Math.floor(remainSec / 86400)
        const hh = Math.floor((remainSec % 86400) / 3600)
        const mm = Math.floor((remainSec % 3600) / 60)
        return {
          issue: this.currentIssue,
          currentStatus: this.currentStatus,
          cutoffAt: this.cutoffAt,
          drawAt: this.drawAt,
          countdown: `${dd}天${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`,
          quotaIssueMaxCoin: this.lastJackpotPrize,
          quotaIssueMaxBets: this.quotaIssueMaxBets(),
          lastOpenCode: last ? { issue: last.issue, openCode: last.openCode } : null
        }
      },
      tiers: () => DLT_TIERS.map((t) => ({ key: t.key, label: t.label, desc: null }))
    })

    this.init()
  }

  init() {
    console.log('TTT---RUN.DLT.鏡射官方大樂透')
    Storage.games[this.key] = this
    LOTTERY_BASE.getOrders(this.id, this.key)
    this._ensureIssue(MEMORY.now)
  }

  /** 單期最多受理注數 = 追蹤到的最近一次頭獎金額 ÷ 50（見 design.md Decision 3） */
  quotaIssueMaxBets(): number {
    return Math.floor(Number(this.lastJackpotPrize || DLT_QUOTA_FALLBACK_COIN) / DLT_BET_AMOUNT)
  }

  /** 確保 currentIssue／cutoffAt／drawAt／currentStatus 對應到「現在」這個時間點該有的狀態 */
  _ensureIssue(now: Date) {
    if (!this.currentIssue || !this.cutoffAt || !this.drawAt) {
      const { drawDate, cutoffAt, drawAt } = _nextDrawWindow(now)
      this.currentIssue = _dateKey(drawDate)
      this.cutoffAt = cutoffAt
      this.drawAt = drawAt
    }
    this._refreshStatus(now)
  }

  _refreshStatus(now: Date) {
    const nowMs = now.getTime()
    if (nowMs < this.cutoffAt) {
      this.currentStatus = STATUS_TIME.OPEN
      return
    }
    if (nowMs < this.drawAt) {
      this.currentStatus = STATUS_TIME.CLOSED
      return
    }
    // 已過開獎時間：進入「等待官方資料」狀態，不可在此直接判定輸贏
    if (this.currentStatus !== STATUS_TIME.PENDING_SETTLEMENT) {
      this.pendingSince = nowMs
      this.nextPollAt = nowMs // 立刻可以嘗試第一次輪詢
    }
    this.currentStatus = STATUS_TIME.PENDING_SETTLEMENT
  }

  /** 每 300ms 被全域排程呼叫一次（見 server/plugins/init.ts），同步狀態＋節流觸發非同步結算 */
  override circle() {
    const now = MEMORY.now
    this._ensureIssue(now)
    if (this.currentStatus !== STATUS_TIME.PENDING_SETTLEMENT) return
    if (this.isSettling) return
    if (now.getTime() < this.nextPollAt) return
    this.isSettling = true
    this._attemptSettlement(now).finally(() => { this.isSettling = false })
  }

  /** 輪詢頻率：起始 5 分鐘一次，超過 3 小時降頻為 30 分鐘一次，不設最終放棄時限（見 Decision 5） */
  _scheduleNextPoll(now: Date) {
    const pendingMs = now.getTime() - this.pendingSince
    const THREE_HOURS = 3 * 60 * 60 * 1000
    const FIVE_MIN = 5 * 60 * 1000
    const THIRTY_MIN = 30 * 60 * 1000
    const interval = pendingMs > THREE_HOURS ? THIRTY_MIN : FIVE_MIN
    if (pendingMs > THREE_HOURS && pendingMs - interval <= THREE_HOURS) {
      console.warn(`TTT---WARN.DLT 官方資料超過 3 小時未到位（issue=${this.currentIssue}），降頻為每 30 分鐘輪詢一次`)
    }
    this.nextPollAt = now.getTime() + interval
  }

  async _attemptSettlement(now: Date) {
    try {
      const last = await fetchTaiwanLotteryLastNumberOf(DLT_GAME_CODE)
      const period = String(last?.period ?? '')
      const lotNumber = Array.isArray(last?.lotNumber) ? last!.lotNumber.map((n) => Number(n)) : []
      // 官方「最新一期」還沒變、或號碼還沒給滿 7 個（6 一般號+1 特別號），代表尚未到位
      if (!period || period === this.lastKnownOfficialPeriod || lotNumber.length < 7) {
        this._scheduleNextPoll(now)
        return
      }
      const winningNumbers = lotNumber.slice(0, 6)
      const special = lotNumber[6]

      const prize = await fetchTaiwanLotteryPrize(DLT_GAME_CODE, period)
      if (!prize?.tiers?.length) {
        this._scheduleNextPoll(now)
        return
      }

      this._settleIssue(this.currentIssue, period, winningNumbers, Number(special), prize.tiers)
      this.lastKnownOfficialPeriod = period

      // 這一期結算完成，往下一個開獎日推進
      const { drawDate, cutoffAt, drawAt } = _nextDrawWindow(new Date(this.drawAt + 60_000))
      this.currentIssue = _dateKey(drawDate)
      this.cutoffAt = cutoffAt
      this.drawAt = drawAt
      this.pendingSince = 0
      this.nextPollAt = 0
      this._refreshStatus(now)
    } catch (err) {
      console.warn('TTT---WARN.DLT 結算輪詢失敗，稍後重試', err)
      this._scheduleNextPoll(now)
    }
  }

  /**
   * 結算一期：逐注以 dltTierOf() 分類 → 派彩＝官方當期該獎項 perPrize；
   * 完成後把官方真實開獎號寫進 recordOpenCode（歷史／冷熱號用，見 Decision 4），
   * 並在頭獎有人中時更新 lastJackpotPrize（見 Decision 3）。
   */
  _settleIssue(
    internalIssue: string,
    officialPeriod: string,
    winningNumbers: number[],
    special: number,
    tiers: TaiwanLotteryPrizeTier[]
  ) {
    if (this.issueSettledMap[internalIssue]) return

    const perPrizeOf = (tierKey: DltTierKey): number => {
      const idx = DLT_TIERS.findIndex((t) => t.key === tierKey)
      return Number(tiers[idx]?.perPrize ?? 0)
    }

    const issueOrders = (this._get.orders().get.orders.currentIssue(internalIssue) ?? []) as Array<{
      userId: string
      orderId: string
      coin: number
      betCode: string[]
    }>

    const payoutByUser = new Map<string, number>()

    issueOrders.forEach((row) => {
      const betCode = (Array.isArray(row.betCode) ? row.betCode : [])[0] ?? ''
      const tierKey = dltTierOf(betCode, winningNumbers, special)
      const payout = tierKey ? perPrizeOf(tierKey) : 0

      const record = this.handle.ensureUserRecord(this._get.user(row.userId))
      const idx = record.betHistory.findIndex((item) => String(item.orderId) === String(row.orderId))
      const current = record.betHistory[idx]
      if (idx >= 0 && current) {
        record.betHistory[idx] = {
          ...current,
          openCode: [...winningNumbers.map((n) => String(n).padStart(2, '0')), String(special).padStart(2, '0')],
          tierKey,
          tierLabel: tierKey ? TIER_LABEL[tierKey] : '',
          winStatus: payout > 0 ? 'win' : 'lose',
          winAmount: payout
        }
      }
      if (payout > 0) {
        payoutByUser.set(row.userId, Number((Number(payoutByUser.get(row.userId) ?? 0) + payout).toFixed(2)))
      }
    })

    const officialOpenCode = [
      ...winningNumbers.map((n) => String(n).padStart(2, '0')),
      String(special).padStart(2, '0')
    ]
    const startAt = this.drawAt
    this.recordOpenCode.push({
      issue: officialPeriod,
      openCode: officialOpenCode,
      time: { start: new Date(startAt).toISOString(), end: new Date(startAt).toISOString() },
      startAt,
      endAt: startAt
    })
    if (this.recordOpenCode.length > 200) this.recordOpenCode = this.recordOpenCode.slice(-100)

    const jackpotPerPrize = perPrizeOf('jackpotAssign')
    if (jackpotPerPrize > 0) this.lastJackpotPrize = jackpotPerPrize

    payoutByUser.forEach((amount, userId) => {
      this.handle.pushClaimable(userId, internalIssue, amount, officialOpenCode)
    })

    this.issueSettledMap[internalIssue] = true
  }

  playBets(payload: PlayBetsPayload, user: UserStoreLike) {
    this._ensureIssue(MEMORY.now)
    if (this.currentStatus !== STATUS_TIME.OPEN) {
      throw createError({ statusCode: 400, message: `目前為「${this.currentStatus}」，不受理投注` })
    }

    const userId = String(user?.userId ?? '')
    const issue = this.currentIssue
    const slots = Array.isArray(payload?.slots) ? payload.slots : []

    const betCodes = this.handle.validateBetQuota({ issue, userId, slots })

    const totalAmount = betCodes.length * DLT_BET_AMOUNT
    const beforeCoin = Number(user?.coin ?? 0)
    if (beforeCoin < totalAmount) {
      throw createError({ statusCode: 400, message: '餘額不足' })
    }
    user.coin = Number((beforeCoin - totalAmount).toFixed(2))
    const afterCoin = Number(user?.coin ?? 0)

    const rows: BetOrderRow[] = betCodes.map((betCode) => ({
      issue,
      user_id: userId,
      bet_time: Date.now(),
      coin: DLT_BET_AMOUNT,
      order_id: this.handle.createOrderId(issue),
      bet_code: betCode
    }))

    this.handle.pushBalanceChange(userId, {
      issue,
      type: 'bet',
      amount: -totalAmount,
      before: beforeCoin,
      after: afterCoin,
      note: `下注 ${rows.length} 組`
    })

    const orders = this._get.orders()
    rows.forEach((row) => {
      orders.add.record({
        issue: row.issue,
        userId: row.user_id,
        coin: row.coin,
        orderId: row.order_id,
        betCode: [row.bet_code]
      })
      this.handle.appendBetHistory(row)
    })

    return {
      orderId: rows[0]?.order_id ?? '',
      orders: rows.map((row) => ({
        issue: row.issue,
        orderId: row.order_id,
        coin: row.coin,
        betCode: row.bet_code
      }))
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
