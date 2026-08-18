/**
 * 時時彩官方盤（SSC-OF）：後三直選的獎金分層
 *
 * ── 為什麼是後三直選吃彩池 ──────────────────────────────
 *   官方盤 11 個分頁裡，只有後三直選改吃共用彩池，其餘維持固定賠率
 *   （注碼與賠率走 shared/config/sscog.ts）。理由與 pk10 前三直選相同：
 *   1/1000 的機率配固定賠率不好看，分層之後「猜中 2 位」也有獎，畫面上才有東西可拿。
 *
 *   ⚠️ 五星直選（1/100,000）雖然更極端，但要分到「命中 2 位」才有中獎感、
 *      得重新設計四層比例；後三直選的命中分布幾乎等同 pk10 前三直選
 *      （0.10 / 2.70 / 24.30 vs 0.14 / 2.92 / 23.75），可以直接沿用現成的三層比例。
 *
 * ── 與 pk10-of 的關鍵差異：注碼仍然是字串 ────────────────
 *   pk10 前三直選的注單存的是 `codes` 陣列（3 個車號），因為那邊要擋「同一台車佔兩個名次」；
 *   時時彩的號碼**可以重複**，沒有這個限制，所以彩池分頁沿用一般的字串注碼
 *   （`後三直選123`），前端的複式展開（sscOgComboCodes）完全不用改，
 *   伺端驗證也照走 sscOgHasBetCode。命中數由本檔的 sscOfMatchCount() 從字串解析。
 *
 * ── 命中數的定義：逐位比對 ──────────────────────────────
 *   後三 = 百位／十位／個位（開獎的第 3 ~ 5 球），逐位比對：
 *   例：猜 [1,2,3]、開後三 [1,3,2] → 只有百位對 → 命中 1
 *
 * ── 後三的機率（百十個位共 10³ = 1000 種等機率結果）──────
 *   命中 3：  1 種（0.1000%）
 *   命中 2： 27 種（2.7000%）  ← 兩位對、第三位開出其餘 9 個號碼之一
 *   命中 1：243 種（24.3000%）
 *   命中 0：729 種（72.9000%）
 *   由 sscOfMatchCounts() 窮舉驗證，不寫死。
 *
 * ── 與 SSC-CD 的關係 ────────────────────────────────────
 *   開獎號與彩池由 server/services/game/lottery/bg/sscShared.ts 共用，
 *   本檔只負責「一注怎麼判、命中幾個屬哪一層」，不碰狀態。
 */
import { sscDigitsOf, SSC_DIGIT_MAX } from '#shared/config/ssc'
import { SSC_OG_SECTIONS } from '#shared/config/sscog'

/** 後三直選要猜幾個位置（百／十／個） */
export const SSC_OF_PICK_COUNT = 3

/** 彩池分頁的注碼前綴（與 sscog.ts 的 DIRECT_PREFIX、sscog/plays.js 的 combo.prefix 同一個字串） */
export const SSC_OF_POOL_PREFIX = '後三直選'

/** 走彩池分層的玩法 key 與分頁 id（伺端據此把注單分流到兩條結算路） */
export const SSC_OF_POOL_PLAY_KEY = 'housan'
export const SSC_OF_POOL_TAB_ID = 101141010

/**
 * 獎金分層（後三直選專用）
 *   pool  —— 從該期可發放獎池按 ratio 切一塊，再依中獎者的下注額比例分配
 *            minAmount 為「每單位下注」的最低保障（僅頭獎設，避免下全注套利）
 *   fixed —— 固定倍數，直接按下注倍數發放
 * ⚠️ 未產生中獎者的 pool 層，該層獎金整塊滾存至下期（與 6hc-of / k3-of / pk10-of 相同）
 */
export type SscOfPrizeTier =
  | { match: number; type: 'pool'; ratio: number; minAmount?: number; name: string }
  | { match: number; type: 'fixed'; amount: number; name: string }

export const SSC_OF_PRIZE_TIERS: SscOfPrizeTier[] = [
  { match: 3, type: 'pool', ratio: 0.70, minAmount: 20000, name: '頭獎' },
  { match: 2, type: 'pool', ratio: 0.20, name: '二獎' },
  { match: 1, type: 'fixed', amount: 2, name: '三獎' }
]

/**
 * pool 型分層的 ratio 總和（未派出時的滾存計算會用到）
 * ⚠️ 要收斂小數：0.70 + 0.20 的浮點結果是 0.8999999999999999，
 *    直接拿去乘獎池會產生一分錢級別的誤差
 */
export const SSC_OF_POOL_RATIO_TOTAL = Number(
  SSC_OF_PRIZE_TIERS
    .filter((tier): tier is Extract<SscOfPrizeTier, { type: 'pool' }> => tier.type === 'pool')
    .reduce((sum, tier) => sum + tier.ratio, 0)
    .toFixed(4)
)

/**
 * 把後三直選的注碼正規化成 3 個號碼
 *
 * ⚠️ 不排序 —— 順序就是位置，排序會把「猜錯位置」變成「猜對」。
 * ⚠️ 也不檢查重複 —— 時時彩的號碼可以重複（`後三直選111` 是合法的一注）。
 * @param betCode `後三直選123`，或已經拆好的 3 個號碼
 * @returns [百, 十, 個] 的號碼；格式不合回 null
 */
export function sscOfPicksOf(betCode: string | number | Array<string | number>): number[] | null {
  const raw = Array.isArray(betCode)
    ? betCode.map((code) => String(code))
    : (() => {
        const code = String(betCode ?? '').trim()
        if (!code.startsWith(SSC_OF_POOL_PREFIX)) return []
        return code.slice(SSC_OF_POOL_PREFIX.length).split('')
      })()
  if (raw.length !== SSC_OF_PICK_COUNT) return null
  const picks = raw.map((code) => Number(code))
  if (picks.some((digit) => !Number.isInteger(digit) || digit < 0 || digit > SSC_DIGIT_MAX)) return null
  return picks
}

/**
 * 後三直選的命中數（逐位比對百十個位）
 * @returns 0 ~ 3；注碼或開獎格式不合回 null（呼叫端應視為無效注單）
 */
export function sscOfMatchCount(
  betCode: string | number | Array<string | number>,
  openCode: Array<string | number>
): number | null {
  const picks = sscOfPicksOf(betCode)
  const digits = sscDigitsOf(openCode)
  if (!picks || !digits) return null
  const tail = SSC_OG_SECTIONS['後三'].map((idx) => Number(digits[idx]))
  return picks.filter((digit, idx) => digit === tail[idx]).length
}

/** 命中數 → 所屬分層；不中回 null */
export function sscOfTierOf(matchCount: number): SscOfPrizeTier | null {
  const count = Number(matchCount)
  if (!Number.isInteger(count) || count <= 0) return null
  return SSC_OF_PRIZE_TIERS.find((tier) => tier.match === count) ?? null
}

/**
 * 窮舉後三的 1000 種結果，統計固定一注的命中數分布
 * （機率對帳與測試用；註解裡的 1 / 27 / 243 / 729 就是這支算出來的）
 * @returns index 0 ~ 3 對應命中 0 ~ 3 的結果數
 */
export function sscOfMatchCounts(picks: number[] = [1, 2, 3]): number[] {
  const table = [0, 0, 0, 0]
  const max = SSC_DIGIT_MAX + 1
  for (let hundred = 0; hundred < max; hundred++) {
    for (let ten = 0; ten < max; ten++) {
      for (let unit = 0; unit < max; unit++) {
        const tail = [hundred, ten, unit]
        const matched = picks.filter((digit, idx) => digit === tail[idx]).length
        table[matched] = Number(table[matched] ?? 0) + 1
      }
    }
  }
  return table
}

/**
 * 官方盤玩法定義（順序即前端玩法列的顯示順序，需與 sscog/plays.js 一致）
 * `pool: true` 代表該玩法**有**走彩池分層的分頁（housan 底下只有後三直選那一頁吃池）
 */
export const SSC_OF_PLAY_DEFINITIONS: Array<{ key: string; name: string; pool: boolean }> = [
  { key: 'dingwei', name: '定位膽', pool: false },
  { key: 'erxing', name: '二星', pool: false },
  { key: 'housan', name: '後三', pool: true },
  { key: 'wuxing', name: '五星', pool: false },
  { key: 'daxiao', name: '大小單雙', pool: false }
]
