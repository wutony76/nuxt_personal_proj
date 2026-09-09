/**
 * BUBBLE SHOOTER 遊戲核心邏輯（純 TypeScript，完全不依賴 Vue／DOM，比照 whackAMoleEngine.ts 的寫法）。
 *
 * 座標系統採「格單位」（1 格＝1 顆泡泡直徑）而非 px，頁面負責換算成實際像素（見 game/bubble-shooter.vue
 * 的 CELL 常數），engine 完全不知道畫面尺寸。
 *
 * Grid 採經典「交錯偏移」（offset coordinates，奇數列整排往右偏移半格）：
 *   - 每列固定 COLS 格（奇數列視覺上偏移，但邏輯格數跟偶數列一樣，簡化實作，見 design 決策）。
 *   - 相鄰格判定用標準 offset-coordinate 六方向鄰居公式（`neighborsOf`），不需要額外函式庫。
 *
 * 發射彈道是純數值計算（角度 → 速度分量 → 逐 tick 累加座標 → 牆壁反彈 → 碰撞偵測），
 * 不是物理引擎、不是 Canvas——碰撞後直接用「最近格公式」snap 進網格（Grid Logic，非真實物理）。
 *
 * 消除／掉落判定發生在 `resolveSnap()`：
 *   1. 對剛 snap 的格子做同色 flood-fill，≥3 顆即消除（MATCH）。
 *   2. 消除後對「目前還跟最頂列連通」的格子做第二次 flood-fill（從 row 0 出發），
 *      沒被標記到的格子視為懸空，整群移除並計分（DROP）。
 * 兩次 flood-fill 都是標準 DFS/stack 實作，沒有用到任何圖形函式庫。
 */

// ── 型別 ──
export type BubbleColor = 'RED' | 'BLUE' | 'GREEN' | 'YELLOW'
export type BubbleShooterStatus = 'idle' | 'playing' | 'paused' | 'gameover'
/**
 * id 是穩定身分（跟格子座標脫鉤），專門給頁面端的 Vue `:key` 用：插入新列時整排陣列往下搬移
 * （`this.grid[r] = this.grid[r-1]`），同一顆球的 row 座標會變但 id 不變，頁面才能用
 * `<TransitionGroup>` 認出「這是同一顆球移動了」而不是「這個座標的顏色瞬間換掉了」。
 *
 * pushed＝這顆球是不是「每 SHOTS_PER_NEW_ROW 次插入新列」那個機制生出來的（見 maybePushNewRow）。
 * 頁面靠這個欄位讓插入新列的球用「從上方滑入、全尺寸」的進場動畫，跟一般新球「由小長大」的
 * 動畫做區隔——由小長大的動畫在球還很小/半透明時，如果玩家剛好在那個瞬間射過去，視覺上會像
 * 「球直接穿透過去」（球確實有正確判定碰撞，只是撞到的目標當下看起來還沒完全長出來）。
 */
export type GridCell = { id: number; color: BubbleColor; pushed: boolean } | null

export type FlyingBubble = { x: number; y: number; vx: number; vy: number; color: BubbleColor }

export type BubbleShooterSnapshot = {
  status: BubbleShooterStatus
  grid: GridCell[][]
  flying: FlyingBubble | null
  current: BubbleColor
  next: BubbleColor
  aimAngle: number
  score: number
  combo: number
  maxCombo: number
  shotsFired: number
  warning: boolean
}

export type ShootResult = {
  fired: boolean
}

/** 一顆被移除的泡泡的完整資訊，讓頁面端能在 grid 資料已經移除它之後，還能畫出「消除／掉落」動畫 */
export type RemovedBubble = { id: number; row: number; col: number; color: BubbleColor }

export type TickResult = {
  snapped: boolean
  /** 這次 snap 同色連成一片被消除的泡泡（≥MATCH_MIN 才會非空） */
  matched: RemovedBubble[]
  /** 這次 snap 因為跟頂列失去連接而掉落的泡泡（只有在有 match 時才可能非空） */
  dropped: RemovedBubble[]
  scoreGained: number
  /** 這次 snap 是否觸發了「每 SHOTS_PER_NEW_ROW 次插入新列」的施壓機制（見 maybePushNewRow） */
  rowPushed: boolean
  gameOver: boolean
}

// ── 對局常數（集中管理）──
export const ROWS = 12
export const COLS = 8
export const COLORS: BubbleColor[] = ['RED', 'BLUE', 'GREEN', 'YELLOW']
export const INITIAL_FILLED_ROWS = 5
/** 泡泡到達這一列（含）以下 → WARNING（頁面顯示警示） */
export const WARNING_ROW = ROWS - 4
/** 泡泡到達這一列（含）以下 → GAME OVER */
export const GAMEOVER_ROW = ROWS - 1
/** 每發射這麼多次子彈，從頂端插入一整列新泡泡，逐漸增加壓力（比照經典泡泡龍的施壓機制） */
export const SHOTS_PER_NEW_ROW = 8

export const BUBBLE_RADIUS = 0.5
export const BUBBLE_DIAMETER = 1
/** 列高比例：六方向堆疊時垂直間距略小於水平間距（sqrt(3)/2 ≈ 0.87），讓畫面看起來是緊密排列的圓 */
export const ROW_HEIGHT_RATIO = 0.87
/** 發射速度（格/秒） */
export const SHOT_SPEED = 9
/** 瞄準角度限制（相對正上方，弧度），避免打成水平或往下 */
export const MAX_AIM_ANGLE = (75 * Math.PI) / 180

export const MATCH_MIN = 3
export const MATCH3_SCORE = 100
export const MATCH4_SCORE = 150
export const MATCH5_SCORE = 250
export const MATCH_EXTRA_PER_BUBBLE = 50
export const DROP_SCORE_PER_BUBBLE = 100
export const COMBO_BONUS_PER_COMBO = 10

/** 依消除顆數換算分數：3 顆 100、4 顆 150、5 顆 250，超過 5 顆每多 1 顆再 +50 */
export const matchScore = (count: number): number => {
  if (count <= 3) return MATCH3_SCORE
  if (count === 4) return MATCH4_SCORE
  return MATCH5_SCORE + (count - 5) * MATCH_EXTRA_PER_BUBBLE
}

/** 該列第 col 格的格中心 X（格單位），奇數列整排右移半格 */
export const cellCenterX = (row: number, col: number): number => col + 0.5 + (row % 2 === 1 ? 0.5 : 0)
/** 第 row 列的格中心 Y（格單位） */
export const cellCenterY = (row: number): number => row * ROW_HEIGHT_RATIO + ROW_HEIGHT_RATIO / 2

/** offset-coordinate 標準六方向鄰居公式（奇數列與偶數列的鄰居列偏移方向不同） */
export const neighborsOf = (row: number, col: number): Array<{ row: number; col: number }> => {
  const isOdd = row % 2 === 1
  const list: Array<{ row: number; col: number }> = [
    { row, col: col - 1 },
    { row, col: col + 1 }
  ]
  if (isOdd) {
    list.push({ row: row - 1, col }, { row: row - 1, col: col + 1 })
    list.push({ row: row + 1, col }, { row: row + 1, col: col + 1 })
  } else {
    list.push({ row: row - 1, col: col - 1 }, { row: row - 1, col })
    list.push({ row: row + 1, col: col - 1 }, { row: row + 1, col })
  }
  return list
}

const inGrid = (row: number, col: number): boolean => row >= 0 && row < ROWS && col >= 0 && col < COLS

/** 從 (startRow, startCol) 出發，DFS 找出所有同色連通格（含自己） */
const floodFillSameColor = (grid: GridCell[][], startRow: number, startCol: number, color: BubbleColor): Array<{ row: number; col: number }> => {
  const visited = new Set<string>()
  const stack: Array<{ row: number; col: number }> = [{ row: startRow, col: startCol }]
  const result: Array<{ row: number; col: number }> = []
  while (stack.length > 0) {
    const cur = stack.pop()!
    const key = `${cur.row},${cur.col}`
    if (visited.has(key)) continue
    visited.add(key)
    const cell = grid[cur.row]?.[cur.col]
    if (!cell || cell.color !== color) continue
    result.push(cur)
    for (const n of neighborsOf(cur.row, cur.col)) {
      if (inGrid(n.row, n.col) && !visited.has(`${n.row},${n.col}`)) stack.push(n)
    }
  }
  return result
}

/** 從第 0 列所有已佔用格出發，DFS 找出所有「跟頂列連通」的格子（不分顏色） */
const findAnchoredCells = (grid: GridCell[][]): Set<string> => {
  const visited = new Set<string>()
  const stack: Array<{ row: number; col: number }> = []
  for (let c = 0; c < COLS; c += 1) {
    if (grid[0]?.[c]) stack.push({ row: 0, col: c })
  }
  while (stack.length > 0) {
    const cur = stack.pop()!
    const key = `${cur.row},${cur.col}`
    if (visited.has(key)) continue
    if (!grid[cur.row]?.[cur.col]) continue
    visited.add(key)
    for (const n of neighborsOf(cur.row, cur.col)) {
      if (inGrid(n.row, n.col) && !visited.has(`${n.row},${n.col}`)) stack.push(n)
    }
  }
  return visited
}

/** 建構時的固定初始盤面（不吃亂數），避免 SSR／client 各自產生不同盤面造成 hydration mismatch
 *  （比照 colorMatchEngine／mazeEngine 的做法）。真正隨機的盤面只在 client-only 的 `reset()` 才產生。 */
const createEmptyGrid = (): GridCell[][] => Array.from({ length: ROWS }, () => Array<GridCell>(COLS).fill(null))

export type BubbleShooterEngineOptions = {
  /** 隨機源（測試可注入決定性亂數），預設 Math.random */
  random?: () => number
}

/**
 * BUBBLE SHOOTER 引擎：整合 Grid／瞄準／發射／碰撞／消除／掉落／施壓／計分。
 * 對外提供 `reset/start/pause/resume`、`aim`、`shoot`、`tick`、`getSnapshot`。
 */
export default class BubbleShooterEngine {
  private status: BubbleShooterStatus = 'idle'
  private grid: GridCell[][] = createEmptyGrid()
  private flying: FlyingBubble | null = null
  private current: BubbleColor = 'RED'
  private next: BubbleColor = 'BLUE'
  private aimAngle = 0
  private score = 0
  private combo = 0
  private maxCombo = 0
  private shotsFired = 0
  private nextBubbleId = 1
  private random: () => number

  constructor(options: BubbleShooterEngineOptions = {}) {
    this.random = options.random ?? Math.random
  }

  private randomColor(): BubbleColor {
    return COLORS[Math.floor(this.random() * COLORS.length)]!
  }

  private fillRow(row: number, pushed: boolean): void {
    for (let c = 0; c < COLS; c += 1) {
      this.grid[row]![c] = { id: this.nextBubbleId++, color: this.randomColor(), pushed }
    }
  }

  /** 完整重置；status 回到 idle，不殘留上一局資料 */
  reset(): void {
    this.status = 'idle'
    this.nextBubbleId = 1
    this.grid = createEmptyGrid()
    for (let r = 0; r < INITIAL_FILLED_ROWS; r += 1) this.fillRow(r, false)
    this.flying = null
    this.current = this.randomColor()
    this.next = this.randomColor()
    this.aimAngle = 0
    this.score = 0
    this.combo = 0
    this.maxCombo = 0
    this.shotsFired = 0
  }

  /** 開始新的一局：完整重置後進入 playing */
  start(): void {
    this.reset()
    this.status = 'playing'
  }

  /** 暫停／續玩 */
  pause(): void {
    if (this.status !== 'playing') return
    this.status = 'paused'
  }

  resume(): void {
    if (this.status !== 'paused') return
    this.status = 'playing'
  }

  /** 更新瞄準角度（相對正上方，弧度），夾在 ±MAX_AIM_ANGLE 之間 */
  aim(angle: number): void {
    this.aimAngle = Math.max(-MAX_AIM_ANGLE, Math.min(MAX_AIM_ANGLE, angle))
  }

  /** 發射目前的 current 泡泡；已經有飛行中的泡泡時忽略（一次只能有一顆在飛） */
  shoot(): ShootResult {
    if (this.status !== 'playing' || this.flying) return { fired: false }
    this.flying = {
      x: COLS / 2,
      y: ROWS * ROW_HEIGHT_RATIO,
      vx: Math.sin(this.aimAngle) * SHOT_SPEED,
      vy: -Math.cos(this.aimAngle) * SHOT_SPEED,
      color: this.current
    }
    this.current = this.next
    this.next = this.randomColor()
    return { fired: true }
  }

  /** 找出離 (x,y) 最近的空格（優先在 fromRow/fromCol 的鄰居中找，找不到則退回全盤掃描） */
  private nearestEmptyCell(x: number, y: number, fromRow: number, fromCol: number): { row: number; col: number } {
    const candidates = neighborsOf(fromRow, fromCol).filter((n) => inGrid(n.row, n.col) && !this.grid[n.row]?.[n.col])
    const pool = candidates.length > 0 ? candidates : this.allEmptyCells()
    let best = pool[0] ?? { row: 0, col: Math.round(x - 0.5) }
    let bestDist = Infinity
    for (const cand of pool) {
      const dx = cellCenterX(cand.row, cand.col) - x
      const dy = cellCenterY(cand.row) - y
      const dist = dx * dx + dy * dy
      if (dist < bestDist) {
        bestDist = dist
        best = cand
      }
    }
    return best
  }

  private allEmptyCells(): Array<{ row: number; col: number }> {
    const out: Array<{ row: number; col: number }> = []
    for (let r = 0; r < ROWS; r += 1) {
      for (let c = 0; c < COLS; c += 1) {
        if (!this.grid[r]?.[c]) out.push({ row: r, col: c })
      }
    }
    return out
  }

  /** 每 SHOTS_PER_NEW_ROW 次發射，整排下移、頂端插入新的一列；回傳這次是否真的觸發了插入 */
  private maybePushNewRow(): boolean {
    if (this.shotsFired % SHOTS_PER_NEW_ROW !== 0) return false
    for (let r = ROWS - 1; r > 0; r -= 1) this.grid[r] = this.grid[r - 1]!
    this.fillRow(0, true)
    return true
  }

  private checkGameOver(): boolean {
    for (let c = 0; c < COLS; c += 1) {
      if (this.grid[GAMEOVER_ROW]?.[c]) return true
    }
    return false
  }

  /** snap 進格子後的統一結算：同色 flood-fill 消除 → 懸空群消除 → 計分 → combo → 施壓 → Game Over 判定 */
  private resolveSnap(row: number, col: number, color: BubbleColor): TickResult {
    this.grid[row]![col] = { id: this.nextBubbleId++, color, pushed: false }
    this.flying = null
    this.shotsFired += 1

    const group = floodFillSameColor(this.grid, row, col, color)
    let scoreGained = 0
    let matched: RemovedBubble[] = []
    let dropped: RemovedBubble[] = []

    if (group.length >= MATCH_MIN) {
      matched = group.map((cell) => {
        const bubble = this.grid[cell.row]![cell.col]!
        return { id: bubble.id, row: cell.row, col: cell.col, color: bubble.color }
      })
      for (const cell of group) this.grid[cell.row]![cell.col] = null
      this.combo += 1
      this.maxCombo = Math.max(this.maxCombo, this.combo)
      scoreGained += matchScore(matched.length) + this.combo * COMBO_BONUS_PER_COMBO

      const anchored = findAnchoredCells(this.grid)
      const floating: Array<{ row: number; col: number }> = []
      for (let r = 0; r < ROWS; r += 1) {
        for (let c = 0; c < COLS; c += 1) {
          if (this.grid[r]?.[c] && !anchored.has(`${r},${c}`)) floating.push({ row: r, col: c })
        }
      }
      dropped = floating.map((cell) => {
        const bubble = this.grid[cell.row]![cell.col]!
        return { id: bubble.id, row: cell.row, col: cell.col, color: bubble.color }
      })
      for (const cell of floating) this.grid[cell.row]![cell.col] = null
      scoreGained += dropped.length * DROP_SCORE_PER_BUBBLE
    } else {
      this.combo = 0
    }

    this.score += scoreGained
    const rowPushed = this.maybePushNewRow()
    const gameOver = this.checkGameOver()
    if (gameOver) this.status = 'gameover'

    return { snapped: true, matched, dropped, scoreGained, rowPushed, gameOver }
  }

  /** 推進飛行中的泡泡一個 tick：移動 → 牆壁反彈 → 碰到頂列或既有泡泡即 snap 並結算 */
  tick(dtMs: number): TickResult {
    if (this.status !== 'playing' || !this.flying) {
      return { snapped: false, matched: [], dropped: [], scoreGained: 0, rowPushed: false, gameOver: false }
    }
    const dt = dtMs / 1000
    const f = this.flying
    f.x += f.vx * dt
    f.y += f.vy * dt

    if (f.x <= BUBBLE_RADIUS) {
      f.x = BUBBLE_RADIUS
      f.vx = Math.abs(f.vx)
    } else if (f.x >= COLS - BUBBLE_RADIUS) {
      f.x = COLS - BUBBLE_RADIUS
      f.vx = -Math.abs(f.vx)
    }

    // 碰撞當下飛行泡泡通常還沒真正到達目標格中心（一偵測到距離小於門檻就立刻判定碰撞），
    // 若直接拿「當下座標」去找最近空格，會因為還沒走到位而偏向撞擊格的來源方向（往下走的泡泡
    // 會偏向找到下面那格而不是應該附著的上面那格）。這裡改用「沿速度方向再往前推一小步」的
    // 假想座標去找最近空格，讓 snap 方向跟飛行方向一致（見 nearestEmptyCell 的呼叫端）。
    const aheadX = f.x + f.vx * 0.05
    const aheadY = f.y + f.vy * 0.05

    if (f.y <= cellCenterY(0)) {
      const col = Math.max(0, Math.min(COLS - 1, Math.round(f.x - 0.5)))
      const target = this.grid[0]?.[col] ? this.nearestEmptyCell(aheadX, aheadY, 0, col) : { row: 0, col }
      return this.resolveSnap(target.row, target.col, f.color)
    }

    for (let r = 0; r < ROWS; r += 1) {
      for (let c = 0; c < COLS; c += 1) {
        const cell = this.grid[r]?.[c]
        if (!cell) continue
        const dx = cellCenterX(r, c) - f.x
        const dy = cellCenterY(r) - f.y
        if (dx * dx + dy * dy < (BUBBLE_DIAMETER * 0.92) ** 2) {
          const target = this.nearestEmptyCell(aheadX, aheadY, r, c)
          return this.resolveSnap(target.row, target.col, f.color)
        }
      }
    }

    return { snapped: false, matched: [], dropped: [], scoreGained: 0, rowPushed: false, gameOver: false }
  }

  /** 對外回傳純資料快照（頁面用 reactive() 鏡像） */
  getSnapshot(): BubbleShooterSnapshot {
    let warning = false
    for (let c = 0; c < COLS; c += 1) {
      if (this.grid[WARNING_ROW]?.[c]) warning = true
    }
    return {
      status: this.status,
      grid: this.grid.map((row) => row.map((cell) => (cell ? { ...cell } : null))),
      flying: this.flying ? { ...this.flying } : null,
      current: this.current,
      next: this.next,
      aimAngle: this.aimAngle,
      score: this.score,
      combo: this.combo,
      maxCombo: this.maxCombo,
      shotsFired: this.shotsFired,
      warning
    }
  }
}
