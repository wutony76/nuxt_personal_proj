/**
 * 時時彩信用盤（SSC-CD）判定與賠率核心
 *
 * 賠率一律由「公平賠率 × RTP」推導，不寫死拍板數字：
 *   公平賠率 = 該注項的母數 ÷ 命中數（機率由 shared/config/ssc.ts 窮舉而來）
 *
 * ── 玩法（對照 pcv2_0223 的 conf_sc_cd.js，7 個分頁 152 個注項）──
 *   1-5球     第一球0 ~ 第五球9                    母數 10
 *   兩面      第一球大/小/單/雙、總和大/小/單/雙     母數 10 / 100000
 *   前中後三  前三豹子/順子/對子/半順/雜六           母數 1000
 *   全5中1    全中0 ~ 全中9                        母數 100000
 *   龍虎鬥    龍虎12龍/和/虎（10 組球對）           母數 100
 *   鬥牛      沒牛/牛1~牛9/牛牛/牛大小單雙          母數 100000
 *   梭哈      梭哈五條 ~ 梭哈散號                   母數 100000
 *
 * ── 與 k3-cd / pk10-cd 的分工一致 ────────────────────────
 *   本檔不讀設定檔；需要 rtp 由呼叫端傳入。
 *   ⚠️ 不可 import ssccd/helpers（helpers 會 import 本檔，會形成循環）。
 *
 * ── 和局 ────────────────────────────────────────────────
 *   龍虎鬥的「和」是獨立注項（不是退本金），所以本檔沒有 tie ——
 *   結果只有 win / lose，`tie` 保留給呼叫端在注碼無法辨識時退還本金。
 */
import {
  sscBullCounts,
  sscBullOf,
  sscDigitsOf,
  sscDragonOf,
  sscSectionOf,
  sscShowhandCounts,
  sscShowhandOf,
  sscSumCounts,
  sscSumOf,
  sscTripleCounts,
  sscTriplePatternOf,
  SSC_BALL_COUNT,
  SSC_BALL_NAMES,
  SSC_BIG_LINE,
  SSC_DIGIT_MAX,
  SSC_SUM_BIG_LINE,
  SSC_TOTAL_OUTCOMES,
  SSC_TRIPLE_SECTIONS,
  type SscTripleSection,
  type SscTriplePattern,
  type SscShowhandPattern,
  type SscChance
} from '#shared/config/ssc'

export {
  sscBullOf,
  sscDigitsOf,
  sscDragonOf,
  sscShowhandOf,
  sscSumOf,
  sscTriplePatternOf,
  SSC_BALL_COUNT,
  SSC_BALL_NAMES,
  SSC_BIG_LINE,
  SSC_DIGIT_MAX,
  SSC_SUM_BIG_LINE,
  SSC_TOTAL_OUTCOMES
}

/** 預設回報率（同 6hc-cd / k3-cd / pk10-cd 的信用盤慣例） */
export const SSC_RTP_FALLBACK = 0.97

export type SscBetResult = 'win' | 'lose' | 'tie'
export type SscJudgeResult = {
  kind: SscBet['kind']
  result: SscBetResult
  /** 賠率（含本金） */
  odds: number
  /** 派彩金額（含本金）；和局退還本金、未中為 0 */
  payout: number
}

/** 單球／總和的兩面 */
const SIDE_NAMES = ['大', '小', '單', '雙'] as const
type SscSide = (typeof SIDE_NAMES)[number]

/** 鬥牛的兩面（牛大／牛小／牛單／牛雙） */
const BULL_SIDE_NAMES = ['大', '小', '單', '雙'] as const

/**
 * 注碼描述（解析的唯一產物）
 * 機率與判定都只吃這個 descriptor —— 新增玩法只要動 `_parseBet` 與兩張表，
 * 兩支不會各自長分支而語意飄移（做法同 pk10.ts）。
 */
type SscBet =
  /** 1-5球單號：第一球0 */
  | { kind: 'ballDigit'; ball: number; digit: number }
  /** 單球兩面：第一球大 */
  | { kind: 'ballSide'; ball: number; side: SscSide }
  /** 總和兩面：總和大 */
  | { kind: 'sumSide'; side: SscSide }
  /** 前中後三牌型：前三豹子 */
  | { kind: 'triple'; section: SscTripleSection; pattern: SscTriplePattern }
  /** 全5中1：全中7（任一球開出該號） */
  | { kind: 'anyHit'; digit: number }
  /** 龍虎鬥：龍虎12龍 */
  | { kind: 'dragon'; a: number; b: number; side: '龍' | '和' | '虎' }
  /** 鬥牛點數：沒牛 / 牛1 ~ 牛9 / 牛牛 */
  | { kind: 'bull'; label: string }
  /** 鬥牛兩面：牛大 / 牛小 / 牛單 / 牛雙 */
  | { kind: 'bullSide'; side: SscSide }
  /** 梭哈牌型：梭哈葫蘆 */
  | { kind: 'showhand'; pattern: SscShowhandPattern }

/** 球位名稱 → index（0 起算）；不是球位前綴回 -1 */
function _ballOf(name: string): number {
  return SSC_BALL_NAMES.indexOf(name as (typeof SSC_BALL_NAMES)[number])
}

/** 該面是否符合（大小以 bigLine 判、單雙看奇偶） */
function _sideHit(side: SscSide, value: number, bigLine: number): boolean {
  if (side === '大') return value >= bigLine
  if (side === '小') return value < bigLine
  if (side === '單') return value % 2 === 1
  return value % 2 === 0
}

/** 鬥牛點數：牛牛視為 10 點（大小單雙都以這個值判） */
function _bullPoint(bull: NonNullable<ReturnType<typeof sscBullOf>>): number | null {
  if (!bull.hasBull) return null
  return bull.point === 0 ? 10 : bull.point
}

const BULL_LABELS = ['沒牛', '牛牛', ...Array.from({ length: 9 }, (_, i) => `牛${i + 1}`)]
const SHOWHAND_PATTERNS: SscShowhandPattern[] = ['五條', '四條', '葫蘆', '順子', '三條', '兩對', '一對', '散號']

/**
 * 解析注碼
 * @returns descriptor；無法辨識回 null（呼叫端一律視為無效注碼，不可猜）
 */
function _parseBet(betCode: string | number): SscBet | null {
  const code = String(betCode ?? '').trim()
  if (!code) return null

  // ── 龍虎鬥：龍虎12龍 ──
  const dragon = /^龍虎([1-5])([1-5])(龍|和|虎)$/.exec(code)
  if (dragon) {
    const a = Number(dragon[1]) - 1
    const b = Number(dragon[2]) - 1
    // 必須遞增且相異，同一組對戰才只有一種寫法
    if (!(a < b)) return null
    return { kind: 'dragon', a, b, side: dragon[3] as '龍' | '和' | '虎' }
  }

  // ── 梭哈：梭哈葫蘆 ──
  if (code.startsWith('梭哈')) {
    const pattern = SHOWHAND_PATTERNS.find((p) => p === code.slice(2))
    return pattern ? { kind: 'showhand', pattern } : null
  }

  // ── 鬥牛：沒牛 / 牛牛 / 牛1~牛9 / 牛大小單雙 ──
  if (BULL_LABELS.includes(code)) return { kind: 'bull', label: code }
  if (code.startsWith('牛') && code.length === 2) {
    const side = BULL_SIDE_NAMES.find((s) => s === code.slice(1))
    if (side) return { kind: 'bullSide', side }
  }

  // ── 全5中1：全中7 ──
  if (code.startsWith('全中')) {
    const digit = Number(code.slice(2))
    return Number.isInteger(digit) && digit >= 0 && digit <= SSC_DIGIT_MAX
      ? { kind: 'anyHit', digit }
      : null
  }

  // ── 總和兩面：總和大 ──
  if (code.startsWith('總和')) {
    const side = SIDE_NAMES.find((s) => s === code.slice(2))
    return side ? { kind: 'sumSide', side } : null
  }

  // ── 前中後三牌型：前三豹子 ──
  for (const section of SSC_TRIPLE_SECTIONS) {
    if (!code.startsWith(section)) continue
    const rest = code.slice(section.length)
    const pattern = (['豹子', '順子', '對子', '半順', '雜六'] as SscTriplePattern[]).find((p) => p === rest)
    return pattern ? { kind: 'triple', section, pattern } : null
  }

  // ── 1-5球：第一球0 / 第一球大 ──
  for (const name of SSC_BALL_NAMES) {
    if (!code.startsWith(name)) continue
    const rest = code.slice(name.length)
    const ball = _ballOf(name)
    const side = SIDE_NAMES.find((s) => s === rest)
    if (side) return { kind: 'ballSide', ball, side }
    if (/^\d$/.test(rest)) return { kind: 'ballDigit', ball, digit: Number(rest) }
    return null
  }

  return null
}

// ── 機率（賠率推導的唯一來源）──────────────────────────────────────────────

/** 單球某一面的命中數（0 ~ 9 中各 5 個） */
function _ballSideHit(side: SscSide): number {
  let hit = 0
  for (let d = 0; d <= SSC_DIGIT_MAX; d++) if (_sideHit(side, d, SSC_BIG_LINE)) hit += 1
  return hit
}

/** 總和某一面的命中數（母數 100,000） */
function _sumSideHit(side: SscSide): number {
  // ⚠️ Object.entries 對 Record<number, number> 會把 value 推成 unknown，值一律 Number() 收斂
  return Object.entries(sscSumCounts())
    .filter(([sum]) => _sideHit(side, Number(sum), SSC_SUM_BIG_LINE))
    .reduce((acc, [, count]) => acc + Number(count), 0)
}

/** 鬥牛某一面的命中數（沒牛不計入任何一面） */
function _bullSideHit(side: SscSide): number {
  const counts = sscBullCounts()
  let hit = 0
  Object.entries(counts).forEach(([label, count]) => {
    if (label === '沒牛') return
    const point = label === '牛牛' ? 10 : Number(label.slice(1))
    // 牛大 = 牛點 ≥ 6（含牛牛 10）、牛小 = 1 ~ 5；單雙看牛點奇偶
    if (_sideHit(side, point, 6)) hit += Number(count)
  })
  return hit
}

/**
 * 注碼的樣本空間
 * @returns { hit, total }；注碼無法辨識回 null
 */
export function sscChanceOf(betCode: string | number): SscChance | null {
  const bet = _parseBet(betCode)
  if (!bet) return null
  const DIGIT_TOTAL = SSC_DIGIT_MAX + 1
  switch (bet.kind) {
    case 'ballDigit':
      return { hit: 1, total: DIGIT_TOTAL }
    case 'ballSide':
      return { hit: _ballSideHit(bet.side), total: DIGIT_TOTAL }
    case 'sumSide':
      return { hit: _sumSideHit(bet.side), total: SSC_TOTAL_OUTCOMES }
    case 'triple':
      return { hit: sscTripleCounts()[bet.pattern], total: 1000 }
    // 任一球開出該號 = 1 − (9/10)^5
    case 'anyHit':
      return { hit: SSC_TOTAL_OUTCOMES - SSC_DIGIT_MAX ** SSC_BALL_COUNT, total: SSC_TOTAL_OUTCOMES }
    // 兩球比大小：100 種組合，龍 45／和 10／虎 45
    case 'dragon': {
      const total = DIGIT_TOTAL * DIGIT_TOTAL
      const hit = bet.side === '和' ? DIGIT_TOTAL : (total - DIGIT_TOTAL) / 2
      return { hit, total }
    }
    case 'bull':
      return { hit: Number(sscBullCounts()[bet.label] ?? 0), total: SSC_TOTAL_OUTCOMES }
    case 'bullSide':
      return { hit: _bullSideHit(bet.side), total: SSC_TOTAL_OUTCOMES }
    case 'showhand':
      return { hit: sscShowhandCounts()[bet.pattern], total: SSC_TOTAL_OUTCOMES }
  }
}

/**
 * 注碼是否命中（判定的唯一入口，賠率與結算都靠它）
 * @returns true 命中／false 未命中／null 注碼或開獎格式不合
 */
export function sscIsHit(betCode: string | number, openCode: Array<string | number>): boolean | null {
  const digits = sscDigitsOf(openCode)
  if (!digits) return null
  const bet = _parseBet(betCode)
  if (!bet) return null

  switch (bet.kind) {
    case 'ballDigit':
      return digits[bet.ball] === bet.digit
    case 'ballSide':
      return _sideHit(bet.side, Number(digits[bet.ball]), SSC_BIG_LINE)
    case 'sumSide':
      return _sideHit(bet.side, sscSumOf(digits), SSC_SUM_BIG_LINE)
    case 'triple': {
      const section = sscSectionOf(digits, bet.section)
      return section ? sscTriplePatternOf(section) === bet.pattern : null
    }
    case 'anyHit':
      return digits.includes(bet.digit)
    case 'dragon':
      return sscDragonOf(digits, bet.a, bet.b) === bet.side
    case 'bull': {
      const bull = sscBullOf(digits)
      if (!bull) return null
      const label = !bull.hasBull ? '沒牛' : bull.point === 0 ? '牛牛' : `牛${bull.point}`
      return label === bet.label
    }
    case 'bullSide': {
      const bull = sscBullOf(digits)
      if (!bull) return null
      const point = _bullPoint(bull)
      // 沒牛不屬於任何一面（不算中也不退本金）
      return point === null ? false : _sideHit(bet.side, point, 6)
    }
    case 'showhand':
      return sscShowhandOf(digits) === bet.pattern
  }
}

/** 注碼種類（供前端分群顯示與統計）；無法辨識回 null */
export function sscKindOf(betCode: string | number): SscBet['kind'] | null {
  return _parseBet(betCode)?.kind ?? null
}

/**
 * 取注項賠率（含本金）
 * @returns 賠率（無條件捨去到小數 2 位，避免浮點多給）；無法辨識回 0
 */
export function sscOddsOf(betCode: string | number, rtp: number = SSC_RTP_FALLBACK): number {
  const chance = sscChanceOf(betCode)
  if (!chance || !(chance.hit > 0) || !(chance.total > 0)) return 0
  const safeRtp = Number.isFinite(rtp) && rtp > 0 ? rtp : SSC_RTP_FALLBACK
  return Math.floor((chance.total / chance.hit) * safeRtp * 100) / 100
}

/**
 * SSC 中獎判定
 * @param odds 下注時鎖定的賠率；未帶（或 ≤ 0）則以 rtp 即時推算
 * @returns 判定結果；注碼無法辨識或開獎格式不合回 null（呼叫端應視為和局退還本金）
 */
export function judgeSscBet(
  betCode: string | number,
  openCode: Array<string | number>,
  coin: number,
  odds: number = 0,
  rtp: number = SSC_RTP_FALLBACK
): SscJudgeResult | null {
  const hit = sscIsHit(betCode, openCode)
  if (hit === null) return null
  const kind = sscKindOf(betCode)
  if (!kind) return null

  const lockedOdds = Number(odds) > 0 ? Number(odds) : sscOddsOf(betCode, rtp)
  if (!(lockedOdds > 0)) return null

  const amount = Number(coin)
  const safeCoin = Number.isFinite(amount) && amount > 0 ? amount : 0
  return {
    kind,
    result: hit ? 'win' : 'lose',
    odds: lockedOdds,
    payout: hit ? Number((safeCoin * lockedOdds).toFixed(2)) : 0
  }
}

/** 玩法定義（順序即前端玩法列的顯示順序，需與 ssccd/plays.js 一致） */
export const SSC_PLAY_DEFINITIONS: Array<{ key: string; name: string }> = [
  { key: 'ball', name: '1-5球' },
  { key: 'liangmian', name: '兩面' },
  { key: 'sanpai', name: '前中後三' },
  { key: 'quan5', name: '全5中1' },
  { key: 'longhu', name: '龍虎鬥' },
  { key: 'douniu', name: '鬥牛' },
  { key: 'suoha', name: '梭哈' }
]
