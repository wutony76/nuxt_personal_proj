import { Storage } from './storage'
import { LOTTERY, STATUS_TIME } from '~/config/constants'
import OrdersClass from './orders'
import { prdDbId } from './config'

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
}

const CYCLE_SECONDS = 7 * 60
const CYCLE_MS = CYCLE_SECONDS * 1000
const TOTAL_ISSUES_PER_DAY = 205

export default class LHC_OF {
  id: number
  recordOpenCode: OpenCodeRecord[]
  currentIndex: number
  currentStatus: string

  constructor() {
    this.id = LOTTERY['LHC-OF'].id
    this.recordOpenCode = []
    this.currentIndex = -1
    this.currentStatus = STATUS_TIME.PREPARE
    this.init()
  }

  init() {
    this.handle.prdOpenCode()
    Storage.games[LOTTERY['LHC-OF'].key] = this
    console.log('LHC_OF.init.success', this.recordOpenCode)
    new OrdersClass({ id: LOTTERY['LHC-OF'].id, key: LOTTERY['LHC-OF'].key })
  }

  circle() {
    // console.log('RUN: LHC_OF.circle.Task')
    this.handle.refreshCurrent(new Date())
  }

  // USERPLAY.
  playBets(payload: any, user: any) {
    // HANDLE COIN
    const amount = Number(payload.amount)
    user.coin -= amount

    // HANDLE CONFIG PLAY INFO 
    const groups = payload.groups
    const lhcConfig = this._get.configPlay()
    groups.forEach((group: any) => {
      const playList = Array.isArray(group?.playList) ? group.playList : []
      playList.forEach((play: any) => {
        const num = Number(play?.num ?? play?.label)
        if (!Number.isFinite(num) || num <= 0) return
        const dbId = prdDbId(LOTTERY['6HC'].id, num)
        const target = lhcConfig?.[dbId]
        if (!target) return
        target.countShow = Number(target.countShow ?? 0) + 1
      })
    })

    // HANDLE ORDERS RECORD
    const _orders = this._get.orders()
    _orders.add.record({ issue: this.recordOpenCode[this.currentIndex]?.issue, userId: user.id, coin: amount })
  }
  _get = {
    configPlay: () => {
      const lhcConfig = Storage.config.LHC as Record<string, any> | undefined
      return lhcConfig
    },
    orders: () => {
      return Storage.lottery.orders[LOTTERY['LHC-OF'].key]
    }
  }
  get = {
    currentInfo: () => {
      this.handle.refreshCurrent(new Date())
      const current = this.recordOpenCode[this.currentIndex]
      if (!current) {
        return null
      }
      const issueLatest =
        this.currentStatus === STATUS_TIME.OPENED
          ? current.issue
          : (this.recordOpenCode[this.currentIndex - 1]?.issue ?? current.issue)
      const nowMs = Date.now()
      const remain = Math.max(0, Math.floor((current.endAt - nowMs) / 1000))
      const statusEndAt = this.timer.getStatusEndAt(current, nowMs)
      return {
        ...current,
        currentStatus: this.currentStatus,
        issueCurrent: current.issue,
        issueLatest,
        countdown: this.timer.formatCountdown(remain),
        statusEndAt,
        openCodePlay: this.handle.openCodePlay(current.openCode)
      } satisfies CurrentInfo
    },
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
      if (sec < 330) return STATUS_TIME.OPEN
      if (sec < 335) return STATUS_TIME.PREPARE_CLOSE
      if (sec < 336) return STATUS_TIME.PREPARE_CLOSE_5
      if (sec < 337) return STATUS_TIME.PREPARE_CLOSE_4
      if (sec < 338) return STATUS_TIME.PREPARE_CLOSE_3
      if (sec < 339) return STATUS_TIME.PREPARE_CLOSE_2
      if (sec < 340) return STATUS_TIME.PREPARE_CLOSE_1
      if (sec < 350) return STATUS_TIME.CLOSED
      if (sec < 360) return STATUS_TIME.PREPARE_OPEN
      if (sec < 375) return STATUS_TIME.OPENING
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
      else if (sec < 330) endSec = 330
      else if (sec < 335) endSec = 335
      else if (sec < 336) endSec = 336
      else if (sec < 337) endSec = 337
      else if (sec < 338) endSec = 338
      else if (sec < 339) endSec = 339
      else if (sec < 340) endSec = 340
      else if (sec < 350) endSec = 350
      else if (sec < 360) endSec = 360
      else if (sec < 375) endSec = 375
      return record.startAt + endSec * 1000
    }
  }

  handle = {
    openCodePlay: (openCode: string[]) => {
      return openCode
        .map((code) => {
          const num = Number(code)
          if (!Number.isFinite(num)) return null
          const play = Storage.get.lotteryPlay(LOTTERY['6HC'].id, num)
          return (play ?? null) as Record<string, unknown> | null
        })
        .filter((play): play is Record<string, unknown> => Boolean(play))
    },
    randomOpenCode: () => {
      const source = Array.from({ length: 49 }, (_, i) => String(i + 1).padStart(2, '0'))
      for (let i = source.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        const tmp = source[i]
        source[i] = source[j] as string
        source[j] = tmp as string
      }
      return source.slice(0, 7).sort((a, b) => Number(a) - Number(b))
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
    // 205 
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
    addOpenCodeItem: () => {
      return {
        issue: '',
        openCode: [],
        time: {
          start: '',
          end: ''
        },
        startAt: 0,
        endAt: 0
      } as OpenCodeRecord
    }
  }
}