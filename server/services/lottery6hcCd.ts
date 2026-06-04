import { Storage } from './storage'
import { LOTTERY, STATUS_TIME } from '~/config/constants'
import LOTTERY_BASE from './lotteryBase'

type OpenCodeRecord = {
  issue: string
  openCode: string[]
  time: {
    start: string
    end: string
  }
  startAt: number
  endAt: number
}

type CurrentInfo = OpenCodeRecord & {
  currentStatus: string
  issueCurrent: string
  issueLatest: string
  countdown: string
  statusEndAt: number
  openCodePlay: Array<Record<string, unknown>>
  openingCode: string[]
}

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
}

type Group = {
  playTypeName?: string
  playKey?: string
  playList?: Array<{ num?: number | string; label?: string | number }>
}

type PlayBetsPayload = {
  amount?: number
  groups?: Group[]
}

type UserStoreLike = {
  userId?: string
  coin?: number
}

const CYCLE_SECONDS = 7 * 60
const CYCLE_MS = CYCLE_SECONDS * 1000
const TOTAL_ISSUES_PER_DAY = 205

export default class LHC_CD {
  key: string
  id: number
  recordOpenCode: OpenCodeRecord[]
  currentIndex: number
  currentStatus: string
  issueOrderSeqMap: Record<string, number>

  constructor() {
    this.key = LOTTERY['LHC-CD'].key
    this.id = LOTTERY['LHC-CD'].id
    this.recordOpenCode = []
    this.currentIndex = -1
    this.currentStatus = STATUS_TIME.PREPARE
    this.issueOrderSeqMap = {}
    this.init()
  }

  init() {
    this.handle.prdOpenCode()
    Storage.games[this.key] = this
    LOTTERY_BASE.getOrders(this.id, this.key)
  }

  circle() {
    this.handle.refreshCurrent(new Date())
  }

  playBets(payload: PlayBetsPayload, user: UserStoreLike) {
    const amount = Number(payload?.amount ?? 0)
    const userId = String(user?.userId ?? '')
    const beforeCoin = Number(user?.coin ?? 0)
    user.coin = beforeCoin - amount

    const issue = this.recordOpenCode[this.currentIndex]?.issue ?? this._get.latestIssue()
    const groups = Array.isArray(payload?.groups) ? payload.groups : []
    const rows = this.handle.buildOrderRows({ issue, userId, amount, groups })

    const orders = this._get.orders()
    rows.forEach((row) => {
      orders.add.record({
        issue: row.issue,
        userId: row.user_id,
        coin: row.coin,
        orderId: row.order_id,
        betCode: row.bet_code
      })
    })

    return {
      orderId: rows[0]?.order_id ? String(rows[0].order_id).split('(')[0] : '',
      orders: rows
    }
  }

  _get = {
    orders: () => LOTTERY_BASE.getOrders(this.id, this.key),
    latestIssue: () => {
      if (this.recordOpenCode.length === 0) return '19900101001'
      return this.recordOpenCode[this.currentIndex]?.issue ?? this.recordOpenCode[0]?.issue ?? '19900101001'
    }
  }

  get = {
    currentInfo: () => {
      this.handle.refreshCurrent(new Date())
      const current = this.recordOpenCode[this.currentIndex]
      if (!current) return null

      const latestOpenRecord =
        this.currentStatus === STATUS_TIME.OPENED
          ? current
          : (this.recordOpenCode[this.currentIndex - 1] ?? current)
      const nowMs = Date.now()
      const remain = Math.max(0, Math.floor((current.endAt - nowMs) / 1000))
      const statusEndAt = this.timer.getStatusEndAt(current, nowMs)

      return {
        ...latestOpenRecord,
        currentStatus: this.currentStatus,
        issueCurrent: current.issue,
        issueLatest: latestOpenRecord.issue,
        countdown: this.timer.formatCountdown(remain),
        statusEndAt,
        openCodePlay: this.handle.openCodePlay(latestOpenRecord.openCode),
        openingCode: current.openCode
      } satisfies CurrentInfo
    }
  }

  timer = {
    getStartOfDay: (now: Date) => {
      const at = new Date(now)
      at.setHours(0, 0, 0, 0)
      return at
    },
    formatDateKey: (date: Date) => {
      const y = date.getFullYear().toString()
      const m = String(date.getMonth() + 1).padStart(2, '0')
      const d = String(date.getDate()).padStart(2, '0')
      return `${y}${m}${d}`
    },
    secondsFromIssueStart: (record: OpenCodeRecord, nowMs: number) => {
      return Math.floor((nowMs - record.startAt) / 1000)
    },
    getStatusBySeconds: (sec: number) => {
      if (sec < 30) return STATUS_TIME.PREPARE
      if (sec < 340) return STATUS_TIME.OPEN
      if (sec < 350) return STATUS_TIME.CLOSED
      if (sec < 360) return STATUS_TIME.PREPARE_OPEN
      if (sec < 400) return STATUS_TIME.OPENING
      return STATUS_TIME.OPENED
    },
    formatCountdown: (seconds: number) => {
      const safe = Math.max(0, seconds)
      const min = Math.floor(safe / 60)
      const sec = safe % 60
      return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
    },
    getStatusEndAt: (record: OpenCodeRecord, nowMs: number) => {
      const sec = this.timer.secondsFromIssueStart(record, nowMs)
      let endSec = CYCLE_SECONDS
      if (sec < 30) endSec = 30
      else if (sec < 340) endSec = 340
      else if (sec < 350) endSec = 350
      else if (sec < 360) endSec = 360
      else if (sec < 400) endSec = 400
      return record.startAt + endSec * 1000
    }
  }

  handle = {
    openCodePlay: (openCode: string[]) => {
      return openCode
        .map((code) => {
          const num = Number(code)
          if (!Number.isFinite(num)) return null
          return (Storage.get.lotteryPlay(LOTTERY['6HC'].id, num) ?? null) as Record<string, unknown> | null
        })
        .filter((play): play is Record<string, unknown> => Boolean(play))
    },
    createOrderId: (issue: string) => {
      const safeIssue = String(issue ?? '').trim() || this._get.latestIssue()
      return LOTTERY_BASE.createOrderId(this.key, this.issueOrderSeqMap, safeIssue)
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
          rows.push({
            issue: input.issue,
            user_id: input.userId,
            bet_time: Date.now(),
            coin: input.amount,
            order_id: `${orderId}(1/1)`,
            status: 'success',
            bet_code: [betCode],
            play_key: playKey,
            play_type_name: playTypeName
          })
        })
      })
      if (rows.length > 0) return rows
      const orderId = this.handle.createOrderId(input.issue)
      return [{
        issue: input.issue,
        user_id: input.userId,
        bet_time: Date.now(),
        coin: input.amount,
        order_id: `${orderId}(1/1)`,
        status: 'success',
        bet_code: [],
        play_key: '',
        play_type_name: ''
      }]
    },
    randomOpenCode: () => {
      const source = Array.from({ length: 49 }, (_, i) => String(i + 1).padStart(2, '0'))
      for (let i = source.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        const tmp = source[i]
        source[i] = source[j] as string
        source[j] = tmp as string
      }
      const picked = source.slice(0, 7)
      const normalCodes = (picked.slice(0, 6) as string[]).sort((a, b) => Number(a) - Number(b))
      const specialCode = picked[6] as string
      return [...normalCodes, specialCode]
    },
    refreshCurrent: (now = new Date()) => {
      if (this.recordOpenCode.length === 0) {
        this.handle.prdOpenCode(now)
      }
      const first = this.recordOpenCode[0]
      if (!first) {
        this.currentIndex = -1
        this.currentStatus = STATUS_TIME.PREPARE
        return
      }

      const dayKey = this.timer.formatDateKey(now)
      if (!first.issue.startsWith(dayKey)) {
        this.handle.prdOpenCode(now)
      }

      const dayStartMs = this.timer.getStartOfDay(now).getTime()
      const nowMs = now.getTime()
      const diffMs = Math.max(0, nowMs - dayStartMs)
      const nextIndex = Math.min(TOTAL_ISSUES_PER_DAY - 1, Math.floor(diffMs / CYCLE_MS))
      this.currentIndex = nextIndex

      const current = this.recordOpenCode[this.currentIndex]
      if (!current) {
        this.currentStatus = STATUS_TIME.PREPARE
        return
      }
      const sec = this.timer.secondsFromIssueStart(current, nowMs)
      this.currentStatus = this.timer.getStatusBySeconds(sec)
    },
    prdOpenCode: (now = new Date()) => {
      const dayStart = this.timer.getStartOfDay(now).getTime()
      const dateKey = this.timer.formatDateKey(now)
      this.recordOpenCode = []
      for (let i = 0; i < TOTAL_ISSUES_PER_DAY; i++) {
        const record = this.handle.addOpenCodeItem()
        const startAt = dayStart + i * CYCLE_MS
        const endAt = startAt + CYCLE_MS
        record.issue = `${dateKey}${String(i + 1).padStart(3, '0')}`
        record.openCode = this.handle.randomOpenCode()
        record.time.start = new Date(startAt).toISOString()
        record.time.end = new Date(endAt).toISOString()
        record.startAt = startAt
        record.endAt = endAt
        this.recordOpenCode.push(record)
      }
      this.currentIndex = 0
      this.currentStatus = STATUS_TIME.PREPARE
    },
    addOpenCodeItem: (): OpenCodeRecord => ({
      issue: '',
      openCode: [],
      time: { start: '', end: '' },
      startAt: 0,
      endAt: 0
    })
  }
}
