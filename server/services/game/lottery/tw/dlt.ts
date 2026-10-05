import { Storage } from 'serv/services/storage'
import { LOTTERY, STATUS_TIME } from '~/config/constants'
import LOTTERY_BASE from './base'
import { nextDrawWindow, type DrawSchedule } from './drawSchedule'
import { MEMORY } from 'serv/services/base'
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
  DLT_NUMBER_MIN,
  DLT_NUMBER_MAX,
  DLT_PICK_COUNT,
  dltTierOf,
  dltNormalizeBetCode,
  type DltTierKey
} from '#shared/config/dlt'
import { dltQuotaOf } from '#shared/config/dlt/helpers'
import {
  fetchTaiwanLotteryLastNumberOf,
  fetchTaiwanLotteryPrize,
  fetchTaiwanLotteryDrawOf,
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
 * ── 期別模型：下注用的 currentIssue 直接對齊官方期別格式 ──────────
 *   官方期別＝民國年 3 碼＋該年度序號 6 碼（例如 "115000087" = 民國 115 年第 87 期，
 *   使用者從官方資料確認過的編號規則）。official period 在開獎前查不到（last-number.get.ts
 *   只能查「已開獎」的最新一期），沒辦法在下注開放當下直接跟官方要「下一期是誰」，
 *   但只要有「已知的最新一期官方 period」當基準，下一期就能用同一套規則（同年序號 +1、
 *   跨年重置為 1）精準推算出來——見 `_nextOfficialPeriod()`。
 *
 *   這個「已知基準」由兩個地方維護：
 *     1. `_bootstrapOfficialPeriod()`：server 啟動時先打一次官方 API 拿「目前最新一期」，
 *        在拿到有效結果之前，`isBootstrapped` 維持 false、`_ensureIssue()` 不會分配任何
 *        currentIssue（`currentStatus` 停在 PREPARE，`playBets()` 會擋單），避免在完全沒有
 *        任何官方資料基準的情況下瞎猜序號起點（例如猜成「該年度第 1 期」）。
 *     2. `_attemptSettlement()`：每次真的偵測到官方開出新一期，就把 `lastKnownOfficialPeriod`
 *        更新成那個真實 period，下一期 currentIssue 又以它為基準往前推一期——即使推算的
 *        currentIssue 跟官方實際分配的下一期意外對不上（例如官方臨時取消某次開獎），
 *        每次真正開獎後都會用官方回傳的真實 period 重新校正，不會累積誤差、也不影響結算
 *        判定（結算永遠是拿 `officialPeriod` 這個真實值去查獎金、寫入 `recordOpenCode`，
 *        `internalIssue`／`currentIssue` 只用來對應站內下注紀錄，兩者從不假設一定相等）。
 *
 * ── 一次送單可含 A~E 最多 5 組（見 design.md Decision 8/9）──────────
 *   每組都是一次獨立、完整的 6 碼投注，各自固定 50 coin、各自獨立判定與派彩，不是複式。
 */

const DLT_GAME_CODE = 5118
/** 啟動時回填「開獎歷史」的期數（同一民國年度內往回推，見 `_prevOfficialPeriods()`） */
const DLT_BACKFILL_COUNT = 10
/** 「熱門選號」固定顯示幾組（見 `get.popularNumbers`） */
const POPULAR_PICKS_COUNT = 5

/** 隨機產生一組 6 個不重複、由小到大排序的號碼（1~49），供「熱門選號」在還沒有人下注時墊底用 */
function _randomBetCode(): number[] {
  const pool = Array.from({ length: DLT_NUMBER_MAX - DLT_NUMBER_MIN + 1 }, (_, i) => i + DLT_NUMBER_MIN)
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = pool[i] as number
    pool[i] = pool[j] as number
    pool[j] = tmp
  }
  return pool.slice(0, DLT_PICK_COUNT).sort((a, b) => a - b)
}

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

/** 解析官方期別字串（民國年 3 碼＋該年度序號 6 碼，例如 "115000087" → 民國 115 年第 87 期） */
function _parseOfficialPeriod(period: string): { rocYear: number; seq: number } | null {
  const m = /^(\d{3})(\d{6})$/.exec(String(period ?? ''))
  if (!m) return null
  return { rocYear: Number(m[1]), seq: Number(m[2]) }
}

/**
 * 依「即將開獎的日曆日期」＋「已知的官方最新一期」，推算下一期的官方期別字串
 * （民國年 3 碼＋該年度序號 6 碼）。民國年直接由 drawDate 的西元年反推（年 - 1911），
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
 * 用來確保 currentIssue 的推進基準只會往前走，不會撞回已經結算過的舊期別
 * （見 `_attemptSettlement()` 結算後推進那段的說明）。
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
 * 以 `latest` 為基準，往回推算最多 `count` 個「同一民國年度」的官方期別字串（用於回填歷史，
 * 見 `_backfillHistory()`）。⚠️ 刻意不跨年往回推——序號重置為 1 只知道「今年第 1 期」的位置，
 * 不知道「去年最後一期是第幾期」，跨年瞎猜會產生不存在的期別，寧可少回填幾筆也不猜錯。
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

/** 開獎與鎖單時間（台灣時間）；下一期的計算見 `./drawSchedule.ts` 的 `nextDrawWindow()` */
const DRAW_SCHEDULE: DrawSchedule = {
  weekdays: DLT_DRAW_WEEKDAYS,
  cutoff: { hour: DLT_CUTOFF_HOUR, minute: DLT_CUTOFF_MINUTE },
  draw: { hour: DLT_DRAW_HOUR, minute: DLT_DRAW_MINUTE }
}

export default class DltClass extends LOTTERY_BASE {
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
  /** 追蹤到的「最近一次真的有人中頭獎」金額，尚無歷史時用回退預設值（見 Decision 3） */
  lastJackpotPrize: number
  /**
   * 測試用：設定後，`_attemptSettlement()` 不會呼叫外部官方 API，改用這裡的假資料
   * （見 `debugForceSettleNow`／`server/api/admin/dlt-test-draw.post.ts`）。用完自動清空
   * （`_attemptSettlement` 的 finally 區塊），一次只影響一次呼叫。
   */
  _testFetchOverride: { period: string; lotNumber: number[]; tiers: Partial<Record<DltTierKey, number>> } | null

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
      popularNumbers: Array<{ betCode: number[]; count: number }>
    }
    tiers: () => Array<{ key: DltTierKey; label: string; desc: string | null }>
  }

  constructor() {
    super(LOTTERY.DLT.key, LOTTERY.DLT.id)
    this.currentIssue = ''
    this.isBootstrapped = false
    this.cutoffAt = 0
    this.drawAt = 0
    this.pendingSince = 0
    this.nextPollAt = 0
    this.isSettling = false
    this.lastKnownOfficialPeriod = ''
    this.issueSettledMap = {}
    this.lastJackpotPrize = DLT_QUOTA_FALLBACK_COIN
    this._testFetchOverride = null

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
      tiers: () => DLT_TIERS.map((t) => ({ key: t.key, label: t.label, desc: null }))
    })

    this.init()
  }

  init() {
    console.log('TTT---RUN.DLT.鏡射官方大樂透')
    Storage.games[this.key] = this
    LOTTERY_BASE.getOrders(this.id, this.key)
    this._bootstrapOfficialPeriod()
  }

  /**
   * server 啟動後第一次打官方 API 拿「目前最新一期」，成功後才允許 `_ensureIssue()` 分配
   * currentIssue（否則永遠不知道序號該從哪裡接續，見類別開頭的期別模型說明）。
   * 失敗（含網路逾時）就 5 秒後重試，重試期間 `currentStatus` 停在 PREPARE、下注會被擋下，
   * 不會用猜的期別頂著先開放下注。
   */
  async _bootstrapOfficialPeriod() {
    try {
      const last = await fetchTaiwanLotteryLastNumberOf(DLT_GAME_CODE)
      if (last?.period) {
        this.lastKnownOfficialPeriod = String(last.period)
        this.isBootstrapped = true
        this._ensureIssue(MEMORY.now)
        // bootstrap 當下拿到的這期本身也是一筆真實開獎資料，順手直接記進歷史——它是
        // 「已知的最新一期」，往後的正常結算流程只會記錄比它更新的期別，這期不記的話
        // 永遠不會出現在 recordOpenCode（見 _recordDraw() 說明）
        this._recordDraw(String(last.period), last.lotNumber ?? [], String(last.drawDate ?? ''))
        // 不 await：回填是為了讓「開獎歷史」提早有資料可看，跟下注開放與否無關，
        // 失敗也不影響本站正常運作（見 _backfillHistory() 內部的錯誤處理）
        this._backfillHistory(DLT_BACKFILL_COUNT)
        return
      }
      console.warn('TTT---WARN.DLT 啟動時官方 API 沒有回傳有效期別，5 秒後重試')
    } catch (err) {
      console.warn('TTT---WARN.DLT 啟動時查詢官方最新期別失敗，5 秒後重試', err)
    }
    setTimeout(() => { this._bootstrapOfficialPeriod() }, 5000)
  }

  /**
   * 把一期「已知的真實開獎資料」寫進 recordOpenCode（該期已存在就略過，不重複寫入）。
   * 供 `_bootstrapOfficialPeriod()`（bootstrap 種子期別本身）與 `_backfillHistory()`
   * （回填的過去期別）共用同一份「組裝 record／寫入」邏輯。
   */
  _recordDraw(period: string, lotNumber: Array<number | string>, drawDateRaw: string) {
    if (!period || this.recordOpenCode.some((r) => r.issue === period)) return
    const numbers = lotNumber.map((n) => Number(n))
    if (numbers.length < 7 || !drawDateRaw) return
    const openCode = numbers.map((n) => String(n).padStart(2, '0'))
    const drawAt = new Date(drawDateRaw)
    drawAt.setHours(DLT_DRAW_HOUR, DLT_DRAW_MINUTE, 0, 0)
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
   * 回填「開獎歷史」：官方沒有「近 N 期列表」端點，但既然已經知道期別編號規則（民國年＋
   * 該年度序號，見 `_nextOfficialPeriod()`），就能用 `_prevOfficialPeriods()` 反推過去期別
   * 字串，逐一查詢官方單期端點取得實際開獎號碼，補進 `recordOpenCode`——這推翻了
   * `openspec/changes/add-dlt/design.md` Decision 4／Non-Goal「官方沒有對應端點、無法回填」
   * 的舊結論（當初卡住的是「不知道怎麼猜期別字串」，不是端點本身不存在）。
   *
   * ⚠️ 只回填「站上完全沒有紀錄」的期別（不含帶「（測試）」後綴的假資料），避免跟真實結算
   * 寫入的紀錄重複；任一期查詢失敗只 log 警告、跳過該期，不影響其餘期別或站台其他功能。
   * ⚠️ 只回填「比目前已知最新一期更舊」的期別——最新一期本身在 `_bootstrapOfficialPeriod()`
   * 就已經用 `_recordDraw()` 記過了，這裡不重複查。
   */
  async _backfillHistory(count: number) {
    const known = new Set(this.recordOpenCode.map((r) => r.issue))
    const periods = _prevOfficialPeriods(this.lastKnownOfficialPeriod, count).filter((p) => !known.has(p))
    for (const period of periods) {
      try {
        const draw = await fetchTaiwanLotteryDrawOf(DLT_GAME_CODE, period)
        if (!draw) {
          console.warn(`TTT---WARN.DLT 回填歷史期別 ${period} 查無資料，略過`)
          continue
        }
        this._recordDraw(draw.period, draw.lotNumber, draw.drawDate)
      } catch (err) {
        console.warn(`TTT---WARN.DLT 回填歷史期別 ${period} 失敗，略過`, err)
      }
    }
    this.recordOpenCode.sort((a, b) => a.startAt - b.startAt)
    if (this.recordOpenCode.length > 200) this.recordOpenCode = this.recordOpenCode.slice(-100)
  }

  /** 單期最多受理注數 = 追蹤到的最近一次頭獎金額 ÷ 50（見 design.md Decision 3） */
  quotaIssueMaxBets(): number {
    return Math.floor(Number(this.lastJackpotPrize || DLT_QUOTA_FALLBACK_COIN) / DLT_BET_AMOUNT)
  }

  /**
   * 「熱門選號」：統計本期（currentIssue）目前所有玩家已下注的注碼，依下注人數（注數）
   * 由多到少排序取前 5 組；不足 5 組（含完全沒人下注）時，用隨機號碼墊到滿 5 組——
   * 前端固定顯示 5 列，不會因為本期下注組合不夠而少顯示（見 PopularPicks.vue／
   * History.vue「來一注」共用的 applyNumbers() 前端邏輯，這裡只負責提供號碼來源）。
   */
  _popularNumbers(): Array<{ betCode: number[]; count: number }> {
    const issueOrders = (this._get.orders().get.orders.currentIssue(this.currentIssue) ?? []) as Array<{
      betCode: string[]
    }>

    const freq = new Map<string, number>()
    issueOrders.forEach((row) => {
      const code = (Array.isArray(row.betCode) ? row.betCode : [])[0]
      if (code) freq.set(code, (freq.get(code) ?? 0) + 1)
    })

    const real = [...freq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, POPULAR_PICKS_COUNT)
      .map(([code, count]) => ({ betCode: code.split(',').map(Number), count }))

    const usedKeys = new Set(real.map((r) => r.betCode.join(',')))
    const padded = [...real]
    while (padded.length < POPULAR_PICKS_COUNT) {
      const betCode = _randomBetCode()
      const key = betCode.join(',')
      if (usedKeys.has(key)) continue
      usedKeys.add(key)
      padded.push({ betCode, count: 0 })
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
      const { drawDate, cutoffAt, drawAt } = nextDrawWindow(now, DRAW_SCHEDULE)
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
    const testOverride = this._testFetchOverride
    try {
      let period: string
      let lotNumber: number[]
      let tiers: TaiwanLotteryPrizeTier[]

      if (testOverride) {
        // 測試模式：不打外部官方 API，改用呼叫端指定的假資料（見 debugForceSettleNow）。
        // period 強制加上「（測試）」後綴，確保測試產生的紀錄（recordOpenCode／史紀錄）
        // 永遠能跟真實開獎紀錄一眼分辨開來，使用者要求「紀錄不用移除」所以不清也不特別標記別的地方。
        period = `${testOverride.period}（測試）`
        lotNumber = testOverride.lotNumber
        tiers = DLT_TIERS.map((t) => ({
          label: t.label,
          winnerCount: Number(testOverride.tiers?.[t.key] ?? 0) > 0 ? 1 : 0,
          perPrize: Number(testOverride.tiers?.[t.key] ?? 0)
        }))
      } else {
        const last = await fetchTaiwanLotteryLastNumberOf(DLT_GAME_CODE)
        period = String(last?.period ?? '')
        lotNumber = Array.isArray(last?.lotNumber) ? last!.lotNumber.map((n) => Number(n)) : []
        // 官方「最新一期」還沒變、或號碼還沒給滿 7 個（6 一般號+1 特別號），代表尚未到位
        if (!period || period === this.lastKnownOfficialPeriod || lotNumber.length < 7) {
          this._scheduleNextPoll(now)
          return
        }
        const prize = await fetchTaiwanLotteryPrize(DLT_GAME_CODE, period)
        if (!prize?.tiers?.length) {
          this._scheduleNextPoll(now)
          return
        }
        tiers = prize.tiers
      }

      if (lotNumber.length < 7) {
        if (!testOverride) this._scheduleNextPoll(now)
        return
      }
      const winningNumbers = lotNumber.slice(0, 6)
      const special = lotNumber[6]

      const settledIssue = this.currentIssue // 這期剛被結算掉的內部期別，下面推進序號要用到
      this._settleIssue(settledIssue, period, winningNumbers, Number(special), tiers, Boolean(testOverride))

      // ⚠️ 測試模式（dlt-test-draw）到此為止：只驗證「真實下注 → 依假開獎號正確判定/派彩」，
      // 絕不能再往下動 currentIssue／cutoffAt／drawAt／lastKnownOfficialPeriod 這些真正的期別
      // 追蹤狀態——這些欄位是要拿來跟官方 API 對得上的，一旦被測試呼叫（尤其是重複呼叫）
      // 悄悄推進，站上顯示的期號就會跟官方真實序號脫鉤，且無法回復（只能重啟 server）。
      // 見使用者回報：對齊官方期別格式後，反覆跑測試腳本讓 currentIssue 從 115000088
      // 一路被推到 115000091，跟官方最新一期對不起來。
      if (testOverride) return

      this.lastKnownOfficialPeriod = period

      // 這一期結算完成，往下一個開獎日推進。序號基準取「官方最新已知期別」與「剛結算掉的
      // 內部期別」兩者較大的一個（見 `_laterOfficialPeriod`）——理論上兩者這時應該相等
      // （都剛被設成 period／settledIssue），保留這層比較純粹是防禦性寫法。
      const seedPeriod = _laterOfficialPeriod(this.lastKnownOfficialPeriod, settledIssue)
      /**
       * ⚠️ 用真正的 now（這次結算當下的實際時間）當基準找下一個開獎日，不能用
       * this.drawAt（舊的內部時間）往後推——後者一旦落後真實時間（例如本機休眠
       * 超過一個完整開獎週期），nextDrawWindow() 會從落後的起點繼續往後搜尋，
       * 絕對的時間差永遠不會縮小，cutoffAt 永遠停在過去，狀態永久卡在「結算中
       * （等待官方資料）」、無法再開放下注（見 fix-bingo-stuck-settlement-clock-
       * drift，bingo.ts 實測重現過同一個根因，這裡用同一套修法）。
       */
      const { drawDate, cutoffAt, drawAt } = nextDrawWindow(now, DRAW_SCHEDULE)
      this.currentIssue = _nextOfficialPeriod(drawDate, seedPeriod)
      this.cutoffAt = cutoffAt
      this.drawAt = drawAt
      this.pendingSince = 0
      this.nextPollAt = 0
      this._refreshStatus(now)
    } catch (err) {
      console.warn('TTT---WARN.DLT 結算輪詢失敗，稍後重試', err)
      if (!testOverride) this._scheduleNextPoll(now)
    } finally {
      this._testFetchOverride = null
    }
  }

  /**
   * 測試用：強制立刻跑一次 `_attemptSettlement()`，用假資料取代外部官方 API 呼叫，
   * 不用等真實開獎時間、也不受目前 currentStatus 是否為 pending-settlement 限制
   * （見 server/api/admin/dlt-test-draw.post.ts，保留下來供 test/test-dlt.mjs 隨時呼叫）。
   */
  async debugForceSettleNow(override: { period: string; lotNumber: number[]; tiers: Partial<Record<DltTierKey, number>> }) {
    this._testFetchOverride = override
    await this._attemptSettlement(MEMORY.now)
  }

  /**
   * 結算一期：逐注以 dltTierOf() 分類 → 派彩＝官方當期該獎項 perPrize；
   * 完成後把官方真實開獎號寫進 recordOpenCode（歷史／冷熱號用，見 Decision 4），
   * 並在頭獎有人中時更新 lastJackpotPrize（見 Decision 3）。
   *
   * @param isTest 是否為 admin 測試呼叫（見 dlt-test-draw）。測試模式刻意不用
   *   `issueSettledMap` 這個「整期只結算一次」的全域鎖：測試不會推進真正的
   *   currentIssue（見 `_attemptSettlement()`），代表反覆呼叫測試工具會一直結算
   *   「同一個」真正的期別——若沿用同一把鎖，第一次測試呼叫就會把這期永久標記
   *   成「已結算」，之後這期真正開獎時，真實結算會被這把鎖誤擋，注單永遠卡在
   *   pending。測試模式改成逐注判斷：只處理該注目前還是 `pending` 狀態的注單，
   *   已經測試過（win/lose）的注單不重複派彩，這樣重複測試才不會重複發錢。
   */
  _settleIssue(
    internalIssue: string,
    officialPeriod: string,
    winningNumbers: number[],
    special: number,
    tiers: TaiwanLotteryPrizeTier[],
    isTest = false
  ) {
    if (!isTest && this.issueSettledMap[internalIssue]) return

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
      const record = this.handle.ensureUserRecord(this._get.user(row.userId))
      const idx = record.betHistory.findIndex((item) => String(item.orderId) === String(row.orderId))
      const current = record.betHistory[idx]
      // 測試模式沒有 issueSettledMap 擋重複呼叫，改成逐注擋：已經判定過（非 pending）
      // 的注單不重複派彩，避免同一注在反覆測試呼叫下被多次計入 payoutByUser 重複發錢。
      if (isTest && current && current.winStatus !== 'pending') return

      const betCode = (Array.isArray(row.betCode) ? row.betCode : [])[0] ?? ''
      const tierKey = dltTierOf(betCode, winningNumbers, special)
      const payout = tierKey ? perPrizeOf(tierKey) : 0

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
