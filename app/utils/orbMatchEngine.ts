export type OrbPosition = { row: number; col: number }

export type OrbMatchSnapshot = {
  grid: number[][]
  score: number
}

export type OrbMatchResolveResult = {
  matched: boolean
  cascadeRounds: number
  gained: number
  reshuffled: boolean
  /** 這次結算（含所有連鎖輪）是否出現過 L/T 形連線，UI 用來顯示額外加分提示 */
  hadCorner: boolean
}

type OrbMatchGroup = { cells: OrbPosition[]; isCorner: boolean }

/** L/T 形連線的額外加分倍率，比照 MATCH3 CLASSIC 對「轉角連線」給予比單純直線更高評價的精神 */
const CORNER_BONUS_MULTIPLIER = 1.5

/**
 * 轉珠核心引擎——棋盤資料模型、消除掃描、重力補齊、無解重洗，皆移植自 match3RushEngine.ts
 * 的無特殊珠版本（見 add-orb-match-game design.md Decision 5），只是把正方形 `size` 拆成
 * 獨立的 `rows`/`cols`（傳統轉珠棋盤是 6 欄×5 列，非正方形）。
 *
 * 跟 MATCH3 最大的差異在「交換」這件事本身：MATCH3 是一次性的 `trySwap(a,b)`，不合法就立刻
 * 復原；轉珠改成 `moveHeldOrb()`，在玩家拖曳過程中被連續呼叫多次（沿拖曳路徑逐格交換），
 * 過程中完全不檢查是否構成消除，只在放開手指時呼叫一次 `resolve()` 統一掃描結算
 * （見 design.md Decision 6：拖曳中即使暫時排出三消也不會馬上消除）。
 */
export default class OrbMatchCoreEngine {
  private grid: number[][] = []
  private score = 0

  constructor(
    private readonly rows: number,
    private readonly cols: number,
    private readonly typeCount: number
  ) {
    this.reset()
  }

  reset() {
    this.score = 0
    this.grid = this.createSolvableGrid()
  }

  getSnapshot(): OrbMatchSnapshot {
    return { grid: this.grid.map((row) => [...row]), score: this.score }
  }

  isAdjacent(a: OrbPosition, b: OrbPosition): boolean {
    return Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1
  }

  /** 拖曳路徑推進一步：把「目前手上的珠子」跟相鄰的目標格交換，不檢查是否構成消除 */
  moveHeldOrb(from: OrbPosition, to: OrbPosition): boolean {
    if (!this.isAdjacent(from, to) || !this.inBounds(from) || !this.inBounds(to)) return false
    this.swapCells(from, to)
    return true
  }

  /** 放開手指後統一結算：掃描消除→清除補位→再掃描，直到沒有新消除為止；沒有消除時不改動分數也不重洗 */
  resolve(): OrbMatchResolveResult {
    let groups = this.findMatchGroups()
    if (groups.length === 0) return { matched: false, cascadeRounds: 0, gained: 0, reshuffled: false, hadCorner: false }

    let round = 0
    let gained = 0
    let hadCorner = false
    while (groups.length > 0) {
      round += 1
      const multiplier = 1 + (round - 1) * 0.5
      groups.forEach((group) => {
        const base = group.cells.length * 4 * multiplier
        gained += Math.round(group.isCorner ? base * CORNER_BONUS_MULTIPLIER : base)
        if (group.isCorner) hadCorner = true
      })
      this.clearAndRefill(this.flattenGroups(groups))
      groups = this.findMatchGroups()
    }
    this.score += gained

    let reshuffled = false
    if (!this.hasAnyValidMove()) {
      this.grid = this.createSolvableGrid()
      reshuffled = true
    }

    return { matched: true, cascadeRounds: round, gained, reshuffled, hadCorner }
  }

  private cellAt(r: number, c: number): number {
    return this.grid[r]![c]!
  }

  private setCellAt(r: number, c: number, value: number) {
    this.grid[r]![c] = value
  }

  private inBounds(p: OrbPosition): boolean {
    return p.row >= 0 && p.row < this.rows && p.col >= 0 && p.col < this.cols
  }

  private swapCells(a: OrbPosition, b: OrbPosition) {
    const tmp = this.cellAt(a.row, a.col)
    this.setCellAt(a.row, a.col, this.cellAt(b.row, b.col))
    this.setCellAt(b.row, b.col, tmp)
  }

  /** 純粹判斷「是否存在任何合法連線」用（無解重洗檢查），不需要分組資訊，維持原本輕量的 Set 版本 */
  private findMatches(): OrbPosition[] {
    return this.flattenGroups(this.findMatchGroups())
  }

  /**
   * 掃描連線並分組：恰好 3 的橫向 run 與恰好 3 的縱向 run 若共用一格，合併成一個 L/T 形群組
   * （比照 match3Engine.ts 的 corner 合併邏輯，只取「是否為轉角」這個資訊做加分，不生成特殊珠）；
   * ≥4 的長 run 不參與合併，各自獨立成組。
   */
  private findMatchGroups(): OrbMatchGroup[] {
    type Run = { cells: OrbPosition[] }
    const runsH: Run[] = []
    const runsV: Run[] = []

    for (let r = 0; r < this.rows; r += 1) {
      let runStart = 0
      for (let c = 1; c <= this.cols; c += 1) {
        const sameAsRunStart = c < this.cols && this.cellAt(r, c) === this.cellAt(r, runStart)
        if (!sameAsRunStart) {
          if (c - runStart >= 3) {
            const cells: OrbPosition[] = []
            for (let k = runStart; k < c; k += 1) cells.push({ row: r, col: k })
            runsH.push({ cells })
          }
          runStart = c
        }
      }
    }

    for (let c = 0; c < this.cols; c += 1) {
      let runStart = 0
      for (let r = 1; r <= this.rows; r += 1) {
        const sameAsRunStart = r < this.rows && this.cellAt(r, c) === this.cellAt(runStart, c)
        if (!sameAsRunStart) {
          if (r - runStart >= 3) {
            const cells: OrbPosition[] = []
            for (let k = runStart; k < r; k += 1) cells.push({ row: k, col: c })
            runsV.push({ cells })
          }
          runStart = r
        }
      }
    }

    const groups: OrbMatchGroup[] = []
    const exactly3H = runsH.filter((run) => run.cells.length === 3)
    const exactly3V = runsV.filter((run) => run.cells.length === 3)
    const consumedH = new Set<number>()
    const consumedV = new Set<number>()

    exactly3H.forEach((hRun, hi) => {
      for (let vi = 0; vi < exactly3V.length; vi += 1) {
        if (consumedV.has(vi)) continue
        const vRun = exactly3V[vi]!
        const sharesJunction = hRun.cells.some((p) => vRun.cells.some((q) => q.row === p.row && q.col === p.col))
        if (sharesJunction) {
          const cells = [...hRun.cells]
          vRun.cells.forEach((q) => {
            if (!cells.some((p) => p.row === q.row && p.col === q.col)) cells.push(q)
          })
          groups.push({ cells, isCorner: true })
          consumedH.add(hi)
          consumedV.add(vi)
          break
        }
      }
    })

    exactly3H.forEach((run, hi) => {
      if (!consumedH.has(hi)) groups.push({ cells: run.cells, isCorner: false })
    })
    exactly3V.forEach((run, vi) => {
      if (!consumedV.has(vi)) groups.push({ cells: run.cells, isCorner: false })
    })
    ;[...runsH, ...runsV].forEach((run) => {
      if (run.cells.length >= 4) groups.push({ cells: run.cells, isCorner: false })
    })

    return groups
  }

  private flattenGroups(groups: OrbMatchGroup[]): OrbPosition[] {
    const seen = new Set<string>()
    const flat: OrbPosition[] = []
    groups.forEach((group) => {
      group.cells.forEach((p) => {
        const key = `${p.row},${p.col}`
        if (seen.has(key)) return
        seen.add(key)
        flat.push(p)
      })
    })
    return flat
  }

  private clearAndRefill(matched: OrbPosition[]) {
    matched.forEach(({ row, col }) => {
      this.setCellAt(row, col, -1)
    })

    for (let c = 0; c < this.cols; c += 1) {
      const survivors: number[] = []
      for (let r = this.rows - 1; r >= 0; r -= 1) {
        const value = this.cellAt(r, c)
        if (value !== -1) survivors.push(value)
      }
      for (let r = this.rows - 1; r >= 0; r -= 1) {
        const idx = this.rows - 1 - r
        this.setCellAt(r, c, idx < survivors.length ? survivors[idx]! : this.randomType())
      }
    }
  }

  private hasAnyValidMove(): boolean {
    for (let r = 0; r < this.rows; r += 1) {
      for (let c = 0; c < this.cols; c += 1) {
        const candidates: OrbPosition[] = [
          { row: r, col: c + 1 },
          { row: r + 1, col: c }
        ]
        for (const b of candidates) {
          if (!this.inBounds(b)) continue
          const a = { row: r, col: c }
          this.swapCells(a, b)
          const found = this.findMatches().length > 0
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

  private createSolvableGrid(): number[][] {
    let grid: number[][]
    do {
      grid = this.createGridWithoutInitialMatches()
      this.grid = grid
    } while (!this.hasAnyValidMove())
    return grid
  }

  private createGridWithoutInitialMatches(): number[][] {
    const grid: number[][] = []
    for (let r = 0; r < this.rows; r += 1) {
      const row: number[] = []
      for (let c = 0; c < this.cols; c += 1) {
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
}
