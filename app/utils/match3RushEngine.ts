export type Match3RushPosition = { row: number; col: number }

export type Match3RushSnapshot = {
  grid: number[][]
  score: number
}

export type Match3RushSwapResult = {
  matched: boolean
  cascadeRounds: number
  gained: number
  reshuffled: boolean
  /** 這次交換整條連鎖，各顏色各清除了幾個（跨連鎖輪數累加）。任務機制用它判斷「消除 N 個指定顏色」是否達標。 */
  clearedByColor: Record<number, number>
}

/**
 * 難度隨分數自動升級的門檻，比照 snake/racing/tetriminos 既有的「Lv 隨進度提升」慣例（見 design.md）。
 * 門檻數值配合下方計分公式（每格基礎分 10→4）等比例調降，維持「多久升一次 Lv」的原有節奏不變。
 */
const MATCH3_LEVEL_SCORE_THRESHOLDS = [0, 80, 200, 400, 800]
export const MATCH3_RUSH_MAX_LEVEL = MATCH3_LEVEL_SCORE_THRESHOLDS.length

export function calcMatch3RushLevel(score: number): number {
  let level = 1
  for (let i = 1; i < MATCH3_LEVEL_SCORE_THRESHOLDS.length; i += 1) {
    if (score >= MATCH3_LEVEL_SCORE_THRESHOLDS[i]!) level = i + 1
  }
  return level
}

/** Match3 沒有連續移動的「速度」概念，難度改用寶石種類數表現：種類越多，可消除的組合越難找 */
export function calcMatch3RushTypeCount(level: number): number {
  return Math.min(8, 6 + Math.floor((level - 1) / 2))
}

/**
 * MATCH3 RUSH 專屬核心引擎——刻意跟 `match3Engine.ts`（CLASSIC 與特殊方塊機制共用）完全分開、
 * 不共用任何程式碼。兩邊是完全獨立的兩份遊戲架構：RUSH 走「任務機制」路線，只做最單純的
 * 3 連消，不疊加 Line Bomb／Bomb／Color Bomb；CLASSIC 那份的特殊方塊/Combo 機制留在
 * `match3Engine.ts`，互不影響、互不牽動。
 *
 * 消除演算法本身（交換合法性、連鎖消除、掉落補位、無解自動洗牌）沿用 add-match3-games 時期
 * 的原始版本，唯一新增的是 `clearedByColor`：任務機制（見 match3-rush-task-mode-plan.md）
 * 需要知道「這次連鎖各顏色各清除了幾個」才能判斷任務是否達標，原版完全沒有這個資訊。
 */
export default class Match3RushCoreEngine {
  private grid: number[][] = []
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
    this.grid = this.createSolvableGrid()
  }

  /** 任務達成獎勵分數直接併入引擎本身，而不是只改頁面端的鏡像 state——否則下一次 tick 的 syncState() 會把獎勵覆蓋掉 */
  addScore(amount: number) {
    this.score += amount
  }

  getSnapshot(): Match3RushSnapshot {
    return {
      grid: this.grid.map((row) => [...row]),
      score: this.score
    }
  }

  isAdjacent(a: Match3RushPosition, b: Match3RushPosition): boolean {
    return Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1
  }

  trySwap(a: Match3RushPosition, b: Match3RushPosition): Match3RushSwapResult {
    const EMPTY: Match3RushSwapResult = { matched: false, cascadeRounds: 0, gained: 0, reshuffled: false, clearedByColor: {} }
    if (!this.isAdjacent(a, b) || !this.inBounds(a) || !this.inBounds(b)) return EMPTY

    this.swapCells(a, b)
    let matches = this.findMatches()
    if (matches.length === 0) {
      this.swapCells(a, b)
      return EMPTY
    }

    let round = 0
    let gained = 0
    const clearedByColor: Record<number, number> = {}
    while (matches.length > 0) {
      round += 1
      const multiplier = 1 + (round - 1) * 0.5
      // 每格基礎分調降為 4（原為 10），讓 SCORE 數字量級更接近 snake/racing，不再明顯偏高
      gained += Math.round(matches.length * 4 * multiplier)

      // 顏色要在 clearAndRefill 清空棋盤「之前」讀出，之後格子會被設回 -1 再補新寶石
      matches.forEach(({ row, col }) => {
        const color = this.cellAt(row, col)
        clearedByColor[color] = (clearedByColor[color] ?? 0) + 1
      })

      this.clearAndRefill(matches)
      matches = this.findMatches()
    }
    this.score += gained

    let reshuffled = false
    if (!this.hasAnyValidMove()) {
      this.grid = this.createSolvableGrid()
      reshuffled = true
    }

    return { matched: true, cascadeRounds: round, gained, reshuffled, clearedByColor }
  }

  /** 棋盤讀寫的統一入口：呼叫端保證座標在合法範圍內（迴圈邊界／inBounds 已檢查），故用非空斷言集中在這裡 */
  private cellAt(r: number, c: number): number {
    return this.grid[r]![c]!
  }

  private setCellAt(r: number, c: number, value: number) {
    this.grid[r]![c] = value
  }

  private inBounds(p: Match3RushPosition): boolean {
    return p.row >= 0 && p.row < this.size && p.col >= 0 && p.col < this.size
  }

  private swapCells(a: Match3RushPosition, b: Match3RushPosition) {
    const tmp = this.cellAt(a.row, a.col)
    this.setCellAt(a.row, a.col, this.cellAt(b.row, b.col))
    this.setCellAt(b.row, b.col, tmp)
  }

  private findMatches(): Match3RushPosition[] {
    const matched = new Set<string>()

    for (let r = 0; r < this.size; r += 1) {
      let runStart = 0
      for (let c = 1; c <= this.size; c += 1) {
        const sameAsRunStart = c < this.size && this.cellAt(r, c) === this.cellAt(r, runStart)
        if (!sameAsRunStart) {
          if (c - runStart >= 3) {
            for (let k = runStart; k < c; k += 1) matched.add(`${r},${k}`)
          }
          runStart = c
        }
      }
    }

    for (let c = 0; c < this.size; c += 1) {
      let runStart = 0
      for (let r = 1; r <= this.size; r += 1) {
        const sameAsRunStart = r < this.size && this.cellAt(r, c) === this.cellAt(runStart, c)
        if (!sameAsRunStart) {
          if (r - runStart >= 3) {
            for (let k = runStart; k < r; k += 1) matched.add(`${k},${c}`)
          }
          runStart = r
        }
      }
    }

    return [...matched].map((key) => {
      const [row, col] = key.split(',').map(Number)
      return { row: row!, col: col! }
    })
  }

  private clearAndRefill(matched: Match3RushPosition[]) {
    matched.forEach(({ row, col }) => {
      this.setCellAt(row, col, -1)
    })

    for (let c = 0; c < this.size; c += 1) {
      const survivors: number[] = []
      for (let r = this.size - 1; r >= 0; r -= 1) {
        const value = this.cellAt(r, c)
        if (value !== -1) survivors.push(value)
      }
      for (let r = this.size - 1; r >= 0; r -= 1) {
        const idx = this.size - 1 - r
        this.setCellAt(r, c, idx < survivors.length ? survivors[idx]! : this.randomType())
      }
    }
  }

  private hasAnyValidMove(): boolean {
    for (let r = 0; r < this.size; r += 1) {
      for (let c = 0; c < this.size; c += 1) {
        const candidates: Match3RushPosition[] = [
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
}
