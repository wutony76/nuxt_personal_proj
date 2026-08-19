/**
 * 時時彩官方盤（SSC-OF）判定與賠率核心
 *
 * ── 玩法（本輪核心組，對照 pcv2_0223 的 conf_sc_og.js）────
 *   定位膽      第一球0 ~ 第五球9（注碼與信用盤共用）      母數 10
 *   五星直選    五星直選01234（5 位全中）                 母數 100000
 *   後三直選    後三直選123（百十個位全中）               母數 1000
 *   後三組三    後三組三12（兩碼、一碼出現兩次，不計順序）  母數 1000
 *   後三組六    後三組六123（三碼互異，不計順序）          母數 1000
 *   後二直選    後二直選12（十個位全中）                  母數 100
 *   後二組選    後二組選12（兩碼互異，不計順序）           母數 100
 *   大小單雙    大小單雙後二大小（每位一個面）             母數 10^n
 *
 * ── 複式 ────────────────────────────────────────────────
 *   位置型（五星／後三直選／後二直選／大小單雙）→ 各位置選一組，笛卡爾積展開
 *   組選型（組三／組六／後二組選）→ 從一組號碼取 k 個，組合展開
 *   ⚠️ 五星直選全選會展開成 100,000 注 —— 一定要有上限保護，見 SSC_OF_MAX_COMBO。
 *
 * ⚠️ 本檔不可 import sscof/helpers.ts（helpers 會 import 本檔，會形成循環）。
 */
import {
  sscDigitsOf,
  SSC_BALL_COUNT,
  SSC_BALL_NAMES,
  SSC_DIGIT_MAX,
  SSC_TOTAL_OUTCOMES,
  type SscChance
} from '#shared/config/ssc'

/** 取不到分頁 rtp 時的預設回報率（官方盤抽得比信用盤兇一點） */
export const SSCOF_RTP_FALLBACK = 0.96

/**
 * 複式展開的注數上限
 *
 * 五星直選 5 個位置各全選就是 10⁵ = 100,000 注，前端畫不動、伺端也不該收 ——
 * 超過這個數就整筆拒絕，讓玩家自己縮小選號範圍。
 */
export const SSC_OF_MAX_COMBO = 2000

/** 判定結果：官方盤沒有和局，tie 只保留給無法辨識的注碼 */
export type SscOfBetResult = { status: 'win' | 'lose' | 'tie'; odds: number; payout: number }

/** 兩面 */
const SIDE_NAMES = ['大', '小', '單', '雙'] as const
type SscSide = (typeof SIDE_NAMES)[number]

/** 各玩法看的球位（0 起算）：後三 = 百十個、後二 = 十個 */
export const SSC_OF_SECTIONS = {
  五星: [0, 1, 2, 3, 4],
  前三: [0, 1, 2],
  後三: [2, 3, 4],
  前二: [0, 1],
  後二: [3, 4]
} as const
export type SscOfSection = keyof typeof SSC_OF_SECTIONS

type SscOfBet =
  /** 定位膽：第一球0（與信用盤同一套注碼） */
  | { kind: 'ballDigit'; ball: number; digit: number }
  /** 位置直選：五星直選01234 / 後三直選123 / 後二直選12 */
  | { kind: 'direct'; section: SscOfSection; digits: number[] }
  /** 組三：後三組三12（{1,1,2} 不計順序） */
  | { kind: 'group3'; pair: [number, number] }
  /** 組六：後三組六123（三碼互異、不計順序） */
  | { kind: 'group6'; digits: [number, number, number] }
  /** 後二組選：後二組選12（兩碼互異、不計順序） */
  | { kind: 'group2'; digits: [number, number] }
  /** 大小單雙：大小單雙後二大小（每個位置一個面） */
  | { kind: 'sides'; section: SscOfSection; sides: SscSide[] }

const DIRECT_PREFIX: Record<string, SscOfSection> = {
  五星直選: '五星',
  後三直選: '後三',
  後二直選: '後二'
}

/** 把一串數字字元轉成陣列；含非數字回 null */
function _digitsOf(text: string, expect: number): number[] | null {
  if (text.length !== expect || !/^\d+$/.test(text)) return null
  return text.split('').map(Number)
}

function _parseBet(betCode: string | number): SscOfBet | null {
  const code = String(betCode ?? '').trim()
  if (!code) return null

  // ── 大小單雙：大小單雙後二大小 ──
  if (code.startsWith('大小單雙')) {
    const rest = code.slice(4)
    const section = (Object.keys(SSC_OF_SECTIONS) as SscOfSection[])
      .find((s) => rest.startsWith(s) && s !== '五星')
    if (!section) return null
    const tail = rest.slice(section.length)
    const size = SSC_OF_SECTIONS[section].length
    if (tail.length !== size) return null
    const sides = tail.split('').map((ch) => SIDE_NAMES.find((s) => s === ch))
    if (sides.some((s) => !s)) return null
    return { kind: 'sides', section, sides: sides as SscSide[] }
  }

  // ── 位置直選 ──
  for (const [prefix, section] of Object.entries(DIRECT_PREFIX)) {
    if (!code.startsWith(prefix)) continue
    const digits = _digitsOf(code.slice(prefix.length), SSC_OF_SECTIONS[section].length)
    return digits ? { kind: 'direct', section, digits } : null
  }

  // ── 組選 ──
  if (code.startsWith('後三組三')) {
    const d = _digitsOf(code.slice(4), 2)
    // 兩碼必須相異（AAB 的 A 與 B），且遞增讓同一注只有一種寫法
    if (!d || d[0] === d[1] || !(d[0]! < d[1]!)) return null
    return { kind: 'group3', pair: [d[0]!, d[1]!] }
  }
  if (code.startsWith('後三組六')) {
    const d = _digitsOf(code.slice(4), 3)
    if (!d || !(d[0]! < d[1]! && d[1]! < d[2]!)) return null
    return { kind: 'group6', digits: [d[0]!, d[1]!, d[2]!] }
  }
  if (code.startsWith('後二組選')) {
    const d = _digitsOf(code.slice(4), 2)
    if (!d || !(d[0]! < d[1]!)) return null
    return { kind: 'group2', digits: [d[0]!, d[1]!] }
  }

  // ── 定位膽（與信用盤同一套注碼）──
  for (const name of SSC_BALL_NAMES) {
    if (!code.startsWith(name)) continue
    const rest = code.slice(name.length)
    if (!/^\d$/.test(rest)) return null
    return { kind: 'ballDigit', ball: SSC_BALL_NAMES.indexOf(name), digit: Number(rest) }
  }

  return null
}

const _sideHit = (side: SscSide, value: number): boolean => {
  if (side === '大') return value >= 5
  if (side === '小') return value < 5
  if (side === '單') return value % 2 === 1
  return value % 2 === 0
}

/**
 * 注碼的樣本空間
 * @returns { hit, total }；注碼無法辨識回 null
 */
export function sscOfChanceOf(betCode: string | number): SscChance | null {
  const bet = _parseBet(betCode)
  if (!bet) return null
  const D = SSC_DIGIT_MAX + 1
  switch (bet.kind) {
    case 'ballDigit':
      return { hit: 1, total: D }
    // n 個位置全中
    case 'direct':
      return { hit: 1, total: D ** SSC_OF_SECTIONS[bet.section].length }
    // 組三：AAB 的排列有 3 種（AAB/ABA/BAA），且 A、B 可互換角色 → 3 × 2 = 6
    case 'group3':
      return { hit: 6, total: D ** 3 }
    // 組六：三碼互異的排列 3! = 6
    case 'group6':
      return { hit: 6, total: D ** 3 }
    // 後二組選：兩碼互異的排列 2! = 2
    case 'group2':
      return { hit: 2, total: D ** 2 }
    // 每個位置各 5 個號碼符合該面
    case 'sides':
      return { hit: 5 ** bet.sides.length, total: D ** bet.sides.length }
  }
}

/**
 * 注碼是否命中
 * @returns true／false／null（注碼或開獎格式不合）
 */
export function sscOfIsHit(betCode: string | number, openCode: Array<string | number>): boolean | null {
  const digits = sscDigitsOf(openCode)
  if (!digits) return null
  const bet = _parseBet(betCode)
  if (!bet) return null

  const pick = (section: SscOfSection) => SSC_OF_SECTIONS[section].map((i) => Number(digits[i]))

  switch (bet.kind) {
    case 'ballDigit':
      return digits[bet.ball] === bet.digit
    case 'direct':
      return pick(bet.section).every((d, i) => d === bet.digits[i])
    case 'group3': {
      const [a, b] = bet.pair
      const got = [...pick('後三')].sort((x, y) => x - y)
      // 開出的三碼必須恰好是 {A,A,B} 或 {A,B,B}
      const want1 = [a, a, b].sort((x, y) => x - y)
      const want2 = [a, b, b].sort((x, y) => x - y)
      return got.every((d, i) => d === want1[i]) || got.every((d, i) => d === want2[i])
    }
    case 'group6': {
      const got = [...pick('後三')].sort((x, y) => x - y)
      return got.every((d, i) => d === bet.digits[i])
    }
    case 'group2': {
      const got = [...pick('後二')].sort((x, y) => x - y)
      return got.every((d, i) => d === bet.digits[i])
    }
    case 'sides':
      return pick(bet.section).every((d, i) => _sideHit(bet.sides[i]!, d))
  }
}

/** 注碼種類；無法辨識回 null */
export function sscOfKindOf(betCode: string | number): SscOfBet['kind'] | null {
  return _parseBet(betCode)?.kind ?? null
}

/**
 * 注碼賠率（含本金）＝ 公平賠率 × rtp
 * @returns 賠率，取到小數 2 位；注碼無法辨識回 0
 */
export function sscOfOddsOf(betCode: string, rtp: number = SSCOF_RTP_FALLBACK): number {
  const chance = sscOfChanceOf(betCode)
  if (!chance || !(chance.hit > 0) || !(chance.total > 0)) return 0
  const safeRtp = Number.isFinite(rtp) && rtp > 0 ? rtp : SSCOF_RTP_FALLBACK
  return Number(((chance.total / chance.hit) * safeRtp).toFixed(2))
}

/**
 * 判定一注
 * @param lockedOdds 下注時鎖進注單的賠率；> 0 就以它為準
 */
export function judgeSscOfBet(
  betCode: string,
  openCode: Array<string | number>,
  coin = 1,
  lockedOdds = 0
): SscOfBetResult | null {
  const hit = sscOfIsHit(betCode, openCode)
  if (hit === null) return null
  const odds = lockedOdds > 0 ? Number(lockedOdds) : sscOfOddsOf(betCode)
  const bet = Math.max(0, Number(coin) || 0)
  if (!hit) return { status: 'lose', odds, payout: 0 }
  return { status: 'win', odds, payout: Number((bet * odds).toFixed(2)) }
}

// ── 複式展開 ────────────────────────────────────────────────────────────────

/** 把每個位置選的號碼去重排序；有任一位沒選就回 null */
function _normalizeSets(sets: Array<Array<number | string>>): number[][] | null {
  const lists = (Array.isArray(sets) ? sets : []).map((list) => {
    const nums = (Array.isArray(list) ? list : [])
      .map((n) => Number(n))
      .filter((n) => Number.isInteger(n) && n >= 0 && n <= SSC_DIGIT_MAX)
    return Array.from(new Set(nums)).sort((a, b) => a - b)
  })
  if (lists.length === 0 || lists.some((l) => l.length === 0)) return null
  return lists
}

/**
 * 位置型複式展開（五星／後三直選／後二直選）
 *
 * ⚠️ 時時彩的號碼可以重複，所以**不濾掉重複組合**（與 pk10 的名次排列不同）。
 * @returns 每一注的號碼陣列；任一位沒選或超過上限回空陣列
 */
export function sscDirectCombos(sets: Array<Array<number | string>>): number[][] {
  const lists = _normalizeSets(sets)
  if (!lists) return []
  const size = lists.reduce((acc, l) => acc * l.length, 1)
  if (size > SSC_OF_MAX_COMBO) return []
  let combos: number[][] = [[]]
  lists.forEach((list) => {
    const next: number[][] = []
    combos.forEach((prefix) => list.forEach((d) => next.push([...prefix, d])))
    combos = next
  })
  return combos
}

/** 兩面型複式展開（大小單雙）：每個位置選一組面 */
export function sscSideCombos(sets: Array<Array<string>>): string[][] {
  const lists = (Array.isArray(sets) ? sets : []).map((list) =>
    Array.from(new Set((Array.isArray(list) ? list : []).filter((s) => SIDE_NAMES.includes(s as SscSide))))
  )
  if (lists.length === 0 || lists.some((l) => l.length === 0)) return []
  let combos: string[][] = [[]]
  lists.forEach((list) => {
    const next: string[][] = []
    combos.forEach((prefix) => list.forEach((s) => next.push([...prefix, s])))
    combos = next
  })
  return combos
}

/**
 * 組選展開：從一組號碼取出所有組合
 * @param mode group3（兩碼、A 與 B 互換算同一注）／group6（三碼互異）／group2（兩碼互異）
 */
export function sscGroupCombos(digits: Array<number | string>, mode: 'group3' | 'group6' | 'group2'): number[][] {
  const pool = Array.from(new Set(
    (Array.isArray(digits) ? digits : [])
      .map((n) => Number(n))
      .filter((n) => Number.isInteger(n) && n >= 0 && n <= SSC_DIGIT_MAX)
  )).sort((a, b) => a - b)
  const size = mode === 'group6' ? 3 : 2
  if (pool.length < size) return []
  const out: number[][] = []
  const walk = (start: number, acc: number[]) => {
    if (acc.length === size) { out.push([...acc]); return }
    for (let i = start; i < pool.length; i++) walk(i + 1, [...acc, pool[i]!])
  }
  walk(0, [])
  return out.length > SSC_OF_MAX_COMBO ? [] : out
}

/** 玩法定義（順序即前端玩法列的顯示順序，需與 sscof/plays.js 一致） */
export const SSC_OF_PLAY_DEFINITIONS: Array<{ key: string; name: string }> = [
  { key: 'dingwei', name: '定位膽' },
  { key: 'erxing', name: '二星' },
  { key: 'housan', name: '後三' },
  { key: 'wuxing', name: '五星' },
  { key: 'daxiao', name: '大小單雙' }
]

export { SSC_BALL_COUNT, SSC_BALL_NAMES, SSC_TOTAL_OUTCOMES }
