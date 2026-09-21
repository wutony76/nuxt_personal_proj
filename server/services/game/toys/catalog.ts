export type ToyCatalogItem = {
  slug: string
  name: string
  kind: string
  mark: string
  blurb: string
  status: 'open' | 'soon'
  path: string | null
}

export type ToyReward = {
  id: string
  label: string
  weight: number
  multiplier: number
}

export const TOY_BET_CHIPS = [10, 50, 100, 500] as const
export const TOY_MAX_POT_MULTIPLIER = 500
export const TOY_FLIP_MS = 600
export const LUCKY_DRAW_CELLS = 12
/**
 * 難度校準：原本的獎金表（100/150/250/400/700/1200，基點制，÷100 才是真正倍數）越吹越
 * 貴，配合天然爆掉率算出來的期望值會衝到 200%~500%，遠超過「回饋率 ≈98%」的目標。改成
 * 「無論吹到第幾階段就領，期望值都落在 ≈98%」：`prize[k] = 98 / 累積存活率[k]`，累積存活率
 * 用 SODA_BUST_RATES（難度=1 時的天然機率）算出來（見 sodaWhistle.ts 的 `effectiveSurvival`）。
 */
export const SODA_PRIZES = [100, 104, 112, 127, 159, 227] as const
export const SODA_BUST_RATES = [0.02, 0.04, 0.07, 0.12, 0.2, 0.3] as const
export const BAMBOO_BANDS = [
  { min: 0, max: 9, weight: 1000 },
  { min: 10, max: 19, weight: 2000 },
  { min: 20, max: 29, weight: 2500 },
  { min: 30, max: 39, weight: 2500 },
  { min: 40, max: 49, weight: 1500 },
  { min: 50, max: 69, weight: 500 }
] as const
export const BAMBOO_TARGETS = [
  { id: 'm10', min: 10, multiplier: 1.1 },
  { id: 'm20', min: 20, multiplier: 1.4 },
  { id: 'm30', min: 30, multiplier: 2 },
  { id: 'm40', min: 40, multiplier: 4 },
  { id: 'm50', min: 50, multiplier: 15 }
] as const
export const GUMMY_COLORS = [
  { id: 'red', label: '紅', weight: 2500 },
  { id: 'yellow', label: '黃', weight: 2500 },
  { id: 'blue', label: '藍', weight: 2500 },
  { id: 'green', label: '綠', weight: 2500 }
] as const

export const TOY_CATALOG: ToyCatalogItem[] = [
  { slug: 'big-pig', name: '大豬公', kind: '懷舊零嘴', mark: '豬', blurb: '跟大豬公比兩顆骰', status: 'open', path: '/toys/big-pig' },
  { slug: 'lucky-draw', name: '抽抽樂', kind: '懷舊零嘴', mark: '抽', blurb: '選一格，看看裡頭有沒有獎', status: 'open', path: '/toys/lucky-draw' },
  { slug: 'gummy', name: '橡皮糖', kind: '懷舊零嘴', mark: '糖', blurb: '猜下一顆是什麼顏色', status: 'open', path: '/toys/gummy' },
  { slug: 'whistle-candy', name: '哨子糖', kind: '懷舊零嘴', mark: '哨', blurb: '短、中、長，看誰壓過誰', status: 'open', path: '/toys/whistle-candy' },
  { slug: 'pog', name: '尪仔標', kind: '古早玩具', mark: '標', blurb: '五張牌跟對方比一輪', status: 'open', path: '/toys/pog' },
  { slug: 'bamboo-copter', name: '竹蜻蜓', kind: '古早玩具', mark: '蜓', blurb: '猜它能飛多高', status: 'open', path: '/toys/bamboo-copter' },
  { slug: 'soda-whistle', name: '汽水笛', kind: '古早玩具', mark: '笛', blurb: '繼續吹，小心吹破', status: 'open', path: '/toys/soda-whistle' },
  { slug: 'cards', name: '紙牌', kind: '古早玩具', mark: '牌', blurb: '猜下一張大、小或相同', status: 'open', path: '/toys/cards' }
]

/**
 * 難度校準：中不中獎交給難度機制（見 difficulty.ts 的 `resolveFate`/`resolveWithFate`，
 * 在 luckyDraw.ts 內套用），這裡只決定「中獎的話，抽到哪一級」的相對比例與倍數——把權重
 * 大幅收斂到 small（幾乎都只拿回一點點甚至剛好本金），大獎留一點點機率保留刺激感，讓中獎
 * 情況下的平均倍數落在 ≈1.09（配合難度=1 時 90% 中獎 → 回饋率 ≈98%）。
 */
export const LUCKY_DRAW_REWARDS: ToyReward[] = [
  { id: 'empty', label: '空', weight: 4500, multiplier: 0 },
  { id: 'small', label: '小獎', weight: 5225, multiplier: 1 },
  { id: 'mid', label: '中獎', weight: 231, multiplier: 2 },
  { id: 'big', label: '大獎', weight: 39, multiplier: 5 },
  { id: 'special', label: '特獎', weight: 4, multiplier: 15 },
  { id: 'super', label: '超級獎', weight: 1, multiplier: 50 }
]

/**
 * @returns 抽抽樂權重基點合計
 */
export function luckyDrawWeightSum(): number {
  return LUCKY_DRAW_REWARDS.reduce((sum, item) => sum + item.weight, 0)
}

if (luckyDrawWeightSum() !== 10000) {
  throw new Error('抽抽樂權重基點合計必須是 10000')
}

/**
 * @returns 櫥仔與下注面板要用的目錄
 */
export function getToyCatalog() {
  return {
    items: TOY_CATALOG,
    betChips: [...TOY_BET_CHIPS],
    maxPotMultiplier: TOY_MAX_POT_MULTIPLIER,
    flipMs: TOY_FLIP_MS,
    luckyDraw: {
      cells: LUCKY_DRAW_CELLS,
      rewards: LUCKY_DRAW_REWARDS
    }
  }
}
