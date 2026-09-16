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
export const SODA_PRIZES = [100, 150, 250, 400, 700, 1200] as const
export const SODA_BUST_RATES = [0.02, 0.04, 0.07, 0.12, 0.2, 0.3] as const

export const TOY_CATALOG: ToyCatalogItem[] = [
  { slug: 'big-pig', name: '大豬公', kind: '懷舊零嘴', mark: '豬', blurb: '跟大豬公比兩顆骰', status: 'soon', path: null },
  { slug: 'lucky-draw', name: '抽抽樂', kind: '懷舊零嘴', mark: '抽', blurb: '選一格，看看裡頭有沒有獎', status: 'open', path: '/toys/lucky-draw' },
  { slug: 'gummy', name: '橡皮糖', kind: '懷舊零嘴', mark: '糖', blurb: '猜下一顆是什麼顏色', status: 'soon', path: null },
  { slug: 'whistle-candy', name: '哨子糖', kind: '懷舊零嘴', mark: '哨', blurb: '短、中、長，看誰壓過誰', status: 'soon', path: null },
  { slug: 'pog', name: '尪仔標', kind: '古早玩具', mark: '標', blurb: '五張牌跟對方比一輪', status: 'soon', path: null },
  { slug: 'bamboo-copter', name: '竹蜻蜓', kind: '古早玩具', mark: '蜓', blurb: '猜它能飛多高', status: 'soon', path: null },
  { slug: 'soda-whistle', name: '汽水笛', kind: '古早玩具', mark: '笛', blurb: '繼續吹，小心吹破', status: 'open', path: '/toys/soda-whistle' },
  { slug: 'cards', name: '紙牌', kind: '古早玩具', mark: '牌', blurb: '猜下一張大、小或相同', status: 'open', path: '/toys/cards' }
]

export const LUCKY_DRAW_REWARDS: ToyReward[] = [
  { id: 'empty', label: '空', weight: 4500, multiplier: 0 },
  { id: 'small', label: '小獎', weight: 3000, multiplier: 1.2 },
  { id: 'mid', label: '中獎', weight: 1500, multiplier: 2 },
  { id: 'big', label: '大獎', weight: 800, multiplier: 5 },
  { id: 'special', label: '特獎', weight: 180, multiplier: 15 },
  { id: 'super', label: '超級獎', weight: 20, multiplier: 50 }
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
