/**
 * 今彩539看板設定的讀取層。
 *
 * 跟 DLT 一樣：今彩539只有一個虛擬分頁、4 個獎項都沒有 `odds` 快照
 * （派彩金額完全鏡射官方，見 shared/config/d539.ts）。這支檔案只負責「查獎項名稱／對中條件」，
 * 不負責任何賠率或彩池相關的查找。
 *
 * ⚠️ 本檔 import d539.ts，因此 d539.ts 不可反向 import 本檔（會形成循環）。
 */
import C_PLAYS from '#shared/config/d539/plays'
import { D539_BET_AMOUNT, type D539TierKey } from '#shared/config/d539'

export type D539Quota = {
  /** 單注投注額（固定 50，min/max 相同） */
  item: { min: number; max: number }
}

type ConfigTierItem = { playId?: string; name?: string; desc?: string }
type ConfigGroup = { groupName?: string; groupList?: ConfigTierItem[] }
type ConfigTab = {
  tabId?: number
  tabName?: string
  settings?: { quota?: Partial<D539Quota> }
  tabGroup?: ConfigGroup[]
}
type ConfigPlay = { key?: string; name?: string; list?: ConfigTab[] }

const _plays = C_PLAYS as ConfigPlay[]

/** 取玩法設定（目前只有一個 'd539'） */
export function findD539Play(playKey: string = 'd539'): ConfigPlay | null {
  return _plays.find((play) => play.key === playKey) ?? null
}

/** 取分頁設定；tabId 給不出來時回第一個分頁（目前也只有一個） */
export function findD539Tab(tabId?: number | string): ConfigTab | null {
  const play = findD539Play()
  if (!play?.list?.length) return null
  const id = Number(tabId)
  if (!Number.isFinite(id) || id <= 0) return play.list[0] ?? null
  return play.list.find((tab) => Number(tab.tabId) === id) ?? play.list[0] ?? null
}

/** 依官方欄位 key 查獎項的名稱／對中條件說明（供 Report.vue／DialogRule.vue 顯示用） */
export function findD539TierMeta(tierKey: D539TierKey): ConfigTierItem | null {
  const tab = findD539Tab()
  for (const group of tab?.tabGroup ?? []) {
    const item = group.groupList?.find((it) => it.playId === tierKey)
    if (item) return item
  }
  return null
}

/** 單注投注額（固定 50，min/max 相同），quota.issue.max 依伺端動態狀態算出，不在此檔提供 */
export function d539QuotaOf(): D539Quota {
  const tab = findD539Tab()
  const min = Number(tab?.settings?.quota?.item?.min ?? D539_BET_AMOUNT)
  const max = Number(tab?.settings?.quota?.item?.max ?? D539_BET_AMOUNT)
  return { item: { min, max } }
}
