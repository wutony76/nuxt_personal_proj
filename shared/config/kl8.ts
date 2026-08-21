/**
 * 快樂8（KL8）的基本運算與號碼判定（遊戲層）
 *
 * 開獎為 20 個號碼、從 1 ~ 80 中不重複抽出（無位置概念，跟 kl10 的「第 N 球」不同），
 * 母數比 kl10 大了 13 個數量級，用錯型別會直接讓數字失真：
 *
 *   | 判定對象             | 母數                                    | 用在                       |
 *   |----------------------|------------------------------------------|----------------------------|
 *   | 任選的命中／樣本空間 | C(20,N) / C(80,N)（N ≤ 7，仍在安全整數內）| 任選各分頁                 |
 *   | 兩區個數對比         | C(40,k) × C(40,20-k)（單一 k 值即可能超標）| 上下盤、奇偶盤、爆池        |
 *   | 20 碼的**集合**性質   | C(80,20) = 3,535,316,142,212,174,320     | 和值、五行                  |
 *
 * ⚠️ **`C(80,20)` ≈ 3.535×10¹⁸，遠超過 `Number.MAX_SAFE_INTEGER`（9,007,199,254,740,991 ≈ 9×10¹⁵）**。
 *    更麻煩的是：連「單一總和值」或「單一上下盤個數分割」的組合數本身都可能超標
 *    （例如總和恰為 810 的組合數就有 15,542,763,534,960,598 ≈ 1.55×10¹⁶，已經超過安全整數），
 *    不是只有「全部加總」才會爆——因此本檔的機率建表**全程使用 `BigInt`**，
 *    只有在算「機率」（0~1 的小數，用於推賠率）這一步才轉成 `Number`
 *    （此時只需要 ~15 位有效數字的精度，`BigInt → Number` 轉換帶來的誤差可忽略）。
 * ⚠️ 總和分佈**不能用遞迴窮舉組合本身**建表（kl10 是 125,970 條路徑可以窮舉，
 *    kl8 是 C(80,20) ≈ 3.5×10¹⁸ 條，不可能真的窮舉）。`kl8SumCounts()` 改用動態規劃
 *    （子集和卷積）：`dp[j][s]` = 從 1~80 選 `j` 個號碼、總和為 `s` 的方法數，
 *    逐號碼 `n=1..80` 累加更新（標準 0/1 knapsack 計數 DP），`j` 上限 20、`s` 範圍 210~1410，
 *    只保留 `dp[20]` 這張表（21×1201 個 BigInt），不展開任何組合本身。
 *
 * ── 與 eggs / kl10 的分工一致 ────────────────────────────
 *   本檔                        號碼運算 + 機率建表
 *   shared/config/kl8-cd.ts     信用盤：注碼判定 + 賠率推導 + 爆池 + 選號彩池玩法
 *   shared/config/kl8cd/        看板設定（注項、限額、爆池權重），由 helpers 讀取
 *
 * ⚠️ 快樂8**只有信用盤**（來源 bglottery `kl8/` 沒有 official 子目錄），
 *    因此沒有 kl8-of.ts、也沒有 kl8Shared.ts。
 * ⚠️ 本檔不可 import 任何 helpers（helpers 會 import 本檔，會形成循環）。
 *
 * ── 來源與規則依據 ───────────────────────────────────────
 *   球號範圍 1~80、一期 20 球：bglottery `kl8/header.vue:94-109`（開獎動畫
 *                             `for (i=0;i<20;i++){random(0,80)}`）與同檔 `:111-119`
 *                             （初始佔位為 20 個 '?'）；`renxuan/play_script.js:37`
 *                             （`for (i=1;i<=80;i++)` 展開號碼池）
 *   玩法分類／playId：`kl8/allTraditional/{renxuan,liangmian}/config*.js`
 *   ⚠️ `kl8/dict.js`（0~27 四色波表）在 kl8 底下**零 import**，且兩個 config 都沒有色波 playId
 *      —— 是從 pceggs 複製後未清除的殘留檔，本彩種**沒有色波玩法**（見 add-kl8/design.md）
 *   判定門檻：來源前端只有 playId（判定式在伺端），以下門檻常數由使用者於提案階段拍板，
 *            各自只寫一處（見 add-kl8/design.md 的機率窮舉表）
 */

/** 一期開幾個號碼 */
export const KL8_BALL_COUNT = 20
/** 號碼範圍（1 ~ 80） */
export const KL8_NUMBER_MIN = 1
export const KL8_NUMBER_MAX = 80
/** 全部可下注號碼（1 ~ 80） */
export const KL8_NUMBERS: number[] = Array.from(
  { length: KL8_NUMBER_MAX - KL8_NUMBER_MIN + 1 },
  (_, i) => KL8_NUMBER_MIN + i
)

/** 20 碼**組合**的總數 C(80,20)；集合性質（和值／五行）的母數。硬編碼常數，不可用一般迴圈算（會失真）。 */
export const KL8_TOTAL_COMBOS = BigInt('3535316142212174320')

/** 總和範圍（1+…+20 ~ 61+…+80） */
export const KL8_SUM_MIN = 210
export const KL8_SUM_MAX = 1410

/**
 * 總和大小分界：總和 ≥ 810 為大（無和局，810 併入大）
 * ⚠️ **使用者於提案階段拍板**（來源判定式在伺端，前端查無實據）。
 *    810 恰為理論平均值（20/80 × (1+80)×80/2 = 810），比照 kl10 的「無和局」慣例，
 *    不採外部 Keno 規則站「總和恰為 810 退款」的做法（bglottery 的 `liangmian` config
 *    8 項本身沒有對應的退款注項）。
 */
export const KL8_SUM_BIG_LINE = 810

/**
 * 上下盤的號碼半分線：號碼 ≤ 40 算「上」（小號區），≥ 41 算「下」（大號區）
 * ⚠️ **使用者於提案階段拍板**（來源判定式在伺端）。1~80 對半切，各 40 個，
 *    比照 kl10 的 `KL10_HALF_LINE` 做法（同一套「比個數多寡、相等為和盤」模型）。
 */
export const KL8_HALF_LINE = 40

/**
 * 五行邊界：總和依機率窮舉出的等機率五等分（金≤734／木735~787／水788~833／火834~886／土≥887）
 * ⚠️ **使用者於提案階段拍板**：外部 Keno 規則站給的區間（210~695 等）機率明顯不均
 *    （兩端尾段機率極小、中間段機率大），與本專案「賠率一律窮舉推導」慣例不合，
 *    改用 DP 窮舉驗證過的等機率邊界（各組機率 19.87%~20.23%，見 add-kl8/design.md）。
 *    陣列為 4 個切點，共切出 5 段：[-∞,734] [735,787] [788,833] [834,886] [887,+∞]
 */
export const KL8_WUXING_BOUNDS = [734, 787, 833, 886] as const
export const KL8_WUXING_NAMES = ['金', '木', '水', '火', '土'] as const
export type Kl8Wuxing = (typeof KL8_WUXING_NAMES)[number]

/**
 * 爆池門檻：奇數（或偶數）個數其中一側達到此值以上就算「一邊倒」
 * ⚠️ **使用者於提案階段拍板**：15（即另一側 ≤5）→
 *    66,366,308,138,029,536 / 3,535,316,142,212,174,320 ≈ 1.8772%，
 *    與 kl10 奇偶≥7/8（1.9767%）、6hc 特別號開49（2.04%）同量級。
 */
export const KL8_JACKPOT_LOPSIDED_MIN = 15

/** 注項的樣本空間：命中數 / 母數（賠率由此推導）。全程 BigInt，只在算機率時才轉 Number。 */
export type Kl8Chance = { hit: bigint; total: bigint }

/** 上下盤／奇偶盤的三種結果（兩組都有「和盤」，注碼另以 上下和／奇偶和 區分，見 kl8-cd.ts） */
export type Kl8Zone = '上盤' | '和盤' | '下盤'
export type Kl8ParityZone = '奇盤' | '和盤' | '偶盤'

/** 號碼顯示格式（一律補零兩位：01 ~ 80） */
export function kl8NumberLabel(num: number): string {
  return String(num).padStart(2, '0')
}

/**
 * 把開獎號正規化成 20 個號碼；格式不合回 null
 * ⚠️ 必須檢查唯一性（快樂8是不重複抽樣）
 */
export function kl8NumbersOf(openCode: Array<string | number>): number[] | null {
  const raw = Array.isArray(openCode) ? openCode : []
  if (raw.length !== KL8_BALL_COUNT) return null
  const nums = raw.map((code) => Number(code))
  if (nums.some((n) => !Number.isInteger(n) || n < KL8_NUMBER_MIN || n > KL8_NUMBER_MAX)) return null
  if (new Set(nums).size !== nums.length) return null
  return nums
}

/** 總和（20 個號碼相加，210 ~ 1410） */
export function kl8SumOf(nums: number[]): number {
  return nums.reduce((acc, cur) => acc + Number(cur), 0)
}

/** 落在上盤區（號碼 ≤ KL8_HALF_LINE）的個數 */
export function kl8LowCountOf(nums: number[]): number {
  return nums.reduce((acc, num) => (Number(num) <= KL8_HALF_LINE ? acc + 1 : acc), 0)
}

/** 奇數號碼的個數 */
export function kl8OddCountOf(nums: number[]): number {
  return nums.reduce((acc, num) => (Number(num) % 2 === 1 ? acc + 1 : acc), 0)
}

/** 上下盤：小號區個數 vs 大號區個數（10:10 為和盤） */
export function kl8ZoneOf(nums: number[]): Kl8Zone {
  const low = kl8LowCountOf(nums)
  const high = nums.length - low
  if (low > high) return '上盤'
  if (low < high) return '下盤'
  return '和盤'
}

/** 奇偶盤：奇數個數 vs 偶數個數（10:10 為和盤） */
export function kl8ParityZoneOf(nums: number[]): Kl8ParityZone {
  const odd = kl8OddCountOf(nums)
  const even = nums.length - odd
  if (odd > even) return '奇盤'
  if (odd < even) return '偶盤'
  return '和盤'
}

/** 這一期是不是「奇偶一邊倒」（爆池條件的號碼特徵，判定包裝在 kl8-cd.ts） */
export function kl8IsLopsidedParity(nums: number[]): boolean {
  const odd = kl8OddCountOf(nums)
  const even = nums.length - odd
  return odd >= KL8_JACKPOT_LOPSIDED_MIN || even >= KL8_JACKPOT_LOPSIDED_MIN
}

/** 五行：依總和查 KL8_WUXING_BOUNDS 落在哪一段 */
export function kl8WuxingOf(sum: number): Kl8Wuxing {
  const [b0, b1, b2, b3] = KL8_WUXING_BOUNDS
  if (sum <= b0) return '金'
  if (sum <= b1) return '木'
  if (sum <= b2) return '水'
  if (sum <= b3) return '火'
  return '土'
}

// ── 機率建表（全程 BigInt） ──────────────────────────────────────────────

/** 算過就存起來：建表只做一次 */
const _memo = new Map<string, unknown>()
function _cached<T>(key: string, build: () => T): T {
  if (!_memo.has(key)) _memo.set(key, build())
  return _memo.get(key) as T
}

/**
 * 組合數 C(n, k)（BigInt）
 * ⚠️ 任選（pick ≤ 7）與半分表（n=40, k≤20）的結果都在安全整數範圍內，
 *    但本函式一律回傳 BigInt——呼叫端若確定安全才自行轉 Number，避免有人不小心
 *    傳進 (80,20) 這種必爆精度的組合卻用一般數字接。
 */
export function kl8ChooseCount(n: number, k: number): bigint {
  const total = Math.trunc(Number(n) || 0)
  const pick = Math.trunc(Number(k) || 0)
  if (pick < 0 || pick > total) return BigInt(0)
  let result = BigInt(1)
  for (let i = 0; i < pick; i++) {
    result = (result * BigInt(total - i)) / BigInt(i + 1)
  }
  return result
}

/**
 * 總和 210 ~ 1410 的組合數表（`dp[20]`，合計 `KL8_TOTAL_COMBOS`）
 *
 * DP（子集和卷積）：`dp[j][s]` = 從 1~80 選 j 個號碼、總和為 s 的方法數，逐號碼累加更新。
 * ⚠️ **全程 BigInt**——連單一總和值的組合數都可能超過安全整數（例如總和 810 恰為
 *    1.55×10¹⁶），用一般 number 會在建表過程中就失真，不是加總才失真。
 * ⚠️ 只保留 `dp[20]` 這一維（21×1201 個 BigInt），不展開任何組合本身；
 *    建表完成後會核對總和 === KL8_TOTAL_COMBOS，不吻合就直接拋錯（對帳，不吞錯）。
 */
export function kl8SumCounts(): Record<number, bigint> {
  return _cached('sumCounts', () => {
    const maxJ = KL8_BALL_COUNT
    const maxS = KL8_SUM_MAX
    let dp: bigint[][] = Array.from({ length: maxJ + 1 }, () => new Array(maxS + 1).fill(BigInt(0)))
    dp[0]![0] = BigInt(1)
    for (let n = 1; n <= KL8_NUMBER_MAX; n++) {
      for (let j = Math.min(maxJ, n); j >= 1; j--) {
        const prevRow = dp[j - 1]!
        const row = dp[j]!
        for (let s = maxS; s >= n; s--) {
          const prev = prevRow[s - n]!
          if (prev !== BigInt(0)) row[s] = row[s] + prev
        }
      }
    }
    const table: Record<number, bigint> = {}
    let total = BigInt(0)
    const finalRow = dp[maxJ]!
    for (let s = KL8_SUM_MIN; s <= maxS; s++) {
      const count = finalRow[s]!
      if (count === BigInt(0)) continue
      table[s] = count
      total += count
    }
    if (total !== KL8_TOTAL_COMBOS) {
      throw new Error(`kl8SumCounts 對帳失敗：DP 加總 ${total} ≠ KL8_TOTAL_COMBOS ${KL8_TOTAL_COMBOS}`)
    }
    return table
  })
}

/**
 * 「40 對 40」分割的組合數表：index k = 20 碼中恰有 k 個落在其中一半的組合數
 * 即 `C(40, k) × C(40, 20 - k)`，合計 `KL8_TOTAL_COMBOS`。
 *
 * ⚠️ 上下盤（1~40 對 41~80）與奇偶盤（40 個奇數對 40 個偶數）**共用這張表** ——
 *    兩者都是把 80 個號碼切成各 40 個的分割，組合數完全相同（不是巧合，是同一個計數問題）。
 *    爆池條件（奇或偶 ≥ 15）也讀這張表。
 */
export function kl8HalfSplitCounts(): bigint[] {
  return _cached('halfSplitCounts', () => {
    const half = KL8_NUMBER_MAX / 2
    const table = Array.from({ length: KL8_BALL_COUNT + 1 }, (_, k) =>
      kl8ChooseCount(half, k) * kl8ChooseCount(half, KL8_BALL_COUNT - k)
    )
    const total = table.reduce((acc, count) => acc + count, BigInt(0))
    if (total !== KL8_TOTAL_COMBOS) {
      throw new Error(`kl8HalfSplitCounts 對帳失敗：加總 ${total} ≠ KL8_TOTAL_COMBOS ${KL8_TOTAL_COMBOS}`)
    }
    return table
  })
}

/**
 * 依「總和條件」算命中數（母數固定 KL8_TOTAL_COMBOS）
 * 總和類注項（和值／五行）都走這支，避免各處自己跑迴圈
 */
export function kl8SumHits(match: (sum: number) => boolean): bigint {
  return Object.entries(kl8SumCounts()).reduce(
    (acc, [sum, count]) => (match(Number(sum)) ? acc + count : acc),
    BigInt(0)
  )
}

/**
 * 依「其中一半的個數條件」算命中數（母數固定 KL8_TOTAL_COMBOS）
 * 上下盤／奇偶盤／爆池都走這支
 */
export function kl8HalfSplitHits(match: (count: number) => boolean): bigint {
  return kl8HalfSplitCounts().reduce(
    (acc, count, k) => (match(k) ? acc + count : acc),
    BigInt(0)
  )
}
