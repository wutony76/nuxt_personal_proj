/**
 * 2048 遊戲核心邏輯（純 TypeScript，完全不依賴 Vue／DOM，見 design.md Decision 5）。
 *
 * Board 用 `(Tile | null)[4][4]` 二維陣列表示，Tile 帶遞增 `id` 供頁面 Vue `:key` 使用
 * （合併/位移時避免 DOM 節點誤重用，見 design.md Decision 1）。
 *
 * 合併採「壓縮 → 相鄰同值合併（一次移動每格只合併一次）→ 再壓縮」，四方向共用同一份
 * `compressAndMergeLine`（左移直接呼叫；右移反轉；上/下移轉置後套用，見 design.md Decision 2）。
 * 頁面只負責把 `getSnapshot()` 的 board 攤平渲染，不在 template 內做任何合併/判斷邏輯。
 */

export const BOARD_SIZE = 4
export const WIN_VALUE = 2048
/** 新 Tile 數值分布：10% 機率為 4，其餘 90% 為 2（見 design.md Decision 3） */
export const NEW_TILE_FOUR_PROB = 0.1
/** Touch Swipe 判定閾值（px）：pointerup 座標差量最大值低於此值視為點按，不觸發移動（供頁面引用，見 design.md Decision 4） */
export const SWIPE_THRESHOLD = 30

export type Tile = { id: number; value: number }
export type Board = (Tile | null)[][]
export type Direction = 'up' | 'down' | 'left' | 'right'
/**
 * 對外共用的狀態型別：engine 只會產生 'playing' / 'gameover'（依棋盤是否還能移動計算），
 * 'won' 由 snapshot 的 `won` 布林旗標另外表示、'paused' 為頁面層自行管理的暫停狀態，
 * 一併收攏進同一個 union 讓頁面 reactive state 可以重用（見 design.md 第 4 節）。
 */
export type GameStatus = 'playing' | 'won' | 'gameover' | 'paused'

export type Game2048Snapshot = {
  board: Board
  score: number
  status: 'playing' | 'gameover'
  /** 是否已達成過 2048（一旦為真維持為真，只在 reset 時歸零，見 design.md Decision 7） */
  won: boolean
  /** 上一次 applyMove() 是否造成棋盤變化（供頁面判斷是否為有效移動） */
  moved: boolean
}

export type LineResult = {
  line: (Tile | null)[]
  scoreGained: number
  moved: boolean
}

/** 產生一個全空的 4×4 棋盤 */
export const createEmptyBoard = (): Board =>
  Array.from({ length: BOARD_SIZE }, () => Array.from({ length: BOARD_SIZE }, () => null as Tile | null))

/**
 * 單行/列合併核心（見 design.md Decision 2）：壓縮 → 相鄰同值合併（一次只合併一次）→ 再壓縮。
 * `nextId` 由呼叫端注入（唯一 id 計數器），讓本函式對輸入保持純函式：非合併的 Tile 沿用原 id
 * （視為「同一顆滑動」），只有合併產生的新 Tile 才配發新 id。
 */
export const compressAndMergeLine = (line: (Tile | null)[], nextId: () => number): LineResult => {
  const tiles = line.filter((t): t is Tile => t !== null)
  const merged: (Tile | null)[] = []
  let scoreGained = 0

  let i = 0
  while (i < tiles.length) {
    const current = tiles[i]!
    const next = tiles[i + 1]
    if (next && next.value === current.value) {
      // 相鄰同值：合併為加倍的新 Tile（配發新 id），並把合併後數值加進分數；
      // 一次跳過兩顆，確保這顆新 Tile 不會在本次移動中再參與二次合併
      const value = current.value * 2
      merged.push({ id: nextId(), value })
      scoreGained += value
      i += 2
    } else {
      // 未合併：沿用原 Tile 身分（同 id），只是壓縮位置
      merged.push({ id: current.id, value: current.value })
      i += 1
    }
  }
  while (merged.length < BOARD_SIZE) merged.push(null)

  // 與原始行逐格比對（id 或 value 有任一不同即代表有移動/合併發生）
  const moved = line.some((before, idx) => {
    const after = merged[idx] ?? null
    if (before === null && after === null) return false
    if (before === null || after === null) return true
    return before.id !== after.id || before.value !== after.value
  })

  return { line: merged, scoreGained, moved }
}

/** 棋盤轉置（行列互換），供上/下移把「直向」轉成「橫向」後共用左/右移邏輯 */
const transpose = (board: Board): Board => {
  const out = createEmptyBoard()
  for (let r = 0; r < BOARD_SIZE; r += 1) {
    for (let c = 0; c < BOARD_SIZE; c += 1) {
      out[c]![r] = board[r]![c]!
    }
  }
  return out
}

/** 反轉每一行（左右鏡射），供右移把方向轉成左移後共用同一份合併邏輯 */
const reverseRows = (board: Board): Board => board.map((row) => [...row].reverse())

/**
 * 四方向移動（見 design.md Decision 2）：左移直接逐行呼叫 `compressAndMergeLine`；
 * 右移先反轉再呼叫再反轉回來；上/下移先轉置棋盤再套用左/右移邏輯，最後轉置回來。
 * 回傳新棋盤、本次移動累加的分數、以及是否有任一行/列產生變化（有效移動）。
 * 本函式不會就地修改傳入的 board（回傳全新陣列）。
 */
export const applyMove = (
  board: Board,
  direction: Direction,
  nextId: () => number
): { board: Board; scoreGained: number; moved: boolean } => {
  const vertical = direction === 'up' || direction === 'down'
  const reverse = direction === 'right' || direction === 'down'

  let work: Board = board.map((row) => [...row])
  if (vertical) work = transpose(work)
  if (reverse) work = reverseRows(work)

  let scoreGained = 0
  let moved = false
  let result: Board = work.map((row) => {
    const res = compressAndMergeLine(row, nextId)
    scoreGained += res.scoreGained
    if (res.moved) moved = true
    return res.line
  })

  if (reverse) result = reverseRows(result)
  if (vertical) result = transpose(result)

  return { board: result, scoreGained, moved }
}

/**
 * 於棋盤任一空格隨機產生新 Tile（90% 為 2、10% 為 4，見 design.md Decision 3）。
 * 會就地寫入傳入的 board；若已無空格則回傳 null。
 */
export const spawnRandomTile = (board: Board, nextId: () => number): Tile | null => {
  const empties: Array<[number, number]> = []
  for (let r = 0; r < BOARD_SIZE; r += 1) {
    for (let c = 0; c < BOARD_SIZE; c += 1) {
      if (board[r]![c] === null) empties.push([r, c])
    }
  }
  if (empties.length === 0) return null
  const [r, c] = empties[Math.floor(Math.random() * empties.length)]!
  const value = Math.random() < NEW_TILE_FOUR_PROB ? 4 : 2
  const tile: Tile = { id: nextId(), value }
  board[r]![c] = tile
  return tile
}

/**
 * Game Over 判定（見 design.md Decision / tasks 5.6）：棋盤仍有空格即可移動；
 * 棋盤已滿時，只要存在任一相鄰（水平或垂直）同值可合併，就仍可移動。皆不符合才無法移動。
 */
export const canMove = (board: Board): boolean => {
  for (let r = 0; r < BOARD_SIZE; r += 1) {
    for (let c = 0; c < BOARD_SIZE; c += 1) {
      if (board[r]![c] === null) return true
    }
  }
  for (let r = 0; r < BOARD_SIZE; r += 1) {
    for (let c = 0; c < BOARD_SIZE; c += 1) {
      const value = board[r]![c]!.value
      if (c + 1 < BOARD_SIZE && board[r]![c + 1]!.value === value) return true
      if (r + 1 < BOARD_SIZE && board[r + 1]![c]!.value === value) return true
    }
  }
  return false
}

/** 2048 判定（見 design.md Decision 7）：任一 Tile 數值達到 WIN_VALUE 即為真 */
export const hasReachedTarget = (board: Board): boolean => {
  for (let r = 0; r < BOARD_SIZE; r += 1) {
    for (let c = 0; c < BOARD_SIZE; c += 1) {
      if ((board[r]![c]?.value ?? 0) >= WIN_VALUE) return true
    }
  }
  return false
}

/** 目前棋盤上的最大 Tile 數值（供頁面 HUD 與紀錄 meta 使用） */
export const maxTileValue = (board: Board): number => {
  let max = 0
  for (let r = 0; r < BOARD_SIZE; r += 1) {
    for (let c = 0; c < BOARD_SIZE; c += 1) {
      const value = board[r]![c]?.value ?? 0
      if (value > max) max = value
    }
  }
  return max
}

/**
 * 2048 引擎：整合 Board／合併／新 Tile／Game Over／2048 判定（見 tasks 5.8）。
 * 內部維護遞增 id 計數器與棋盤狀態；頁面以 `getSnapshot()` 取得純資料鏡像。
 */
export default class Game2048Engine {
  private board: Board = createEmptyBoard()
  private score = 0
  private won = false
  private over = false
  private lastMoved = false
  private idCounter = 0

  constructor() {
    this.reset()
  }

  /** 配發唯一遞增 id（供 spawn 與合併使用）；用箭頭函式綁定 this，可安全傳入純函式 */
  private nextId = (): number => {
    this.idCounter += 1
    return this.idCounter
  }

  /** 完整重置：棋盤、分數、勝利旗標、Game Over 旗標、id 計數器歸零，並放入兩顆初始 Tile */
  reset(): void {
    this.board = createEmptyBoard()
    this.score = 0
    this.won = false
    this.over = false
    this.lastMoved = false
    this.idCounter = 0
    spawnRandomTile(this.board, this.nextId)
    spawnRandomTile(this.board, this.nextId)
  }

  /**
   * 套用一次方向移動。回傳是否為「有效移動」（棋盤有變化）。
   * 僅在有效移動時才產生新 Tile、累加分數，並重新計算勝利/Game Over；
   * 無效移動（對著牆壁方向）不改變任何狀態、不消耗回合（見 design.md Decision 3）。
   */
  applyMove(direction: Direction): boolean {
    if (this.over) {
      this.lastMoved = false
      return false
    }
    const result = applyMove(this.board, direction, this.nextId)
    if (!result.moved) {
      this.lastMoved = false
      return false
    }
    this.board = result.board
    this.score += result.scoreGained
    spawnRandomTile(this.board, this.nextId)
    if (hasReachedTarget(this.board)) this.won = true
    if (!canMove(this.board)) this.over = true
    this.lastMoved = true
    return true
  }

  /** 對外回傳純資料快照（深拷貝 board 與 Tile，頁面用 reactive() 鏡像） */
  getSnapshot(): Game2048Snapshot {
    return {
      board: this.board.map((row) => row.map((tile) => (tile ? { id: tile.id, value: tile.value } : null))),
      score: this.score,
      status: this.over ? 'gameover' : 'playing',
      won: this.won,
      moved: this.lastMoved
    }
  }
}
