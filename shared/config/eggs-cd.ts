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
import { type JackpotSettings } from '#shared/config/jackpot'
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

// ── 爆池（抽水入池 + 開豹子時發放） ─────────────────────────────

/**
 * PC蛋蛋的爆池設定
 *
 * ── 爆池期怎麼定 ────────────────────────────────────────
 *   開出**豹子**（三球同號）時觸發。選這個條件的理由與其他彩種一致：
 *     1. 它是看板上真的存在的注項（特殊玩法分頁的「豹子」），玩家看得到也押得到
 *     2. 機率 10/1000 = 1%，與 6hc-cd 的「特別號開 49」（1/49 ≒ 2.04%）同一個量級
 *   ⚠️ PC蛋蛋的開獎結構（3 球 × 0~9、可重複）與時時彩的後三**完全相同**，
 *      所以這裡的 hitRate 與 ssc 的「後三豹子」是同一個數字，不是類比。
 *
 * ── 與其他彩種的差異：只有一個池 ────────────────────────
 *   k3 / pk10 / ssc 都有「官方盤分層用的共用彩池」與「爆池」兩個池，註解裡反覆警告不能互吃；
 *   PC蛋蛋沒有官方盤、沒有 Shared 層，**只有爆池這一個池**，那組風險不存在。
 *   也因為只有一個盤口，不需要其他彩種那套「等所有盤口交件才結算」的編排
 *   （見 server/services/game/lottery/bg/k3Shared.ts），直接在 class 內結算即可。
 *
 * ⚠️ boardWeight 只列 cd —— PC蛋蛋沒有官方盤，這個係數在這裡等於不作用。
 */
export const EGGS_JACKPOT_SETTINGS: JackpotSettings = {
  rakeRatio: 0.01,
  payoutRatio: 0.5,
  /** 以 rakeRatio 1% 換算 ≈ 需累積 10 萬投注額 */
  minPool: 1000,
  /** 注單查不到看板設定時的保底權重（設定檔的 weight 都有值，這裡只是保險） */
  weightFallback: 1,
  boardWeight: { cd: 1 },
  hitLabel: '開出豹子（三球同號）',
  hitRate: 10 / 1000
}

/**
 * 爆池起始池底（僅開站時 seed 一次到 carryJackpot，之後照既有機制自然累積／發放）
 *
 * ⚠️ 不可比照彩池玩法（EGGS_POOL_BASE_MIN/MAX）那樣「每期都重新加回去」——
 *    爆池的公式（buildJackpotShares）沒有彩池玩法那個 0.55 阻尼係數，
 *    若每期都持續疊加一筆固定池底，滾存會無界成長（幾百期後爆炸成天文數字）。
 *    因此這裡只在建構子執行一次性 seed，之後池底就融進 carryJackpot 自然演化，
 *    範圍比照彩池玩法（獨立宣告，不共用同一組常數）。
 */
export const EGGS_JACKPOT_BASE_MIN = 110_000
export const EGGS_JACKPOT_BASE_MAX = 450_000

/**
 * 這一期是不是爆池期
 * @returns true = 豹子；開獎格式不合回 false
 */
export function eggsJackpotHit(openCode: Array<string | number>): boolean {
  const digits = eggsDigitsOf(openCode)
  if (!digits) return false
  return eggsPatternOf(digits) === '豹子'
}

/** 爆池期的開獎文字（寫進爆池紀錄，給看板顯示用） */
export function eggsJackpotLabel(openCode: Array<string | number>): string {
  const digits = eggsDigitsOf(openCode)
  if (!digits) return ''
  return `豹${digits.join('')}`
}

/** 玩法定義（順序即前端玩法列的顯示順序，需與 eggscd/plays.js 一致） */
export const EGGS_PLAY_DEFINITIONS: Array<{ key: string; name: string }> = [
  { key: 'daxiao', name: '大小' },
  { key: 'danshuang', name: '單雙' },
  { key: 'tese', name: '特殊玩法' },
  { key: 'sebo', name: '色波' },
  { key: 'tema', name: '特碼' }
]

// ── 彩池玩法（選號，比照 k3-of 的「選號」xuanhao：依命中顆數分層、依下注比例分錢） ──────────
//
// ⚠️ 這是本專案自己設計的機制（比照 k3-of，非 bglottery 來源），與現有爆池（上方
//    EGGS_JACKPOT_SETTINGS）是兩個完全獨立的池：各自的池底／抽水／滾存互不影響，
//    只是兩者都從同一筆下注金額抽水、且彩池玩法的注單也會一併參與現有爆池分配
//    （見 server/services/game/lottery/bg/eggs.ts）。

export type PoolPrizeTier =
  | { match: number; type: 'pool'; ratio: number; minAmount?: number; name: string }
  | { match: number; type: 'fixed'; amount: number; name: string }

/** sentinel playKey：這個玩法刻意不進 eggscd/plays.js 的看板網格，比照 k3-of 的 xuanhao */
export const EGGS_POOL_PLAY_KEY = 'xuanhao'
/** 選 3 個數字（0~9，可重複）——跟 PC蛋蛋開獎位數同構，是 k3-of 選骰子玩法最直接的類比 */
export const EGGS_POOL_PICK_COUNT = 3
/** 查不到看板 weight 時的 fallback（比照 K3_OF_POOL_PLAY_WEIGHT），讓這個玩法也能參與既有爆池 */
export const EGGS_POOL_PLAY_WEIGHT = 3

/** 池底範圍：使用者拍板比照 k3 的數值範圍，但獨立宣告成 EGGS 自己的常數，不 import K3 的 */
export const EGGS_POOL_BASE_MIN = 110_000
export const EGGS_POOL_BASE_MAX = 450_000
/** 抽水比例：比照 K3_RAKE_RATIO（信用盤 2%），與既有爆池的 1% 是兩條並行的水 */
export const EGGS_POOL_RAKE_RATIO = 0.02

/** 硬編碼額度（比照 K3_OF_QUOTA，這個玩法沒有看板設定可查） */
export const EGGS_POOL_QUOTA = { item: { min: 2, max: 10000 }, issue: { max: 500000 } }

/**
 * 分層派彩表（比照 K3_OF_PRIZE_TIERS 的 70/20/固定倍數比例，見 design.md 的機率驗證）
 * ⚠️ 命中率依選型不同（全異/一對/豹子形狀），與 k3-of 選骰子同樣的已知簡化，非本次新增問題
 */
export const EGGS_POOL_PRIZE_TIERS: PoolPrizeTier[] = [
  { match: 3, type: 'pool', ratio: 0.70, minAmount: 20000, name: '頭獎' },
  { match: 2, type: 'pool', ratio: 0.20, name: '二獎' },
  { match: 1, type: 'fixed', amount: 2, name: '三獎' }
]

/** 池底重骰門檻：可派發金額低於「頭獎保底 ÷ 頭獎 ratio」時視為不足（比照 K3_POOL_FLOOR 的算法） */
export const EGGS_POOL_FLOOR = (() => {
  const top = EGGS_POOL_PRIZE_TIERS.find((tier) => tier.type === 'pool' && tier.minAmount !== undefined)
  return top && top.type === 'pool' && top.minAmount ? Math.ceil(top.minAmount / top.ratio) : 0
})()

/**
 * 選號是否合法：3 碼、每碼 0~9（可重複）
 * @returns 排序後的號碼陣列；不合法回 null
 */
export function eggsPoolPicksOf(codes: Array<string | number>): number[] | null {
  if (!Array.isArray(codes) || codes.length !== EGGS_POOL_PICK_COUNT) return null
  const nums = codes.map((code) => Number(code))
  if (nums.some((num) => !Number.isInteger(num) || num < 0 || num > 9)) return null
  return [...nums].sort((a, b) => a - b)
}

/**
 * 命中顆數（picks 與開獎 3 球的 multiset 交集，仿 k3OfMatchCount）
 * @returns 0 ~ EGGS_POOL_PICK_COUNT；開獎格式不合回 0
 */
export function eggsPoolMatchCount(picks: number[], openCode: Array<string | number>): number {
  const digits = eggsDigitsOf(openCode)
  if (!digits) return 0
  const remaining = [...digits]
  let matched = 0
  for (const pick of picks) {
    const idx = remaining.indexOf(pick)
    if (idx < 0) continue
    remaining.splice(idx, 1)
    matched++
  }
  return matched
}

/** 依命中顆數查對應的分層設定；未中（查不到）回 null */
export function eggsPoolTierOf(matchCount: number): PoolPrizeTier | null {
  return EGGS_POOL_PRIZE_TIERS.find((tier) => tier.match === matchCount) ?? null
}
