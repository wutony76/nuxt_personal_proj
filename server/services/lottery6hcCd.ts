import { Storage } from './storage'
import { LOTTERY, STATUS_TIME } from '~/config/constants'
import LOTTERY_BASE from './lotteryBase'
import { MEMORY } from './base'
import {
  buildCreditJackpotShares,
  CREDIT_JACKPOT,
  judgeCreditBet,
  shengxiaoAll,
  type CreditBetKind,
  type CreditBetResult
} from '#shared/config/6hc-cd'
// 賠率與限額一律讀分頁設定（c_tema / c_zhengma 的 odds、settings.quota）
import { creditQuotaOf, creditTabOddsOf, findCreditTab } from '#shared/config/cd/helpers'

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
          playList.forEach((play) => {
            const orderId = this.handle.createOrderId(input.issue)
            const betCode = LOTTERY_BASE.normalizeBetCode(play)
            if (!betCode) return
            // 每注各自金額（fallback 到整體 amount）
            const playCoin = Number(play?.amount ?? play?.coin ?? input.amount)
            const tabId = _resolveTabId(play, group)
            rows.push({
              issue: input.issue,
              user_id: input.userId,
              select_tab_id: tabId,
              bet_time: Date.now(),
              coin: Number.isFinite(playCoin) && playCoin > 0 ? playCoin : input.amount,
              order_id: `${orderId}(1/1)`,
              status: 'success',
              bet_code: [betCode],
              play_key: playKey,
              play_type_name: playTypeName,
              // 以該分頁設定的賠率鎖定在注單上（A/B 盤賠率不同，結算以此為準）
              odds: creditTabOddsOf(playKey, tabId, betCode)
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
        groups.forEach((group) => {
          const playKey = String(group?.playKey || '')
          const playList = Array.isArray(group?.playList) ? group.playList : []
          playList.forEach((play) => {
            const betCode = LOTTERY_BASE.normalizeBetCode(play)
            if (!betCode) return
            const tabId = _resolveTabId(play, group)
            const rawCoin = Number(play?.amount ?? play?.coin ?? input.amount)
            const coin = Number.isFinite(rawCoin) && rawCoin > 0 ? rawCoin : Number(input.amount)
            const quota = creditQuotaOf(playKey, tabId)
            const tabName = findCreditTab(playKey, tabId)?.tabName ?? String(tabId)

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
      // 統一的拒單方式（statusMessage 與 message 都帶，前端兩者皆可取）
      rejectBet: (message: string) => {
        throw createError({ statusCode: 400, statusMessage: message, message })
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
          odds?: number
        }>

        const payoutByUser = new Map<string, number>()
        // 逐注判定結果（供獎池分配計算）
        const judgedRows: Array<{
          orderId: string
          userId: string
          coin: number
          kind: CreditBetKind | null
          result: CreditBetResult
        }> = []
        issueOrders.forEach((row) => {
          const coin = Number(row.coin ?? 0)
          const betCode = Array.isArray(row.betCode) ? String(row.betCode[0] ?? '') : ''
          const playKey = String(row.playKey ?? '')
          // 依玩法分派判定：特碼看特別號、正碼看 6 顆正碼與七球總和
          const judged = judgeCreditBet({ playKey, betCode, openCode: codes, coin })
          // 無法辨識的注項（尚未支援的玩法）視為和局退還本金，避免吞掉玩家注金
          const result: CreditBetResult = judged?.result ?? 'tie'
          // 賠率以「下注時鎖定在注單上的值」為準（A/B 盤賠率不同），
          // 注單沒帶（舊資料）才退回判定函式回傳的玩法預設賠率
          const lockedOdds = Number(row.odds ?? 0)
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
                // 命中特別號僅特碼單號成立；正碼單號命中的是 6 顆正碼
                specialMatch: result === 'win' && judged?.kind === 'number' && playKey !== 'zhengma',
                winStatus: result,
                winAmount: payout,
                odds,
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
            result
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
      // 同時給 message：h3 未來會 sanitize statusMessage，前端兩者皆可取
      throw createError({ statusCode: 400, statusMessage: _msg, message: _msg })
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
        odds: row.odds // 下注時鎖定的賠率，結算派彩以此為準
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
