/**
 * 6hc-cd 注號分析的「分析角度」分組
 *
 * ⚠️ 必須是 .ts：本檔用 `#shared` 匯入，Nitro 對 shared 下的 .js 走 Node 原生 ESM 解析、
 *    不認得 `#shared` 別名（詳見 plays.ts 檔頭）。
 *
 * 注號分析原本只有「49 顆球各自的統計」，看不出大小／單雙／生肖這類面向的冷熱。
 * 本檔把 49 個號碼依各種角度切成群組，讓分析頁可以直接比較群組之間的統計。
 *
 * 分組來源一律沿用結算用的號碼表與判定條件（wuxingAll / shengxiaoNumsOf /
 * weishuAll / creditSideNumbersOf），不另外寫一份範圍，避免與實際判定不一致。
 * 生肖與五行的號碼逐年輪轉，因此需要傳入年份。
 */
import {
  creditSideNumbersOf,
  shengxiaoNumsOf,
  weishuAll,
  wuxingAll,
  wuxingNumsOf,
  LHC_NUMBER_MAX,
  SX,
  type WuxingKey
} from '#shared/config/6hc-cd'

/** 分析角度 */
export type CreditAnalyzeDimension = 'number' | 'size' | 'parity' | 'side' | 'wuxing' | 'shengxiao' | 'weishu'

/** 一個分析群組 */
export type CreditAnalyzeGroup = {
  /** 群組名稱（大／單／合單／金／鼠／0尾…） */
  name: string
  /** 該群組涵蓋的號碼（補零字串） */
  nums: string[]
}

/**
 * 各分析角度的統計聚合方式
 *   sum —— 攪出次數／下注次數：群組的值 = 各號碼相加
 *   min —— 相隔期數：群組「上次出現」= 各號碼中最近的那一個（相加沒有意義）
 */
export type CreditAnalyzeAggregate = 'sum' | 'min'

export const CREDIT_ANALYZE_DIMENSIONS: Array<{ key: CreditAnalyzeDimension; label: string }> = [
  { key: 'number', label: '號碼' },
  { key: 'size', label: '大小' },
  { key: 'parity', label: '單雙' },
  { key: 'side', label: '兩面' },
  { key: 'wuxing', label: '五行' },
  { key: 'shengxiao', label: '生肖' },
  { key: 'weishu', label: '尾數' }
]

const _pad = (num: number): string => String(num).padStart(2, '0')

/** 五行鍵值 → 顯示名稱 */
const WUXING_LABELS: Record<WuxingKey, string> = { j: '金', m: '木', s: '水', h: '火', t: '土' }

/**
 * 取某個分析角度的所有群組
 * @param dimension 分析角度；'number' 代表不分組（49 顆球各自一組）
 * @param year      該期年份（生肖／五行號碼表逐年輪轉）
 */
export function creditAnalyzeGroupsOf(dimension: CreditAnalyzeDimension, year: number): CreditAnalyzeGroup[] {
  switch (dimension) {
    case 'number':
      return Array.from({ length: LHC_NUMBER_MAX }, (_, i) => ({ name: _pad(i + 1), nums: [_pad(i + 1)] }))
    // 大小／單雙都是兩面的子集，直接取兩面判定表的對應項，條件不會分岔
    case 'size':
      return ['大', '小'].map((name) => ({ name, nums: creditSideNumbersOf(name) }))
    case 'parity':
      return ['單', '雙'].map((name) => ({ name, nums: creditSideNumbersOf(name) }))
    case 'side':
      return ['大', '小', '單', '雙', '合單', '合雙', '尾大', '尾小']
        .map((name) => ({ name, nums: creditSideNumbersOf(name) }))
    case 'wuxing': {
      const table = wuxingAll(year)
      return (Object.keys(table) as WuxingKey[]).map((key) => ({
        name: WUXING_LABELS[key],
        nums: wuxingNumsOf(WUXING_LABELS[key], year)
      }))
    }
    case 'shengxiao':
      return (SX as readonly string[]).map((animal) => ({ name: animal, nums: shengxiaoNumsOf(animal, year) }))
    case 'weishu':
      return Object.keys(weishuAll).map((name) => ({ name, nums: weishuAll[name] ?? [] }))
    default:
      return []
  }
}

/**
 * 把「各號碼的統計值」聚合成「各群組的統計值」
 * @param groups   分析群組
 * @param valueOf  取某號碼的統計值（查不到請回 0）
 * @param mode     sum = 相加（攪出次數／下注次數）、min = 取最小（相隔期數）
 */
export function creditAnalyzeAggregate(
  groups: CreditAnalyzeGroup[],
  valueOf: (num: number) => number,
  mode: CreditAnalyzeAggregate = 'sum'
): Array<CreditAnalyzeGroup & { value: number }> {
  return (Array.isArray(groups) ? groups : []).map((group) => {
    const values = group.nums.map((code) => Number(valueOf(Number(code))) || 0)
    if (values.length === 0) return { ...group, value: 0 }
    const value = mode === 'min' ? Math.min(...values) : values.reduce((acc, cur) => acc + cur, 0)
    return { ...group, value }
  })
}
