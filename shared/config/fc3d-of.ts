/**
 * 福彩3D官方盤（FC3D-OF）判定與賠率核心
 *
 * 結構比照 shared/config/sscof.ts（無 pool 分頁那一套），位數由 5 縮為 3；
 * fc3d 只有官方盤、沒有彩池，故本檔不含任何 pool/jackpot 分支。
 *
 * ── 玩法（對照 bglottery fc3d/config_ssc.js）─────────────
 *   定位膽        百/十/個位各自單選一個數字                母數 1000（命中 100）
 *   前二/後二直選  2 個位置逐位對應皆中                       母數 100（命中 1）
 *   前二/後二組選  2 碼互異、不計順序                         母數 100（命中 2）
 *   三星直選      百/十/個位逐位對應皆中（複式／單式同判定）  母數 1000（命中 1）
 *   三星直選和值  三碼總和＝所選值 0~27                       母數 1000（命中查 ZXHZ 表）
 *   三星組三      {A,A,B}（兩同一異）的任一排列               母數 1000（命中 3）
 *   三星組六      三碼互異的任一排列                          母數 1000（命中 6）
 *   三星組選和值  三碼總和＝所選值 1~26 且非豹子              母數 1000（命中查 ZUSHZ 表）
 *   一碼不定位    所選數字出現在三位中任一位                  母數 1000（命中 271＝1000−9³）
 *   二碼不定位    所選 2 碼各自出現在三位中                   母數 1000（命中 54）
 *   大小單雙前二/後二  各位置的 大(5~9)/小(0~4)/單/雙          每位置命中 5/10
 *
 * ── 複式 ────────────────────────────────────────────────
 *   位置型（直選／大小單雙）→ 各位置選一組，笛卡爾積展開（號碼可重複，不去重）
 *   組選型（組二／組三／組六／二碼不定位）→ 從一組號碼取合法組合展開
 *   逐項型（和值／一碼不定位）→ 每個選號各自成一注
 *   單式（三星直選單式）→ 前端輸入框直接給注碼，不走展開函式
 *   ⚠️ 複式注數上限 FC3D_MAX_COMBO，超過整筆拒絕，讓玩家自己縮小選號範圍。
 *
 * ⚠️ 本檔不可 import fc3dof/helpers.ts（helpers 會 import 本檔，會形成循環）。
 */
import {
  fc3dDigitsOf,
  fc3dSumOf,
  fc3dIsTriple,
  fc3dSumCounts,
  fc3dGroupSumCounts,
  FC3D_DIGIT_MAX,
  FC3D_SUM_MIN,
  FC3D_SUM_MAX,
  FC3D_TOTAL_OUTCOMES,
  FC3D_PLACE_NAMES,
  type Fc3dChance
} from '#shared/config/fc3d'

/** 取不到分頁 rtp 時的預設回報率（官方盤一致慣例，比照 SSCOF/X5OF/PK10OF_RTP_FALLBACK 皆 0.96） */
export const FC3D_RTP_FALLBACK = 0.96

/**
 * 複式展開的注數上限（比照 SSC_OF_MAX_COMBO = 2000）
 *
 * 三星組六全選（10 碼）＝ C(10,3)=120、三星直選全選＝10³=1000，都在 2000 以內；
 * 但前端若送出畸形超大組合，超過這個數就整筆拒絕。
 */
export const FC3D_MAX_COMBO = 2000

/** 判定結果：官方盤沒有和局，tie 只保留給無法辨識的注碼 */
export type Fc3dOfBetResult = { status: 'win' | 'lose' | 'tie'; odds: number; payout: number }

/** 兩面 */
const SIDE_NAMES = ['大', '小', '單', '雙'] as const
type Fc3dSide = (typeof SIDE_NAMES)[number]

/** 各玩法看的號碼位（0 起算）：百=0、十=1、個=2 */
export const FC3D_OF_SECTIONS = {
  前二: [0, 1],
  後二: [1, 2],
  三星: [0, 1, 2]
} as const
export type Fc3dOfSection = keyof typeof FC3D_OF_SECTIONS

type Fc3dOfBet =
  /** 定位膽：百位3（單一位置命中單一數字） */
  | { kind: 'ballPos'; place: number; digit: number }
  /** 位置直選：前二直選12 / 後二直選12 / 三星直選123 */
  | { kind: 'direct'; section: Fc3dOfSection; digits: number[] }
  /** 前二/後二組選：2 碼互異、不計順序 */
  | { kind: 'group2'; section: Fc3dOfSection; digits: [number, number] }
  /** 三星組三：{A,A,B} 兩同一異，以排序後的三碼儲存 */
  | { kind: 'group3'; triple: [number, number, number] }
  /** 三星組六：三碼互異、不計順序 */
  | { kind: 'group6'; digits: [number, number, number] }
  /** 三星直選和值：三碼總和 0~27 */
  | { kind: 'sumValue'; sum: number }
  /** 三星組選和值：三碼總和 1~26 且非豹子 */
  | { kind: 'groupSumValue'; sum: number }
  /** 一碼不定位：所選數字出現在任一位 */
  | { kind: 'unpositioned1'; digit: number }
  /** 二碼不定位：所選 2 碼各自出現在某一位 */
  | { kind: 'unpositioned2'; digits: [number, number] }
  /** 大小單雙：前二/後二每個位置一個面 */
  | { kind: 'sides'; section: Fc3dOfSection; sides: Fc3dSide[] }

/** 位置直選的注碼前綴 → 區段 */
const DIRECT_PREFIX: Record<string, Fc3dOfSection> = {
  前二直選: '前二',
  後二直選: '後二',
  三星直選: '三星'
}
/** 前二/後二組選的注碼前綴 → 區段 */
const GROUP2_PREFIX: Record<string, Fc3dOfSection> = {
  前二組選: '前二',
  後二組選: '後二'
}

/** 把一串數字字元轉成陣列；含非數字或長度不符回 null */
function _digitsOf(text: string, expect: number): number[] | null {
  if (text.length !== expect || !/^\d+$/.test(text)) return null
  return text.split('').map(Number)
}

/** 三星組三合法性（比照來源 algorithm.js `_ZUSDScheck`）：恰有一個數字出現兩次（非豹子、非三異） */
function _isGroup3(triple: number[]): boolean {
  return triple.length === 3 && new Set(triple).size === 2
}

/**
 * 解析注碼字串成 descriptor（比照 sscof.ts 的 _parseBet）
 *
 * ⚠️ 前綴檢查順序有講究：`三星直選和值` 必須排在 `三星直選` 之前，
 *    否則 `三星直選和值13` 會被 `三星直選` 前綴誤攔。
 */
function _parseBet(betCode: string | number): Fc3dOfBet | null {
  const code = String(betCode ?? '').trim()
  if (!code) return null

  // ── 大小單雙：大小單雙前二大小 ──
  if (code.startsWith('大小單雙')) {
    const rest = code.slice(4)
    const section = (['前二', '後二'] as Fc3dOfSection[]).find((s) => rest.startsWith(s))
    if (!section) return null
    const tail = rest.slice(section.length)
    if (tail.length !== FC3D_OF_SECTIONS[section].length) return null
    const sides = tail.split('').map((ch) => SIDE_NAMES.find((s) => s === ch))
    if (sides.some((s) => !s)) return null
    return { kind: 'sides', section, sides: sides as Fc3dSide[] }
  }

  // ── 和值（必須排在「三星直選」「三星組選」直選類之前）──
  if (code.startsWith('三星直選和值')) {
    const rest = code.slice(6)
    if (!/^\d+$/.test(rest)) return null
    const sum = Number(rest)
    if (sum < FC3D_SUM_MIN || sum > FC3D_SUM_MAX) return null
    return { kind: 'sumValue', sum }
  }
  if (code.startsWith('三星組選和值')) {
    const rest = code.slice(6)
    if (!/^\d+$/.test(rest)) return null
    const sum = Number(rest)
    // 排除豹子後有效和值範圍 1 ~ 26（和值 0/27 只有豹子 000/999，不成立）
    if (sum < 1 || sum > FC3D_SUM_MAX - 1) return null
    return { kind: 'groupSumValue', sum }
  }

  // ── 位置直選 ──
  for (const [prefix, section] of Object.entries(DIRECT_PREFIX)) {
    if (!code.startsWith(prefix)) continue
    const digits = _digitsOf(code.slice(prefix.length), FC3D_OF_SECTIONS[section].length)
    return digits ? { kind: 'direct', section, digits } : null
  }

  // ── 前二/後二組選（2 碼互異、遞增讓同一注只有一種寫法）──
  for (const [prefix, section] of Object.entries(GROUP2_PREFIX)) {
    if (!code.startsWith(prefix)) continue
    const d = _digitsOf(code.slice(prefix.length), 2)
    if (!d || !(d[0]! < d[1]!)) return null
    return { kind: 'group2', section, digits: [d[0]!, d[1]!] }
  }

  // ── 三星組三：以排序後的 {A,A,B} 為唯一寫法 ──
  if (code.startsWith('三星組三')) {
    const d = _digitsOf(code.slice(4), 3)
    if (!d || !_isGroup3(d)) return null
    const sorted = [...d].sort((a, b) => a - b)
    if (sorted.join('') !== d.join('')) return null // 非排序寫法一律拒絕，避免同一注多種注碼
    return { kind: 'group3', triple: [sorted[0]!, sorted[1]!, sorted[2]!] }
  }
  // ── 三星組六：三碼互異、遞增 ──
  if (code.startsWith('三星組六')) {
    const d = _digitsOf(code.slice(4), 3)
    if (!d || !(d[0]! < d[1]! && d[1]! < d[2]!)) return null
    return { kind: 'group6', digits: [d[0]!, d[1]!, d[2]!] }
  }

  // ── 不定位（集合包含邏輯，與直選/組選的排列比對分開）──
  if (code.startsWith('一碼不定位')) {
    const rest = code.slice(5)
    if (!/^\d$/.test(rest)) return null
    return { kind: 'unpositioned1', digit: Number(rest) }
  }
  if (code.startsWith('二碼不定位')) {
    const d = _digitsOf(code.slice(5), 2)
    if (!d || !(d[0]! < d[1]!)) return null
    return { kind: 'unpositioned2', digits: [d[0]!, d[1]!] }
  }

  // ── 定位膽（百位3 / 十位5 / 個位9）──
  for (const name of FC3D_PLACE_NAMES) {
    if (!code.startsWith(name)) continue
    const rest = code.slice(name.length)
    if (!/^\d$/.test(rest)) return null
    return { kind: 'ballPos', place: FC3D_PLACE_NAMES.indexOf(name), digit: Number(rest) }
  }

  return null
}

const _sideHit = (side: Fc3dSide, value: number): boolean => {
  if (side === '大') return value >= 5
  if (side === '小') return value < 5
  if (side === '單') return value % 2 === 1
  return value % 2 === 0
}

/**
 * 注碼的樣本空間
 *
 * ⚠️ 母數（total）一律是「該注碼實際牽涉的位數樣本空間」：
 *    只看 n 個位置的玩法 → 10ⁿ；看全部三位的玩法（含和值/組選/不定位）→ 1000。
 *    和值類的機率分母都是全部 1000 種開獎，命中數才分別取直選（含豹子）／組選（排除豹子）表。
 * @returns { hit, total }；注碼無法辨識回 null
 */
export function fc3dChanceOf(betCode: string | number): Fc3dChance | null {
  const bet = _parseBet(betCode)
  if (!bet) return null
  const D = FC3D_DIGIT_MAX + 1 // 10
  const T = FC3D_TOTAL_OUTCOMES // 1000
  switch (bet.kind) {
    // 固定一位、其餘兩位自由 → 100 / 1000（公平 10）
    case 'ballPos':
      return { hit: D * D, total: T }
    // n 個位置逐位對應 → 1 / 10ⁿ（前二/後二 100、三星 1000）
    case 'direct':
      return { hit: 1, total: D ** FC3D_OF_SECTIONS[bet.section].length }
    // 2 碼互異的排列 2! = 2 / 100（公平 50）
    case 'group2':
      return { hit: 2, total: D ** 2 }
    // {A,A,B} 的排列 3 種 / 1000（公平 333.33）
    case 'group3':
      return { hit: 3, total: T }
    // 三碼互異的排列 3! = 6 / 1000（公平 166.67）
    case 'group6':
      return { hit: 6, total: T }
    // 三星直選和值：命中數查 ZXHZ 表（含豹子），母數 1000
    case 'sumValue':
      return { hit: fc3dSumCounts()[bet.sum] ?? 0, total: T }
    // 三星組選和值：命中數查 ZUSHZ 排列數表（排除豹子，該表加總 990），母數仍是全部 1000
    case 'groupSumValue':
      return { hit: fc3dGroupSumCounts()[bet.sum] ?? 0, total: T }
    // 一碼不定位：至少一位是該碼 = 1000 − 9³ = 271（與所選碼無關）
    case 'unpositioned1':
      return { hit: T - FC3D_DIGIT_MAX ** 3, total: T }
    // 二碼不定位：兩碼各至少出現一次（排容）= 1000 − 2·9³ + 8³ = 54（與所選碼無關）
    case 'unpositioned2':
      return { hit: T - 2 * FC3D_DIGIT_MAX ** 3 + (FC3D_DIGIT_MAX - 1) ** 3, total: T }
    // 大小單雙：每個位置 5 個號碼符合該面 → 5ⁿ / 10ⁿ（前二/後二 25/100，公平 4）
    case 'sides':
      return { hit: 5 ** bet.sides.length, total: D ** bet.sides.length }
  }
}

/**
 * 注碼是否命中
 *
 * 直選/組選/定位膽/大小單雙 → 「排列比對」（逐位或排序後逐位）；
 * 不定位 → 「集合包含」（Set.has / every）；兩套邏輯分開實作避免誤用。
 * @returns true／false／null（注碼或開獎格式不合）
 */
export function fc3dIsHit(betCode: string | number, openCode: Array<string | number>): boolean | null {
  const digits = fc3dDigitsOf(openCode)
  if (!digits) return null
  const bet = _parseBet(betCode)
  if (!bet) return null

  const pick = (section: Fc3dOfSection) => FC3D_OF_SECTIONS[section].map((i) => Number(digits[i]))

  switch (bet.kind) {
    case 'ballPos':
      return digits[bet.place] === bet.digit
    case 'direct':
      return pick(bet.section).every((d, i) => d === bet.digits[i])
    case 'group2': {
      const got = [...pick(bet.section)].sort((a, b) => a - b)
      return got.length === 2 && got[0] === bet.digits[0] && got[1] === bet.digits[1]
    }
    case 'group3': {
      const got = [...digits].sort((a, b) => a - b)
      return got.every((d, i) => d === bet.triple[i])
    }
    case 'group6': {
      const got = [...digits].sort((a, b) => a - b)
      return got.every((d, i) => d === bet.digits[i])
    }
    case 'sumValue':
      return fc3dSumOf(digits) === bet.sum
    case 'groupSumValue':
      // 排除豹子：豹子即使和值對上也不算中組選和值
      return !fc3dIsTriple(digits) && fc3dSumOf(digits) === bet.sum
    case 'unpositioned1':
      return new Set(digits).has(bet.digit)
    case 'unpositioned2':
      return bet.digits.every((d) => digits.includes(d))
    case 'sides':
      return pick(bet.section).every((d, i) => _sideHit(bet.sides[i]!, d))
  }
}

/** 注碼種類；無法辨識回 null */
export function fc3dKindOf(betCode: string | number): Fc3dOfBet['kind'] | null {
  return _parseBet(betCode)?.kind ?? null
}

/**
 * 注碼賠率（含本金）＝ 公平賠率（母數 ÷ 命中數）× rtp
 * @returns 賠率，取到小數 2 位；注碼無法辨識回 0
 */
export function fc3dOddsOf(betCode: string | number, rtp: number = FC3D_RTP_FALLBACK): number {
  const chance = fc3dChanceOf(betCode)
  if (!chance || !(chance.hit > 0) || !(chance.total > 0)) return 0
  const safeRtp = Number.isFinite(rtp) && rtp > 0 ? rtp : FC3D_RTP_FALLBACK
  return Number(((chance.total / chance.hit) * safeRtp).toFixed(2))
}

/**
 * 判定一注（唯一結算入口）
 * @param lockedOdds 下注時鎖進注單的賠率；> 0 就以它為準
 */
export function judgeFc3dBet(
  betCode: string,
  openCode: Array<string | number>,
  coin = 1,
  lockedOdds = 0
): Fc3dOfBetResult | null {
  const hit = fc3dIsHit(betCode, openCode)
  if (hit === null) return null
  const odds = lockedOdds > 0 ? Number(lockedOdds) : fc3dOddsOf(betCode)
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
      .filter((n) => Number.isInteger(n) && n >= 0 && n <= FC3D_DIGIT_MAX)
    return Array.from(new Set(nums)).sort((a, b) => a - b)
  })
  if (lists.length === 0 || lists.some((l) => l.length === 0)) return null
  return lists
}

/**
 * 位置型複式展開（前二/後二/三星直選）
 *
 * ⚠️ 福彩3D 的號碼可以重複，所以**不濾掉重複組合**（與 pk10 的名次排列不同）。
 * @returns 每一注的號碼陣列；任一位沒選或超過上限回空陣列
 */
export function fc3dDirectCombos(sets: Array<Array<number | string>>): number[][] {
  const lists = _normalizeSets(sets)
  if (!lists) return []
  const size = lists.reduce((acc, l) => acc * l.length, 1)
  if (size > FC3D_MAX_COMBO) return []
  let combos: number[][] = [[]]
  lists.forEach((list) => {
    const next: number[][] = []
    combos.forEach((prefix) => list.forEach((d) => next.push([...prefix, d])))
    combos = next
  })
  return combos
}

/** 兩面型複式展開（大小單雙）：每個位置選一組面，笛卡爾積 */
export function fc3dSideCombos(sets: Array<Array<string>>): string[][] {
  const lists = (Array.isArray(sets) ? sets : []).map((list) =>
    Array.from(new Set((Array.isArray(list) ? list : []).filter((s) => SIDE_NAMES.includes(s as Fc3dSide))))
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
 * 組選展開：從一組號碼取出所有合法組合
 *
 * @param mode
 *   group2 —— 2 碼互異（前二/後二組選、二碼不定位共用同一種取法 C(n,2)）
 *   group3 —— {A,A,B} 兩同一異；比照來源 algorithm.js 的 `s*(s-1)` 個組合
 *             （每個有序 (A,B) 對，A≠B，產生一個「A 出現兩次」的多重集，以排序後三碼表示）
 *   group6 —— 三碼互異 C(n,3)；合法性比照 `_ZULDScheck`
 * @returns 每一注的號碼陣列（已排序成唯一寫法）；碼數不足或超過上限回空陣列
 */
export function fc3dGroupCombos(
  digits: Array<number | string>,
  mode: 'group2' | 'group3' | 'group6'
): number[][] {
  const pool = Array.from(new Set(
    (Array.isArray(digits) ? digits : [])
      .map((n) => Number(n))
      .filter((n) => Number.isInteger(n) && n >= 0 && n <= FC3D_DIGIT_MAX)
  )).sort((a, b) => a - b)

  const out: number[][] = []
  if (mode === 'group3') {
    if (pool.length < 2) return []
    for (const a of pool) {
      for (const b of pool) {
        if (a === b) continue
        out.push([a, a, b].sort((x, y) => x - y))
      }
    }
  } else {
    const size = mode === 'group6' ? 3 : 2
    if (pool.length < size) return []
    const walk = (start: number, acc: number[]) => {
      if (acc.length === size) { out.push([...acc]); return }
      for (let i = start; i < pool.length; i++) walk(i + 1, [...acc, pool[i]!])
    }
    walk(0, [])
  }
  return out.length > FC3D_MAX_COMBO ? [] : out
}

/** 玩法定義（順序即前端玩法列的顯示順序，需與 fc3dof/plays.js 一致） */
export const FC3D_PLAY_DEFINITIONS: Array<{ key: string; name: string }> = [
  { key: 'dingwei', name: '定位膽' },
  { key: 'zhixuan', name: '直選組選' },
  { key: 'sanxing', name: '三星' },
  { key: 'budingwei', name: '不定位' },
  { key: 'daxiao', name: '大小單雙' }
]

export { FC3D_DIGIT_MAX, FC3D_PLACE_NAMES, FC3D_TOTAL_OUTCOMES }
