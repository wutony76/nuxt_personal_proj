/** 生肖列表（子鼠起，依序 12 生肖） */
export const SX = ['鼠', '牛', '虎', '兔', '龍', '蛇', '馬', '羊', '猴', '雞', '狗', '豬'] as const

export type SxType = (typeof SX)[number]

/** 六合彩色波對應號碼 */
export const LHC_COLORS = {
  red: ['01', '02', '07', '08', '12', '13', '18', '19', '23', '24', '29', '30', '34', '35', '40', '45', '46', '紅波'],
  blue: ['03', '04', '09', '10', '14', '15', '20', '25', '26', '31', '36', '37', '41', '42', '47', '48', '藍波'],
  green: ['05', '06', '11', '16', '17', '21', '22', '27', '28', '32', '33', '38', '39', '43', '44', '49', '綠波'],
} as const satisfies Record<string, readonly string[]>

export type LhcColorKey = keyof typeof LHC_COLORS

/** 五行對應號碼（金木水火土） */
export const WUXING = {
  j: ['01', '06', '11', '16', '21', '26', '31', '36', '41', '46'],
  m: ['02', '07', '12', '17', '22', '27', '32', '37', '42', '47'],
  s: ['03', '08', '13', '18', '23', '28', '33', '38', '43', '48'],
  h: ['04', '09', '14', '19', '24', '29', '34', '39', '44', '49'],
  t: ['05', '10', '15', '20', '25', '30', '35', '40', '45'],
} as const satisfies Record<string, readonly string[]>

export type WuxingKey = keyof typeof WUXING

/** 尾數列表（0尾 ~ 9尾） */
export const WS = ['0尾', '1尾', '2尾', '3尾', '4尾', '5尾', '6尾', '7尾', '8尾', '9尾'] as const

export type WsType = (typeof WS)[number]

/** 尾數對應號碼表 */
export const weishuAll: Record<string, string[]> = {
  '0尾': ['10', '20', '30', '40'],
  '1尾': ['01', '11', '21', '31', '41'],
  '2尾': ['02', '12', '22', '32', '42'],
  '3尾': ['03', '13', '23', '33', '43'],
  '4尾': ['04', '14', '24', '34', '44'],
  '5尾': ['05', '15', '25', '35', '45'],
  '6尾': ['06', '16', '26', '36', '46'],
  '7尾': ['07', '17', '27', '37', '47'],
  '8尾': ['08', '18', '28', '38', '48'],
  '9尾': ['09', '19', '29', '39', '49'],
}

/**
 * 依生肖推算對應號碼
 * @param animal - 生肖名稱（需為 SX 陣列中的有效值）
 * @returns 以生肖為 key 的號碼對應表，無效生肖回傳空物件
 */
export function shengxiaoAll(animal: string): Record<string, string[]> {
  if (!animal) return {}
  const sxList = SX as readonly string[]
  const pos = sxList.indexOf(animal)
  if (pos === -1) {
    console.log('無效的生肖', animal, pos)
    return {}
  }
  const tmp = ([] as string[])
    .concat(sxList.slice(0, pos + 1).reverse())
    .concat(sxList.slice(pos + 1).reverse())
  const ret: Record<string, string[]> = {}
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 12; j++) {
      const key = tmp[j] as string
      if (Array.isArray(ret[key])) {
        const s = i * 12 + parseInt(ret[key]![0]!)
        ret[key]!.push(String(s))
      } else {
        ret[key] = []
        let t = j + 1
        const tStr = t < 10 ? '0' + t : String(t)
        ret[key]!.push(tStr)
      }
    }
  }
  ret[animal]?.push('49')
  return ret
}

// ── CREDIT_PLAY_DEFINITIONS helpers ─────────────────────────────────────────

type NumberOption = { id: string; label: string; num: number }
type SimpleOption = { id: string; label: string }
type PlayOption = NumberOption | SimpleOption

const makeNumberOptions = (prefix: string): NumberOption[] =>
  Array.from({ length: 49 }, (_, index) => {
    const num = index + 1
    const label = String(num).padStart(2, '0')
    return { id: `${prefix}-${label}`, label, num }
  })

const makeSimpleOptions = (prefix: string, labels: string[]): SimpleOption[] =>
  labels.map((label, index) => ({ id: `${prefix}-${index + 1}`, label }))

const TEMA_SIDE_OPTIONS = ['特大', '特小', '特單', '特雙', '合單', '合雙', '尾大', '尾小']
const COLOR_OPTIONS = ['紅波', '藍波', '綠波']
const BANBO_OPTIONS = ['紅單', '紅雙', '紅大', '紅小', '藍單', '藍雙', '藍大', '藍小', '綠單', '綠雙', '綠大', '綠小']
const SHENGXIAO_OPTIONS = [...SX]

export type CreditPlayDefinition = {
  key: string
  name: string
  source: string
  description: string
  playTypeNames: string[]
  groupNames: string[]
  playTypeOptions: Record<string, PlayOption[]>
}
type TypePlayItem = {
  key: string
  name: string
}


// ── CREDIT_PLAY_DEFINITIONS ──
export const __CREDIT_PLAY_DEFINITIONS: CreditPlayDefinition[] = [
  {
    key: 'banbo',
    name: '半波',
    source: 'config_banbo.js',
    description: '色波、單雙、大小與合數等組合玩法。',
    playTypeNames: ['半波'],
    groupNames: ['半波'],
    playTypeOptions: { 半波: makeSimpleOptions('banbo-half', BANBO_OPTIONS) },
  },
  {
    key: 'duoxuanzhongyi',
    name: '中一',
    source: 'config_duoxuanzhongyi.js',
    description: '多選中一類型，命中任一指定條件即成立。',
    playTypeNames: ['五選中一', '六選中一', '七選中一', '八選中一', '九選中一', '十選中一'],
    groupNames: ['中一'],
    playTypeOptions: {
      五選中一: makeNumberOptions('duoxuanzhongyi-5'),
      六選中一: makeNumberOptions('duoxuanzhongyi-6'),
      七選中一: makeNumberOptions('duoxuanzhongyi-7'),
      八選中一: makeNumberOptions('duoxuanzhongyi-8'),
      九選中一: makeNumberOptions('duoxuanzhongyi-9'),
      十選中一: makeNumberOptions('duoxuanzhongyi-10'),
    },
  },
  {
    key: 'ixiaolian',
    name: '一肖連',
    source: 'config_ixiaolian.js',
    description: '以生肖關聯作為主要投注條件。',
    playTypeNames: ['一肖量'],
    groupNames: ['一肖量'],
    playTypeOptions: {
      一肖量: makeSimpleOptions('ixiaolian-animal', ['特肖', '一肖中', '一肖不中', '二肖連中', '三肖連中', '四肖連中']),
    },
  },
  {
    key: 'lianma',
    name: '連碼',
    source: 'config_lianma.js',
    description: '多號連動投注，依組合中獎條件判定。',
    playTypeNames: ['三全中', '三中二', '二全中', '二中特', '特串'],
    groupNames: ['連碼'],
    playTypeOptions: {
      三全中: makeSimpleOptions('lianma-3all', ['三全中']),
      三中二: makeSimpleOptions('lianma-3in2', ['三中二之中三', '三中二之中二']),
      二全中: makeSimpleOptions('lianma-2all', ['二全中']),
      二中特: makeSimpleOptions('lianma-2tema', ['二中特之中特', '二中特之中二']),
      特串: makeSimpleOptions('lianma-chain', ['特串']),
    },
  },
  {
    key: 'qima',
    name: '七碼',
    source: 'config_qima.js',
    description: '七碼範圍玩法，偏向擴大覆蓋型態。',
    playTypeNames: ['七碼'],
    groupNames: ['單雙', '大小'],
    playTypeOptions: {
      七碼: makeSimpleOptions('qima-7', ['單1', '單2', '單3', '單4', '雙1', '雙2', '雙3', '雙4', '大1', '大2', '大3', '大4', '小1', '小2', '小3', '小4']),
    },
  },
  {
    key: 'shengxiao',
    name: '生肖',
    source: 'config_shengxiao.js',
    description: '特肖、一肖、合肖與連肖等生肖延伸玩法。',
    playTypeNames: ['特肖'],
    groupNames: ['特肖'],
    playTypeOptions: { 特肖: makeSimpleOptions('shengxiao-special', SHENGXIAO_OPTIONS) },
  },
  {
    key: 'tema',
    name: '特碼',
    source: 'config_tema.js',
    description: '特碼主玩法，包含兩面與色波相關內容。',
    playTypeNames: ['特碼A', '特碼B'],
    groupNames: ['特碼', '兩面', '色波'],
    playTypeOptions: {
      特碼A: [...makeNumberOptions('tema-a-num'), ...makeSimpleOptions('tema-a-side', TEMA_SIDE_OPTIONS), ...makeSimpleOptions('tema-a-color', COLOR_OPTIONS)],
      特碼B: [...makeNumberOptions('tema-b-num'), ...makeSimpleOptions('tema-b-side', TEMA_SIDE_OPTIONS), ...makeSimpleOptions('tema-b-color', COLOR_OPTIONS)],
    },
  },
  {
    key: 'touweishu',
    name: '頭尾數',
    source: 'config_touweishu.js',
    description: '頭數、尾數與連尾的綜合玩法。',
    playTypeNames: ['尾數中', '尾數不中'],
    groupNames: ['尾數'],
    playTypeOptions: {
      尾數中: makeSimpleOptions('touweishu-in', ['0尾', '1尾', '2尾', '3尾', '4尾', '5尾', '6尾', '7尾', '8尾', '9尾']),
      尾數不中: makeSimpleOptions('touweishu-not', ['0尾', '1尾', '2尾', '3尾', '4尾', '5尾', '6尾', '7尾', '8尾', '9尾']),
    },
  },
  {
    key: 'weishulian',
    name: '尾數連',
    source: 'config_weishulian.js',
    description: '尾數串連投注，強調尾數組合。',
    playTypeNames: ['尾數量'],
    groupNames: ['尾數量'],
    playTypeOptions: {
      尾數量: makeSimpleOptions('weishulian-tail', ['二尾連中', '三尾連中', '四尾連中', '二尾連不中', '三尾連不中', '四尾連不中']),
    },
  },
  {
    key: 'wuxing',
    name: '五行',
    source: 'config_wuxing.js',
    description: '以五行分類對應號碼進行投注。',
    playTypeNames: ['五行'],
    groupNames: ['五行'],
    playTypeOptions: { 五行: makeSimpleOptions('wuxing', ['金', '木', '水', '火', '土']) },
  },
  {
    key: 'zhengma',
    name: '正碼',
    source: 'config_zhengma.js',
    description: '正碼與過關玩法的主體入口。',
    playTypeNames: ['正碼A', '正碼B'],
    groupNames: ['正碼', '兩面'],
    playTypeOptions: {
      正碼A: [...makeNumberOptions('zhengma-a-num'), ...makeSimpleOptions('zhengma-a-side', ['總單', '總雙', '總大', '總小'])],
      正碼B: [...makeNumberOptions('zhengma-b-num'), ...makeSimpleOptions('zhengma-b-side', ['總單', '總雙', '總大', '總小'])],
    },
  },
  {
    key: 'zhengmate',
    name: '正碼特',
    source: 'config_zhengmate.js',
    description: '正碼特別玩法，強調單項命中結果。',
    playTypeNames: ['正一特', '正二特', '正三特', '正四特', '正五特', '正六特'],
    groupNames: ['正一特', '兩面', '色波'],
    playTypeOptions: {
      正一特: [...makeNumberOptions('zhengmate-1-num'), ...makeSimpleOptions('zhengmate-1-side', TEMA_SIDE_OPTIONS), ...makeSimpleOptions('zhengmate-1-color', COLOR_OPTIONS)],
      正二特: [...makeNumberOptions('zhengmate-2-num'), ...makeSimpleOptions('zhengmate-2-side', TEMA_SIDE_OPTIONS), ...makeSimpleOptions('zhengmate-2-color', COLOR_OPTIONS)],
      正三特: [...makeNumberOptions('zhengmate-3-num'), ...makeSimpleOptions('zhengmate-3-side', TEMA_SIDE_OPTIONS), ...makeSimpleOptions('zhengmate-3-color', COLOR_OPTIONS)],
      正四特: [...makeNumberOptions('zhengmate-4-num'), ...makeSimpleOptions('zhengmate-4-side', TEMA_SIDE_OPTIONS), ...makeSimpleOptions('zhengmate-4-color', COLOR_OPTIONS)],
      正五特: [...makeNumberOptions('zhengmate-5-num'), ...makeSimpleOptions('zhengmate-5-side', TEMA_SIDE_OPTIONS), ...makeSimpleOptions('zhengmate-5-color', COLOR_OPTIONS)],
      正六特: [...makeNumberOptions('zhengmate-6-num'), ...makeSimpleOptions('zhengmate-6-side', TEMA_SIDE_OPTIONS), ...makeSimpleOptions('zhengmate-6-color', COLOR_OPTIONS)],
    },
  },
  {
    key: 'zhengterenzhong',
    name: '正特人中',
    source: 'config_zhengterenzhong.js',
    description: '特平中系列玩法。',
    playTypeNames: ['一粒任中', '二粒任中', '三粒任中', '四粒任中', '五粒任中'],
    groupNames: ['任中'],
    playTypeOptions: {
      一粒任中: makeNumberOptions('zhengterenzhong-1'),
      二粒任中: makeNumberOptions('zhengterenzhong-2'),
      三粒任中: makeNumberOptions('zhengterenzhong-3'),
      四粒任中: makeNumberOptions('zhengterenzhong-4'),
      五粒任中: makeNumberOptions('zhengterenzhong-5'),
    },
  },
  {
    key: 'zixuanbuzhong',
    name: '自選不中',
    source: 'config_zixuanbuzhong.js',
    description: '自選不中玩法，依不中條件計算結果。',
    playTypeNames: ['五不中', '六不中', '七不中', '八不中', '九不中', '十不中'],
    groupNames: ['不中'],
    playTypeOptions: {
      五不中: makeNumberOptions('zixuanbuzhong-5'),
      六不中: makeNumberOptions('zixuanbuzhong-6'),
      七不中: makeNumberOptions('zixuanbuzhong-7'),
      八不中: makeNumberOptions('zixuanbuzhong-8'),
      九不中: makeNumberOptions('zixuanbuzhong-9'),
      十不中: makeNumberOptions('zixuanbuzhong-10'),
    },
  },
]
export const CREDIT_PLAY_DEFINITIONS: TypePlayItem[] = [
  { key: 'tema', name: '特碼' },
  { key: 'zhengma', name: '正碼' },
  { key: 'zhengmate', name: '正碼特' },
  { key: 'lianma', name: '連碼' },
  { key: 'qima', name: '七碼' },
]

// ── 信用盤（6hc-cd）賠率與中獎判定 ────────────────────────────────
// 信用盤與官方盤（6hc-of）最大差異：官方盤是「獎池分層派彩」，
// 信用盤是「每注獨立、按賠率派彩」，賠率含本金（下注即扣款，中獎派彩 = 注金 × 賠率）。

/** 特碼賠率（信用盤通用值，含本金；可依營運需求調整） */
export const CREDIT_TEMA_ODDS = {
  /** 特碼單號（49 選 1，理論值 49） */
  number: 48,
  /** 兩面：特大／特小、特單／特雙、合單／合雙、尾大／尾小（理論值 2） */
  side: 1.98,
  /** 紅波 17 個號（理論值 2.88） */
  colorRed: 2.7,
  /** 藍波 16 個號（理論值 3.06） */
  colorBlue: 2.9,
  /** 綠波 16 個號（理論值 3.06） */
  colorGreen: 2.9,
} as const

/** 特碼兩面：開出 49 號視為和局（信用盤通用規則），退還本金 */
export const CREDIT_TIE_SPECIAL_NUMBER = 49

export type CreditBetKind = 'number' | 'side' | 'color'
export type CreditBetResult = 'win' | 'lose' | 'tie'
export type CreditJudgeResult = {
  kind: CreditBetKind
  result: CreditBetResult
  /** 該注項賠率（含本金） */
  odds: number
  /** 派彩金額：中獎 = 注金 × 賠率、和局 = 退還注金、未中 = 0 */
  payout: number
}

/** 合數（十位 + 個位） */
const _digitSum = (num: number): number =>
  String(Math.abs(Math.trunc(num)))
    .split('')
    .reduce((sum, char) => sum + Number(char), 0)

/** 兩面判定表（key 為注項名稱，值為「特別號是否符合」） */
const CREDIT_SIDE_JUDGES: Record<string, (special: number) => boolean> = {
  特大: (special) => special >= 25,
  特小: (special) => special <= 24,
  特單: (special) => special % 2 === 1,
  特雙: (special) => special % 2 === 0,
  合單: (special) => _digitSum(special) % 2 === 1,
  合雙: (special) => _digitSum(special) % 2 === 0,
  尾大: (special) => special % 10 >= 5,
  尾小: (special) => special % 10 <= 4,
}

/** 色波判定表（key 為注項名稱，值為色波號碼清單與賠率） */
const CREDIT_COLOR_JUDGES: Record<string, { codes: readonly string[]; odds: number }> = {
  紅波: { codes: LHC_COLORS.red, odds: CREDIT_TEMA_ODDS.colorRed },
  藍波: { codes: LHC_COLORS.blue, odds: CREDIT_TEMA_ODDS.colorBlue },
  綠波: { codes: LHC_COLORS.green, odds: CREDIT_TEMA_ODDS.colorGreen },
}

const _payout = (kind: CreditBetKind, result: CreditBetResult, odds: number, coin: number): CreditJudgeResult => {
  const amount = Number(coin)
  const safeCoin = Number.isFinite(amount) && amount > 0 ? amount : 0
  const payout = result === 'win'
    ? Number((safeCoin * odds).toFixed(2))
    : result === 'tie' ? safeCoin : 0
  return { kind, result, odds, payout }
}

/**
 * 取注項賠率（不需開獎結果，供下注時記錄與畫面顯示）
 * @param betCode 注項（號碼或兩面／色波文字）
 * @returns 賠率（含本金）；無法辨識回 0
 */
export function creditTemaOddsOf(betCode: string | number): number {
  const code = String(betCode ?? '').trim()
  if (!code) return 0
  if (/^\d+$/.test(code)) return CREDIT_TEMA_ODDS.number
  if (CREDIT_COLOR_JUDGES[code]) return CREDIT_COLOR_JUDGES[code]!.odds
  if (CREDIT_SIDE_JUDGES[code]) return CREDIT_TEMA_ODDS.side
  return 0
}

/**
 * 特碼玩法中獎判定（以特別號 openCode[6] 結算）
 * @param betCode 注項（號碼如 "04"，或兩面／色波文字如 "特大"、"紅波"）
 * @param specialCode 該期特別號
 * @param coin 該注注金
 * @returns 判定結果；無法辨識的注項回 null（呼叫端自行決定處理方式）
 */
export function judgeCreditTemaBet(
  betCode: string | number,
  specialCode: string | number,
  coin: number
): CreditJudgeResult | null {
  const special = Number(specialCode)
  if (!Number.isFinite(special) || special <= 0) return null
  const code = String(betCode ?? '').trim()
  if (!code) return null

  // 特碼單號
  if (/^\d+$/.test(code)) {
    const result: CreditBetResult = Number(code) === special ? 'win' : 'lose'
    return _payout('number', result, CREDIT_TEMA_ODDS.number, coin)
  }

  // 色波（49 為綠波，不設和局）
  const color = CREDIT_COLOR_JUDGES[code]
  if (color) {
    const padded = String(special).padStart(2, '0')
    const result: CreditBetResult = color.codes.includes(padded) ? 'win' : 'lose'
    return _payout('color', result, color.odds, coin)
  }

  // 兩面（開 49 為和局，退還本金）
  const judge = CREDIT_SIDE_JUDGES[code]
  if (judge) {
    if (special === CREDIT_TIE_SPECIAL_NUMBER) return _payout('side', 'tie', CREDIT_TEMA_ODDS.side, coin)
    const result: CreditBetResult = judge(special) ? 'win' : 'lose'
    return _payout('side', result, CREDIT_TEMA_ODDS.side, coin)
  }

  return null
}

// ── 正碼玩法（6hc-cd）賠率與中獎判定 ──────────────────────────────
// 與特碼的差異：特碼只看特別號（openCode[6]），正碼看 6 顆正碼（openCode[0..5]）；
// 兩面由「特別號大小單雙」換成「七顆球總和大小單雙」，且總和不會等於和局號，故不設和局。

/** 正碼賠率（信用盤通用值，含本金；可依營運需求調整） */
export const CREDIT_ZHENGMA_ODDS = {
  /** 正碼單號：命中 6 顆正碼之一（理論值 49 / 6 ≈ 8.17） */
  number: 8,
  /** 總和兩面：總和大／小、總和單／雙（理論值 2） */
  side: 1.98,
} as const

/** 總和大小分界：七顆球總和 ≥ 175 為大、≤ 174 為小 */
export const CREDIT_ZHENGMA_SUM_LINE = 175

/** 正碼可命中的球數（6 顆正碼，不含特別號） */
export const CREDIT_ZHENGMA_NORMAL_COUNT = 6

/** 總和兩面判定表（key 為注項名稱，值為「七顆球總和是否符合」） */
const CREDIT_ZHENGMA_SIDE_JUDGES: Record<string, (sum: number) => boolean> = {
  總和大: (sum) => sum >= CREDIT_ZHENGMA_SUM_LINE,
  總和小: (sum) => sum < CREDIT_ZHENGMA_SUM_LINE,
  總和單: (sum) => sum % 2 === 1,
  總和雙: (sum) => sum % 2 === 0,
}

/** 七顆球總和（6 正碼 + 特別號） */
const _openCodeSum = (openCode: Array<string | number>): number =>
  (Array.isArray(openCode) ? openCode : [])
    .map((code) => Number(code))
    .filter((num) => Number.isFinite(num) && num > 0)
    .reduce((sum, num) => sum + num, 0)

/** 6 顆正碼（補零字串），不含特別號 */
const _normalCodes = (openCode: Array<string | number>): string[] =>
  (Array.isArray(openCode) ? openCode : [])
    .slice(0, CREDIT_ZHENGMA_NORMAL_COUNT)
    .map((code) => String(Number(code)).padStart(2, '0'))

/**
 * 取正碼注項賠率（不需開獎結果，供下注時記錄與畫面顯示）
 * @param betCode 注項（號碼或總和兩面文字）
 * @returns 賠率（含本金）；無法辨識回 0
 */
export function creditZhengmaOddsOf(betCode: string | number): number {
  const code = String(betCode ?? '').trim()
  if (!code) return 0
  if (/^\d+$/.test(code)) return CREDIT_ZHENGMA_ODDS.number
  if (CREDIT_ZHENGMA_SIDE_JUDGES[code]) return CREDIT_ZHENGMA_ODDS.side
  return 0
}

/**
 * 正碼玩法中獎判定（以 6 顆正碼與七球總和結算）
 * @param betCode 注項（號碼如 "04"，或總和兩面文字如 "總和大"）
 * @param openCode 該期完整開獎號（7 顆：6 正碼 + 特別號）
 * @param coin 該注注金
 * @returns 判定結果；無法辨識的注項回 null（呼叫端自行決定處理方式）
 */
export function judgeCreditZhengmaBet(
  betCode: string | number,
  openCode: Array<string | number>,
  coin: number
): CreditJudgeResult | null {
  const codes = Array.isArray(openCode) ? openCode : []
  if (codes.length === 0) return null
  const code = String(betCode ?? '').trim()
  if (!code) return null

  // 正碼單號：命中 6 顆正碼之一即中（不看特別號）
  if (/^\d+$/.test(code)) {
    const padded = String(Number(code)).padStart(2, '0')
    const result: CreditBetResult = _normalCodes(codes).includes(padded) ? 'win' : 'lose'
    return _payout('number', result, CREDIT_ZHENGMA_ODDS.number, coin)
  }

  // 總和兩面：七顆球總和判定（不設和局）
  const judge = CREDIT_ZHENGMA_SIDE_JUDGES[code]
  if (judge) {
    const sum = _openCodeSum(codes)
    if (!(sum > 0)) return null
    const result: CreditBetResult = judge(sum) ? 'win' : 'lose'
    return _payout('side', result, CREDIT_ZHENGMA_ODDS.side, coin)
  }

  return null
}

// ── 正碼特玩法（6hc-cd）賠率與中獎判定 ────────────────────────────
// 正碼特（正一特～正六特）只看「指定名次那一顆正碼」，號碼分布為 1~49 均勻，
// 機率結構與特碼（49 選 1）完全相同，故賠率直接沿用 CREDIT_TEMA_ODDS。
// 與特碼的差別只有兩點：
//   1. 判定的球不同 —— 正碼特看 openCode[名次]，特碼看 openCode[6]（特別號）
//   2. 兩面注項名稱較短（大／小／單／雙，不加「特」字），故另備一份判定表

/** 正碼特賠率（與特碼同機率結構，直接對齊避免兩處數值走鐘） */
export const CREDIT_ZHENGMATE_ODDS = CREDIT_TEMA_ODDS

/** 正碼特分頁 tabId 基準：4000 = 正一特 … 4005 = 正六特（對應 openCode[0..5]） */
export const CREDIT_ZHENGMATE_TAB_BASE = 4000

/** 正碼特兩面判定表（key 為注項名稱，值為「該名次正碼是否符合」） */
const CREDIT_ZHENGMATE_SIDE_JUDGES: Record<string, (num: number) => boolean> = {
  大: (num) => num >= 25,
  小: (num) => num <= 24,
  單: (num) => num % 2 === 1,
  雙: (num) => num % 2 === 0,
  合單: (num) => _digitSum(num) % 2 === 1,
  合雙: (num) => _digitSum(num) % 2 === 0,
  尾大: (num) => num % 10 >= 5,
  尾小: (num) => num % 10 <= 4,
}

/**
 * 依分頁 tabId 取正碼特名次索引
 * @returns 0 = 正一特 … 5 = 正六特；不在 4000～4005 範圍回 -1
 */
export function creditZhengmatePositionOf(tabId?: number | string): number {
  const id = Number(tabId)
  if (!Number.isFinite(id)) return -1
  const index = id - CREDIT_ZHENGMATE_TAB_BASE
  return index >= 0 && index < CREDIT_ZHENGMA_NORMAL_COUNT ? index : -1
}

/**
 * 取正碼特注項賠率（不需開獎結果，供下注時記錄與畫面顯示）
 * @param betCode 注項（號碼、兩面文字如 "大"，或色波文字如 "紅波"）
 * @returns 賠率（含本金）；無法辨識回 0
 */
export function creditZhengmateOddsOf(betCode: string | number): number {
  const code = String(betCode ?? '').trim()
  if (!code) return 0
  if (/^\d+$/.test(code)) return CREDIT_ZHENGMATE_ODDS.number
  if (CREDIT_COLOR_JUDGES[code]) return CREDIT_COLOR_JUDGES[code]!.odds
  if (CREDIT_ZHENGMATE_SIDE_JUDGES[code]) return CREDIT_ZHENGMATE_ODDS.side
  return 0
}

/**
 * 正碼特玩法中獎判定（以「指定名次那一顆正碼」結算）
 * @param betCode 注項（號碼如 "04"，或兩面／色波文字如 "大"、"紅波"）
 * @param openCode 該期完整開獎號（7 顆：6 正碼 + 特別號）
 * @param coin 該注注金
 * @param tabId 該注所屬分頁（4000 = 正一特 … 4005 = 正六特），決定看哪一顆正碼
 * @returns 判定結果；無法辨識的注項或分頁回 null（呼叫端自行決定處理方式）
 */
export function judgeCreditZhengmateBet(
  betCode: string | number,
  openCode: Array<string | number>,
  coin: number,
  tabId?: number | string
): CreditJudgeResult | null {
  const position = creditZhengmatePositionOf(tabId)
  if (position < 0) return null
  const codes = Array.isArray(openCode) ? openCode : []
  const target = Number(codes[position])
  if (!Number.isFinite(target) || target <= 0) return null
  const code = String(betCode ?? '').trim()
  if (!code) return null

  // 單號：該名次正碼與所選號碼相同即中
  if (/^\d+$/.test(code)) {
    const result: CreditBetResult = Number(code) === target ? 'win' : 'lose'
    return _payout('number', result, CREDIT_ZHENGMATE_ODDS.number, coin)
  }

  // 色波（49 為綠波，不設和局）
  const color = CREDIT_COLOR_JUDGES[code]
  if (color) {
    const padded = String(target).padStart(2, '0')
    const result: CreditBetResult = color.codes.includes(padded) ? 'win' : 'lose'
    return _payout('color', result, color.odds, coin)
  }

  // 兩面（該名次正碼開 49 為和局，退還本金；與特碼同規則）
  const judge = CREDIT_ZHENGMATE_SIDE_JUDGES[code]
  if (judge) {
    if (target === CREDIT_TIE_SPECIAL_NUMBER) return _payout('side', 'tie', CREDIT_ZHENGMATE_ODDS.side, coin)
    const result: CreditBetResult = judge(target) ? 'win' : 'lose'
    return _payout('side', result, CREDIT_ZHENGMATE_ODDS.side, coin)
  }

  return null
}

// ── 七碼玩法（6hc-cd）賠率與中獎判定 ──────────────────────────────
// 七碼看整期七顆球（6 正碼 + 特別號）裡「單／雙」或「大／小」各佔幾顆，
// 機率為超幾何分布（49 選 7；單 25 個號、雙 24 個號；大 25 個號、小 24 個號）。
// 與特碼／正碼完全無關 —— 不看任何單一顆球，只看整組的組成比例，且不設和局。

/** 七碼參與判定的球數（6 正碼 + 特別號） */
export const CREDIT_QIMA_BALL_COUNT = 7

/**
 * 七碼賠率表（含本金），與 shared/config/cd/c_qima.js 的 odds 對齊。
 * 取理論值 ×0.97（RTP 約 96.5%～97.3%）；大小組與單雙組分布相同故共用同一組數值。
 */
export const CREDIT_QIMA_ODDS: Record<string, number> = {
  '單0雙7': 240,
  '單1雙6': 24.7,
  '單2雙5': 6.5,
  '單3雙4': 3.4,
  '單4雙3': 3.25,
  '單5雙2': 5.7,
  '單6雙1': 19.6,
  '單7雙0': 173,
  '大0小7': 240,
  '大1小6': 24.7,
  '大2小5': 6.5,
  '大3小4': 3.4,
  '大4小3': 3.25,
  '大5小2': 5.7,
  '大6小1': 19.6,
  '大7小0': 173,
}

/** 七碼各面向的計數條件（統計七顆球中符合的顆數） */
const CREDIT_QIMA_COUNTERS: Record<string, (num: number) => boolean> = {
  單: (num) => num % 2 === 1,
  雙: (num) => num % 2 === 0,
  大: (num) => num >= 25,
  小: (num) => num <= 24,
}

/** 注項名稱格式：面向 + 顆數 + 面向 + 顆數（如 "單3雙4"、"大0小7"） */
const CREDIT_QIMA_NAME_PATTERN = /^(單|雙|大|小)(\d)(單|雙|大|小)(\d)$/

/** 七顆球（去除無效值後）；不足 7 顆回空陣列，避免用半組開獎號誤判 */
const _qimaBalls = (openCode: Array<string | number>): number[] => {
  const nums = (Array.isArray(openCode) ? openCode : [])
    .slice(0, CREDIT_QIMA_BALL_COUNT)
    .map((code) => Number(code))
    .filter((num) => Number.isFinite(num) && num > 0)
  return nums.length === CREDIT_QIMA_BALL_COUNT ? nums : []
}

/**
 * 取七碼注項賠率（不需開獎結果，供下注時記錄與畫面顯示）
 * @param betCode 注項（如 "單3雙4"）
 * @returns 賠率（含本金）；無法辨識回 0
 */
export function creditQimaOddsOf(betCode: string | number): number {
  const code = String(betCode ?? '').trim()
  if (!code) return 0
  return Number(CREDIT_QIMA_ODDS[code] ?? 0)
}

/**
 * 七碼玩法中獎判定（以七顆球的單雙／大小組成顆數結算，不設和局）
 * @param betCode 注項（如 "單3雙4"、"大0小7"）
 * @param openCode 該期完整開獎號（7 顆：6 正碼 + 特別號）
 * @param coin 該注注金
 * @returns 判定結果；無法辨識的注項或開獎號不足 7 顆回 null
 */
export function judgeCreditQimaBet(
  betCode: string | number,
  openCode: Array<string | number>,
  coin: number
): CreditJudgeResult | null {
  const code = String(betCode ?? '').trim()
  const matched = CREDIT_QIMA_NAME_PATTERN.exec(code)
  if (!matched) return null
  const odds = creditQimaOddsOf(code)
  if (!(odds > 0)) return null
  const balls = _qimaBalls(openCode)
  if (balls.length === 0) return null

  const [, firstLabel, firstCount, secondLabel, secondCount] = matched
  const firstJudge = CREDIT_QIMA_COUNTERS[String(firstLabel)]
  const secondJudge = CREDIT_QIMA_COUNTERS[String(secondLabel)]
  if (!firstJudge || !secondJudge) return null

  const firstHit = balls.filter(firstJudge).length
  const secondHit = balls.filter(secondJudge).length
  const hit = firstHit === Number(firstCount) && secondHit === Number(secondCount)
  // 七碼是「整組組成」的兩面型注項，獎池分類歸在 side
  return _payout('side', hit ? 'win' : 'lose', odds, coin)
}

// ── 玩法分派（依 play_key 取賠率／判定，供伺端結算與下注紀錄共用） ─────

/** 依玩法取注項賠率；未支援的玩法回 0 */
export function creditOddsOf(playKey: string | undefined, betCode: string | number): number {
  switch (String(playKey ?? '')) {
    case 'zhengma': return creditZhengmaOddsOf(betCode)
    case 'zhengmate': return creditZhengmateOddsOf(betCode)
    case 'qima': return creditQimaOddsOf(betCode)
    // 未帶 play_key 的舊注單一律以特碼解讀（原有行為）
    default: return creditTemaOddsOf(betCode)
  }
}

/**
 * 該玩法的「單號」注項是否以特別號判定
 * 供注單 specialMatch 標記使用：正碼／正碼特命中的是正碼，七碼沒有單號注項。
 */
export function creditNumberBetHitsSpecial(playKey?: string): boolean {
  const key = String(playKey ?? '')
  return key !== 'zhengma' && key !== 'zhengmate' && key !== 'qima'
}

/** 依玩法判定單注結果；未支援的玩法回 null（呼叫端視為和局退還本金） */
export function judgeCreditBet(input: {
  playKey?: string
  betCode: string | number
  openCode: Array<string | number>
  coin: number
  /** 該注所屬分頁：正碼特需要靠它決定看哪一顆正碼，其餘玩法可省略 */
  tabId?: number | string
}): CreditJudgeResult | null {
  const codes = Array.isArray(input?.openCode) ? input.openCode : []
  switch (String(input?.playKey ?? '')) {
    case 'zhengma': return judgeCreditZhengmaBet(input.betCode, codes, input.coin)
    case 'zhengmate': return judgeCreditZhengmateBet(input.betCode, codes, input.coin, input.tabId)
    case 'qima': return judgeCreditQimaBet(input.betCode, codes, input.coin)
    default: return judgeCreditTemaBet(input.betCode, codes[6] ?? '', input.coin)
  }
}

// ── 獎池（抽水入池 + 爆池發放） ───────────────────────────────────
// 信用盤按賠率派彩由莊家支付，獎池不參與一般派彩；獎池改由「每注抽水」累積，
// 並在爆池期一次發放給該期有份的注單（三類注項皆可參與）。
export const CREDIT_JACKPOT = {
  /** 每筆投注額撥入獎池的比例 */
  rakeRatio: 0.01,
  /** 爆池期：特別號開出此號碼時發放（49 同時是特碼兩面的和局號） */
  hitNumber: 49,
  /** 觸發時發放累積池的比例，其餘滾存至下期 */
  payoutRatio: 0.5,
  /** 累積池低於此金額不發放（避免發出零星小額）；以 rakeRatio 1% 換算 ≈ 需累積 10 萬投注額 */
  minPool: 1000,
  /**
   * 分配權重的退回值（依「注金 × 權重」比例分配）
   *
   * ⚠️ 正式取值來源是各玩法看板設定（c_tema / c_zhengma / c_zhengmate / c_qima）的
   * `tabGroup[].weight`（可由 `groupList[].weight` 逐項覆寫），由
   * `creditJackpotWeightOf()` 解析後帶進 buildCreditJackpotShares；
   * 這裡只在「注單查不到對應設定」（例如舊注單、已下架玩法）時作為保底。
   *
   * 設定檔的分級依「理論賠率（1 / 命中機率）」：
   *   ≥ 20 → 3（極難，如特碼／正碼特單號 49）
   *   2.5 ~ 20 → 2（中，如色波 2.88、正碼單號 8.17）
   *   < 2.5 → 1（易，如兩面 2）
   */
  weights: { number: 3, color: 2, side: 1 },
} as const

export type CreditJackpotShare = {
  orderId: string
  userId: string
  coin: number
  kind: CreditBetKind
  weight: number
  weighted: number
  amount: number
}

export type CreditJackpotResult = {
  triggered: boolean
  /** 未觸發原因：非爆池期 / 累積池未達門檻 / 無有份注單 */
  reason: 'hit' | 'not-hit-issue' | 'pool-too-low' | 'no-eligible'
  /** 可發放累積池（當期抽水 + 累積滾存） */
  pool: number
  /** 實際發出總額 */
  payout: number
  /** 滾存至下期 */
  remain: number
  shares: CreditJackpotShare[]
}

type CreditJackpotRow = {
  orderId: string
  userId: string
  coin: number
  kind: CreditBetKind | null
  result: CreditBetResult
  /**
   * 該注的爆池分配權重（由呼叫端以 creditJackpotWeightOf 從看板設定解析）。
   * 未帶或 ≤ 0 時退回 CREDIT_JACKPOT.weights[kind]。
   * 本檔不直接讀設定檔 —— shared/config/cd/helpers 已 import 本檔，反向 import 會形成循環。
   */
  weight?: number
}

/**
 * 計算爆池分配（純函式，server 結算與測試共用）
 * 有份條件：爆池期中「非未中」的注單 —— 單號命中 49、綠波命中、兩面和局
 * @param rows 該期注單（已判定結果）
 * @param specialCode 該期特別號
 * @param pool 可發放累積池（當期抽水 + 累積滾存）
 */
export function buildCreditJackpotShares(
  rows: CreditJackpotRow[],
  specialCode: string | number,
  pool: number
): CreditJackpotResult {
  const safePool = Math.max(0, Number(Number(pool ?? 0).toFixed(2)))
  const base: CreditJackpotResult = {
    triggered: false,
    reason: 'not-hit-issue',
    pool: safePool,
    payout: 0,
    remain: safePool,
    shares: [],
  }

  if (Number(specialCode) !== CREDIT_JACKPOT.hitNumber) return base
  if (safePool < CREDIT_JACKPOT.minPool) return { ...base, reason: 'pool-too-low' }

  const eligible = (Array.isArray(rows) ? rows : [])
    .map((row) => {
      const coin = Number(row?.coin ?? 0)
      const kind = row?.kind
      if (!kind || row?.result === 'lose' || !(coin > 0)) return null
      // 權重以注單帶進來的設定值為主（各玩法 / 各群組不同）；
      // 明確給 0 代表「該注項不參與分配」，只有完全沒帶（舊注單）才退回全域預設
      const configWeight = row?.weight == null ? Number.NaN : Number(row.weight)
      const weight = Number.isFinite(configWeight) && configWeight >= 0
        ? configWeight
        : Number(CREDIT_JACKPOT.weights[kind] ?? 0)
      if (!(weight > 0)) return null
      return { row, coin, kind, weight, weighted: coin * weight }
    })
    .filter((item): item is { row: CreditJackpotRow; coin: number; kind: CreditBetKind; weight: number; weighted: number } => Boolean(item))

  if (eligible.length === 0) return { ...base, reason: 'no-eligible' }

  const totalWeighted = eligible.reduce((sum, item) => sum + item.weighted, 0)
  const budget = Number((safePool * CREDIT_JACKPOT.payoutRatio).toFixed(2))
  let distributed = 0
  const shares: CreditJackpotShare[] = eligible.map((item, index) => {
    // 最後一筆吃尾差，避免四捨五入造成總額不符
    const amount = index === eligible.length - 1
      ? Number((budget - distributed).toFixed(2))
      : Number((budget * item.weighted / totalWeighted).toFixed(2))
    distributed = Number((distributed + amount).toFixed(2))
    return {
      orderId: String(item.row.orderId),
      userId: String(item.row.userId),
      coin: item.coin,
      kind: item.kind,
      weight: item.weight,
      weighted: item.weighted,
      amount,
    }
  })

  const payout = Number(distributed.toFixed(2))
  return {
    triggered: true,
    reason: 'hit',
    pool: safePool,
    payout,
    remain: Number((safePool - payout).toFixed(2)),
    shares,
  }
}
