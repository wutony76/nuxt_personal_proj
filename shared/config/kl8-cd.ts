/**
 * 快樂8（KL8）判定與賠率核心
 *
 * 賠率一律由「公平賠率 × RTP」推導，不寫死拍板數字：
 *   公平賠率 = 該注項的母數 ÷ 命中數（機率由 shared/config/kl8.ts 建表而來）
 *
 * ── 玩法（對照 bglottery kl8 的 2 個 config，2 個玩法分頁）──────────────
 *   任選    任一中一 ~ 任七中七（一注 N 碼）             母數 C(80,N)
 *   兩面    大/小/單/雙/大單/大雙/小單/小雙                母數 C(80,20)
 *           上盤/上下和/下盤、奇盤/奇偶和/偶盤             母數 C(80,20)
 *           金/木/水/火/土                               母數 C(80,20)
 *
 * ⚠️ kl8 只有 2 個分頁（沒有 kl10 的正和／龍虎鬥），但兩面多了「五行」一組。
 * ⚠️ 快樂8**只有信用盤**（來源 bglottery `kl8/` 無 official 子目錄），
 *    檔名雖沿用 `-cd` 後綴（與其他彩種一致），但不存在對應的 `kl8-of.ts`。
 * ⚠️ 本檔不讀設定檔；需要 rtp 由呼叫端傳入。
 *    不可 import kl8cd/helpers（helpers 會 import 本檔，會形成循環）。
 * ⚠️ `Kl8Chance` 的 hit/total 是 BigInt（見 kl8.ts 檔頭說明），本檔的 `kl8OddsOf` 只在
 *    算「賠率」這一步才轉成 Number——那一步只需要 ~15 位有效數字，精度足夠。
 *
 * ── 和局 ────────────────────────────────────────────────
 *   開 20 個**不重複**號碼；兩面的和值大小「無和局」（810 併入大，使用者拍板）；
 *   上下盤／奇偶盤的「和盤」是**可以押的注項**（10:10），不是退本金的和局。
 *   `null` 只保留給呼叫端在注碼無法辨識時退還本金。
 */
import { type JackpotSettings } from '#shared/config/jackpot'
import {
  kl8ChooseCount,
  kl8HalfSplitHits,
  kl8LowCountOf,
  kl8NumberLabel,
  kl8NumbersOf,
  kl8OddCountOf,
  kl8ParityZoneOf,
  kl8SumHits,
  kl8SumOf,
  kl8WuxingOf,
  kl8ZoneOf,
  KL8_BALL_COUNT,
  KL8_HALF_LINE,
  KL8_JACKPOT_LOPSIDED_MIN,
  KL8_NUMBERS,
  KL8_NUMBER_MAX,
  KL8_NUMBER_MIN,
  KL8_SUM_BIG_LINE,
  KL8_SUM_MAX,
  KL8_SUM_MIN,
  KL8_TOTAL_COMBOS,
  KL8_WUXING_BOUNDS,
  KL8_WUXING_NAMES,
  type Kl8Chance,
  type Kl8ParityZone,
  type Kl8Wuxing,
  type Kl8Zone
} from '#shared/config/kl8'

export {
  kl8LowCountOf,
  kl8NumberLabel,
  kl8NumbersOf,
  kl8OddCountOf,
  kl8ParityZoneOf,
  kl8SumOf,
  kl8WuxingOf,
  kl8ZoneOf,
  KL8_BALL_COUNT,
  KL8_HALF_LINE,
  KL8_NUMBERS,
  KL8_NUMBER_MAX,
  KL8_NUMBER_MIN,
  KL8_SUM_BIG_LINE,
  KL8_SUM_MAX,
  KL8_SUM_MIN,
  KL8_TOTAL_COMBOS,
  KL8_WUXING_BOUNDS,
  KL8_WUXING_NAMES
}

/** 預設回報率（同 6hc-cd / k3-cd / ssc-cd / x5-cd / eggs / kl10-cd 的信用盤慣例） */
export const KL8_RTP_FALLBACK = 0.97

export type Kl8BetResult = 'win' | 'lose' | 'tie'
export type Kl8JudgeResult = {
  kind: Kl8Bet['kind']
  result: Kl8BetResult
  /** 賠率（含本金） */
  odds: number
  /** 派彩金額（含本金）；未中為 0 */
  payout: number
}

/** 總和的八面（和值分組；無「尾大／尾小」——來源 `liangmian/config.js` 該組只有這 8 項） */
const SUM_SIDE_NAMES = ['大', '小', '單', '雙', '大單', '大雙', '小單', '小雙'] as const
type Kl8SumSide = (typeof SUM_SIDE_NAMES)[number]

/**
 * 任選的 7 個分頁（來源 `renxuan/config_play.js` 的 playTypeName）
 * `pick` = 一注幾個號碼，也就是複式展開時的組合大小（來源 `doCalcCombination(selected, minChosen)`）
 */
export const KL8_RENXUAN_DEFINITIONS = [
  { name: '任一中一', pick: 1 },
  { name: '任二中二', pick: 2 },
  { name: '任三中三', pick: 3 },
  { name: '任四中四', pick: 4 },
  { name: '任五中五', pick: 5 },
  { name: '任六中六', pick: 6 },
  { name: '任七中七', pick: 7 }
] as const
export type Kl8RenxuanName = (typeof KL8_RENXUAN_DEFINITIONS)[number]['name']

/**
 * 上下盤／奇偶盤的注碼
 * ⚠️ 來源看板兩組**各有一個叫「和盤」的注項**，注碼必須唯一，
 *    所以本專案改成 `上下和` / `奇偶和`（比照 kl10-cd.ts 同款處理）；
 *    看板顯示也用同一個字串，避免「畫面寫和盤、注單寫上下和」兩套名字。
 */
const ZONE_CODES: Record<string, Kl8Zone> = { 上盤: '上盤', 上下和: '和盤', 下盤: '下盤' }
const PARITY_ZONE_CODES: Record<string, Kl8ParityZone> = { 奇盤: '奇盤', 奇偶和: '和盤', 偶盤: '偶盤' }

/**
 * 注碼描述（解析的唯一產物）
 * 機率與判定都只吃這個 descriptor —— 新增玩法只要動 `_parseBet` 與對應表，
 * 兩支不會各自長分支而語意飄移（做法同 kl10-cd.ts / ssc-cd.ts / x5-cd.ts）。
 */
type Kl8Bet =
  /** 任選：任三中三03,07,15（一注 N 碼，全中才算中） */
  | { kind: 'renxuan'; pick: number; nums: number[] }
  /** 兩面和值八面：大 / 大單 / 小雙 */
  | { kind: 'sumSide'; side: Kl8SumSide }
  /** 兩面上下盤：上盤 / 上下和 / 下盤 */
  | { kind: 'zone'; side: Kl8Zone }
  /** 兩面奇偶盤：奇盤 / 奇偶和 / 偶盤 */
  | { kind: 'parityZone'; side: Kl8ParityZone }
  /** 兩面五行：金 / 木 / 水 / 火 / 土 */
  | { kind: 'wuxing'; side: Kl8Wuxing }

/** 是否為合法號碼（1 ~ 80） */
function _isNumber(num: number): boolean {
  return Number.isInteger(num) && num >= KL8_NUMBER_MIN && num <= KL8_NUMBER_MAX
}

/** 總和某一面是否符合（大小以 KL8_SUM_BIG_LINE 判，無和局；單雙看總和本身的奇偶） */
function _sumSideHit(side: Kl8SumSide, sum: number): boolean {
  const isBig = sum >= KL8_SUM_BIG_LINE
  const isOdd = sum % 2 === 1
  if (side === '大') return isBig
  if (side === '小') return !isBig
  if (side === '單') return isOdd
  if (side === '雙') return !isOdd
  if (side === '大單') return isBig && isOdd
  if (side === '大雙') return isBig && !isOdd
  if (side === '小單') return !isBig && isOdd
  return !isBig && !isOdd // 小雙
}

/**
 * 「一半的個數」是否符合上下盤／奇偶盤的某一面
 * 上盤／奇盤＝該半超過一半球數、和盤＝剛好一半（10:10）、下盤／偶盤＝不足一半
 */
function _zoneHitByCount(side: Kl8Zone | Kl8ParityZone, count: number): boolean {
  const other = KL8_BALL_COUNT - count
  if (side === '上盤' || side === '奇盤') return count > other
  if (side === '下盤' || side === '偶盤') return count < other
  return count === other
}

/**
 * 解析注碼
 * @returns descriptor；無法辨識回 null（呼叫端一律視為無效注碼，不可猜）
 */
function _parseBet(betCode: string | number): Kl8Bet | null {
  const code = String(betCode ?? '').trim()
  if (!code) return null

  // ── 任選：任三中三03,07,15 ──
  for (const play of KL8_RENXUAN_DEFINITIONS) {
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

  // ── 兩面和值八面：大 / 大單 / 小雙 ──
  // ⚠️ 一律用「完全相等」比對，不用 startsWith——否則「大單」會先被「大」吃掉。
  const sumSide = SUM_SIDE_NAMES.find((name) => name === code)
  if (sumSide) return { kind: 'sumSide', side: sumSide }

  // ── 兩面上下盤 / 奇偶盤 ──
  const zone = ZONE_CODES[code]
  if (zone) return { kind: 'zone', side: zone }
  const parityZone = PARITY_ZONE_CODES[code]
  if (parityZone) return { kind: 'parityZone', side: parityZone }

  // ── 兩面五行：金 / 木 / 水 / 火 / 土 ──
  const wuxing = KL8_WUXING_NAMES.find((name) => name === code)
  if (wuxing) return { kind: 'wuxing', side: wuxing }

  return null
}

// ── 機率（賠率推導的唯一來源）──────────────────────────────────────────────

/**
 * 注碼的樣本空間
 * @returns { hit, total }（皆為 BigInt）；注碼無法辨識回 null
 */
export function kl8ChanceOf(betCode: string | number): Kl8Chance | null {
  const bet = _parseBet(betCode)
  if (!bet) return null
  switch (bet.kind) {
    // 任選 N 中 N：所選 N 碼全部落在 20 個開獎號內 = C(20,N) / C(80,N)
    case 'renxuan':
      return {
        hit: kl8ChooseCount(KL8_BALL_COUNT, bet.pick),
        total: kl8ChooseCount(KL8_NUMBER_MAX, bet.pick)
      }
    // 總和是 20 碼的集合性質，號碼不獨立 → 讀 kl8SumCounts() 建好的表
    case 'sumSide':
      return { hit: kl8SumHits((sum) => _sumSideHit(bet.side, sum)), total: KL8_TOTAL_COMBOS }
    // 上下盤／奇偶盤都是「40 對 40」的分割，共用 kl8HalfSplitCounts()
    case 'zone':
    case 'parityZone':
      return {
        hit: kl8HalfSplitHits((count) => _zoneHitByCount(bet.side, count)),
        total: KL8_TOTAL_COMBOS
      }
    // 五行：總和落在對應的等機率五等分區間
    case 'wuxing':
      return { hit: kl8SumHits((sum) => kl8WuxingOf(sum) === bet.side), total: KL8_TOTAL_COMBOS }
  }
}

/**
 * 注碼是否命中（判定的唯一入口，賠率與結算都靠它）
 * @returns true 命中／false 未命中／null 注碼或開獎格式不合
 */
export function kl8IsHit(betCode: string | number, openCode: Array<string | number>): boolean | null {
  const nums = kl8NumbersOf(openCode)
  if (!nums) return null
  const bet = _parseBet(betCode)
  if (!bet) return null

  switch (bet.kind) {
    // 任選沒有部分中獎：N 碼要全部出現在 20 個開獎號內
    case 'renxuan':
      return bet.nums.every((num) => nums.includes(num))
    case 'sumSide':
      return _sumSideHit(bet.side, kl8SumOf(nums))
    case 'zone':
      return kl8ZoneOf(nums) === bet.side
    case 'parityZone':
      return kl8ParityZoneOf(nums) === bet.side
    case 'wuxing':
      return kl8WuxingOf(kl8SumOf(nums)) === bet.side
  }
}

/** 注碼種類（供前端分群顯示與統計）；無法辨識回 null */
export function kl8KindOf(betCode: string | number): Kl8Bet['kind'] | null {
  return _parseBet(betCode)?.kind ?? null
}

/**
 * 任選分頁的注碼樣板（例：pick 3 → `任三中三01,02,03`）
 *
 * 任選的賠率只跟「一注幾碼」有關、與挑哪幾個號碼無關（C(20,N)/C(80,N)），
 * 所以看板要顯示整個分頁的賠率時用這支組一個代表性注碼即可。
 * @returns 注碼；pick 不在 1~7 回空字串
 */
export function kl8RenxuanSampleCode(pick: number): string {
  const play = KL8_RENXUAN_DEFINITIONS.find((item) => item.pick === Number(pick))
  if (!play) return ''
  const nums = Array.from({ length: play.pick }, (_, i) => kl8NumberLabel(KL8_NUMBER_MIN + i))
  return `${play.name}${nums.join(',')}`
}

/**
 * 取注項賠率（含本金）
 * @returns 賠率（無條件捨去到小數 2 位，避免浮點多給）；無法辨識回 0
 */
export function kl8OddsOf(betCode: string | number, rtp: number = KL8_RTP_FALLBACK): number {
  const chance = kl8ChanceOf(betCode)
  if (!chance || !(chance.hit > BigInt(0)) || !(chance.total > BigInt(0))) return 0
  const safeRtp = Number.isFinite(rtp) && rtp > 0 ? rtp : KL8_RTP_FALLBACK
  const fairOdds = Number(chance.total) / Number(chance.hit)
  return Math.floor(fairOdds * safeRtp * 100) / 100
}

/**
 * 快樂8中獎判定
 * @param odds 下注時鎖定的賠率；未帶（或 ≤ 0）則以 rtp 即時推算
 * @returns 判定結果；注碼無法辨識或開獎格式不合回 null（呼叫端應視為和局退還本金）
 */
export function judgeKl8Bet(
  betCode: string | number,
  openCode: Array<string | number>,
  coin: number,
  odds: number = 0,
  rtp: number = KL8_RTP_FALLBACK
): Kl8JudgeResult | null {
  const hit = kl8IsHit(betCode, openCode)
  if (hit === null) return null
  const kind = kl8KindOf(betCode)
  if (!kind) return null

  const lockedOdds = Number(odds) > 0 ? Number(odds) : kl8OddsOf(betCode, rtp)
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
 * 快樂8的爆池設定
 *
 * ── 爆池期怎麼定（使用者於提案階段拍板）────────────────
 *   當期 20 個號碼中**奇數 ≥ 15 個或偶數 ≥ 15 個**時觸發。
 *   機率 66,366,308,138,029,536 / 3,535,316,142,212,174,320 ≒ 1.8772%，
 *   與 kl10 奇偶≥7/8（1.9767%）、6hc-cd 特別號開49（1/49 ≒ 2.04%）同一個量級。
 *
 *   ⚠️ 為什麼不挑一個現成注項當條件——kl8 沒有 kl10 的「特別號」或「豹子」概念；
 *      任選雖有任六中六 0.0129%、任七中七 0.0024%，但那是**注單**的中獎率、不是開獎特徵
 *      （任何一期都必然存在對應組數會中的任N中N），不能當爆池期判準。
 *      因此改採「看板注項的奇偶**概念**所組成的開獎特徵」，做法同 kl10-cd.ts。
 *
 *   ⚠️ 為什麼是奇偶而不是上下（兩者機率完全相同）——
 *      奇偶只依賴號碼本身的奇偶性，不依賴任何門檻常數；
 *      上下盤依賴 KL8_HALF_LINE = 40 這條半分線。條件綁在不會被門檻調整影響的性質上比較穩。
 *
 *   ⚠️ 沒有「雙重加成」問題：本條件不對應任何單一注項（上下盤/奇偶盤的「和盤」是 10:10 全等，
 *      跟「≤5 或 ≥15」完全不重疊），所以 kl8cd/plays.js 不需要任何 `weight: 0` 的排除。
 *
 * ── 與其他彩種的差異：只有一個池 ────────────────────────
 *   快樂8沒有官方盤、沒有 Shared 層，**只有爆池這一個池**（同 PC蛋蛋／快樂十分），
 *   不需要那套「等所有盤口交件才結算」的編排，直接在 class 內結算即可。
 *
 * ⚠️ boardWeight 只列 cd —— 快樂8沒有官方盤，這個係數在這裡等於不作用。
 */
export const KL8_JACKPOT_SETTINGS: JackpotSettings = {
  rakeRatio: 0.01,
  payoutRatio: 0.5,
  /** 以 rakeRatio 1% 換算 ≈ 需累積 10 萬投注額 */
  minPool: 1000,
  /** 注單查不到看板設定時的保底權重（設定檔的 weight 都有值，這裡只是保險） */
  weightFallback: 1,
  boardWeight: { cd: 1 },
  hitLabel: `開出奇偶一邊倒（20 球中奇數或偶數佔 ${KL8_JACKPOT_LOPSIDED_MIN} 個以上）`,
  // 66,366,308,138,029,536 / C(80,20)，見 shared/config/kl8.ts 的窮舉驗證（scratchpad 對帳腳本已核對）
  hitRate: 66366308138029536 / Number(KL8_TOTAL_COMBOS)
}

/**
 * 爆池起始池底（僅開站時 seed 一次到 carryJackpot，之後照既有機制自然累積／發放）
 * ⚠️ 不可比照彩池玩法（KL8_POOL_BASE_MIN/MAX）那樣「每期都重新加回去」——
 *    爆池的公式（buildJackpotShares）沒有彩池玩法那個 0.55 阻尼係數，
 *    若每期都持續疊加一筆固定池底，滾存會無界成長。範圍比照彩池玩法（獨立宣告，不共用常數）。
 */
export const KL8_JACKPOT_BASE_MIN = 110_000
export const KL8_JACKPOT_BASE_MAX = 450_000

/**
 * 這一期是不是爆池期
 * @returns true = 奇偶一邊倒；開獎格式不合回 false
 */
export function kl8JackpotHit(openCode: Array<string | number>): boolean {
  const nums = kl8NumbersOf(openCode)
  if (!nums) return false
  const odd = kl8OddCountOf(nums)
  const even = nums.length - odd
  return odd >= KL8_JACKPOT_LOPSIDED_MIN || even >= KL8_JACKPOT_LOPSIDED_MIN
}

/** 爆池期的開獎文字（寫進爆池紀錄，給看板顯示用） */
export function kl8JackpotLabel(openCode: Array<string | number>): string {
  const nums = kl8NumbersOf(openCode)
  if (!nums) return ''
  if (!kl8JackpotHit(openCode)) return ''
  const odd = kl8OddCountOf(nums)
  const label = nums.map((num) => kl8NumberLabel(num)).join(' ')
  return `奇${odd}偶${KL8_BALL_COUNT - odd} ${label}`
}

/** 玩法定義（順序即前端玩法列的顯示順序，需與 kl8cd/plays.js 一致） */
export const KL8_PLAY_DEFINITIONS: Array<{ key: string; name: string }> = [
  { key: 'renxuan', name: '任選' },
  { key: 'liangmian', name: '兩面' }
]

// ── 彩池玩法（選號，比照 k3-of／kl10-cd 的「選號」xuanhao：依命中顆數分層、依下注比例分錢） ──
//
// ⚠️ 這是本專案自己設計的機制（比照 k3-of，非 bglottery 來源），與現有爆池（上方
//    KL8_JACKPOT_SETTINGS）是兩個完全獨立的池：各自的池底／抽水／滾存互不影響，
//    只是兩者都從同一筆下注金額抽水、且彩池玩法的注單也會一併參與現有爆池分配
//    （見 server/services/game/lottery/bg/kl8.ts）。
// ⚠️ 跟「任選」不同：任選是全中才算中（kl8IsHit 的 all-or-nothing），彩池玩法是
//    依命中顆數分層，兩者判定邏輯完全獨立，不共用 _parseBet／kl8IsHit。

export type PoolPrizeTier =
  | { match: number; type: 'pool'; ratio: number; minAmount?: number; name: string }
  | { match: number; type: 'fixed'; amount: number; name: string }

/** sentinel playKey：這個玩法刻意不進 kl8cd/plays.js 的看板網格，比照 k3-of／kl10 的 xuanhao */
export const KL8_POOL_PLAY_KEY = 'xuanhao'
/**
 * 選 3 個號碼（1~80，不重複）。用超幾何分布驗證過：選 3 碼對中 20 個開獎號，
 * 全中機率 1,140/82,160 ≈ 1.3874%，與 kl10 選 4 碼頭獎（1.445%）同量級
 * （選 4 碼對 kl8 而言頭獎機率僅 0.3064%，差了 4.7 倍，故採選 3 碼，見 design.md）；
 * 因開獎本身不重複，任何 3 碼組合的命中分布完全相同（不像 eggs/k3 有選型機率落差）。
 */
export const KL8_POOL_PICK_COUNT = 3
/** 查不到看板 weight 時的 fallback（比照 KL10_POOL_PLAY_WEIGHT），讓這個玩法也能參與既有爆池 */
export const KL8_POOL_PLAY_WEIGHT = 3

/** 池底範圍：使用者拍板比照 k3／kl10 的數值範圍，但獨立宣告成 KL8 自己的常數，不 import 其他彩種的 */
export const KL8_POOL_BASE_MIN = 110_000
export const KL8_POOL_BASE_MAX = 450_000
/** 抽水比例：比照 KL10_POOL_RAKE_RATIO（信用盤 2%），與既有爆池的 1% 是兩條並行的水 */
export const KL8_POOL_RAKE_RATIO = 0.02

/** 硬編碼額度（比照 KL10_POOL_QUOTA，這個玩法沒有看板設定可查） */
export const KL8_POOL_QUOTA = { item: { min: 2, max: 10000 }, issue: { max: 500000 } }

/**
 * 分層派彩表（比照 KL10_POOL_PRIZE_TIERS 的 70/20/固定倍數比例，見 design.md 的機率驗證）
 * 命中門檻依 KL8_POOL_PICK_COUNT(3) 設計：全中(3)/中2/中1
 */
export const KL8_POOL_PRIZE_TIERS: PoolPrizeTier[] = [
  { match: 3, type: 'pool', ratio: 0.70, minAmount: 20000, name: '頭獎' },
  { match: 2, type: 'pool', ratio: 0.20, name: '二獎' },
  { match: 1, type: 'fixed', amount: 2, name: '三獎' }
]

/** 池底重骰門檻：可派發金額低於「頭獎保底 ÷ 頭獎 ratio」時視為不足（比照 KL10_POOL_FLOOR 的算法） */
export const KL8_POOL_FLOOR = (() => {
  const top = KL8_POOL_PRIZE_TIERS.find((tier) => tier.type === 'pool' && tier.minAmount !== undefined)
  return top && top.type === 'pool' && top.minAmount ? Math.ceil(top.minAmount / top.ratio) : 0
})()

/**
 * 選號是否合法：3 碼、每碼 1~80、不重複
 * @returns 排序後的號碼陣列；不合法回 null
 */
export function kl8PoolPicksOf(codes: Array<string | number>): number[] | null {
  if (!Array.isArray(codes) || codes.length !== KL8_POOL_PICK_COUNT) return null
  const nums = codes.map((code) => Number(code))
  if (nums.some((num) => !Number.isInteger(num) || num < KL8_NUMBER_MIN || num > KL8_NUMBER_MAX)) return null
  if (new Set(nums).size !== nums.length) return null
  return [...nums].sort((a, b) => a - b)
}

/**
 * 命中顆數（picks 與開獎 20 號的集合交集；開獎本身不重複，不需要 multiset 邏輯）
 * @returns 0 ~ KL8_POOL_PICK_COUNT；開獎格式不合回 0
 */
export function kl8PoolMatchCount(picks: number[], openCode: Array<string | number>): number {
  const nums = kl8NumbersOf(openCode)
  if (!nums) return 0
  const drawn = new Set(nums)
  return picks.reduce((count, pick) => count + (drawn.has(pick) ? 1 : 0), 0)
}

/** 依命中顆數查對應的分層設定；未中（查不到）回 null */
export function kl8PoolTierOf(matchCount: number): PoolPrizeTier | null {
  return KL8_POOL_PRIZE_TIERS.find((tier) => tier.match === matchCount) ?? null
}
