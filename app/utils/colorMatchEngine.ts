/**
 * COLOR MATCH 遊戲核心邏輯（純 TypeScript，完全不依賴 Vue／DOM，比照 whackAMoleEngine.ts 的寫法）。
 *
 * 玩法：30 秒倒數內看到一個 TARGET 顏色，從 4 個選項中選出正確顏色，答對加分＋combo 提高下一次
 * 得分、答錯扣一點時間並清空 combo（不直接 Game Over）。難度隨已過秒數分三階段遞增：
 *   0~10s（PHASE1）：固定 4 色（BASE_COLORS）。
 *   10~20s（PHASE2）：色盤擴充到 6 色（EXTENDED_COLORS），每題隨機抽 4 個當選項。
 *   20~30s（PHASE3）：一半機率換成「相近色」題目（CLOSE_COLOR_FAMILIES，4 個選項同色系不同深淺，
 *     純粹考驗仔細辨色）；另一半機率維持一般題但開始有機率出現 Stroop 題（文字內容≠文字顏色，
 *     答案是「顏色」不是「文字」），機率隨秒數線性提高，避免一進 phase3 就大量出現。
 * Game Timer（30 秒倒數）比照 whackAMoleEngine 的既有慣例，由呼叫端（頁面）每秒呼叫一次
 * `tickTimer()` 推進，引擎本身不持有 setInterval。
 */

// ── 型別 ──
export type ColorMatchStatus = 'idle' | 'playing' | 'paused' | 'gameover'

export type ColorOption = { id: string; hex: string; label: string }

export type Question = {
  isStroop: boolean
  /** 玩家實際要選的顏色（COLOR 題＝TARGET 色塊本身；STROOP 題＝文字的「顯示顏色」，不是文字內容） */
  targetHex: string
  /** 僅 STROOP 題有值：畫面顯示的文字內容（刻意跟 targetHex 對應的顏色名稱不同） */
  stroopWordLabel?: string
  /** 4 個選項，恰好一個 hex === targetHex */
  options: ColorOption[]
  correctIndex: number
}

export type ColorMatchSnapshot = {
  status: ColorMatchStatus
  score: number
  combo: number
  maxCombo: number
  remainingSec: number
  question: Question
  correctCount: number
  wrongCount: number
  lastResult: 'correct' | 'wrong' | null
}

export type AnswerResult = {
  correct: boolean
  scoreDelta: number
  comboAfter: number
  gameOver: boolean
}

// ── 對局常數（集中管理）──
export const ROUND_DURATION_SEC = 30
export const OPTION_COUNT = 4
export const BASE_SCORE = 100
export const COMBO_SCORE_STEP = 10
/** combo 加成計算上限：超過這個 combo 數，單題得分不再繼續往上加（避免無上限計分，見 server maxReasonableScore） */
export const MAX_COMBO_FOR_SCORE = 10
/** 答錯不會直接 Game Over，但會扣一點剩餘時間，逼玩家不能亂猜 */
export const WRONG_TIME_PENALTY_SEC = 1

export const PHASE2_AT_SEC = 10
export const PHASE3_AT_SEC = 20
/** Stroop 題出現機率：phase3 一開始很低，越接近時間結束機率越高（線性內插） */
export const STROOP_MIN_PROB = 0.15
export const STROOP_MAX_PROB = 0.55
/** phase3 每題有這個機率換成「相近色」題型，另一半機率維持一般題（含 Stroop 機率判定） */
export const CLOSE_COLOR_PROB_PHASE3 = 0.5

export const BASE_COLORS: ColorOption[] = [
  { id: 'red', hex: '#ff4d4d', label: 'RED' },
  { id: 'blue', hex: '#4d7dff', label: 'BLUE' },
  { id: 'green', hex: '#4dff88', label: 'GREEN' },
  { id: 'yellow', hex: '#ffe14d', label: 'YELLOW' }
]

export const EXTENDED_COLORS: ColorOption[] = [
  ...BASE_COLORS,
  { id: 'orange', hex: '#ff9f4d', label: 'ORANGE' },
  { id: 'purple', hex: '#b44dff', label: 'PURPLE' }
]

/** 相近色題庫：每組 4 個同色系不同深淺（同一個 label），逼玩家用眼睛比對色塊本身而非靠顏色名稱 */
export const CLOSE_COLOR_FAMILIES: ColorOption[][] = [
  [
    { id: 'red-1', hex: '#ff3333', label: 'RED' },
    { id: 'red-2', hex: '#ff5252', label: 'RED' },
    { id: 'red-3', hex: '#ff6b6b', label: 'RED' },
    { id: 'red-4', hex: '#ff8080', label: 'RED' }
  ],
  [
    { id: 'blue-1', hex: '#3355ff', label: 'BLUE' },
    { id: 'blue-2', hex: '#4d7dff', label: 'BLUE' },
    { id: 'blue-3', hex: '#6699ff', label: 'BLUE' },
    { id: 'blue-4', hex: '#80b3ff', label: 'BLUE' }
  ],
  [
    { id: 'green-1', hex: '#22b855', label: 'GREEN' },
    { id: 'green-2', hex: '#33cc66', label: 'GREEN' },
    { id: 'green-3', hex: '#4dff88', label: 'GREEN' },
    { id: 'green-4', hex: '#70ffa3', label: 'GREEN' }
  ]
]

/** combo → 單題得分：BASE_SCORE 起跳，每多 1 combo +COMBO_SCORE_STEP，combo 超過上限後不再繼續加 */
export const scoreForCombo = (combo: number): number => {
  const capped = Math.min(Math.max(1, combo), MAX_COMBO_FOR_SCORE)
  return BASE_SCORE + (capped - 1) * COMBO_SCORE_STEP
}

/** 從 pool 隨機取 count 個不重複（依 hex）選項，pool 長度不足時直接回傳整個 pool（不會發生在目前常數設定下） */
const sampleDistinct = (pool: ColorOption[], count: number, random: () => number): ColorOption[] => {
  const shuffled = [...pool]
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!]
  }
  return shuffled.slice(0, Math.min(count, shuffled.length))
}

/** 依已過秒數換算目前難度階段：1（0~10s）／2（10~20s）／3（20~30s以上） */
export const currentPhase = (elapsedSec: number): 1 | 2 | 3 => {
  if (elapsedSec < PHASE2_AT_SEC) return 1
  if (elapsedSec < PHASE3_AT_SEC) return 2
  return 3
}

/** Stroop 題出現機率：phase3 才 > 0，隨秒數線性從 STROOP_MIN_PROB 升到 STROOP_MAX_PROB */
export const stroopProbability = (elapsedSec: number): number => {
  if (elapsedSec < PHASE3_AT_SEC) return 0
  const span = Math.max(1, ROUND_DURATION_SEC - PHASE3_AT_SEC)
  const ratio = Math.min(1, (elapsedSec - PHASE3_AT_SEC) / span)
  return STROOP_MIN_PROB + (STROOP_MAX_PROB - STROOP_MIN_PROB) * ratio
}

/** 依已過秒數（純函式，方便單元測試）產生下一題；random 可注入決定性亂數 */
export const generateQuestion = (elapsedSec: number, random: () => number = Math.random): Question => {
  const phase = currentPhase(elapsedSec)
  const useClose = phase === 3 && random() < CLOSE_COLOR_PROB_PHASE3
  const pool = useClose
    ? CLOSE_COLOR_FAMILIES[Math.floor(random() * CLOSE_COLOR_FAMILIES.length)]!
    : phase === 1
      ? BASE_COLORS
      : EXTENDED_COLORS

  const options = sampleDistinct(pool, OPTION_COUNT, random)
  const correctIndex = Math.floor(random() * options.length)
  const targetHex = options[correctIndex]!.hex

  const isStroop = !useClose && random() < stroopProbability(elapsedSec)
  let stroopWordLabel: string | undefined
  if (isStroop) {
    const candidates = pool.filter((c) => c.label !== options[correctIndex]!.label)
    const fallback = options[correctIndex]!.label
    stroopWordLabel = candidates.length > 0 ? candidates[Math.floor(random() * candidates.length)]!.label : fallback
  }

  return { isStroop, targetHex, stroopWordLabel, options, correctIndex }
}

export type ColorMatchEngineOptions = {
  /** 隨機源（測試可注入決定性亂數），預設 Math.random */
  random?: () => number
}

/**
 * COLOR MATCH 引擎：整合倒數計時／出題／作答判定／Combo／Score（比照 whackAMoleEngine 的
 * class 結構）。對外提供 `reset/start`、`tickTimer`、`answer`、`getSnapshot`。
 */
/**
 * 建構時的固定初始題目（不吃亂數）：SSR 與 client 各自 new 一次 engine，若建構時就呼叫
 * `generateQuestion(0, Math.random)`，兩邊會各自抽到不同題目，造成 hydration mismatch
 * （比照 whackAMoleEngine 用固定 9 個空洞穴初始化的做法）。真正隨機的題目只在 `reset()`
 * 產生——`reset()` 只會被 client-only 的 `onMounted`／`start()` 呼叫，不會在 SSR 階段執行。
 */
const PLACEHOLDER_QUESTION: Question = {
  isStroop: false,
  targetHex: BASE_COLORS[0]!.hex,
  options: BASE_COLORS,
  correctIndex: 0
}

export default class ColorMatchEngine {
  private status: ColorMatchStatus = 'idle'
  private score = 0
  private combo = 0
  private maxCombo = 0
  private remainingSec = ROUND_DURATION_SEC
  private elapsedSec = 0
  private correctCount = 0
  private wrongCount = 0
  private lastResult: 'correct' | 'wrong' | null = null
  private question: Question = PLACEHOLDER_QUESTION
  private random: () => number

  constructor(options: ColorMatchEngineOptions = {}) {
    this.random = options.random ?? Math.random
  }

  /** 完整重置；status 回到 idle，不殘留上一局資料 */
  reset(): void {
    this.status = 'idle'
    this.score = 0
    this.combo = 0
    this.maxCombo = 0
    this.remainingSec = ROUND_DURATION_SEC
    this.elapsedSec = 0
    this.correctCount = 0
    this.wrongCount = 0
    this.lastResult = null
    this.question = generateQuestion(0, this.random)
  }

  /** 開始新的一局：完整重置後進入 playing */
  start(): void {
    this.reset()
    this.status = 'playing'
  }

  /** 暫停：保留當前題目／分數／combo／剩餘秒數，playing 時才生效 */
  pause(): void {
    if (this.status !== 'playing') return
    this.status = 'paused'
  }

  /** 續玩：回到 playing，不重新出題（維持暫停前的題目） */
  resume(): void {
    if (this.status !== 'paused') return
    this.status = 'playing'
  }

  /** Game Timer：每秒呼叫一次遞減剩餘秒數，歸零時結束遊戲；回傳本次是否結束 */
  tickTimer(): boolean {
    if (this.status !== 'playing') return false
    this.remainingSec -= 1
    this.elapsedSec += 1
    if (this.remainingSec <= 0) {
      this.remainingSec = 0
      this.status = 'gameover'
      return true
    }
    return false
  }

  /** 玩家選擇第 optionIndex 個選項；答對出下一題＋加分＋combo+1，答錯扣時間＋combo歸零＋出下一題 */
  answer(optionIndex: number): AnswerResult {
    if (this.status !== 'playing') return { correct: false, scoreDelta: 0, comboAfter: this.combo, gameOver: false }

    const correct = optionIndex === this.question.correctIndex
    if (correct) {
      this.combo += 1
      this.maxCombo = Math.max(this.maxCombo, this.combo)
      this.correctCount += 1
      const gained = scoreForCombo(this.combo)
      this.score += gained
      this.lastResult = 'correct'
      this.question = generateQuestion(this.elapsedSec, this.random)
      return { correct: true, scoreDelta: gained, comboAfter: this.combo, gameOver: false }
    }

    this.combo = 0
    this.wrongCount += 1
    this.lastResult = 'wrong'
    this.remainingSec = Math.max(0, this.remainingSec - WRONG_TIME_PENALTY_SEC)
    this.question = generateQuestion(this.elapsedSec, this.random)
    const gameOver = this.remainingSec <= 0
    if (gameOver) this.status = 'gameover'
    return { correct: false, scoreDelta: 0, comboAfter: 0, gameOver }
  }

  /** 對外回傳純資料快照（頁面用 reactive() 鏡像） */
  getSnapshot(): ColorMatchSnapshot {
    return {
      status: this.status,
      score: this.score,
      combo: this.combo,
      maxCombo: this.maxCombo,
      remainingSec: this.remainingSec,
      question: this.question,
      correctCount: this.correctCount,
      wrongCount: this.wrongCount,
      lastResult: this.lastResult
    }
  }
}
