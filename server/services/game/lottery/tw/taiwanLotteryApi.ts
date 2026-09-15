/**
 * 台灣彩券官方 API 的可重用 service function 層。
 *
 * 抽出自 server/api/lottery-tw/{last-number,prize}.get.ts（原本邏輯寫死在 defineEventHandler
 * 內，無法被其他 service import）。兩支既有路由現在改為呼叫這裡的 function，回應格式不變；
 * DLT（大樂透）的結算流程（server/services/game/lottery/tw/dlt.ts）也呼叫同一份實作，
 * 避免兩處各自重複發請求／各自維護一份欄位對照表。
 *
 * ⚠️ 這兩支官方端點沒有官方文件保證，欄位命名（Assign key）皆為直接呼叫上游驗證取得
 * （見 openspec/changes/add-taiwan-lottery-hall/design.md），上游改版需重新核對。
 */

export type TaiwanLotteryGame = {
  code: number
  name: string
  en: string
}

export type TaiwanLotteryRawItem = {
  gameCode: number
  gameName?: string
  period?: string
  lotNumber?: Array<string | number>
  [key: string]: unknown
}

type TaiwanLotteryApiResponse = {
  rtCode: number
  content?: {
    lastNumberList?: TaiwanLotteryRawItem[]
    bingo?: TaiwanLotteryRawItem
  }
}

export const TAIWAN_LOTTERY_GAMES: Record<number, TaiwanLotteryGame> = {
  5134: { code: 5134, name: '威力彩', en: 'WEILICAI' },
  5118: { code: 5118, name: '大樂透', en: 'DALETOU' },
  1197: { code: 1197, name: '今彩539', en: 'JINCAI539' },
  5120: { code: 5120, name: '39樂合彩', en: '39YUEHECAI' },
  1121: { code: 1121, name: '49樂合彩', en: '49YUEHECAI' },
  2108: { code: 2108, name: '3星彩', en: '3XINGCAI' },
  2109: { code: 2109, name: '4星彩', en: '4XINGCAI' },
  1102: { code: 1102, name: '賓果賓果', en: 'BINGUO' }
}

const TAIWAN_LOTTERY_GAME_ORDER = [5118, 5134, 1197, 1121, 5120, 2109, 2108, 1102]

/**
 * 取得各遊戲「最新一期」開獎號（無期別範圍參數，只能拿到目前最新的一期）。
 * @returns updatedAt（本次查詢時間）與各遊戲最新一期的開獎資料陣列
 */
export async function fetchTaiwanLotteryLastNumber(): Promise<{
  updatedAt: string
  results: TaiwanLotteryRawItem[]
}> {
  const response = await $fetch<TaiwanLotteryApiResponse>(
    'https://api.taiwanlottery.com/TLCAPIWeB/Lottery/LastNumber'
  ).catch(() => null)

  if (!response || response.rtCode !== 0 || !response.content) {
    throw createError({
      statusCode: 502,
      message: '彩運來開獎資料取得失敗'
    })
  }

  const out = new Map<number, TaiwanLotteryRawItem>()

  for (const item of response.content.lastNumberList ?? []) {
    const gameCode = Number(item.gameCode)
    const base = TAIWAN_LOTTERY_GAMES[gameCode]
    out.set(gameCode, {
      ...item,
      gameCode,
      gameName: item.gameName || base?.name || `Game ${gameCode}`,
      en: base?.en || 'UNKNOWN',
      lotNumber: Array.isArray(item.lotNumber) ? item.lotNumber : []
    })
  }

  if (response.content.bingo?.gameCode) {
    const gameCode = Number(response.content.bingo.gameCode)
    const base = TAIWAN_LOTTERY_GAMES[gameCode]
    out.set(gameCode, {
      ...response.content.bingo,
      gameCode,
      gameName: response.content.bingo.gameName || base?.name || `Game ${gameCode}`,
      en: base?.en || 'UNKNOWN',
      lotNumber: Array.isArray(response.content.bingo.lotNumber)
        ? response.content.bingo.lotNumber
        : []
    })
  }

  const results = [...out.values()].sort((a, b) => {
    const aIdx = TAIWAN_LOTTERY_GAME_ORDER.indexOf(Number(a.gameCode))
    const bIdx = TAIWAN_LOTTERY_GAME_ORDER.indexOf(Number(b.gameCode))
    const safeA = aIdx === -1 ? 999 : aIdx
    const safeB = bIdx === -1 ? 999 : bIdx
    return safeA - safeB
  })

  return {
    updatedAt: new Date().toISOString(),
    results
  }
}

/** 取單一遊戲「最新一期」的開獎資料（DLT 結算用，語意比逐一過濾 fetchTaiwanLotteryLastNumber() 清楚） */
export async function fetchTaiwanLotteryLastNumberOf(gameCode: number): Promise<TaiwanLotteryRawItem | null> {
  const { results } = await fetchTaiwanLotteryLastNumber()
  return results.find((item) => Number(item.gameCode) === gameCode) ?? null
}

export type PrizeTierRaw = {
  prize?: number
  lastPrize?: number
  winnerCount?: number
  perPrize?: number
  multiple?: string
  bonus?: string
}

type TierDef = {
  key: string
  label: string
}

type GameDef = {
  endpoint: string
  resKey: string
  tiers: TierDef[]
}

export type TaiwanLotteryPrizeTier = {
  label: string
  winnerCount: number
  perPrize: number
  multiple?: string
  bonus?: string
}

// gameCode 對照台灣彩券官方各遊戲的期別查詢端點；欄位命名（Assign key）皆為直接呼叫上游驗證取得，
// 沒有官方文件保證穩定，若上游改版需重新核對（見 openspec/changes/add-taiwan-lottery-hall/design.md）。
const GAME_DEFS: Record<number, GameDef> = {
  5134: {
    endpoint: 'SuperLotto638Result',
    resKey: 'superLotto638Res',
    tiers: [
      { key: 'super638JackpotAssign', label: '頭獎' },
      { key: 'super638SecondAssign', label: '二獎' },
      { key: 'super638ThirdAssign', label: '三獎' },
      { key: 'super638FourthAssign', label: '四獎' },
      { key: 'super638FifthAssign', label: '五獎' },
      { key: 'super638SixthAssign', label: '六獎' },
      { key: 'super638SeventhAssign', label: '七獎' },
      { key: 'super638EighthAssign', label: '八獎' },
      { key: 'super638NinthAssign', label: '九獎' },
      { key: 'super638NormalAssign', label: '普獎' }
    ]
  },
  5118: {
    endpoint: 'Lotto649Result',
    resKey: 'lotto649Res',
    tiers: [
      { key: 'jackpotAssign', label: '頭獎' },
      { key: 'secondAssign', label: '二獎' },
      { key: 'thirdAssign', label: '三獎' },
      { key: 'fourthAssign', label: '四獎' },
      { key: 'fifthAssign', label: '五獎' },
      { key: 'sixthAssign', label: '六獎' },
      { key: 'seventhAssign', label: '七獎' },
      { key: 'normalAssign', label: '普獎' }
    ]
  },
  1197: {
    endpoint: 'Daily539Result',
    resKey: 'daily539Res',
    tiers: [
      { key: 'd539JackpotAssign', label: '頭獎' },
      { key: 'd539SecondAssign', label: '二獎' },
      { key: 'd539ThirdAssign', label: '三獎' },
      { key: 'd539FourthAssign', label: '四獎' }
    ]
  },
  5120: {
    endpoint: '39M5Result',
    resKey: 'm539Res',
    tiers: [
      { key: 'm539TwoAssign', label: '二合' },
      { key: 'm539ThreeAssign', label: '三合' },
      { key: 'm539FourAssign', label: '四合' }
    ]
  },
  1121: {
    endpoint: '49M6Result',
    resKey: 'm649Res',
    tiers: [
      { key: 'm649TwoAssign', label: '二合' },
      { key: 'm649ThreeAssign', label: '三合' },
      { key: 'm649FourAssign', label: '四合' }
    ]
  },
  2108: {
    endpoint: '3DResult',
    resKey: 'lotto3DRes',
    tiers: [
      { key: 'lotto3DFirstAssign', label: '頭獎' },
      { key: 'lotto3DSecondAssign', label: '二獎' },
      { key: 'lotto3DThirdAssign', label: '三獎' }
    ]
  },
  2109: {
    endpoint: '4DResult',
    resKey: 'lotto4DRes',
    tiers: [
      { key: 'lotto4DFirstAssign', label: '頭獎' },
      { key: 'lotto4DSecondAssign', label: '二獎' },
      { key: 'lotto4DThirdAssign', label: '三獎' }
    ]
  }
  // 1102（賓果賓果）沒有對應的官方中獎明細端點，查表查不到時直接回空陣列。
}

/**
 * 取得指定遊戲、指定期別的中獎明細（各獎項 winnerCount／perPrize）。
 * @param gameCode 遊戲代碼（例如大樂透 5118）
 * @param period 期別字串（必須是已經開獎的期別，官方端點不支援查詢未來期別）
 * @returns gameCode／period／tiers（該 gameCode 無對照設定時 tiers 回空陣列）
 */
export async function fetchTaiwanLotteryPrize(
  gameCode: number,
  period: string
): Promise<{ gameCode: number; period: string; tiers: TaiwanLotteryPrizeTier[] }> {
  const def = GAME_DEFS[gameCode]
  if (!def) {
    return { gameCode, period, tiers: [] }
  }

  const response = await $fetch<{ rtCode: number; content?: Record<string, unknown[]> }>(
    `https://api.taiwanlottery.com/TLCAPIWeB/Lottery/${def.endpoint}`,
    { query: { period, pageNum: 1, pageSize: 1 } }
  ).catch(() => null)

  const row = response?.content?.[def.resKey]?.[0] as Record<string, PrizeTierRaw> | undefined
  if (!response || response.rtCode !== 0 || !row) {
    throw createError({ statusCode: 502, message: '彩運來中獎明細取得失敗' })
  }

  const tiers: TaiwanLotteryPrizeTier[] = def.tiers.map(({ key, label }) => {
    const raw = row[key] || {}
    return {
      label,
      winnerCount: Number(raw.winnerCount ?? 0),
      perPrize: Number(raw.perPrize ?? 0),
      ...(raw.multiple ? { multiple: raw.multiple } : {}),
      ...(raw.bonus ? { bonus: raw.bonus } : {})
    }
  })

  return { gameCode, period, tiers }
}

/**
 * 取得指定遊戲、指定期別「已經開獎」的實際開獎號碼與開獎日期（不含獎金明細）。
 * 用途：DLT 用已知的官方期別編號規則（民國年＋序號）反推過去期別字串，逐期呼叫這支
 * 回填 `recordOpenCode`（見 server/services/game/lottery/tw/dlt.ts `_backfillHistory()`）——
 * 官方本身沒有「近 N 期列表」端點，但只要知道期別字串就能個別查到，等於間接可以回填。
 * @param gameCode 遊戲代碼（例如大樂透 5118）
 * @param period 期別字串（必須是已經開獎的期別，未開獎或不存在的期別回傳 null）
 * @returns 查無資料或欄位不足回傳 null（呼叫端應略過，不視為致命錯誤）
 */
export async function fetchTaiwanLotteryDrawOf(
  gameCode: number,
  period: string
): Promise<{ period: string; lotNumber: number[]; drawDate: string } | null> {
  const def = GAME_DEFS[gameCode]
  if (!def) return null

  const response = await $fetch<{ rtCode: number; content?: Record<string, unknown[]> }>(
    `https://api.taiwanlottery.com/TLCAPIWeB/Lottery/${def.endpoint}`,
    { query: { period, pageNum: 1, pageSize: 1 } }
  ).catch(() => null)

  const row = response?.content?.[def.resKey]?.[0] as
    | { period?: number | string; lotteryDate?: string; drawNumberSize?: Array<number | string> }
    | undefined
  if (!response || response.rtCode !== 0 || !row) return null

  const lotNumber = Array.isArray(row.drawNumberSize) ? row.drawNumberSize.map((n) => Number(n)) : []
  if (!row.lotteryDate || lotNumber.length < 7) return null

  return { period: String(row.period ?? period), lotNumber, drawDate: row.lotteryDate }
}

/**
 * 依官方欄位 key 取單一獎項的中獎明細（DLT 結算用，避免呼叫端自己重找 tiers 陣列）。
 * @returns 找不到該 key 時回傳 null（可能是 gameCode 無對照設定，或官方回應尚未包含該欄位）
 */
export async function fetchTaiwanLotteryPrizeTier(
  gameCode: number,
  period: string,
  tierKey: string
): Promise<TaiwanLotteryPrizeTier | null> {
  const def = GAME_DEFS[gameCode]
  if (!def) return null
  const tierIndex = def.tiers.findIndex((t) => t.key === tierKey)
  if (tierIndex === -1) return null
  const { tiers } = await fetchTaiwanLotteryPrize(gameCode, period)
  return tiers[tierIndex] ?? null
}
