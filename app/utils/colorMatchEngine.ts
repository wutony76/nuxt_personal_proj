/**
 * COLOR MATCH 遊戲核心邏輯（純 TypeScript，完全不依賴 Vue／DOM，比照 whackAMoleEngine.ts 的寫法）。
 *
 * 玩法（依序點色生存模式）：畫面上方顯示一組「目標顏色序列」，玩家要依序點擊下方調色盤網格中對應
 * 顏色的格子（网格中同色格子有多個時，點任一個都算數）。序列全部依序點完＝完成 1 次 match：
 *   - 每答對完成 10 次 match，下一次要求的序列長度 +1（1 → 2 → 3 …，上限 MAX_SEQUENCE_LENGTH）。
 *   - 每答對完成 20 次 match，調色盤網格邊長 +1（2x2 → 3x3 → 4x4 …，上限 MAX_GRID_DIM），
 *     顏色種類優先從色盤擴充新顏色填滿網格，色盤顏色種類用完後才允許同色重複出現在多個格子。
 *   - 序列中間點錯：COMBO 歸零，但沿用同一組目標序列，游標退回序列開頭重新點（網格與序列內容不變）。
 *   - 每成功完成 1 次 match：時間 +3 秒；若完成當下 combo 剛好是 5 的倍數，則該次得分 double、
 *     時間改加 5 秒（不是 3+5）。
 * 這是一個「生存模式」：時間只會因為連續答對累積而增加，答錯不扣秒數，時間歸零才結束遊戲。
 * Game Timer 比照 whackAMoleEngine 的既有慣例，由呼叫端（頁面）每秒呼叫一次 `tickTimer()` 推進，
 * 引擎本身不持有 setInterval。
 */

// ── 型別 ──
export type ColorMatchStatus = 'idle' | 'playing' | 'paused' | 'gameover'

export type ColorOption = { id: string; hex: string; label: string }

export type ColorMatchSnapshot = {
  status: ColorMatchStatus
  score: number
  combo: number
  maxCombo: number
  remainingSec: number
  totalMatches: number
  gridDim: number
  gridCells: ColorOption[]
  targetSequence: ColorOption[]
  sequenceProgress: number
  lastResult: 'step' | 'complete' | 'wrong' | null
}

export type AnswerResult = {
  correct: boolean
  /** 這次點擊是否讓整組目標序列完成（觸發計分／加時／combo+1） */
  sequenceComplete: boolean
  scoreDelta: number
  secondsGained: number
  comboAfter: number
  isMilestone: boolean
  gameOver: boolean
}

// ── 對局常數（集中管理）──
export const INITIAL_TIME_SEC = 30
export const TIME_BONUS_NORMAL_SEC = 3
export const TIME_BONUS_MILESTONE_SEC = 5
/** combo 每達這個倍數，當次得分 double、加時改用 TIME_BONUS_MILESTONE_SEC */
export const MILESTONE_COMBO_STEP = 5

export const SEQUENCE_TIER_SIZE = 10
export const GRID_TIER_SIZE = 20
export const MIN_SEQUENCE_LENGTH = 1
export const MAX_SEQUENCE_LENGTH = 8
export const MIN_GRID_DIM = 2
export const MAX_GRID_DIM = 6

/** 每次完成序列的基礎得分＝這個值 × 剛完成的序列長度（序列越長，一次 match 分數越高） */
export const SCORE_PER_SEQUENCE_STEP = 100

/** 調色盤：10 種可辨識度高的顏色，網格夠大（>10 格）時才會出現同色重複的格子 */
export const COLOR_PALETTE: ColorOption[] = [
  { id: 'red', hex: '#ff4d4d', label: 'RED' },
  { id: 'blue', hex: '#4d7dff', label: 'BLUE' },
  { id: 'green', hex: '#4dff88', label: 'GREEN' },
  { id: 'yellow', hex: '#ffe14d', label: 'YELLOW' },
  { id: 'orange', hex: '#ff9f4d', label: 'ORANGE' },
  { id: 'purple', hex: '#b44dff', label: 'PURPLE' },
  { id: 'cyan', hex: '#22d3ee', label: 'CYAN' },
  { id: 'pink', hex: '#ff6ec7', label: 'PINK' },
  { id: 'lime', hex: '#a3e635', label: 'LIME' },
  { id: 'teal', hex: '#14b8a6', label: 'TEAL' }
]

/** 依累計完成次數換算下一組序列長度：每 SEQUENCE_TIER_SIZE 次 +1，封頂 MAX_SEQUENCE_LENGTH */
export const sequenceLengthForMatches = (totalMatches: number): number =>
  Math.min(MAX_SEQUENCE_LENGTH, MIN_SEQUENCE_LENGTH + Math.floor(totalMatches / SEQUENCE_TIER_SIZE))

/** 依累計完成次數換算下一輪網格邊長：每 GRID_TIER_SIZE 次 +1，封頂 MAX_GRID_DIM */
export const gridDimForMatches = (totalMatches: number): number =>
  Math.min(MAX_GRID_DIM, MIN_GRID_DIM + Math.floor(totalMatches / GRID_TIER_SIZE))

/** Fisher-Yates 洗牌，回傳新陣列，不修改原陣列 */
const shuffled = <T>(arr: T[], random: () => number): T[] => {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j]!, copy[i]!]
  }
  return copy
}

export type GeneratedRound = {
  gridDim: number
  gridCells: ColorOption[]
  targetSequence: ColorOption[]
}

/**
 * 依累計完成次數（純函式，方便單元測試）產生下一輪的網格與目標序列；random 可注入決定性亂數。
 * 網格顏色種類＝min(調色盤總數, 格子數)，優先取不重複顏色；格子數超過調色盤總數時才重複填色。
 * 目標序列只會從「這一輪網格實際出現的顏色」中抽（可重複，允許連續同色），確保序列一定點得到。
 */
export const generateRound = (totalMatches: number, random: () => number = Math.random): GeneratedRound => {
  const gridDim = gridDimForMatches(totalMatches)
  const cellCount = gridDim * gridDim
  const sequenceLength = sequenceLengthForMatches(totalMatches)

  const distinctCount = Math.min(COLOR_PALETTE.length, cellCount)
  const distinctColors = shuffled(COLOR_PALETTE, random).slice(0, distinctCount)

  const cells: ColorOption[] = []
  for (let i = 0; i < cellCount; i += 1) {
    cells.push(distinctColors[i % distinctColors.length]!)
  }
  const gridCells = shuffled(cells, random)

  const targetSequence = Array.from(
    { length: sequenceLength },
    () => distinctColors[Math.floor(random() * distinctColors.length)]!
  )

  return { gridDim, gridCells, targetSequence }
}

export type ColorMatchEngineOptions = {
  /** 隨機源（測試可注入決定性亂數），預設 Math.random */
  random?: () => number
}

/**
 * 建構時的固定初始題目（不吃亂數）：SSR 與 client 各自 new 一次 engine，若建構時就呼叫
 * `generateRound(0, Math.random)`，兩邊會各自抽到不同排列，造成 hydration mismatch
 * （比照其餘 engine 用固定初始狀態的做法）。真正隨機的題目只在 `reset()` 產生——`reset()`
 * 只會被 client-only 的 `onMounted`／`start()` 呼叫，不會在 SSR 階段執行。
 */
const PLACEHOLDER_ROUND: GeneratedRound = {
  gridDim: MIN_GRID_DIM,
  gridCells: COLOR_PALETTE.slice(0, MIN_GRID_DIM * MIN_GRID_DIM),
  targetSequence: [COLOR_PALETTE[0]!]
}

/**
 * COLOR MATCH 引擎：整合倒數計時（生存模式，只加不扣）／序列出題／網格出題／點擊判定／
 * combo／score／難度分級（比照 whackAMoleEngine 的 class 結構）。
 * 對外提供 `reset/start/pause/resume`、`tickTimer`、`answer`、`getSnapshot`。
 */
export default class ColorMatchEngine {
  private status: ColorMatchStatus = 'idle'
  private score = 0
  private combo = 0
  private maxCombo = 0
  private remainingSec = INITIAL_TIME_SEC
  private totalMatches = 0
  private gridDim = PLACEHOLDER_ROUND.gridDim
  private gridCells: ColorOption[] = PLACEHOLDER_ROUND.gridCells
  private targetSequence: ColorOption[] = PLACEHOLDER_ROUND.targetSequence
  private sequenceProgress = 0
  private lastResult: ColorMatchSnapshot['lastResult'] = null
  private random: () => number

  constructor(options: ColorMatchEngineOptions = {}) {
    this.random = options.random ?? Math.random
  }

  /** 依目前 totalMatches 產生新的一輪網格＋目標序列，游標歸零 */
  private rollNewRound(): void {
    const round = generateRound(this.totalMatches, this.random)
    this.gridDim = round.gridDim
    this.gridCells = round.gridCells
    this.targetSequence = round.targetSequence
    this.sequenceProgress = 0
  }

  /** 完整重置；status 回到 idle，不殘留上一局資料 */
  reset(): void {
    this.status = 'idle'
    this.score = 0
    this.combo = 0
    this.maxCombo = 0
    this.remainingSec = INITIAL_TIME_SEC
    this.totalMatches = 0
    this.lastResult = null
    this.rollNewRound()
  }

  /** 開始新的一局：完整重置後進入 playing */
  start(): void {
    this.reset()
    this.status = 'playing'
  }

  /** 暫停：保留當前網格／序列／分數／combo／剩餘秒數，playing 時才生效 */
  pause(): void {
    if (this.status !== 'playing') return
    this.status = 'paused'
  }

  /** 續玩：回到 playing，不重新出題（維持暫停前的網格與序列進度） */
  resume(): void {
    if (this.status !== 'paused') return
    this.status = 'playing'
  }

  /** Game Timer：每秒呼叫一次遞減剩餘秒數，歸零時結束遊戲；回傳本次是否結束 */
  tickTimer(): boolean {
    if (this.status !== 'playing') return false
    this.remainingSec -= 1
    if (this.remainingSec <= 0) {
      this.remainingSec = 0
      this.status = 'gameover'
      return true
    }
    return false
  }

  /**
   * 玩家點擊網格中 hex 顏色的格子（同色格子點任一個都算數）。
   * 點對且完成整組序列：combo+1、依序列長度＋是否為 milestone 計分與加時、換下一輪網格／序列。
   * 點對但序列未完成：只推進游標，不計分不加時，網格／序列保持不變。
   * 點錯：combo 歸零，游標退回序列開頭，沿用同一組網格／序列（不重新出題，不扣秒數）。
   */
  answer(hex: string): AnswerResult {
    if (this.status !== 'playing') {
      return { correct: false, sequenceComplete: false, scoreDelta: 0, secondsGained: 0, comboAfter: this.combo, isMilestone: false, gameOver: false }
    }

    const expected = this.targetSequence[this.sequenceProgress]!
    if (hex !== expected.hex) {
      this.combo = 0
      this.sequenceProgress = 0
      this.lastResult = 'wrong'
      return { correct: false, sequenceComplete: false, scoreDelta: 0, secondsGained: 0, comboAfter: 0, isMilestone: false, gameOver: false }
    }

    this.sequenceProgress += 1
    if (this.sequenceProgress < this.targetSequence.length) {
      this.lastResult = 'step'
      return { correct: true, sequenceComplete: false, scoreDelta: 0, secondsGained: 0, comboAfter: this.combo, isMilestone: false, gameOver: false }
    }

    // 整組序列完成：先用「剛完成的序列長度」算分，再累加 totalMatches 決定下一輪難度
    const completedLength = this.targetSequence.length
    this.combo += 1
    this.maxCombo = Math.max(this.maxCombo, this.combo)
    this.totalMatches += 1
    this.lastResult = 'complete'

    const isMilestone = this.combo % MILESTONE_COMBO_STEP === 0
    const normalGain = SCORE_PER_SEQUENCE_STEP * completedLength
    const scoreDelta = isMilestone ? normalGain * 2 : normalGain
    const secondsGained = isMilestone ? TIME_BONUS_MILESTONE_SEC : TIME_BONUS_NORMAL_SEC
    this.score += scoreDelta
    this.remainingSec += secondsGained

    this.rollNewRound()

    return { correct: true, sequenceComplete: true, scoreDelta, secondsGained, comboAfter: this.combo, isMilestone, gameOver: false }
  }

  /** 對外回傳純資料快照（頁面用 reactive() 鏡像） */
  getSnapshot(): ColorMatchSnapshot {
    return {
      status: this.status,
      score: this.score,
      combo: this.combo,
      maxCombo: this.maxCombo,
      remainingSec: this.remainingSec,
      totalMatches: this.totalMatches,
      gridDim: this.gridDim,
      gridCells: this.gridCells,
      targetSequence: this.targetSequence,
      sequenceProgress: this.sequenceProgress,
      lastResult: this.lastResult
    }
  }
}
