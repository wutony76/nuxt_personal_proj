/**
 * 49樂合彩看板設定的讀取層。
 *
 * 跟 DLT/D539 一樣：49樂合彩只有一個虛擬分頁、3 個「合數」都沒有 `odds` 快照
 * （派彩金額完全鏡射官方，見 shared/config/m649.ts）。這支檔案只負責「查合數名稱／對中條件」，
 * 不負責任何賠率或彩池相關的查找。
 *
 * ⚠️ 本檔 import m649.ts，因此 m649.ts 不可反向 import 本檔（會形成循環）。
 */
import C_PLAYS from '#shared/config/m649/plays'
import { M649_BET_AMOUNT, type M649TierKey } from '#shared/config/m649'

export type M649Quota = {
  /** 單注投注額（固定 25，min/max 相同） */
  item: { min: number; max: number }
}

type ConfigTierItem = { playId?: string; name?: string; desc?: string }
type ConfigGroup = { groupName?: string; groupList?: ConfigTierItem[] }
type ConfigTab = {
  tabId?: number
  tabName?: string
  settings?: { quota?: Partial<M649Quota> }
  tabGroup?: ConfigGroup[]
}
type ConfigPlay = { key?: string; name?: string; list?: ConfigTab[] }

const _plays = C_PLAYS as ConfigPlay[]

/** 取玩法設定（目前只有一個 'm649'） */
export function findM649Play(playKey: string = 'm649'): ConfigPlay | null {
  return _plays.find((play) => play.key === playKey) ?? null
}

/** 取分頁設定；tabId 給不出來時回第一個分頁（目前也只有一個） */
export function findM649Tab(tabId?: number | string): ConfigTab | null {
  const play = findM649Play()
  if (!play?.list?.length) return null
  const id = Number(tabId)
  if (!Number.isFinite(id) || id <= 0) return play.list[0] ?? null
  return play.list.find((tab) => Number(tab.tabId) === id) ?? play.list[0] ?? null
}

/** 依官方欄位 key 查合數的名稱／對中條件說明（供 Report.vue／DialogRule.vue 顯示用） */
export function findM649TierMeta(tierKey: M649TierKey): ConfigTierItem | null {
  const tab = findM649Tab()
  for (const group of tab?.tabGroup ?? []) {
    const item = group.groupList?.find((it) => it.playId === tierKey)
    if (item) return item
  }
  return null
}

/** 單注投注額（固定 25，min/max 相同），quota.issue.max 依伺端動態狀態算出，不在此檔提供 */
export function m649QuotaOf(): M649Quota {
  const tab = findM649Tab()
  const min = Number(tab?.settings?.quota?.item?.min ?? M649_BET_AMOUNT)
  const max = Number(tab?.settings?.quota?.item?.max ?? M649_BET_AMOUNT)
  return { item: { min, max } }
}
