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

/**
 * 取某色波的純號碼清單
 * LHC_COLORS 陣列尾端帶有 '紅波' / '藍波' / '綠波' 這類文字標籤（供注項名比對用），
 * 要拿號碼時一定要濾掉，否則會把標籤當成號碼算進去。
 */
export function lhcColorNumbers(color: LhcColorKey): string[] {
  return (LHC_COLORS[color] ?? []).filter((code) => /^\d+$/.test(code))
}

/** 半波注項名首字 → 色波鍵值 */
const BANBO_COLORS: Record<string, LhcColorKey> = { 紅: 'red', 藍: 'blue', 綠: 'green' }

/** 半波注項名次字 → 篩選條件 */
const BANBO_CONDITIONS: Record<string, (num: number) => boolean> = {
  大: (num) => num >= 25,
  小: (num) => num <= 24,
  單: (num) => num % 2 === 1,
  雙: (num) => num % 2 === 0,
}

/**
 * 取半波注項涵蓋的號碼（色波 ∩ 大小／單雙）
 *
 * 色波的號碼分布是固定的（紅 17 / 藍 16 / 綠 16），不像五行逐年輪轉，
 * 所以這裡不需要年份參數；但仍以函式產生而非在 config 寫死，
 * 確保 c_banbo 的號碼永遠與 LHC_COLORS 同步，不會兩邊各改一半。
 *
 * @param betCode 注項名（紅大 / 綠單 / 藍雙…）
 * @returns 該注項的號碼（補零字串）；無法辨識回空陣列
 */
export function banboNumsOf(betCode: string): string[] {
  const code = String(betCode ?? '').trim()
  const color = BANBO_COLORS[code[0] ?? '']
  const condition = BANBO_CONDITIONS[code[1] ?? '']
  if (!color || !condition) return []
  return lhcColorNumbers(color).filter((num) => condition(Number(num)))
}

// ── 五行（金木水火土）──────────────────────────────────────────
// ⚠️ 五行對應號碼「逐年輪轉」，與生肖同性質（見 shengxiaoAll），不是固定表。
// 舊版這裡寫死成 n % 5 分組（金 = 01,06,11…），那既不是六合彩的五行、也不隨年變動。
//
// 規則：號碼兩兩一組（01,02）（03,04）…（47,48），49 自成一組，共 25 組；
// 第 1 組對應「當年干支所屬的納音組」，其後依六十甲子納音順序往下推，該組的納音五行即為五行。
//
// ⚠️ 這裡是以「號碼對 → 納音組」對應，不是「號碼 → 干支」逐一對應。
//    後者在干支序為奇數的年份會讓配對錯位成（01）（02,03）（04,05）…，
//    與實際五行表永遠 (01,02)(03,04) 成對的形式不符。
//
// ⚠️ 各五行的號碼數會隨年份在 8 ~ 12 之間變動（2026 丙午年：水 12 個、火 8 個），
//    所以賠率不能寫死在 config —— 必須由「該年該五行的號碼數」推算，見 creditWuxingOddsOf。

export type WuxingKey = 'j' | 'm' | 's' | 'h' | 't'

/** 五行鍵值 → 中文名（config 注項與注單存的是中文名） */
export const WUXING_NAMES: Record<WuxingKey, string> = { j: '金', m: '木', s: '水', h: '火', t: '土' }

/** 中文名 → 鍵值 */
export const WUXING_KEYS: Record<string, WuxingKey> = { 金: 'j', 木: 'm', 水: 's', 火: 'h', 土: 't' }

const TIANGAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'] as const
const DIZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'] as const

/**
 * 六十甲子納音五行（30 組，每組 2 個干支）
 * index = 干支序 / 2，例如干支序 0~1（甲子乙丑）= 海中金 → 金
 */
const NAYIN_ELEMENTS: readonly WuxingKey[] = [
  'j', 'h', 'm', 't', 'j', 'h', 's', 't', 'j', 'm', // 海中金 爐中火 大林木 路旁土 劍鋒金 山頭火 澗下水 城頭土 白蠟金 楊柳木
  's', 't', 'h', 'm', 's', 'j', 'h', 'm', 't', 'j', // 泉中水 屋上土 霹靂火 松柏木 長流水 沙中金 山下火 平地木 壁上土 金箔金
  'h', 's', 't', 'j', 'm', 's', 't', 'h', 'm', 's', // 覆燈火 天河水 大驛土 釵釧金 桑柘木 大溪水 沙中土 天上火 石榴木 大海水
]

/** 西元年 → 六十甲子序（1984 年為甲子 = 0） */
export function ganzhiIndexOfYear(year: number): number {
  const num = Math.trunc(Number(year))
  if (!Number.isFinite(num)) return 0
  return ((num - 1984) % 60 + 60) % 60
}

/** 該年的干支字串（如 2026 → 丙午） */
export function ganzhiOfYear(year: number): string {
  const index = ganzhiIndexOfYear(year)
  return `${TIANGAN[index % 10]}${DIZHI[index % 12]}`
}

/**
 * 依年份推算五行對應號碼
 * @param year 西元年（以「開獎期別的年份」為準，跨年結算舊期時不可用今年的表）
 * @returns 以五行鍵值為 key 的號碼表（補零字串）
 */
export function wuxingAll(year: number): Record<WuxingKey, string[]> {
  // 當年干支所屬的納音組（六十甲子兩個干支共用一個納音）
  const startPair = Math.floor(ganzhiIndexOfYear(year) / 2)
  const table: Record<WuxingKey, string[]> = { j: [], m: [], s: [], h: [], t: [] }
  for (let num = 1; num <= 49; num++) {
    // 號碼對序：01,02 → 0，03,04 → 1 …，47,48 → 23，49 → 24（自成一組）
    const pair = Math.floor((num - 1) / 2)
    const element = NAYIN_ELEMENTS[(startPair + pair) % NAYIN_ELEMENTS.length] as WuxingKey
    table[element].push(String(num).padStart(2, '0'))
  }
  return table
}

/**
 * 依年份建立「號碼 → 五行中文名」對照表
 * 伺端每期結算會呼叫，建議以年份為 key 快取（見 lottery6hcCd 的 wuxingByNumber）
 */
export function wuxingNameByNumber(year: number): Record<string, string> {
  const map: Record<string, string> = {}
  const table = wuxingAll(year)
  ;(Object.keys(table) as WuxingKey[]).forEach((key) => {
    table[key].forEach((code) => { map[code] = WUXING_NAMES[key] })
  })
  return map
}

/**
 * 取某個五行在指定年份的號碼清單
 * @param betCode 五行中文名（金 / 木 / 水 / 火 / 土）或鍵值（j / m / s / h / t）
 * @param year 西元年（看板顯示可用今年；結算舊期務必帶該期年份）
 */
export function wuxingNumsOf(betCode: string, year: number): string[] {
  const code = String(betCode ?? '').trim()
  const key = (WUXING_KEYS[code] ?? code) as WuxingKey
  return wuxingAll(year)[key] ?? []
}

/**
 * 當年的五行對照表
 * @deprecated 只保留給舊引用；五行逐年輪轉，請改用 wuxingAll(該期年份)
 */
export const WUXING: Record<WuxingKey, string[]> = wuxingAll(new Date().getFullYear())

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

/**
 * 西元年 → 當年生肖（2020 為鼠年）
 * server/services/base.ts 的 MEMORY.animal 也走這支，避免兩處各自算年份
 */
export function shengxiaoOfYear(year: number): SxType {
  const num = Math.trunc(Number(year))
  const index = Number.isFinite(num) ? ((num - 2020) % 12 + 12) % 12 : 0
  return SX[index] as SxType
}

/**
 * 取某生肖在指定年份的號碼清單
 *
 * ⚠️ 與五行同樣逐年輪轉：01 對應當年生肖、往回推，49 也歸當年生肖，
 *    因此「當年生肖有 5 個號、其餘 11 個各 4 個」，且是哪一個有 5 個每年都不同。
 *    號碼與賠率都不可寫死，結算舊期一律用該期年份的表。
 * @param animal 生肖中文名（鼠 / 牛 / …）
 * @param year 西元年
 * @returns 補零且由小到大的號碼；無效生肖回空陣列
 */
export function shengxiaoNumsOf(animal: string, year: number): string[] {
  const table = shengxiaoAll(shengxiaoOfYear(year))
  const nums = table[String(animal ?? '').trim()] ?? []
  return nums
    .map((num) => String(Number(num)).padStart(2, '0'))
    .sort((a, b) => Number(a) - Number(b))
}

// ── 特肖 / 一肖玩法（6hc-cd）賠率 ─────────────────────────────────
// ⚠️ 這兩個玩法很容易混為一談，但看的球數不同，賠率差 5 倍以上：
//
//   特肖  只看「特別號」一顆球是否屬該生肖
//         中   中獎面 4 ~ 5 個號        → 11.88 / 9.51
//         不中 中獎面 44 ~ 45 個號      → 1.06 / 1.08
//
//   一肖  看「7 顆球（6 正碼 + 特別號）」中該生肖是否出現過
//         中   P = 1 - C(49-k, 7)/C(49, 7) → 2.06（4 個號）/ 1.75（5 個號）
//         不中 P = C(49-k, 7)/C(49, 7)     → 1.84 / 2.17
//
//   一肖其實就是連肖的 n = 1 特例，故直接沿用 creditLianxiaoHitRate /
//   creditLianxiaoOddsOf 的容斥公式，不另寫一份機率計算。

/** 注項的命中方向：hit = 開出即中、miss = 沒開出才中 */
export type CreditMatchMode = 'hit' | 'miss'

/** 分頁未設定 payout.rtp 時的預設回報率 */
export const CREDIT_YIXIAO_RTP_FALLBACK = 0.97

/**
 * 取特肖注項賠率（含本金）—— 只看特別號
 * @param animal 生肖中文名
 * @param year 該期年份（生肖表逐年輪轉，一定要帶對）
 * @param mode hit = 特肖中、miss = 特肖不中
 * @param rtp 分頁設定的回報率
 */
export function creditTexiaoOddsOf(
  animal: string,
  year: number,
  mode: CreditMatchMode = 'hit',
  rtp: number = CREDIT_YIXIAO_RTP_FALLBACK
): number {
  const count = shengxiaoNumsOf(animal, year).length
  if (!(count > 0)) return 0
  // 特肖不中的中獎面是「該生肖以外的所有號碼」
  const winCount = mode === 'miss' ? 49 - count : count
  if (!(winCount > 0)) return 0
  const safeRtp = Number(rtp) > 0 ? Number(rtp) : CREDIT_YIXIAO_RTP_FALLBACK
  return Number((safeRtp * 49 / winCount).toFixed(2))
}

/**
 * 取一肖注項賠率（含本金）—— 看 7 顆球
 *
 * 一肖 = 連肖的 n = 1 特例（該生肖在 7 顆球中出現過），
 * 故直接委派給 creditLianxiaoOddsOf，機率公式只維護一份。
 * @param animal 生肖中文名
 * @param year 該期年份
 * @param mode hit = 一肖中（出現過）、miss = 一肖不中（都沒出現）
 * @param rtp 分頁設定的回報率
 */
export function creditYixiaoOddsOf(
  animal: string,
  year: number,
  mode: CreditMatchMode = 'hit',
  rtp: number = CREDIT_YIXIAO_RTP_FALLBACK
): number {
  const name = String(animal ?? '').trim()
  if (!name) return 0
  return creditLianxiaoOddsOf([name], year, mode, rtp)
}

// ── 合肖玩法（6hc-cd）賠率 ────────────────────────────────────────
// 選 n 個生肖組成一組，看「特別號的生肖」在不在這組裡面。
//
// ⚠️ 與連肖是完全不同的判定，別搞混：
//     合肖 只看特別號一顆球，所選生肖是「或」的關係（任一命中即中）
//     連肖 看 7 顆球，所選生肖是「且」的關係（全部出現才中）
//    也因此合肖的中／不中是嚴格互補（特別號的生肖非在即不在），
//    連肖則不是（中間夾著「部分出現」）。
//
// 機率 = 所選生肖的號碼總數 / 49，故賠率 = rtp × 49 / Σ號碼數（不中則除以 49 - Σ）。

/**
 * 取合肖注項賠率（含本金）
 * @param animals 該注所選的生肖（不重複）
 * @param year 該期年份（決定哪個生肖有 5 個號）
 * @param mode hit = 特別號屬所選生肖之一、miss = 都不屬
 * @param rtp 分頁設定的回報率
 */
export function creditHexiaoOddsOf(
  animals: string[],
  year: number,
  mode: CreditMatchMode = 'hit',
  rtp: number = CREDIT_YIXIAO_RTP_FALLBACK
): number {
  const list = Array.from(new Set((Array.isArray(animals) ? animals : []).map((a) => String(a).trim())))
  if (list.length === 0 || list.length !== (animals?.length ?? 0)) return 0
  const sizes = list.map((animal) => shengxiaoNumsOf(animal, year).length)
  if (sizes.some((size) => size <= 0)) return 0
  const covered = sizes.reduce((sum, size) => sum + size, 0)
  // 中：特別號落在所選生肖的號碼裡；不中：落在其餘號碼裡（兩者互補）
  const winCount = mode === 'miss' ? 49 - covered : covered
  if (!(winCount > 0)) return 0
  const safeRtp = Number(rtp) > 0 ? Number(rtp) : CREDIT_YIXIAO_RTP_FALLBACK
  return Number((safeRtp * 49 / winCount).toFixed(2))
}

// ── 連肖玩法（6hc-cd）賠率 ────────────────────────────────────────
// 選 n 個生肖，n 個「全部」出現在 7 顆球中才中獎（連不中則是全部都不出現）。
//
// ⚠️ 賠率取決於「所選的那幾個生肖」而非單一注項 —— 含當年生肖（5 個號）與否，
//    公平賠率會差到兩成（二肖 4.87 vs 4.12、五肖 128.86 vs 105.94），
//    所以不能像半波那樣把賠率寫在 config 的注項上，必須逐注推算。

/** 開獎球數（6 正碼 + 特別號） */
const LHC_DRAW_COUNT = 7

/** 組合數 C(n, k) */
const _combination = (n: number, k: number): number => {
  if (k < 0 || k > n) return 0
  let result = 1
  for (let i = 1; i <= k; i++) result = (result * (n - k + i)) / i
  return Math.round(result)
}

/**
 * 一組生肖「全部出現」在 7 顆球中的機率（容斥原理）
 *
 *   P(全部出現) = Σ_{S⊆所選} (-1)^|S| × C(49 - Σk_S, 7) / C(49, 7)
 *
 * @param animals 生肖中文名清單（不重複）
 * @param year 該期年份（決定哪個生肖有 5 個號）
 * @returns 命中機率；生肖無效或重複回 0
 */
export function creditLianxiaoHitRate(animals: string[], year: number): number {
  const list = Array.from(new Set((Array.isArray(animals) ? animals : []).map((a) => String(a).trim())))
  if (list.length === 0 || list.length !== (animals?.length ?? 0)) return 0
  const sizes = list.map((animal) => shengxiaoNumsOf(animal, year).length)
  if (sizes.some((size) => size <= 0)) return 0
  const total = _combination(49, LHC_DRAW_COUNT)
  let sum = 0
  // 走訪所有子集：子集內的生肖視為「完全沒開出」
  for (let mask = 0; mask < (1 << sizes.length); mask++) {
    let excluded = 0
    let bits = 0
    for (let i = 0; i < sizes.length; i++) {
      if (mask & (1 << i)) { excluded += sizes[i] as number; bits++ }
    }
    sum += (bits % 2 === 1 ? -1 : 1) * _combination(49 - excluded, LHC_DRAW_COUNT)
  }
  return sum / total
}

/**
 * 取連肖注項賠率（含本金）
 * @param animals 該注所選的生肖
 * @param year 該期年份
 * @param mode hit = 全部出現才中、miss = 全部都不出現才中
 * @param rtp 分頁設定的回報率
 */
export function creditLianxiaoOddsOf(
  animals: string[],
  year: number,
  mode: CreditMatchMode = 'hit',
  rtp: number = CREDIT_YIXIAO_RTP_FALLBACK
): number {
  const hitRate = creditLianxiaoHitRate(animals, year)
  if (!(hitRate > 0) || hitRate >= 1) return 0
  // 連不中的中獎機率不是 1 - P(全部出現)，而是「一個都沒出現」
  const rate = mode === 'miss'
    ? _combination(49 - animals.reduce((sum, a) => sum + shengxiaoNumsOf(a, year).length, 0), LHC_DRAW_COUNT)
      / _combination(49, LHC_DRAW_COUNT)
    : hitRate
  if (!(rate > 0)) return 0
  const safeRtp = Number(rtp) > 0 ? Number(rtp) : CREDIT_YIXIAO_RTP_FALLBACK
  return Number((safeRtp / rate).toFixed(2))
}

// ── 尾數玩法（6hc-cd）賠率 ────────────────────────────────────────
// 以特別號的尾數（個位數 0 ~ 9）結算，性質同一肖／特肖（一組固定號碼對特別號）。
//
// ⚠️ 與生肖／五行的差別：尾數分布是固定的（0尾 4 個號、其餘 9 個尾各 5 個號），
//    不隨年份輪轉，所以不需要年份參數，見 weishuAll。
//
// 分為「尾數中」（特別號尾數屬該尾即中）與「尾數不中」（不屬才中）兩個分頁，
// 兩者共用同一份號碼但中獎方向相反，機率相加恰為 100%（嚴格互補，同一肖中／不中）。
//
// 賠率公式：中 = rtp × 49 / 該尾號碼數；不中 = rtp × 49 / (49 - 該尾號碼數)
// 不設和局：49 屬 9 尾，已落在既有注項內。

/** 分頁未設定 payout.rtp 時的預設回報率 */
export const CREDIT_WEISHU_RTP_FALLBACK = 0.97

/**
 * 取尾數注項賠率（含本金）
 * @param betCode 尾數（0尾 / 1尾 / … / 9尾）
 * @param mode hit = 尾數中、miss = 尾數不中
 * @param rtp 分頁設定的回報率
 */
export function creditWeishuOddsOf(
  betCode: string | number,
  mode: CreditMatchMode = 'hit',
  rtp: number = CREDIT_WEISHU_RTP_FALLBACK
): number {
  const nums = weishuAll[String(betCode ?? '').trim()] ?? []
  if (nums.length === 0) return 0
  // 中：特別號尾數落在所選尾的號碼裡；不中：落在其餘號碼裡（兩者互補）
  const winCount = mode === 'miss' ? 49 - nums.length : nums.length
  if (!(winCount > 0)) return 0
  const safeRtp = Number(rtp) > 0 ? Number(rtp) : CREDIT_WEISHU_RTP_FALLBACK
  return Number((safeRtp * 49 / winCount).toFixed(2))
}

// ── 連尾玩法（6hc-cd）賠率 ────────────────────────────────────────
// 選 n 個尾數，看它們在當期 7 顆球（6 正碼 + 特別號）中的出現情況 —— 與連肖同類，
// 差別只在號碼分組依據（尾數固定分布，不隨年份變動，故公式不需要年份參數）：
//   連中   n 個尾數全部出現才中
//   連不中 n 個尾數一個都沒出現才中
//
// ⚠️ 「連不中」不是「連中」的反面（同連肖），中間夾著「部分出現」，兩者機率相加 < 100%。
//
// ⚠️ 結構與 c_lianxiao 同類：注項是玩家組出來的（C(10,n) 種組合），不可列舉，
//    所以 tabGroup 只是「尾數選取池」，實際一注由 settings.combo.pick 個尾數組成。
//
// ⚠️ 賠率不能寫死在分頁上 —— 尾數號碼數不均（0尾 4 個、其餘 5 個），
//    選到 0尾 與否會讓機率跟著變，故改設 rtp，由
//    creditLianweiOddsOf(所選尾數, match, rtp) 逐注推算後鎖進注單。
//
// 機率（容斥，公式同 creditLianxiaoHitRate，只是號碼數改讀 weishuAll）：
//   連中   P = Σ_{S⊆所選} (-1)^|S| × C(49 - Σk_S, 7) / C(49, 7)
//   連不中 P = C(49 - Σk_全部, 7) / C(49, 7)
// 兩者皆不設和局。

/**
 * 一組尾數「全部出現」在 7 顆球中的機率（容斥原理）
 * @param tails 尾數清單（0尾 ~ 9尾，不重複）
 * @returns 命中機率；尾數無效或重複回 0
 */
export function creditLianweiHitRate(tails: string[]): number {
  const list = Array.from(new Set((Array.isArray(tails) ? tails : []).map((t) => String(t).trim())))
  if (list.length === 0 || list.length !== (tails?.length ?? 0)) return 0
  const sizes = list.map((tail) => (weishuAll[tail] ?? []).length)
  if (sizes.some((size) => size <= 0)) return 0
  const total = _combination(49, LHC_DRAW_COUNT)
  let sum = 0
  // 走訪所有子集：子集內的尾數視為「完全沒開出」
  for (let mask = 0; mask < (1 << sizes.length); mask++) {
    let excluded = 0
    let bits = 0
    for (let i = 0; i < sizes.length; i++) {
      if (mask & (1 << i)) { excluded += sizes[i] as number; bits++ }
    }
    sum += (bits % 2 === 1 ? -1 : 1) * _combination(49 - excluded, LHC_DRAW_COUNT)
  }
  return sum / total
}

/**
 * 取連尾注項賠率（含本金）
 * @param tails 該注所選的尾數
 * @param mode hit = 全部出現才中、miss = 全部都不出現才中
 * @param rtp 分頁設定的回報率
 */
export function creditLianweiOddsOf(
  tails: string[],
  mode: CreditMatchMode = 'hit',
  rtp: number = CREDIT_WEISHU_RTP_FALLBACK
): number {
  const hitRate = creditLianweiHitRate(tails)
  if (!(hitRate > 0) || hitRate >= 1) return 0
  // 連不中的中獎機率不是 1 - P(全部出現)，而是「一個都沒出現」
  const rate = mode === 'miss'
    ? _combination(49 - tails.reduce((sum, t) => sum + (weishuAll[String(t).trim()] ?? []).length, 0), LHC_DRAW_COUNT)
      / _combination(49, LHC_DRAW_COUNT)
    : hitRate
  if (!(rate > 0)) return 0
  const safeRtp = Number(rtp) > 0 ? Number(rtp) : CREDIT_WEISHU_RTP_FALLBACK
  return Number((safeRtp / rate).toFixed(2))
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
/** 玩法頁上方的玩法分頁；順序需與 shared/config/cd/plays.ts 一致 */
export const CREDIT_PLAY_DEFINITIONS: TypePlayItem[] = [
  { key: 'tema', name: '特碼' },
  { key: 'zhengma', name: '正碼' },
  { key: 'zhengmate', name: '正碼特' },
  { key: 'lianma', name: '連碼' },
  { key: 'qima', name: '七碼' },
  { key: 'wuxing', name: '五行' },
  { key: 'banbo', name: '半波' },
  { key: 'yixiao', name: '一肖' },
  { key: 'texiao', name: '特肖' },
  { key: 'hexiao', name: '合肖' },
  { key: 'lianxiao', name: '連肖' },
  { key: 'weishu', name: '尾數' },
  { key: 'lianwei', name: '連尾' },
  { key: 'zixuanbuzhong', name: '全不中' },
  { key: 'duoxuanzhongyi', name: '中一' },
  { key: 'zhengterenzhong', name: '特平中' },
  { key: 'ixiaolian', name: '一肖量' },
  { key: 'weishulian', name: '尾數量' },
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
  /** 命中檔次 key（僅多檔玩法如連碼會有，未中為空） */
  tier?: string
  /** 命中檔次名稱（供注單／紀錄顯示，如「中三」） */
  tierName?: string
  /** 命中檔次的爆池分配權重（僅多檔玩法會有） */
  weight?: number
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

// ── 五行玩法（6hc-cd）賠率與中獎判定 ──────────────────────────────
// 以特別號（openCode[6]）所屬五行結算，性質與色波相同。
// 差別在於：色波的號碼分布固定（紅 17 / 藍 16 / 綠 16），賠率可以寫死；
// 五行逐年輪轉，各組號碼數在 8 ~ 12 之間變動 —— 同一個賠率在不同年份的抽水率會差到兩成，
// 所以賠率改由「該年該五行的號碼數」推算：
//
//     odds = rtp × 49 / 該五行號碼數
//
// rtp 由分頁設定提供（c_wuxing.js 的 settings.payout.rtp），config 不放 odds。
// 下注時算出的賠率一樣會鎖進注單，結算即以注單上的值派彩，跨年也不受影響。

/** 分頁未設定 payout.rtp 時的預設回報率 */
export const CREDIT_WUXING_RTP_FALLBACK = 0.97

/**
 * 取五行注項賠率（含本金）
 * @param betCode 五行中文名（金 / 木 / 水 / 火 / 土）
 * @param year 該期年份（五行表逐年輪轉，一定要帶對）
 * @param rtp 分頁設定的回報率
 * @returns 賠率；無法辨識回 0
 */
export function creditWuxingOddsOf(
  betCode: string | number,
  year: number,
  rtp: number = CREDIT_WUXING_RTP_FALLBACK
): number {
  const key = WUXING_KEYS[String(betCode ?? '').trim()]
  if (!key) return 0
  const count = wuxingAll(year)[key].length
  if (!(count > 0)) return 0
  const safeRtp = Number(rtp) > 0 ? Number(rtp) : CREDIT_WUXING_RTP_FALLBACK
  return Number((safeRtp * 49 / count).toFixed(2))
}

/**
 * 五行玩法中獎判定（以特別號所屬五行結算，不設和局）
 * @param betCode 五行中文名（金 / 木 / 水 / 火 / 土）
 * @param openCode 該期完整開獎號（7 顆：6 正碼 + 特別號）
 * @param coin 該注注金
 * @param year 該期年份
 * @param rtp 分頁設定的回報率
 */
export function judgeCreditWuxingBet(
  betCode: string | number,
  openCode: Array<string | number>,
  coin: number,
  year: number,
  rtp: number = CREDIT_WUXING_RTP_FALLBACK
): CreditJudgeResult | null {
  const key = WUXING_KEYS[String(betCode ?? '').trim()]
  if (!key) return null
  const special = Number((Array.isArray(openCode) ? openCode : [])[6])
  if (!Number.isFinite(special) || special <= 0) return null
  const odds = creditWuxingOddsOf(betCode, year, rtp)
  if (!(odds > 0)) return null
  const hit = wuxingAll(year)[key].includes(String(special).padStart(2, '0'))
  // 與色波同類（一組號碼對特別號），爆池分配沿用 color 權重
  return _payout('color', hit ? 'win' : 'lose', odds, coin)
}

// ── 半波玩法（6hc-cd）賠率與中獎判定 ──────────────────────────────
// 以特別號結算，性質同色波：注項 = 色波 ∩ 大小／單雙 的號碼集合（見 banboNumsOf）。
// 各注項號碼數不同（7 ~ 10 個），所以賠率逐項不同，不能整組共用一個值。
// 色波分布固定，不像五行逐年輪轉，故不需要年份參數。
// 不設和局：49 屬綠波且為單、為大，已落在既有注項內。

/**
 * 取半波注項賠率（含本金）
 * 以理論值（49 / 該注項號碼數）×0.97 推算，與 c_banbo.ts 的 odds 同一組數字；
 * 正式取值仍以分頁 config 的 odds 為主，這裡是取不到時的退回值。
 */
export function creditBanboOddsOf(betCode: string | number): number {
  const nums = banboNumsOf(String(betCode ?? ''))
  if (nums.length === 0) return 0
  return Number((0.97 * 49 / nums.length).toFixed(2))
}

/**
 * 半波玩法中獎判定（特別號落在該注項的號碼集合內即中）
 * @param betCode 注項名（紅大 / 綠單 / 藍雙…）
 * @param openCode 該期完整開獎號（7 顆：6 正碼 + 特別號）
 * @param coin 該注注金
 */
export function judgeCreditBanboBet(
  betCode: string | number,
  openCode: Array<string | number>,
  coin: number
): CreditJudgeResult | null {
  const nums = banboNumsOf(String(betCode ?? ''))
  if (nums.length === 0) return null
  const special = Number((Array.isArray(openCode) ? openCode : [])[6])
  if (!Number.isFinite(special) || special <= 0) return null
  const odds = creditBanboOddsOf(betCode)
  if (!(odds > 0)) return null
  const hit = nums.includes(String(special).padStart(2, '0'))
  // 與色波同類（一組號碼對特別號），爆池分配沿用 color 權重
  return _payout('color', hit ? 'win' : 'lose', odds, coin)
}

// ── 特肖玩法（6hc-cd）中獎判定 ────────────────────────────────────
// 只看「特別號」所屬生肖，性質同五行／半波（一組號碼對特別號）。
// 兩個方向共用同一份號碼但中獎方向相反：
//   特肖中   特別號「屬」該生肖 → 中（中獎面 4 ~ 5 個號）
//   特肖不中 特別號「不屬」該生肖 → 中（中獎面 44 ~ 45 個號）
// 號碼與賠率都逐年輪轉，故一定要帶該期年份，不可用「今年」結算舊期。

/**
 * 特肖玩法中獎判定（不設和局；49 已歸屬當年生肖）
 * @param betCode 生肖中文名（鼠 / 牛 / …）
 * @param openCode 該期完整開獎號（7 顆：6 正碼 + 特別號）
 * @param coin 該注注金
 * @param year 該期年份
 * @param mode hit = 特肖中、miss = 特肖不中
 * @param rtp 分頁設定的回報率
 */
export function judgeCreditTexiaoBet(
  betCode: string | number,
  openCode: Array<string | number>,
  coin: number,
  year: number,
  mode: CreditMatchMode = 'hit',
  rtp: number = CREDIT_YIXIAO_RTP_FALLBACK
): CreditJudgeResult | null {
  const animal = String(betCode ?? '').trim()
  const nums = shengxiaoNumsOf(animal, year)
  if (nums.length === 0) return null
  const special = Number((Array.isArray(openCode) ? openCode : [])[6])
  if (!Number.isFinite(special) || special <= 0) return null
  const odds = creditTexiaoOddsOf(animal, year, mode, rtp)
  if (!(odds > 0)) return null
  const belongs = nums.includes(String(special).padStart(2, '0'))
  // 特肖不中把命中方向反過來
  const hit = mode === 'miss' ? !belongs : belongs
  // 與五行／半波同類（一組號碼對特別號），爆池分配沿用 color 權重
  return _payout('color', hit ? 'win' : 'lose', odds, coin)
}

// ── 一肖玩法（6hc-cd）中獎判定 ────────────────────────────────────
// ⚠️ 看「7 顆球（6 正碼 + 特別號）」中該生肖是否出現過 —— 與特肖只看特別號不同：
//   一肖中   該生肖在 7 顆球中出現過 → 中（機率約 47% / 55%）
//   一肖不中 7 顆球都沒出現該生肖   → 中
// 一肖 = 連肖的 n = 1 特例，故直接委派給 judgeCreditLianxiaoBet，判定邏輯只維護一份。

/**
 * 一肖玩法中獎判定（不設和局）
 * @param betCode 生肖中文名（鼠 / 牛 / …）
 * @param openCode 該期完整開獎號（7 顆：6 正碼 + 特別號）
 * @param coin 該注注金
 * @param year 該期年份
 * @param mode hit = 一肖中（出現過）、miss = 一肖不中（都沒出現）
 * @param rtp 分頁設定的回報率
 */
export function judgeCreditYixiaoBet(
  betCode: string | number,
  openCode: Array<string | number>,
  coin: number,
  year: number,
  mode: CreditMatchMode = 'hit',
  rtp: number = CREDIT_YIXIAO_RTP_FALLBACK
): CreditJudgeResult | null {
  const animal = String(betCode ?? '').trim()
  if (!animal) return null
  return judgeCreditLianxiaoBet([animal], openCode, coin, year, mode, rtp)
}

// ── 合肖玩法（6hc-cd）中獎判定 ────────────────────────────────────
// 只看特別號一顆球：所選生肖是「或」的關係，特別號的生肖「屬於」所選集合（hit＝合肖中）
// 或「都不屬於」（miss＝合肖不中）即中，不設和局。
/**
 * 合肖玩法中獎判定
 * @param animals 該注所選的生肖（不重複，數量須等於分頁 combo.pick）
 * @param openCode 該期完整開獎號（7 顆：6 正碼 + 特別號）
 * @param coin 該注注金
 * @param year 該期年份（生肖號碼表逐年輪轉）
 * @param mode hit = 合肖中、miss = 合肖不中
 * @param rtp 分頁設定的回報率
 */
export function judgeCreditHexiaoBet(
  animals: string[],
  openCode: Array<string | number>,
  coin: number,
  year: number,
  mode: CreditMatchMode = 'hit',
  rtp: number = CREDIT_YIXIAO_RTP_FALLBACK
): CreditJudgeResult | null {
  const list = Array.from(new Set((Array.isArray(animals) ? animals : []).map((a) => String(a).trim()).filter(Boolean)))
  if (list.length === 0 || list.length !== (animals?.length ?? 0)) return null
  const special = Number((Array.isArray(openCode) ? openCode : [])[6])
  if (!Number.isFinite(special) || special <= 0) return null
  const odds = creditHexiaoOddsOf(list, year, mode, rtp)
  if (!(odds > 0)) return null
  const specialCode = String(special).padStart(2, '0')
  const belongs = list.some((animal) => shengxiaoNumsOf(animal, year).includes(specialCode))
  const hit = mode === 'miss' ? !belongs : belongs
  // 與五行／半波／一肖同類（一組號碼對特別號），爆池分配沿用 color 權重
  return _payout('color', hit ? 'win' : 'lose', odds, coin)
}

// ── 連肖玩法（6hc-cd）中獎判定 ────────────────────────────────────
// 看整期 7 顆球：所選生肖是「且」的關係，全部出現才中（hit＝連中）、
// 全部都沒出現才中（miss＝連不中），不設和局。中間夾著「部分出現」，兩者機率相加 < 100%。
/**
 * 連肖玩法中獎判定
 * @param animals 該注所選的生肖（不重複，數量須等於分頁 combo.pick）
 * @param openCode 該期完整開獎號（7 顆：6 正碼 + 特別號）
 * @param coin 該注注金
 * @param year 該期年份
 * @param mode hit = 連中（全部出現）、miss = 連不中（全部都不出現）
 * @param rtp 分頁設定的回報率
 */
export function judgeCreditLianxiaoBet(
  animals: string[],
  openCode: Array<string | number>,
  coin: number,
  year: number,
  mode: CreditMatchMode = 'hit',
  rtp: number = CREDIT_YIXIAO_RTP_FALLBACK
): CreditJudgeResult | null {
  const list = Array.from(new Set((Array.isArray(animals) ? animals : []).map((a) => String(a).trim()).filter(Boolean)))
  if (list.length === 0 || list.length !== (animals?.length ?? 0)) return null
  const opened = (Array.isArray(openCode) ? openCode : [])
    .map((code) => Number(code))
    .filter((num) => Number.isFinite(num) && num > 0)
  if (opened.length === 0) return null
  const odds = creditLianxiaoOddsOf(list, year, mode, rtp)
  if (!(odds > 0)) return null
  const openedCodes = new Set(opened.map((num) => String(num).padStart(2, '0')))
  const appears = (animal: string) => shengxiaoNumsOf(animal, year).some((num) => openedCodes.has(num))
  const hit = mode === 'miss' ? list.every((animal) => !appears(animal)) : list.every((animal) => appears(animal))
  // 連碼同類（一注帶一組號碼，非單一號碼對特別號），爆池分配沿用 number 權重
  return _payout('number', hit ? 'win' : 'lose', odds, coin)
}

// ── 尾數玩法（6hc-cd）中獎判定 ────────────────────────────────────
// 以特別號所屬尾數結算，性質同五行／半波／一肖（一組固定號碼對特別號）。
// 兩個分頁共用同一份號碼但中獎方向相反：
//   尾數中   特別號的尾數「屬」該尾 → 中（中獎面 4 ~ 5 個號）
//   尾數不中 特別號的尾數「不屬」該尾 → 中（中獎面 44 ~ 45 個號）
// 尾數分布固定，不像生肖逐年輪轉，故不需要年份參數。

/**
 * 尾數玩法中獎判定（不設和局；49 屬 9 尾，已落在既有注項內）
 * @param betCode 尾數（0尾 / 1尾 / … / 9尾）
 * @param openCode 該期完整開獎號（7 顆：6 正碼 + 特別號）
 * @param coin 該注注金
 * @param mode hit = 尾數中、miss = 尾數不中
 * @param rtp 分頁設定的回報率
 */
export function judgeCreditWeishuBet(
  betCode: string | number,
  openCode: Array<string | number>,
  coin: number,
  mode: CreditMatchMode = 'hit',
  rtp: number = CREDIT_WEISHU_RTP_FALLBACK
): CreditJudgeResult | null {
  const tail = String(betCode ?? '').trim()
  const nums = weishuAll[tail] ?? []
  if (nums.length === 0) return null
  const special = Number((Array.isArray(openCode) ? openCode : [])[6])
  if (!Number.isFinite(special) || special <= 0) return null
  const odds = creditWeishuOddsOf(tail, mode, rtp)
  if (!(odds > 0)) return null
  const belongs = nums.includes(String(special).padStart(2, '0'))
  // 尾數不中把命中方向反過來
  const hit = mode === 'miss' ? !belongs : belongs
  // 與五行／半波／一肖同類（一組號碼對特別號），爆池分配沿用 color 權重
  return _payout('color', hit ? 'win' : 'lose', odds, coin)
}

// ── 連尾玩法（6hc-cd）中獎判定 ────────────────────────────────────
// 看整期 7 顆球：所選尾數是「且」的關係，全部出現才中（hit＝連中）、
// 全部都沒出現才中（miss＝連不中），不設和局。中間夾著「部分出現」，兩者機率相加 < 100%。
/**
 * 連尾玩法中獎判定
 * @param tails 該注所選的尾數（不重複，數量須等於分頁 combo.pick）
 * @param openCode 該期完整開獎號（7 顆：6 正碼 + 特別號）
 * @param coin 該注注金
 * @param mode hit = 連中（全部出現）、miss = 連不中（全部都不出現）
 * @param rtp 分頁設定的回報率
 */
export function judgeCreditLianweiBet(
  tails: string[],
  openCode: Array<string | number>,
  coin: number,
  mode: CreditMatchMode = 'hit',
  rtp: number = CREDIT_WEISHU_RTP_FALLBACK
): CreditJudgeResult | null {
  const list = Array.from(new Set((Array.isArray(tails) ? tails : []).map((t) => String(t).trim()).filter(Boolean)))
  if (list.length === 0 || list.length !== (tails?.length ?? 0)) return null
  const opened = (Array.isArray(openCode) ? openCode : [])
    .map((code) => Number(code))
    .filter((num) => Number.isFinite(num) && num > 0)
  if (opened.length === 0) return null
  const odds = creditLianweiOddsOf(list, mode, rtp)
  if (!(odds > 0)) return null
  const openedCodes = new Set(opened.map((num) => String(num).padStart(2, '0')))
  const appears = (tail: string) => (weishuAll[tail] ?? []).some((num) => openedCodes.has(num))
  const hit = mode === 'miss' ? list.every((tail) => !appears(tail)) : list.every((tail) => appears(tail))
  // 連碼同類（一注帶一組號碼，非單一號碼對特別號），爆池分配沿用 number 權重
  return _payout('number', hit ? 'win' : 'lose', odds, coin)
}

// ── 自選號碼組合玩法（全不中 / 中一 / 特平中）中獎判定 ──────────────
// 三者都是「選 N 個號，看它們在 7 顆球中的出現情況」，只有命中方向不同：
//   全不中   miss  一個都沒有命中才中（機率 C(49-N,7)/C(49,7)）
//   中一     hit   至少一個命中即中（1 - 上式，與全不中嚴格互補）
//   特平中   hit   同中一，只是選號數範圍不同（1~5 vs 5~10）
//
// 所有號碼的機率相同，賠率不隨所選號碼變動，故 config 把單一賠率放在 tiers（同連碼），
// 判定只需取 tiers[0]。方向由分頁的 settings.match 決定。

/**
 * 自選號碼組合玩法中獎判定（不設和局）
 * @param betCodes 該注所選的號碼（不重複，數量須等於分頁 combo.pick）
 * @param openCode 該期完整開獎號（7 顆：6 正碼 + 特別號）
 * @param coin 該注注金
 * @param tiers 下注時鎖在注單上的檔次表（這三個玩法只會有一檔）
 * @param mode hit = 至少一個命中、miss = 一個都沒命中
 */
export function judgeCreditPickBet(
  betCodes: Array<string | number>,
  openCode: Array<string | number>,
  coin: number,
  tiers: CreditLianmaTier[],
  mode: CreditMatchMode = 'hit'
): CreditJudgeResult | null {
  const raw = Array.isArray(betCodes) ? betCodes : []
  const nums = raw.map((code) => Number(code))
  // 任一注碼無效就整注拒判（不可 filter 掉 —— 那會讓「含 50」的注剩 4 個號後照樣判成中獎）
  if (nums.length === 0) return null
  if (nums.some((num) => !Number.isInteger(num) || num < 1 || num > 49)) return null
  if (new Set(nums).size !== nums.length) return null
  const opened = new Set(
    (Array.isArray(openCode) ? openCode : [])
      .map((code) => Number(code))
      .filter((num) => Number.isFinite(num) && num > 0)
  )
  if (opened.size === 0) return null
  const tier = (Array.isArray(tiers) ? tiers : []).find((item) => Number(item?.odds) > 0)
  if (!tier) return null
  const anyHit = nums.some((num) => opened.has(num))
  const hit = mode === 'miss' ? !anyHit : anyHit
  const result = _payout('number', hit ? 'win' : 'lose', Number(tier.odds), coin)
  return { ...result, tier: String(tier.key ?? ''), tierName: String(tier.name ?? ''), weight: Number(tier.weight ?? 0) }
}

// ── 一肖量 / 尾數量（6hc-cd）中獎判定 ─────────────────────────────
// 押「7 顆球共涵蓋幾個生肖 / 幾個尾數」，注項是數量（2肖 ~ 7肖、2尾 ~ 7尾）。
//
// ⚠️ 與一肖／尾數完全不同 —— 那些是押「某個生肖／某個尾」，這裡押的是「種類數」。
// 賠率寫在 config 的注項上（各注項難易差距極大），故由呼叫端帶入。

/** 取一組開獎號涵蓋的生肖數（依該期年份的生肖表） */
export function creditShengxiaoCountOf(openCode: Array<string | number>, year: number): number {
  const opened = (Array.isArray(openCode) ? openCode : [])
    .map((code) => Number(code))
    .filter((num) => Number.isFinite(num) && num > 0)
    .map((num) => String(num).padStart(2, '0'))
  if (opened.length === 0) return 0
  const table = shengxiaoAll(shengxiaoOfYear(year))
  const hit = new Set<string>()
  Object.entries(table).forEach(([animal, nums]) => {
    const padded = nums.map((num) => String(Number(num)).padStart(2, '0'))
    if (opened.some((code) => padded.includes(code))) hit.add(animal)
  })
  return hit.size
}

/** 取一組開獎號涵蓋的尾數個數 */
export function creditWeishuCountOf(openCode: Array<string | number>): number {
  const tails = (Array.isArray(openCode) ? openCode : [])
    .map((code) => Number(code))
    .filter((num) => Number.isFinite(num) && num > 0)
    .map((num) => num % 10)
  return new Set(tails).size
}

/**
 * 一肖量 / 尾數量中獎判定（不設和局）
 * @param betCode 注項名（"4肖" / "5尾"）
 * @param openCode 該期完整開獎號（7 顆）
 * @param coin 該注注金
 * @param odds 該注項賠率（來自 config，由呼叫端帶入）
 * @param year 該期年份（一肖量需要；尾數量不使用）
 */
export function judgeCreditCountBet(
  betCode: string | number,
  openCode: Array<string | number>,
  coin: number,
  odds: number,
  year: number
): CreditJudgeResult | null {
  const code = String(betCode ?? '').trim()
  const matched = /^(\d+)(肖|尾)$/.exec(code)
  if (!matched) return null
  if (!(Number(odds) > 0)) return null
  const want = Number(matched[1])
  const actual = matched[2] === '肖'
    ? creditShengxiaoCountOf(openCode, year)
    : creditWeishuCountOf(openCode)
  if (!(actual > 0)) return null
  // 與色波同類（一組固定條件對整期開獎），爆池分配沿用 color 權重
  return _payout('color', actual === want ? 'win' : 'lose', Number(odds), coin)
}

// ── 連碼玩法（6hc-cd）判定 ────────────────────────────────────────
// 連碼與前四個玩法最大的差異：一注帶「一組號碼」而非單一注項，
// 而且同一注有多種中法（三中二可能中三或中二），賠率在開獎後才確定。
// 因此賠率不由本檔常數提供，而是下注時把分頁的 tiers 快照鎖在注單上，
// 結算時依命中檔次取值 —— 本檔只負責「命中了哪一檔」。

/** 一組注碼對開獎號的命中統計 */
export type CreditLianmaHit = {
  /** 命中的正碼數（openCode[0..5]） */
  normal: number
  /** 是否命中特別號（0 / 1） */
  special: number
  /** 該注的號碼數 */
  total: number
}

/**
 * 連碼各檔次的成立條件（key 對應 c_lianma.js 的 tiers[].key）
 * 每個分頁的注碼數由 settings.combo.pick 固定，故條件只需看命中組成：
 *   all3 / hit3  3 個號全中正碼
 *   all2 / hit2  命中 2 個正碼（二全中／二中特為 2 選 2、三中二為 3 選 2）
 *   hitT / chain 1 個正碼 + 特別號
 */
const CREDIT_LIANMA_TIER_RULES: Record<string, (hit: CreditLianmaHit) => boolean> = {
  all3: (hit) => hit.normal === 3,
  hit3: (hit) => hit.normal === 3,
  all2: (hit) => hit.normal === 2,
  hit2: (hit) => hit.normal === 2,
  hitT: (hit) => hit.normal === 1 && hit.special === 1,
  chain: (hit) => hit.normal === 1 && hit.special === 1,
}

/** 該分頁的 tiers 快照（下注時鎖在注單上，結算以此派彩） */
export type CreditLianmaTier = { key?: string; name?: string; odds?: number; weight?: number }

/** 統計一組注碼命中幾個正碼、是否含特別號 */
export function creditLianmaHitOf(
  betCodes: Array<string | number>,
  openCode: Array<string | number>
): CreditLianmaHit | null {
  const codes = (Array.isArray(betCodes) ? betCodes : [])
    .map((code) => Number(code))
    .filter((num) => Number.isFinite(num) && num > 0)
  // 同一注內號碼不得重複（重複會讓命中數灌水）
  if (codes.length === 0 || new Set(codes).size !== codes.length) return null
  const opened = Array.isArray(openCode) ? openCode : []
  const normals = new Set(
    opened.slice(0, CREDIT_ZHENGMA_NORMAL_COUNT).map((code) => Number(code)).filter((num) => num > 0)
  )
  const special = Number(opened[6])
  if (normals.size !== CREDIT_ZHENGMA_NORMAL_COUNT || !(special > 0)) return null
  return {
    normal: codes.filter((num) => normals.has(num)).length,
    special: codes.includes(special) ? 1 : 0,
    total: codes.length,
  }
}

/**
 * 連碼玩法中獎判定（依分頁 tiers 由高到低比對，第一個成立的檔次即為結果）
 * @param betCodes 該注的號碼組（如 ['03','15','22']）
 * @param openCode 該期完整開獎號（7 顆：6 正碼 + 特別號）
 * @param coin 該注注金
 * @param tiers 下注時鎖在注單上的檔次表（順序即優先序，高賠率在前）
 * @returns 判定結果；注碼或開獎號無效、或 tiers 缺漏時回 null
 */
export function judgeCreditLianmaBet(
  betCodes: Array<string | number>,
  openCode: Array<string | number>,
  coin: number,
  tiers: CreditLianmaTier[]
): CreditJudgeResult | null {
  const list = (Array.isArray(tiers) ? tiers : []).filter((tier) => Number(tier?.odds) > 0)
  if (list.length === 0) return null
  const hit = creditLianmaHitOf(betCodes, openCode)
  if (!hit) return null

  for (const tier of list) {
    const rule = CREDIT_LIANMA_TIER_RULES[String(tier.key ?? '')]
    if (!rule || !rule(hit)) continue
    const result = _payout('number', 'win', Number(tier.odds), coin)
    return { ...result, tier: String(tier.key), tierName: String(tier.name ?? ''), weight: Number(tier.weight ?? 0) }
  }
  // 沒有任何檔次成立 = 未中（連碼不設和局）；賠率取最低檔僅供紀錄顯示
  const lowest = list.reduce((min, tier) => (Number(tier.odds) < Number(min.odds) ? tier : min), list[0]!)
  return _payout('number', 'lose', Number(lowest.odds), coin)
}

// ── 玩法分派（依 play_key 取賠率／判定，供伺端結算與下注紀錄共用） ─────

/**
 * 依玩法取注項賠率；未支援的玩法回 0
 * @param year 五行專用（號碼表逐年輪轉）；不給時以「今年」計算，
 *             結算舊期一定要帶該期年份，否則跨年後賠率會算錯
 */
export function creditOddsOf(playKey: string | undefined, betCode: string | number, year?: number): number {
  switch (String(playKey ?? '')) {
    case 'zhengma': return creditZhengmaOddsOf(betCode)
    case 'zhengmate': return creditZhengmateOddsOf(betCode)
    case 'qima': return creditQimaOddsOf(betCode)
    case 'wuxing': return creditWuxingOddsOf(betCode, Number(year) || new Date().getFullYear())
    case 'banbo': return creditBanboOddsOf(betCode)
    // 一肖／特肖的中／不中方向由分頁設定決定，這裡取不到分頁，一律以「中」計算；
    // 正式取值走 helpers 的 creditTabOddsOf（會帶入 match 與 rtp）
    // ⚠️ 一肖與特肖看的球數不同，公式也不同，不可 fall-through 共用：
    //    特肖只看特別號（rtp × 49 / 該生肖號碼數）、一肖看 7 顆球（連肖 n = 1 的容斥機率）
    case 'texiao': return creditTexiaoOddsOf(String(betCode), Number(year) || new Date().getFullYear())
    case 'yixiao': return creditYixiaoOddsOf(String(betCode), Number(year) || new Date().getFullYear())
    // 合肖／連肖的賠率取決於「所選的那幾個生肖」（一組），單一號碼算不出來，
    // 正式取值走 helpers 的 creditTabOddsOf（會帶入完整 betCodes）
    case 'hexiao':
    case 'lianxiao': return 0
    // 尾數中／不中方向由分頁設定決定，這裡取不到分頁，一律以「中」計算；
    // 正式取值走 helpers 的 creditTabOddsOf（會帶入 match 與 rtp）
    case 'weishu': return creditWeishuOddsOf(betCode)
    // 連尾的賠率取決於「所選的那幾個尾數」（一組），單一號碼算不出來，
    // 正式取值走 helpers 的 creditTabOddsOf（會帶入完整 betCodes）
    case 'lianwei': return 0
    // 連碼的賠率在分頁 tiers（開獎後才知道命中哪一檔），單一號碼沒有賠率。
    // 一定要有這個 case —— 少了它會落到 default 被當成特碼，號碼注項會拿到 48。
    // 全不中／中一／特平中：賠率在分頁 tiers（單一檔次），單一號碼沒有賠率
    case 'zixuanbuzhong':
    case 'duoxuanzhongyi':
    case 'zhengterenzhong': return 0
    // 一肖量／尾數量：賠率寫在 config 的注項上，creditTabOddsOf 直接查得到；
    // 走到這裡代表查不到該注項，回 0 而不是落到 default 被當成特碼（會拿到 48）
    case 'ixiaolian':
    case 'weishulian': return 0
    case 'lianma': return 0
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
  // 五行 / 半波 / 一肖 / 特肖 / 合肖 / 尾數雖然看特別號，但注項是一組號碼（同色波），不算「單號命中」；
  // 連肖 / 連尾看整期 7 顆球，也不是單一號碼命中特別號
  return !['zhengma', 'zhengmate', 'qima', 'lianma', 'wuxing', 'banbo', 'yixiao', 'texiao', 'hexiao', 'lianxiao', 'weishu', 'lianwei',
    'zixuanbuzhong', 'duoxuanzhongyi', 'zhengterenzhong', 'ixiaolian', 'weishulian'].includes(key)
}

/** 依玩法判定單注結果；未支援的玩法回 null（呼叫端視為和局退還本金） */
export function judgeCreditBet(input: {
  playKey?: string
  betCode: string | number
  openCode: Array<string | number>
  coin: number
  /** 該注所屬分頁：正碼特需要靠它決定看哪一顆正碼，其餘玩法可省略 */
  tabId?: number | string
  /** 該注的完整號碼組（連碼一注帶多個號，其餘玩法只有一個、與 betCode 同值） */
  betCodes?: Array<string | number>
  /** 下注時鎖在注單上的檔次表（僅連碼使用） */
  tiers?: CreditLianmaTier[]
  /** 該期年份（五行 / 一肖 / 特肖 / 合肖 / 連肖使用：號碼表逐年輪轉，結算舊期須帶該期年份而非今年） */
  year?: number
  /** 分頁設定的回報率（五行 / 一肖 / 特肖 / 合肖 / 連肖 / 尾數 / 連尾使用） */
  rtp?: number
  /** 命中方向（一肖 / 特肖 / 合肖 / 連肖 / 尾數 / 連尾使用：xx不中要把判定反過來） */
  match?: CreditMatchMode
  /**
   * 該注項賠率（僅一肖量 / 尾數量使用）
   * 這兩個玩法的賠率寫在 config 的注項上、且各項差距極大（890 ~ 2.11），
   * 本檔不讀設定檔（會與 helpers 形成循環），故由呼叫端帶入
   */
  odds?: number
}): CreditJudgeResult | null {
  const codes = Array.isArray(input?.openCode) ? input.openCode : []
  switch (String(input?.playKey ?? '')) {
    case 'zhengma': return judgeCreditZhengmaBet(input.betCode, codes, input.coin)
    case 'zhengmate': return judgeCreditZhengmateBet(input.betCode, codes, input.coin, input.tabId)
    case 'qima': return judgeCreditQimaBet(input.betCode, codes, input.coin)
    case 'wuxing': return judgeCreditWuxingBet(
      input.betCode, codes, input.coin,
      Number(input.year) || new Date().getFullYear(),
      input.rtp
    )
    case 'banbo': return judgeCreditBanboBet(input.betCode, codes, input.coin)
    case 'texiao': return judgeCreditTexiaoBet(
      input.betCode, codes, input.coin,
      Number(input.year) || new Date().getFullYear(),
      input.match,
      input.rtp
    )
    // ⚠️ 一肖看 7 顆球，不可與特肖共用分支（修正前是 fall-through，導致兩個玩法完全相同）
    case 'yixiao': return judgeCreditYixiaoBet(
      input.betCode, codes, input.coin,
      Number(input.year) || new Date().getFullYear(),
      input.match,
      input.rtp
    )
    case 'hexiao': return judgeCreditHexiaoBet(
      (Array.isArray(input.betCodes) && input.betCodes.length > 0 ? input.betCodes : [input.betCode]).map(String),
      codes, input.coin,
      Number(input.year) || new Date().getFullYear(),
      input.match,
      input.rtp
    )
    case 'lianxiao': return judgeCreditLianxiaoBet(
      (Array.isArray(input.betCodes) && input.betCodes.length > 0 ? input.betCodes : [input.betCode]).map(String),
      codes, input.coin,
      Number(input.year) || new Date().getFullYear(),
      input.match,
      input.rtp
    )
    case 'weishu': return judgeCreditWeishuBet(
      input.betCode, codes, input.coin,
      input.match,
      input.rtp
    )
    case 'lianwei': return judgeCreditLianweiBet(
      (Array.isArray(input.betCodes) && input.betCodes.length > 0 ? input.betCodes : [input.betCode]).map(String),
      codes, input.coin,
      input.match,
      input.rtp
    )
    // 全不中／中一／特平中：同一支判定，方向由 match 決定
    case 'zixuanbuzhong':
    case 'duoxuanzhongyi':
    case 'zhengterenzhong': return judgeCreditPickBet(
      Array.isArray(input.betCodes) && input.betCodes.length > 0 ? input.betCodes : [input.betCode],
      codes,
      input.coin,
      Array.isArray(input.tiers) ? input.tiers : [],
      input.match
    )
    // 一肖量／尾數量：押「7 顆球涵蓋幾個生肖／幾個尾」
    case 'ixiaolian':
    case 'weishulian': return judgeCreditCountBet(
      input.betCode, codes, input.coin,
      Number(input.odds ?? 0),
      Number(input.year) || new Date().getFullYear()
    )
    case 'lianma': return judgeCreditLianmaBet(
      Array.isArray(input.betCodes) && input.betCodes.length > 0 ? input.betCodes : [input.betCode],
      codes,
      input.coin,
      Array.isArray(input.tiers) ? input.tiers : []
    )
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
