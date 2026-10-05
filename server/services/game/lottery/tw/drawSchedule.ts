/**
 * 台彩「依日曆開獎」彩種（DLT／D539／M539／M649／P3／P4／SUPERLOTTO）共用的開獎時間計算。
 *
 * 原本 7 個彩種各自複製一份 `_nextDrawWindow()`，邏輯完全相同、只差常數，
 * 同一個 bug 必須修 7 次（見 fix-tw-lottery-stuck-settlement-clock-drift）。
 * 收斂成這支純函式後，各彩種只提供自己的 `DrawSchedule` 設定。
 *
 * ⚠️ 時區：開獎與鎖單時間一律以台灣時間（Asia/Taipei）計算，不依賴伺服器所在時區。
 * 台灣自 1979 年起沒有日光節約時間，固定 UTC+8，所以直接用固定位移換算即可，
 * 不需要引入時區資料庫。這樣伺服器跑在 UTC（雲端主機、CI）時結果也一樣。
 *
 * 刻意寫成獨立模組、不放進 `LOTTERY_BASE`：base.ts 會 import `Storage`，連帶載入整個
 * 伺服器服務圖；獨立的純函式才能在單元測試裡直接 import（見 test/unit/drawSchedule.test.ts）。
 */

/** 台灣固定 UTC+8 */
export const TAIPEI_OFFSET_MS = 8 * 60 * 60 * 1000

/** 往後找開獎日的最大天數；每週至少開獎一次的彩種，14 天內一定找得到 */
const MAX_SEARCH_DAYS = 13

export type ClockTime = { hour: number; minute: number }

export type DrawSchedule = {
  /** 開獎的星期（0 = 週日 … 6 = 週六，以台灣時間判定） */
  weekdays: readonly number[]
  /** 鎖單（停止投注）時間，台灣時間 */
  cutoff: ClockTime
  /** 開獎時間，台灣時間 */
  draw: ClockTime
}

export type DrawWindow = {
  /** 開獎日的台灣時間 00:00（epoch 對應的 Date） */
  drawDate: Date
  /** 鎖單時間（epoch ms） */
  cutoffAt: number
  /** 開獎時間（epoch ms） */
  drawAt: number
}

/**
 * 台灣時間 y/m/d 00:00 對應的 epoch ms。
 * `Date.UTC` 會自動處理 d 超出當月天數的進位（例如 1/32 → 2/1）。
 */
function _taipeiMidnight(year: number, month: number, day: number): number {
  return Date.UTC(year, month, day) - TAIPEI_OFFSET_MS
}

function _atClock(dayStartMs: number, time: ClockTime): number {
  return dayStartMs + (time.hour * 60 + time.minute) * 60 * 1000
}

/**
 * 找出「以 from 為基準，下一個尚未鎖單的開獎日」，回傳當天的鎖單與開獎時間。
 *
 * - 當天是開獎日、且還沒過鎖單時間 → 回傳當天
 * - 已過鎖單時間（即使還沒開獎）→ 往後找下一個開獎日
 * - 不會 mutate 傳入的 `from`（呼叫端可能傳全站共用的 `MEMORY.now`）
 *
 * 呼叫端必須傳入「真實的現在時間」，不能用舊的內部時間（例如 `this.drawAt`）往後推，
 * 否則伺服器休眠超過一個開獎週期後會永遠追不上（見 fix-bingo-stuck-settlement-clock-drift）。
 */
export function nextDrawWindow(from: Date, schedule: DrawSchedule): DrawWindow {
  const fromMs = from.getTime()
  // 位移 +8 小時後用 UTC getter 讀，取得的就是台灣當地的年月日
  const taipei = new Date(fromMs + TAIPEI_OFFSET_MS)
  const year = taipei.getUTCFullYear()
  const month = taipei.getUTCMonth()
  const day = taipei.getUTCDate()

  for (let i = 0; i <= MAX_SEARCH_DAYS; i++) {
    const weekday = new Date(Date.UTC(year, month, day + i)).getUTCDay()
    if (!schedule.weekdays.includes(weekday)) continue
    const dayStart = _taipeiMidnight(year, month, day + i)
    const cutoffAt = _atClock(dayStart, schedule.cutoff)
    if (fromMs >= cutoffAt) continue
    return { drawDate: new Date(dayStart), cutoffAt, drawAt: _atClock(dayStart, schedule.draw) }
  }

  // 只有 weekdays 設定錯誤（例如空陣列）才會走到這裡；保留原本行為：退回當天的時間
  const dayStart = _taipeiMidnight(year, month, day)
  return {
    drawDate: new Date(dayStart),
    cutoffAt: _atClock(dayStart, schedule.cutoff),
    drawAt: _atClock(dayStart, schedule.draw)
  }
}
