import { Storage } from 'serv/services/storage'
import { LOTTERY } from '~/config/constants'
import { RETRO_GAMES, BG_GAMES } from '#shared/config/gameSlugs'
import { roleDefsService } from './roleDefs'

export type GameCategory = 'bg' | 'retro'

export type GameCatalogItem = {
  category: GameCategory
  key: string
  name: string
}

export type RoleGamePerm = GameCatalogItem & {
  enabled: boolean
}

export type GameCatalogEntry = GameCatalogItem & {
  enabled: boolean
}

function _compositeKey(category: GameCategory, key: string): string {
  return `${category}:${key}`
}

/**
 * @returns 兩分類的權威清單（`bg` 15 個盤口 + `retro` 26 款遊戲），見
 * openspec/changes/add-role-game-perms/design.md Decision 2
 */
function _catalog(): GameCatalogItem[] {
  const bg: GameCatalogItem[] = BG_GAMES.map(({ key }) => {
    const lottery = (LOTTERY as Record<string, { name: string; sub?: string }>)[key]
    const name = lottery ? `${lottery.name}${lottery.sub ? ` ${lottery.sub}` : ''}` : key
    return { category: 'bg', key, name }
  })
  const retro: GameCatalogItem[] = RETRO_GAMES.map(({ key }) => {
    const instance = (Storage.retroGames.instances as Record<string, { name?: string } | undefined>)[key]
    return { category: 'retro', key, name: instance?.name ?? key }
  })
  return [...bg, ...retro]
}

/** 執行期「角色 → 被關閉項目」記錄；只記被關閉的，未記錄視為全開（見 design.md Decision 1）。 */
const disabledByRole = new Map<string, Set<string>>()

/**
 * 執行期「全域被關閉」項目記錄（遊戲管理總閘，見 /admin/roles「遊戲列表」）；
 * 只記被關閉的，未記錄視為全開。關閉後不分角色（含內建角色）全站都看不到／用不到，
 * 是比 `disabledByRole` 更高一層的開關：`isEnabled()` 一律先查這裡。
 */
const disabledGlobally = new Set<string>()

/**
 * 自訂角色的遊戲／盤口開關（見 openspec/changes/add-role-game-perms）。
 * 內建角色（builtin:true）永遠全開，不受此服務控管、也不可被切換。
 */
export const roleGamePermsService = {
  /**
   * @returns 兩分類的權威清單（後台「新增遊戲/玩法」下拉用）
   */
  catalog: (): GameCatalogItem[] => _catalog(),

  /**
   * @returns 兩分類全部項目的「總閘」開關狀態，供 /admin/roles「遊戲列表」與
   * `GET /api/admin/games` 用
   */
  listGlobal: (): GameCatalogEntry[] =>
    _catalog().map((item) => ({ ...item, enabled: roleGamePermsService.isGloballyEnabled(item.category, item.key) })),

  /**
   * @param category 分類
   * @param key 該分類下的項目 key
   * @returns 該項目是否全域開啟（總閘）
   */
  isGloballyEnabled: (category: GameCategory, key: string): boolean =>
    !disabledGlobally.has(_compositeKey(category, key)),

  /**
   * 切換單一項目的「總閘」：關閉後不分角色（含內建角色）全站都看不到／用不到
   * @param category 分類
   * @param key 該分類下的項目 key
   * @param enabled 開啟或關閉
   */
  toggleGlobal: (category: GameCategory, key: string, enabled: boolean): void => {
    if (!_catalog().some((item) => item.category === category && item.key === key)) {
      throw createError({ statusCode: 400, message: '分類或項目不存在。' })
    }
    const compositeKey = _compositeKey(category, key)
    if (enabled) {
      disabledGlobally.delete(compositeKey)
      return
    }
    disabledGlobally.add(compositeKey)
  },

  /**
   * @param roleId 角色 id
   * @returns 該角色兩分類全部項目的開關狀態；內建角色除非被總閘關閉，否則全部 `enabled:true`
   */
  listForRole: (roleId: string): RoleGamePerm[] => {
    const role = roleDefsService.get(roleId)
    if (!role) throw createError({ statusCode: 404, message: '找不到該角色。' })
    return _catalog().map((item) => ({
      ...item,
      enabled: roleGamePermsService.isEnabled(roleId, item.category, item.key)
    }))
  },

  /**
   * @param roleId 角色 id
   * @param category 分類（'bg'／'retro'）
   * @param key 該分類下的項目 key
   * @returns 該角色是否可使用此項目（總閘關閉時，不分角色一律 false）
   */
  isEnabled: (roleId: string, category: GameCategory, key: string): boolean => {
    if (!roleGamePermsService.isGloballyEnabled(category, key)) return false
    const role = roleDefsService.get(roleId)
    if (!role || role.builtin) return true
    return !disabledByRole.get(roleId)?.has(_compositeKey(category, key))
  },

  /**
   * @param roleId 角色 id
   * @returns 該角色被關閉的項目清單（`{category, key}[]`，含被總閘關閉的項目，內建角色也不例外）；
   * 供會員自查 `GET /api/games/access` 與前台強制生效 middleware 使用
   */
  disabledEntriesOf: (roleId: string): Array<Pick<GameCatalogItem, 'category' | 'key'>> => {
    return _catalog().filter((item) => !roleGamePermsService.isEnabled(roleId, item.category, item.key))
      .map(({ category, key }) => ({ category, key }))
  },

  /**
   * 切換自訂角色的單一項目開關
   * @param roleId 角色 id
   * @param category 分類
   * @param key 該分類下的項目 key
   * @param enabled 開啟或關閉
   */
  toggle: (roleId: string, category: GameCategory, key: string, enabled: boolean): void => {
    const role = roleDefsService.get(roleId)
    if (!role) throw createError({ statusCode: 404, message: '找不到該角色。' })
    if (role.builtin) throw createError({ statusCode: 400, message: '內建角色不可調整遊戲權限。' })
    if (!_catalog().some((item) => item.category === category && item.key === key)) {
      throw createError({ statusCode: 400, message: '分類或項目不存在。' })
    }

    const compositeKey = _compositeKey(category, key)
    if (enabled) {
      disabledByRole.get(roleId)?.delete(compositeKey)
      return
    }
    if (!disabledByRole.has(roleId)) disabledByRole.set(roleId, new Set())
    disabledByRole.get(roleId)!.add(compositeKey)
  },

  /**
   * 刪除角色時呼叫：清掉該角色的開關紀錄，避免殘留（見 design.md Open Questions）。
   * @param roleId 被刪除的角色 id
   */
  clearRole: (roleId: string): void => {
    disabledByRole.delete(roleId)
  }
}
