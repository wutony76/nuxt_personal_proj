import { Storage } from '../../../storage'
import { LOTTERY, STATUS_TIME } from '~/config/constants'
import LOTTERY_BASE from './base'
// ⚠️ 別跟同層的 ./base 搞混：這支是 services/base.ts（BaseClass 與 MEMORY 時鐘），
//    ./base 才是本層的彩票基底（期表／狀態機／訂單）
import { MEMORY } from '../../../base'
import { judgeEggsBet, type EggsBetResult } from '#shared/config/eggs-cd'
import { eggsSumOf, eggsDigitsOf } from '#shared/config/eggs'
import { eggsQuotaOf, eggsRtpOf, eggsTabOddsOf, eggsHasBetCode, findEggsTab } from '#shared/config/eggscd/helpers'

/**
 * PC蛋蛋（EGGS）信用盤
 *
 * ── 與 K3-CD／SSC-CD 的差異 ──────────────────────────────
 *   PC蛋蛋玩法來源（bglottery pceggs）只有信用模式、沒有官方盤，
 *   因此不需要 *Shared.ts 共用期表／彩池那一層，直接用 LOTTERY_BASE 內建的
 *   `handle.prdOpenCode()` 產生當日期表即可 —— 只覆寫 `randomOpenCode`
 *   （3 顆球 0~9）與 `openCodePlay`（球號展示），不必像 k3Cd 整個 prdOpenCode 重寫。
 *
 * ── 與 6hc-cd 的差異 ────────────────────────────────────
 *   開獎是 3 顆球（0~9，可重複）而非 49 取 7。
 *   注項一律「一注一個注項」，沒有連碼那種一注多碼的組合玩法。
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
type UserStoreLike = { userId?: string; coin?: number; eggsRecord?: UserRecord }

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

/** 取一注的注碼；注項名稱本身就是注碼（"大"、"極大"、"紅波"、"豹子"、"17"） */
function _resolveBetCode(play?: { num?: number | string; label?: string | number }): string {
  const label = String(play?.label ?? '').trim()
  if (label) return label
  const num = Number(play?.num)
  return Number.isFinite(num) && num >= 0 ? String(num) : ''
}

/** 產生 3 顆球（0~9，可重複） */
function _eggsRandomOpenCode(): string[] {
  return Array.from({ length: 3 }, () => String(Math.floor(Math.random() * 10)))
}

export default class EGGS extends LOTTERY_BASE {
  issueSettledMap: Record<string, boolean>

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
  }

  constructor() {
    super(LOTTERY.EGGS.key, LOTTERY.EGGS.id)
    this.issueSettledMap = {}

    Object.assign(this._get, {
      user: (userId: string) => Storage.get.user(userId) as UserStoreLike,
      userRecord: (userId: string) => this.handle.ensureUserRecord(this._get.user(userId))
    })

    Object.assign(this.handle, {
      // PC蛋蛋開獎：3 顆球（可重複，0~9），不是 49 取 7
      randomOpenCode: () => _eggsRandomOpenCode(),
      // 開獎球資料：直接把 3 顆球點數帶出去
      openCodePlay: (openCode: string[]) => {
        const digits = eggsDigitsOf(openCode)
        if (!digits) return []
        return digits.map((num, idx) => ({ num, label: String(num), index: idx }))
      },
      ensureUserRecord: (user: UserStoreLike) => {
        // 與其他彩種分開存（eggsRecord），互不干擾
        if (!user.eggsRecord) {
          user.eggsRecord = { balanceChanges: [], betHistory: [], claimableIssues: [], updatedAt: Date.now() }
        }
        if (!Array.isArray(user.eggsRecord.balanceChanges)) user.eggsRecord.balanceChanges = []
        if (!Array.isArray(user.eggsRecord.betHistory)) user.eggsRecord.betHistory = []
        if (!Array.isArray(user.eggsRecord.claimableIssues)) user.eggsRecord.claimableIssues = []
        user.eggsRecord.updatedAt = Date.now()
        return user.eggsRecord
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
          ; (Array.isArray(input.groups) ? input.groups : []).forEach((group) => {
            const playKey = String(group?.playKey || '')
              ; (Array.isArray(group?.playList) ? group.playList : []).forEach((play) => {
                const tabId = _resolveTabId(play, group)
                const tabName = findEggsTab(playKey, tabId)?.tabName ?? String(tabId)
                const betCode = _resolveBetCode(play)
                if (!betCode || !eggsHasBetCode(playKey, tabId, betCode)) {
                  this.handle.rejectBet(`${tabName}「${betCode || '(空白)'}」不是有效注項`)
                }
                const quota = eggsQuotaOf(playKey, tabId)
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
        const orders = this._get.orders() as unknown as {
          get: { issueTabCoin: (issue: string, userId: string, tabId: number) => number }
        }
        newByTab.forEach(({ playKey, coin: newCoin }, tabId) => {
          const quota = eggsQuotaOf(playKey, tabId)
          if (!(quota.issue.max > 0)) return
          const used = Number(orders?.get?.issueTabCoin?.(input.issue, input.userId, tabId) ?? 0)
          if (used + newCoin > quota.issue.max) {
            const tabName = findEggsTab(playKey, tabId)?.tabName ?? String(tabId)
            this.handle.rejectBet(
              `${tabName} 單期投注上限 ${_money(quota.issue.max)}，本期已投注 ${_money(used)}、本次 ${_money(newCoin)}`
            )
          }
        })
      },
      buildOrderRows: (input: { issue: string; userId: string; amount: number; groups: Group[] }): BetOrderRow[] => {
        const rows: BetOrderRow[] = []
          ; (Array.isArray(input.groups) ? input.groups : []).forEach((group) => {
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
                odds: eggsTabOddsOf(playKey, tabId, betCode)
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
          const judged = judgeEggsBet(betCode, codes, coin, lockedOdds, eggsRtpOf(playKey, tabId))
          // 無法辨識的注項視為和局退還本金，避免吞掉玩家注金
          const result: EggsBetResult = judged?.result ?? 'tie'
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
      /** 該期開獎的和值（供前端顯示與冷熱分析） */
      sumOf: (openCode: string[]) => {
        const digits = eggsDigitsOf(openCode)
        return digits ? eggsSumOf(digits) : 0
      }
    })

    this.init()
  }

  init() {
    console.log('TTT---RUN.EGGS')
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
