import { computed, reactive, type InjectionKey, provide, inject } from 'vue'

export type PlayModeKey = 'single' | 'duplex' | 'dantuo' | 'number'

type PlayModeRule = {
  key: PlayModeKey
  label: string
  minPick: number
  maxPick: number
  hint: string
}

type BetRow = {
  id: string
  mode: string
  code: string
  count: number
  amount: number
}

const PLAY_MODE_DICT: Record<PlayModeKey, PlayModeRule> = {
  single: { key: 'single', label: '自選單式', minPick: 7, maxPick: 7, hint: '每注需精準選 7 碼。' },
  duplex: { key: 'duplex', label: '自選復式', minPick: 8, maxPick: 20, hint: '至少選 8 碼，系統自動組合。' },
  dantuo: { key: 'dantuo', label: '自選膽拖', minPick: 2, maxPick: 5, hint: '膽碼 1-5，拖碼補齊 7 碼。' },
  number: { key: 'number', label: '運財號碼', minPick: 1, maxPick: 1, hint: '每注選 1 個運財號碼。' }
}

const RED_SET = new Set([1, 2, 7, 8, 12, 13, 18, 19, 23, 24, 29, 30, 34, 35, 40, 45, 46])
const BLUE_SET = new Set([3, 4, 9, 10, 14, 15, 20, 25, 26, 31, 36, 37, 41, 42, 47, 48])

const A6_CONTEXT_KEY: InjectionKey<ReturnType<typeof createA6OfficialController>> = Symbol('A6_OFFICIAL')

const combination = (n: number, r: number) => {
  if (r < 0 || n < r) return 0
  if (r === 0 || n === r) return 1
  const k = Math.min(r, n - r)
  let result = 1
  for (let i = 1; i <= k; i += 1) {
    result = (result * (n - k + i)) / i
  }
  return Math.floor(result)
}

export const createA6OfficialController = () => {
  const numberPool = Array.from({ length: 49 }, (_, i) => i + 1)
  const modeList = Object.values(PLAY_MODE_DICT)

  const state = reactive({
    mode: 'single' as PlayModeKey,
    picks: [] as number[],
    danPicks: [] as number[],
    tuoPicks: [] as number[],
    amount: 10,
    multiplier: 1,
    issueCount: 1,
    rows: [] as BetRow[],
    favRows: [] as BetRow[],
    message: ''
  })

  const currentRule = computed(() => PLAY_MODE_DICT[state.mode])
  const totalMoney = computed(() => state.rows.reduce((sum, row) => sum + row.amount, 0))

  const currentBetCount = computed(() => {
    if (state.mode === 'single') return state.picks.length === 7 ? 1 : 0
    if (state.mode === 'duplex') return state.picks.length >= 8 ? combination(state.picks.length, 7) : 0
    if (state.mode === 'dantuo') {
      const dan = state.danPicks.length
      const tuo = state.tuoPicks.length
      if (dan < 1 || dan > 5) return 0
      const needTuo = 7 - dan
      if (tuo < needTuo) return 0
      return combination(tuo, needTuo)
    }
    return state.picks.length === 1 ? 1 : 0
  })

  const currentPreviewCode = computed(() => {
    if (state.mode === 'dantuo') {
      const dan = state.danPicks.map((n) => String(n).padStart(2, '0')).join(',')
      const tuo = state.tuoPicks.map((n) => String(n).padStart(2, '0')).join(',')
      return `膽[${dan || '-'}] 拖[${tuo || '-'}]`
    }
    return state.picks.map((n) => String(n).padStart(2, '0')).join(',') || '-'
  })

  const resetCurrentPicks = () => {
    state.picks = []
    state.danPicks = []
    state.tuoPicks = []
  }

  const setMode = (mode: PlayModeKey) => {
    state.mode = mode
    resetCurrentPicks()
  }

  const getBallClass = (num: number) => {
    if (state.mode === 'dantuo') {
      if (state.danPicks.includes(num)) return 'dan'
      if (state.tuoPicks.includes(num)) return 'tuo'
      return 'idle'
    }
    if (!state.picks.includes(num)) return 'idle'
    if (RED_SET.has(num)) return 'red'
    if (BLUE_SET.has(num)) return 'blue'
    return 'green'
  }

  const togglePick = (num: number) => {
    if (state.mode === 'dantuo') return
    const list = state.picks
    const idx = list.indexOf(num)
    if (idx >= 0) {
      list.splice(idx, 1)
      return
    }
    if (state.mode === 'single' && list.length >= 7) return
    if (state.mode === 'number' && list.length >= 1) {
      state.picks = [num]
      return
    }
    if (state.mode === 'duplex' && list.length >= 20) return
    list.push(num)
    list.sort((a, b) => a - b)
  }

  const toggleDanTuo = (num: number, bucket: 'dan' | 'tuo') => {
    const target = bucket === 'dan' ? state.danPicks : state.tuoPicks
    const other = bucket === 'dan' ? state.tuoPicks : state.danPicks
    const idx = target.indexOf(num)
    if (idx >= 0) {
      target.splice(idx, 1)
      return
    }
    if (other.includes(num)) return
    if (bucket === 'dan' && state.danPicks.length >= 5) return
    target.push(num)
    target.sort((a, b) => a - b)
  }

  const randomPick = () => {
    if (state.mode === 'dantuo') {
      resetCurrentPicks()
      const shuffled = [...numberPool].sort(() => Math.random() - 0.5)
      state.danPicks = shuffled.slice(0, 2).sort((a, b) => a - b)
      state.tuoPicks = shuffled.slice(2, 7).sort((a, b) => a - b)
      return
    }

    const count = state.mode === 'number' ? 1 : 7
    const shuffled = [...numberPool].sort(() => Math.random() - 0.5).slice(0, count)
    state.picks = shuffled.sort((a, b) => a - b)
  }

  const addBetRow = () => {
    state.message = ''
    if (currentBetCount.value <= 0) {
      state.message = '選號條件不足，請先完成玩法需求。'
      return
    }

    const id = `A6-${Date.now()}`
    const unit = Math.max(1, Number(state.amount)) * Math.max(1, Number(state.multiplier))
    const row: BetRow = {
      id,
      mode: currentRule.value.label,
      code: currentPreviewCode.value,
      count: currentBetCount.value * Math.max(1, Number(state.issueCount)),
      amount: currentBetCount.value * unit * Math.max(1, Number(state.issueCount))
    }
    state.rows.unshift(row)
  }

  const clearRows = () => {
    state.rows = []
    state.message = ''
  }

  const submitBet = () => {
    if (state.rows.length === 0) {
      state.message = '請先加入注單。'
      return
    }
    state.favRows = [...state.rows, ...state.favRows].slice(0, 12)
    state.rows = []
    state.message = '官方六合彩已模擬送單成功。'
  }

  return {
    state,
    numberPool,
    modeList,
    currentRule,
    currentBetCount,
    currentPreviewCode,
    totalMoney,
    setMode,
    getBallClass,
    togglePick,
    toggleDanTuo,
    randomPick,
    resetCurrentPicks,
    addBetRow,
    clearRows,
    submitBet
  }
}

export const provideA6Official = () => {
  const ctx = createA6OfficialController()
  provide(A6_CONTEXT_KEY, ctx)
  return ctx
}

export const useA6Official = () => {
  const ctx = inject(A6_CONTEXT_KEY)
  if (!ctx) {
    throw new Error('useA6Official must be used within provideA6Official context')
  }
  return ctx
}
