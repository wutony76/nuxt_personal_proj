import { Storage } from '../../../storage'
import { LOTTERY, STATUS_TIME } from '~/config/constants'
import LOTTERY_BASE from './base'
import { MEMORY } from '../../../base'
import {
  BINGO_BET_UNIT,
  BINGO_MAX_SLOTS,
  BINGO_DRAWN_COUNT,
  BINGO_NUMBER_MIN,
  BINGO_NUMBER_MAX,
  BINGO_SUPER_NUMBER_PRIZE,
  BINGO_BIG_SMALL_PRIZE,
  BINGO_ODD_EVEN_PRIZE,
  BINGO_BET_TYPES,
  bingoValidateStarNumbers,
  bingoIsValidNumber,
  bingoStarPrize,
  bingoCountHits,
  bingoSuperNumberHit,
  bingoJudgeBigSmall,
  bingoJudgeOddEven,
  bingoSuperNumberOf,
  bingoEncodeSlot,
  bingoDecodeSlot,
  type BingoBetType,
  type BingoSlot,
  type BingoDraw
} from '#shared/config/bingo'
import { fetchTaiwanLotteryLastNumberOf } from './taiwanLotteryApi'

/**
 * 賓果賓果（BINGO）——tw 分類、開獎號碼鏡射官方，但架構跟其他 7 款玩法（DLT/威力彩/今彩539/
 * 樂合彩/3星彩/4星彩）完全不同，見 openspec/changes/add-tw-lottery-suite/design.md Decision 6：
 *
 * ── 官方沒有中獎明細端點，賠率表全部寫死常數 ──────────────────────────────
 *   `taiwanLotteryApi.ts` 的 `GAME_DEFS` 故意排除 gameCode 1102，本 service 只呼叫
 *   `fetchTaiwanLotteryLastNumberOf(1102)` 拿開獎號碼；4 種投注類型（基本玩法/超級獎號/
 *   猜大小/猜單雙）的賠率全部查 `shared/config/bingo.ts` 的固定常數表，不查任何官方 API。
 *
 * ── 每 5 分鐘連續開一期，不是「星期幾開獎」的日曆模式 ─────────────────────
 *   跟 P3/P4/M649 那種「找下一個開獎日」完全不同，本檔**不**使用日曆式 `_nextDrawWindow`，
 *   改用「對齊下一個 5 分鐘整點」（`_nextFiveMinuteBoundary`）＋「已知官方最新期別序號 +1」
 *   （`_nextOfficialPeriod`，不依賴日期反推民國年）推進期別。`cutoffAt` 直接等於 `drawAt`
 *   （下注開放到開獎那一刻為止，沒有跨日等待的「已封盤」中間態）。
 *
 * ── 沒有回填歷史 ──────────────────────────────────────────────────────
 *   官方沒有「查詢特定期別」端點（`GAME_DEFS` 沒有 1102 設定），`_backfillHistory` 這件事
 *   對賓果賓果完全做不到（即使反推出期別字串也沒有端點可查），本檔不提供這個方法，只在
 *   bootstrap 當下把抓到的這一期記進歷史，之後靠每期真實結算逐步累積。
 *
 * ── 一個期號只產生一份開獎結果，4 種投注類型共用 ─────────────────────────
 *   `_attemptSettlement()` 每期只呼叫一次 `fetchTaiwanLotteryLastNumberOf(1102)`、只組出
 *   一份 `BingoDraw`，傳給 `_settleIssue()` 給 4 種投注類型共用判定，不得各自呼叫。
 */

const BINGO_GAME_CODE = 1102
const FIVE_MIN_MS = 5 * 60 * 1000
/** 輪詢間隔：官方每 5 分鐘必定有新資料，不採 P3/M649 那種「5 分鐘/30 分鐘」降頻設計 */
const POLL_INTERVAL_MS = 12_000
/** 超過這麼久還沒等到新期別，記一次 warning（寬鬆容錯，不中斷輪詢） */
const PENDING_WARN_THRESHOLD_MS = 2 * 60 * 1000
/** 「熱門選號」固定顯示幾組（比照 M539 `_popularNumbers()`，只統計基本玩法／star 這個有「選號」概念的類型） */
const POPULAR_PICKS_COUNT = 5
/** 「熱門選號」固定只統計／墊底「3 星」注碼（使用者指定：其他星數不列入熱門選號） */
const POPULAR_PICKS_STAR = 3

/** 隨機產生一組合法的 3 星注碼（3 個不重複的 01~80 號碼），供「熱門選號」墊底用 */
function _randomStarPick(): { star: number; numbers: number[] } {
  const pool = Array.from({ length: BINGO_NUMBER_MAX - BINGO_NUMBER_MIN + 1 }, (_, i) => BINGO_NUMBER_MIN + i)
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = pool[i] as number
    pool[i] = pool[j] as number
    pool[j] = tmp
  }
  return { star: POPULAR_PICKS_STAR, numbers: pool.slice(0, POPULAR_PICKS_STAR).sort((a, b) => a - b) }
}

/** 對齊到「嚴格晚於 now」的下一個 5 分鐘整點（例：15:07:23→15:10:00；15:10:00 整點→15:15:00） */
function _nextFiveMinuteBoundary(now: Date): Date {
  const ms = now.getTime()
  const next = (Math.floor(ms / FIVE_MIN_MS) + 1) * FIVE_MIN_MS
  return new Date(next)
}

/** 解析官方期別字串（民國年 3 碼＋序號 6 碼，例如 "115052675"），格式不符回 null */
function _parseOfficialPeriod(period: string): { rocYear: number; seq: number } | null {
  const m = /^(\d{3})(\d{6})$/.exec(String(period ?? ''))
  if (!m) return null
  return { rocYear: Number(m[1]), seq: Number(m[2]) }
}

/**
 * 下一期官方期別＝已知最新期別序號 +1（同一民國年）。
 * ⚠️ 跟 P3/M649 不同：不依「即將開獎的日曆日期」反推民國年——賓果賓果一天 288 期，
 * 沒有「這天的民國年」這種概念，直接沿用已知期別的民國年＋序號+1；若官方下一次回傳的
 * 期別 rocYear 實際上已經跨年，以官方真正回傳的值為準（見 `_attemptSettlement` 用
 * `_laterOfficialPeriod` 校正基準，不強行套用這裡猜測的序號）。
 */
function _nextOfficialPeriod(lastKnownOfficialPeriod: string): string {
  const parsed = _parseOfficialPeriod(lastKnownOfficialPeriod)
  if (!parsed) return lastKnownOfficialPeriod
  const seq = parsed.seq + 1
  return `${String(parsed.rocYear).padStart(3, '0')}${String(seq).padStart(6, '0')}`
}

/** 回傳兩個官方格式期別字串中「數值較大」的那個；格式不符的一律視為比另一個小（防禦性寫法，比照 P3/M649） */
function _laterOfficialPeriod(a: string, b: string): string {
  const pa = _parseOfficialPeriod(a)
  const pb = _parseOfficialPeriod(b)
  if (!pa) return b
  if (!pb) return a
  if (pa.rocYear !== pb.rocYear) return pa.rocYear > pb.rocYear ? a : b
  return pa.seq >= pb.seq ? a : b
}

type PlayBetsPayload = { amount?: number; slots?: BingoSlot[] }

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
  betType: BingoBetType
  /** 顯示用注碼摘要（星數玩法："5 星｜03,12,44,60,77"；超級獎號："42"；大小/單雙：pick） */
  betLabel: string
  /** 官方開出的 20 個號碼（依開球順序），結算前為空陣列 */
  openCode: string[]
  /** 官方超級獎號（第 20 個開出的號碼），結算前為空字串 */
  superNumber: string
  winStatus: 'pending' | 'win' | 'lose' | 'push'
  winAmount: number
}
type UserClaimableIssue = { issue: string; amount: number; openCode: string[]; createdAt: number }
type UserRecord = {
  balanceChanges: UserBalanceChange[]
  betHistory: UserBetHistory[]
  claimableIssues: UserClaimableIssue[]
  updatedAt: number
}
type UserStoreLike = { userId?: string; coin?: number; bingoRecord?: UserRecord }

type BetOrderRow = {
  issue: string
  user_id: string
  bet_time: number
  coin: number
  order_id: string
  bet_code: string
  bet_type: BingoBetType
}

/** 一期完整開獎資料（供歷史顯示：大小/單雙官方欄位另外存一份，OpenCodeRecord 型別本身沒有這兩欄） */
type BingoDrawMeta = { lotBigSmall: string; lotOddEven: string; superNumber: string }

export default class BingoClass extends LOTTERY_BASE {
  currentIssue: string
  isBootstrapped: boolean
  cutoffAt: number
  drawAt: number
  pendingSince: number
  nextPollAt: number
  isSettling: boolean
  lastKnownOfficialPeriod: string
  issueSettledMap: Record<string, boolean>
  /** issue → 該期大小/單雙官方欄位＋超級獎號（recordOpenCode 只存 20 個號碼字串，這裡補充剩下的欄位） */
  drawMeta: Record<string, BingoDrawMeta>
  /**
   * 測試用：設定後，`_attemptSettlement()` 不會呼叫外部官方 API，改用這裡的假資料
   * （見 `debugForceSettleNow`／server/api/admin/bingo-test-draw.post.ts）。用完自動清空。
   */
  _testFetchOverride: { period: string; lotNumber: number[]; lotBigSmall: string; lotOddEven: string } | null

  declare _get: LOTTERY_BASE['_get'] & {
    user: (userId: string) => UserStoreLike
    userRecord: (userId: string) => UserRecord
  }
  declare handle: LOTTERY_BASE['handle'] & {
    ensureUserRecord: (user: UserStoreLike) => UserRecord
    pushBalanceChange: (userId: string, payload: Omit<UserBalanceChange, 'id' | 'createdAt'>) => void
    appendBetHistory: (row: BetOrderRow) => void
    betLabelOf: (betType: BingoBetType, decoded: BingoSlot | null) => string
    rejectBet: (message: string) => never
    validateSlots: (slots: BingoSlot[]) => Array<{ betType: BingoBetType; code: string }>
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
      lastOpenCode: { issue: string; openCode: string[]; superNumber: string; lotBigSmall: string; lotOddEven: string } | null
      popularNumbers: Array<{ star: number; numbers: number[]; count: number }>
    }
    betTypes: () => typeof BINGO_BET_TYPES
  }

  constructor() {
    super(LOTTERY.BINGO.key, LOTTERY.BINGO.id)
    this.currentIssue = ''
    this.isBootstrapped = false
    this.cutoffAt = 0
    this.drawAt = 0
    this.pendingSince = 0
    this.nextPollAt = 0
    this.isSettling = false
    this.lastKnownOfficialPeriod = ''
    this.issueSettledMap = {}
    this.drawMeta = {}
    this._testFetchOverride = null

    Object.assign(this._get, {
      user: (userId: string) => Storage.get.user(userId) as UserStoreLike,
      userRecord: (userId: string) => this.handle.ensureUserRecord(this._get.user(userId))
    })

    Object.assign(this.handle, {
      ensureUserRecord: (user: UserStoreLike) => {
        if (!user.bingoRecord) {
          user.bingoRecord = { balanceChanges: [], betHistory: [], claimableIssues: [], updatedAt: Date.now() }
        }
        if (!Array.isArray(user.bingoRecord.balanceChanges)) user.bingoRecord.balanceChanges = []
        if (!Array.isArray(user.bingoRecord.betHistory)) user.bingoRecord.betHistory = []
        if (!Array.isArray(user.bingoRecord.claimableIssues)) user.bingoRecord.claimableIssues = []
        user.bingoRecord.updatedAt = Date.now()
        return user.bingoRecord
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
        const decoded = bingoDecodeSlot(row.bet_type, row.bet_code)
        record.betHistory.push({
          orderId: String(row.order_id),
          issue: String(row.issue),
          betTime: Number(row.bet_time),
          coin: Number(row.coin ?? 0),
          betType: row.bet_type,
          betLabel: this.handle.betLabelOf(row.bet_type, decoded),
          openCode: [],
          superNumber: '',
          winStatus: 'pending',
          winAmount: 0
        })
        if (record.betHistory.length > 5000) record.betHistory = record.betHistory.slice(-4000)
      },
      betLabelOf: (betType: BingoBetType, decoded: BingoSlot | null): string => {
        if (!decoded) return '—'
        if (decoded.betType === 'star') return `${decoded.star} 星｜${decoded.numbers.map((n) => String(n).padStart(2, '0')).join(',')}`
        if (decoded.betType === 'super') return String(decoded.number).padStart(2, '0')
        return decoded.pick
      },
      rejectBet: (message: string): never => {
        throw createError({ statusCode: 400, message })
      },
      /** 驗證一次送單的 1~BINGO_MAX_SLOTS 組注單，回傳正規化後的 { betType, code } 陣列（供 playBets 建單使用） */
      validateSlots: (slots: BingoSlot[]): Array<{ betType: BingoBetType; code: string }> => {
        if (slots.length < 1 || slots.length > BINGO_MAX_SLOTS) {
          this.handle.rejectBet(`一次送單需為 1~${BINGO_MAX_SLOTS} 組，本次 ${slots.length} 組`)
        }
        return slots.map((slot) => {
          if (!slot || typeof slot !== 'object') this.handle.rejectBet('注單格式錯誤')
          if (slot.betType === 'star') {
            const numbers = bingoValidateStarNumbers(Number(slot.star), Array.isArray(slot.numbers) ? slot.numbers.map(Number) : [])
            if (!numbers) this.handle.rejectBet('基本玩法：星數需為 1~10，且選號數需等於星數、號碼需為 01~80 且不重複')
            return { betType: 'star' as const, code: bingoEncodeSlot({ betType: 'star', star: Number(slot.star), numbers: numbers! }) }
          }
          if (slot.betType === 'super') {
            const number = Number(slot.number)
            if (!bingoIsValidNumber(number)) this.handle.rejectBet('超級獎號：需選 1 個 01~80 的號碼')
            return { betType: 'super' as const, code: bingoEncodeSlot({ betType: 'super', number }) }
          }
          if (slot.betType === 'bigSmall') {
            if (slot.pick !== '大' && slot.pick !== '小') this.handle.rejectBet('猜大小：需選「大」或「小」')
            return { betType: 'bigSmall' as const, code: bingoEncodeSlot({ betType: 'bigSmall', pick: slot.pick }) }
          }
          if (slot.betType === 'oddEven') {
            if (slot.pick !== '單' && slot.pick !== '雙') this.handle.rejectBet('猜單雙：需選「單」或「雙」')
            return { betType: 'oddEven' as const, code: bingoEncodeSlot({ betType: 'oddEven', pick: slot.pick }) }
          }
          this.handle.rejectBet('下注類型錯誤（需為 star/super/bigSmall/oddEven）')
        })
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
        // 排除 admin 測試工具留下的假資料（issue 帶「（測試）」後綴）
        const realRecords = this.recordOpenCode.filter((r) => !r.issue.includes('（測試）'))
        const last = realRecords[realRecords.length - 1] ?? null
        const lastMeta = last ? this.drawMeta[last.issue] : undefined
        const now = MEMORY.now.getTime()
        const remainMs = this.currentStatus === STATUS_TIME.OPEN ? Math.max(0, this.cutoffAt - now) : 0
        const remainSec = Math.floor(remainMs / 1000)
        const mm = Math.floor(remainSec / 60)
        const ss = remainSec % 60
        return {
          issue: this.currentIssue,
          currentStatus: this.currentStatus,
          cutoffAt: this.cutoffAt,
          drawAt: this.drawAt,
          countdown: `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`,
          lastOpenCode: last
            ? {
                issue: last.issue,
                openCode: last.openCode,
                superNumber: lastMeta?.superNumber ?? (last.openCode[last.openCode.length - 1] ?? ''),
                lotBigSmall: lastMeta?.lotBigSmall ?? '',
                lotOddEven: lastMeta?.lotOddEven ?? ''
              }
            : null,
          popularNumbers: this._popularNumbers()
        }
      },
      betTypes: () => BINGO_BET_TYPES
    })

    this.init()
  }

  init() {
    console.log('TTT---RUN.BINGO.鏡射官方賓果賓果')
    Storage.games[this.key] = this
    LOTTERY_BASE.getOrders(this.id, this.key)
    this._bootstrapOfficialPeriod()
  }

  /**
   * server 啟動後第一次打官方 API 拿「目前最新一期」，成功後才允許 `_ensureIssue()` 分配
   * currentIssue。失敗（含網路逾時）就 5 秒後重試。
   */
  async _bootstrapOfficialPeriod() {
    try {
      const last = await fetchTaiwanLotteryLastNumberOf(BINGO_GAME_CODE)
      const lotNumber = Array.isArray(last?.lotNumber) ? last!.lotNumber.map((n) => Number(n)) : []
      if (last?.period && lotNumber.length >= BINGO_DRAWN_COUNT) {
        this.lastKnownOfficialPeriod = String(last.period)
        this.isBootstrapped = true
        this._ensureIssue(MEMORY.now)
        this._recordDraw(
          String(last.period),
          lotNumber,
          String(last.lotSpecial ?? ''),
          String(last.lotBigSmall ?? ''),
          String(last.lotOddEven ?? '')
        )
        // ⚠️ 已知限制：賓果賓果沒有官方「查詢特定期別」端點（GAME_DEFS 沒有 1102 設定），
        // 就算反推出過去期別字串也沒有端點可查，因此不做 _backfillHistory（比照 P3 對「回填不可行」
        // 的既有註解風格）。歷史改由 bootstrap 種下的這一期＋往後每期真實結算逐步累積。
        return
      }
      console.warn('TTT---WARN.BINGO 啟動時官方 API 沒有回傳有效期別，5 秒後重試')
    } catch (err) {
      console.warn('TTT---WARN.BINGO 啟動時查詢官方最新期別失敗，5 秒後重試', err)
    }
    setTimeout(() => { this._bootstrapOfficialPeriod() }, 5000)
  }

  /**
   * 把一期「已知的真實開獎資料」寫進 recordOpenCode＋drawMeta（該期已存在就略過，不重複寫入）。
   * 超級獎號優先採信官方 `lotSpecial` 欄位（使用者已實測驗證：兩次連續期別皆與 lotNumber 最後一位吻合），
   * 找不到時才退而求其次用 lotNumber 最後一位頂替。
   */
  _recordDraw(period: string, lotNumber: number[], lotSpecialRaw: string, lotBigSmall: string, lotOddEven: string) {
    if (!period || this.recordOpenCode.some((r) => r.issue === period)) return
    const numbers = lotNumber.slice(0, BINGO_DRAWN_COUNT).map((n) => Number(n))
    if (numbers.length < BINGO_DRAWN_COUNT) return
    const superNumber = lotSpecialRaw.trim() !== '' && Number.isFinite(Number(lotSpecialRaw))
      ? Number(lotSpecialRaw)
      : numbers[numbers.length - 1]!
    // 依 design.md 規範：order=20 的號碼一律以官方 lotSpecial 為準覆蓋（兩者本來就該一致，不需要對不上時特別報錯）
    numbers[BINGO_DRAWN_COUNT - 1] = superNumber
    const openCode = numbers.map((n) => String(n))
    const startAt = this.drawAt || Date.now()
    this.recordOpenCode.push({
      issue: period,
      openCode,
      time: { start: new Date(startAt).toISOString(), end: new Date(startAt).toISOString() },
      startAt,
      endAt: startAt
    })
    this.drawMeta[period] = { lotBigSmall, lotOddEven, superNumber: String(superNumber) }
    if (this.recordOpenCode.length > 200) {
      const dropped = this.recordOpenCode.splice(0, this.recordOpenCode.length - 100)
      dropped.forEach((r) => { delete this.drawMeta[r.issue] })
    }
  }

  /** 確保 currentIssue／cutoffAt／drawAt／currentStatus 對應到「現在」這個時間點該有的狀態 */
  _ensureIssue(now: Date) {
    if (!this.isBootstrapped) {
      this.currentStatus = STATUS_TIME.PREPARE
      return
    }
    if (!this.currentIssue || !this.cutoffAt || !this.drawAt) {
      this.currentIssue = _nextOfficialPeriod(this.lastKnownOfficialPeriod)
      const drawAt = _nextFiveMinuteBoundary(now).getTime()
      // ⚠️ 賓果賓果沒有「投注截止時間早於開獎時間」的日曆概念：下注開放到開獎那一刻為止，
      // cutoffAt 直接等於 drawAt（不像 P3 那樣 20:00 截止、20:30 才開獎，中間隔著「已封盤」）。
      this.cutoffAt = drawAt
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

  /**
   * 輪詢頻率固定每 12 秒一次（官方每 5 分鐘必定有新資料，不採 P3/M649 的降頻設計）；
   * 超過 2 分鐘還沒等到新期別只記一次 warning，繼續輪詢、不中斷（寬鬆容錯）。
   */
  _scheduleNextPoll(now: Date) {
    const pendingMs = now.getTime() - this.pendingSince
    if (pendingMs > PENDING_WARN_THRESHOLD_MS && pendingMs - POLL_INTERVAL_MS <= PENDING_WARN_THRESHOLD_MS) {
      console.warn(`TTT---WARN.BINGO 官方資料超過 2 分鐘未到位（issue=${this.currentIssue}），持續輪詢中`)
    }
    this.nextPollAt = now.getTime() + POLL_INTERVAL_MS
  }

  async _attemptSettlement(now: Date) {
    const testOverride = this._testFetchOverride
    try {
      let period: string
      let lotNumber: number[]
      let lotBigSmall: string
      let lotOddEven: string

      if (testOverride) {
        // 測試模式：不打外部官方 API，改用呼叫端指定的假資料（見 debugForceSettleNow）。
        period = `${testOverride.period}（測試）`
        lotNumber = testOverride.lotNumber
        lotBigSmall = testOverride.lotBigSmall
        lotOddEven = testOverride.lotOddEven
      } else {
        const last = await fetchTaiwanLotteryLastNumberOf(BINGO_GAME_CODE)
        period = String(last?.period ?? '')
        lotNumber = Array.isArray(last?.lotNumber) ? last!.lotNumber.map((n) => Number(n)) : []
        // 官方「最新一期」還沒變、或號碼還沒給滿 20 個，代表尚未到位
        if (!period || period === this.lastKnownOfficialPeriod || lotNumber.length < BINGO_DRAWN_COUNT) {
          this._scheduleNextPoll(now)
          return
        }
        lotBigSmall = String(last?.lotBigSmall ?? '')
        lotOddEven = String(last?.lotOddEven ?? '')
      }

      if (lotNumber.length < BINGO_DRAWN_COUNT) {
        if (!testOverride) this._scheduleNextPoll(now)
        return
      }

      const numbers = lotNumber.slice(0, BINGO_DRAWN_COUNT).map((n, idx) => ({ number: Number(n), order: idx + 1 }))
      const draw: BingoDraw = { issue: period, numbers, lotBigSmall, lotOddEven }

      const settledIssue = this.currentIssue
      this._settleIssue(settledIssue, period, draw, Boolean(testOverride))

      // ⚠️ 測試模式到此為止：只驗證「真實下注 → 依假開獎資料正確判定/派彩」，絕不能再往下動
      // currentIssue／cutoffAt／drawAt／lastKnownOfficialPeriod 這些真正的期別追蹤狀態（比照 P3）。
      if (testOverride) return

      this.lastKnownOfficialPeriod = period
      const seedPeriod = _laterOfficialPeriod(this.lastKnownOfficialPeriod, settledIssue)
      this.currentIssue = _nextOfficialPeriod(seedPeriod)
      const drawAt = _nextFiveMinuteBoundary(new Date(this.drawAt + 1000)).getTime()
      this.cutoffAt = drawAt
      this.drawAt = drawAt
      this.pendingSince = 0
      this.nextPollAt = 0
      this._refreshStatus(now)
    } catch (err) {
      console.warn('TTT---WARN.BINGO 結算輪詢失敗，稍後重試', err)
      if (!testOverride) this._scheduleNextPoll(now)
    } finally {
      this._testFetchOverride = null
    }
  }

  /**
   * 測試用：強制立刻跑一次 `_attemptSettlement()`，用假資料取代外部官方 API 呼叫
   * （見 server/api/admin/bingo-test-draw.post.ts，供 scripts/test-bingo.mjs 隨時呼叫）。
   */
  async debugForceSettleNow(override: { period: string; lotNumber: number[]; lotBigSmall: string; lotOddEven: string }) {
    this._testFetchOverride = override
    await this._attemptSettlement(MEMORY.now)
  }

  /**
   * 結算一期：一份 `draw`（開獎號碼＋大小/單雙官方欄位）供 4 種投注類型共用判定：
   *   star     → bingoCountHits + bingoStarPrize 查表
   *   super    → bingoSuperNumberHit（比對 order===20 的號碼，不是集合判定）→ 固定 1200
   *   bigSmall → bingoJudgeBigSmall → win 固定 150／push 退回本金／lose 不派彩
   *   oddEven  → bingoJudgeOddEven → 同上，固定 150
   *
   * @param isTest 是否為 admin 測試呼叫。測試模式不用 `issueSettledMap` 這個「整期只結算一次」的
   *   全域鎖，改成逐注判斷（只處理仍是 pending 的注單），反覆測試才不會重複發錢（比照 P3）。
   */
  _settleIssue(internalIssue: string, officialPeriod: string, draw: BingoDraw, isTest = false) {
    if (!isTest && this.issueSettledMap[internalIssue]) return

    const drawnNumbers = draw.numbers.map((n) => n.number)
    const drawnSet = new Set(drawnNumbers)
    const superNumber = bingoSuperNumberOf(draw)
    const officialOpenCode = drawnNumbers.map((n) => String(n))

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
      // 測試模式沒有 issueSettledMap 擋重複呼叫，改成逐注擋：已經判定過（非 pending）的注單不重複派彩
      if (isTest && current && current.winStatus !== 'pending') return

      const betType = String(row.playKey ?? '') as BingoBetType
      const code = (Array.isArray(row.betCode) ? row.betCode : [])[0] ?? ''
      const decoded = bingoDecodeSlot(betType, code)
      const coin = Number(row.coin ?? 0)

      let payout = 0
      let winStatus: 'win' | 'lose' | 'push' = 'lose'

      if (decoded?.betType === 'star') {
        const hitCount = bingoCountHits(decoded.numbers, drawnSet)
        payout = bingoStarPrize(decoded.star, hitCount)
        winStatus = payout > 0 ? 'win' : 'lose'
      } else if (decoded?.betType === 'super') {
        const hit = bingoSuperNumberHit(decoded.number, superNumber)
        payout = hit ? BINGO_SUPER_NUMBER_PRIZE : 0
        winStatus = hit ? 'win' : 'lose'
      } else if (decoded?.betType === 'bigSmall') {
        const result = bingoJudgeBigSmall(decoded.pick, draw.lotBigSmall)
        winStatus = result
        payout = result === 'win' ? BINGO_BIG_SMALL_PRIZE : result === 'push' ? coin : 0
      } else if (decoded?.betType === 'oddEven') {
        const result = bingoJudgeOddEven(decoded.pick, draw.lotOddEven)
        winStatus = result
        payout = result === 'win' ? BINGO_ODD_EVEN_PRIZE : result === 'push' ? coin : 0
      }

      if (idx >= 0 && current) {
        record.betHistory[idx] = {
          ...current,
          openCode: [...officialOpenCode],
          superNumber: String(superNumber),
          winStatus,
          winAmount: payout
        }
      }
      if (payout > 0) {
        payoutByUser.set(row.userId, Number((Number(payoutByUser.get(row.userId) ?? 0) + payout).toFixed(2)))
      }
    })

    // ⚠️ 不論 isTest 皆寫入 recordOpenCode（比照 P3 既有慣例）：測試呼叫用的 officialPeriod
    // 一律帶「（測試）」後綴（見 _attemptSettlement／bingo-test-settle.post.ts），其餘讀取端
    // （opencode-history／History.vue 等）皆已用這個後綴過濾掉假資料，不影響真實歷史。
    if (!this.recordOpenCode.some((r) => r.issue === officialPeriod)) {
      const startAt = this.drawAt || Date.now()
      this.recordOpenCode.push({
        issue: officialPeriod,
        openCode: officialOpenCode,
        time: { start: new Date(startAt).toISOString(), end: new Date(startAt).toISOString() },
        startAt,
        endAt: startAt
      })
      this.drawMeta[officialPeriod] = { lotBigSmall: draw.lotBigSmall, lotOddEven: draw.lotOddEven, superNumber: String(superNumber) }
      if (this.recordOpenCode.length > 200) {
        const dropped = this.recordOpenCode.splice(0, this.recordOpenCode.length - 100)
        dropped.forEach((r) => { delete this.drawMeta[r.issue] })
      }
    }

    payoutByUser.forEach((amount, userId) => {
      this.handle.pushClaimable(userId, internalIssue, amount, officialOpenCode)
    })

    if (!isTest) this.issueSettledMap[internalIssue] = true
  }

  /**
   * 「熱門選號」：統計本期（currentIssue）目前所有玩家已下注的「基本玩法（star）」注碼中固定「3 星」
   * 的部分，依下注人數（注數）由多到少排序取前 5 組；不足 5 組（含完全沒人下注）時，用隨機 3 星注碼
   * 墊到滿 5 組（使用者指定：熱門選號固定只用 3 星，其他星數／超級獎號／猜大小／猜單雙皆不列入）。
   */
  _popularNumbers(): Array<{ star: number; numbers: number[]; count: number }> {
    const issueOrders = (this._get.orders().get.orders.currentIssue(this.currentIssue) ?? []) as Array<{
      betCode: string[]
      playKey?: string
    }>

    const freq = new Map<string, number>()
    issueOrders.forEach((row) => {
      if (row.playKey !== 'star') return
      const code = (Array.isArray(row.betCode) ? row.betCode : [])[0]
      if (code && code.startsWith(`${POPULAR_PICKS_STAR}|`)) freq.set(code, (freq.get(code) ?? 0) + 1)
    })

    const real = [...freq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, POPULAR_PICKS_COUNT)
      .map(([code, count]) => {
        const decoded = bingoDecodeSlot('star', code)
        return decoded?.betType === 'star' ? { star: decoded.star, numbers: decoded.numbers, count } : null
      })
      .filter((item): item is { star: number; numbers: number[]; count: number } => item !== null)

    const usedKeys = new Set(real.map((r) => bingoEncodeSlot({ betType: 'star', star: r.star, numbers: r.numbers })))
    const padded = [...real]
    while (padded.length < POPULAR_PICKS_COUNT) {
      const pick = _randomStarPick()
      const key = bingoEncodeSlot({ betType: 'star', ...pick })
      if (usedKeys.has(key)) continue
      usedKeys.add(key)
      padded.push({ ...pick, count: 0 })
    }
    return padded
  }

  playBets(payload: PlayBetsPayload, user: UserStoreLike) {
    this._ensureIssue(MEMORY.now)
    if (this.currentStatus !== STATUS_TIME.OPEN) {
      throw createError({ statusCode: 400, message: `目前為「${this.currentStatus}」，不受理投注` })
    }

    const userId = String(user?.userId ?? '')
    const issue = this.currentIssue
    const slots = Array.isArray(payload?.slots) ? payload.slots : []

    const betCodes = this.handle.validateSlots(slots)

    const totalAmount = betCodes.length * BINGO_BET_UNIT
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
      coin: BINGO_BET_UNIT,
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
