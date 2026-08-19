import { Storage } from '../../../storage'
import { LOTTERY, STATUS_TIME } from '~/config/constants'
import LOTTERY_BASE, { CYCLE_MS, TOTAL_ISSUES_PER_DAY, type OpenCodeRecord } from './base'
// ⚠️ 別跟同層的 ./base 搞混：這支是 services/base.ts（BaseClass 與 MEMORY 時鐘），
//    ./base 才是本層的彩票基底（期表／狀態機／訂單）
import { MEMORY } from '../../../base'
import { type JackpotRow } from '#shared/config/jackpot'
import { pk10JackpotHit, pk10JackpotLabel, PK10_JACKPOT_SETTINGS } from '#shared/config/pk10-cd'
import { pk10CarsOf, pk10SumOf } from '#shared/config/pk10'
import {
  pk10OfMatchCount,
  pk10OfPicksOf,
  PK10_OF_PICK_COUNT,
  PK10_OF_POOL_PLAY_KEY,
  PK10_OF_PRIZE_TIERS
} from '#shared/config/pk10-of'
import { judgePk10OfBet } from '#shared/config/pk10of'
import {
  pk10OfHasBetCode,
  pk10OfIsPoolTab,
  pk10OfQuotaOf,
  pk10OfTabOddsOf,
  findPk10OfTab,
  pk10OfJackpotWeightOf
} from '#shared/config/pk10of/helpers'
import {
  PK10_SHARED,
  pk10AddIssueJackpot,
  pk10RegisterJackpotBoard,
  pk10SubmitJackpotRows,
  pk10SettleJackpotIfReady,
  pk10JackpotState,
  pk10AddIssuePool,
  pk10EnsurePoolBase,
  pk10DistributablePool,
  pk10EnsureDraw,
  pk10IssuePool,
  pk10RandomOpenCode
} from './pk10Shared'

/**
 * PK10 官方盤（PK10-OF）
 *
 * ── 與 PK10-CD 的共用關係 ───────────────────────────────
 *   開獎號：兩邊的 recordOpenCode 都指向 pk10Shared 的同一個陣列（prdOpenCode 已覆寫），
 *           所以同一期的期別、名次、倒數完全一致。
 *   彩池  ：抽水一律進 PK10_SHARED.pool，兩個盤口共同養同一個池；
 *           派彩後未發放的部分寫回 PK10_SHARED.pool.carry 滾存至下期。
 *   ⚠️ 因為彩池共用，PK10-OF 的結算會動到 PK10-CD 也看得到的 carry ——
 *      這是刻意的（比照快3 的共用設計），不是 bug。
 *
 * ── 派彩方式：獎池分層（同 6hc-of / k3-of）──────────────
 *   一注 = 依序猜冠／亞／季軍的車號，依「名次與車號都對」的個數分層：
 *     3 中 → 頭獎（池 70%，每單位下注有最低保障）
 *     2 中 → 二獎（池 20%，純比例）
 *     1 中 → 三獎（固定倍數）
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
    /** 官方盤彩池玩法：一注帶 3 個車號（順序即冠／亞／季） */
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
  /** 命中名次數（0 ~ 3） */
  matchCount: number
  /** 命中分層名稱（頭獎／二獎／三獎），未中為空字串 */
  tierName: string
  /** tie：PK10 沒有真正的和局，僅在注碼無法辨識時退回本金 */
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
type UserStoreLike = { userId?: string; coin?: number; pk10OfRecord?: UserRecord }

/** 抽水比例：官方盤把較高比例撥入獎池（彩池玩法的獎金全部來自池，非莊家賠付） */
const PK10_OF_RAKE_RATIO = 0.6

/**
 * 彩池玩法的 playKey
 *
 * 官方盤有兩套派彩並存（玩法與分頁全部照 pcv2 的 conf_pk10_og.js）：
 *   qiansan —— 前三直選：依序猜冠／亞／季軍，依命中名次數從共用彩池分層分配
 *   其餘     —— 前一直選／前二直選／定位膽，賠率由 pk10of.ts 依
 *              「公平賠率 × 分頁 rtp」推算，下注時鎖進注單
 * 判斷依據就是 playKey，兩條路互不干擾。
 * ⚠️ key 由 shared/config/pk10-of.ts 提供，不要在這裡再寫一份字串。
 */
const POOL_PLAY_KEY = PK10_OF_POOL_PLAY_KEY
/** 該筆注單是不是彩池玩法 */
const _isPoolPlay = (playKey?: string) => String(playKey ?? POOL_PLAY_KEY) === POOL_PLAY_KEY

export default class PK10_OF extends LOTTERY_BASE {
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
    prizeTiers: () => typeof PK10_OF_PRIZE_TIERS
    creditJackpot: () => ReturnType<typeof pk10JackpotState>
  }

  constructor() {
    super(LOTTERY['PK10-OF'].key, LOTTERY['PK10-OF'].id)
    this.issueSettledMap = {}
    // 官方盤的注單也參與爆池分配（兩個盤口共吃一池，狀態在 pk10Shared.ts）
    pk10RegisterJackpotBoard('of')

    Object.assign(this._get, {
      user: (userId: string) => Storage.get.user(userId) as UserStoreLike,
      userRecord: (userId: string) => this.handle.ensureUserRecord(this._get.user(userId))
    })

    Object.assign(this.handle, {
      randomOpenCode: () => pk10RandomOpenCode(),
      /**
       * 與 PK10-CD 完全相同的覆寫：期表交給 pk10Shared
       * 先啟動的 class 產生、後啟動的直接沿用同一個陣列參照
       */
      prdOpenCode: (now = new Date()) => {
        const dateKey = this.timer.formatDateKey(now)
        this.recordOpenCode = pk10EnsureDraw(dateKey, () => this.handle.buildDayRecords(now))
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
            openCode: pk10RandomOpenCode(),
            time: { start: new Date(startAt).toISOString(), end: new Date(startAt + CYCLE_MS).toISOString() },
            startAt,
            endAt: startAt + CYCLE_MS
          })
        }
        return records
      },
      openCodePlay: (openCode: string[]) => {
        const cars = pk10CarsOf(openCode)
        if (!cars) return []
        return cars.map((car, idx) => ({ num: car, label: String(openCode[idx] ?? car), rank: idx + 1, index: idx }))
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
        // 與 PK10-CD（pk10Record）、快3、6hc 分開存，各盤口的注單紀錄互不干擾
        if (!user.pk10OfRecord) {
          user.pk10OfRecord = { balanceChanges: [], betHistory: [], claimableIssues: [], updatedAt: Date.now() }
        }
        if (!Array.isArray(user.pk10OfRecord.balanceChanges)) user.pk10OfRecord.balanceChanges = []
        if (!Array.isArray(user.pk10OfRecord.betHistory)) user.pk10OfRecord.betHistory = []
        if (!Array.isArray(user.pk10OfRecord.claimableIssues)) user.pk10OfRecord.claimableIssues = []
        user.pk10OfRecord.updatedAt = Date.now()
        return user.pk10OfRecord
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
        throw createError({ statusCode: 400, message })
      },
      /**
       * 注碼與限額驗證
       *
       * 兩種注碼形狀分開驗：
       *   彩池玩法（前三直選）→ codes 必須是 3 個互不相同的車號，順序即冠／亞／季
       *   賠率玩法            → 注碼必須存在於該分頁（複式分頁改驗前綴＋可判定）
       * 限額一律讀該分頁的 config（含彩池分頁），伺端不信任前端送的注數與金額。
       * ⚠️ 單注／單期限額都是「per 分頁」，與 PK10-CD 同一套語意 ——
       *    不要再像早期版本那樣把彩池玩法寫死一份 quota。
       */
      validateBetQuota: (input: { issue: string; userId: string; amount: number; groups: Group[] }) => {
        const _money = (value: number) => Number(value).toLocaleString('zh-TW')
        /** 本次送單依分頁累計，供單期限額比對 */
        const newByTab = new Map<number, { playKey: string; coin: number }>()
        ;(Array.isArray(input.groups) ? input.groups : []).forEach((group) => {
          const playKey = String(group?.playKey || POOL_PLAY_KEY)
          const tabId = Number(group?.selectTabId ?? 0)
          const tab = findPk10OfTab(playKey, tabId)
          if (!tab) this.handle.rejectBet(`玩法或分頁不存在（${playKey} / ${tabId}）`)
          const safeTabId = Number(tab!.tabId)
          const tabName = String(tab!.tabName ?? safeTabId)
          const isPool = _isPoolPlay(playKey)
          // 彩池分頁也有自己的 quota（config 的 141121011），不再寫死
          const quota = pk10OfQuotaOf(playKey, safeTabId)
          // playKey 說是彩池、config 卻不是彩池分頁（或反過來）→ 前端送錯，直接擋
          if (isPool !== pk10OfIsPoolTab(playKey, safeTabId)) {
            this.handle.rejectBet(`${tabName} 的派彩方式與玩法不符（${playKey}）`)
          }
          ;(Array.isArray(group?.playList) ? group.playList : []).forEach((play) => {
            let label = ''
            if (isPool) {
              const picks = pk10OfPicksOf(Array.isArray(play?.codes) ? play.codes : [])
              if (!picks) {
                this.handle.rejectBet(`每注需依序選 ${PK10_OF_PICK_COUNT} 個不重複的車號（1 ~ 10）`)
              }
              label = picks!.join(',')
            } else {
              // 賠率制：注碼一律用伺端的設定檔驗，不信任前端送的注數與賠率
              label = String(play?.label ?? play?.num ?? '').trim()
              if (!pk10OfHasBetCode(playKey, safeTabId, label)) {
                this.handle.rejectBet(`${tabName}「${label || '(空)'}」不在該分頁的注項內`)
              }
            }
            const rawCoin = Number(play?.amount ?? play?.coin ?? input.amount)
            const coin = Number.isFinite(rawCoin) && rawCoin > 0 ? rawCoin : Number(input.amount)
            if (coin < quota.item.min) {
              this.handle.rejectBet(`${tabName}「${label}」單注最低 ${_money(quota.item.min)}，本次 ${_money(coin)}`)
            }
            if (coin > quota.item.max) {
              this.handle.rejectBet(`${tabName}「${label}」單注上限 ${_money(quota.item.max)}，本次 ${_money(coin)}`)
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
          const quota = pk10OfQuotaOf(playKey, tabId)
          if (!(quota.issue.max > 0)) return
          const used = Number(orders?.get?.issueTabCoin?.(input.issue, input.userId, tabId) ?? 0)
          if (used + newCoin > quota.issue.max) {
            const tabName = findPk10OfTab(playKey, tabId)?.tabName ?? String(tabId)
            this.handle.rejectBet(
              `${tabName} 單期投注上限 ${_money(quota.issue.max)}，本期已投注 ${_money(used)}、本次 ${_money(newCoin)}`
            )
          }
        })
      },
      buildOrderRows: (input: { issue: string; userId: string; amount: number; groups: Group[] }): BetOrderItem[] => {
        const rows: BetOrderItem[] = []
        ;(Array.isArray(input.groups) ? input.groups : []).forEach((group) => {
          const playTypeName = String(group?.playTypeName || '前三直選')
          const playKey = String(group?.playKey || POOL_PLAY_KEY)
          // 分頁 id 一律以 config 為準（前端沒帶就回該玩法第一個分頁），
          // 結算與單期限額都靠它，不能直接信前端送的數字
          const tabId = Number(findPk10OfTab(playKey, group?.selectTabId)?.tabId ?? 0)
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
              const picks = pk10OfPicksOf(Array.isArray(play?.codes) ? play.codes : [])
              if (!picks) return
              // ⚠️ 不排序：順序就是名次，排序會讓「猜錯名次」在結算時被當成猜對
              // 彩池注單不鎖賠率（odds 留 0），但仍要帶分頁 id 給單期限額用
              rows.push({ ...base, bet_code: picks.map(String), tab_id: tabId })
              return
            }
            const label = String(play?.label ?? play?.num ?? '').trim()
            if (!label) return
            // 賠率鎖進注單：之後改 rtp 或設定也不會影響已成立的注單
            rows.push({ ...base, bet_code: [label], odds: pk10OfTabOddsOf(playKey, tabId, label), tab_id: tabId })
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
       *   賠率制玩法（pk10of）→ judgePk10OfBet 逐注判定，賠率取注單鎖的值
       *   彩池玩法（qiansan） → 依命中名次數分層，從共用獎池按比例分配
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
        /** 爆池分配用的注單列（賠率制與彩池兩種玩法都要收） */
        const jackpotRows: JackpotRow[] = []
        oddsOrders.forEach((row) => {
          const coin = Number(row.coin ?? 0)
          const betCode = String((Array.isArray(row.betCode) ? row.betCode : [])[0] ?? '')
          const lockedOdds = Number(row.odds ?? 0)
          const judged = judgePk10OfBet(betCode, codes, coin, lockedOdds)
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

          jackpotRows.push({
            orderId: String(row.orderId),
            userId: String(row.userId),
            coin,
            source: 'of',
            // 有份條件：非未中（和局也算有份，與信用盤同一套語意）
            eligible: status !== 'lose',
            weight: pk10OfJackpotWeightOf(String(row.playKey ?? ''), Number(row.tabId ?? 0), betCode)
          })
        })
        oddsPayoutByUser.forEach((amount, userId) => {
          this.handle.pushClaimable(userId, safeIssue, amount, codes)
        })

        // ── 彩池玩法：依命中名次數分層 ──
        const issueOrders = allOrders.filter((row) => _isPoolPlay(row.playKey))
        // 可發放獎池 = 該期抽水 + 累積滾存（與 PK10-CD 共用同一個池）
        const totalPool = pk10DistributablePool(safeIssue)
        const rows = issueOrders.map((row) => ({
          ...row,
          matchCount: pk10OfMatchCount(row.betCode, codes) ?? 0,
          payout: 0,
          tierName: ''
        }))

        let carryNext = 0
        PK10_OF_PRIZE_TIERS.forEach((tier) => {
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

          jackpotRows.push({
            orderId: String(row.orderId),
            userId: String(row.userId),
            coin: Number(row.coin ?? 0),
            source: 'of',
            // 彩池玩法沒有和局，命中 ≥ 1（有派彩）才算有份
            eligible: row.payout > 0,
            weight: pk10OfJackpotWeightOf(String(row.playKey ?? ''), Number(row.tabId ?? 0), String((Array.isArray(row.betCode) ? row.betCode : [])[0] ?? ''))
          })
        })

        // ── 爆池：交件給共用層，湊齊所有盤口後才分配 ──
        // ⚠️ 池與滾存都在共用層（與 PK10-CD 共吃一池），本 class 只挑 source === 'of' 的份寫回自己的 record
        pk10SubmitJackpotRows(safeIssue, 'of', jackpotRows)
        const jackpot = pk10SettleJackpotIfReady(safeIssue, pk10JackpotHit(codes), pk10JackpotLabel(codes))
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

        payoutByUser.forEach((amount, userId) => {
          this.handle.pushClaimable(userId, safeIssue, amount, codes)
        })

        // 未派出的 pool 層滾存至下期；該期抽水已用掉，歸零
        // ⚠️ carry 是與 PK10-CD 共用的，這裡寫回去兩邊都會看到
        PK10_SHARED.pool.carry = carryNext
        PK10_SHARED.pool.issueMap[safeIssue] = 0
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
        // 與上一期比較的投注變化（文案格式對齊 6hc / k3）
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
        pk10EnsurePoolBase()
        return {
          issue,
          base: PK10_SHARED.pool.base,
          carry: PK10_SHARED.pool.carry,
          issuePool: pk10IssuePool(issue),
          distributable: pk10DistributablePool(issue)
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
      prizeTiers: () => PK10_OF_PRIZE_TIERS,
      /** 爆池狀態（與 PK10-CD 共吃一池，兩邊的 /jackpot 回同一份） */
      creditJackpot: () => pk10JackpotState(this._get.latestIssue())
    })

    this.init()
  }

  init() {
    console.log('TTT---RUN.PK10.官方')
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
    // 官方盤彩池玩法的獎金全部來自獎池，故抽水比例遠高於信用盤
    pk10AddIssuePool(issue, Number((amount * PK10_OF_RAKE_RATIO).toFixed(2)))
    // 另外再抽一份進爆池（與共用彩池是兩個池，兩個盤口共吃爆池）
    pk10AddIssueJackpot(issue, Number((amount * PK10_JACKPOT_SETTINGS.rakeRatio).toFixed(2)))
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
        // ⚠️ orderId 一定要帶：結算是用它回頭比對 betHistory 那一列
        //    （少了它，注單會永遠停在 pending，但彩池滾存照算 —— 很難察覺）
        orderId: row.order_id,
        // ⚠️ 記真正的 config 分頁 id（不是彩種 id）——
        //    單期限額是 per 分頁比對，記錯就變成整個官方盤共用一條限額
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

  analysis = {
    /** 該期開獎的冠亞和（官方盤看板也會顯示） */
    sumOf: (openCode: string[]) => {
      const cars = pk10CarsOf(openCode)
      return cars ? pk10SumOf(cars) : 0
    }
  }
}
