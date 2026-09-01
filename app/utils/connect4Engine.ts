/**
 * CONNECT 4 遊戲核心邏輯（純 TypeScript，完全不依賴 Vue／DOM，見 design.md）。
 *
 * 這是全專案第二款「Player vs AI 回合制」遊戲（第一款為 BATTLESHIP），沿用其既有精神：
 *   - Logic / Rendering 分離：落子的合法性與勝負判定在呼叫當下同步算完，動畫只是頁面視覺層。
 *   - 玩家與 AI 共用同一套判定純函式：正式落子後判定勝負、與 AI「試下評估」都呼叫同一支
 *     `checkWinFromMove()`，不寫兩套規則（見 design.md Decision 2/3）。
 *   - AI 回合的人工延遲（400~800ms）由呼叫端（頁面）用 setTimeout 實作，engine 本身不處理非同步。
 *
 * 棋盤資料結構採 `board[row][col]` 二維陣列（見 design.md Decision 1）：
 *   row 0 = 頂列、row 5 = 底列；落子受重力影響，永遠落到該欄最底的空格。
 *
 * 型別刻意採 connect4 專屬命名（Disc／Connect4Board／TurnPlayer…）而非通用的 Cell／Board／Winner，
 * 因為 battleshipEngine 等既有 utils 已匯出同名型別，Nuxt 會對 utils 的重複型別匯出發出
 * auto-import 衝突警告（見 froggerEngine.ts 對 GameStatus 的相同處理）。
 */

// ── 型別 ──
/** 單一格子的內容 */
export type Disc = 'EMPTY' | 'PLAYER' | 'AI'
/** 落子的一方（Disc 去掉 EMPTY） */
export type TurnPlayer = 'PLAYER' | 'AI'
export type Connect4Board = Disc[][]
export type Connect4Winner = 'PLAYER' | 'AI' | null
/** 對局結果（一律以玩家視角表述） */
export type Connect4Result = 'WIN' | 'DRAW' | 'LOSE'

export type Coord2 = { row: number; col: number }

/** 落子結果：落點座標 + 該落子是否直接造成連線／填滿平手（供頁面決定後續流程） */
export type DropResult = {
  row: number
  col: number
  player: TurnPlayer
  win: boolean
  draw: boolean
}

export type Connect4Snapshot = {
  board: Connect4Board
  /** 目前輪到哪一方（結束後維持最後一手的下一位，僅供參考，頁面自行維護 7 態 UI phase） */
  turn: TurnPlayer
  over: boolean
  winner: Connect4Winner
  result: Connect4Result | null
  score: number
  playerMoves: number
  aiMoves: number
  /** 最近一次落子的座標，供頁面播放掉落動畫；尚未落子為 null */
  lastDrop: Coord2 | null
  /** 獲勝連線的所有座標（含 4 子以上），供頁面高亮；無連線為 null */
  winningLine: Coord2[] | null
}

// ── Grid 常數（集中管理，見 design.md Decision 1）──
export const BOARD_ROWS = 6
export const BOARD_COLS = 7
/** 連成幾子獲勝（固定 4） */
export const WIN_LENGTH = 4

// ── 計分常數（Decision 5「固定基礎分 + 落子效率加成」模型，已由使用者拍板，數值不可自行更動）──
export const WIN_BASE = 60
export const MAX_EFFICIENCY_BONUS = 40
/** 玩家最少只需 4 顆自己的棋子即可連成 4 子（理論最速獲勝） */
export const MIN_WINNING_MOVES = 4
export const EFFICIENCY_STEP = 3
export const DRAW_SCORE = 20
/** 公式理論上限（= WIN_BASE + MAX_EFFICIENCY_BONUS），對齊 server 端 maxReasonableScore() */
export const MAX_SCORE = WIN_BASE + MAX_EFFICIENCY_BONUS

// ── AI 回合延遲範圍（由頁面用 setTimeout 實作，engine 本身不處理非同步，見 design.md Decision 7）──
export const C4_AI_DELAY_MIN_MS = 400
export const C4_AI_DELAY_MAX_MS = 800

/** 四個掃描軸的方向向量：Horizontal／Vertical／Diagonal↘↖／Diagonal↙↗（見 design.md Decision 2） */
const DIRECTIONS: Array<[number, number]> = [
  [0, 1], // 水平
  [1, 0], // 垂直
  [1, 1], // 對角線 ↘↖
  [1, -1] // 對角線 ↙↗
]

const inBounds = (row: number, col: number): boolean =>
  row >= 0 && row < BOARD_ROWS && col >= 0 && col < BOARD_COLS

// ── Board 工具 ──
export const createConnect4Board = (): Connect4Board =>
  Array.from({ length: BOARD_ROWS }, () => Array.from({ length: BOARD_COLS }, () => 'EMPTY' as Disc))

export const cloneBoard = (board: Connect4Board): Connect4Board => board.map((row) => row.slice())

/** 由底列（row 5）往頂列（row 0）尋找該欄第一個 EMPTY 格；欄滿回傳 null（該欄不可選） */
export const getNextOpenRow = (board: Connect4Board, col: number): number | null => {
  if (col < 0 || col >= BOARD_COLS) return null
  for (let row = BOARD_ROWS - 1; row >= 0; row -= 1) {
    if (board[row]![col] === 'EMPTY') return row
  }
  return null
}

/** 頂列（row 0）任一格仍空即代表該欄未滿 → 有任一未滿欄即非全滿；全部落滿才算平手候選 */
export const isBoardFull = (board: Connect4Board): boolean =>
  board[0]!.every((cell) => cell !== 'EMPTY')

/** 目前所有合法（未滿）欄位，供玩家點擊驗證與 AI 決策共用 */
export const getLegalColumns = (board: Connect4Board): number[] => {
  const cols: number[] = []
  for (let col = 0; col < BOARD_COLS; col += 1) {
    if (board[0]![col] === 'EMPTY') cols.push(col)
  }
  return cols
}

/**
 * 正式落子：找到落點 row 寫入該格，回傳落點座標（會修改傳入的 board）。
 * 欄滿回傳 null，呼叫端不消耗回合（見 design.md Decision 1 / tasks 5.3）。
 */
export const dropDisc = (board: Connect4Board, col: number, player: TurnPlayer): Coord2 | null => {
  const row = getNextOpenRow(board, col)
  if (row === null) return null
  board[row]![col] = player
  return { row, col }
}

/**
 * 從某座標往單一軸的正反兩個方向收集連續同色格（含起點自身），回傳整段座標。
 * checkWinFromMove 與 getWinningLine 共用這支掃描邏輯，確保「判定」與「取高亮線」不會各寫一套。
 */
const scanAxis = (board: Connect4Board, row: number, col: number, player: TurnPlayer, dRow: number, dCol: number): Coord2[] => {
  const cells: Coord2[] = [{ row, col }]
  for (const sign of [1, -1]) {
    let r = row + dRow * sign
    let c = col + dCol * sign
    while (inBounds(r, c) && board[r]![c] === player) {
      cells.push({ row: r, col: c })
      r += dRow * sign
      c += dCol * sign
    }
  }
  return cells
}

/**
 * 單一 Win Detection 純函式（見 design.md Decision 2）：從剛落子的座標往四軸雙向掃描，
 * 任一軸連續同色達 WIN_LENGTH（4）即回傳 true。不修改任何狀態，純讀取傳入的 board 快照。
 * 這支函式同時被「正式落子後判定」與「AI 試下評估（wouldWin）」呼叫，是唯一的連線判定規則。
 */
export const checkWinFromMove = (board: Connect4Board, row: number, col: number, player: TurnPlayer): boolean => {
  if (!inBounds(row, col) || board[row]![col] !== player) return false
  return DIRECTIONS.some(([dRow, dCol]) => scanAxis(board, row, col, player, dRow, dCol).length >= WIN_LENGTH)
}

/**
 * 取得獲勝連線的座標（含 4 子以上），供頁面高亮用。
 * 判定「是否獲勝」的權威規則仍是 checkWinFromMove；這裡只在確定獲勝後把該軸的座標撈出來給 UI。
 */
export const getWinningLine = (board: Connect4Board, row: number, col: number, player: TurnPlayer): Coord2[] | null => {
  if (!inBounds(row, col) || board[row]![col] !== player) return null
  for (const [dRow, dCol] of DIRECTIONS) {
    const cells = scanAxis(board, row, col, player, dRow, dCol)
    if (cells.length >= WIN_LENGTH) return cells
  }
  return null
}

/**
 * 試下判斷（見 design.md Decision 3）：若 player 在 col 落子是否會直接獲勝。
 * 以 cloneBoard 複製一份模擬落子，不修改傳入的實際 board，用完即丟；判定同樣呼叫 checkWinFromMove。
 */
export const wouldWin = (board: Connect4Board, col: number, player: TurnPlayer): boolean => {
  const row = getNextOpenRow(board, col)
  if (row === null) return false
  const simulated = cloneBoard(board)
  simulated[row]![col] = player
  return checkWinFromMove(simulated, row, col, player)
}

/**
 * AI 決策（見 design.md Decision 3）：依序
 *   (1) 對所有合法欄呼叫 wouldWin(AI)，找到可直接獲勝的欄就選它；
 *   (2) 否則對所有合法欄呼叫 wouldWin(PLAYER)，找到玩家下一步的獲勝欄就選它（阻擋）；
 *   (3) 否則從合法欄中隨機挑一欄。
 * 全程共用 checkWinFromMove／wouldWin，不寫兩套規則；MUST NOT 選到已滿欄位。
 */
export const chooseAiColumn = (board: Connect4Board, random: () => number = Math.random): number | null => {
  const legal = getLegalColumns(board)
  if (legal.length === 0) return null

  const winning = legal.find((col) => wouldWin(board, col, 'AI'))
  if (winning !== undefined) return winning

  const blocking = legal.find((col) => wouldWin(board, col, 'PLAYER'))
  if (blocking !== undefined) return blocking

  return legal[Math.floor(random() * legal.length)]!
}

/**
 * 計分（見 design.md Decision 5，已拍板數值）：
 *   WIN  = WIN_BASE + max(0, MAX_EFFICIENCY_BONUS - (playerMovesUsed - MIN_WINNING_MOVES) * EFFICIENCY_STEP)，上限 100
 *   DRAW = DRAW_SCORE（固定）
 *   LOSE = 0
 * playerMovesUsed 明確定義為「玩家自己落子次數」，不含 AI 落子。
 */
export const calculateScore = (result: Connect4Result, playerMovesUsed: number): number => {
  if (result === 'WIN') {
    const bonus = Math.max(0, MAX_EFFICIENCY_BONUS - (playerMovesUsed - MIN_WINNING_MOVES) * EFFICIENCY_STEP)
    return Math.min(MAX_SCORE, WIN_BASE + bonus)
  }
  if (result === 'DRAW') return DRAW_SCORE
  return 0
}

/**
 * Connect4Engine：整合 Board／Gravity／Win Detection／Draw／AI／計分，純 TS 不依賴 Vue。
 * 權威回合狀態只維護 turn（PLAYER / AI）與 over；頁面另外維護 7 態 UI phase（含掉落動畫與
 * 「AI THINKING…」的中間態），engine 不處理動畫時序（見 design.md Decision 7）。
 */
export class Connect4Engine {
  private board: Connect4Board = createConnect4Board()
  private turn: TurnPlayer = 'PLAYER'
  private over = false
  private winner: Connect4Winner = null
  private result: Connect4Result | null = null
  private score = 0
  private playerMoves = 0
  private aiMoves = 0
  private lastDrop: Coord2 | null = null
  private winningLine: Coord2[] | null = null

  reset(): void {
    this.board = createConnect4Board()
    this.turn = 'PLAYER'
    this.over = false
    this.winner = null
    this.result = null
    this.score = 0
    this.playerMoves = 0
    this.aiMoves = 0
    this.lastDrop = null
    this.winningLine = null
  }

  isOver(): boolean {
    return this.over
  }

  currentTurn(): TurnPlayer {
    return this.turn
  }

  /** 玩家落子：只有輪到玩家且未結束時有效；欄滿回傳 null（不消耗回合，見驗收規格） */
  playerDrop(col: number): DropResult | null {
    if (this.over || this.turn !== 'PLAYER') return null
    return this._applyDrop('PLAYER', col)
  }

  /**
   * AI 落子：由頁面在 setTimeout(400~800ms) 後呼叫（engine 不處理計時）。
   * 內部自行以 chooseAiColumn 決定欄位，不接受外部指定，確保 AI 走同一套決策規則。
   */
  aiDrop(random: () => number = Math.random): DropResult | null {
    if (this.over || this.turn !== 'AI') return null
    const col = chooseAiColumn(this.board, random)
    if (col === null) return null
    return this._applyDrop('AI', col)
  }

  /** 落子 + 勝負／平手判定的共用內部流程，玩家與 AI 走同一條路徑 */
  private _applyDrop(player: TurnPlayer, col: number): DropResult | null {
    const landed = dropDisc(this.board, col, player)
    if (!landed) return null

    if (player === 'PLAYER') this.playerMoves += 1
    else this.aiMoves += 1
    this.lastDrop = landed

    const win = checkWinFromMove(this.board, landed.row, landed.col, player)
    if (win) {
      this.winningLine = getWinningLine(this.board, landed.row, landed.col, player)
      this.winner = player
      this.result = player === 'PLAYER' ? 'WIN' : 'LOSE'
      this.score = calculateScore(this.result, this.playerMoves)
      this.over = true
      return { ...landed, player, win: true, draw: false }
    }

    if (isBoardFull(this.board)) {
      this.winner = null
      this.result = 'DRAW'
      this.score = calculateScore('DRAW', this.playerMoves)
      this.over = true
      return { ...landed, player, win: false, draw: true }
    }

    this.turn = player === 'PLAYER' ? 'AI' : 'PLAYER'
    return { ...landed, player, win: false, draw: false }
  }

  getSnapshot(): Connect4Snapshot {
    return {
      board: cloneBoard(this.board),
      turn: this.turn,
      over: this.over,
      winner: this.winner,
      result: this.result,
      score: this.score,
      playerMoves: this.playerMoves,
      aiMoves: this.aiMoves,
      lastDrop: this.lastDrop ? { ...this.lastDrop } : null,
      winningLine: this.winningLine ? this.winningLine.map((c) => ({ ...c })) : null
    }
  }
}
