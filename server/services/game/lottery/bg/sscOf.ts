import { Storage } from '../../../storage'
import { LOTTERY, STATUS_TIME } from '~/config/constants'
import LOTTERY_BASE, { CYCLE_MS, TOTAL_ISSUES_PER_DAY, type OpenCodeRecord } from './base'
// ⚠️ 別跟同層的 ./base 搞混：這支是 services/base.ts（BaseClass 與 MEMORY 時鐘），
//    ./base 才是本層的彩票基底（期表／狀態機／訂單）
import { MEMORY } from '../../../base'
import { sscDigitsOf, sscSumOf } from '#shared/config/ssc'
import { judgeSscOgBet, SSC_OG_MAX_COMBO } from '#shared/config/sscog'
import { sscOfMatchCount, SSC_OF_PRIZE_TIERS } from '#shared/config/ssc-of'
import {
  sscOgHasBetCode,
  sscOgIsPoolTab,
  sscOgQuotaOf,
  sscOgTabOddsOf,
  findSscOgTab
} from '#shared/config/sscog/helpers'
import {
  SSC_SHARED,
  sscAddIssuePool,
  sscEnsurePoolBase,
  sscDistributablePool,
  sscEnsureDraw,
  sscIssuePool,
  sscRandomOpenCode
} from './sscShared'

/**
 * 時時彩官方盤（SSC-OF）
 *
 * ── 與 SSC-CD 的共用關係 ────────────────────────────────
 *   開獎號：兩邊的 recordOpenCode 都指向 sscShared 的同一個陣列（prdOpenCode 已覆寫），
 *           所以同一期的期別、號碼、倒數完全一致。
 *   彩池  ：抽水一律進 SSC_SHARED.pool，兩個盤口共同養同一個池。
 *
 * ── 兩套派彩並存（依分頁的 combo.pool 分流）──────────────
 *   後三直選（101141010）→ 吃共用彩池，依命中位數分層（SSC_OF_PRIZE_TIERS）：
 *     3 位中 → 頭獎（池 70%，每單位下注有最低保障）
 *     2 位中 → 二獎（池 20%，純比例）
 *     1 位中 → 三獎（固定倍數）
 *     未產生中獎者的 pool 層，該層整塊滾存至下期。
 *   其餘 10 個分頁      → 固定賠率，下注時把賠率鎖進注單。
 *
 *   ⚠️ 與 PK10-OF 的差異：彩池分頁的注碼**仍然是字串**（`後三直選123`），
 *      不是 codes 陣列 —— 時時彩號碼可以重複，沒有「同一台車佔兩個名次」要擋，
 *      所以前端複式展開與伺端注碼驗證完全不必為彩池分頁開特例。
 *   ⚠️ 因為彩池共用，SSC-OF 的結算會動到 SSC-CD 也看得到的 carry ——
 *      這是刻意的（比照快3 / PK10 的共用設計），不是 bug。
 *
 * ── 複式的注碼從哪來 ────────────────────────────────────
 *   除了定位膽是單選分頁，其餘 10 個分頁都是複式：
 *   前端用 sscOgComboCodes() 把選號展開成一注一碼後送上來，
 *   伺端逐注用 sscOgHasBetCode() 驗（複式分頁改驗「前綴符合 + 可判定」）。
 *   ⚠️ 伺端不信任前端的注數，一個群組超過 SSC_OG_MAX_COMBO 注就整筆拒絕。
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
  /** 彩池分頁：命中分層名稱（頭獎／二獎／三獎）；賠率分頁：中獎／和局 */
  tierName: string
  /** tie：時時彩官方盤沒有真正的和局，僅在注碼無法辨識時退回本金 */
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
type UserStoreLike = { userId?: string; coin?: number; sscOfRecord?: UserRecord }

/**
 * 抽水比例：官方盤把較高比例撥入獎池（彩池分頁的獎金全部來自池，非莊家賠付）
 * ⚠️ 數值比照 PK10-OF —— 那邊同樣只有一個分頁吃池、其餘走固定賠率。
 */
const SSC_OF_RAKE_RATIO = 0.6

/** 該筆注單是不是彩池分頁（結算時據此分流到兩條路） */
const _isPoolRow = (playKey?: string, tabId?: number | string) => sscOgIsPoolTab(playKey, tabId)

/** 取一注的注碼（官方盤的注碼一律是字串：後三直選123、大小單雙後二大單、第一球7…） */
function _resolveBetCode(play?: { num?: number | string; label?: string | number }): string {
  const label = String(play?.label ?? '').trim()
  if (label) return label
  return String(play?.num ?? '').trim()
}

export default class SSC_OF extends LOTTERY_BASE {
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
    prizeTiers: () => typeof SSC_OF_PRIZE_TIERS
  }

  constructor() {
    super(LOTTERY['SSC-OF'].key, LOTTERY['SSC-OF'].id)
    this.issueSettledMap = {}

    Object.assign(this._get, {
      user: (userId: string) => Storage.get.user(userId) as UserStoreLike,
      userRecord: (userId: string) => this.handle.ensureUserRecord(this._get.user(userId))
    })

    Object.assign(this.handle, {
      randomOpenCode: () => sscRandomOpenCode(),
      /**
       * 與 SSC-CD 完全相同的覆寫：期表交給 sscShared
       * 先啟動的 class 產生、後啟動的直接沿用同一個陣列參照
       */
      prdOpenCode: (now = new Date()) => {
        const dateKey = this.timer.formatDateKey(now)
        this.recordOpenCode = sscEnsureDraw(dateKey, () => this.handle.buildDayRecords(now))
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
            openCode: sscRandomOpenCode(),
            time: { start: new Date(startAt).toISOString(), end: new Date(startAt + CYCLE_MS).toISOString() },
            startAt,
            endAt: startAt + CYCLE_MS
          })
        }
        return records
      },
      openCodePlay: (openCode: string[]) => {
        const digits = sscDigitsOf(openCode)
        if (!digits) return []
        return digits.map((digit, idx) => ({ num: digit, label: String(digit), ball: idx + 1, index: idx }))
      },
      /**
       * 寫入某期的可領獎金（同一期重複呼叫會累加）
       * 同一期若多個分頁都中，金額要疊在同一筆上，玩家才不會看到同一期出現兩列可領。
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
        // 與 SSC-CD（sscRecord）、PK10、快3、6hc 分開存，各盤口的注單紀錄互不干擾
        if (!user.sscOfRecord) {
          user.sscOfRecord = { balanceChanges: [], betHistory: [], claimableIssues: [], updatedAt: Date.now() }
        }
        if (!Array.isArray(user.sscOfRecord.balanceChanges)) user.sscOfRecord.balanceChanges = []
        if (!Array.isArray(user.sscOfRecord.betHistory)) user.sscOfRecord.betHistory = []
        if (!Array.isArray(user.sscOfRecord.claimableIssues)) user.sscOfRecord.claimableIssues = []
        user.sscOfRecord.updatedAt = Date.now()
        return user.sscOfRecord
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
       * 官方盤只有一種注碼形狀（字串），所以比 PK10-OF 少一整條彩池分支：
       *   單選分頁（定位膽）→ 注碼要在 groupList 內
       *   複式分頁          → 前綴符合該分頁的 combo 規則且能被 sscog.ts 判定
       * 限額一律讀該分頁的 config，伺端不信任前端送的注數與金額。
       */
      validateBetQuota: (input: { issue: string; userId: string; amount: number; groups: Group[] }) => {
        const _money = (value: number) => Number(value).toLocaleString('zh-TW')
        /** 本次送單依分頁累計，供單期限額比對 */
        const newByTab = new Map<number, { playKey: string; coin: number }>()
        ;(Array.isArray(input.groups) ? input.groups : []).forEach((group) => {
          const playKey = String(group?.playKey || '')
          const tab = findSscOgTab(playKey, group?.selectTabId)
          if (!tab) this.handle.rejectBet(`玩法或分頁不存在（${playKey} / ${group?.selectTabId ?? ''}）`)
          const safeTabId = Number(tab!.tabId)
          const tabName = String(tab!.tabName ?? safeTabId)
          const quota = sscOgQuotaOf(playKey, safeTabId)
          const playList = Array.isArray(group?.playList) ? group.playList : []
          // 複式展開的上限：前端的 sscOgComboCodes() 已擋過一次，這裡是伺端的第二道
          if (playList.length > SSC_OG_MAX_COMBO) {
            this.handle.rejectBet(`${tabName} 單次最多 ${_money(SSC_OG_MAX_COMBO)} 注，本次 ${_money(playList.length)} 注`)
          }
          playList.forEach((play) => {
            const betCode = _resolveBetCode(play)
            if (!betCode || !sscOgHasBetCode(playKey, safeTabId, betCode)) {
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
          const quota = sscOgQuotaOf(playKey, tabId)
          if (!(quota.issue.max > 0)) return
          const used = Number(orders?.get?.issueTabCoin?.(input.issue, input.userId, tabId) ?? 0)
          if (used + newCoin > quota.issue.max) {
            const tabName = findSscOgTab(playKey, tabId)?.tabName ?? String(tabId)
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
          const tabId = Number(findSscOgTab(playKey, group?.selectTabId)?.tabId ?? 0)
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
              odds: sscOgTabOddsOf(playKey, tabId, betCode),
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
      /**
       * 官方盤結算
       *
       * 兩條路並存，依該注所屬分頁的 combo.pool 分流：
       *   賠率分頁（10 個）→ judgeSscOgBet 逐注判定，賠率取注單鎖的值
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
        oddsOrders.forEach((row) => {
          const coin = Number(row.coin ?? 0)
          const betCode = String((Array.isArray(row.betCode) ? row.betCode : [])[0] ?? '')
          const lockedOdds = Number(row.odds ?? 0)
          const judged = judgeSscOgBet(betCode, codes, coin, lockedOdds)
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
        })

        // ── 彩池分頁（後三直選）：依命中位數分層 ──
        const poolOrders = allOrders.filter((row) => _isPoolRow(row.playKey, row.tabId))
        // 可發放獎池 = 池底 + 該期抽水 × 0.8 + 累積滾存（與 SSC-CD 共用同一個池）
        const totalPool = sscDistributablePool(safeIssue)
        const rows = poolOrders.map((row) => ({
          ...row,
          matchCount: sscOfMatchCount(String((Array.isArray(row.betCode) ? row.betCode : [])[0] ?? ''), codes) ?? 0,
          payout: 0,
          tierName: ''
        }))

        let carryNext = 0
        SSC_OF_PRIZE_TIERS.forEach((tier) => {
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
        // ⚠️ carry 是與 SSC-CD 共用的，這裡寫回去兩邊都會看到
        SSC_SHARED.pool.carry = carryNext
        SSC_SHARED.pool.issueMap[safeIssue] = 0
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
        // 與上一期比較的投注變化（文案格式對齊 6hc / k3 / pk10）
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
      /** 共用彩池狀態（與 SSC-CD 讀到同一份；時時彩沒有吃池的玩法，純顯示） */
      poolState: () => {
        const issue = this._get.latestIssue()
        sscEnsurePoolBase()
        return {
          issue,
          base: SSC_SHARED.pool.base,
          carry: SSC_SHARED.pool.carry,
          issuePool: sscIssuePool(issue),
          distributable: sscDistributablePool(issue)
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
      /** 該期開獎的總和（0 ~ 45，官方盤看板也會顯示） */
      sumOf: (openCode: string[]) => {
        const digits = sscDigitsOf(openCode)
        return digits ? sscSumOf(digits) : 0
      },
      /** 後三直選的獎金分層（看板與說明頁顯示用） */
      prizeTiers: () => SSC_OF_PRIZE_TIERS
    })

    this.init()
  }

  init() {
    console.log('TTT---RUN.SSC.官方')
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
    // 抽水入共用彩池（SSC-CD 與 SSC-OF 共同養同一個池）
    sscAddIssuePool(issue, Number((amount * SSC_OF_RAKE_RATIO).toFixed(2)))
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
        //    （少了它，注單會永遠停在 pending）
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
}
