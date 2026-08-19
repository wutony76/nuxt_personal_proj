/**
 * 11選5 官方盤（X5-OF）判定與賠率核心
 *
 * ── 玩法（對照 bglottery 的 config_11x5.js，8 個 playTab）────
 *   三碼   前三/中三/後三 直選（母數 990）、組選（命中 6/990）、組選膽拖
 *   二碼   前二/後二 直選（母數 110）、組選（命中 2/110）、組選膽拖
 *   不定位 前三/中三/後三 一碼不定位（命中 3/11）
 *   定位膽 第一~五球 × 號碼（命中 1/11）
 *   任選   任選一中一 ~ 任選八中五（母數 C(11,n)）：複式／單式／膽拖
 *   趣味   猜中位（開出的 5 碼排序後的中位數）、定單雙（5 碼中的單數個數）
 *
 * ── 三種選號型態都收斂成同一組注碼 ──────────────────────
 *   複式（多選 → 展開）、單式（列出全部注碼直接選）、膽拖（膽碼 + 拖碼 → 展開）
 *   **展開後的注碼完全相同** —— 膽拖與單式只是選號方式，不是另一種玩法，
 *   所以本檔只認注碼、不認選號型態，判定與賠率三者共用同一條路。
 *
 * ── 與 sscof.ts 的關鍵差異 ──────────────────────────────
 *   1. 號碼是 01 ~ 11 **兩位數**且**不重複** —— 注碼用兩位一組串接（`後三直選010203`），
 *      解析要每兩字一切；直選複式展開必須濾掉重複號碼的組合（ssc 可重複，不需要濾）。
 *   2. 母數不是 10^n：三碼直選 11×10×9 = 990、二碼直選 11×10 = 110、
 *      集合型（組選／任選／趣味）用 C(11,5) = 462。
 *   3. 多了「任選 N 中 M」與「膽拖」兩種來源玩法（sscof 沒有）。
 *
 * ⚠️ 本檔不可 import x5of/helpers.ts（helpers 會 import 本檔，會形成循環）。
 */
import {
  x5NumberLabel,
  x5NumbersOf,
  X5_BALL_COUNT,
  X5_BALL_NAMES,
  X5_NUMBERS,
  X5_NUMBER_MAX,
  X5_NUMBER_MIN,
  X5_TOTAL_COMBOS,
  type X5Chance
} from '#shared/config/x5'

/** 取不到分頁 rtp 時的預設回報率（官方盤抽得比信用盤兇一點，同 sscof） */
export const X5OF_RTP_FALLBACK = 0.96

/**
 * 複式／膽拖展開的注數上限
 * 三碼直選每位全選就是 990 注、任選五中五全選是 462 注，都在上限內；
 * 但「前三直選每位選 8 個號碼」會展開到 336 注、加大就會爆，故一律設上限，
 * 超過整筆拒絕讓玩家自己縮小範圍（同 SSC_OF_MAX_COMBO）。
 */
export const X5_OF_MAX_COMBO = 2000

/** 判定結果：官方盤沒有和局，tie 只保留給無法辨識的注碼 */
export type X5OfBetResult = { status: 'win' | 'lose' | 'tie'; odds: number; payout: number }

/** 各玩法看的球位（0 起算） */
export const X5_OF_SECTIONS = {
  前三: [0, 1, 2],
  中三: [1, 2, 3],
  後三: [2, 3, 4],
  前二: [0, 1],
  後二: [3, 4]
} as const
export type X5OfSection = keyof typeof X5_OF_SECTIONS

/** 任選的 N（選幾碼）→ 玩法名稱；N > 5 時中的還是 5 碼（來源就是這樣命名） */
export const X5_OF_ANY_SIZES = [1, 2, 3, 4, 5, 6, 7, 8] as const
export function x5OfAnyName(size: number): string {
  const cn = ['一', '二', '三', '四', '五', '六', '七', '八']
  const n = Number(size)
  const pick = cn[n - 1] ?? String(n)
  const hit = cn[Math.min(n, X5_BALL_COUNT) - 1] ?? String(Math.min(n, X5_BALL_COUNT))
  return `任選${pick}中${hit}`
}

/** 定單雙的六種結果（index = 5 碼中的單數個數） */
export const X5_OF_ODD_EVEN_LABELS = ['五雙零單', '四雙一單', '三雙二單', '三單二雙', '四單一雙', '五單零雙'] as const
export type X5OfOddEvenLabel = (typeof X5_OF_ODD_EVEN_LABELS)[number]

/**
 * 猜中位可選的號碼
 * 出處：`config_11x5.js` 的 `no: '03|04|05|06|07|08|09'` ——
 * 5 碼排序後的中位數不可能是 01/02（前面湊不出兩個更小的）或 10/11（後面湊不出兩個更大的）。
 */
export const X5_OF_MEDIAN_NUMBERS = [3, 4, 5, 6, 7, 8, 9]

type X5OfBet =
  /** 位置直選：前三直選010203 / 後二直選0102 */
  | { kind: 'direct'; section: X5OfSection; picks: number[] }
  /** 組選（不計順序，注碼遞增）：前三組選010203 */
  | { kind: 'group'; section: X5OfSection; picks: number[] }
  /** 任選 N 中 M（不計順序，注碼遞增）：任選三中三010203 */
  | { kind: 'anyPick'; size: number; picks: number[] }
  /** 一碼不定位：前三不定位07（該號出現在該區段任一位置） */
  | { kind: 'noPos'; section: X5OfSection; num: number }
  /** 定位膽：第一球07（與信用盤同一套注碼寫法） */
  | { kind: 'ballNumber'; ball: number; num: number }
  /** 猜中位：猜中位05 */
  | { kind: 'median'; num: number }
  /** 定單雙：定單雙三單二雙 */
  | { kind: 'oddEven'; label: X5OfOddEvenLabel }

/** 注碼前綴 → 區段（直選／組選／不定位各一份，前綴字串同時是看板與 config 的 combo.prefix） */
const DIRECT_PREFIX: Record<string, X5OfSection> = {
  前三直選: '前三',
  中三直選: '中三',
  後三直選: '後三',
  前二直選: '前二',
  後二直選: '後二'
}
const GROUP_PREFIX: Record<string, X5OfSection> = {
  前三組選: '前三',
  中三組選: '中三',
  後三組選: '後三',
  前二組選: '前二',
  後二組選: '後二'
}
const NO_POS_PREFIX: Record<string, X5OfSection> = {
  前三不定位: '前三',
  中三不定位: '中三',
  後三不定位: '後三'
}

/**
 * 把「兩位一組」的號碼串轉成陣列
 * ⚠️ 與 sscog 的 `_digitsOf` 最大的不同：11選5 的號碼是兩位數，
 *    一個字元一個號碼會把 `10` 讀成 1 和 0。
 * @returns 號碼陣列；長度不符、含非數字或超出 1 ~ 11 回 null
 */
function _picksOf(text: string, expect: number): number[] | null {
  if (text.length !== expect * 2 || !/^\d+$/.test(text)) return null
  const picks: number[] = []
  for (let i = 0; i < text.length; i += 2) picks.push(Number(text.slice(i, i + 2)))
  if (picks.some((num) => !Number.isInteger(num) || num < X5_NUMBER_MIN || num > X5_NUMBER_MAX)) return null
  return picks
}

/** 號碼陣列 → 注碼用的字串（一律補零兩位） */
export function x5OfCodeOf(picks: number[]): string {
  return picks.map((num) => x5NumberLabel(Number(num))).join('')
}

/** 遞增且互異（組選／任選的注碼規則：同一注只有一種寫法） */
function _isAscending(picks: number[]): boolean {
  return picks.every((num, idx) => idx === 0 || Number(picks[idx - 1]) < num)
}

/** 互異（直選：順序有意義，但號碼不可重複 —— 開獎 5 碼不重複） */
function _isDistinct(picks: number[]): boolean {
  return new Set(picks).size === picks.length
}

function _parseBet(betCode: string | number): X5OfBet | null {
  const code = String(betCode ?? '').trim()
  if (!code) return null

  // ── 一碼不定位：前三不定位07（要在「前三組選」之前判，前綴才不會互相吃）──
  for (const [prefix, section] of Object.entries(NO_POS_PREFIX)) {
    if (!code.startsWith(prefix)) continue
    const picks = _picksOf(code.slice(prefix.length), 1)
    return picks ? { kind: 'noPos', section, num: Number(picks[0]) } : null
  }

  // ── 位置直選：前三直選010203 ──
  for (const [prefix, section] of Object.entries(DIRECT_PREFIX)) {
    if (!code.startsWith(prefix)) continue
    const picks = _picksOf(code.slice(prefix.length), X5_OF_SECTIONS[section].length)
    if (!picks || !_isDistinct(picks)) return null
    return { kind: 'direct', section, picks }
  }

  // ── 組選：前三組選010203（遞增） ──
  for (const [prefix, section] of Object.entries(GROUP_PREFIX)) {
    if (!code.startsWith(prefix)) continue
    const picks = _picksOf(code.slice(prefix.length), X5_OF_SECTIONS[section].length)
    if (!picks || !_isAscending(picks)) return null
    return { kind: 'group', section, picks }
  }

  // ── 任選 N 中 M：任選三中三010203（遞增） ──
  for (const size of X5_OF_ANY_SIZES) {
    const prefix = x5OfAnyName(size)
    if (!code.startsWith(prefix)) continue
    const picks = _picksOf(code.slice(prefix.length), size)
    if (!picks || !_isAscending(picks)) return null
    return { kind: 'anyPick', size, picks }
  }

  // ── 猜中位：猜中位05 ──
  if (code.startsWith('猜中位')) {
    const picks = _picksOf(code.slice(3), 1)
    const num = Number(picks?.[0])
    return picks && X5_OF_MEDIAN_NUMBERS.includes(num) ? { kind: 'median', num } : null
  }

  // ── 定單雙：定單雙三單二雙 ──
  if (code.startsWith('定單雙')) {
    const label = X5_OF_ODD_EVEN_LABELS.find((item) => item === code.slice(3))
    return label ? { kind: 'oddEven', label } : null
  }

  // ── 定位膽：第一球07（與信用盤同一套注碼寫法）──
  for (const name of X5_BALL_NAMES) {
    if (!code.startsWith(name)) continue
    const picks = _picksOf(code.slice(name.length), 1)
    if (!picks) return null
    return { kind: 'ballNumber', ball: X5_BALL_NAMES.indexOf(name), num: Number(picks[0]) }
  }

  return null
}

// ── 機率（賠率推導的唯一來源）──────────────────────────────────────────────

/** 排列數 P(11, k)：直選類的母數（11×10×9…） */
function _perm(k: number): number {
  let out = 1
  for (let i = 0; i < k; i++) out *= X5_NUMBER_MAX - i
  return out
}

/** 組合數 C(n, k) */
export function x5OfCombinations(n: number, k: number): number {
  if (k < 0 || k > n) return 0
  let out = 1
  for (let i = 0; i < k; i++) out = (out * (n - i)) / (i + 1)
  return Math.round(out)
}

/** k! */
function _factorial(k: number): number {
  let out = 1
  for (let i = 2; i <= k; i++) out *= i
  return out
}

/** 猜中位各號碼的組合數（母數 462）；index = 中位數 */
export function x5OfMedianCounts(): Record<number, number> {
  const table: Record<number, number> = {}
  X5_OF_MEDIAN_NUMBERS.forEach((mid) => {
    // 中位數為 mid ⇔ 比它小的取 2 個、比它大的取 2 個
    table[mid] = x5OfCombinations(mid - X5_NUMBER_MIN, 2) * x5OfCombinations(X5_NUMBER_MAX - mid, 2)
  })
  return table
}

/** 定單雙各結果的組合數（母數 462）；index = 5 碼中的單數個數 */
export function x5OfOddEvenCounts(): number[] {
  const odds = X5_NUMBERS.filter((num) => num % 2 === 1).length // 6 個
  const evens = X5_NUMBERS.length - odds // 5 個
  return Array.from({ length: X5_BALL_COUNT + 1 }, (_, oddCount) =>
    x5OfCombinations(odds, oddCount) * x5OfCombinations(evens, X5_BALL_COUNT - oddCount)
  )
}

/**
 * 注碼的樣本空間
 * @returns { hit, total }；注碼無法辨識回 null
 */
export function x5OfChanceOf(betCode: string | number): X5Chance | null {
  const bet = _parseBet(betCode)
  if (!bet) return null
  switch (bet.kind) {
    // 直選：該區段的有序不重複排列，母數 P(11, k)
    case 'direct':
      return { hit: 1, total: _perm(bet.picks.length) }
    // 組選：同一組號碼的 k! 種排列都算中
    case 'group': {
      const size = bet.picks.length
      return { hit: _factorial(size), total: _perm(size) }
    }
    /*
     * 任選 N 中 M：母數 C(11,N)
     *   N ≤ 5 → 選的 N 碼要全在開出的 5 碼內 → 命中 C(5,N)
     *   N > 5 → 開出的 5 碼要全在選的 N 碼內 → 命中 C(6, N−5)
     */
    case 'anyPick': {
      const n = bet.size
      const hit = n <= X5_BALL_COUNT
        ? x5OfCombinations(X5_BALL_COUNT, n)
        : x5OfCombinations(X5_NUMBER_MAX - X5_BALL_COUNT, n - X5_BALL_COUNT)
      return { hit, total: x5OfCombinations(X5_NUMBER_MAX, n) }
    }
    // 一碼不定位：該號出現在該區段 k 個位置中的任一個
    case 'noPos':
      return { hit: X5_OF_SECTIONS[bet.section].length, total: X5_NUMBER_MAX }
    case 'ballNumber':
      return { hit: 1, total: X5_NUMBER_MAX }
    case 'median':
      return { hit: Number(x5OfMedianCounts()[bet.num] ?? 0), total: X5_TOTAL_COMBOS }
    case 'oddEven': {
      const oddCount = X5_OF_ODD_EVEN_LABELS.indexOf(bet.label)
      return { hit: Number(x5OfOddEvenCounts()[oddCount] ?? 0), total: X5_TOTAL_COMBOS }
    }
  }
}

/**
 * 注碼是否命中
 * @returns true 命中／false 未命中／null 注碼或開獎格式不合
 */
export function x5OfIsHit(betCode: string | number, openCode: Array<string | number>): boolean | null {
  const nums = x5NumbersOf(openCode)
  if (!nums) return null
  const bet = _parseBet(betCode)
  if (!bet) return null

  switch (bet.kind) {
    case 'direct': {
      const section = X5_OF_SECTIONS[bet.section].map((idx) => Number(nums[idx]))
      return bet.picks.every((num, idx) => num === section[idx])
    }
    case 'group': {
      const section = X5_OF_SECTIONS[bet.section].map((idx) => Number(nums[idx])).sort((a, b) => a - b)
      return bet.picks.every((num, idx) => num === section[idx])
    }
    case 'anyPick':
      return bet.size <= X5_BALL_COUNT
        // 選的號碼要全部開出
        ? bet.picks.every((num) => nums.includes(num))
        // 開出的號碼要全部在選的範圍內
        : nums.every((num) => bet.picks.includes(num))
    case 'noPos':
      return X5_OF_SECTIONS[bet.section].some((idx) => Number(nums[idx]) === bet.num)
    case 'ballNumber':
      return Number(nums[bet.ball]) === bet.num
    case 'median': {
      const sorted = [...nums].sort((a, b) => a - b)
      return Number(sorted[Math.floor(X5_BALL_COUNT / 2)]) === bet.num
    }
    case 'oddEven':
      return X5_OF_ODD_EVEN_LABELS[nums.filter((num) => num % 2 === 1).length] === bet.label
  }
}

/** 注碼種類（供前端分群顯示與統計）；無法辨識回 null */
export function x5OfKindOf(betCode: string | number): X5OfBet['kind'] | null {
  return _parseBet(betCode)?.kind ?? null
}

/**
 * 取注碼賠率（含本金）
 * @returns 賠率（無條件捨去到小數 2 位）；無法辨識回 0
 */
export function x5OfOddsOf(betCode: string | number, rtp: number = X5OF_RTP_FALLBACK): number {
  const chance = x5OfChanceOf(betCode)
  if (!chance || !(chance.hit > 0) || !(chance.total > 0)) return 0
  const safeRtp = Number.isFinite(rtp) && rtp > 0 ? rtp : X5OF_RTP_FALLBACK
  return Math.floor((chance.total / chance.hit) * safeRtp * 100) / 100
}

/**
 * 官方盤中獎判定（固定賠率的分頁用；彩池分頁走下方的分層）
 * @param odds 下注時鎖定的賠率；未帶則以 rtp 即時推算
 */
export function judgeX5OfBet(
  betCode: string | number,
  openCode: Array<string | number>,
  coin: number,
  odds: number = 0,
  rtp: number = X5OF_RTP_FALLBACK
): X5OfBetResult | null {
  const hit = x5OfIsHit(betCode, openCode)
  if (hit === null) return null
  const lockedOdds = Number(odds) > 0 ? Number(odds) : x5OfOddsOf(betCode, rtp)
  if (!(lockedOdds > 0)) return null
  const amount = Number(coin)
  const safeCoin = Number.isFinite(amount) && amount > 0 ? amount : 0
  return {
    status: hit ? 'win' : 'lose',
    odds: lockedOdds,
    payout: hit ? Number((safeCoin * lockedOdds).toFixed(2)) : 0
  }
}

// ── 複式／膽拖／單式的展開（三者最後都吐同一種注碼）────────────────────────

/**
 * 位置直選的笛卡爾積
 * ⚠️ 與 ssc 最大的不同：**要濾掉含重複號碼的組合** ——
 *    開獎 5 碼互不重複，`前三直選010101` 是永遠不可能中的一注，不該讓它成立。
 *    來源 algorithm.js:210-220 的注數計算也是這樣濾的（三重迴圈逐一比對不等）。
 */
export function x5OfDirectCombos(sets: Array<Array<number | string>>): number[][] {
  const lists = sets.map((list) => Array.from(new Set((Array.isArray(list) ? list : []).map(Number))))
  if (lists.length === 0 || lists.some((list) => list.length === 0)) return []
  let out: number[][] = [[]]
  for (const list of lists) {
    const next: number[][] = []
    for (const prefix of out) {
      for (const num of list) {
        // 同一注不可出現重複號碼
        if (prefix.includes(num)) continue
        next.push([...prefix, num])
      }
    }
    out = next
    if (out.length === 0) return []
  }
  return out
}

/**
 * 組合展開：從一組號碼取 size 個（遞增排序，不計順序）
 * 組選複式、任選複式、以及膽拖展開後的拖碼組合都走這支。
 */
export function x5OfPickCombos(pool: Array<number | string>, size: number): number[][] {
  const list = Array.from(new Set((Array.isArray(pool) ? pool : []).map(Number)))
    .filter((num) => Number.isInteger(num) && num >= X5_NUMBER_MIN && num <= X5_NUMBER_MAX)
    .sort((a, b) => a - b)
  const k = Number(size)
  if (!Number.isInteger(k) || k <= 0 || list.length < k) return []
  const out: number[][] = []
  const acc: number[] = []
  const walk = (start: number): void => {
    if (acc.length === k) {
      out.push([...acc])
      return
    }
    for (let i = start; i < list.length; i++) {
      acc.push(Number(list[i]))
      walk(i + 1)
      acc.pop()
    }
  }
  walk(0)
  return out
}

/**
 * 膽拖展開：膽碼固定進每一注，再從拖碼裡補到 size 碼
 *
 * 出處 algorithm.js:251-267：`nums = C(拖碼數, size − 膽碼數)`，
 * 且 `膽碼數 < size`（膽碼填滿就沒有拖的意義了）、膽碼與拖碼不可同號
 * （來源 select_num_tool.js:69-90 的選號互斥也是同一個規則）。
 *
 * @returns 遞增排序的號碼組合；規則不合回空陣列
 */
export function x5OfDantuoCombos(
  dan: Array<number | string>,
  tuo: Array<number | string>,
  size: number
): number[][] {
  const _clean = (list: Array<number | string>) =>
    Array.from(new Set((Array.isArray(list) ? list : []).map(Number)))
      .filter((num) => Number.isInteger(num) && num >= X5_NUMBER_MIN && num <= X5_NUMBER_MAX)
  const danList = _clean(dan)
  const tuoList = _clean(tuo).filter((num) => !danList.includes(num))
  const k = Number(size)
  if (!Number.isInteger(k) || k <= 0) return []
  // 膽碼必須至少 1 個且少於目標碼數；拖碼要夠補滿
  if (danList.length < 1 || danList.length >= k) return []
  const need = k - danList.length
  if (tuoList.length < need) return []
  return x5OfPickCombos(tuoList, need)
    .map((rest) => [...danList, ...rest].sort((a, b) => a - b))
}

// ── 彩池分層（只有「後三直選」吃共用彩池）──────────────────────────────────

/**
 * 後三直選要猜幾個位置
 * ⚠️ 與 ssc-of 的 SSC_OF_PICK_COUNT 同一個概念，但這裡的母數是 990（不重複排列）而非 1000。
 */
export const X5_OF_PICK_COUNT = 3

/** 彩池分頁的注碼前綴（與 DIRECT_PREFIX、x5of/plays.js 的 combo.prefix 同一個字串） */
export const X5_OF_POOL_PREFIX = '後三直選'
/** 走彩池分層的玩法 key（伺端據此把注單分流到兩條結算路） */
export const X5_OF_POOL_PLAY_KEY = 'sanma'
/** 走彩池分層的分頁 id：後三直選的複式與單式兩個分頁（注碼形狀相同，只是選號方式不同） */
export const X5_OF_POOL_TAB_IDS = [111101410, 111101411]

/**
 * 獎金分層（後三直選專用）
 *   pool  —— 從該期可發放獎池按 ratio 切一塊，再依中獎者的下注額比例分配
 *            minAmount 為「每單位下注」的最低保障（僅頭獎設，避免下全注套利）
 *   fixed —— 固定倍數，直接按下注倍數發放
 * ⚠️ 未產生中獎者的 pool 層，該層獎金整塊滾存至下期（與 6hc-of / k3-of / pk10-of / ssc-of 相同）
 *
 * ── 為什麼比例可以直接沿用 ssc-of ────────────────────────
 *   11選5 後三直選的命中分布（由 x5OfMatchCounts() 窮舉 990 種結果）：
 *     命中 3：  1 種（0.1010%）
 *     命中 2： 24 種（2.4242%）
 *     命中 1：219 種（22.1212%）
 *     命中 0：746 種（75.3535%）
 *   與 ssc-of 後三直選（0.1000 / 2.7000 / 24.3000 / 72.9000）幾乎相同，
 *   所以三層比例 70 / 20 / 固定 2 倍原樣沿用，不必重新設計。
 */
export type X5OfPrizeTier =
  | { match: number; type: 'pool'; ratio: number; minAmount?: number; name: string }
  | { match: number; type: 'fixed'; amount: number; name: string }

export const X5_OF_PRIZE_TIERS: X5OfPrizeTier[] = [
  { match: 3, type: 'pool', ratio: 0.70, minAmount: 20000, name: '頭獎' },
  { match: 2, type: 'pool', ratio: 0.20, name: '二獎' },
  { match: 1, type: 'fixed', amount: 2, name: '三獎' }
]

/**
 * pool 型分層的 ratio 總和（未派出時的滾存計算會用到）
 * ⚠️ 要收斂小數：0.70 + 0.20 的浮點結果是 0.8999999999999999
 */
export const X5_OF_POOL_RATIO_TOTAL = Number(
  X5_OF_PRIZE_TIERS
    .filter((tier): tier is Extract<X5OfPrizeTier, { type: 'pool' }> => tier.type === 'pool')
    .reduce((sum, tier) => sum + tier.ratio, 0)
    .toFixed(4)
)

/**
 * 把後三直選的注碼正規化成 3 個號碼
 * ⚠️ 不排序 —— 順序就是位置，排序會把「猜錯位置」變成「猜對」。
 * ⚠️ 但**要**檢查重複：11選5 開 5 個不重複號碼，`後三直選010101` 不是合法的一注。
 */
export function x5OfPicksOf(betCode: string | number | Array<string | number>): number[] | null {
  const picks = Array.isArray(betCode)
    ? betCode.map((code) => Number(code))
    : (() => {
        const code = String(betCode ?? '').trim()
        if (!code.startsWith(X5_OF_POOL_PREFIX)) return null
        return _picksOf(code.slice(X5_OF_POOL_PREFIX.length), X5_OF_PICK_COUNT)
      })()
  if (!picks || picks.length !== X5_OF_PICK_COUNT) return null
  if (picks.some((num) => !Number.isInteger(num) || num < X5_NUMBER_MIN || num > X5_NUMBER_MAX)) return null
  if (!_isDistinct(picks)) return null
  return picks
}

/**
 * 後三直選的命中數（逐位比對第三～五球）
 * @returns 0 ~ 3；注碼或開獎格式不合回 null
 */
export function x5OfMatchCount(
  betCode: string | number | Array<string | number>,
  openCode: Array<string | number>
): number | null {
  const picks = x5OfPicksOf(betCode)
  const nums = x5NumbersOf(openCode)
  if (!picks || !nums) return null
  const tail = X5_OF_SECTIONS['後三'].map((idx) => Number(nums[idx]))
  return picks.filter((num, idx) => num === tail[idx]).length
}

/** 命中數 → 所屬分層；不中回 null */
export function x5OfTierOf(matchCount: number): X5OfPrizeTier | null {
  const count = Number(matchCount)
  if (!Number.isInteger(count) || count <= 0) return null
  return X5_OF_PRIZE_TIERS.find((tier) => tier.match === count) ?? null
}

/**
 * 窮舉後三的 990 種結果（3 個位置的不重複排列），統計固定一注的命中數分布
 * （機率對帳與測試用；上面註解裡的 1 / 24 / 219 / 746 就是這支算出來的）
 * @returns index 0 ~ 3 對應命中 0 ~ 3 的結果數
 */
export function x5OfMatchCounts(picks: number[] = [1, 2, 3]): number[] {
  const table = [0, 0, 0, 0]
  for (const a of X5_NUMBERS) {
    for (const b of X5_NUMBERS) {
      if (b === a) continue
      for (const c of X5_NUMBERS) {
        if (c === a || c === b) continue
        const tail = [a, b, c]
        const matched = picks.filter((num, idx) => num === tail[idx]).length
        table[matched] = Number(table[matched] ?? 0) + 1
      }
    }
  }
  return table
}

/**
 * 官方盤玩法定義（順序即前端玩法列的顯示順序，需與 x5of/plays.js 一致）
 * `pool: true` 代表該玩法底下**有**走彩池分層的分頁（sanma 底下只有後三直選那兩頁吃池）
 */
export const X5_OF_PLAY_DEFINITIONS: Array<{ key: string; name: string; pool: boolean }> = [
  { key: 'sanma', name: '三碼', pool: true },
  { key: 'erma', name: '二碼', pool: false },
  { key: 'budingwei', name: '不定位', pool: false },
  { key: 'dingwei', name: '定位膽', pool: false },
  { key: 'renxuanfu', name: '任選複式', pool: false },
  { key: 'renxuandan', name: '任選單式', pool: false },
  { key: 'renxuandt', name: '任選膽拖', pool: false },
  { key: 'quwei', name: '趣味玩法', pool: false }
]
