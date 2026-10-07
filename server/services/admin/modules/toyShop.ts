import { TOY_CATALOG } from 'serv/services/game/toys/catalog'
import { isDbEnabled, getDb } from 'serv/services/db'
import { toyShopGames as toyShopGamesTable, toyShopSettings as toyShopSettingsTable } from 'serv/services/db/schema'
import { eq } from 'drizzle-orm'

export type ToyShopOddsItem = {
  slug: string
  name: string
  multiplier: number
  /** 難度倍數：預設 1（校準過的基準：10 次 9 次贏、回饋率 ≈98%），數字越大越難贏 */
  difficulty: number
  enabled: boolean
}

let _enabled = true
const _odds: Record<string, number> = {}
const _difficulty: Record<string, number> = {}
const _gameEnabled: Record<string, boolean> = {}
for (const t of TOY_CATALOG) {
  _odds[t.slug] = 1
  _difficulty[t.slug] = 1
  _gameEnabled[t.slug] = true
}

function _rowOf(slug: string, name: string): ToyShopOddsItem {
  return {
    slug,
    name,
    multiplier: _odds[slug] ?? 1,
    difficulty: _difficulty[slug] ?? 0,
    enabled: _gameEnabled[slug] ?? true
  }
}

/**
 * 後台：柑仔店櫥仔全站開關、單一玩法上下架、各玩法賠率倍數與難度管理（in-memory，重啟
 * 後回復預設值，見 add-toy-shop-admin-controls/design.md）。
 *   - 賠率倍數（multiplier）：玩法判定中獎後，實際入帳金額 = 原始派彩 × 倍數，套用在
 *     各玩法 roll 路由（server/api/games/toys 底下）的 wallet.credit 入帳這一刻
 *   - 難度（difficulty）：預設 1，數字越大越難贏。真的改變中獎機率本身，不是事後把中獎
 *     敲成沒中——由各玩法自己的 service 檔（bigPig.ts／luckyDraw.ts…）在骰/抽的當下就
 *     讀這個值去校準，見 server/services/game/toys/difficulty.ts
 * 單一玩法下架時，公開 catalog 端點直接不回傳該玩法（前台不顯示），roll 路由也會擋單。
 */
export const adminToyShopService = {
  isEnabled: (): boolean => _enabled,

  /** write-through（見 migrate-game-settings-postgres/design.md 第 3b 節） */
  setEnabled: async (enabled: boolean): Promise<boolean> => {
    if (isDbEnabled()) {
      await getDb().insert(toyShopSettingsTable)
        .values({ id: 'default', enabled })
        .onConflictDoUpdate({ target: toyShopSettingsTable.id, set: { enabled } })
    }
    _enabled = enabled
    return _enabled
  },

  /** @param slug 玩法 slug，找不到時回退為 1（不阻擋派彩） */
  oddsOf: (slug: string): number => _odds[slug] ?? 1,

  /** @param slug 玩法 slug，找不到時回退為 1（維持校準基準） */
  difficultyOf: (slug: string): number => _difficulty[slug] ?? 1,

  /** @param slug 玩法 slug，找不到時回退為 true（不阻擋派彩） */
  isGameEnabled: (slug: string): boolean => _gameEnabled[slug] ?? true,

  listOdds: (): ToyShopOddsItem[] => TOY_CATALOG.map((t) => _rowOf(t.slug, t.name)),

  /** write-through（見 migrate-game-settings-postgres/design.md 第 3b 節） */
  setOdds: async (slug: string, input: { multiplier: number; difficulty: number }): Promise<ToyShopOddsItem> => {
    const item = TOY_CATALOG.find((t) => t.slug === slug)
    if (!item) {
      throw createError({ statusCode: 404, message: `找不到玩法：${slug}` })
    }
    const { multiplier, difficulty } = input
    if (!Number.isFinite(multiplier) || multiplier < 0) {
      throw createError({ statusCode: 400, message: '賠率必須是不小於 0 的數字。' })
    }
    if (!Number.isFinite(difficulty) || difficulty <= 0) {
      throw createError({ statusCode: 400, message: '難度必須是大於 0 的數字（預設 1）。' })
    }

    if (isDbEnabled()) {
      // multiplier/difficulty 是 numeric 欄位，drizzle 型別要求 string，不能直接塞 number。
      await getDb().insert(toyShopGamesTable)
        .values({ slug, multiplier: String(multiplier), difficulty: String(difficulty), enabled: _gameEnabled[slug] ?? true })
        .onConflictDoUpdate({
          target: toyShopGamesTable.slug,
          set: { multiplier: String(multiplier), difficulty: String(difficulty), updatedAt: new Date() }
        })
    }

    _odds[slug] = multiplier
    _difficulty[slug] = difficulty
    return _rowOf(item.slug, item.name)
  },

  /** write-through（見 migrate-game-settings-postgres/design.md 第 3b 節） */
  setGameEnabled: async (slug: string, enabled: boolean): Promise<ToyShopOddsItem> => {
    const item = TOY_CATALOG.find((t) => t.slug === slug)
    if (!item) {
      throw createError({ statusCode: 404, message: `找不到玩法：${slug}` })
    }

    if (isDbEnabled()) {
      // multiplier/difficulty 是 numeric 欄位，drizzle 型別要求 string，不能直接塞 number。
      await getDb().insert(toyShopGamesTable)
        .values({ slug, multiplier: String(_odds[slug] ?? 1), difficulty: String(_difficulty[slug] ?? 1), enabled })
        .onConflictDoUpdate({
          target: toyShopGamesTable.slug,
          set: { enabled, updatedAt: new Date() }
        })
    }

    _gameEnabled[slug] = enabled
    return _rowOf(item.slug, item.name)
  },

  /**
   * 開機回填：override-only，沒有種子分支（見 design.md 第 3b 節）。模組載入時已用
   * TOY_CATALOG 填好預設值，DB 空＝維持目前預設行為。
   */
  rehydrateFromDb: async (): Promise<void> => {
    if (!isDbEnabled()) return
    const db = getDb()
    const [gameRows, settingsRow] = await Promise.all([
      db.select().from(toyShopGamesTable),
      db.select().from(toyShopSettingsTable).where(eq(toyShopSettingsTable.id, 'default')).then((rows) => rows[0])
    ])

    for (const row of gameRows) {
      if (!TOY_CATALOG.some((t) => t.slug === row.slug)) continue
      _odds[row.slug] = Number(row.multiplier)
      _difficulty[row.slug] = Number(row.difficulty)
      _gameEnabled[row.slug] = row.enabled
    }

    if (settingsRow) _enabled = settingsRow.enabled
  }
}
