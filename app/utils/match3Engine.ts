export type Match3Position = { row: number; col: number }

export type Match3Snapshot = {
  grid: number[][]
  score: number
}

export type Match3SwapResult = {
  matched: boolean
  cascadeRounds: number
  gained: number
  reshuffled: boolean
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

/**
 * 三消棋盤共用核心引擎：交換合法性、連鎖消除、掉落補位、無解自動洗牌。
 * 純邏輯、不依賴 Vue，供 match3-rush.vue／match3-classic.vue 各自的薄包裝 engine 共用，
 * 避免兩款遊戲各自複製一份複雜的消除演算法（見 add-match3-games design.md Decision 2）。
 */
export default class Match3CoreEngine {
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

  getSnapshot(): Match3Snapshot {
    return {
      grid: this.grid.map((row) => [...row]),
      score: this.score
    }
  }

  isAdjacent(a: Match3Position, b: Match3Position): boolean {
    return Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1
  }

  trySwap(a: Match3Position, b: Match3Position): Match3SwapResult {
    if (!this.isAdjacent(a, b) || !this.inBounds(a) || !this.inBounds(b)) {
      return { matched: false, cascadeRounds: 0, gained: 0, reshuffled: false }
    }

    this.swapCells(a, b)
    let matches = this.findMatches()
    if (matches.length === 0) {
      this.swapCells(a, b)
      return { matched: false, cascadeRounds: 0, gained: 0, reshuffled: false }
    }

    let round = 0
    let gained = 0
    while (matches.length > 0) {
      round += 1
      const multiplier = 1 + (round - 1) * 0.5
      // 每格基礎分調降為 4（原為 10），讓 SCORE 數字量級更接近 snake/racing，不再明顯偏高
      gained += Math.round(matches.length * 4 * multiplier)
      this.clearAndRefill(matches)
      matches = this.findMatches()
    }
    this.score += gained

    let reshuffled = false
    if (!this.hasAnyValidMove()) {
      this.grid = this.createSolvableGrid()
      reshuffled = true
    }

    return { matched: true, cascadeRounds: round, gained, reshuffled }
  }

  /** 棋盤讀寫的統一入口：呼叫端保證座標在合法範圍內（迴圈邊界／inBounds 已檢查），故用非空斷言集中在這裡 */
  private cellAt(r: number, c: number): number {
    return this.grid[r]![c]!
  }

  private setCellAt(r: number, c: number, value: number) {
    this.grid[r]![c] = value
  }

  private inBounds(p: Match3Position): boolean {
    return p.row >= 0 && p.row < this.size && p.col >= 0 && p.col < this.size
  }

  private swapCells(a: Match3Position, b: Match3Position) {
    const tmp = this.cellAt(a.row, a.col)
    this.setCellAt(a.row, a.col, this.cellAt(b.row, b.col))
    this.setCellAt(b.row, b.col, tmp)
  }

  private findMatches(): Match3Position[] {
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

  private clearAndRefill(matched: Match3Position[]) {
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
        const candidates: Match3Position[] = [
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
