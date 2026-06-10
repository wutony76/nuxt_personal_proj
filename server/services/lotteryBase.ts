import { Storage } from './storage'
import { STATUS_TIME } from '~/config/constants'
import OrdersClass from './orders'
import BaseClass from './base'

type PlayItem = {
  num?: number | string
  label?: string | number
}

export type OpenCodeRecord = {
  issue: string
  openCode: string[]
  time: {
    start: string
    end: string
  }
  startAt: number
  endAt: number
}

export type CurrentInfo = OpenCodeRecord & {
  currentStatus: string
  issueCurrent: string
  issueLatest: string
  countdown: string
  statusEndAt: number
  openCodePlay: Array<Record<string, unknown>>
  openingCode: string[]
}

export const CYCLE_SECONDS = 7 * 60
export const CYCLE_MS = CYCLE_SECONDS * 1000
export const TOTAL_ISSUES_PER_DAY = 205

export default class LOTTERY_BASE extends BaseClass {
  // STATIC CONST
  static BASE_FIRST_PRIZE = 200000
  static JACKPOT_PERCENT = 0.8
  static BASE_PERCENT = 0.55
  static JACKPOT_BASE_MIN = Math.ceil(LOTTERY_BASE.BASE_FIRST_PRIZE / LOTTERY_BASE.BASE_PERCENT) + Math.ceil(LOTTERY_BASE.BASE_FIRST_PRIZE / 3)
  static JACKPOT_BASE_MAX = LOTTERY_BASE.BASE_FIRST_PRIZE * 7

  // INSTANCE STATE
  key: string
  id: number
  recordOpenCode: OpenCodeRecord[]
  currentIndex: number
  currentStatus: string
  issueOrderSeqMap: Record<string, number>

  constructor(key: string, id: number) {
    super()
    this.key = key
    this.id = id
    this.recordOpenCode = []
    this.currentIndex = -1
    this.currentStatus = STATUS_TIME.PREPARE
    this.issueOrderSeqMap = {}
  }

  // STATIC FUNC
  static getOrders(id: number, key: string): OrdersClass {
    const map = Storage.lottery.orders as Record<string, OrdersClass | undefined>
    if (!map[key]) map[key] = new OrdersClass({ id, key })
    return map[key] as OrdersClass
  }
  static normalizeBetCode(play?: PlayItem): string {
    const num = Number(play?.num)
    if (Number.isFinite(num) && num > 0) return String(num).padStart(2, '0')
    return String(play?.label ?? '').trim()
  }
  static createIssue(): string {
    const now = new Date()
    const year = String(now.getFullYear())
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const seq = String((now.getHours() * 60 + now.getMinutes()) % 300).padStart(3, '0')
    return `${year}${month}${day}${seq}`
  }
  static nextSerial(map: Record<string, number>, key: string): string {
    const current = Number(map[key] ?? 0) + 1
    map[key] = current
    return String(current).padStart(6, '0')
  }
  static createOrderId(prefix: string, map: Record<string, number>, issue: string): string {
    const serial = LOTTERY_BASE.nextSerial(map, issue)
    return `${prefix}${issue}${serial}`
  }
  static jackpotBase(min: number = LOTTERY_BASE.JACKPOT_BASE_MIN, max: number = LOTTERY_BASE.JACKPOT_BASE_MAX): number {
    return Math.floor(Math.random() * (max - min + 1)) + min
  }
  static jackpotCalc(jackpotBase: number, issuePool: number, carryJackpot: number, jackpotPercent: number = LOTTERY_BASE.JACKPOT_PERCENT, basePercent: number = LOTTERY_BASE.BASE_PERCENT): number {
    return Number((jackpotBase + (issuePool * jackpotPercent) + carryJackpot) * basePercent)
  }

  _get = {
    latestIssue: () => {
      if (this.recordOpenCode.length === 0) return '19900101001'
      return this.recordOpenCode[this.currentIndex]?.issue ?? this.recordOpenCode[0]?.issue ?? '19900101001'
    },
    orders: () => LOTTERY_BASE.getOrders(this.id, this.key)
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
    addOpenCodeItem: (): OpenCodeRecord => ({
      issue: '',
      openCode: [],
      time: { start: '', end: '' },
      startAt: 0,
      endAt: 0
    }),
    createOrderId: (issue: string) => {
      const safeIssue = String(issue ?? '').trim() || this._get.latestIssue()
      return LOTTERY_BASE.createOrderId(this.key, this.issueOrderSeqMap, safeIssue)
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
    // 子類別覆寫此方法以提供實際的球號對照資料
    openCodePlay: (_openCode: string[]): Array<Record<string, unknown>> => []
  }

  get = {
    currentInfo: (): CurrentInfo | null => {
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
}
