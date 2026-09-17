import { Storage } from '../../../storage'
import { LOTTERY, STATUS_TIME } from '~/config/constants'
import LOTTERY_BASE from './base'
import { MEMORY } from '../../../base'
import {
  P3_BET_AMOUNT,
  P3_PAIR_PRIZE,
  P3_MAX_SLOTS,
  P3_DRAW_WEEKDAYS,
  P3_CUTOFF_HOUR,
  P3_CUTOFF_MINUTE,
  P3_DRAW_HOUR,
  P3_DRAW_MINUTE,
  P3_QUOTA_FALLBACK_COIN,
  P3_TIERS,
  P3_BET_TYPES,
  P3_DIGIT_COUNT,
  P3_DIGIT_MIN,
  P3_DIGIT_MAX,
  p3DigitsOf,
  p3IsTriple,
  p3NormalizeBetCode,
  p3ValidateGroupBet,
  p3IsExactMatch,
  p3GroupTierOf,
  p3IsFrontPairMatch,
  p3IsBackPairMatch,
  type P3TierKey,
  type P3BetType
} from '#shared/config/p3'
import {
  fetchTaiwanLotteryLastNumberOf,
  fetchTaiwanLotteryPrize,
  fetchTaiwanLotteryDrawOf,
  type TaiwanLotteryPrizeTier
} from './taiwanLotteryApi'

/**
 * 3星彩（P3）——比照 M649/D539 的「完全鏡射官方台彩」玩法（tw 分類）。
 *
 * ── 跟 M649/D539 一樣：不自建開獎、不自建賠率 ──────────────────────────
 *   開獎號碼＝官方 3星彩（gameCode 2108）當期實際開出的 3 位數字（0~9、可重複）；正彩／組彩
 *   的派彩金額＝官方當期實際 perPrize（lotto3DFirstAssign／lotto3DSecondAssign／
 *   lotto3DThirdAssign）。對彩（前二／後二）官方沒有對應明細，固定 750 元（見
 *   shared/config/p3.ts P3_PAIR_PRIZE），不查官方 API、不自建賠率公式，也不做彩池／
 *   摃龜滾存（見 openspec/changes/add-tw-lottery-suite/design.md Decision 5）。
 *
 * ── 與 M649/D539 的規則差異 ──────────────────────────────────────────
 *   1. 判定模型：一注是「正彩」「組彩」「前二對彩」「後二對彩」四種下注方式其中之一（見
 *      shared/config/p3.ts 的 P3_BET_TYPES），不是選號碼池，而是選 3 位數字（0~9，可重複）。
 *      判定函式依 betType 各自獨立呼叫（p3IsExactMatch／p3GroupTierOf／p3IsFrontPairMatch／
 *      p3IsBackPairMatch），互不影響——同一組數字若同時下前二對彩與後二對彩（各佔一組注單），
 *      兩組各自判定，都中則各發 750、合計 1,500，不可只算一次。
 *   2. 開獎頻率：每天開獎（週一至週六），跟今彩539同一組時間參數（20:00 截止、20:30 開獎），
 *      期別推進邏輯直接比照 d539.ts 複製一份（_nextDrawWindow 等），只換常數來源。
 *   3. 開獎號碼固定 3 碼（P3_DIGIT_COUNT），不是 M649 的 6 碼／D539 的 5 碼。
 *
 * ── 架構決策（design.md Decision 5，獨立性同 Decision 3）─────────────────
 *   本 service 獨立呼叫官方 API（fetchTaiwanLotteryLastNumberOf(2108) /
 *   fetchTaiwanLotteryPrize(2108, period)），絕不 import 或依賴 dlt.ts／d539.ts／m649.ts／
 *   m539.ts 等其他玩法的 service 或內部狀態。
 *
 * ── 一次送單可含 A~E 最多 5 組 ──────────────────────────────────────
 *   每組各自選定下注方式與 3 位數字，各自固定 25 coin、各自獨立判定與派彩，不是複式。
 */

const P3_GAME_CODE = 2108
/** 啟動時回填「開獎歷史」的期數（同一民國年度內往回推，見 `_prevOfficialPeriods()`） */
const P3_BACKFILL_COUNT = 10
/** 「熱門選號」固定顯示幾組（見 `get.popularNumbers`） */
const POPULAR_PICKS_COUNT = 5

/** 官方欄位 key（含對彩固定獎金的虛擬 key）→ 判定/顯示要用的中文標籤 */
const TIER_LABEL: Record<string, string> = {
  ...Object.fromEntries(P3_TIERS.map((t) => [t.key, t.label])),
  'front-pair': '前二對彩',
  'back-pair': '後二對彩'
}

/** 隨機產生 3 個 0~9 的數字（可重複），供「熱門選號」墊底用 */
function _randomDigits(): number[] {
  return Array.from(
    { length: P3_DIGIT_COUNT },
    () => Math.floor(Math.random() * (P3_DIGIT_MAX - P3_DIGIT_MIN + 1)) + P3_DIGIT_MIN
  )
}

/** 隨機產生一組合法的下注方式＋數字（組彩會避開豹子），供「熱門選號」墊底用 */
function _randomBetPick(): { betType: P3BetType; digits: number[] } {
  const betType = P3_BET_TYPES[Math.floor(Math.random() * P3_BET_TYPES.length)]!.key
  let digits = _randomDigits()
  if (betType === 'zucai') {
    while (p3IsTriple(digits)) digits = _randomDigits()
  }
  return { betType, digits }
}

type Slot = { betType?: string; digits?: Array<number | string> }
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
  betType: P3BetType
  betCode: string[]
  openCode: string[]
  /** 中獎結果 key：官方 3 個獎項 key 之一，或對彩的 'front-pair'／'back-pair'；未中或結算前為 null */
  tierKey: string | null
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
type UserStoreLike = { userId?: string; coin?: number; p3Record?: UserRecord }

type BetOrderRow = {
  issue: string
  user_id: string
  bet_time: number
  coin: number
  order_id: string
  bet_code: string
  bet_type: P3BetType
}

/** 解析官方期別字串（民國年 3 碼＋該年度序號 6 碼，例如 "115000224" → 民國 115 年第 224 期） */
function _parseOfficialPeriod(period: string): { rocYear: number; seq: number } | null {
  const m = /^(\d{3})(\d{6})$/.exec(String(period ?? ''))
  if (!m) return null
  return { rocYear: Number(m[1]), seq: Number(m[2]) }
}

/**
 * 依「即將開獎的日曆日期」＋「已知的官方最新一期」，推算下一期的官方期別字串
 * （民國年 3 碼＋該年度序號 6 碼）。民國年由 drawDate 的西元年反推（年 - 1911），
 * 序號規則：與已知期別同一民國年 → 序號 = 已知序號 + 1；跨年（或尚無已知期別）→ 序號重置為 1。
 *
 * ⚠️ 只有在 `lastKnownOfficialPeriod` 已透過真實官方 API 取得過（見 `_bootstrapOfficialPeriod`／
 * `_attemptSettlement`）才會被呼叫；絕不在完全沒有任何官方資料基準的情況下瞎猜序號起點。
 */
function _nextOfficialPeriod(drawDate: Date, lastKnownOfficialPeriod: string): string {
  const rocYear = drawDate.getFullYear() - 1911
  const parsed = _parseOfficialPeriod(lastKnownOfficialPeriod)
  const seq = parsed && parsed.rocYear === rocYear ? parsed.seq + 1 : 1
  return `${String(rocYear).padStart(3, '0')}${String(seq).padStart(6, '0')}`
}

/**
 * 回傳兩個官方格式期別字串中「數值較大」的那個；格式不符的一律視為比另一個小。
 * 用來確保 currentIssue 的推進基準只會往前走，不會撞回已經結算過的舊期別。
 */
function _laterOfficialPeriod(a: string, b: string): string {
  const pa = _parseOfficialPeriod(a)
  const pb = _parseOfficialPeriod(b)
  if (!pa) return b
  if (!pb) return a
  if (pa.rocYear !== pb.rocYear) return pa.rocYear > pb.rocYear ? a : b
  return pa.seq >= pb.seq ? a : b
}

/**
 * 以 `latest` 為基準，往回推算最多 `count` 個「同一民國年度」的官方期別字串（用於回填歷史）。
 * ⚠️ 刻意不跨年往回推——序號重置為 1 只知道「今年第 1 期」的位置，不知道「去年最後一期是第幾期」，
 * 跨年瞎猜會產生不存在的期別，寧可少回填幾筆也不猜錯。
 * @returns 由舊到新排序（方便呼叫端依序 push 進 recordOpenCode）
 */
function _prevOfficialPeriods(latest: string, count: number): string[] {
  const parsed = _parseOfficialPeriod(latest)
  if (!parsed) return []
  const periods: string[] = []
  for (let i = 1; i <= count; i++) {
    const seq = parsed.seq - i
    if (seq < 1) break
    periods.push(`${String(parsed.rocYear).padStart(3, '0')}${String(seq).padStart(6, '0')}`)
  }
  return periods.reverse()
}

/**
 * 找出「以 fromDate 為基準，下一個尚未截止投注的開獎日」，回傳當天的鎖單時間與開獎時間
 * （皆為 epoch ms）。3星彩跟今彩539/49樂合彩一樣每天（週一至週六）開獎——判斷條件
 * `P3_DRAW_WEEKDAYS.includes(probe.getDay())` 複製 D539 的日曆邏輯。
 * ⚠️ 絕不 mutate 傳入的 fromDate（呼叫端可能直接傳 MEMORY.now 這個全站共用的 Date 物件）。
 */
function _nextDrawWindow(fromDate: Date): { drawDate: Date; cutoffAt: number; drawAt: number } {
  const fromMs = fromDate.getTime()
  for (let i = 0; i <= 13; i++) {
    const probe = new Date(fromDate)
    probe.setDate(probe.getDate() + i)
    probe.setHours(0, 0, 0, 0)
    if (!P3_DRAW_WEEKDAYS.includes(probe.getDay())) continue // 週日不開獎，找下一天
    const cutoffAt = new Date(probe).setHours(P3_CUTOFF_HOUR, P3_CUTOFF_MINUTE, 0, 0)
    if (fromMs >= cutoffAt) continue // 這天的鎖單時間已過，找下一個開獎日
    const drawAt = new Date(probe).setHours(P3_DRAW_HOUR, P3_DRAW_MINUTE, 0, 0)
    return { drawDate: probe, cutoffAt, drawAt }
  }
  // 理論上頂多隔一天（週日）就有開獎日，這裡只是型別安全網，不應該真的走到
  const probe = new Date(fromDate)
  const fallbackCutoff = new Date(probe).setHours(P3_CUTOFF_HOUR, P3_CUTOFF_MINUTE, 0, 0)
  const fallbackDraw = new Date(probe).setHours(P3_DRAW_HOUR, P3_DRAW_MINUTE, 0, 0)
  return { drawDate: probe, cutoffAt: fallbackCutoff, drawAt: fallbackDraw }
}

export default class P3Class extends LOTTERY_BASE {
  /**
   * 目前受理下注的期別，格式對齊官方（民國年 3 碼＋該年度序號 6 碼），由 `_nextOfficialPeriod()`
   * 以 `lastKnownOfficialPeriod` 為基準推算；在 `isBootstrapped` 變 true 之前恆為空字串。
   */
  currentIssue: string
  /** server 啟動後是否已成功取得過一次官方最新期別；false 時 `_ensureIssue()` 不分配 currentIssue、不受理下注 */
  isBootstrapped: boolean
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
  /** 追蹤到的「最近一次頭獎（正彩）」金額，尚無歷史時用回退預設值 */
  lastJackpotPrize: number
  /**
   * 測試用：設定後，`_attemptSettlement()` 不會呼叫外部官方 API，改用這裡的假資料
   * （見 `debugForceSettleNow`／`server/api/admin/p3-test-draw.post.ts`）。用完自動清空。
   */
  _testFetchOverride: { period: string; lotNumber: number[]; tiers: Partial<Record<P3TierKey, number>> } | null

  declare _get: LOTTERY_BASE['_get'] & {
    user: (userId: string) => UserStoreLike
    userRecord: (userId: string) => UserRecord
  }
  declare handle: LOTTERY_BASE['handle'] & {
    ensureUserRecord: (user: UserStoreLike) => UserRecord
    pushBalanceChange: (userId: string, payload: Omit<UserBalanceChange, 'id' | 'createdAt'>) => void
    appendBetHistory: (row: BetOrderRow) => void
    rejectBet: (message: string) => never
    validateBetQuota: (input: { issue: string; userId: string; slots: Slot[] }) => Array<{ betType: P3BetType; code: string }>
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
      popularNumbers: Array<{ betType: P3BetType; digits: number[]; count: number }>
    }
    tiers: () => Array<{ key: P3TierKey; label: string; desc: string | null }>
  }

  constructor() {
    super(LOTTERY.P3.key, LOTTERY.P3.id)
    this.currentIssue = ''
    this.isBootstrapped = false
    this.cutoffAt = 0
    this.drawAt = 0
    this.pendingSince = 0
    this.nextPollAt = 0
    this.isSettling = false
    this.lastKnownOfficialPeriod = ''
    this.issueSettledMap = {}
    this.lastJackpotPrize = P3_QUOTA_FALLBACK_COIN
    this._testFetchOverride = null

    Object.assign(this._get, {
      user: (userId: string) => Storage.get.user(userId) as UserStoreLike,
      userRecord: (userId: string) => this.handle.ensureUserRecord(this._get.user(userId))
    })

    Object.assign(this.handle, {
      ensureUserRecord: (user: UserStoreLike) => {
        if (!user.p3Record) {
          user.p3Record = { balanceChanges: [], betHistory: [], claimableIssues: [], updatedAt: Date.now() }
        }
        if (!Array.isArray(user.p3Record.balanceChanges)) user.p3Record.balanceChanges = []
        if (!Array.isArray(user.p3Record.betHistory)) user.p3Record.betHistory = []
        if (!Array.isArray(user.p3Record.claimableIssues)) user.p3Record.claimableIssues = []
        user.p3Record.updatedAt = Date.now()
        return user.p3Record
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
          betType: row.bet_type,
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
       * 驗證一次送單的 1~5 組注碼，回傳正規化後的 { betType, code } 陣列（供 playBets 建單使用）。
       * 每組需為合法的下注方式＋3 位 0~9 數字（組彩額外要求非豹子），任一組不合法就整筆拒絕；
       * 單期（本站佔位期別）總注數不得超過依頭獎（正彩）金額算出的上限。
       */
      validateBetQuota: (input: { issue: string; userId: string; slots: Slot[] }): Array<{ betType: P3BetType; code: string }> => {
        const _money = (value: number) => Number(value).toLocaleString('zh-TW')
        const slots = Array.isArray(input.slots) ? input.slots : []
        if (slots.length < 1 || slots.length > P3_MAX_SLOTS) {
          this.handle.rejectBet(`一次送單需為 1~${P3_MAX_SLOTS} 組，本次 ${slots.length} 組`)
        }
        const validBetTypes = new Set(P3_BET_TYPES.map((t) => t.key))
        const betCodes = slots.map((slot) => {
          const betType = String(slot?.betType ?? '') as P3BetType
          if (!validBetTypes.has(betType)) {
            this.handle.rejectBet('下注方式錯誤（需為正彩／組彩／前二對彩／後二對彩）')
          }
          const digits = Array.isArray(slot?.digits) ? slot.digits.map((n) => Number(n)) : []
          const code = p3NormalizeBetCode(digits)
          if (!code) this.handle.rejectBet('每組需選 3 個 0~9 的數字（可重複）')
          if (betType === 'zucai' && !p3ValidateGroupBet(digits)) {
            this.handle.rejectBet('組彩不可 3 碼全同（豹子沒有組彩意義）')
          }
          return { betType, code: code as string }
        })

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
        // 排除 admin 測試工具留下的假資料（issue 帶「（測試）」後綴）：這些紀錄的 startAt
        // 是呼叫端隨意指定的假時間，可能比真實紀錄還「新」，若不過濾，「上一期開獎」
        // 有機率顯示成測試假資料而非真正的官方最新一期。
        const realRecords = this.recordOpenCode.filter((r) => !r.issue.includes('（測試）'))
        const last = realRecords[realRecords.length - 1] ?? null
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
          lastOpenCode: last ? { issue: last.issue, openCode: last.openCode } : null,
          popularNumbers: this._popularNumbers()
        }
      },
      tiers: () => P3_TIERS.map((t) => ({ key: t.key, label: t.label, desc: null }))
    })

    this.init()
  }

  init() {
    console.log('TTT---RUN.P3.鏡射官方3星彩')
    Storage.games[this.key] = this
    LOTTERY_BASE.getOrders(this.id, this.key)
    this._bootstrapOfficialPeriod()
  }

  /**
   * server 啟動後第一次打官方 API 拿「目前最新一期」，成功後才允許 `_ensureIssue()` 分配
   * currentIssue（否則永遠不知道序號該從哪裡接續）。失敗（含網路逾時）就 5 秒後重試，重試期間
   * `currentStatus` 停在 PREPARE、下注會被擋下。
   */
  async _bootstrapOfficialPeriod() {
    try {
      const last = await fetchTaiwanLotteryLastNumberOf(P3_GAME_CODE)
      if (last?.period) {
        this.lastKnownOfficialPeriod = String(last.period)
        this.isBootstrapped = true
        this._ensureIssue(MEMORY.now)
        // bootstrap 當下拿到的這期本身也是一筆真實開獎資料，順手直接記進歷史——它是
        // 「已知的最新一期」，往後的正常結算流程只會記錄比它更新的期別，這期不記的話
        // 永遠不會出現在 recordOpenCode（見 _recordDraw() 說明）
        this._recordDraw(String(last.period), last.lotNumber ?? [], String(last.drawDate ?? ''))
        // 不 await：回填是為了讓「開獎歷史」提早有資料可看，跟下注開放與否無關
        this._backfillHistory(P3_BACKFILL_COUNT)
        return
      }
      console.warn('TTT---WARN.P3 啟動時官方 API 沒有回傳有效期別，5 秒後重試')
    } catch (err) {
      console.warn('TTT---WARN.P3 啟動時查詢官方最新期別失敗，5 秒後重試', err)
    }
    setTimeout(() => { this._bootstrapOfficialPeriod() }, 5000)
  }

  /**
   * 把一期「已知的真實開獎資料」寫進 recordOpenCode（該期已存在就略過，不重複寫入）。
   * 供 `_bootstrapOfficialPeriod()`（bootstrap 種子期別本身）與 `_backfillHistory()` 共用。
   * 3星彩一期 3 碼（0~9，可重複）。
   */
  _recordDraw(period: string, lotNumber: Array<number | string>, drawDateRaw: string) {
    if (!period || this.recordOpenCode.some((r) => r.issue === period)) return
    const numbers = lotNumber.map((n) => Number(n))
    if (numbers.length < P3_DIGIT_COUNT || !drawDateRaw) return
    const openCode = numbers.slice(0, P3_DIGIT_COUNT).map((n) => String(n))
    const drawAt = new Date(drawDateRaw)
    drawAt.setHours(P3_DRAW_HOUR, P3_DRAW_MINUTE, 0, 0)
    const startAt = drawAt.getTime()
    this.recordOpenCode.push({
      issue: period,
      openCode,
      time: { start: new Date(startAt).toISOString(), end: new Date(startAt).toISOString() },
      startAt,
      endAt: startAt
    })
  }

  /**
   * 回填「開獎歷史」：官方沒有「近 N 期列表」端點，但既然已知期別編號規則（民國年＋序號），
   * 就能用 `_prevOfficialPeriods()` 反推過去期別字串，逐一查詢官方單期端點取得實際開獎號碼
   * （比照 M649/D539 `_backfillHistory()`）。
   *
   * ⚠️ 已知限制（比照 M649/D539）：共用的 `fetchTaiwanLotteryDrawOf()` 內部硬性要求 `lotNumber.length >= 7`
   *   （為 DLT 6＋1 特別號設計），3星彩一期只有 3 碼，因此每期查詢都會回 null → 這裡對 P3
   *   等於「優雅無回填」。歷史會改由 bootstrap 種子期別＋每期真實結算逐步累積。要真正回填需放寬
   *   那支共用 helper 的 7 碼門檻，屬本次範圍外（指示要求不得修改 taiwanLotteryApi.ts）。
   */
  async _backfillHistory(count: number) {
    const known = new Set(this.recordOpenCode.map((r) => r.issue))
    const periods = _prevOfficialPeriods(this.lastKnownOfficialPeriod, count).filter((p) => !known.has(p))
    for (const period of periods) {
      try {
        const draw = await fetchTaiwanLotteryDrawOf(P3_GAME_CODE, period)
        if (!draw) {
          console.warn(`TTT---WARN.P3 回填歷史期別 ${period} 查無資料，略過`)
          continue
        }
        this._recordDraw(draw.period, draw.lotNumber, draw.drawDate)
      } catch (err) {
        console.warn(`TTT---WARN.P3 回填歷史期別 ${period} 失敗，略過`, err)
      }
    }
    this.recordOpenCode.sort((a, b) => a.startAt - b.startAt)
    if (this.recordOpenCode.length > 200) this.recordOpenCode = this.recordOpenCode.slice(-100)
  }

  /** 單期最多受理注數 = 追蹤到的最近一次頭獎（正彩）金額 ÷ 25 */
  quotaIssueMaxBets(): number {
    return Math.floor(Number(this.lastJackpotPrize || P3_QUOTA_FALLBACK_COIN) / P3_BET_AMOUNT)
  }

  /**
   * 「熱門選號」：統計本期（currentIssue）目前所有玩家已下注的「下注方式＋數字」組合，依下注
   * 人數（注數）由多到少排序取前 5 組；不足 5 組（含完全沒人下注）時，用隨機組合墊到滿 5 組
   * （組彩會避開豹子，見 `_randomBetPick()`）。
   */
  _popularNumbers(): Array<{ betType: P3BetType; digits: number[]; count: number }> {
    const issueOrders = (this._get.orders().get.orders.currentIssue(this.currentIssue) ?? []) as Array<{
      betCode: string[]
      playKey?: string
    }>

    const freq = new Map<string, number>()
    issueOrders.forEach((row) => {
      const code = (Array.isArray(row.betCode) ? row.betCode : [])[0]
      const betType = String(row.playKey ?? '')
      if (!code || !betType) return
      const key = `${betType}:${code}`
      freq.set(key, (freq.get(key) ?? 0) + 1)
    })

    const real = [...freq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, POPULAR_PICKS_COUNT)
      .map(([key, count]) => {
        const [betType, code] = key.split(':') as [P3BetType, string]
        return { betType, digits: code.split('').map(Number), count }
      })

    const usedKeys = new Set(real.map((r) => `${r.betType}:${r.digits.join('')}`))
    const padded = [...real]
    while (padded.length < POPULAR_PICKS_COUNT) {
      const pick = _randomBetPick()
      const key = `${pick.betType}:${pick.digits.join('')}`
      if (usedKeys.has(key)) continue
      usedKeys.add(key)
      padded.push({ ...pick, count: 0 })
    }
    return padded
  }

  /** 確保 currentIssue／cutoffAt／drawAt／currentStatus 對應到「現在」這個時間點該有的狀態 */
  _ensureIssue(now: Date) {
    if (!this.isBootstrapped) {
      // 還沒拿到任何官方期別基準，不分配 currentIssue、維持 PREPARE（playBets() 會擋單）
      this.currentStatus = STATUS_TIME.PREPARE
      return
    }
    if (!this.currentIssue || !this.cutoffAt || !this.drawAt) {
      const { drawDate, cutoffAt, drawAt } = _nextDrawWindow(now)
      this.currentIssue = _nextOfficialPeriod(drawDate, this.lastKnownOfficialPeriod)
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

  /** 輪詢頻率：起始 5 分鐘一次，超過 3 小時降頻為 30 分鐘一次，不設最終放棄時限 */
  _scheduleNextPoll(now: Date) {
    const pendingMs = now.getTime() - this.pendingSince
    const THREE_HOURS = 3 * 60 * 60 * 1000
    const FIVE_MIN = 5 * 60 * 1000
    const THIRTY_MIN = 30 * 60 * 1000
    const interval = pendingMs > THREE_HOURS ? THIRTY_MIN : FIVE_MIN
    if (pendingMs > THREE_HOURS && pendingMs - interval <= THREE_HOURS) {
      console.warn(`TTT---WARN.P3 官方資料超過 3 小時未到位（issue=${this.currentIssue}），降頻為每 30 分鐘輪詢一次`)
    }
    this.nextPollAt = now.getTime() + interval
  }

  async _attemptSettlement(now: Date) {
    const testOverride = this._testFetchOverride
    try {
      let period: string
      let lotNumber: number[]
      let tiers: TaiwanLotteryPrizeTier[]

      if (testOverride) {
        // 測試模式：不打外部官方 API，改用呼叫端指定的假資料（見 debugForceSettleNow）。
        // period 強制加上「（測試）」後綴，確保測試產生的紀錄永遠能跟真實開獎紀錄一眼分辨開來。
        period = `${testOverride.period}（測試）`
        lotNumber = testOverride.lotNumber
        tiers = P3_TIERS.map((t) => ({
          label: t.label,
          winnerCount: Number(testOverride.tiers?.[t.key] ?? 0) > 0 ? 1 : 0,
          perPrize: Number(testOverride.tiers?.[t.key] ?? 0)
        }))
      } else {
        const last = await fetchTaiwanLotteryLastNumberOf(P3_GAME_CODE)
        period = String(last?.period ?? '')
        lotNumber = Array.isArray(last?.lotNumber) ? last!.lotNumber.map((n) => Number(n)) : []
        // 官方「最新一期」還沒變、或號碼還沒給滿 3 個，代表尚未到位
        if (!period || period === this.lastKnownOfficialPeriod || lotNumber.length < P3_DIGIT_COUNT) {
          this._scheduleNextPoll(now)
          return
        }
        const prize = await fetchTaiwanLotteryPrize(P3_GAME_CODE, period)
        if (!prize?.tiers?.length) {
          this._scheduleNextPoll(now)
          return
        }
        tiers = prize.tiers
      }

      if (lotNumber.length < P3_DIGIT_COUNT) {
        if (!testOverride) this._scheduleNextPoll(now)
        return
      }
      const winningNumbers = lotNumber.slice(0, P3_DIGIT_COUNT)

      const settledIssue = this.currentIssue // 這期剛被結算掉的內部期別，下面推進序號要用到
      this._settleIssue(settledIssue, period, winningNumbers, tiers, Boolean(testOverride))

      // ⚠️ 測試模式（p3-test-draw）到此為止：只驗證「真實下注 → 依假開獎號正確判定/派彩」，
      // 絕不能再往下動 currentIssue／cutoffAt／drawAt／lastKnownOfficialPeriod 這些真正的期別
      // 追蹤狀態——這些欄位要拿來跟官方 API 對齊，一旦被測試呼叫悄悄推進，站上顯示的期號就會跟
      // 官方真實序號脫鉤，且無法回復（只能重啟 server）。比照 m649.ts／d539.ts 的既有防護。
      if (testOverride) return

      this.lastKnownOfficialPeriod = period

      // 這一期結算完成，往下一個開獎日推進。序號基準取「官方最新已知期別」與「剛結算掉的
      // 內部期別」兩者較大的一個——理論上兩者這時應該相等，保留這層比較純粹是防禦性寫法。
      const seedPeriod = _laterOfficialPeriod(this.lastKnownOfficialPeriod, settledIssue)
      const { drawDate, cutoffAt, drawAt } = _nextDrawWindow(new Date(this.drawAt + 60_000))
      this.currentIssue = _nextOfficialPeriod(drawDate, seedPeriod)
      this.cutoffAt = cutoffAt
      this.drawAt = drawAt
      this.pendingSince = 0
      this.nextPollAt = 0
      this._refreshStatus(now)
    } catch (err) {
      console.warn('TTT---WARN.P3 結算輪詢失敗，稍後重試', err)
      if (!testOverride) this._scheduleNextPoll(now)
    } finally {
      this._testFetchOverride = null
    }
  }

  /**
   * 測試用：強制立刻跑一次 `_attemptSettlement()`，用假資料取代外部官方 API 呼叫，
   * 不用等真實開獎時間、也不受目前 currentStatus 是否為 pending-settlement 限制
   * （見 server/api/admin/p3-test-draw.post.ts，供 scripts/test-p3.mjs 隨時呼叫）。
   */
  async debugForceSettleNow(override: { period: string; lotNumber: number[]; tiers: Partial<Record<P3TierKey, number>> }) {
    this._testFetchOverride = override
    await this._attemptSettlement(MEMORY.now)
  }

  /**
   * 結算一期：逐注依 betType 走不同判定 → 中則派彩：
   *   zhengcai（正彩）→ p3IsExactMatch → 官方 lotto3DFirstAssign 的 perPrize
   *   zucai（組彩）→ p3GroupTierOf → 二獎/三獎對應官方 perPrize
   *   front-pair／back-pair（對彩）→ p3IsFrontPairMatch／p3IsBackPairMatch → 固定 P3_PAIR_PRIZE
   * 完成後把官方真實開獎號寫進 recordOpenCode（歷史／冷熱號用），並在正彩有金額時更新 lastJackpotPrize。
   *
   * @param isTest 是否為 admin 測試呼叫。測試模式刻意不用 `issueSettledMap` 這個「整期只結算一次」
   *   的全域鎖，改成逐注判斷（只處理仍是 pending 的注單），這樣反覆測試才不會重複發錢，且不會誤把
   *   真正期別鎖成已結算（比照 m649.ts／d539.ts 的既有設計）。
   */
  _settleIssue(
    internalIssue: string,
    officialPeriod: string,
    winningNumbers: number[],
    tiers: TaiwanLotteryPrizeTier[],
    isTest = false
  ) {
    if (!isTest && this.issueSettledMap[internalIssue]) return

    const perPrizeOf = (tierKey: P3TierKey): number => {
      const idx = P3_TIERS.findIndex((t) => t.key === tierKey)
      return Number(tiers[idx]?.perPrize ?? 0)
    }

    const issueOrders = (this._get.orders().get.orders.currentIssue(internalIssue) ?? []) as Array<{
      userId: string
      orderId: string
      coin: number
      betCode: string[]
      playKey?: string
    }>

    const payoutByUser = new Map<string, number>()

    issueOrders.forEach((row) => {
      const record = this.handle.ensureUserRecord(this._get.user(row.userId))
      const idx = record.betHistory.findIndex((item) => String(item.orderId) === String(row.orderId))
      const current = record.betHistory[idx]
      // 測試模式沒有 issueSettledMap 擋重複呼叫，改成逐注擋：已經判定過（非 pending）的注單
      // 不重複派彩，避免同一注在反覆測試呼叫下被多次計入 payoutByUser 重複發錢。
      if (isTest && current && current.winStatus !== 'pending') return

      const betType = String(row.playKey ?? '') as P3BetType
      const code = (Array.isArray(row.betCode) ? row.betCode : [])[0] ?? ''
      const bet = p3DigitsOf(code)

      let resultKey: string | null = null
      let payout = 0

      if (bet) {
        if (betType === 'zhengcai') {
          if (p3IsExactMatch(bet, winningNumbers)) {
            resultKey = 'lotto3DFirstAssign'
            payout = perPrizeOf('lotto3DFirstAssign')
          }
        } else if (betType === 'zucai') {
          const tier = p3GroupTierOf(bet, winningNumbers)
          if (tier === '二獎') {
            resultKey = 'lotto3DSecondAssign'
            payout = perPrizeOf('lotto3DSecondAssign')
          } else if (tier === '三獎') {
            resultKey = 'lotto3DThirdAssign'
            payout = perPrizeOf('lotto3DThirdAssign')
          }
        } else if (betType === 'front-pair') {
          if (p3IsFrontPairMatch(bet, winningNumbers)) {
            resultKey = 'front-pair'
            payout = P3_PAIR_PRIZE
          }
        } else if (betType === 'back-pair') {
          if (p3IsBackPairMatch(bet, winningNumbers)) {
            resultKey = 'back-pair'
            payout = P3_PAIR_PRIZE
          }
        }
      }

      if (idx >= 0 && current) {
        record.betHistory[idx] = {
          ...current,
          openCode: [...winningNumbers.map((n) => String(n))],
          tierKey: resultKey,
          tierLabel: resultKey ? (TIER_LABEL[resultKey] ?? '') : '',
          winStatus: payout > 0 ? 'win' : 'lose',
          winAmount: payout
        }
      }
      if (payout > 0) {
        payoutByUser.set(row.userId, Number((Number(payoutByUser.get(row.userId) ?? 0) + payout).toFixed(2)))
      }
    })

    const officialOpenCode = winningNumbers.map((n) => String(n))
    const startAt = this.drawAt
    this.recordOpenCode.push({
      issue: officialPeriod,
      openCode: officialOpenCode,
      time: { start: new Date(startAt).toISOString(), end: new Date(startAt).toISOString() },
      startAt,
      endAt: startAt
    })
    if (this.recordOpenCode.length > 200) this.recordOpenCode = this.recordOpenCode.slice(-100)

    // 正彩（lotto3DFirstAssign）為最高獎項，拿它的 perPrize 當「單期額度上限」推算基準（見 quotaIssueMaxBets）
    const topPrize = perPrizeOf('lotto3DFirstAssign')
    if (topPrize > 0) this.lastJackpotPrize = topPrize

    payoutByUser.forEach((amount, userId) => {
      this.handle.pushClaimable(userId, internalIssue, amount, officialOpenCode)
    })

    if (!isTest) this.issueSettledMap[internalIssue] = true
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

    const totalAmount = betCodes.length * P3_BET_AMOUNT
    const beforeCoin = Number(user?.coin ?? 0)
    if (beforeCoin < totalAmount) {
      throw createError({ statusCode: 400, message: '餘額不足' })
    }
    user.coin = Number((beforeCoin - totalAmount).toFixed(2))
    const afterCoin = Number(user?.coin ?? 0)

    const rows: BetOrderRow[] = betCodes.map((b) => ({
      issue,
      user_id: userId,
      bet_time: Date.now(),
      coin: P3_BET_AMOUNT,
      order_id: this.handle.createOrderId(issue),
      bet_code: b.code,
      bet_type: b.betType
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
        betCode: [row.bet_code],
        playKey: row.bet_type
      })
      this.handle.appendBetHistory(row)
    })

    return {
      orderId: rows[0]?.order_id ?? '',
      orders: rows.map((row) => ({
        issue: row.issue,
        orderId: row.order_id,
        coin: row.coin,
        betCode: row.bet_code,
        betType: row.bet_type
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
