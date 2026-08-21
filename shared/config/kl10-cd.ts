/**
 * 快樂十分（KL10）判定與賠率核心
 *
 * 賠率一律由「公平賠率 × RTP」推導，不寫死拍板數字：
 *   公平賠率 = 該注項的母數 ÷ 命中數（機率由 shared/config/kl10.ts 建表／邊際分布而來）
 *
 * ── 玩法（對照 bglottery kl10 的 4 個 config，4 個玩法分頁）──────────────
 *   正和    第一球01 ~ 第八球20                       母數 20（邊際分布）
 *           第一球大/小/單/雙/合單/合雙/尾大/尾小      母數 20
 *   龍虎鬥  龍虎12龍 ~ 龍虎78虎（C(8,2)=28 組球對）    母數 2
 *   任選    任一中一 ~ 任五中五（一注 N 碼）           母數 C(20,N)
 *   兩面    總和大/小/單/雙/尾大/尾小                  母數 C(20,8)=125,970
 *           上盤/上下和/下盤、奇盤/奇偶和/偶盤          母數 C(20,8)=125,970
 *
 * ⚠️ 為什麼母數不只一種：見 shared/config/kl10.ts 檔頭的對照表。
 * ⚠️ 快樂十分**只有信用盤**（來源 bglottery `kl10/` 無 official 子目錄），
 *    檔名雖沿用 `-cd` 後綴（與其他彩種一致），但不存在對應的 `kl10-of.ts`。
 * ⚠️ 本檔不讀設定檔；需要 rtp 由呼叫端傳入。
 *    不可 import kl10cd/helpers（helpers 會 import 本檔，會形成循環）。
 *
 * ── 和局 ────────────────────────────────────────────────
 *   開 8 個**不重複**號碼，龍虎鬥兩球位不可能相等 → 沒有「和」注項；
 *   上下盤／奇偶盤的「和盤」是**可以押的注項**（4:4），不是退本金的和局。
 *   `tie` 只保留給呼叫端在注碼無法辨識時退還本金。
 */
import { type JackpotSettings } from '#shared/config/jackpot'
import {
  kl10ChooseCount,
  kl10DigitSumOf,
  kl10DragonOf,
  kl10HalfSplitHits,
  kl10IsLopsidedParity,
  kl10LowCountOf,
  kl10NumberLabel,
  kl10NumbersOf,
  kl10OddCountOf,
  kl10ParityZoneOf,
  kl10SumHits,
  kl10SumOf,
  kl10SumTailOf,
  kl10ZoneOf,
  KL10_BALL_COUNT,
  KL10_BALL_NAMES,
  KL10_BIG_LINE,
  KL10_HALF_LINE,
  KL10_JACKPOT_LOPSIDED_MIN,
  KL10_NUMBERS,
  KL10_NUMBER_MAX,
  KL10_NUMBER_MIN,
  KL10_SUM_BIG_LINE,
  KL10_SUM_MAX,
  KL10_SUM_MIN,
  KL10_SUM_TAIL_BIG_LINE,
  KL10_TAIL_BIG_LINE,
  KL10_TOTAL_COMBOS,
  type Kl10BallName,
  type Kl10Chance,
  type Kl10ParityZone,
  type Kl10Zone
} from '#shared/config/kl10'

export {
  kl10DigitSumOf,
  kl10DragonOf,
  kl10LowCountOf,
  kl10NumberLabel,
  kl10NumbersOf,
  kl10OddCountOf,
  kl10ParityZoneOf,
  kl10SumOf,
  kl10SumTailOf,
  kl10ZoneOf,
  KL10_BALL_COUNT,
  KL10_BALL_NAMES,
  KL10_BIG_LINE,
  KL10_HALF_LINE,
  KL10_NUMBERS,
  KL10_NUMBER_MAX,
  KL10_NUMBER_MIN,
  KL10_SUM_BIG_LINE,
  KL10_SUM_MAX,
  KL10_SUM_MIN,
  KL10_SUM_TAIL_BIG_LINE,
  KL10_TAIL_BIG_LINE,
  KL10_TOTAL_COMBOS
}

/** 預設回報率（同 6hc-cd / k3-cd / ssc-cd / x5-cd / eggs 的信用盤慣例） */
export const KL10_RTP_FALLBACK = 0.97

export type Kl10BetResult = 'win' | 'lose' | 'tie'
export type Kl10JudgeResult = {
  kind: Kl10Bet['kind']
  result: Kl10BetResult
  /** 賠率（含本金） */
  odds: number
  /** 派彩金額（含本金）；未中為 0 */
  payout: number
}

/**
 * 單球的八面（正和分頁）
 * ⚠️ 一律用「完全相等」比對 `rest`，不用 startsWith —— 否則「合單」會先被「單」吃掉。
 */
const BALL_SIDE_NAMES = ['大', '小', '單', '雙', '合單', '合雙', '尾大', '尾小'] as const
type Kl10BallSide = (typeof BALL_SIDE_NAMES)[number]

/** 總和的六面（兩面分頁） */
const SUM_SIDE_NAMES = ['大', '小', '單', '雙', '尾大', '尾小'] as const
type Kl10SumSide = (typeof SUM_SIDE_NAMES)[number]

/**
 * 任選的 5 個分頁（來源 `renxuan/config_play.js` 的 playTypeName）
 * `pick` = 一注幾個號碼，也就是複式展開時的組合大小（來源 `doCalcCombination(selected, minChosen)`）
 */
export const KL10_RENXUAN_DEFINITIONS = [
  { name: '任一中一', pick: 1 },
  { name: '任二中二', pick: 2 },
  { name: '任三中三', pick: 3 },
  { name: '任四中四', pick: 4 },
  { name: '任五中五', pick: 5 }
] as const
export type Kl10RenxuanName = (typeof KL10_RENXUAN_DEFINITIONS)[number]['name']

/**
 * 上下盤／奇偶盤的注碼
 * ⚠️ 來源看板兩組**各有一個叫「和盤」的注項**（`liangmian/config.js` 的 132131111 與 132131211），
 *    注碼必須唯一，所以本專案改成 `上下和` / `奇偶和`；看板顯示也用同一個字串，
 *    避免「畫面寫和盤、注單寫上下和」兩套名字。
 */
const ZONE_CODES: Record<string, Kl10Zone> = { 上盤: '上盤', 上下和: '和盤', 下盤: '下盤' }
const PARITY_ZONE_CODES: Record<string, Kl10ParityZone> = { 奇盤: '奇盤', 奇偶和: '和盤', 偶盤: '偶盤' }

/**
 * 注碼描述（解析的唯一產物）
 * 機率與判定都只吃這個 descriptor —— 新增玩法只要動 `_parseBet` 與兩張表，
 * 兩支不會各自長分支而語意飄移（做法同 ssc-cd.ts / x5-cd.ts）。
 */
type Kl10Bet =
  /** 正和單碼：第一球07 */
  | { kind: 'ballNumber'; ball: number; num: number }
  /** 正和兩面：第一球合單 */
  | { kind: 'ballSide'; ball: number; side: Kl10BallSide }
  /** 龍虎鬥：龍虎12龍（無和局） */
  | { kind: 'dragon'; a: number; b: number; side: '龍' | '虎' }
  /** 任選：任三中三03,07,15（一注 N 碼，全中才算中） */
  | { kind: 'renxuan'; pick: number; nums: number[] }
  /** 兩面總和六面：總和大 / 總和尾大 */
  | { kind: 'sumSide'; side: Kl10SumSide }
  /** 兩面上下盤：上盤 / 上下和 / 下盤 */
  | { kind: 'zone'; side: Kl10Zone }
  /** 兩面奇偶盤：奇盤 / 奇偶和 / 偶盤 */
  | { kind: 'parityZone'; side: Kl10ParityZone }

/** 球位名稱 → index（0 起算）；不是球位前綴回 -1 */
function _ballOf(name: string): number {
  return KL10_BALL_NAMES.indexOf(name as Kl10BallName)
}

/** 是否為合法號碼（1 ~ 20） */
function _isNumber(num: number): boolean {
  return Number.isInteger(num) && num >= KL10_NUMBER_MIN && num <= KL10_NUMBER_MAX
}

/** 單球某一面是否符合（大小以 KL10_BIG_LINE 判、尾數以 KL10_TAIL_BIG_LINE 判、合數看十位+個位） */
function _ballSideHit(side: Kl10BallSide, value: number): boolean {
  if (side === '大') return value >= KL10_BIG_LINE
  if (side === '小') return value < KL10_BIG_LINE
  if (side === '單') return value % 2 === 1
  if (side === '雙') return value % 2 === 0
  if (side === '合單') return kl10DigitSumOf(value) % 2 === 1
  if (side === '合雙') return kl10DigitSumOf(value) % 2 === 0
  if (side === '尾大') return value % 10 >= KL10_TAIL_BIG_LINE
  return value % 10 < KL10_TAIL_BIG_LINE
}

/** 總和某一面是否符合（只吃總和，不需要原始號碼） */
function _sumSideHit(side: Kl10SumSide, sum: number): boolean {
  if (side === '大') return sum >= KL10_SUM_BIG_LINE
  if (side === '小') return sum < KL10_SUM_BIG_LINE
  if (side === '單') return sum % 2 === 1
  if (side === '雙') return sum % 2 === 0
  if (side === '尾大') return sum % 10 >= KL10_SUM_TAIL_BIG_LINE
  return sum % 10 < KL10_SUM_TAIL_BIG_LINE
}

/**
 * 「一半的個數」是否符合上下盤／奇偶盤的某一面
 * 上盤／奇盤＝該半超過一半球數、和盤＝剛好一半（4:4）、下盤／偶盤＝不足一半
 */
function _zoneHitByCount(side: Kl10Zone | Kl10ParityZone, count: number): boolean {
  const other = KL10_BALL_COUNT - count
  if (side === '上盤' || side === '奇盤') return count > other
  if (side === '下盤' || side === '偶盤') return count < other
  return count === other
}

/**
 * 解析注碼
 * @returns descriptor；無法辨識回 null（呼叫端一律視為無效注碼，不可猜）
 */
function _parseBet(betCode: string | number): Kl10Bet | null {
  const code = String(betCode ?? '').trim()
  if (!code) return null

  // ── 龍虎鬥：龍虎12龍 ──
  const dragon = /^龍虎([1-8])([1-8])(龍|虎)$/.exec(code)
  if (dragon) {
    const a = Number(dragon[1]) - 1
    const b = Number(dragon[2]) - 1
    // 必須遞增且相異，同一組對戰才只有一種寫法
    if (!(a < b)) return null
    return { kind: 'dragon', a, b, side: dragon[3] as '龍' | '虎' }
  }

  // ── 任選：任三中三03,07,15 ──
  for (const play of KL10_RENXUAN_DEFINITIONS) {
    if (!code.startsWith(play.name)) continue
    const rest = code.slice(play.name.length)
    if (!/^\d{1,2}(,\d{1,2})*$/.test(rest)) return null
    const nums = rest.split(',').map((text) => Number(text))
    // 個數必須等於該分頁的 N，且號碼合法、不重複（送單前後都靠這裡守）
    if (nums.length !== play.pick) return null
    if (nums.some((num) => !_isNumber(num))) return null
    if (new Set(nums).size !== nums.length) return null
    return { kind: 'renxuan', pick: play.pick, nums }
  }

  // ── 兩面總和六面：總和大 / 總和尾大 ──
  if (code.startsWith('總和')) {
    const rest = code.slice(2)
    const side = SUM_SIDE_NAMES.find((name) => name === rest)
    return side ? { kind: 'sumSide', side } : null
  }

  // ── 兩面上下盤 / 奇偶盤 ──
  const zone = ZONE_CODES[code]
  if (zone) return { kind: 'zone', side: zone }
  const parityZone = PARITY_ZONE_CODES[code]
  if (parityZone) return { kind: 'parityZone', side: parityZone }

  // ── 正和：第一球07 / 第一球合單 ──
  for (const name of KL10_BALL_NAMES) {
    if (!code.startsWith(name)) continue
    const rest = code.slice(name.length)
    const ball = _ballOf(name)
    const side = BALL_SIDE_NAMES.find((item) => item === rest)
    if (side) return { kind: 'ballSide', ball, side }
    // 號碼一律兩位數（01 ~ 20），但單位數寫法（第一球7）也吃得下
    if (/^\d{1,2}$/.test(rest)) {
      const num = Number(rest)
      return _isNumber(num) ? { kind: 'ballNumber', ball, num } : null
    }
    return null
  }

  return null
}

// ── 機率（賠率推導的唯一來源）──────────────────────────────────────────────

/** 單球某一面的命中數（1 ~ 20 中：八面各 10 個，故都是 10/20） */
function _ballSideHitCount(side: Kl10BallSide): number {
  return KL10_NUMBERS.reduce((acc, num) => (_ballSideHit(side, num) ? acc + 1 : acc), 0)
}

/**
 * 注碼的樣本空間
 * @returns { hit, total }；注碼無法辨識回 null
 */
export function kl10ChanceOf(betCode: string | number): Kl10Chance | null {
  const bet = _parseBet(betCode)
  if (!bet) return null
  const BALL_TOTAL = KL10_NUMBERS.length
  switch (bet.kind) {
    // 任一球位落在任一號碼的機率都是 1/20（邊際均勻）
    case 'ballNumber':
      return { hit: 1, total: BALL_TOTAL }
    case 'ballSide':
      return { hit: _ballSideHitCount(bet.side), total: BALL_TOTAL }
    // 兩球位比大小：對稱，各 1/2（不重複故無和局）
    case 'dragon':
      return { hit: 1, total: 2 }
    // 任選 N 中 N：所選 N 碼全部落在 8 個開獎號內 = C(8,N) / C(20,N)
    case 'renxuan':
      return {
        hit: kl10ChooseCount(KL10_BALL_COUNT, bet.pick),
        total: kl10ChooseCount(KL10_NUMBER_MAX, bet.pick)
      }
    // 總和是 8 碼的集合性質，號碼不獨立 → 讀 kl10SumCounts() 建好的表
    case 'sumSide':
      return { hit: kl10SumHits((sum) => _sumSideHit(bet.side, sum)), total: KL10_TOTAL_COMBOS }
    // 上下盤／奇偶盤都是「10 對 10」的分割，共用 kl10HalfSplitCounts()
    case 'zone':
    case 'parityZone':
      return {
        hit: kl10HalfSplitHits((count) => _zoneHitByCount(bet.side, count)),
        total: KL10_TOTAL_COMBOS
      }
  }
}

/**
 * 注碼是否命中（判定的唯一入口，賠率與結算都靠它）
 * @returns true 命中／false 未命中／null 注碼或開獎格式不合
 */
export function kl10IsHit(betCode: string | number, openCode: Array<string | number>): boolean | null {
  const nums = kl10NumbersOf(openCode)
  if (!nums) return null
  const bet = _parseBet(betCode)
  if (!bet) return null

  switch (bet.kind) {
    case 'ballNumber':
      return nums[bet.ball] === bet.num
    case 'ballSide': {
      const value = nums[bet.ball]
      return value === undefined ? null : _ballSideHit(bet.side, value)
    }
    case 'dragon': {
      const result = kl10DragonOf(nums, bet.a, bet.b)
      // 開獎資料異常（兩球同號）時 kl10DragonOf 回 null，一律當成無法判定
      return result === null ? null : result === bet.side
    }
    // 任選沒有部分中獎：N 碼要全部出現在 8 個開獎號內
    case 'renxuan':
      return bet.nums.every((num) => nums.includes(num))
    case 'sumSide':
      return _sumSideHit(bet.side, kl10SumOf(nums))
    case 'zone':
      return kl10ZoneOf(nums) === bet.side
    case 'parityZone':
      return kl10ParityZoneOf(nums) === bet.side
  }
}

/** 注碼種類（供前端分群顯示與統計）；無法辨識回 null */
export function kl10KindOf(betCode: string | number): Kl10Bet['kind'] | null {
  return _parseBet(betCode)?.kind ?? null
}

/**
 * 任選分頁的注碼樣板（例：pick 3 → `任三中三01,02,03`）
 *
 * 任選的賠率只跟「一注幾碼」有關、與挑哪幾個號碼無關（C(8,N)/C(20,N)），
 * 所以看板要顯示整個分頁的賠率時用這支組一個代表性注碼即可。
 * @returns 注碼；pick 不在 1~5 回空字串
 */
export function kl10RenxuanSampleCode(pick: number): string {
  const play = KL10_RENXUAN_DEFINITIONS.find((item) => item.pick === Number(pick))
  if (!play) return ''
  const nums = Array.from({ length: play.pick }, (_, i) => kl10NumberLabel(KL10_NUMBER_MIN + i))
  return `${play.name}${nums.join(',')}`
}

/**
 * 取注項賠率（含本金）
 * @returns 賠率（無條件捨去到小數 2 位，避免浮點多給）；無法辨識回 0
 */
export function kl10OddsOf(betCode: string | number, rtp: number = KL10_RTP_FALLBACK): number {
  const chance = kl10ChanceOf(betCode)
  if (!chance || !(chance.hit > 0) || !(chance.total > 0)) return 0
  const safeRtp = Number.isFinite(rtp) && rtp > 0 ? rtp : KL10_RTP_FALLBACK
  return Math.floor((chance.total / chance.hit) * safeRtp * 100) / 100
}

/**
 * 快樂十分中獎判定
 * @param odds 下注時鎖定的賠率；未帶（或 ≤ 0）則以 rtp 即時推算
 * @returns 判定結果；注碼無法辨識或開獎格式不合回 null（呼叫端應視為和局退還本金）
 */
export function judgeKl10Bet(
  betCode: string | number,
  openCode: Array<string | number>,
  coin: number,
  odds: number = 0,
  rtp: number = KL10_RTP_FALLBACK
): Kl10JudgeResult | null {
  const hit = kl10IsHit(betCode, openCode)
  if (hit === null) return null
  const kind = kl10KindOf(betCode)
  if (!kind) return null

  const lockedOdds = Number(odds) > 0 ? Number(odds) : kl10OddsOf(betCode, rtp)
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

// ── 爆池（抽水入池 + 奇偶一邊倒時發放） ─────────────────────────────

/**
 * 快樂十分的爆池設定
 *
 * ── 爆池期怎麼定（使用者於提案階段拍板）────────────────
 *   當期 8 個號碼中**奇數 ≥ 7 個或偶數 ≥ 7 個**時觸發。
 *   機率 2,490/125,970 ≒ 1.9767%（奇 8:0 有 45 種、7:1 有 1,200 種，偶數側對稱），
 *   與 6hc-cd 的「特別號開 49」（1/49 ≒ 2.04%）同一個量級。
 *
 *   ⚠️ 為什麼不挑一個現成注項當條件（eggs 用豹子、k3 用圍骰的做法）——
 *      看板上最罕見的**靜態**注項是正和單碼 1/20 = 5%，量級不對；
 *      任選雖有任四中四 1.44%、任五中五 0.36%，但那是**注單**的中獎率、不是開獎特徵
 *      （任何一期都必然存在 C(8,4)=70 組會中的任四中四），不能當爆池期判準。
 *      因此改採「看板注項的奇偶**概念**所組成的開獎特徵」，做法同 x5-cd.ts。
 *
 *   ⚠️ 為什麼是奇偶而不是上下（兩者機率完全相同，各 2,490）——
 *      奇偶只依賴號碼本身的奇偶性，不依賴任何門檻常數；
 *      上下盤依賴 KL10_HALF_LINE = 10 這條半分線。條件綁在不會被門檻調整影響的性質上比較穩。
 *
 *   ⚠️ 為什麼不是「全奇或全偶」（8:0）—— 只有 90/125,970 ≒ 0.0714%，
 *      比基準低 28 倍，平均 1,400 期才觸發一次，池會養到失控。
 *
 *   ⚠️ 沒有「雙重加成」問題：本條件不對應任何單一注項
 *      （eggs／k3／ssc 的爆池條件同時是 weight 最高的注項，押中者拿賠率又拿最大份），
 *      所以 kl10cd/plays.js 不需要任何 `weight: 0` 的排除。
 *
 * ── 與其他彩種的差異：只有一個池 ────────────────────────
 *   k3 / pk10 / ssc / x5 都有「官方盤分層用的共用彩池」與「爆池」兩個池，註解裡反覆警告不能互吃；
 *   快樂十分沒有官方盤、沒有 Shared 層，**只有爆池這一個池**（同 PC蛋蛋），那組風險不存在。
 *   也因為只有一個盤口，不需要那套「等所有盤口交件才結算」的編排，直接在 class 內結算即可。
 *
 * ⚠️ boardWeight 只列 cd —— 快樂十分沒有官方盤，這個係數在這裡等於不作用。
 */
export const KL10_JACKPOT_SETTINGS: JackpotSettings = {
  rakeRatio: 0.01,
  payoutRatio: 0.5,
  /** 以 rakeRatio 1% 換算 ≈ 需累積 10 萬投注額 */
  minPool: 1000,
  /** 注單查不到看板設定時的保底權重（設定檔的 weight 都有值，這裡只是保險） */
  weightFallback: 1,
  boardWeight: { cd: 1 },
  hitLabel: `開出奇偶一邊倒（8 球中奇數或偶數佔 ${KL10_JACKPOT_LOPSIDED_MIN} 個以上）`,
  hitRate: 2490 / KL10_TOTAL_COMBOS
}

/**
 * 爆池起始池底（僅開站時 seed 一次到 carryJackpot，之後照既有機制自然累積／發放）
 *
 * ⚠️ 不可比照彩池玩法（KL10_POOL_BASE_MIN/MAX）那樣「每期都重新加回去」——
 *    爆池的公式（buildJackpotShares）沒有彩池玩法那個 0.55 阻尼係數，
 *    若每期都持續疊加一筆固定池底，滾存會無界成長（幾百期後爆炸成天文數字）。
 *    因此這裡只在建構子執行一次性 seed，之後池底就融進 carryJackpot 自然演化，
 *    範圍比照彩池玩法（獨立宣告，不共用同一組常數）。
 */
export const KL10_JACKPOT_BASE_MIN = 110_000
export const KL10_JACKPOT_BASE_MAX = 450_000

/**
 * 這一期是不是爆池期
 * @returns true = 奇偶一邊倒；開獎格式不合回 false
 */
export function kl10JackpotHit(openCode: Array<string | number>): boolean {
  const nums = kl10NumbersOf(openCode)
  if (!nums) return false
  return kl10IsLopsidedParity(nums)
}

/** 爆池期的開獎文字（寫進爆池紀錄，給看板顯示用） */
export function kl10JackpotLabel(openCode: Array<string | number>): string {
  const nums = kl10NumbersOf(openCode)
  if (!nums) return ''
  if (!kl10IsLopsidedParity(nums)) return ''
  const odd = kl10OddCountOf(nums)
  const label = nums.map((num) => kl10NumberLabel(num)).join(' ')
  return `奇${odd}偶${KL10_BALL_COUNT - odd} ${label}`
}

/** 玩法定義（順序即前端玩法列的顯示順序，需與 kl10cd/plays.js 一致） */
export const KL10_PLAY_DEFINITIONS: Array<{ key: string; name: string }> = [
  { key: 'zhenghe', name: '正和' },
  { key: 'longhu', name: '龍虎鬥' },
  { key: 'renxuan', name: '任選' },
  { key: 'liangmian', name: '兩面' }
]

// ── 彩池玩法（選號，比照 k3-of 的「選號」xuanhao：依命中顆數分層、依下注比例分錢） ──────────
//
// ⚠️ 這是本專案自己設計的機制（比照 k3-of，非 bglottery 來源），與現有爆池（上方
//    KL10_JACKPOT_SETTINGS）是兩個完全獨立的池：各自的池底／抽水／滾存互不影響，
//    只是兩者都從同一筆下注金額抽水、且彩池玩法的注單也會一併參與現有爆池分配
//    （見 server/services/game/lottery/bg/kl10.ts）。
// ⚠️ 跟「任選」不同：任選是全中才算中（kl10IsHit 的 all-or-nothing），彩池玩法是
//    依命中顆數分層，兩者判定邏輯完全獨立，不共用 _parseBet／kl10IsHit。

export type PoolPrizeTier =
  | { match: number; type: 'pool'; ratio: number; minAmount?: number; name: string }
  | { match: number; type: 'fixed'; amount: number; name: string }

/** sentinel playKey：這個玩法刻意不進 kl10cd/plays.js 的看板網格，比照 k3-of 的 xuanhao */
export const KL10_POOL_PLAY_KEY = 'xuanhao'
/**
 * 選 4 個號碼（1~20，不重複）。用超幾何分布驗證過：任選 4 碼對中 8 個開獎號，
 * 全中機率 1.445%，與 k3-of 全體平均全中機率（1.79%）同量級；因開獎本身不重複，
 * 任何 4 碼組合的命中分布完全相同（不像 eggs/k3 有選型機率落差），見 design.md。
 */
export const KL10_POOL_PICK_COUNT = 4
/** 查不到看板 weight 時的 fallback（比照 K3_OF_POOL_PLAY_WEIGHT），讓這個玩法也能參與既有爆池 */
export const KL10_POOL_PLAY_WEIGHT = 3

/** 池底範圍：使用者拍板比照 k3 的數值範圍，但獨立宣告成 KL10 自己的常數，不 import K3 的 */
export const KL10_POOL_BASE_MIN = 110_000
export const KL10_POOL_BASE_MAX = 450_000
/** 抽水比例：比照 K3_RAKE_RATIO（信用盤 2%），與既有爆池的 1% 是兩條並行的水 */
export const KL10_POOL_RAKE_RATIO = 0.02

/** 硬編碼額度（比照 K3_OF_QUOTA，這個玩法沒有看板設定可查） */
export const KL10_POOL_QUOTA = { item: { min: 2, max: 10000 }, issue: { max: 500000 } }

/**
 * 分層派彩表（比照 K3_OF_PRIZE_TIERS 的 70/20/固定倍數比例，見 design.md 的機率驗證）
 * 命中門檻依 KL10_POOL_PICK_COUNT(4) 設計：全中(4)/中3/中2
 */
export const KL10_POOL_PRIZE_TIERS: PoolPrizeTier[] = [
  { match: 4, type: 'pool', ratio: 0.70, minAmount: 20000, name: '頭獎' },
  { match: 3, type: 'pool', ratio: 0.20, name: '二獎' },
  { match: 2, type: 'fixed', amount: 2, name: '三獎' }
]

/** 池底重骰門檻：可派發金額低於「頭獎保底 ÷ 頭獎 ratio」時視為不足（比照 K3_POOL_FLOOR 的算法） */
export const KL10_POOL_FLOOR = (() => {
  const top = KL10_POOL_PRIZE_TIERS.find((tier) => tier.type === 'pool' && tier.minAmount !== undefined)
  return top && top.type === 'pool' && top.minAmount ? Math.ceil(top.minAmount / top.ratio) : 0
})()

/**
 * 選號是否合法：4 碼、每碼 1~20、不重複
 * @returns 排序後的號碼陣列；不合法回 null
 */
export function kl10PoolPicksOf(codes: Array<string | number>): number[] | null {
  if (!Array.isArray(codes) || codes.length !== KL10_POOL_PICK_COUNT) return null
  const nums = codes.map((code) => Number(code))
  if (nums.some((num) => !Number.isInteger(num) || num < KL10_NUMBER_MIN || num > KL10_NUMBER_MAX)) return null
  if (new Set(nums).size !== nums.length) return null
  return [...nums].sort((a, b) => a - b)
}

/**
 * 命中顆數（picks 與開獎 8 號的集合交集；開獎本身不重複，不需要 multiset 邏輯）
 * @returns 0 ~ KL10_POOL_PICK_COUNT；開獎格式不合回 0
 */
export function kl10PoolMatchCount(picks: number[], openCode: Array<string | number>): number {
  const nums = kl10NumbersOf(openCode)
  if (!nums) return 0
  const drawn = new Set(nums)
  return picks.reduce((count, pick) => count + (drawn.has(pick) ? 1 : 0), 0)
}

/** 依命中顆數查對應的分層設定；未中（查不到）回 null */
export function kl10PoolTierOf(matchCount: number): PoolPrizeTier | null {
  return KL10_POOL_PRIZE_TIERS.find((tier) => tier.match === matchCount) ?? null
}
