/**
 * PC蛋蛋信用盤（EGGS）判定與賠率核心
 *
 * 賠率一律由「公平賠率 × RTP」推導，不寫死拍板數字：
 *   公平賠率 = 該注項的母數 ÷ 命中數（機率由 shared/config/eggs.ts 窮舉而來）
 *
 * ── 與 k3-cd / ssc-cd 的分工一致 ────────────────────────
 *   本檔不讀設定檔；需要 rtp 由呼叫端傳入。
 *   ⚠️ 不可 import eggscd/helpers（helpers 會 import 本檔，會形成循環）。
 *
 * ── 玩法（對照 bglottery pceggs/config_play.js）──────────
 *   大小      大/小/极大/极小                母數 1000
 *   单双      单/双/大单/小单/大双/小双       母數 1000
 *   特殊玩法  豹子/对子/顺子                  母數 1000
 *   色波      红波/蓝波/绿波                  母數 1000
 *   特码      0 ~ 27 直選                    母數 1000
 */
import {
  eggsDigitsOf,
  eggsPatternCounts,
  eggsPatternOf,
  eggsSumOf,
  EGGS_BIG_LINE,
  EGGS_EXTREME_BIG_RANGE,
  EGGS_EXTREME_SMALL_RANGE,
  EGGS_SUM_COUNTS,
  EGGS_SUM_MAX,
  EGGS_SUM_MIN,
  EGGS_TOTAL_OUTCOMES,
  EGGS_WAVE_MAP,
  type EggsPattern
} from '#shared/config/eggs'

export { eggsDigitsOf, eggsPatternOf, eggsSumOf, EGGS_BIG_LINE, EGGS_SUM_MAX, EGGS_SUM_MIN, EGGS_TOTAL_OUTCOMES }

/** 預設回報率（同 6hc-cd / k3-cd / ssc-cd 的信用盤慣例） */
export const EGGS_RTP_FALLBACK = 0.97

export type EggsBetResult = 'win' | 'lose' | 'tie'
export type EggsJudgeResult = {
  kind: EggsBet['kind']
  result: EggsBetResult
  /** 賠率（含本金） */
  odds: number
  /** 派彩金額（含本金）；未中為 0 */
  payout: number
}

/** 大小單雙四個基本面 */
const SIDE_NAMES = ['大', '小', '單', '雙'] as const
type EggsSide = (typeof SIDE_NAMES)[number]
/** 複合面：大單/小單/大雙/小雙 */
const COMPOUND_NAMES = ['大單', '小單', '大雙', '小雙'] as const
type EggsCompound = (typeof COMPOUND_NAMES)[number]
type EggsWave = '紅波' | '藍波' | '綠波'

/**
 * 注碼描述（解析的唯一產物），比照 ssc-cd.ts 的做法：
 * 機率與判定都只吃這個 descriptor，新增玩法只要動 `_parseBet` 與判定/機率兩張表。
 */
type EggsBet =
  | { kind: 'side'; side: EggsSide }
  | { kind: 'extreme'; side: '極大' | '極小' }
  | { kind: 'compound'; compound: EggsCompound }
  | { kind: 'wave'; wave: EggsWave }
  | { kind: 'pattern'; pattern: Exclude<EggsPattern, null> }
  | { kind: 'sum'; sum: number }

/** 大小單雙的和值條件 */
function _sideHit(side: EggsSide, sum: number): boolean {
  if (side === '大') return sum > EGGS_BIG_LINE
  if (side === '小') return sum <= EGGS_BIG_LINE
  if (side === '單') return sum % 2 === 1
  return sum % 2 === 0
}

/** 複合面＝「大或小」與「單或雙」條件的交集 */
function _compoundHit(compound: EggsCompound, sum: number): boolean {
  const bigSmall: EggsSide = compound.startsWith('大') ? '大' : '小'
  const oddEven: EggsSide = compound.endsWith('單') ? '單' : '雙'
  return _sideHit(bigSmall, sum) && _sideHit(oddEven, sum)
}

/** 色波：和值對照 EGGS_WAVE_MAP（灰色四個和值不屬於任何色波） */
function _waveHit(wave: EggsWave, sum: number): boolean {
  const key = wave === '紅波' ? '紅波' : wave === '藍波' ? '藍波' : '綠波'
  return (EGGS_WAVE_MAP[key] ?? []).includes(sum)
}

/**
 * 解析注碼
 * @returns descriptor；無法辨識回 null（呼叫端一律視為無效注碼，不可猜）
 */
function _parseBet(betCode: string | number): EggsBet | null {
  const code = String(betCode ?? '').trim()
  if (!code) return null

  // 特碼：0 ~ 27 直選
  if (/^\d+$/.test(code)) {
    const sum = Number(code)
    return sum >= EGGS_SUM_MIN && sum <= EGGS_SUM_MAX ? { kind: 'sum', sum } : null
  }
  // 极大/极小
  if (code === '極大' || code === '极大') return { kind: 'extreme', side: '極大' }
  if (code === '極小' || code === '极小') return { kind: 'extreme', side: '極小' }
  // 複合面：大單/小單/大雙/小雙
  const compound = COMPOUND_NAMES.find((name) => name === code)
  if (compound) return { kind: 'compound', compound }
  // 大小單雙
  const side = SIDE_NAMES.find((name) => name === code)
  if (side) return { kind: 'side', side }
  // 色波
  if (code === '紅波' || code === '红波') return { kind: 'wave', wave: '紅波' }
  if (code === '藍波' || code === '蓝波') return { kind: 'wave', wave: '藍波' }
  if (code === '綠波' || code === '绿波') return { kind: 'wave', wave: '綠波' }
  // 特殊玩法：豹子/对子/顺子
  if (code === '豹子') return { kind: 'pattern', pattern: '豹子' }
  if (code === '對子' || code === '对子') return { kind: 'pattern', pattern: '對子' }
  if (code === '順子' || code === '顺子') return { kind: 'pattern', pattern: '順子' }

  return null
}

// ── 機率（賠率推導的唯一來源）──────────────────────────────────────────────

export type EggsChance = { hit: number; total: number }

function _sideHitCount(side: EggsSide): number {
  return Object.entries(EGGS_SUM_COUNTS)
    .filter(([sum]) => _sideHit(side, Number(sum)))
    .reduce((acc, [, count]) => acc + Number(count), 0)
}

function _compoundHitCount(compound: EggsCompound): number {
  return Object.entries(EGGS_SUM_COUNTS)
    .filter(([sum]) => _compoundHit(compound, Number(sum)))
    .reduce((acc, [, count]) => acc + Number(count), 0)
}

function _extremeHitCount(side: '極大' | '極小'): number {
  const [min, max] = side === '極大' ? EGGS_EXTREME_BIG_RANGE : EGGS_EXTREME_SMALL_RANGE
  let hit = 0
  for (let sum = min; sum <= max; sum++) hit += Number(EGGS_SUM_COUNTS[sum] ?? 0)
  return hit
}

function _waveHitCount(wave: EggsWave): number {
  return Object.entries(EGGS_SUM_COUNTS)
    .filter(([sum]) => _waveHit(wave, Number(sum)))
    .reduce((acc, [, count]) => acc + Number(count), 0)
}

/**
 * 注碼的樣本空間
 * @returns { hit, total }；注碼無法辨識回 null
 */
export function eggsChanceOf(betCode: string | number): EggsChance | null {
  const bet = _parseBet(betCode)
  if (!bet) return null
  switch (bet.kind) {
    case 'sum':
      return { hit: Number(EGGS_SUM_COUNTS[bet.sum] ?? 0), total: EGGS_TOTAL_OUTCOMES }
    case 'side':
      return { hit: _sideHitCount(bet.side), total: EGGS_TOTAL_OUTCOMES }
    case 'compound':
      return { hit: _compoundHitCount(bet.compound), total: EGGS_TOTAL_OUTCOMES }
    case 'extreme':
      return { hit: _extremeHitCount(bet.side), total: EGGS_TOTAL_OUTCOMES }
    case 'wave':
      return { hit: _waveHitCount(bet.wave), total: EGGS_TOTAL_OUTCOMES }
    case 'pattern':
      return { hit: eggsPatternCounts()[bet.pattern], total: EGGS_TOTAL_OUTCOMES }
  }
}

/**
 * 注碼是否命中（判定的唯一入口，賠率與結算都靠它）
 * @returns true 命中／false 未命中／null 注碼或開獎格式不合
 */
export function eggsIsHit(betCode: string | number, openCode: Array<string | number>): boolean | null {
  const digits = eggsDigitsOf(openCode)
  if (!digits) return null
  const bet = _parseBet(betCode)
  if (!bet) return null

  const sum = eggsSumOf(digits)
  switch (bet.kind) {
    case 'sum':
      return sum === bet.sum
    case 'side':
      return _sideHit(bet.side, sum)
    case 'compound':
      return _compoundHit(bet.compound, sum)
    case 'extreme': {
      const [min, max] = bet.side === '極大' ? EGGS_EXTREME_BIG_RANGE : EGGS_EXTREME_SMALL_RANGE
      return sum >= min && sum <= max
    }
    case 'wave':
      return _waveHit(bet.wave, sum)
    case 'pattern':
      return eggsPatternOf(digits) === bet.pattern
  }
}

/** 注碼種類（供前端分群顯示與統計）；無法辨識回 null */
export function eggsKindOf(betCode: string | number): EggsBet['kind'] | null {
  return _parseBet(betCode)?.kind ?? null
}

/**
 * 取注項賠率（含本金）
 * @returns 賠率（無條件捨去到小數 2 位，避免浮點多給）；無法辨識回 0
 */
export function eggsOddsOf(betCode: string | number, rtp: number = EGGS_RTP_FALLBACK): number {
  const chance = eggsChanceOf(betCode)
  if (!chance || !(chance.hit > 0) || !(chance.total > 0)) return 0
  const safeRtp = Number.isFinite(rtp) && rtp > 0 ? rtp : EGGS_RTP_FALLBACK
  return Math.floor((chance.total / chance.hit) * safeRtp * 100) / 100
}

/**
 * PC蛋蛋中獎判定
 * @param odds 下注時鎖定的賠率；未帶（或 ≤ 0）則以 rtp 即時推算
 * @returns 判定結果；注碼無法辨識或開獎格式不合回 null（呼叫端應視為和局退還本金）
 */
export function judgeEggsBet(
  betCode: string | number,
  openCode: Array<string | number>,
  coin: number,
  odds: number = 0,
  rtp: number = EGGS_RTP_FALLBACK
): EggsJudgeResult | null {
  const hit = eggsIsHit(betCode, openCode)
  if (hit === null) return null
  const kind = eggsKindOf(betCode)
  if (!kind) return null

  const lockedOdds = Number(odds) > 0 ? Number(odds) : eggsOddsOf(betCode, rtp)
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

/** 玩法定義（順序即前端玩法列的顯示順序，需與 eggscd/plays.js 一致） */
export const EGGS_PLAY_DEFINITIONS: Array<{ key: string; name: string }> = [
  { key: 'daxiao', name: '大小' },
  { key: 'danshuang', name: '單雙' },
  { key: 'tese', name: '特殊玩法' },
  { key: 'sebo', name: '色波' },
  { key: 'tema', name: '特碼' }
]
