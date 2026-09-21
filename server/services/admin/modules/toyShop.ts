import { TOY_CATALOG } from 'serv/services/game/toys/catalog'

export type ToyShopOddsItem = {
  slug: string
  name: string
  multiplier: number
}

let _enabled = true
const _odds: Record<string, number> = {}
for (const t of TOY_CATALOG) _odds[t.slug] = 1

/**
 * 後台：柑仔店櫥仔全站開關與各玩法賠率倍數管理（in-memory，重啟後回復預設值，見
 * add-toy-shop-admin-controls/design.md）。
 * 賠率倍數套用在各玩法 roll 路由（server/api/games/toys 底下）的 wallet.credit 入帳金額上，
 * 不改各玩法內部機率／獎項判定，降低變更面。
 */
export const adminToyShopService = {
  isEnabled: (): boolean => _enabled,

  setEnabled: (enabled: boolean): boolean => {
    _enabled = enabled
    return _enabled
  },

  /** @param slug 玩法 slug，找不到時回退為 1（不阻擋派彩） */
  oddsOf: (slug: string): number => _odds[slug] ?? 1,

  listOdds: (): ToyShopOddsItem[] =>
    TOY_CATALOG.map((t) => ({ slug: t.slug, name: t.name, multiplier: _odds[t.slug] ?? 1 })),

  setOdds: (slug: string, multiplier: number): ToyShopOddsItem => {
    const item = TOY_CATALOG.find((t) => t.slug === slug)
    if (!item) {
      throw createError({ statusCode: 404, message: `找不到玩法：${slug}` })
    }
    if (!Number.isFinite(multiplier) || multiplier < 0) {
      throw createError({ statusCode: 400, message: '賠率必須是不小於 0 的數字。' })
    }
    _odds[slug] = multiplier
    return { slug: item.slug, name: item.name, multiplier }
  }
}
