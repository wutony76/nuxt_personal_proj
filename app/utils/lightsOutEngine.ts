/**
 * LIGHTS OUT 遊戲核心邏輯（純 TypeScript，完全不依賴 Vue／DOM，見 design.md Decision 1）。
 *
 * 棋盤用 `boolean[][]`（`grid[row][col]`）表示，`true` = ON（亮）、`false` = OFF（暗）。
 * 點擊一格會「切換自己＋上下左右 4 個合法鄰格」的 ON/OFF 狀態（XOR 語意），
 * 這裡的鄰域是固定的 **4 方向偏移量**（見 NEIGHBOR_OFFSETS），
 * **刻意不沿用 MINESWEEPER 的 8 方向雙層迴圈**——那會誤把對角格一起切換（見 design.md Decision 1）。
 *
 * 關卡資料集中在 `LEVELS` 表（棋盤大小 size／步數上限 moveLimit／生成用種子 seed）。
 * 每一關的初始盤面都是「從全滅（全 OFF）狀態反向套用一組合法 Toggle」生成的
 * （見 design.md Open Questions）：因為 Toggle 是自身的反元素、且操作可交換，
 * 對全滅盤面套用種子集合 S 產生盤面後，再套用同一組 S 必定解回全滅，
 * 因此每一關天生保證「可在 |S| 步內解開」，而 |S| 一律小於該關 moveLimit（留有餘裕）。
 */

export type CellLo = boolean
export type Grid = CellLo[][]
/**
 * 對外共用的狀態型別：engine 只會產生 'playing' / 'levelClear' / 'gameover'
 * （'paused' 由頁面層自行管理，不進 engine，但一併收攏進同一 union 讓頁面 reactive state 可重用）。
 */
export type GameStatusLo = 'playing' | 'levelClear' | 'gameover' | 'paused'
/** 生成種子座標（row, col），對全滅盤面逐一 Toggle 產生該關初始盤面 */
export type SeedCell = readonly [number, number]

export type LightsOutSnapshot = {
  grid: Grid
  level: number
  moves: number
  moveLimit: number
  score: number
  status: 'playing' | 'levelClear' | 'gameover'
}

export type ToggleResult = {
  /** 本次點擊是否確實造成切換（座標合法且處於可操作狀態） */
  moved: boolean
  /** 本次點擊後是否全部熄燈（過關）；Win 判定優先於 Game Over */
  won: boolean
  /** 本次點擊後是否用盡步數仍未熄燈（Game Over） */
  gameOver: boolean
}

type LevelDef = { size: number; moveLimit: number; seed: SeedCell[] }

/**
 * 點擊格的 4 方向鄰居偏移量（上／下／左／右），每一項是 `[dRow, dCol]`。
 * **務必是 4 方向、不含對角**（見 design.md Decision 1／Risks）。
 */
export const NEIGHBOR_OFFSETS: ReadonlyArray<SeedCell> = [
  [-1, 0], // 上
  [1, 0], // 下
  [0, -1], // 左
  [0, 1] // 右
]

/** 跨 tier 延伸時的棋盤大小上限（封頂 7×7，避免手機版面放不下，見 design.md Open Questions） */
export const MAX_SIZE = 7
/** 跨 tier 延伸時的步數下限（避免遞減到不可能過關） */
export const MIN_MOVE_LIMIT = 6

/**
 * 固定關卡資料表（見 design.md Decision 2）：棋盤大小 3→6 依 tier 遞增、moveLimit 在 tier 內遞減。
 * 每關的 `seed` 是一組互不重複的座標，對全滅盤面逐一 Toggle 生成該關初始盤面，
 * 種子數量一律 < 該關 moveLimit（留餘裕）；同一組種子即為一組合法解法（見檔頭說明與單元測試）。
 */
export const LEVELS: LevelDef[] = [
  { size: 3, moveLimit: 8, seed: [[0, 0], [0, 2], [2, 1]] },
  { size: 3, moveLimit: 6, seed: [[0, 1], [1, 0], [1, 2], [2, 1]] },
  { size: 4, moveLimit: 10, seed: [[0, 0], [0, 3], [1, 2], [2, 1], [3, 3]] },
  { size: 4, moveLimit: 8, seed: [[0, 1], [1, 1], [1, 3], [2, 0], [2, 2], [3, 1]] },
  { size: 5, moveLimit: 12, seed: [[0, 0], [0, 4], [1, 3], [2, 2], [3, 1], [4, 0], [4, 4]] },
  { size: 5, moveLimit: 10, seed: [[0, 2], [1, 0], [1, 4], [2, 1], [2, 3], [3, 2], [4, 0], [4, 4]] },
  { size: 6, moveLimit: 14, seed: [[0, 0], [0, 5], [1, 2], [2, 2], [2, 4], [3, 1], [3, 3], [4, 0], [5, 5]] },
  { size: 6, moveLimit: 12, seed: [[0, 1], [0, 4], [1, 3], [2, 0], [2, 5], [3, 2], [3, 4], [4, 1], [4, 4], [5, 3]] }
]

/** 計分：固定過關獎勵（隨關卡遞增，見 design.md Decision 4） */
export const clearBonus = (level: number): number => 50 + level * 10
/** 計分：效率獎勵池（棋盤越大池越大，見 design.md Decision 4） */
export const efficiencyPool = (level: number): number => levelMeta(level).size ** 2 * 40
/**
 * 單關分數 = ClearBonus(level) + EfficiencyScore，
 * 其中 EfficiencyScore = round(EfficiencyPool(level) / max(moves, 1))（步數越少分數越高，見 design.md Decision 4）。
 * 例：Level 1（3×3）4 步解完 → 60 + round(360 / 4) = 60 + 90 = 150。
 */
export const calcLevelScore = (level: number, moves: number): number =>
  clearBonus(level) + Math.round(efficiencyPool(level) / Math.max(moves, 1))

/** 邊界檢查：座標是否落在棋盤範圍內 */
export const inBounds = (grid: Grid, row: number, col: number): boolean =>
  row >= 0 && row < grid.length && col >= 0 && col < (grid[0]?.length ?? 0)

/** 產生一個 size×size 的全滅（全 OFF）盤面 */
export const createEmptyGrid = (size: number): Grid =>
  Array.from({ length: size }, () => Array.from({ length: size }, () => false))

/** 深拷貝盤面 */
export const cloneGrid = (grid: Grid): Grid => grid.map((row) => [...row])

/**
 * 切換一格（見 tasks 5.3）：對 (row, col) 自己＋上下左右 4 個「合法」鄰格做 `cell = !cell`（XOR 切換），
 * 超出棋盤範圍的鄰居直接忽略（見 spec「超出棋盤範圍的鄰居 SHALL 被忽略」）。
 * 純函式：不修改傳入的 grid，回傳切換後的新 grid。
 */
export const toggleCell = (grid: Grid, row: number, col: number): Grid => {
  const next = cloneGrid(grid)
  // 中心格（點擊格本身）
  if (inBounds(next, row, col)) next[row]![col] = !next[row]![col]
  // 4 方向鄰格（僅切換棋盤範圍內存在的鄰格）
  for (const [dr, dc] of NEIGHBOR_OFFSETS) {
    const nr = row + dr
    const nc = col + dc
    if (inBounds(next, nr, nc)) next[nr]![nc] = !next[nr]![nc]
  }
  return next
}

/** Win Detection（見 tasks 5.4）：所有 CellLo 皆為 OFF 才回傳 true */
export const isAllOff = (grid: Grid): boolean => grid.every((row) => row.every((cell) => !cell))

/** 依種子集合對全滅盤面逐一 Toggle，生成初始盤面（保證可用同一組種子解回全滅） */
export const buildBoard = (size: number, seed: ReadonlyArray<SeedCell>): Grid => {
  let grid = createEmptyGrid(size)
  for (const [r, c] of seed) grid = toggleCell(grid, r, c)
  return grid
}

/**
 * 延伸關卡（超出 LEVELS 長度）的種子生成：以 level 為亂數種子的確定性 LCG 取互不重複的座標，
 * 讓同一關永遠得到同一份盤面（可重現、可測試）；數量已由呼叫端夾在 moveLimit 以內。
 */
const extendedSeed = (level: number, size: number, count: number): SeedCell[] => {
  const seen = new Set<string>()
  const seed: SeedCell[] = []
  let s = (level * 2654435761) >>> 0
  const rng = (): number => {
    s = (Math.imul(s, 1103515245) + 12345) >>> 0
    return s
  }
  let guard = 0
  while (seed.length < count && guard < 1000) {
    guard += 1
    const r = rng() % size
    const c = rng() % size
    const key = `${r},${c}`
    if (!seen.has(key)) {
      seen.add(key)
      seed.push([r, c])
    }
  }
  return seed
}

/**
 * 關卡尺寸／步數上限（見 design.md Decision 2）：
 * 表格範圍內直接讀表；超出表格時比照 BREAKOUT 的 `clampedIndex` + 延伸公式模式，
 * 棋盤大小遞增但封頂 MAX_SIZE，moveLimit 遞減但不低於 MIN_MOVE_LIMIT。
 */
export const levelMeta = (level: number): { size: number; moveLimit: number } => {
  const index = Math.max(0, level - 1)
  if (index < LEVELS.length) {
    const def = LEVELS[index]!
    return { size: def.size, moveLimit: def.moveLimit }
  }
  const over = index - (LEVELS.length - 1) // >= 1
  const size = Math.min(MAX_SIZE, 6 + Math.floor(over / 2))
  const moveLimit = Math.max(MIN_MOVE_LIMIT, 12 - over)
  return { size, moveLimit }
}

/** 該關的種子集合：表格內讀表、表格外走延伸生成（數量夾在 moveLimit 內，保證可解） */
export const levelSeed = (level: number): SeedCell[] => {
  const index = Math.max(0, level - 1)
  if (index < LEVELS.length) return LEVELS[index]!.seed.map(([r, c]) => [r, c] as SeedCell)
  const { size, moveLimit } = levelMeta(level)
  const count = Math.min(moveLimit, Math.max(4, size))
  return extendedSeed(level, size, count)
}

/** 讀取某關完整設定：棋盤大小、步數上限、初始盤面（見 tasks 5.5） */
export const levelConfig = (level: number): { size: number; moveLimit: number; grid: Grid } => {
  const meta = levelMeta(level)
  return { size: meta.size, moveLimit: meta.moveLimit, grid: buildBoard(meta.size, levelSeed(level)) }
}

/**
 * LIGHTS OUT 引擎（見 tasks 5.7）：整合盤面 / Toggle / Win / Game Over / 關卡 / 計分。
 * 非 tick-driven（見 design.md），狀態只在 `toggle()` 呼叫時同步改變；
 * 頁面以 `getSnapshot()` 取得純資料鏡像，不直接改動內部盤面。
 */
export default class LightsOutEngine {
  private grid: Grid = []
  private status: 'playing' | 'levelClear' | 'gameover' = 'playing'
  level = 1
  moves = 0
  moveLimit = 0
  score = 0

  constructor() {
    this.reset()
  }

  /** 完整重置：回到第 1 關初始盤面，步數與分數歸零（見 spec Restart 規格） */
  reset(): void {
    this.score = 0
    this.loadLevel(1)
  }

  private loadLevel(level: number): void {
    const cfg = levelConfig(level)
    this.level = level
    this.grid = cfg.grid
    this.moveLimit = cfg.moveLimit
    this.moves = 0
    this.status = 'playing'
  }

  /**
   * 點擊 (row, col) 切換棋盤（見 tasks 5.7）。回傳 moved / won / gameOver 三個狀態變化旗標。
   * 判定順序：先算是否全滅（Win），再算是否用盡步數（Game Over），
   * 因此「最後一步同時用完步數又全滅」算 Win（見 design.md Decision 3）。
   */
  toggle(row: number, col: number): ToggleResult {
    if (this.status !== 'playing') return { moved: false, won: false, gameOver: false }
    if (!inBounds(this.grid, row, col)) return { moved: false, won: false, gameOver: false }

    this.grid = toggleCell(this.grid, row, col)
    this.moves += 1

    if (isAllOff(this.grid)) {
      this.score += calcLevelScore(this.level, this.moves)
      this.status = 'levelClear'
      return { moved: true, won: true, gameOver: false }
    }
    if (this.moves >= this.moveLimit) {
      this.status = 'gameover'
      return { moved: true, won: false, gameOver: true }
    }
    return { moved: true, won: false, gameOver: false }
  }

  /** 進入下一關：重建下一關初始盤面，步數歸零、分數保留（見 spec Next Level 規格） */
  nextLevel(): void {
    this.loadLevel(this.level + 1)
  }

  /** 對外回傳純資料快照（深拷貝 grid，頁面用 reactive() 鏡像） */
  getSnapshot(): LightsOutSnapshot {
    return {
      grid: cloneGrid(this.grid),
      level: this.level,
      moves: this.moves,
      moveLimit: this.moveLimit,
      score: this.score,
      status: this.status
    }
  }
}
