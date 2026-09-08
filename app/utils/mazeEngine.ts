/**
 * MAZE 遊戲核心邏輯（純 TypeScript，完全不依賴 Vue／DOM，比照 whackAMoleEngine.ts 的寫法）。
 *
 * 迷宮生成採 Recursive Backtracking（用堆疊迴圈實作，避免遞迴深度問題）：從 (0,0) 出發，隨機挑一個
 * 未造訪的鄰居房間打通牆壁、往前走，走到死路就回溯（stack pop），直到所有房間都造訪過。這個演算法
 * 天生保證「每個房間都恰好有一條路徑通往起點」（完美迷宮，Perfect Maze），不需要事後再驗證可達性。
 *
 * 房間格（cols×rows）轉成可渲染的網格時，每個房間佔一格、房間之間補一格牆壁，渲染網格尺寸固定是
 * (2*cols+1) x (2*rows+1)——比照經典迷宮視覺（見 design：`████` 為牆、空格為路徑）。
 *
 * 兩種模式共用同一顆 engine：
 *   CLASSIC：沒有時間限制，一路過關會越來越大關，連續玩到 MAX_CLASSIC_LEVEL 封頂自動結算
 *            （避免無上限刷分，見 maxReasonableScore）。
 *   TIME_ATTACK：共用 TIME_ATTACK_DURATION_SEC 秒倒數，歸零立即結束，過關一樣持續累積分數。
 * Game Timer（僅 TIME_ATTACK 用得到）比照 whackAMoleEngine 慣例，由頁面每秒呼叫一次 tickTimer()。
 */

// ── 型別 ──
export type MazeStatus = 'idle' | 'playing' | 'paused' | 'gameover'
export type MazeMode = 'CLASSIC' | 'TIME_ATTACK'
export type MazeMoveDirection = 'up' | 'down' | 'left' | 'right'
export type CellType = 'WALL' | 'PATH'

export type MazeSnapshot = {
  status: MazeStatus
  mode: MazeMode
  grid: CellType[][]
  playerRow: number
  playerCol: number
  exitRow: number
  exitCol: number
  level: number
  steps: number
  elapsedSec: number
  remainingSec: number
  score: number
  totalStepsAllLevels: number
}

export type MazeMoveResult = {
  moved: boolean
  reachedExit: boolean
  levelScore: number
  gameOver: boolean
}

// ── 對局常數 ──
export const MIN_ROOMS = 5
export const MAX_ROOMS = 10
export const MAX_CLASSIC_LEVEL = 50
export const TIME_ATTACK_DURATION_SEC = 90

export const MAZE_BASE_SCORE = 100
export const MAZE_LEVEL_BONUS_PER_LEVEL = 20
/** 關卡加成只算到這個等級為止，避免關卡數无上限往上疊加分數（見 maxReasonableScore） */
export const MAZE_LEVEL_BONUS_CAP_LEVEL = 30
export const MAZE_STEP_PENALTY_PER_EXTRA_STEP = 2
export const MAZE_TIME_PENALTY_PER_SEC = 1
export const MAZE_MIN_LEVEL_SCORE = 20

/** 依關卡數換算本局房間數（cols=rows），5 間房起跳、每級緩慢增加、上限 10 間房（見檔頭說明的級距對照） */
export const mazeRoomsForLevel = (level: number): number => {
  const rooms = MIN_ROOMS + Math.floor((level - 1) * 0.6)
  return Math.min(MAX_ROOMS, Math.max(MIN_ROOMS, rooms))
}

/** 單關得分：基礎分＋關卡加成（封頂）－多走的步數與花費秒數的效率懲罰，下限 MAZE_MIN_LEVEL_SCORE */
export const scoreForLevelClear = (level: number, steps: number, parSteps: number, elapsedSec: number): number => {
  const cappedLevel = Math.min(level, MAZE_LEVEL_BONUS_CAP_LEVEL)
  const base = MAZE_BASE_SCORE + cappedLevel * MAZE_LEVEL_BONUS_PER_LEVEL
  const stepPenalty = Math.max(0, steps - parSteps) * MAZE_STEP_PENALTY_PER_EXTRA_STEP
  const timePenalty = Math.floor(elapsedSec) * MAZE_TIME_PENALTY_PER_SEC
  return Math.max(MAZE_MIN_LEVEL_SCORE, base - stepPenalty - timePenalty)
}

type RoomCell = { visited: boolean; up: boolean; down: boolean; left: boolean; right: boolean }

const inRoomBounds = (r: number, c: number, cols: number, rows: number): boolean => r >= 0 && r < rows && c >= 0 && c < cols

/** Recursive Backtracking：堆疊迴圈實作，回傳每個房間的四面牆狀態（true=有牆） */
const generateRoomGrid = (cols: number, rows: number, random: () => number): RoomCell[][] => {
  const grid: RoomCell[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({ visited: false, up: true, down: true, left: true, right: true }))
  )
  const stack: Array<{ r: number; c: number }> = [{ r: 0, c: 0 }]
  grid[0]![0]!.visited = true

  while (stack.length > 0) {
    const current = stack[stack.length - 1]!
    const candidates: Array<{ r: number; c: number; dir: 'up' | 'down' | 'left' | 'right' }> = []
    if (inRoomBounds(current.r - 1, current.c, cols, rows) && !grid[current.r - 1]![current.c]!.visited) {
      candidates.push({ r: current.r - 1, c: current.c, dir: 'up' })
    }
    if (inRoomBounds(current.r + 1, current.c, cols, rows) && !grid[current.r + 1]![current.c]!.visited) {
      candidates.push({ r: current.r + 1, c: current.c, dir: 'down' })
    }
    if (inRoomBounds(current.r, current.c - 1, cols, rows) && !grid[current.r]![current.c - 1]!.visited) {
      candidates.push({ r: current.r, c: current.c - 1, dir: 'left' })
    }
    if (inRoomBounds(current.r, current.c + 1, cols, rows) && !grid[current.r]![current.c + 1]!.visited) {
      candidates.push({ r: current.r, c: current.c + 1, dir: 'right' })
    }

    if (candidates.length === 0) {
      stack.pop()
      continue
    }

    const pick = candidates[Math.floor(random() * candidates.length)]!
    if (pick.dir === 'up') {
      grid[current.r]![current.c]!.up = false
      grid[pick.r]![pick.c]!.down = false
    } else if (pick.dir === 'down') {
      grid[current.r]![current.c]!.down = false
      grid[pick.r]![pick.c]!.up = false
    } else if (pick.dir === 'left') {
      grid[current.r]![current.c]!.left = false
      grid[pick.r]![pick.c]!.right = false
    } else {
      grid[current.r]![current.c]!.right = false
      grid[pick.r]![pick.c]!.left = false
    }
    grid[pick.r]![pick.c]!.visited = true
    stack.push({ r: pick.r, c: pick.c })
  }

  return grid
}

/** 房間格轉可渲染網格：(2*cols+1) x (2*rows+1)，房間佔奇數座標、牆壁佔偶數座標，打通的牆改成 PATH */
const roomGridToRenderGrid = (rooms: RoomCell[][], cols: number, rows: number): CellType[][] => {
  const renderCols = 2 * cols + 1
  const renderRows = 2 * rows + 1
  const grid: CellType[][] = Array.from({ length: renderRows }, () => Array<CellType>(renderCols).fill('WALL'))

  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const rr = 2 * r + 1
      const rc = 2 * c + 1
      grid[rr]![rc] = 'PATH'
      const cell = rooms[r]![c]!
      if (!cell.up) grid[rr - 1]![rc] = 'PATH'
      if (!cell.down) grid[rr + 1]![rc] = 'PATH'
      if (!cell.left) grid[rr]![rc - 1] = 'PATH'
      if (!cell.right) grid[rr]![rc + 1] = 'PATH'
    }
  }

  return grid
}

/** 建構時的固定初始迷宮（不吃亂數）：避免 SSR／client 各自產生不同迷宮造成 hydration mismatch
 *  （比照 colorMatchEngine 的 PLACEHOLDER_QUESTION 做法）。真正的隨機迷宮只在 client-only 的
 *  `reset()`（由 `onMounted`／`start()` 觸發）才產生。 */
const PLACEHOLDER_GRID: CellType[][] = [
  ['WALL', 'WALL', 'WALL'],
  ['WALL', 'PATH', 'WALL'],
  ['WALL', 'WALL', 'WALL']
]

export type MazeEngineOptions = {
  /** 隨機源（測試可注入決定性亂數），預設 Math.random */
  random?: () => number
}

/**
 * MAZE 引擎：整合迷宮生成／移動／關卡／計分／（Time Attack）倒數計時。
 * 對外提供 `reset(mode)`、`start(mode)`、`move`、`tickTimer`、`getSnapshot`。
 */
export default class MazeEngine {
  private status: MazeStatus = 'idle'
  private mode: MazeMode = 'CLASSIC'
  private grid: CellType[][] = PLACEHOLDER_GRID
  private playerRow = 1
  private playerCol = 1
  private exitRow = 1
  private exitCol = 1
  private level = 1
  private steps = 0
  private elapsedSec = 0
  private remainingSec = TIME_ATTACK_DURATION_SEC
  private score = 0
  private totalStepsAllLevels = 0
  private random: () => number

  constructor(options: MazeEngineOptions = {}) {
    this.random = options.random ?? Math.random
  }

  /** 依目前 level 產生新迷宮，玩家歸位到起點 (1,1)、本關步數與計時歸零（跨關累計分數/總步數不受影響） */
  private buildLevel(): void {
    const rooms = mazeRoomsForLevel(this.level)
    const roomGrid = generateRoomGrid(rooms, rooms, this.random)
    this.grid = roomGridToRenderGrid(roomGrid, rooms, rooms)
    this.playerRow = 1
    this.playerCol = 1
    this.exitRow = 2 * rooms - 1
    this.exitCol = 2 * rooms - 1
    this.steps = 0
    this.elapsedSec = 0
  }

  /** 完整重置；status 回到 idle，不殘留上一局資料 */
  reset(mode: MazeMode = 'CLASSIC'): void {
    this.status = 'idle'
    this.mode = mode
    this.level = 1
    this.score = 0
    this.totalStepsAllLevels = 0
    this.remainingSec = TIME_ATTACK_DURATION_SEC
    this.buildLevel()
  }

  /** 開始新的一局：完整重置後進入 playing */
  start(mode: MazeMode = 'CLASSIC'): void {
    this.reset(mode)
    this.status = 'playing'
  }

  /** 暫停：保留當前迷宮／位置／分數／計時，playing 時才生效 */
  pause(): void {
    if (this.status !== 'playing') return
    this.status = 'paused'
  }

  /** 續玩：回到 playing */
  resume(): void {
    if (this.status !== 'paused') return
    this.status = 'playing'
  }

  /** Game Timer（僅 TIME_ATTACK 有意義）：每秒呼叫一次，CLASSIC 模式直接無視、回傳 false */
  tickTimer(): boolean {
    if (this.status !== 'playing' || this.mode !== 'TIME_ATTACK') return false
    this.remainingSec -= 1
    this.elapsedSec += 1
    if (this.remainingSec <= 0) {
      this.remainingSec = 0
      this.status = 'gameover'
      return true
    }
    return false
  }

  /** 玩家往指定方向移動一格；碰牆視為無效移動（不消耗步數），走到出口即過關並自動產生下一關（更大） */
  move(direction: MazeMoveDirection): MazeMoveResult {
    if (this.status !== 'playing') return { moved: false, reachedExit: false, levelScore: 0, gameOver: false }

    let row = this.playerRow
    let col = this.playerCol
    if (direction === 'up') row -= 1
    else if (direction === 'down') row += 1
    else if (direction === 'left') col -= 1
    else col += 1

    const targetRow = this.grid[row]
    if (!targetRow || targetRow[col] !== 'PATH') return { moved: false, reachedExit: false, levelScore: 0, gameOver: false }

    this.playerRow = row
    this.playerCol = col
    this.steps += 1
    this.totalStepsAllLevels += 1
    if (this.mode === 'CLASSIC') this.elapsedSec += 1

    if (row === this.exitRow && col === this.exitCol) {
      const rooms = mazeRoomsForLevel(this.level)
      const parSteps = 2 * (rooms - 1)
      const levelScore = scoreForLevelClear(this.level, this.steps, parSteps, this.elapsedSec)
      this.score += levelScore

      if (this.level >= MAX_CLASSIC_LEVEL) {
        this.status = 'gameover'
        return { moved: true, reachedExit: true, levelScore, gameOver: true }
      }

      this.level += 1
      this.buildLevel()
      return { moved: true, reachedExit: true, levelScore, gameOver: false }
    }

    return { moved: true, reachedExit: false, levelScore: 0, gameOver: false }
  }

  /** 對外回傳純資料快照（頁面用 reactive() 鏡像） */
  getSnapshot(): MazeSnapshot {
    return {
      status: this.status,
      mode: this.mode,
      grid: this.grid.map((row) => [...row]),
      playerRow: this.playerRow,
      playerCol: this.playerCol,
      exitRow: this.exitRow,
      exitCol: this.exitCol,
      level: this.level,
      steps: this.steps,
      elapsedSec: this.elapsedSec,
      remainingSec: this.remainingSec,
      score: this.score,
      totalStepsAllLevels: this.totalStepsAllLevels
    }
  }
}
