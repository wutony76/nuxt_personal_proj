/**
 * PK10 的名次基本運算與注碼判定（遊戲層，兩個盤口共用）
 *
 * 開獎為 10 台車跑完的名次表：`openCode[i]` = 第 i+1 名的車號，
 * 整體是 1 ~ 10 的一個排列（10! = 3,628,800 種，不像快3 的 216 種可以整體窮舉）。
 *
 * ── 為什麼機率不用窮舉整體 ──────────────────────────────
 *   PK10 的注項都只看「某一個名次的車號」或「冠亞軍兩個名次的車號」，
 *   在排列均勻的前提下，這兩種邊際分布都能直接算：
 *     單一名次   → 車號均勻分布於 1 ~ 10（母數 10）
 *     冠亞軍兩名 → 有序且相異的車號對，共 10 × 9 = 90 組（母數 90）
 *   因此本檔用「該注項的樣本空間 { hit, total }」描述機率，
 *   賠率一律由 hit / total 推導，不寫死拍板數字（與 k3 同一套做法）。
 *
 * ── 注碼一覽（玩法對照 pcv2_0223 的 conf_pk10_cd / conf_pk10_og）────
 *   定位胆（CD／OG 共用）  冠軍01 ~ 第十名10                母數 10
 *   兩面                   冠軍大 / 冠軍小 / 冠軍單 / 冠軍雙   母數 10
 *   龍虎鬥                 冠軍龍 / 冠軍虎（前 5 個名次）      母數 2
 *   冠亞和                 和3 ~ 和19                        母數 90
 *   冠亞和兩面             和大 / 和小 / 和單 / 和雙           母數 90
 *   冠亞和複合面           和大單 / 和大雙 / 和小單 / 和小雙    母數 90
 *   冠亞組合               組合01-02 ~ 組合09-10（不分順序）   母數 90
 *   前一直選（OG）         前一01 ~ 前一10                    母數 10
 *   前二直選（OG）         前二05-03（冠軍 05、亞軍 03）       母數 90
 *   ⚠️ 前三直選不走本檔的賠率 —— 它是彩池分層玩法，見 shared/config/pk10-of.ts。
 *
 * ── 與 k3 的分工差異 ────────────────────────────────────
 *   快3 的信用盤（k3-cd.ts）與官方盤賠率制（k3og.ts）注碼表本來就不同，故各寫一份判定。
 *   PK10 兩個盤口的注碼語意完全一樣（差別只在 rtp、限額與哪些玩法開放），
 *   因此判定與機率統一收在本檔，避免兩份互相飄移：
 *     shared/config/pk10-cd.ts  信用盤：判定包裝 + 賠率推導
 *     shared/config/pk10og.ts   官方盤賠率制：同上，但 rtp 預設值自己一份
 *     shared/config/pk10-of.ts  官方盤前三直選：彩池分層派彩（不走本檔的賠率）
 *
 * ⚠️ 本檔不可 import 任何 helpers（helpers 會 import 本檔，會形成循環）。
 */

/** 幾台車（同時也是名次數） */
export const PK10_CAR_COUNT = 10
/** 車號大小分界：車號 ≥ 6 為大 */
export const PK10_BIG_LINE = 6
/** 冠亞和的大小分界：和值 ≥ 12 為大 */
export const PK10_SUM_BIG_LINE = 12
/** 冠亞和範圍（最小 1+2、最大 9+10） */
export const PK10_SUM_MIN = 3
export const PK10_SUM_MAX = PK10_CAR_COUNT * 2 - 1

/** 名次名稱（index 0 = 冠軍）；注碼前綴一律用這組字串 */
export const PK10_RANK_NAMES = [
  '冠軍', '亞軍', '第三名', '第四名', '第五名',
  '第六名', '第七名', '第八名', '第九名', '第十名'
] as const

/** 有龍虎的名次數：第 i 名對第 (11 − i) 名，故只有前 5 個名次 */
export const PK10_DRAGON_RANK_COUNT = PK10_CAR_COUNT / 2

/** 注項的樣本空間：命中數 / 母數（賠率由此推導） */
export type Pk10Chance = { hit: number; total: number }

/**
 * 把開獎號正規化成名次表；格式不合回 null
 * 必須恰好是 1 ~ 10 的排列，少一台或重複都視為無效開獎
 */
export function pk10CarsOf(openCode: Array<string | number>): number[] | null {
  const raw = Array.isArray(openCode) ? openCode : []
  if (raw.length !== PK10_CAR_COUNT) return null
  const cars = raw.map((code) => Number(code))
  if (cars.some((car) => !Number.isInteger(car) || car < 1 || car > PK10_CAR_COUNT)) return null
  if (new Set(cars).size !== PK10_CAR_COUNT) return null
  return cars
}

/** 取某名次的車號（rank 由 1 起算）；超出範圍回 0 */
export function pk10CarAt(cars: number[], rank: number): number {
  const idx = Number(rank) - 1
  if (!Number.isInteger(idx) || idx < 0 || idx >= PK10_CAR_COUNT) return 0
  return Number(cars[idx] ?? 0)
}

/** 冠亞和 = 冠軍車號 + 亞軍車號 */
export function pk10SumOf(cars: number[]): number {
  return pk10CarAt(cars, 1) + pk10CarAt(cars, 2)
}

/** 車號大小（≥ 6 為大） */
export function pk10IsBigCar(car: number): boolean {
  return Number(car) >= PK10_BIG_LINE
}

/** 龍虎的對手名次：第 i 名 ↔ 第 (11 − i) 名 */
export function pk10RivalRank(rank: number): number {
  return PK10_CAR_COUNT + 1 - Number(rank)
}

/** 窮舉冠亞軍的 90 種有序車號對（機率建表與測試對帳用） */
export function pk10AllChampionPairs(): number[][] {
  const pairs: number[][] = []
  for (let first = 1; first <= PK10_CAR_COUNT; first++) {
    for (let second = 1; second <= PK10_CAR_COUNT; second++) {
      if (first !== second) pairs.push([first, second])
    }
  }
  return pairs
}

/** 冠亞軍有序對的總數（10 × 9 = 90） */
export const PK10_PAIR_TOTAL = PK10_CAR_COUNT * (PK10_CAR_COUNT - 1)

/**
 * 各冠亞和的有序對數（3 ~ 19）
 * 由窮舉建表而非寫死，改動車數時自動跟上
 * ⚠️ 分布不對稱：和值 11 有 10 組、和值 12 只有 8 組，
 *    因此 PK10 的「和大 / 和小」「和單 / 和雙」賠率本來就不一樣（不是 bug）
 */
export const PK10_SUM_COUNTS: Record<number, number> = (() => {
  const table: Record<number, number> = {}
  pk10AllChampionPairs().forEach(([first, second]) => {
    const sum = Number(first) + Number(second)
    table[sum] = (table[sum] ?? 0) + 1
  })
  return table
})()

/** 車號補零成注碼用的兩位字串（1 → "01"） */
export function pk10CarCode(car: number): string {
  return String(Number(car)).padStart(2, '0')
}

/** 全部車號（1 ~ 10），供看板列舉 */
export function pk10AllCars(): number[] {
  return Array.from({ length: PK10_CAR_COUNT }, (_, idx) => idx + 1)
}

/** 全部冠亞組合注碼（45 組，01-02 ~ 09-10），供看板列舉 */
export function pk10AllComboPairs(): number[][] {
  const list: number[][] = []
  for (let a = 1; a <= PK10_CAR_COUNT; a++) {
    for (let b = a + 1; b <= PK10_CAR_COUNT; b++) list.push([a, b])
  }
  return list
}

// ── 注碼解析 ────────────────────────────────────────────────────────────────

/** 大小面 */
const PK10_BS_NAMES = ['大', '小'] as const
/** 單雙面 */
const PK10_OE_NAMES = ['單', '雙'] as const

type Pk10BigSmall = (typeof PK10_BS_NAMES)[number]
type Pk10OddEven = (typeof PK10_OE_NAMES)[number]
type Pk10Side = Pk10BigSmall | Pk10OddEven

/** 兩面注項名稱（接在名次後面：冠軍大、亞軍單…） */
const PK10_SIDE_NAMES: readonly Pk10Side[] = [...PK10_BS_NAMES, ...PK10_OE_NAMES]

/**
 * 注碼描述（解析的唯一產物）
 *
 * `pk10ChanceOf`（機率）與 `pk10IsHit`（判定）都只吃這個 descriptor ——
 * 這樣新增玩法只要動 `_parseBet` 與兩張表，兩支不會各自長分支而語意飄移。
 */
type Pk10Bet =
  /** 冠亞和值：和3 ~ 和19 */
  | { kind: 'sum'; sum: number }
  /** 冠亞和的面：和大 / 和小 / 和單 / 和雙 / 和大單 / 和大雙 / 和小單 / 和小雙 */
  | { kind: 'sumSide'; sides: Pk10Side[] }
  /** 冠亞組合（不分順序）：組合01-02 */
  | { kind: 'combo'; pair: [number, number] }
  /** 定位胆：冠軍05 */
  | { kind: 'car'; rank: number; car: number }
  /** 名次兩面：冠軍大 */
  | { kind: 'side'; rank: number; side: Pk10Side }
  /** 龍虎鬥：冠軍龍 */
  | { kind: 'dragon'; rank: number; isDragon: boolean }
  /** 前一直選：前一05（＝冠軍位，與定位胆冠軍同機率但玩法分開） */
  | { kind: 'first'; car: number }
  /** 前二直選：前二05-03（冠軍 05、亞軍 03，有序） */
  | { kind: 'firstTwo'; cars: [number, number] }

/**
 * 名次前綴的比對順序：由長到短
 * 避免短前綴先吃掉長的（若日後加入「第十」之類的別名，「第十名」必須先被比到）。
 * 每期結算會逐注呼叫，故在 module 載入時就排好，不要每次比對再排一次。
 */
const PK10_RANK_PREFIXES: Array<{ name: string; rank: number }> = PK10_RANK_NAMES
  .map((name, idx) => ({ name, rank: idx + 1 }))
  .sort((a, b) => b.name.length - a.name.length)

/** 「01」~「10」→ 車號；格式不合回 0（一律兩位數，避免「冠軍1」與「冠軍10」歧義） */
function _carOf(text: string): number {
  if (!/^(0[1-9]|10)$/.test(text)) return 0
  return Number(text)
}

/** 該面是否符合（大小單雙，以車號或和值判） */
function _sideHit(side: Pk10Side, value: number, bigLine: number): boolean {
  if (side === '大') return value >= bigLine
  if (side === '小') return value < bigLine
  if (side === '單') return value % 2 === 1
  return value % 2 === 0
}

/**
 * 解析注碼
 * @returns descriptor；無法辨識回 null（呼叫端一律視為無效注碼，不可猜）
 */
function _parseBet(betCode: string | number): Pk10Bet | null {
  const code = String(betCode ?? '').trim()
  if (!code) return null

  // ── 冠亞和值：和3 ~ 和19 ──
  const sumMatched = /^和(\d{1,2})$/.exec(code)
  if (sumMatched) {
    const sum = Number(sumMatched[1])
    return sum >= PK10_SUM_MIN && sum <= PK10_SUM_MAX ? { kind: 'sum', sum } : null
  }

  // ── 冠亞和的面：和大 / 和小 / 和單 / 和雙 / 和大單 / 和大雙 / 和小單 / 和小雙 ──
  if (code.startsWith('和')) {
    const rest = code.slice(1)
    // 單面
    const single = PK10_SIDE_NAMES.find((side) => side === rest)
    if (single) return { kind: 'sumSide', sides: [single] }
    // 複合面：大小 + 單雙（順序固定為「大小在前」，避免同一組合有兩種寫法）
    if (rest.length === 2) {
      const bs = PK10_BS_NAMES.find((side) => side === rest[0])
      const oe = PK10_OE_NAMES.find((side) => side === rest[1])
      if (bs && oe) return { kind: 'sumSide', sides: [bs, oe] }
    }
    return null
  }

  // ── 冠亞組合（不分順序）：組合01-02 ──
  const comboMatched = /^組合(0[1-9]|10)-(0[1-9]|10)$/.exec(code)
  if (comboMatched) {
    const a = Number(comboMatched[1])
    const b = Number(comboMatched[2])
    // 必須遞增且相異，同一組合才只有一種寫法
    if (!(a < b)) return null
    return { kind: 'combo', pair: [a, b] }
  }

  // ── 前二直選：前二05-03（有序，兩台車必相異）──
  const twoMatched = /^前二(0[1-9]|10)-(0[1-9]|10)$/.exec(code)
  if (twoMatched) {
    const first = Number(twoMatched[1])
    const second = Number(twoMatched[2])
    if (first === second) return null
    return { kind: 'firstTwo', cars: [first, second] }
  }

  // ── 前一直選：前一05 ──
  if (code.startsWith('前一')) {
    const car = _carOf(code.slice(2))
    return car > 0 ? { kind: 'first', car } : null
  }

  // ── 名次系列（定位胆 / 兩面 / 龍虎）──
  for (const { name, rank } of PK10_RANK_PREFIXES) {
    if (!code.startsWith(name)) continue
    const rest = code.slice(name.length)

    const car = _carOf(rest)
    if (car > 0) return { kind: 'car', rank, car }

    const side = PK10_SIDE_NAMES.find((item) => item === rest)
    if (side) return { kind: 'side', rank, side }

    // 龍虎只有前 5 個名次有對手
    if ((rest === '龍' || rest === '虎') && rank <= PK10_DRAGON_RANK_COUNT) {
      return { kind: 'dragon', rank, isDragon: rest === '龍' }
    }
    return null
  }

  return null
}

// ── 機率（賠率推導的唯一來源）──────────────────────────────────────────────

/**
 * 各面在單一名次的命中數（車號 1 ~ 10，各面都是 5）
 * 由窮舉建表，改動車數或大小分界時自動跟上
 */
const PK10_CAR_SIDE_COUNTS: Record<Pk10Side, number> = (() => {
  const table = { 大: 0, 小: 0, 單: 0, 雙: 0 }
  for (let car = 1; car <= PK10_CAR_COUNT; car++) {
    PK10_SIDE_NAMES.forEach((side) => {
      if (_sideHit(side, car, PK10_BIG_LINE)) table[side] += 1
    })
  }
  return table
})()

/**
 * 冠亞和各面組合的命中數（母數 90），key 為 sides 依序串起來
 *
 * ⚠️ 分布不對稱，這是 PK10 的固有性質不是設定錯：
 *    單面   大 40 / 小 50 / 單 50 / 雙 40   （和值 11 獨佔 10 組且屬「小」與「單」）
 *    複合面 大單 20 / 大雙 20 / 小單 30 / 小雙 20
 */
const PK10_SUM_SIDE_COUNTS: Record<string, number> = (() => {
  const table: Record<string, number> = {}
  const combos: Pk10Side[][] = [
    ...PK10_SIDE_NAMES.map((side) => [side]),
    ...PK10_BS_NAMES.flatMap((bs) => PK10_OE_NAMES.map((oe) => [bs, oe]))
  ]
  combos.forEach((sides) => {
    let hit = 0
    Object.entries(PK10_SUM_COUNTS).forEach(([sum, count]) => {
      if (sides.every((side) => _sideHit(side, Number(sum), PK10_SUM_BIG_LINE))) hit += Number(count)
    })
    table[sides.join('')] = hit
  })
  return table
})()

/**
 * 注碼的樣本空間
 *
 * 母數依玩法而定：
 *   單一名次（定位胆／兩面／前一）→ 10
 *   冠亞軍兩名（和值／組合／前二） → 90
 *   龍虎                           → 2
 * @returns { hit, total }；注碼無法辨識回 null
 */
export function pk10ChanceOf(betCode: string | number): Pk10Chance | null {
  const bet = _parseBet(betCode)
  if (!bet) return null
  switch (bet.kind) {
    case 'sum':
      return { hit: Number(PK10_SUM_COUNTS[bet.sum] ?? 0), total: PK10_PAIR_TOTAL }
    case 'sumSide':
      return { hit: Number(PK10_SUM_SIDE_COUNTS[bet.sides.join('')] ?? 0), total: PK10_PAIR_TOTAL }
    // 不分順序的一組車號 → 兩種有序對命中
    case 'combo':
      return { hit: 2, total: PK10_PAIR_TOTAL }
    case 'firstTwo':
      return { hit: 1, total: PK10_PAIR_TOTAL }
    case 'car':
    case 'first':
      return { hit: 1, total: PK10_CAR_COUNT }
    case 'side':
      return { hit: PK10_CAR_SIDE_COUNTS[bet.side], total: PK10_CAR_COUNT }
    case 'dragon':
      return { hit: 1, total: 2 }
  }
}

/**
 * 注碼是否命中（判定的唯一入口，賠率與結算都靠它）
 *
 * ⚠️ PK10 名次必然分得出來、車號互異，沒有快3 圍骰那種和局情境 ——
 *    回傳只有命中 / 未命中 / 注碼或開獎格式不合三種。
 * @returns true 命中／false 未命中／null 注碼或開獎格式不合
 */
export function pk10IsHit(betCode: string | number, openCode: Array<string | number>): boolean | null {
  const cars = pk10CarsOf(openCode)
  if (!cars) return null
  const bet = _parseBet(betCode)
  if (!bet) return null

  const first = pk10CarAt(cars, 1)
  const second = pk10CarAt(cars, 2)

  switch (bet.kind) {
    case 'sum':
      return pk10SumOf(cars) === bet.sum
    case 'sumSide':
      return bet.sides.every((side) => _sideHit(side, pk10SumOf(cars), PK10_SUM_BIG_LINE))
    // 不分順序：冠亞軍的車號集合等於注碼那組
    case 'combo':
      return (first === bet.pair[0] && second === bet.pair[1])
        || (first === bet.pair[1] && second === bet.pair[0])
    case 'firstTwo':
      return first === bet.cars[0] && second === bet.cars[1]
    case 'first':
      return first === bet.car
    case 'car':
      return pk10CarAt(cars, bet.rank) === bet.car
    case 'side':
      return _sideHit(bet.side, pk10CarAt(cars, bet.rank), PK10_BIG_LINE)
    case 'dragon': {
      const target = pk10CarAt(cars, bet.rank)
      const rival = pk10CarAt(cars, pk10RivalRank(bet.rank))
      // 車號互異，不會有相等的情況（所以龍虎沒有和局）
      return bet.isDragon ? target > rival : target < rival
    }
  }
}

/** 注碼種類（供前端分群顯示與統計）；無法辨識回 null */
export function pk10KindOf(betCode: string | number): Pk10Bet['kind'] | null {
  return _parseBet(betCode)?.kind ?? null
}
