export type Match3Position = { row: number; col: number }

/** lineH／lineV 命名代表「觸發後清除的方向」：lineH 清整排、lineV 清整列 */
export type Match3SpecialKind = 'none' | 'lineH' | 'lineV' | 'bomb' | 'colorBomb'

export type Match3Snapshot = {
  grid: number[][]
  special: Match3SpecialKind[][]
  score: number
}

export type Match3SpecialSpawn = { position: Match3Position; kind: Match3SpecialKind }

export type Match3SwapResult = {
  matched: boolean
  /** 這條連鎖總共跑了幾輪，等同這條連鎖達到的最高 Combo 數（計分時另外套用 COMBO_CAP 封頂，這裡回傳未封頂的真實輪數供 UI 顯示） */
  cascadeRounds: number
  gained: number
  reshuffled: boolean
  specialsCreated: Match3SpecialSpawn[]
}

/**
 * 難度隨分數自動升級的門檻，比照 snake/racing/tetriminos 既有的「Lv 隨進度提升」慣例（見 design.md）。
 * 門檻數值配合下方計分公式（每格基礎分 10→4）等比例調降，維持「多久升一次 Lv」的原有節奏不變。
 */
const MATCH3_LEVEL_SCORE_THRESHOLDS = [0, 80, 200, 400, 800]
export const MATCH3_MAX_LEVEL = MATCH3_LEVEL_SCORE_THRESHOLDS.length

export function calcMatch3Level(score: number): number {
  let level = 1
  for (let i = 1; i < MATCH3_LEVEL_SCORE_THRESHOLDS.length; i += 1) {
    if (score >= MATCH3_LEVEL_SCORE_THRESHOLDS[i]!) level = i + 1
  }
  return level
}

/** Match3 沒有連續移動的「速度」概念，難度改用寶石種類數表現：種類越多，可消除的組合越難找 */
export function calcMatch3TypeCount(level: number): number {
  return Math.min(8, 6 + Math.floor((level - 1) / 2))
}

const POINTS_PER_TILE = 4
/**
 * Combo／封頂常數：特殊方塊清除格數變多、Combo 線性成長，兩者是相乘而非相加的關係，
 * 連鎖越長很容易接近平方成長，因此把封頂機制當成設計本身的一部分（見 add-match3-games 規劃文件），
 * 而不是只靠事後調整 coinRate。這些數值是初始估計值，上線後可依實測分數分佈調整。
 */
const COMBO_CAP = 6
const ROUND_SCORE_CAP = 500
const CHAIN_SCORE_CAP = 2000
const MAX_BOARD_GENERATION_ATTEMPTS = 200

type Match3RunShape = 'line3' | 'line4' | 'line5plus' | 'corner'
type Match3Group = {
  shape: Match3RunShape
  cells: Match3Position[]
  orientation?: 'horizontal' | 'vertical'
  junction?: Match3Position
}
type Match3Detonation = { position: Match3Position; colorOverride?: number }
type Match3PendingSpawn = { position: Match3Position; kind: Match3SpecialKind; color: number }

const cellKey = (p: Match3Position) => `${p.row},${p.col}`
const rowMajorIndex = (p: Match3Position, size: number) => p.row * size + p.col

const mergeCells = (a: Match3Position[], b: Match3Position[]): Match3Position[] => {
  const map = new Map<string, Match3Position>()
  ;[...a, ...b].forEach((p) => map.set(cellKey(p), p))
  return [...map.values()]
}

const specialKindForGroup = (g: Match3Group): Match3SpecialKind => {
  if (g.shape === 'line4') return g.orientation === 'horizontal' ? 'lineH' : 'lineV'
  if (g.shape === 'line5plus') return 'colorBomb'
  if (g.shape === 'corner') return 'bomb'
  return 'none'
}

/**
 * 三消棋盤共用核心引擎：交換合法性、連鎖消除、特殊方塊（Line Bomb／Bomb／Color Bomb）、
 * Combo 計分、無解自動洗牌。純邏輯、不依賴 Vue，供 match3-rush.vue／match3-classic.vue
 * 各自的薄包裝 engine 共用，避免兩款遊戲各自複製一份複雜的消除演算法（見 add-match3-games design.md）。
 *
 * 特殊方塊資料模型：顏色維持原本的 `grid: number[][]` 不變，另外疊一層平行的
 * `special: Match3SpecialKind[][]`（預設全 'none'），避免動到既有以顏色比對為主的邏輯。
 */
export default class Match3CoreEngine {
  private grid: number[][] = []
  private special: Match3SpecialKind[][] = []
  private score = 0

  constructor(
    private readonly size = 8,
    private typeCount = 6
  ) {
    this.reset()
  }

  /** 難度升級時呼叫：之後掉落補位／初始產生棋盤會從擴大後的寶石種類池抽取 */
  setTypeCount(typeCount: number) {
    this.typeCount = Math.max(3, Math.min(typeCount, 12))
  }

  reset() {
    this.score = 0
    this.createSolvableFreshBoard()
  }

  getSnapshot(): Match3Snapshot {
    return {
      grid: this.grid.map((row) => [...row]),
      special: this.special.map((row) => [...row]),
      score: this.score
    }
  }

  isAdjacent(a: Match3Position, b: Match3Position): boolean {
    return Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1
  }

  trySwap(a: Match3Position, b: Match3Position): Match3SwapResult {
    const EMPTY: Match3SwapResult = { matched: false, cascadeRounds: 0, gained: 0, reshuffled: false, specialsCreated: [] }
    if (!this.isAdjacent(a, b) || !this.inBounds(a) || !this.inBounds(b)) return EMPTY

    const aSpecial = this.specialAt(a.row, a.col)
    const bSpecial = this.specialAt(b.row, b.col)
    const aColor = this.cellAt(a.row, a.col)
    const bColor = this.cellAt(b.row, b.col)
    const directTrigger = aSpecial !== 'none' || bSpecial !== 'none'

    this.swapCells(a, b)

    const groups = this.findMatchGroups()
    if (!directTrigger && groups.length === 0) {
      this.swapCells(a, b)
      return EMPTY
    }

    // 交換後：a 特殊方塊現在落在 b、b 特殊方塊現在落在 a；Color Bomb 的目標色用「對方交換前的顏色」，
    // 若對方也是特殊方塊（雙特殊方塊互換）則沒有顏色情境，colorOverride 留空走 fallback（見 resolveColorBombTarget）
    const initialDetonations: Match3Detonation[] = []
    if (aSpecial !== 'none') {
      initialDetonations.push({ position: b, colorOverride: bSpecial === 'none' ? bColor : undefined })
    }
    if (bSpecial !== 'none') {
      initialDetonations.push({ position: a, colorOverride: aSpecial === 'none' ? aColor : undefined })
    }

    return this.runCascade(groups, initialDetonations, { from: a, to: b })
  }

  private runCascade(
    initialGroups: Match3Group[],
    initialDetonations: Match3Detonation[],
    swapContext: { from: Match3Position; to: Match3Position }
  ): Match3SwapResult {
    let round = 0
    let gained = 0
    const specialsCreated: Match3SpecialSpawn[] = []
    let pendingGroups = initialGroups
    let pendingDetonations = initialDetonations

    while (pendingGroups.length > 0 || pendingDetonations.length > 0) {
      round += 1
      const comboMultiplier = Math.min(round, COMBO_CAP)

      const clearSet = new Map<string, Match3Position>()
      pendingGroups.forEach((g) => g.cells.forEach((p) => clearSet.set(cellKey(p), p)))
      pendingDetonations.forEach((d) => clearSet.set(cellKey(d.position), d.position))

      // 這一輪新產生的特殊方塊：顏色要在任何清除發生「之前」擷取，位置優先用玩家交換到的格子（僅第 1 輪適用）
      const spawns: Match3PendingSpawn[] = []
      pendingGroups.forEach((g) => {
        const kind = specialKindForGroup(g)
        if (kind === 'none') return
        const position = round === 1 ? this.spawnPositionForSwap(g, swapContext) : this.geometricSpawnPosition(g)
        const color = this.cellAt(g.cells[0]!.row, g.cells[0]!.col)
        spawns.push({ position, kind, color })
      })
      const immune = new Set(spawns.map((s) => cellKey(s.position)))
      spawns.forEach((s) => clearSet.delete(cellKey(s.position)))

      // worklist：清除集合裡任何特殊方塊都要引爆並把爆炸範圍併入，直到沒有新的特殊方塊被捲入為止
      const detonationPositions = new Set(pendingDetonations.map((d) => cellKey(d.position)))
      const queue: Match3Detonation[] = [...pendingDetonations]
      ;[...clearSet.values()].forEach((p) => {
        const k = cellKey(p)
        if (detonationPositions.has(k)) return
        if (this.specialAt(p.row, p.col) !== 'none') queue.push({ position: p })
      })

      const processed = new Set<string>()
      while (queue.length > 0) {
        // Line Bomb／Bomb 優先於 Color Bomb 處理，讓 Color Bomb 判斷目標色時能看到最完整的清除集合；
        // 同優先權再依左上到右下排序，確保處理順序是確定性的
        queue.sort((x, y) => {
          const px = this.specialAt(x.position.row, x.position.col) === 'colorBomb' ? 1 : 0
          const py = this.specialAt(y.position.row, y.position.col) === 'colorBomb' ? 1 : 0
          if (px !== py) return px - py
          return rowMajorIndex(x.position, this.size) - rowMajorIndex(y.position, this.size)
        })
        const item = queue.shift()!
        const k = cellKey(item.position)
        if (processed.has(k) || immune.has(k)) continue
        processed.add(k)
        const kind = this.specialAt(item.position.row, item.position.col)
        if (kind === 'none') continue

        const blastCells = this.computeBlast(kind, item.position, item.colorOverride, clearSet)
        blastCells.forEach((p) => {
          const pk = cellKey(p)
          if (immune.has(pk)) return
          if (!clearSet.has(pk)) clearSet.set(pk, p)
          if (!processed.has(pk) && this.specialAt(p.row, p.col) !== 'none' && !queue.some((q) => cellKey(q.position) === pk)) {
            queue.push({ position: p })
          }
        })
      }

      const clearedCount = clearSet.size
      const roundScore = Math.min(clearedCount * POINTS_PER_TILE * comboMultiplier, ROUND_SCORE_CAP)
      gained = Math.min(gained + roundScore, CHAIN_SCORE_CAP)
      specialsCreated.push(...spawns.map(({ position, kind }) => ({ position, kind })))

      this.clearAndRefill([...clearSet.values()], spawns)

      pendingGroups = this.findMatchGroups()
      pendingDetonations = []
    }

    this.score += gained

    let reshuffled = false
    if (!this.hasAnyValidMove()) {
      this.reshuffleKeepingSpecials()
      reshuffled = true
    }

    return { matched: round > 0, cascadeRounds: round, gained, reshuffled, specialsCreated }
  }

  private spawnPositionForSwap(g: Match3Group, swapContext: { from: Match3Position; to: Match3Position }): Match3Position {
    const inGroup = (p: Match3Position) => g.cells.some((c) => c.row === p.row && c.col === p.col)
    if (inGroup(swapContext.to)) return swapContext.to
    if (inGroup(swapContext.from)) return swapContext.from
    return this.geometricSpawnPosition(g)
  }

  private geometricSpawnPosition(g: Match3Group): Match3Position {
    if (g.shape === 'corner') return g.junction!
    return g.cells[Math.floor(g.cells.length / 2)]!
  }

  private computeBlast(
    kind: Match3SpecialKind,
    pos: Match3Position,
    colorOverride: number | undefined,
    clearSetSoFar: Map<string, Match3Position>
  ): Match3Position[] {
    if (kind === 'lineH') {
      const cells: Match3Position[] = []
      for (let c = 0; c < this.size; c += 1) cells.push({ row: pos.row, col: c })
      return cells
    }
    if (kind === 'lineV') {
      const cells: Match3Position[] = []
      for (let r = 0; r < this.size; r += 1) cells.push({ row: r, col: pos.col })
      return cells
    }
    if (kind === 'bomb') {
      const cells: Match3Position[] = []
      for (let dr = -1; dr <= 1; dr += 1) {
        for (let dc = -1; dc <= 1; dc += 1) {
          const p = { row: pos.row + dr, col: pos.col + dc }
          if (this.inBounds(p)) cells.push(p)
        }
      }
      return cells
    }
    if (kind === 'colorBomb') {
      const target = colorOverride !== undefined ? colorOverride : this.resolveColorBombTarget(clearSetSoFar, pos)
      const cells: Match3Position[] = [pos]
      for (let r = 0; r < this.size; r += 1) {
        for (let c = 0; c < this.size; c += 1) {
          if (r === pos.row && c === pos.col) continue
          if (this.cellAt(r, c) === target) cells.push({ row: r, col: c })
        }
      }
      return cells
    }
    return []
  }

  /** 目標色優先用清除集合裡「其他普通色格」的眾數；沒有的話退回全盤面眾數；仍打平取顏色編號最小的（確定性 tie-break） */
  private resolveColorBombTarget(clearSetSoFar: Map<string, Match3Position>, selfPos: Match3Position): number {
    const counts = new Map<number, number>()
    for (const p of clearSetSoFar.values()) {
      if (p.row === selfPos.row && p.col === selfPos.col) continue
      if (this.specialAt(p.row, p.col) !== 'none') continue
      const color = this.cellAt(p.row, p.col)
      counts.set(color, (counts.get(color) ?? 0) + 1)
    }
    if (counts.size === 0) {
      for (let r = 0; r < this.size; r += 1) {
        for (let c = 0; c < this.size; c += 1) {
          if (this.specialAt(r, c) === 'none') {
            const color = this.cellAt(r, c)
            counts.set(color, (counts.get(color) ?? 0) + 1)
          }
        }
      }
    }
    if (counts.size === 0) return 0
    return [...counts.entries()].sort((x, y) => y[1] - x[1] || x[0] - y[0])[0]![0]
  }

  /** 棋盤讀寫的統一入口：呼叫端保證座標在合法範圍內（迴圈邊界／inBounds 已檢查），故用非空斷言集中在這裡 */
  private cellAt(r: number, c: number): number {
    return this.grid[r]![c]!
  }

  private setCellAt(r: number, c: number, value: number) {
    this.grid[r]![c] = value
  }

  private specialAt(r: number, c: number): Match3SpecialKind {
    return this.special[r]![c]!
  }

  private setSpecialAt(r: number, c: number, kind: Match3SpecialKind) {
    this.special[r]![c] = kind
  }

  /** 顏色連線偵測專用：特殊方塊格一律回傳 null，永遠不參與被動連線（不會湊三連、也不會延伸別人的連線） */
  private colorFor(r: number, c: number): number | null {
    return this.specialAt(r, c) === 'none' ? this.cellAt(r, c) : null
  }

  private inBounds(p: Match3Position): boolean {
    return p.row >= 0 && p.row < this.size && p.col >= 0 && p.col < this.size
  }

  private swapCells(a: Match3Position, b: Match3Position) {
    const tmpColor = this.cellAt(a.row, a.col)
    const tmpSpecial = this.specialAt(a.row, a.col)
    this.setCellAt(a.row, a.col, this.cellAt(b.row, b.col))
    this.setSpecialAt(a.row, a.col, this.specialAt(b.row, b.col))
    this.setCellAt(b.row, b.col, tmpColor)
    this.setSpecialAt(b.row, b.col, tmpSpecial)
  }

  private findMatchGroups(): Match3Group[] {
    type Run = { cells: Match3Position[]; orientation: 'horizontal' | 'vertical' }
    const runsH: Run[] = []
    const runsV: Run[] = []

    for (let r = 0; r < this.size; r += 1) {
      let runStart = 0
      for (let c = 1; c <= this.size; c += 1) {
        const startColor = this.colorFor(r, runStart)
        const curColor = c < this.size ? this.colorFor(r, c) : null
        const same = startColor !== null && curColor === startColor
        if (!same) {
          if (startColor !== null && c - runStart >= 3) {
            const cells: Match3Position[] = []
            for (let k = runStart; k < c; k += 1) cells.push({ row: r, col: k })
            runsH.push({ cells, orientation: 'horizontal' })
          }
          runStart = c
        }
      }
    }

    for (let c = 0; c < this.size; c += 1) {
      let runStart = 0
      for (let r = 1; r <= this.size; r += 1) {
        const startColor = this.colorFor(runStart, c)
        const curColor = r < this.size ? this.colorFor(r, c) : null
        const same = startColor !== null && curColor === startColor
        if (!same) {
          if (startColor !== null && r - runStart >= 3) {
            const cells: Match3Position[] = []
            for (let k = runStart; k < r; k += 1) cells.push({ row: k, col: c })
            runsV.push({ cells, orientation: 'vertical' })
          }
          runStart = r
        }
      }
    }

    const groups: Match3Group[] = []
    const exactly3H = runsH.filter((run) => run.cells.length === 3)
    const exactly3V = runsV.filter((run) => run.cells.length === 3)
    const consumedH = new Set<number>()
    const consumedV = new Set<number>()

    // L/T 型：恰好 3 的橫向 run 與恰好 3 的縱向 run 共用一格才合併；≥4 的 run 不參與（見 findMatchGroups 上方規劃說明）
    exactly3H.forEach((hRun, hi) => {
      for (let vi = 0; vi < exactly3V.length; vi += 1) {
        if (consumedV.has(vi)) continue
        const vRun = exactly3V[vi]!
        const junction = hRun.cells.find((p) => vRun.cells.some((q) => q.row === p.row && q.col === p.col))
        if (junction) {
          groups.push({ shape: 'corner', cells: mergeCells(hRun.cells, vRun.cells), junction })
          consumedH.add(hi)
          consumedV.add(vi)
          break
        }
      }
    })

    exactly3H.forEach((run, hi) => {
      if (!consumedH.has(hi)) groups.push({ shape: 'line3', cells: run.cells, orientation: 'horizontal' })
    })
    exactly3V.forEach((run, vi) => {
      if (!consumedV.has(vi)) groups.push({ shape: 'line3', cells: run.cells, orientation: 'vertical' })
    })
    ;[...runsH, ...runsV].forEach((run) => {
      if (run.cells.length === 4) {
        groups.push({ shape: 'line4', cells: run.cells, orientation: run.orientation })
      } else if (run.cells.length >= 5) {
        groups.push({ shape: 'line5plus', cells: run.cells, orientation: run.orientation })
      }
    })

    return groups
  }

  private clearAndRefill(clearPositions: Match3Position[], spawns: Match3PendingSpawn[]) {
    clearPositions.forEach(({ row, col }) => {
      this.setCellAt(row, col, -1)
      this.setSpecialAt(row, col, 'none')
    })
    spawns.forEach(({ position, kind, color }) => {
      this.setCellAt(position.row, position.col, color)
      this.setSpecialAt(position.row, position.col, kind)
    })

    for (let c = 0; c < this.size; c += 1) {
      const survivorColors: number[] = []
      const survivorSpecials: Match3SpecialKind[] = []
      for (let r = this.size - 1; r >= 0; r -= 1) {
        const color = this.cellAt(r, c)
        if (color !== -1) {
          survivorColors.push(color)
          survivorSpecials.push(this.specialAt(r, c))
        }
      }
      for (let r = this.size - 1; r >= 0; r -= 1) {
        const idx = this.size - 1 - r
        if (idx < survivorColors.length) {
          this.setCellAt(r, c, survivorColors[idx]!)
          this.setSpecialAt(r, c, survivorSpecials[idx]!)
        } else {
          this.setCellAt(r, c, this.randomType())
          this.setSpecialAt(r, c, 'none')
        }
      }
    }
  }

  /** 只檢查顏色連消是否存在，刻意不把「交換特殊方塊必定合法」算進去——洗牌是為了保證還有新的顏色消除可湊，
   *  不是為了保證玩家永遠有事可做（後者本來就有特殊方塊可以交換，不需要洗牌介入） */
  private hasAnyValidMove(): boolean {
    for (let r = 0; r < this.size; r += 1) {
      for (let c = 0; c < this.size; c += 1) {
        const candidates: Match3Position[] = [
          { row: r, col: c + 1 },
          { row: r + 1, col: c }
        ]
        for (const b of candidates) {
          if (!this.inBounds(b)) continue
          const a = { row: r, col: c }
          this.swapCells(a, b)
          const found = this.findMatchGroups().length > 0
          this.swapCells(a, b)
          if (found) return true
        }
      }
    }
    return false
  }

  private randomType(): number {
    return Math.floor(Math.random() * this.typeCount)
  }

  private createSolvableFreshBoard() {
    let attempts = 0
    do {
      this.grid = this.createGridWithoutInitialMatches()
      this.special = this.grid.map((row) => row.map(() => 'none' as Match3SpecialKind))
      attempts += 1
    } while (!this.hasAnyValidMove() && attempts < MAX_BOARD_GENERATION_ATTEMPTS)
  }

  private createGridWithoutInitialMatches(): number[][] {
    const grid: number[][] = []
    for (let r = 0; r < this.size; r += 1) {
      const row: number[] = []
      for (let c = 0; c < this.size; c += 1) {
        let type: number
        do {
          type = this.randomType()
        } while (
          (c >= 2 && row[c - 1] === type && row[c - 2] === type) ||
          (r >= 2 && grid[r - 1]![c] === type && grid[r - 2]![c] === type)
        )
        row.push(type)
      }
      grid.push(row)
    }
    return grid
  }

  /** 無解時的洗牌：只重新隨機化普通格，盤面上既有的特殊方塊原地保留（顏色與種類都不變），
   *  避免玩家辛苦湊出來的特殊方塊被無聲吃掉 */
  private reshuffleKeepingSpecials() {
    let attempts = 0
    do {
      this.fillNonSpecialCellsAvoidingMatches()
      attempts += 1
    } while (!this.hasAnyValidMove() && attempts < MAX_BOARD_GENERATION_ATTEMPTS)
  }

  private fillNonSpecialCellsAvoidingMatches() {
    for (let r = 0; r < this.size; r += 1) {
      for (let c = 0; c < this.size; c += 1) {
        if (this.specialAt(r, c) !== 'none') continue
        let type: number
        let tries = 0
        do {
          type = this.randomType()
          tries += 1
        } while (this.wouldFormImmediateMatch(r, c, type) && tries < 50)
        this.setCellAt(r, c, type)
      }
    }
  }

  private wouldFormImmediateMatch(r: number, c: number, type: number): boolean {
    const left1 = c >= 1 ? this.colorFor(r, c - 1) : null
    const left2 = c >= 2 ? this.colorFor(r, c - 2) : null
    const up1 = r >= 1 ? this.colorFor(r - 1, c) : null
    const up2 = r >= 2 ? this.colorFor(r - 2, c) : null
    return (left1 === type && left2 === type) || (up1 === type && up2 === type)
  }
}
