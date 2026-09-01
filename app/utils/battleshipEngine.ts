export type Orientation = 'HORIZONTAL' | 'VERTICAL'
export type CellState = 'EMPTY' | 'SHIP' | 'HIT' | 'MISS'
export type ShipName = 'CARRIER' | 'BATTLESHIP' | 'CRUISER' | 'SUBMARINE' | 'DESTROYER'
export type GamePhase = 'PLACEMENT' | 'READY' | 'PLAYER_TURN' | 'AI_TURN' | 'GAME_OVER'
export type Winner = 'PLAYER' | 'AI' | null

export type Coord = { x: number; y: number }

export type Cell = {
  x: number
  y: number
  shipId: string | null
  shipPart: number | null
  state: CellState
}

export type Board = Cell[][]

export type Ship = {
  id: string
  name: ShipName
  length: number
  position: Coord | null
  orientation: Orientation
  hits: number
  sunk: boolean
}

export type AttackOutcome = 'HIT' | 'MISS' | 'ALREADY_ATTACKED' | 'SUNK'

export type AttackResult = {
  result: AttackOutcome
  shipId?: string
}

export type ShipSummary = Pick<Ship, 'id' | 'name' | 'length' | 'hits' | 'sunk' | 'position' | 'orientation'>

export type BattleshipSnapshot = {
  phase: GamePhase
  round: number
  score: number
  stats: { shots: number; hits: number; misses: number }
  playerBoard: Board
  enemyBoardView: Board
  playerShips: ShipSummary[]
  enemyShips: ShipSummary[]
  winner: Winner
}

export const BOARD_SIZE = 10

/** 5 種戰艦，共 17 格（需求第 6 點） */
export const SHIP_CONFIG: Array<{ name: ShipName; length: number }> = [
  { name: 'CARRIER', length: 5 },
  { name: 'BATTLESHIP', length: 4 },
  { name: 'CRUISER', length: 3 },
  { name: 'SUBMARINE', length: 3 },
  { name: 'DESTROYER', length: 2 }
]

/** 計分常數，取需求既定數值（HIT+100/SUNK+500/WIN+1000）的三分之一，比例不變（見 design.md Decision 5） */
export const HIT_SCORE = 33
export const SUNK_SCORE = 167
export const WIN_SCORE = 333

/** AI 回合延遲範圍（需求第 30 點），由呼叫端（頁面）用 setTimeout 實作，engine 本身不處理非同步 */
export const AI_DELAY_MIN_MS = 500
export const AI_DELAY_MAX_MS = 1000

const COLS = 'ABCDEFGHIJ'

export const coordToLabel = ({ x, y }: Coord): string => `${COLS[x] ?? '?'}${y + 1}`

export const labelToCoord = (label: string): Coord | null => {
  const match = /^([A-J])(10|[1-9])$/i.exec(label.trim())
  if (!match) return null
  const x = COLS.indexOf(match[1]!.toUpperCase())
  const y = Number(match[2]) - 1
  return { x, y }
}

const inBounds = ({ x, y }: Coord): boolean => x >= 0 && x < BOARD_SIZE && y >= 0 && y < BOARD_SIZE

export const createEmptyBoard = (): Board => {
  const board: Board = []
  for (let y = 0; y < BOARD_SIZE; y += 1) {
    const row: Cell[] = []
    for (let x = 0; x < BOARD_SIZE; x += 1) {
      row.push({ x, y, shipId: null, shipPart: null, state: 'EMPTY' })
    }
    board.push(row)
  }
  return board
}

export const createShips = (): Ship[] =>
  SHIP_CONFIG.map((config) => ({
    id: config.name.toLowerCase(),
    name: config.name,
    length: config.length,
    position: null,
    orientation: 'HORIZONTAL',
    hits: 0,
    sunk: false
  }))

/** 錨點固定為船頭格，依方向往右（HORIZONTAL）或往下（VERTICAL）延伸 length 格（需求第 9／10 點） */
export const getShipCells = (length: number, anchor: Coord, orientation: Orientation): Coord[] => {
  const cells: Coord[] = []
  for (let i = 0; i < length; i += 1) {
    cells.push(orientation === 'HORIZONTAL' ? { x: anchor.x + i, y: anchor.y } : { x: anchor.x, y: anchor.y + i })
  }
  return cells
}

export type PlacementCheck = { valid: boolean; cells: Coord[] }

/** 只檢查越界與重疊，允許戰艦相鄰（需求第 12 點／design.md Decision 3），玩家與 AI 佈局共用 */
export const validateShipPlacement = (board: Board, length: number, anchor: Coord, orientation: Orientation): PlacementCheck => {
  const cells = getShipCells(length, anchor, orientation)
  const valid = cells.every((cell) => inBounds(cell) && board[cell.y]![cell.x]!.shipId === null)
  return { valid, cells }
}

/** 驗證通過才會呼叫；直接寫入 board 與 ship 本身，不重複驗證 */
export const placeShip = (board: Board, ship: Ship, anchor: Coord, orientation: Orientation, cells: Coord[]): void => {
  cells.forEach((cell, index) => {
    const target = board[cell.y]![cell.x]!
    target.shipId = ship.id
    target.shipPart = index
    target.state = 'SHIP'
  })
  ship.position = anchor
  ship.orientation = orientation
}

/** AI 佈局：與玩家共用 validateShipPlacement，僅座標與方向來源改為 Math.random()，失敗即重試（需求第 16 點） */
export const autoPlaceShips = (board: Board, ships: Ship[]): void => {
  ships.forEach((ship) => {
    let placed = false
    while (!placed) {
      const orientation: Orientation = Math.random() < 0.5 ? 'HORIZONTAL' : 'VERTICAL'
      const anchor: Coord = { x: Math.floor(Math.random() * BOARD_SIZE), y: Math.floor(Math.random() * BOARD_SIZE) }
      const check = validateShipPlacement(board, ship.length, anchor, orientation)
      if (check.valid) {
        placeShip(board, ship, anchor, orientation, check.cells)
        placed = true
      }
    }
  })
}

/** 玩家與 AI 共用的同一套攻擊判定（需求第 59 點）；已攻擊過的格子不消耗任何狀態變更 */
export const attackCell = (board: Board, ships: Ship[], target: Coord): AttackResult => {
  const cell = board[target.y]![target.x]!
  if (cell.state === 'HIT' || cell.state === 'MISS') return { result: 'ALREADY_ATTACKED' }

  if (cell.state === 'EMPTY') {
    cell.state = 'MISS'
    return { result: 'MISS' }
  }

  // cell.state === 'SHIP'
  cell.state = 'HIT'
  const ship = ships.find((s) => s.id === cell.shipId)!
  ship.hits += 1
  if (ship.hits >= ship.length) {
    ship.sunk = true
    return { result: 'SUNK', shipId: ship.id }
  }
  return { result: 'HIT', shipId: ship.id }
}

export const checkWin = (ships: Ship[]): boolean => ships.every((ship) => ship.sunk)

/**
 * 敵方棋盤的玩家視角：未攻擊格隱藏 SHIP 狀態（需求第 35 點／design.md Decision 1）。
 * 一艘船 sunk 的充要條件是它的每一格都已變成 HIT（見 attackCell），所以「沉船後顯示完整船身」
 * 不需要額外分支——沉船的所有格子早已是 HIT、從未停留在 SHIP 狀態，這裡只要單純隱藏 SHIP 即可。
 * 規則集中在 engine 層，UI 只負責依 state 顯示對應圖案，不自己判斷要不要隱藏。
 */
export const getPlayerViewOfEnemyBoard = (board: Board): Board =>
  board.map((row) => row.map((cell) => (cell.state === 'SHIP' ? { ...cell, shipId: null, shipPart: null, state: 'EMPTY' } : { ...cell })))

/** AI 攻擊策略（本次 MVP，Random）：從所有尚未攻擊的格子中隨機選一格（需求第 31 點） */
export const chooseAttackTarget = (board: Board): Coord | null => {
  const candidates: Coord[] = []
  board.forEach((row) =>
    row.forEach((cell) => {
      if (cell.state === 'EMPTY' || cell.state === 'SHIP') candidates.push({ x: cell.x, y: cell.y })
    })
  )
  if (candidates.length === 0) return null
  return candidates[Math.floor(Math.random() * candidates.length)]!
}

const toShipSummary = (ship: Ship): ShipSummary => ({
  id: ship.id,
  name: ship.name,
  length: ship.length,
  hits: ship.hits,
  sunk: ship.sunk,
  position: ship.position,
  orientation: ship.orientation
})

/**
 * BattleshipEngine：整合雙棋盤／戰艦／佈局／攻擊／回合／AI，純 TS 不依賴 Vue（見 design.md）。
 * 不處理 setTimeout 延遲——AI 回合的 500~1000ms 延遲由呼叫端（頁面）負責，engine 只暴露同步的
 * aiAttack()，頁面在 setTimeout callback 裡呼叫。
 */
export class BattleshipEngine {
  private playerBoard: Board = createEmptyBoard()
  private enemyBoard: Board = createEmptyBoard()
  private playerShips: Ship[] = createShips()
  private enemyShips: Ship[] = createShips()
  private phase: GamePhase = 'PLACEMENT'
  private round = 1
  private score = 0
  private stats = { shots: 0, hits: 0, misses: 0 }
  private winner: Winner = null

  reset(): void {
    this.playerBoard = createEmptyBoard()
    this.enemyBoard = createEmptyBoard()
    this.playerShips = createShips()
    this.enemyShips = createShips()
    autoPlaceShips(this.enemyBoard, this.enemyShips)
    this.phase = 'PLACEMENT'
    this.round = 1
    this.score = 0
    this.stats = { shots: 0, hits: 0, misses: 0 }
    this.winner = null
  }

  getNextUnplacedShip(): Ship | null {
    return this.playerShips.find((ship) => ship.position === null) ?? null
  }

  allPlayerShipsPlaced(): boolean {
    return this.playerShips.every((ship) => ship.position !== null)
  }

  previewPlacement(shipId: string, anchor: Coord, orientation: Orientation): PlacementCheck {
    const ship = this.playerShips.find((s) => s.id === shipId)
    if (!ship) return { valid: false, cells: [] }
    return validateShipPlacement(this.playerBoard, ship.length, anchor, orientation)
  }

  confirmPlacement(shipId: string, anchor: Coord, orientation: Orientation): boolean {
    const ship = this.playerShips.find((s) => s.id === shipId && s.position === null)
    if (!ship) return false
    const check = validateShipPlacement(this.playerBoard, ship.length, anchor, orientation)
    if (!check.valid) return false
    placeShip(this.playerBoard, ship, anchor, orientation, check.cells)
    return true
  }

  /** 玩家全部放完後呼叫：READY -> PLAYER_TURN（需求第 17 點，玩家先手） */
  startBattle(): boolean {
    if (this.phase !== 'PLACEMENT' || !this.allPlayerShipsPlaced()) return false
    this.phase = 'PLAYER_TURN'
    return true
  }

  playerAttack(target: Coord): AttackResult {
    if (this.phase !== 'PLAYER_TURN') return { result: 'ALREADY_ATTACKED' }
    const outcome = attackCell(this.enemyBoard, this.enemyShips, target)
    if (outcome.result === 'ALREADY_ATTACKED') return outcome

    this.stats.shots += 1
    if (outcome.result === 'HIT' || outcome.result === 'SUNK') {
      this.stats.hits += 1
      this.score += HIT_SCORE
      if (outcome.result === 'SUNK') this.score += SUNK_SCORE
    } else {
      this.stats.misses += 1
    }

    if (checkWin(this.enemyShips)) {
      this.score += WIN_SCORE
      this.phase = 'GAME_OVER'
      this.winner = 'PLAYER'
    } else {
      this.phase = 'AI_TURN'
    }
    return outcome
  }

  /** 由頁面在 setTimeout(500~1000ms) 後呼叫，engine 本身不處理計時（需求第 30 點） */
  aiAttack(): AttackResult & { target: Coord | null } {
    if (this.phase !== 'AI_TURN') return { result: 'ALREADY_ATTACKED', target: null }
    const target = chooseAttackTarget(this.playerBoard)
    if (!target) return { result: 'ALREADY_ATTACKED', target: null }
    const outcome = attackCell(this.playerBoard, this.playerShips, target)

    if (checkWin(this.playerShips)) {
      this.phase = 'GAME_OVER'
      this.winner = 'AI'
    } else {
      this.phase = 'PLAYER_TURN'
      this.round += 1
    }
    return { ...outcome, target }
  }

  getSnapshot(): BattleshipSnapshot {
    return {
      phase: this.phase,
      round: this.round,
      score: this.score,
      stats: { ...this.stats },
      playerBoard: this.playerBoard.map((row) => row.map((cell) => ({ ...cell }))),
      enemyBoardView: getPlayerViewOfEnemyBoard(this.enemyBoard),
      playerShips: this.playerShips.map(toShipSummary),
      enemyShips: this.enemyShips.map(toShipSummary),
      winner: this.winner
    }
  }
}
