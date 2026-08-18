import { Storage } from '../../../storage'
import { LOTTERY, STATUS_TIME } from '~/config/constants'
import LOTTERY_BASE from './base'
// ⚠️ 別跟同層的 ./base 搞混：這支是 services/base.ts（BaseClass 與 MEMORY 時鐘），
//    ./base 才是本層的彩票基底（期表／狀態機／訂單）
import { MEMORY } from '../../../base'
import {
  buildCreditJackpotShares,
  CREDIT_JACKPOT,
  creditNumberBetHitsSpecial,
  judgeCreditBet,
  shengxiaoAll,
  SX,
  type CreditBetKind,
  type CreditBetResult,
  type CreditLianmaTier
} from '#shared/config/6hc-cd'
// 賠率與限額一律讀分頁設定（c_tema / c_zhengma 的 odds、settings.quota）
import {
  creditComboCount,
  creditComboOf,
  creditJackpotWeightOf,
  creditMatchModeOf,
  creditQuotaOf,
  creditRtpOf,
  creditTabOddsOf,
  creditTiersOf,
  findCreditTab
} from '#shared/config/cd/helpers'

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
  /** 下注時的賠率（含本金）：取自該分頁 config 的 odds，結算即以此值派彩 */
  odds: number
  /**
   * 連碼專用：下注時鎖住的命中檔次表（中三 / 中二…）
   * 連碼一注有多種中法、賠率開獎後才確定，單一 odds 不夠用
   */
  tiers?: CreditLianmaTier[]
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
    /** 連碼：該注的號碼組（如 ['03','15','22']），其餘玩法不帶 */
    codes?: Array<number | string>
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
  /** 命中檔次名稱（連碼：中三／中二…），其餘玩法為空字串 */
  tierName?: string
  /** 爆池加碼金額（非爆池期或無份為 0） */
  jackpotAmount: number
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

/**
 * 取期別的年份（期號格式 YYYYMMDDnnn，見 LOTTERY_BASE.createIssue）
 * 五行的號碼歸屬逐年輪轉，賠率與判定都必須用「該期的年份」而非「現在」——
 * 跨年後結算舊期若用今年的表，會把號碼算到別的五行去。
 */
function _issueYear(issue: string): number {
  const year = Number(String(issue ?? '').slice(0, 4))
  return Number.isFinite(year) && year > 1900 ? year : new Date().getFullYear()
}

type PlayInput = NonNullable<Group['playList']>[number]

/** 生肖組合玩法：codes 語意是生肖中文名（非 01~49 號碼），驗證與排序方式跟連碼不同 */
const ANIMAL_COMBO_PLAYS = new Set(['hexiao', 'lianxiao'])
const ANIMAL_SET = new Set<string>(SX as readonly string[])

/** 尾數組合玩法（連尾）：codes 語意是尾數（"0尾" ~ "9尾"），驗證與排序方式同合肖／連肖，只是換一組固定值域 */
const TAIL_COMBO_PLAYS = new Set(['lianwei'])
const TAIL_SET = new Set<string>(Array.from({ length: 10 }, (_, i) => `${i}尾`))

/**
 * 6hc-cd 的單一注碼正規化（不補零：1 ~ 9 就寫 "1" ~ "9"）
 *
 * ⚠️ 不能直接用 LOTTERY_BASE.normalizeBetCode —— 那支會補零成 "01"，且 6hc-of 共用，
 *    動它會一起改到另一個彩種。6hc-cd 的看板設定（c_tema 等）已改成不補零，
 *    注單注碼跟著一致，畫面上才不會出現「看板顯示 1、注單顯示 01」。
 *    判定端一律走 Number() 比對（見 shared/config/6hc-cd.ts 各 judge），故不受寫法影響。
 */
function _normalizeCdBetCode(play: PlayInput): string {
  const num = Number(play?.num)
  if (Number.isFinite(num) && num > 0) return String(num)
  return String(play?.label ?? '').trim()
}

/**
 * 取一注的號碼組
 * 連碼一注帶多個號（play.codes），需驗證數量與 combo.pick 相符、號碼在 1~49 且不重複；
 * 合肖 / 連肖一注帶多個生肖，需驗證數量與 combo.pick 相符、生肖須為有效值且不重複；
 * 連尾一注帶多個尾數，需驗證數量與 combo.pick 相符、尾數須為 0~9 尾且不重複；
 * 其餘玩法沿用 _normalizeCdBetCode 的單一注碼。
 *
 * 複式展開由前端做（選 N 個 → C(N, pick) 注），伺端不信任「注數」這個數字 ——
 * 每一注都在這裡獨立驗證號碼組是否合法，扣款與限額也一律以實際收到的注數計算。
 * @returns 合法的號碼組；無效回 null（呼叫端整筆拒絕）
 */
function _resolveBetCodes(playKey: string, tabId: number, play: PlayInput): string[] | null {
  const combo = creditComboOf(playKey, tabId)
  if (!combo) {
    const code = _normalizeCdBetCode(play)
    return code ? [code] : null
  }
  const raw = Array.isArray(play?.codes) ? play.codes : []
  if (ANIMAL_COMBO_PLAYS.has(playKey)) {
    const animals = raw.map((code) => String(code).trim()).filter((name) => ANIMAL_SET.has(name))
    if (animals.length !== combo.pick) return null
    if (new Set(animals).size !== animals.length) return null
    // 依生肖固定順序排列，讓相同組合的注單長得一樣（方便比對與去重）
    return (SX as readonly string[]).filter((animal) => animals.includes(animal))
  }
  if (TAIL_COMBO_PLAYS.has(playKey)) {
    const tails = raw.map((code) => String(code).trim()).filter((name) => TAIL_SET.has(name))
    if (tails.length !== combo.pick) return null
    if (new Set(tails).size !== tails.length) return null
    // 依尾數（0 ~ 9）固定順序排列，讓相同組合的注單長得一樣（方便比對與去重）
    return tails.sort((a, b) => parseInt(a, 10) - parseInt(b, 10))
  }
  const nums = raw.map((code) => Number(code)).filter((num) => Number.isInteger(num) && num >= 1 && num <= 49)
  if (nums.length !== combo.pick) return null
  if (new Set(nums).size !== nums.length) return null
  // 同一注內號碼排序，讓相同組合的注單長得一樣（方便比對與去重）；不補零，與看板設定一致
  return nums.sort((a, b) => a - b).map((num) => String(num))
}

type JackpotHit = {
  issue: string
  specialCode: string
  pool: number
  payout: number
  winners: number
  orders: number
  createdAt: number
}

export default class LHC_CD extends LOTTERY_BASE {
  issueJackpotMap: Record<string, number>
  issueSettledMap: Record<string, boolean>
  carryJackpot: number
  jackpotBase: number
  jackpotBaseSetAt: number
  /** 最近一次爆池紀錄（供頁首與說明頁展示） */
  lastJackpotHit: JackpotHit | null
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
    validateBetQuota: (input: { issue: string; userId: string; amount: number; groups: Group[] }) => void
    rejectBet: (message: string) => never
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
    this.lastJackpotHit = null
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
          const total = playList.length
          playList.forEach((play, index) => {
            const orderId = this.handle.createOrderId(input.issue)
            const tabId = _resolveTabId(play, group)
            const betCodes = _resolveBetCodes(playKey, tabId, play)
            if (!betCodes) return
            // 每注各自金額（fallback 到整體 amount）
            const playCoin = Number(play?.amount ?? play?.coin ?? input.amount)
            // 連碼：賠率在命中檔次上，整份 tiers 快照到注單，結算再依命中檔次取值
            const tiers = creditTiersOf(playKey, tabId)
            // 注項本身的賠率（號碼池型玩法查不到，會是 0）
            const itemOdds = creditTabOddsOf(playKey, tabId, betCodes[0], _issueYear(input.issue), betCodes)
            // 只有一個檔次的分頁（三全中 / 二全中 / 特串 / 全不中 / 中一 / 特平中）中法唯一，
            // 賠率下注時就確定 —— 鎖上注單讓預估獎金與注單紀錄有值；
            // 多檔次（三中二 / 二中特）仍留 0，結算依實際命中檔次取值
            const lockedTierOdds = tiers.length === 1 ? Number(tiers[0]?.odds ?? 0) : 0
            rows.push({
              issue: input.issue,
              user_id: input.userId,
              select_tab_id: tabId,
              bet_time: Date.now(),
              coin: Number.isFinite(playCoin) && playCoin > 0 ? playCoin : input.amount,
              // 複式一次送多注，序號標示第幾注 / 共幾注
              order_id: `${orderId}(${index + 1}/${total})`,
              status: 'success',
              bet_code: betCodes,
              play_key: playKey,
              play_type_name: playTypeName,
              // 以該分頁設定的賠率鎖定在注單上（A/B 盤賠率不同，結算以此為準）
              // 五行的賠率取決於該期年份的號碼表，故一併帶入期別年份；
              // 合肖 / 連肖的賠率取決於整組生肖，一併帶入完整 betCodes
              odds: itemOdds > 0 ? itemOdds : lockedTierOdds,
              ...(tiers.length > 0 ? { tiers } : {})
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
          play_type_name: '',
          odds: 0
        }]
      },
      // 限額驗證（讀 c_tema / c_zhengma 各分頁的 settings.quota）
      // 任一注違規就整筆拒絕，且必須在扣款／建單之前呼叫
      validateBetQuota: (input: { issue: string; userId: string; amount: number; groups: Group[] }) => {
        const _money = (value: number) => Number(value).toLocaleString('zh-TW')
        // 本次送單各分頁的累計投注額（記住 playKey，同一次送單可能含多個玩法）
        const newByTab = new Map<number, { playKey: string; coin: number }>()
        const groups = Array.isArray(input.groups) ? input.groups : []
        // 連碼複式一次送多注，另計每個分頁的注數以驗證是否超出 combo 上限
        const betCountByTab = new Map<number, number>()
        groups.forEach((group) => {
          const playKey = String(group?.playKey || '')
          const playList = Array.isArray(group?.playList) ? group.playList : []
          playList.forEach((play) => {
            const tabId = _resolveTabId(play, group)
            const quota = creditQuotaOf(playKey, tabId)
            const tabName = findCreditTab(playKey, tabId)?.tabName ?? String(tabId)
            const combo = creditComboOf(playKey, tabId)
            // 號碼組合法性（連碼：號碼數需等於 pick、01~49、不重複）
            const betCodes = _resolveBetCodes(playKey, tabId, play)
            if (!betCodes) {
              if (!combo) return // 非連碼且注碼為空 → 沿用原行為（略過該注）
              const unit = ANIMAL_COMBO_PLAYS.has(playKey)
                ? '個不重複的生肖'
                : TAIL_COMBO_PLAYS.has(playKey)
                  ? '個不重複的尾數'
                  : '個不重複的號碼（01–49）'
              this.handle.rejectBet(`${tabName} 每注需選 ${combo.pick} ${unit}`)
            }
            const betCode = betCodes.join('、')
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
            betCountByTab.set(tabId, Number(betCountByTab.get(tabId) ?? 0) + 1)
          })
        })

        // 連碼注數上限：以「選滿 maxPick 個號」能組出的注數為準
        // 前端負責展開組合，這裡擋掉超量送單（例如手動組出 500 注）
        betCountByTab.forEach((count, tabId) => {
          const playKey = newByTab.get(tabId)?.playKey ?? ''
          const combo = creditComboOf(playKey, tabId)
          if (!combo) return
          const maxBets = creditComboCount(combo.maxPick, combo.pick)
          if (count > maxBets) {
            const tabName = findCreditTab(playKey, tabId)?.tabName ?? String(tabId)
            this.handle.rejectBet(
              `${tabName} 單次最多 ${maxBets} 注（選 ${combo.maxPick} 個號），本次 ${count} 注`
            )
          }
        })

        // 單期投注額：同一玩家、同一期、同一分頁的既有注單 + 本次送單（max = 0 視為不限）
        const orders = this._get.orders() as unknown as {
          get: { issueTabCoin: (issue: string, userId: string, tabId: number) => number }
        }
        newByTab.forEach(({ playKey, coin: newCoin }, tabId) => {
          const quota = creditQuotaOf(playKey, tabId)
          if (!(quota.issue.max > 0)) return
          const used = Number(orders?.get?.issueTabCoin?.(input.issue, input.userId, tabId) ?? 0)
          if (used + newCoin > quota.issue.max) {
            const tabName = findCreditTab(playKey, tabId)?.tabName ?? String(tabId)
            this.handle.rejectBet(
              `${tabName} 單期投注上限 ${_money(quota.issue.max)}，本期已投注 ${_money(used)}、本次 ${_money(newCoin)}`
            )
          }
        })
      },
      // 統一的拒單方式（文案放 message；statusMessage 會被 h3 消毒掉中文，不要用）
      rejectBet: (message: string) => {
        throw createError({ statusCode: 400, message })
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
          playKey?: string
          /** 分頁 id：正碼特（4000～4005）靠它決定結算看哪一顆正碼 */
          tabId?: number
          odds?: number
          /** 連碼：下注時鎖住的命中檔次表 */
          tiers?: CreditLianmaTier[]
        }>

        const payoutByUser = new Map<string, number>()
        // 逐注判定結果（供獎池分配計算）
        const judgedRows: Array<{
          orderId: string
          userId: string
          coin: number
          kind: CreditBetKind | null
          result: CreditBetResult
          weight: number
        }> = []
        issueOrders.forEach((row) => {
          const coin = Number(row.coin ?? 0)
          const betCodes = Array.isArray(row.betCode) ? row.betCode.map((code) => String(code)) : []
          const betCode = String(betCodes[0] ?? '')
          const playKey = String(row.playKey ?? '')
          const tabId = Number(row.tabId ?? 0)
          // 下注時鎖在注單上的賠率（A/B 盤不同、五行等逐年變動，一律以此為準）。
          // 一肖量／尾數量的判定也需要它 —— 那兩個玩法的賠率寫在 config 的注項上，
          // 而 shared/config/6hc-cd 不讀設定檔（會與 helpers 形成循環），故由這裡帶入。
          const lockedOdds = Number(row.odds ?? 0)
          // 依玩法分派判定：特碼看特別號、正碼看 6 顆正碼與七球總和、
          // 正碼特看該分頁對應名次的那一顆正碼、七碼看七顆球的單雙／大小組成、
          // 連碼看整組號碼命中幾個正碼／是否含特別號（賠率取注單上的 tiers 快照）、
          // 五行看特別號屬該期年份表的哪一行（號碼表逐年輪轉，故帶期別年份而非今年）
          const judged = judgeCreditBet({
            playKey, betCode, betCodes, openCode: codes, coin, tabId,
            tiers: row.tiers,
            year: _issueYear(safeIssue),
            rtp: creditRtpOf(playKey, tabId),
            // 一肖不中的判定方向與一肖中相反，方向記在分頁設定上
            match: creditMatchModeOf(playKey, tabId),
            // 一肖量／尾數量的賠率寫在 config 的注項上（各項差距極大），
            // shared 不讀設定檔，故把注單上鎖定的賠率帶進判定
            odds: lockedOdds,
          })
          // 無法辨識的注項（尚未支援的玩法）視為和局退還本金，避免吞掉玩家注金
          const result: CreditBetResult = judged?.result ?? 'tie'
          // 賠率以「下注時鎖定在注單上的值」為準（lockedOdds，宣告於判定之前），
          // 注單沒帶（舊資料）才退回判定函式回傳的玩法預設賠率
          const odds = lockedOdds > 0 ? lockedOdds : Number(judged?.odds ?? 0)
          const payout = result === 'win'
            ? Number((coin * odds).toFixed(2))
            : result === 'tie' ? coin : 0

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
                // 命中特別號僅特碼單號成立；正碼／正碼特單號命中的是正碼，七碼沒有單號注項
                specialMatch: result === 'win' && judged?.kind === 'number' && creditNumberBetHitsSpecial(playKey),
                winStatus: result,
                winAmount: payout,
                odds,
                tierName: String(judged?.tierName ?? ''),
                jackpotAmount: 0 // 爆池加碼於下方獎池分配時寫入
              }
            }
          }

          if (payout > 0) {
            const prev = Number(payoutByUser.get(row.userId) ?? 0)
            payoutByUser.set(row.userId, Number((prev + payout).toFixed(2)))
          }

          judgedRows.push({
            orderId: String(row.orderId),
            userId: String(row.userId),
            coin,
            kind: judged?.kind ?? null,
            result,
            // 爆池分配權重讀該注項所屬群組的設定（七碼逐項覆寫、連碼掛在命中檔次上），
            // 查不到才由全域預設保底
            weight: creditJackpotWeightOf(playKey, tabId, betCode, judged?.kind ?? null, judged?.tier ?? null)
          })
        })

        // ── 獎池發放（爆池期：特別號 = CREDIT_JACKPOT.hitNumber） ──
        // 可發放累積池 = 當期抽水 + 累積滾存（不含展示用池底 jackpotBase）
        const issuePool = Number(this.issueJackpotMap[safeIssue] ?? 0)
        const distributable = Number((issuePool + Number(this.carryJackpot ?? 0)).toFixed(2))
        const jackpot = buildCreditJackpotShares(judgedRows, specialCode, distributable)
        const jackpotByUser = new Map<string, number>()
        jackpot.shares.forEach((share) => {
          if (!(share.amount > 0)) return
          const prev = Number(jackpotByUser.get(share.userId) ?? 0)
          jackpotByUser.set(share.userId, Number((prev + share.amount).toFixed(2)))
          // 記錄在該注單上，供下注紀錄顯示「頭獎加碼」
          const user = this._get.user(share.userId)
          const record = this.handle.ensureUserRecord(user)
          const idx = record.betHistory.findIndex((item) => String(item.orderId) === share.orderId)
          const current = record.betHistory[idx]
          if (idx >= 0 && current) {
            record.betHistory[idx] = { ...current, jackpotAmount: share.amount }
          }
        })
        // 加碼併入該期可領金額（與賠率派彩同一條領獎管道）
        jackpotByUser.forEach((amount, userId) => {
          const prev = Number(payoutByUser.get(userId) ?? 0)
          payoutByUser.set(userId, Number((prev + amount).toFixed(2)))
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

        // 未發放的部分（含未觸發時的整池）滾存至下期
        this.carryJackpot = Number(jackpot.remain.toFixed(2))
        this.issueJackpotMap[safeIssue] = 0
        if (jackpot.triggered) {
          this.lastJackpotHit = {
            issue: safeIssue,
            specialCode: String(specialCode),
            pool: jackpot.pool,
            payout: jackpot.payout,
            winners: new Set(jackpot.shares.map((share) => share.userId)).size,
            orders: jackpot.shares.length,
            createdAt: Date.now()
          }
          // 爆池後重抽展示用池底
          this._handle.jackpotBase()
        }
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
          // 下注時即鎖定該注賠率（取自分頁 config），供下注紀錄顯示與結算派彩
          odds: Number(row.odds ?? 0),
          jackpotAmount: 0
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
          jackpotBaseSetAt: this.jackpotBaseSetAt,
          // 可發放累積池（當期抽水 + 累積滾存，不含展示用池底）與發放參數
          distributable: Number((currentIssueJackpot + carryJackpot).toFixed(2)),
          rakeRatio: CREDIT_JACKPOT.rakeRatio,
          hitNumber: CREDIT_JACKPOT.hitNumber,
          payoutRatio: CREDIT_JACKPOT.payoutRatio,
          minPool: CREDIT_JACKPOT.minPool,
          lastHit: this.lastJackpotHit
        }
      }
    })

    this.init()
  }

  init() {
    console.log('TTT---RUN.LHC.信用')
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
    // 期別狀態閘門：只有「開盤中」可受理投注。
    // 前端投注鈕雖已依狀態 disable，但直接呼叫 /api/lottery/bet 可繞過，
    // 因此在扣款與建單之前先於伺端擋掉（封盤後、開獎中、已開獎都拒絕）。
    this.handle.refreshCurrent(new Date())
    if (this.currentStatus !== STATUS_TIME.OPEN) {
      const _msg = `目前為「${this.currentStatus}」，不受理投注`
      // 文案放 message：statusMessage 是 HTTP reason phrase，h3 會把中文消毒掉
      throw createError({ statusCode: 400, message: _msg })
    }

    const amount = Number(payload?.amount ?? 0)
    const userId = String(user?.userId ?? '')
    const issue = this.recordOpenCode[this.currentIndex]?.issue ?? this._get.latestIssue()
    const groups = Array.isArray(payload?.groups) ? payload.groups : []

    // 限額閘門：單注上下限 / 單期投注上限（依分頁 settings.quota），同樣擋在扣款前
    this.handle.validateBetQuota({ issue, userId, amount, groups })

    const beforeCoin = Number(user?.coin ?? 0)
    user.coin = beforeCoin - amount
    const afterCoin = Number(user?.coin ?? 0)

    const rows = this.handle.buildOrderRows({ issue, userId, amount, groups })
    // 獎池改為「抽水入池」：只把投注額的固定比例撥入獎池（賠率派彩由莊家支付）
    this.handle.addIssueJackpot(issue, Number((amount * CREDIT_JACKPOT.rakeRatio).toFixed(2)))
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
        playKey: row.play_key, // 結算時分派各玩法判定用
        odds: row.odds, // 下注時鎖定的賠率，結算派彩以此為準
        tiers: row.tiers // 連碼：下注時鎖定的命中檔次表
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
