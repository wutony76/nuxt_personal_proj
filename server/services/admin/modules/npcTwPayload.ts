/**
 * NPC 自動下注：8 款彩運來（台彩鏡射）玩法各自的「最小合法下注 payload」產生器。
 * 回 `null` 表示該玩法暫時不支援（`npcAutoPlay.ts` 會直接跳過）。
 * 每次呼叫都隨機產生合法號碼，讓 NPC 下的號碼有變化。
 * 不重複驗證業務邏輯，依賴各 service.playBets() 的內建驗證攔截非法下單。
 */

/**
 * 從 [min, max] 中隨機取 count 個不重複整數（升序）。
 * @param min 最小值（含）
 * @param max 最大值（含）
 * @param count 取幾個
 * @returns 升序排列的不重複整數陣列
 */
function _pickUnique(min: number, max: number, count: number): number[] {
  const pool: number[] = Array.from({ length: max - min + 1 }, (_, i) => i + min)
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = pool[i]!
    pool[i] = pool[j]!
    pool[j] = tmp
  }
  return pool.slice(0, count).sort((a, b) => a - b)
}

/**
 * 在 [min, max] 之間取一個隨機整數（含頭含尾）。
 * @param min 最小值
 * @param max 最大值
 * @returns 隨機整數
 */
function _randInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1))
}

/**
 * 產生 count 個 0~9 的隨機數字（可重複，供 3星彩／4星彩 使用）。
 * @param count 位數
 * @returns 數字陣列
 */
function _randomDigits(count: number): number[] {
  return Array.from({ length: count }, () => _randInt(0, 9))
}

export type TwBetResult = {
  payload: unknown
  betAmount: number
}

/**
 * 依遊戲 key 產生一組最小合法的隨機下注 payload。
 * @param key 彩運來遊戲的 key（DLT / SUPERLOTTO / D539 / M649 / M539 / P3 / P4 / BINGO）
 * @returns payload + betAmount，或 null（不支援的 key）
 */
export function buildTwBetPayload(key: string): TwBetResult | null {
  switch (key) {
    // 大樂透：6 個不重複號碼 01–49（特別號是官方開獎後才有，投注不選）
    case 'DLT':
      return {
        payload: { slots: [{ numbers: _pickUnique(1, 49, 6) }] },
        betAmount: 50
      }

    // 威力彩：第一區 6 個不重複 01–38 + 第二區 1 個 01–08
    case 'SUPERLOTTO':
      return {
        payload: { slots: [{ zoneA: _pickUnique(1, 38, 6), zoneB: _randInt(1, 8) }] },
        betAmount: 100
      }

    // 今彩539：5 個不重複號碼 01–39
    case 'D539':
      return {
        payload: { slots: [{ numbers: _pickUnique(1, 39, 5) }] },
        betAmount: 50
      }

    // 49樂合彩：2 個不重複號碼 01–49（最小合法組數為 2）
    case 'M649':
      return {
        payload: { slots: [{ numbers: _pickUnique(1, 49, 2) }] },
        betAmount: 25
      }

    // 39樂合彩：2 個不重複號碼 01–39（最小合法組數為 2）
    case 'M539':
      return {
        payload: { slots: [{ numbers: _pickUnique(1, 39, 2) }] },
        betAmount: 25
      }

    // 3星彩：正彩，3 個 0~9 的數字（可重複）
    case 'P3':
      return {
        payload: { slots: [{ betType: 'zhengcai', digits: _randomDigits(3) }] },
        betAmount: 25
      }

    // 4星彩：正彩，4 個 0~9 的數字（可重複）
    case 'P4':
      return {
        payload: { slots: [{ betType: 'zhengcai', digits: _randomDigits(4) }] },
        betAmount: 25
      }

    // 賓果賓果：猜大小（最簡單的下注方式，每注 25）
    case 'BINGO':
      return {
        payload: { slots: [{ betType: 'bigSmall', pick: Math.random() < 0.5 ? 'big' : 'small' }] },
        betAmount: 25
      }

    default:
      return null
  }
}
