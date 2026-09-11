type PrizeTierRaw = {
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

type TaiwanLotteryPrizeTier = {
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

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const gameCode = Number(query.gameCode)
  const period = String(query.period || '')

  if (!gameCode || !period) {
    throw createError({ statusCode: 400, message: '缺少 gameCode 或 period' })
  }

  const def = GAME_DEFS[gameCode]
  if (!def) {
    return { gameCode, period, tiers: [] as TaiwanLotteryPrizeTier[] }
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
})
