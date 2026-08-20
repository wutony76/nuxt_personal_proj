/**
 * 快樂十分（KL10）的基本運算與號碼判定（遊戲層）
 *
 * 開獎為 8 個號碼、每個 1 ~ 20 且**互不重複**（第一 ~ 第八球，有位置），
 * 所以同一個彩種有三種母數，用錯就會算錯賠率：
 *
 *   | 判定對象           | 母數                    | 用在                                   |
 *   |--------------------|-------------------------|----------------------------------------|
 *   | 單一球位的號碼分布 | 20（邊際分布）          | 正和的單碼 1/20、單球兩面 10/20        |
 *   | 兩球位的相對大小   | 2（對稱）               | 龍虎鬥 龍/虎 各 1/2                    |
 *   | 8 碼的**集合**性質 | C(20,8) = 125,970       | 總和、上下盤、奇偶盤、任選、爆池       |
 *
 * ⚠️ 邊際分布為什麼是均勻的：抽 8 個不重複號碼、位置隨機，
 *    任一球位落在任一號碼的機率都是 1/20（超幾何分布的邊際均勻性），
 *    所以單球類直接用 20 當母數，不必窮舉排列數 P(20,8)。
 * ⚠️ 但**總和不能用邊際分布算** —— 8 個號碼不獨立（不重複），必須建表；
 *    做法同 `shared/config/x5.ts`，差別是這裡的組合數是 125,970（x5 只有 462），
 *    所以 `kl10SumCounts()` 只累加計數、**不保留組合陣列**（否則會吃掉數 MB 記憶體）。
 *
 * ── 與 eggs / x5 / ssc 的分工一致 ────────────────────────
 *   本檔                        號碼運算 + 機率建表
 *   shared/config/kl10-cd.ts    信用盤：注碼判定 + 賠率推導 + 爆池
 *   shared/config/kl10cd/       看板設定（注項、限額、爆池權重），由 helpers 讀取
 *
 * ⚠️ 快樂十分**只有信用盤**（來源 bglottery `kl10/` 沒有 official 子目錄），
 *    因此沒有 kl10-of.ts、也沒有 kl10Shared.ts。
 * ⚠️ 本檔不可 import 任何 helpers（helpers 會 import 本檔，會形成循環）。
 *
 * ── 來源與規則依據 ───────────────────────────────────────
 *   球號範圍 1~20、一期 8 球：bglottery `kl10/allTraditional/zhenghe/play_script.js`
 *                             與 `renxuan/play_script.js` 皆以 `for (i = 1; i <= 20; i++)`
 *                             展開號碼池；`index_script.js` 的開獎號預設值為 8 個 '?'
 *   玩法分類／playId：`kl10/allTraditional/{zhenghe,lhd,renxuan,liangmian}/config*.js`
 *   ⚠️ `kl10/dict.js`（0~27 四色波表）在 kl10 底下**零 import**，且 4 個 config 沒有色波 playId
 *      —— 是從 pceggs 複製後未清除的殘留檔，本彩種**沒有色波玩法**（見 add-kl10/design.md）
 *   判定門檻：來源前端只有 playId（名稱與賠率是伺端 LotteryPlayOdds 回傳後才併入），
 *            以下四個門檻常數由使用者於提案階段拍板，各自只寫一處
 */

/** 一期開幾個號碼 */
export const KL10_BALL_COUNT = 8
/** 號碼範圍（1 ~ 20） */
export const KL10_NUMBER_MIN = 1
export const KL10_NUMBER_MAX = 20
/** 全部可下注號碼（1 ~ 20） */
export const KL10_NUMBERS: number[] = Array.from(
  { length: KL10_NUMBER_MAX - KL10_NUMBER_MIN + 1 },
  (_, i) => KL10_NUMBER_MIN + i
)

/**
 * 單球大小分界：號碼 ≥ 11 為大
 * ⚠️ **使用者於提案階段拍板**（來源只有 playId，沒有門檻）。
 *    1 ~ 20 對半切 → 大 10 個（11~20）、小 10 個（1~10），兩邊機率相同、賠率也相同。
 */
export const KL10_BIG_LINE = 11
/**
 * 單球尾數分界：號碼個位 ≥ 5 為尾大
 * ⚠️ **使用者於提案階段拍板**；1 ~ 20 中尾大／尾小各 10 個。
 */
export const KL10_TAIL_BIG_LINE = 5
/**
 * 上下盤的號碼半分線：號碼 ≤ 10 算「上」（小號區），≥ 11 算「下」（大號區）
 * ⚠️ 來源 kl10 沒有判定邏輯，唯一線索是同家族的 `kl8/allTraditional/renxuan/play.vue:38`
 *    把號碼池前半標「上盘」、後半標「下盘」；以此類推到 kl10 的 1~20，
 *    並由**使用者拍板**「比個數多寡、4:4 為和盤」。
 */
export const KL10_HALF_LINE = 10

/** 總和範圍（1+…+8 ~ 13+…+20） */
export const KL10_SUM_MIN = 36
export const KL10_SUM_MAX = 132
/**
 * 總和大小分界：總和 ≥ 84 為大
 * ⚠️ **使用者於提案階段拍板**（無和局）。分佈對稱於 84，界線切在 84 →
 *    84 那 3,788 種歸大，所以總和大（64,879）與總和小（61,091）機率不同、賠率也不同。
 *    做法同 `shared/config/x5.ts` 的 `X5_SUM_BIG_LINE`。
 */
export const KL10_SUM_BIG_LINE = 84
/**
 * 總和尾數分界：總和個位 ≥ 5 為尾大
 * ⚠️ **使用者於提案階段拍板**（比照 `X5_SUM_TAIL_BIG_LINE`）。
 */
export const KL10_SUM_TAIL_BIG_LINE = 5

/**
 * 爆池門檻：奇數（或偶數）佔到這個個數以上就算「一邊倒」
 * ⚠️ **使用者於提案階段拍板**：7 個 → 2,490/125,970 ≒ 1.9767%，
 *    與 6hc-cd 的「特別號開 49」（1/49 ≒ 2.04%）同量級。改門檻只需動這一處。
 */
export const KL10_JACKPOT_LOPSIDED_MIN = 7

/** 球位名稱（index 0 = 第一球） */
export const KL10_BALL_NAMES = [
  '第一球', '第二球', '第三球', '第四球', '第五球', '第六球', '第七球', '第八球'
] as const
export type Kl10BallName = (typeof KL10_BALL_NAMES)[number]

/** 8 碼**組合**的總數 C(20,8)；集合性質（總和／上下盤／奇偶盤／任選／爆池）的母數 */
export const KL10_TOTAL_COMBOS = 125970

/** 注項的樣本空間：命中數 / 母數（賠率由此推導） */
export type Kl10Chance = { hit: number; total: number }

/** 上下盤／奇偶盤的三種結果（兩組都有「和盤」，注碼另以 上下和／奇偶和 區分，見 kl10-cd.ts） */
export type Kl10Zone = '上盤' | '和盤' | '下盤'
export type Kl10ParityZone = '奇盤' | '和盤' | '偶盤'
/** 龍虎：兩球位比大小（無和局） */
export type Kl10DragonResult = '龍' | '虎'

/** 號碼顯示格式（一律補零兩位：01 ~ 20） */
export function kl10NumberLabel(num: number): string {
  return String(num).padStart(2, '0')
}

/**
 * 把開獎號正規化成 8 個號碼；格式不合回 null
 * ⚠️ 必須檢查唯一性（快樂十分是不重複抽樣），同 x5、與 ssc/eggs（可重複）相反
 */
export function kl10NumbersOf(openCode: Array<string | number>): number[] | null {
  const raw = Array.isArray(openCode) ? openCode : []
  if (raw.length !== KL10_BALL_COUNT) return null
  const nums = raw.map((code) => Number(code))
  if (nums.some((n) => !Number.isInteger(n) || n < KL10_NUMBER_MIN || n > KL10_NUMBER_MAX)) return null
  if (new Set(nums).size !== nums.length) return null
  return nums
}

/** 總和（8 個號碼相加，36 ~ 132） */
export function kl10SumOf(nums: number[]): number {
  return nums.reduce((acc, cur) => acc + Number(cur), 0)
}

/** 總和的個位數（尾大／尾小用） */
export function kl10SumTailOf(nums: number[]): number {
  return kl10SumOf(nums) % 10
}

/**
 * 合數：號碼十位 + 個位（合單／合雙用）
 * 例：12 → 3（合單）、20 → 2（合雙）、7 → 7（合單）
 */
export function kl10DigitSumOf(num: number): number {
  const value = Math.abs(Math.trunc(Number(num) || 0))
  return Math.floor(value / 10) + (value % 10)
}

/**
 * 龍虎：兩個球位比大小
 * ⚠️ 沒有「和」—— 8 個號碼互不重複，兩球位不可能相等。
 *    真的相等（開獎資料異常）回 null，由呼叫端當成無法判定處理，不硬塞一個結果。
 */
export function kl10DragonOf(nums: number[], indexA: number, indexB: number): Kl10DragonResult | null {
  const a = nums[indexA]
  const b = nums[indexB]
  if (a === undefined || b === undefined) return null
  if (a === b) return null
  return a > b ? '龍' : '虎'
}

/** 落在上盤區（號碼 ≤ KL10_HALF_LINE）的個數 */
export function kl10LowCountOf(nums: number[]): number {
  return nums.reduce((acc, num) => (Number(num) <= KL10_HALF_LINE ? acc + 1 : acc), 0)
}

/** 奇數號碼的個數 */
export function kl10OddCountOf(nums: number[]): number {
  return nums.reduce((acc, num) => (Number(num) % 2 === 1 ? acc + 1 : acc), 0)
}

/** 上下盤：小號區個數 vs 大號區個數（4:4 為和盤） */
export function kl10ZoneOf(nums: number[]): Kl10Zone {
  const low = kl10LowCountOf(nums)
  const high = nums.length - low
  if (low > high) return '上盤'
  if (low < high) return '下盤'
  return '和盤'
}

/** 奇偶盤：奇數個數 vs 偶數個數（4:4 為和盤） */
export function kl10ParityZoneOf(nums: number[]): Kl10ParityZone {
  const odd = kl10OddCountOf(nums)
  const even = nums.length - odd
  if (odd > even) return '奇盤'
  if (odd < even) return '偶盤'
  return '和盤'
}

/** 這一期是不是「奇偶一邊倒」（爆池條件的號碼特徵，判定包裝在 kl10-cd.ts） */
export function kl10IsLopsidedParity(nums: number[]): boolean {
  const odd = kl10OddCountOf(nums)
  const even = nums.length - odd
  return odd >= KL10_JACKPOT_LOPSIDED_MIN || even >= KL10_JACKPOT_LOPSIDED_MIN
}

// ── 機率建表 ────────────────────────────────────────────────────────────────

/** 算過就存起來：建表只做一次 */
const _memo = new Map<string, unknown>()
function _cached<T>(key: string, build: () => T): T {
  if (!_memo.has(key)) _memo.set(key, build())
  return _memo.get(key) as T
}

/** 組合數 C(n, k)（任選的母數與命中數都靠它） */
export function kl10ChooseCount(n: number, k: number): number {
  const total = Math.trunc(Number(n) || 0)
  const pick = Math.trunc(Number(k) || 0)
  if (pick < 0 || pick > total) return 0
  let result = 1
  for (let i = 0; i < pick; i++) result = (result * (total - i)) / (i + 1)
  return Math.round(result)
}

/**
 * 總和 36 ~ 132 的組合數（合計 125,970，對稱於 84）
 * ⚠️ 用遞迴累加計數，**不保留 125,970 個組合陣列** —— 表本身只有 97 個整數。
 */
export function kl10SumCounts(): Record<number, number> {
  return _cached('sumCounts', () => {
    const table: Record<number, number> = {}
    const walk = (start: number, picked: number, sum: number): void => {
      if (picked === KL10_BALL_COUNT) {
        table[sum] = (table[sum] ?? 0) + 1
        return
      }
      // 還要選 (KL10_BALL_COUNT - picked) 個，起點不能大到湊不滿
      const last = KL10_NUMBER_MAX - (KL10_BALL_COUNT - picked - 1)
      for (let n = start; n <= last; n++) walk(n + 1, picked + 1, sum + n)
    }
    walk(KL10_NUMBER_MIN, 0, 0)
    return table
  })
}

/**
 * 「10 對 10」分割的組合數表：index k = 8 碼中恰有 k 個落在其中一半的組合數
 * 即 `C(10, k) × C(10, 8 - k)`，合計 125,970。
 *
 * ⚠️ 上下盤（1~10 對 11~20）與奇偶盤（10 個奇數對 10 個偶數）**共用這張表** ——
 *    兩者都是把 20 個號碼切成各 10 個的分割，組合數完全相同（不是巧合，是同一個計數問題）。
 *    爆池條件（奇或偶 ≥ 7）也讀這張表。
 */
export function kl10HalfSplitCounts(): number[] {
  return _cached('halfSplitCounts', () => {
    const half = KL10_NUMBER_MAX / 2
    return Array.from({ length: KL10_BALL_COUNT + 1 }, (_, k) =>
      kl10ChooseCount(half, k) * kl10ChooseCount(half, KL10_BALL_COUNT - k)
    )
  })
}

/**
 * 依「總和條件」算命中數（母數固定 125,970）
 * 總和類注項都走這支，避免各處自己跑迴圈
 */
export function kl10SumHits(match: (sum: number) => boolean): number {
  return Object.entries(kl10SumCounts()).reduce(
    (acc, [sum, count]) => (match(Number(sum)) ? acc + Number(count) : acc),
    0
  )
}

/**
 * 依「其中一半的個數條件」算命中數（母數固定 125,970）
 * 上下盤／奇偶盤／爆池都走這支
 */
export function kl10HalfSplitHits(match: (count: number) => boolean): number {
  return kl10HalfSplitCounts().reduce(
    (acc, count, k) => (match(k) ? acc + Number(count) : acc),
    0
  )
}
