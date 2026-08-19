/**
 * 11選5 信用盤（X5-CD）判定與賠率核心
 *
 * 賠率一律由「公平賠率 × RTP」推導，不寫死拍板數字：
 *   公平賠率 = 該注項的母數 ÷ 命中數（機率由 shared/config/x5.ts 窮舉／邊際分布而來）
 *
 * ── 玩法（對照 bglottery 的 config_11x5_credit.js，4 個分頁 122 個注項）──
 *   1-5球    第一球01 ~ 第五球11                  母數 11（邊際分布）
 *   兩面     第一球大/小/單/雙                     母數 11
 *            總和大/小/單/雙/尾大/尾小              母數 462（集合性質，需窮舉）
 *   龍虎鬥   龍虎12龍/虎（10 組球對）              母數 2
 *   全5中1   全中01 ~ 全中11                      母數 462
 *
 * ⚠️ 為什麼母數不只一種：見 shared/config/x5.ts 檔頭的對照表。
 *    單球類用 11（超幾何分布的邊際均勻性），總和／全5中1 用 C(11,5)=462。
 *
 * ── 與 ssc-cd / k3-cd / pk10-cd 的分工一致 ────────────────
 *   本檔不讀設定檔；需要 rtp 由呼叫端傳入。
 *   ⚠️ 不可 import x5cd/helpers（helpers 會 import 本檔，會形成循環）。
 *
 * ── 和局 ────────────────────────────────────────────────
 *   11選5 開 5 個**不重複**號碼，龍虎鬥兩球位不可能相等 → 沒有「和」注項，
 *   結果只有 win / lose。`tie` 保留給呼叫端在注碼無法辨識時退還本金。
 */
import { type JackpotSettings } from '#shared/config/jackpot'
import {
  x5ComboHits,
  x5DragonOf,
  x5NumberLabel,
  x5NumbersOf,
  x5ParityAllOf,
  x5SumOf,
  x5SumTailOf,
  X5_BALL_COUNT,
  X5_BALL_NAMES,
  X5_BIG_LINE,
  X5_NUMBERS,
  X5_NUMBER_MAX,
  X5_NUMBER_MIN,
  X5_SUM_BIG_LINE,
  X5_SUM_MAX,
  X5_SUM_MIN,
  X5_SUM_TAIL_BIG_LINE,
  X5_TOTAL_COMBOS,
  type X5Chance
} from '#shared/config/x5'

export {
  x5DragonOf,
  x5NumberLabel,
  x5NumbersOf,
  x5ParityAllOf,
  x5SumOf,
  x5SumTailOf,
  X5_BALL_COUNT,
  X5_BALL_NAMES,
  X5_BIG_LINE,
  X5_NUMBERS,
  X5_NUMBER_MAX,
  X5_NUMBER_MIN,
  X5_SUM_BIG_LINE,
  X5_SUM_MAX,
  X5_SUM_MIN,
  X5_SUM_TAIL_BIG_LINE,
  X5_TOTAL_COMBOS
}

/** 預設回報率（同 6hc-cd / k3-cd / pk10-cd / ssc-cd 的信用盤慣例） */
export const X5_RTP_FALLBACK = 0.97

export type X5BetResult = 'win' | 'lose' | 'tie'
export type X5JudgeResult = {
  kind: X5Bet['kind']
  result: X5BetResult
  /** 賠率（含本金） */
  odds: number
  /** 派彩金額（含本金）；未中為 0 */
  payout: number
}

/** 單球的兩面 */
const SIDE_NAMES = ['大', '小', '單', '雙'] as const
type X5Side = (typeof SIDE_NAMES)[number]

/**
 * 總和的六面
 * ⚠️ 尾大／尾小是使用者拍板的規則（來源只有 playId、沒有名稱），
 *    門檻常數在 x5.ts 的 X5_SUM_TAIL_BIG_LINE，改規則只需動那一處。
 * ⚠️ 解析順序必須「尾大／尾小」優先於「大／小」，否則 `總和尾大` 會被切成 `尾大` 認不出來。
 */
const SUM_SIDE_NAMES = ['尾大', '尾小', '大', '小', '單', '雙'] as const
type X5SumSide = (typeof SUM_SIDE_NAMES)[number]

/**
 * 注碼描述（解析的唯一產物）
 * 機率與判定都只吃這個 descriptor —— 新增玩法只要動 `_parseBet` 與兩張表，
 * 兩支不會各自長分支而語意飄移（做法同 ssc-cd.ts）。
 */
type X5Bet =
  /** 1-5球單號：第一球07 */
  | { kind: 'ballNumber'; ball: number; num: number }
  /** 單球兩面：第一球大 */
  | { kind: 'ballSide'; ball: number; side: X5Side }
  /** 總和六面：總和大 / 總和尾大 */
  | { kind: 'sumSide'; side: X5SumSide }
  /** 全5中1：全中07（任一球開出該號） */
  | { kind: 'anyHit'; num: number }
  /** 龍虎鬥：龍虎12龍（無和局） */
  | { kind: 'dragon'; a: number; b: number; side: '龍' | '虎' }

/** 球位名稱 → index（0 起算）；不是球位前綴回 -1 */
function _ballOf(name: string): number {
  return X5_BALL_NAMES.indexOf(name as X5BallNameLoose)
}
type X5BallNameLoose = (typeof X5_BALL_NAMES)[number]

/** 是否為合法號碼（1 ~ 11） */
function _isNumber(num: number): boolean {
  return Number.isInteger(num) && num >= X5_NUMBER_MIN && num <= X5_NUMBER_MAX
}

/** 單球某一面是否符合（大小以 X5_BIG_LINE 判、單雙看奇偶） */
function _sideHit(side: X5Side, value: number): boolean {
  if (side === '大') return value >= X5_BIG_LINE
  if (side === '小') return value < X5_BIG_LINE
  if (side === '單') return value % 2 === 1
  return value % 2 === 0
}

/** 總和某一面是否符合 */
function _sumSideHit(side: X5SumSide, nums: number[]): boolean {
  const sum = x5SumOf(nums)
  if (side === '大') return sum >= X5_SUM_BIG_LINE
  if (side === '小') return sum < X5_SUM_BIG_LINE
  if (side === '單') return sum % 2 === 1
  if (side === '雙') return sum % 2 === 0
  const tail = x5SumTailOf(nums)
  if (side === '尾大') return tail >= X5_SUM_TAIL_BIG_LINE
  return tail < X5_SUM_TAIL_BIG_LINE
}

/**
 * 解析注碼
 * @returns descriptor；無法辨識回 null（呼叫端一律視為無效注碼，不可猜）
 */
function _parseBet(betCode: string | number): X5Bet | null {
  const code = String(betCode ?? '').trim()
  if (!code) return null

  // ── 龍虎鬥：龍虎12龍 ──
  const dragon = /^龍虎([1-5])([1-5])(龍|虎)$/.exec(code)
  if (dragon) {
    const a = Number(dragon[1]) - 1
    const b = Number(dragon[2]) - 1
    // 必須遞增且相異，同一組對戰才只有一種寫法
    if (!(a < b)) return null
    return { kind: 'dragon', a, b, side: dragon[3] as '龍' | '虎' }
  }

  // ── 全5中1：全中07 ──
  if (code.startsWith('全中')) {
    const num = Number(code.slice(2))
    return _isNumber(num) ? { kind: 'anyHit', num } : null
  }

  // ── 總和六面：總和大 / 總和尾大 ──
  if (code.startsWith('總和')) {
    const rest = code.slice(2)
    const side = SUM_SIDE_NAMES.find((s) => s === rest)
    return side ? { kind: 'sumSide', side } : null
  }

  // ── 1-5球：第一球07 / 第一球大 ──
  for (const name of X5_BALL_NAMES) {
    if (!code.startsWith(name)) continue
    const rest = code.slice(name.length)
    const ball = _ballOf(name)
    const side = SIDE_NAMES.find((s) => s === rest)
    if (side) return { kind: 'ballSide', ball, side }
    // 號碼一律兩位數（01 ~ 11），但單位數寫法（第一球7）也吃得下
    if (/^\d{1,2}$/.test(rest)) {
      const num = Number(rest)
      return _isNumber(num) ? { kind: 'ballNumber', ball, num } : null
    }
    return null
  }

  return null
}

// ── 機率（賠率推導的唯一來源）──────────────────────────────────────────────

/** 單球某一面的命中數（1 ~ 11 中：大 5／小 6／單 6／雙 5） */
function _ballSideHit(side: X5Side): number {
  return X5_NUMBERS.reduce((acc, num) => (_sideHit(side, num) ? acc + 1 : acc), 0)
}

/**
 * 注碼的樣本空間
 * @returns { hit, total }；注碼無法辨識回 null
 */
export function x5ChanceOf(betCode: string | number): X5Chance | null {
  const bet = _parseBet(betCode)
  if (!bet) return null
  const BALL_TOTAL = X5_NUMBERS.length
  switch (bet.kind) {
    // 任一球位落在任一號碼的機率都是 1/11（邊際均勻）
    case 'ballNumber':
      return { hit: 1, total: BALL_TOTAL }
    case 'ballSide':
      return { hit: _ballSideHit(bet.side), total: BALL_TOTAL }
    // 總和是 5 碼的集合性質，號碼不獨立 → 必須窮舉 462 種組合
    case 'sumSide':
      return { hit: x5ComboHits((combo) => _sumSideHit(bet.side, combo)), total: X5_TOTAL_COMBOS }
    // 該號碼出現在 5 碼中 = C(10,4)/C(11,5) = 210/462（等於 5/11）
    case 'anyHit':
      return { hit: x5ComboHits((combo) => combo.includes(bet.num)), total: X5_TOTAL_COMBOS }
    // 兩球位比大小：對稱，各 1/2（不重複故無和局）
    case 'dragon':
      return { hit: 1, total: 2 }
  }
}

/**
 * 注碼是否命中（判定的唯一入口，賠率與結算都靠它）
 * @returns true 命中／false 未命中／null 注碼或開獎格式不合
 */
export function x5IsHit(betCode: string | number, openCode: Array<string | number>): boolean | null {
  const nums = x5NumbersOf(openCode)
  if (!nums) return null
  const bet = _parseBet(betCode)
  if (!bet) return null

  switch (bet.kind) {
    case 'ballNumber':
      return nums[bet.ball] === bet.num
    case 'ballSide': {
      const value = nums[bet.ball]
      return value === undefined ? null : _sideHit(bet.side, value)
    }
    case 'sumSide':
      return _sumSideHit(bet.side, nums)
    case 'anyHit':
      return nums.includes(bet.num)
    case 'dragon': {
      const result = x5DragonOf(nums, bet.a, bet.b)
      // 開獎資料異常（兩球同號）時 x5DragonOf 回 null，一律當成無法判定
      return result === null ? null : result === bet.side
    }
  }
}

/** 注碼種類（供前端分群顯示與統計）；無法辨識回 null */
export function x5KindOf(betCode: string | number): X5Bet['kind'] | null {
  return _parseBet(betCode)?.kind ?? null
}

/**
 * 取注項賠率（含本金）
 * @returns 賠率（無條件捨去到小數 2 位，避免浮點多給）；無法辨識回 0
 */
export function x5OddsOf(betCode: string | number, rtp: number = X5_RTP_FALLBACK): number {
  const chance = x5ChanceOf(betCode)
  if (!chance || !(chance.hit > 0) || !(chance.total > 0)) return 0
  const safeRtp = Number.isFinite(rtp) && rtp > 0 ? rtp : X5_RTP_FALLBACK
  return Math.floor((chance.total / chance.hit) * safeRtp * 100) / 100
}

/**
 * 11選5 中獎判定
 * @param odds 下注時鎖定的賠率；未帶（或 ≤ 0）則以 rtp 即時推算
 * @returns 判定結果；注碼無法辨識或開獎格式不合回 null（呼叫端應視為和局退還本金）
 */
export function judgeX5Bet(
  betCode: string | number,
  openCode: Array<string | number>,
  coin: number,
  odds: number = 0,
  rtp: number = X5_RTP_FALLBACK
): X5JudgeResult | null {
  const hit = x5IsHit(betCode, openCode)
  if (hit === null) return null
  const kind = x5KindOf(betCode)
  if (!kind) return null

  const lockedOdds = Number(odds) > 0 ? Number(odds) : x5OddsOf(betCode, rtp)
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

// ── 爆池（兩個盤口共吃一池，與官方盤的共用彩池是兩個獨立的池） ──────────

/**
 * 11選5 的爆池設定（信用盤與官方盤共吃這一池）
 *
 * ── 爆池期怎麼定 ────────────────────────────────────────
 *   開出的 **5 個號碼全為奇數，或全為偶數**時觸發。
 *   機率 7/462 ≒ 1.5152%（全單 C(6,5)=6 種、全雙 C(5,5)=1 種），
 *   與 6hc-cd 的「特別號開 49」（1/49 ≒ 2.04%）、ssc-cd 的「後三豹子」（1%）同一個量級。
 *
 *   ⚠️ 為什麼不是「挑一個罕見注項」——
 *      k3-cd.ts:336-345 訂的第一條標準是「必須是看板上真的押得到的注項」，
 *      但 11x5-CD 的看板（1-5球／兩面／龍虎鬥／全5中1）**沒有任何注項落在 1~2% 量級**，
 *      最罕見的是單球某號碼 1/11 = 9.09%。eggs 那套「爆池條件 = 豹子這個現成注項」
 *      的做法在這裡不可用，因此改採「看板注項的單／雙**概念**所組成的開獎特徵」。
 *
 *   ⚠️ 為什麼是單雙而不是大小（兩者機率都是 7/462）——
 *      單雙的界定（奇偶）不依賴任何門檻常數，大小則依賴 X5_BIG_LINE = 7；
 *      爆池條件綁在「不會因為門檻調整而改變」的性質上比較穩。
 *
 *   ⚠️ 沒有「雙重加成」問題：eggs／k3／ssc 的爆池條件同時是 weight 最高的注項
 *      （押中者拿賠率又拿最大份），本條件不對應任何單一注項，
 *      所以 x5cd/plays.js 不需要任何 `weight: 0` 的排除。
 *
 * ── 抽水是額外的一份 ────────────────────────────────────
 *   ⚠️ 兩個盤口原本就各自抽水進「共用彩池」（x5Shared.pool，官方盤直選在吃）；
 *      這裡的 rakeRatio 是**另外**再撥一份進爆池，兩者不互相吃。
 */
export const X5_JACKPOT_SETTINGS: JackpotSettings = {
  rakeRatio: 0.01,
  payoutRatio: 0.5,
  /** 以 rakeRatio 1% 換算 ≈ 需累積 10 萬投注額 */
  minPool: 1000,
  /** 注單查不到看板設定時的保底權重（設定檔的 weight 都有值，這裡只是保險） */
  weightFallback: 1,
  /**
   * 盤口係數：信用盤與官方盤的注單放進同一個爆池分配時，各自再乘上這個值
   * 預設 1:1 —— 即接受「CD 的難注項 ≈ OF 的難注項」這個等價假設
   */
  boardWeight: { cd: 1, of: 1 },
  hitLabel: '五球全開單或全開雙',
  hitRate: 7 / 462
}

/**
 * 這一期是不是爆池期
 * @returns true = 五碼全單或全雙；開獎格式不合回 false
 */
export function x5JackpotHit(openCode: Array<string | number>): boolean {
  const nums = x5NumbersOf(openCode)
  if (!nums) return false
  return x5ParityAllOf(nums) !== null
}

/** 爆池期的開獎文字（寫進爆池紀錄，給看板顯示用） */
export function x5JackpotLabel(openCode: Array<string | number>): string {
  const nums = x5NumbersOf(openCode)
  if (!nums) return ''
  const parity = x5ParityAllOf(nums)
  if (!parity) return ''
  return `${parity} ${nums.map((num) => x5NumberLabel(num)).join(' ')}`
}

/** 玩法定義（順序即前端玩法列的顯示順序，需與 x5cd/plays.js 一致） */
export const X5_PLAY_DEFINITIONS: Array<{ key: string; name: string }> = [
  { key: 'ball', name: '1-5球' },
  { key: 'liangmian', name: '兩面' },
  { key: 'longhu', name: '龍虎鬥' },
  { key: 'quan5', name: '全5中1' }
]
