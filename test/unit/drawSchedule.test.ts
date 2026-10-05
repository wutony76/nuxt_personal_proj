import { describe, expect, it } from 'vitest'
import {
  nextDrawWindow,
  type DrawSchedule
} from '../../server/services/game/lottery/tw/drawSchedule'
import * as DLT from '../../shared/config/dlt'
import * as D539 from '../../shared/config/d539'
import * as M539 from '../../shared/config/m539'
import * as M649 from '../../shared/config/m649'
import * as P3 from '../../shared/config/p3'
import * as P4 from '../../shared/config/p4'
import * as SUPERLOTTO from '../../shared/config/superlotto'

/** 以台灣時間建立 Date，例如 tpe('2026-10-06 19:59') */
const tpe = (local: string) => new Date(`${local.replace(' ', 'T')}:00+08:00`)

/** 把 epoch ms 轉回台灣時間字串，方便比對與閱讀失敗訊息 */
const fmt = (ms: number) => {
  const d = new Date(ms + 8 * 60 * 60 * 1000)
  return d.toISOString().slice(0, 16).replace('T', ' ')
}

/** 台灣時間的星期（0 = 週日） */
const taipeiWeekday = (ms: number) => new Date(ms + 8 * 60 * 60 * 1000).getUTCDay()

const DLT_SCHEDULE: DrawSchedule = {
  weekdays: DLT.DLT_DRAW_WEEKDAYS,
  cutoff: { hour: DLT.DLT_CUTOFF_HOUR, minute: DLT.DLT_CUTOFF_MINUTE },
  draw: { hour: DLT.DLT_DRAW_HOUR, minute: DLT.DLT_DRAW_MINUTE }
}

const D539_SCHEDULE: DrawSchedule = {
  weekdays: D539.D539_DRAW_WEEKDAYS,
  cutoff: { hour: D539.D539_CUTOFF_HOUR, minute: D539.D539_CUTOFF_MINUTE },
  draw: { hour: D539.D539_DRAW_HOUR, minute: D539.D539_DRAW_MINUTE }
}

describe('測試環境', () => {
  it('以 UTC 執行（證明計算與伺服器時區無關）', () => {
    expect(new Date(0).getTimezoneOffset()).toBe(0)
  })
})

describe('nextDrawWindow：大樂透（週二、五 20:00 鎖單、20:30 開獎）', () => {
  it('非開獎日 → 下一個開獎日', () => {
    const w = nextDrawWindow(tpe('2026-10-05 10:00'), DLT_SCHEDULE) // 週一
    expect(fmt(w.drawDate.getTime())).toBe('2026-10-06 00:00')
    expect(fmt(w.cutoffAt)).toBe('2026-10-06 20:00')
    expect(fmt(w.drawAt)).toBe('2026-10-06 20:30')
  })

  it('開獎日、鎖單前 1 秒 → 當天', () => {
    const from = new Date(tpe('2026-10-06 20:00').getTime() - 1000)
    expect(fmt(nextDrawWindow(from, DLT_SCHEDULE).cutoffAt)).toBe('2026-10-06 20:00')
  })

  it('開獎日、剛好鎖單 → 下一個開獎日（鎖單時間本身就不能再下注）', () => {
    expect(fmt(nextDrawWindow(tpe('2026-10-06 20:00'), DLT_SCHEDULE).cutoffAt)).toBe('2026-10-09 20:00')
  })

  it('鎖單後、開獎前 → 下一個開獎日', () => {
    expect(fmt(nextDrawWindow(tpe('2026-10-06 20:15'), DLT_SCHEDULE).cutoffAt)).toBe('2026-10-09 20:00')
  })

  it('週五開獎後 → 跨週到下週二', () => {
    expect(fmt(nextDrawWindow(tpe('2026-10-09 23:00'), DLT_SCHEDULE).cutoffAt)).toBe('2026-10-13 20:00')
  })
})

describe('nextDrawWindow：時區', () => {
  it('台灣清晨（UTC 仍是前一天）→ 以台灣日期判斷開獎日', () => {
    // 台灣 10/6（週二）07:00 = UTC 10/5（週一）23:00；若誤用 UTC 日期會被當成週一
    const w = nextDrawWindow(tpe('2026-10-06 07:00'), DLT_SCHEDULE)
    expect(fmt(w.cutoffAt)).toBe('2026-10-06 20:00')
  })

  it('跨年：台灣 12/31 晚上 → 1/1 開獎，開獎日是台灣時間的 1/1', () => {
    const w = nextDrawWindow(tpe('2026-12-31 21:00'), D539_SCHEDULE)
    expect(fmt(w.drawDate.getTime())).toBe('2027-01-01 00:00')
    expect(fmt(w.drawAt)).toBe('2027-01-01 20:30')
  })

  it('跨月：月底最後一天鎖單後 → 下個月', () => {
    expect(fmt(nextDrawWindow(tpe('2026-10-31 20:00'), D539_SCHEDULE).cutoffAt)).toBe('2026-11-02 20:00')
  })
})

describe('nextDrawWindow：伺服器休眠後追上真實時間', () => {
  it('從休眠數週後的「現在」計算，結果一定在未來', () => {
    // 對應 fix-bingo-stuck-settlement-clock-drift：基準必須是真實 now，
    // 這裡模擬上一期在 10/6 開獎、伺服器 3 週後才醒來
    const wokeUpAt = tpe('2026-10-27 09:00')
    const w = nextDrawWindow(wokeUpAt, DLT_SCHEDULE)
    expect(w.cutoffAt).toBeGreaterThan(wokeUpAt.getTime())
    expect(fmt(w.cutoffAt)).toBe('2026-10-27 20:00')
  })
})

describe('nextDrawWindow：一般性質（一年內每 37 分鐘取樣）', () => {
  const start = tpe('2026-01-01 00:00').getTime()
  const end = tpe('2027-01-01 00:00').getTime()
  const step = 37 * 60 * 1000

  it.each([
    ['大樂透', DLT_SCHEDULE],
    ['今彩539', D539_SCHEDULE]
  ] as const)('%s：結果在未來、落在開獎日、且是最早的一個', (_name, schedule) => {
    for (let t = start; t < end; t += step) {
      const w = nextDrawWindow(new Date(t), schedule)
      expect(w.cutoffAt).toBeGreaterThan(t)
      expect(schedule.weekdays).toContain(taipeiWeekday(w.cutoffAt))
      expect(w.drawAt - w.cutoffAt).toBe(30 * 60 * 1000)
      // 從 t 到結果之間不存在更早、且尚未鎖單的開獎日
      for (let d = w.cutoffAt - 24 * 60 * 60 * 1000; d > t; d -= 24 * 60 * 60 * 1000) {
        if (schedule.weekdays.includes(taipeiWeekday(d))) {
          throw new Error(`${fmt(t)} 應該選 ${fmt(d)}，實際選了 ${fmt(w.cutoffAt)}`)
        }
      }
    }
  })
})

describe('nextDrawWindow：其他行為', () => {
  it('不會修改傳入的 Date', () => {
    const from = tpe('2026-10-05 10:00')
    const before = from.getTime()
    nextDrawWindow(from, DLT_SCHEDULE)
    expect(from.getTime()).toBe(before)
  })

  it('weekdays 為空（設定錯誤）時退回當天，不會無限迴圈', () => {
    const w = nextDrawWindow(tpe('2026-10-05 10:00'), { ...DLT_SCHEDULE, weekdays: [] })
    expect(fmt(w.cutoffAt)).toBe('2026-10-05 20:00')
  })
})

describe('各彩種的開獎設定', () => {
  const configs = [
    ['DLT', DLT.DLT_DRAW_WEEKDAYS, DLT.DLT_CUTOFF_HOUR, DLT.DLT_CUTOFF_MINUTE, DLT.DLT_DRAW_HOUR, DLT.DLT_DRAW_MINUTE],
    ['D539', D539.D539_DRAW_WEEKDAYS, D539.D539_CUTOFF_HOUR, D539.D539_CUTOFF_MINUTE, D539.D539_DRAW_HOUR, D539.D539_DRAW_MINUTE],
    ['M539', M539.M539_DRAW_WEEKDAYS, M539.M539_CUTOFF_HOUR, M539.M539_CUTOFF_MINUTE, M539.M539_DRAW_HOUR, M539.M539_DRAW_MINUTE],
    ['M649', M649.M649_DRAW_WEEKDAYS, M649.M649_CUTOFF_HOUR, M649.M649_CUTOFF_MINUTE, M649.M649_DRAW_HOUR, M649.M649_DRAW_MINUTE],
    ['P3', P3.P3_DRAW_WEEKDAYS, P3.P3_CUTOFF_HOUR, P3.P3_CUTOFF_MINUTE, P3.P3_DRAW_HOUR, P3.P3_DRAW_MINUTE],
    ['P4', P4.P4_DRAW_WEEKDAYS, P4.P4_CUTOFF_HOUR, P4.P4_CUTOFF_MINUTE, P4.P4_DRAW_HOUR, P4.P4_DRAW_MINUTE],
    ['SUPERLOTTO', SUPERLOTTO.SUPERLOTTO_DRAW_WEEKDAYS, SUPERLOTTO.SUPERLOTTO_CUTOFF_HOUR, SUPERLOTTO.SUPERLOTTO_CUTOFF_MINUTE, SUPERLOTTO.SUPERLOTTO_DRAW_HOUR, SUPERLOTTO.SUPERLOTTO_DRAW_MINUTE]
  ] as const

  it.each(configs)('%s：有開獎日、星期合法、鎖單早於開獎', (_name, weekdays, cutH, cutM, drawH, drawM) => {
    expect(weekdays.length).toBeGreaterThan(0)
    for (const d of weekdays) expect(d >= 0 && d <= 6).toBe(true)
    expect(cutH * 60 + cutM).toBeLessThan(drawH * 60 + drawM)
  })
})
