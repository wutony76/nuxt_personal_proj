import { Storage } from '../../../storage'
import { LOTTERY, STATUS_TIME } from '~/config/constants'
import LOTTERY_BASE, { CYCLE_MS, TOTAL_ISSUES_PER_DAY, type OpenCodeRecord } from './lotteryBase'
import { MEMORY } from '../../../base'
import { judgeK3Bet, k3SumOf, k3DiceOf, type K3BetResult } from '#shared/config/k3-cd'
import { k3QuotaOf, k3RtpOf, k3TabOddsOf, k3HasBetCode, findK3Tab } from '#shared/config/k3cd/helpers'
import {
  K3_SHARED,
  k3AddIssuePool,
  k3EnsurePoolBase,
  k3IssuePool,
  k3DistributablePool,
  k3EnsureDraw,
  k3RandomOpenCode
} from './k3Shared'

/**
 * 快3 信用盤（K3-CD）
 *
 * ── 與 K3-OF 的共用關係 ─────────────────────────────────
 * 開獎號與彩池都放在 k3Shared 的 module 級單例：
 *   prdOpenCode 覆寫後，先啟動的那個 class 產生當日期表，
 *   後啟動的直接拿到「同一個陣列參照」，兩邊的期別／開獎號／倒數必然一致。
 *   抽水一律進 K3_SHARED.pool，兩個盤口的投注共同養同一個彩池。
 *
 * ── 與 6hc-cd 的差異 ────────────────────────────────────
 *   開獎是 3 顆骰子（可重複）而非 49 取 7，故 randomOpenCode 也要覆寫。
 *   注項一律「一注一個注項」，沒有連碼那種一注多碼的組合玩法，
 *   因此不需要 combo / tiers 那一套。
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
  /** tie = 和局退還本金（大小單雙開出圍骰） */
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
type UserStoreLike = { userId?: string; coin?: number; k3Record?: UserRecord }

/** 抽水比例：投注額的固定比例撥入共用彩池（賠率派彩由莊家支付） */
const K3_RAKE_RATIO = 0.02

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
 * 取一注的注碼
 * 快3 的注項名稱本身就是注碼（"7"、"大"、"三軍3"、"圍111"、"11-2"、"1-2-3"…），
 * 因此優先取 label；num 只在和值這種純數字注項會帶。
 */
function _resolveBetCode(play?: { num?: number | string; label?: string | number }): string {
  const label = String(play?.label ?? '').trim()
  if (label) return label
  const num = Number(play?.num)
  return Number.isFinite(num) && num > 0 ? String(num) : ''
}

export default class K3_CD extends LOTTERY_BASE {
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
  }

  constructor() {
    super(LOTTERY['K3-CD'].key, LOTTERY['K3-CD'].id)
    this.issueSettledMap = {}

    Object.assign(this._get, {
      user: (userId: string) => Storage.get.user(userId) as UserStoreLike,
      userRecord: (userId: string) => this.handle.ensureUserRecord(this._get.user(userId))
    })

    Object.assign(this.handle, {
      // 快3 開獎：3 顆骰子（可重複），不是 49 取 7
      randomOpenCode: () => k3RandomOpenCode(),
      /**
       * 覆寫期表產生：改由 k3Shared 持有，與 K3-OF 共用同一份開獎號
       * ⚠️ 一定要把共用陣列「直接賦值」給 this.recordOpenCode（同一個參照），
       *    複製一份就會失去共用效果
       */
      prdOpenCode: (now = new Date()) => {
        const dateKey = this.timer.formatDateKey(now)
        this.recordOpenCode = k3EnsureDraw(dateKey, () => this.handle.buildDayRecords(now))
        this.currentIndex = 0
        this.currentStatus = STATUS_TIME.PREPARE
      },
      /** 產生當日期表（期別／時間沿用 base 的週期常數，開獎號用 K3 的 3 顆骰子） */
      buildDayRecords: (now: Date): OpenCodeRecord[] => {
        const dayStart = this.timer.getStartOfDay(now).getTime()
        const dateKey = this.timer.formatDateKey(now)
        const records: OpenCodeRecord[] = []
        for (let i = 0; i < TOTAL_ISSUES_PER_DAY; i++) {
          const startAt = dayStart + i * CYCLE_MS
          records.push({
            issue: `${dateKey}${String(i + 1).padStart(3, '0')}`,
            openCode: k3RandomOpenCode(),
            time: { start: new Date(startAt).toISOString(), end: new Date(startAt + CYCLE_MS).toISOString() },
            startAt,
            endAt: startAt + CYCLE_MS
          })
        }
        return records
      },
      /** 開獎球資料：快3 直接把點數帶出去（沒有 49 顆球那張對照表） */
      openCodePlay: (openCode: string[]) => {
        const dice = k3DiceOf(openCode)
        if (!dice) return []
        return dice.map((num, idx) => ({ num, label: String(num), index: idx }))
      },
      ensureUserRecord: (user: UserStoreLike) => {
        // 與 6hc 分開存（k3Record），兩個彩種的注單紀錄互不干擾
        if (!user.k3Record) {
          user.k3Record = { balanceChanges: [], betHistory: [], claimableIssues: [], updatedAt: Date.now() }
        }
        if (!Array.isArray(user.k3Record.balanceChanges)) user.k3Record.balanceChanges = []
        if (!Array.isArray(user.k3Record.betHistory)) user.k3Record.betHistory = []
        if (!Array.isArray(user.k3Record.claimableIssues)) user.k3Record.claimableIssues = []
        user.k3Record.updatedAt = Date.now()
        return user.k3Record
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
        const newByTab = new Map<number, { playKey: string; coin: number }>()
        ;(Array.isArray(input.groups) ? input.groups : []).forEach((group) => {
          const playKey = String(group?.playKey || '')
          ;(Array.isArray(group?.playList) ? group.playList : []).forEach((play) => {
            const tabId = _resolveTabId(play, group)
            const tabName = findK3Tab(playKey, tabId)?.tabName ?? String(tabId)
            const betCode = _resolveBetCode(play)
            // 注項必須真的存在於該分頁，否則前端亂送也能建單
            if (!betCode || !k3HasBetCode(playKey, tabId, betCode)) {
              this.handle.rejectBet(`${tabName}「${betCode || '(空白)'}」不是有效注項`)
            }
            const quota = k3QuotaOf(playKey, tabId)
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
        // 單期投注額：同一玩家、同一期、同一分頁的既有注單 + 本次送單
        const orders = this._get.orders() as unknown as {
          get: { issueTabCoin: (issue: string, userId: string, tabId: number) => number }
        }
        newByTab.forEach(({ playKey, coin: newCoin }, tabId) => {
          const quota = k3QuotaOf(playKey, tabId)
          if (!(quota.issue.max > 0)) return
          const used = Number(orders?.get?.issueTabCoin?.(input.issue, input.userId, tabId) ?? 0)
          if (used + newCoin > quota.issue.max) {
            const tabName = findK3Tab(playKey, tabId)?.tabName ?? String(tabId)
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
              // 賠率由 helpers 依該分頁 rtp 即時推算後鎖上注單，結算以此值派彩
              odds: k3TabOddsOf(playKey, tabId, betCode)
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
        issueOrders.forEach((row) => {
          const coin = Number(row.coin ?? 0)
          const betCode = String((Array.isArray(row.betCode) ? row.betCode : [])[0] ?? '')
          const playKey = String(row.playKey ?? '')
          const tabId = Number(row.tabId ?? 0)
          const lockedOdds = Number(row.odds ?? 0)
          const judged = judgeK3Bet(betCode, codes, coin, lockedOdds, k3RtpOf(playKey, tabId))
          // 無法辨識的注項視為和局退還本金，避免吞掉玩家注金
          const result: K3BetResult = judged?.result ?? 'tie'
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
        })

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
        // 與上一期比較的投注變化（文案格式對齊 6hc）
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
      /** 共用彩池狀態（與 K3-OF 讀到同一份） */
      poolState: () => {
        const issue = this._get.latestIssue()
        // 沒有池底（或已被吃到低於頭獎保障門檻）就重骰，兩個盤口共用同一份
        k3EnsurePoolBase()
        return {
          issue,
          base: K3_SHARED.pool.base,
          carry: K3_SHARED.pool.carry,
          // 該期抽水也一起回（K3-OF 本來就有回，型別 K3Pool 也有這個欄位）
          issuePool: k3IssuePool(issue),
          distributable: k3DistributablePool(issue)
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
      /** 該期開獎的和值（供前端顯示與冷熱分析） */
      sumOf: (openCode: string[]) => {
        const dice = k3DiceOf(openCode)
        return dice ? k3SumOf(dice) : 0
      }
    })

    this.init()
  }

  init() {
    console.log('TTT---RUN.K3.信用')
    this.handle.prdOpenCode()
    Storage.games[this.key] = this
    LOTTERY_BASE.getOrders(this.id, this.key)
  }

  override circle() {
    this.handle.refreshCurrent(MEMORY.now)
    this.handle.settleClosedIssueIfNeeded()
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
    // 抽水入共用彩池（K3-CD 與 K3-OF 共同養同一個池）
    k3AddIssuePool(issue, Number((amount * K3_RAKE_RATIO).toFixed(2)))
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
