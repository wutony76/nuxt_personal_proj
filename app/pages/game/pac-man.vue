<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useGameHistory } from '~/composables/useGameHistory'

type Status = 'ready' | 'playing' | 'pause' | 'gameover'
type Dir = 'up' | 'down' | 'left' | 'right' | 'none'
type CellType = 'wall' | 'dot' | 'power' | 'empty'
type Pos = { x: number; y: number }
type GhostPersonality = 'chaser' | 'ambusher' | 'flanker' | 'shy'
type GhostMode = 'chase' | 'scatter' | 'frightened' | 'eaten'
type Ghost = {
  id: number
  personality: GhostPersonality
  color: string
  x: number
  y: number
  dir: Dir
  mode: GhostMode
  spawn: Pos
  corner: Pos
}
type StepResult = {
  ateDot: boolean
  atePower: boolean
  ateGhostBonus: number
  hitGhost: boolean
  levelCleared: boolean
  gameOver: boolean
}
type AiTier = 'simple' | 'medium' | 'high'

const ACCENT = '#ff3b3b'
const CELL_SIZE = 16
const COLS = 19
const ROWS = 21
const TUNNEL_ROW = 10
const READY_START = 3

const DIR_DELTA: Record<Exclude<Dir, 'none'>, Pos> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 }
}
const OPPOSITE: Record<Dir, Dir> = { up: 'down', down: 'up', left: 'right', right: 'left', none: 'none' }

const PAC_SPAWN: Pos = { x: 9, y: 17 }
const GHOST_SPAWNS: Pos[] = [
  { x: 8, y: 9 },
  { x: 10, y: 9 },
  { x: 8, y: 11 },
  { x: 10, y: 11 }
]
const GHOST_COLORS = ['#ff3b3b', '#ff9edb', '#66e0ff', '#ffb64d']
const GHOST_PERSONALITIES: GhostPersonality[] = ['chaser', 'ambusher', 'flanker', 'shy']
const HOME_CORNERS: Pos[] = [
  { x: 1, y: 1 },
  { x: COLS - 2, y: 1 },
  { x: 1, y: ROWS - 2 },
  { x: COLS - 2, y: ROWS - 2 }
]

const WALL_PROBABILITY = 0.6

/**
 * 迷宮以「柱狀網格」規則生成（偶數列×偶數欄的內部格為牆候選，穿隧列例外），
 * 每一格牆候選在生成規則上永遠是孤立格（四周皆通道、候選格之間彼此間隔 ≥2 格不相鄰），
 * 因此每一格「要不要放牆」可以獨立擲骰子決定，數學上不可能因為隨機結果而把任何通道切斷
 * ——不需要額外的連通性驗證，這也是選擇柱狀網格而非手繪迷宮的原因。
 * 每次呼叫都會重新擲骰，同一份「候選格骨架」可以隨機出不同的牆面配置（見 design.md Decision 3）。
 */
function buildRandomMaze(): CellType[][] {
  const grid: CellType[][] = []
  for (let y = 0; y < ROWS; y += 1) {
    const row: CellType[] = []
    for (let x = 0; x < COLS; x += 1) {
      const isBorder = y === 0 || y === ROWS - 1 || x === 0 || x === COLS - 1
      const isTunnelMouth = y === TUNNEL_ROW && (x === 0 || x === COLS - 1)
      if (isBorder && !isTunnelMouth) {
        row.push('wall')
        continue
      }
      const isPillarRow = y % 2 === 0 && y !== TUNNEL_ROW && y !== 0 && y !== ROWS - 1
      const isPillarCol = x % 2 === 0 && x !== 0 && x !== COLS - 1
      const isCandidate = isPillarRow && isPillarCol
      row.push(isCandidate && Math.random() < WALL_PROBABILITY ? 'wall' : 'dot')
    }
    grid.push(row)
  }
  HOME_CORNERS.forEach((p) => {
    grid[p.y]![p.x] = 'power'
  })
  ;[PAC_SPAWN, ...GHOST_SPAWNS].forEach((p) => {
    grid[p.y]![p.x] = 'empty'
  })
  return grid
}

type FixedMazeTemplate = { name: string; rows: string[] }

/**
 * 固定樣板迷宮：跟 `buildRandomMaze()` 的程序隨機生成並存，讓「開後台管理固定樣板」這件事
 * 有現成的擴充點——目前專案尚未有後台管理介面（比照既有 coin 兌換三常數的既有慣例，
 * 這類「之後要能在後台調整」的設定先用程式碼內常數頂著），這份陣列之後應改為從 server 端
 * 設定檔／API 讀取，新增/修改樣板時不需要動這裡的邏輯，只需要調整資料本身。
 *
 * 樣板格式（設計上比照未來後台可能用「貼上一段文字」編輯的方式）：
 *   `rows` 是長度 ROWS（21）的字串陣列，每個字串長度需為 COLS（19）；
 *   `#` 代表牆，其餘任何字元一律視為通道（會自動鋪豆子，不需要特別標記）。
 *   邊界（第 0／ROWS-1 列、第 0／COLS-1 欄）必須是牆，唯獨穿隧列（第 TUNNEL_ROW 列）
 *   的最左／最右格必須是通道；大力丸與 Pac-Man／鬼魂出生格由程式自動覆蓋，樣板不需要處理。
 *   每個樣板載入時都會先做連通性驗證（BFS，見 `parseFixedTemplate()`），格式錯誤或
 *   驗證失敗一律安全退回隨機生成並在 console 印警告，不會讓玩家卡在無法過關的壞版面。
 */
const FIXED_MAZE_TEMPLATES: FixedMazeTemplate[] = [
  {
    name: 'classic-01',
    rows: [
      '###################',
      '#.................#',
      '#...#.#...#...#.#.#',
      '#.................#',
      '#.....#.#.....#.#.#',
      '#.................#',
      '#.#.#...#...#.#...#',
      '#.................#',
      '#.#.#...#.#.#...#.#',
      '#.................#',
      '...................',
      '#.................#',
      '#.#.#.#.#...#...#.#',
      '#.................#',
      '#...#.#...........#',
      '#.................#',
      '#.#.#.#...#.#.#.#.#',
      '#.................#',
      '#.......#...#...#.#',
      '#.................#',
      '###################'
    ]
  }
]

/** 從 Pac-Man 出生點對整張迷宮做 BFS，確認每一格通道皆可抵達（不會有被牆困住、吃不到的豆子） */
function isMazeFullyConnected(grid: CellType[][]): boolean {
  const visited = new Set<string>()
  const stack: Pos[] = [{ ...PAC_SPAWN }]
  visited.add(`${PAC_SPAWN.x},${PAC_SPAWN.y}`)
  while (stack.length > 0) {
    const cur = stack.pop()!
    ;(Object.keys(DIR_DELTA) as Array<Exclude<Dir, 'none'>>).forEach((dir) => {
      const delta = DIR_DELTA[dir]
      let nx = cur.x + delta.x
      const ny = cur.y + delta.y
      if (ny === TUNNEL_ROW) {
        if (nx < 0) nx = COLS - 1
        if (nx >= COLS) nx = 0
      }
      if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) return
      if (grid[ny]?.[nx] === 'wall') return
      const key = `${nx},${ny}`
      if (visited.has(key)) return
      visited.add(key)
      stack.push({ x: nx, y: ny })
    })
  }
  let totalFloor = 0
  grid.forEach((row) => row.forEach((c) => {
    if (c !== 'wall') totalFloor += 1
  }))
  return visited.size === totalFloor
}

/** 解析固定樣板：格式或連通性驗證失敗回傳 null，呼叫端需自行退回隨機生成 */
function parseFixedTemplate(template: FixedMazeTemplate): CellType[][] | null {
  const { rows } = template
  if (rows.length !== ROWS) return null
  const grid: CellType[][] = []
  for (let y = 0; y < ROWS; y += 1) {
    const line = rows[y]
    if (!line || line.length !== COLS) return null
    const row: CellType[] = []
    for (let x = 0; x < COLS; x += 1) {
      row.push(line[x] === '#' ? 'wall' : 'dot')
    }
    grid.push(row)
  }
  for (let x = 0; x < COLS; x += 1) {
    if (grid[0]![x] !== 'wall' || grid[ROWS - 1]![x] !== 'wall') return null
  }
  for (let y = 0; y < ROWS; y += 1) {
    const isTunnelMouth = y === TUNNEL_ROW
    const leftIsWall = grid[y]![0] === 'wall'
    const rightIsWall = grid[y]![COLS - 1] === 'wall'
    if (isTunnelMouth ? leftIsWall || rightIsWall : !leftIsWall || !rightIsWall) return null
  }
  HOME_CORNERS.forEach((p) => {
    grid[p.y]![p.x] = 'power'
  })
  ;[PAC_SPAWN, ...GHOST_SPAWNS].forEach((p) => {
    grid[p.y]![p.x] = 'empty'
  })
  return isMazeFullyConnected(grid) ? grid : null
}

/**
 * 混合挑選本關迷宮：把「隨機生成」跟「已設定的固定樣板」放進同一個候選池等機率抽選。
 * 目前 `FIXED_MAZE_TEMPLATES` 只有 1 筆示範資料，之後後台新增更多筆，固定樣板出現的機率
 * 會自然跟著提高，不需要調整這裡的邏輯；固定樣板驗證失敗會自動退回隨機生成。
 */
function pickMaze(): CellType[][] {
  const pool: Array<() => CellType[][] | null> = [
    buildRandomMaze,
    ...FIXED_MAZE_TEMPLATES.map((template) => () => parseFixedTemplate(template))
  ]
  const pick = pool[Math.floor(Math.random() * pool.length)]!
  const result = pick()
  if (!result) {
    console.warn('[pac-man] 固定樣板驗證失敗，已退回隨機生成迷宮')
    return buildRandomMaze()
  }
  return result
}

/**
 * PAC-MAN 引擎：非 UI 狀態，每個 tick 呼叫一次 step()，玩家與 4 隻鬼各移動最多 1 格。
 * 鬼魂 AI 難度依「目前關卡」分三層（見 openspec/changes/add-pacman-game/design.md）：
 *   Lv1–2 簡化：4 隻鬼共用「直接朝 Pac-Man 貪心 + 路口隨機」。
 *   Lv3–4 中等：4 隻鬼各自套用固定性格（chaser／ambusher／flanker／shy），不含 scatter/chase 交替。
 *   Lv5+  高擬真：同一批性格 + scatter⇄chase 交替計時器；Lv5 以後只再加快速度，AI 邏輯不再加深。
 * 驚嚇模式（吃大力丸）不分關卡層級，統一套用。
 */
class PacManEngine {
  maze: CellType[][] = []
  dotsRemaining = 0
  pac: Pos = { ...PAC_SPAWN }
  pacDir: Dir = 'left'
  pacNextDir: Dir = 'none'
  ghosts: Ghost[] = []
  level = 1
  score = 0
  lives = 3
  private frightenedTicksLeft = 0
  private eatChainIndex = 0
  private scatterTicksLeft = 0
  private isScatterPhase = true
  private tickCount = 0

  reset(startLevel = 1) {
    this.level = startLevel
    this.score = 0
    this.lives = 3
    this.setupLevel()
  }

  setupLevel() {
    this.maze = pickMaze()
    this.dotsRemaining = this.maze.reduce(
      (sum, row) => sum + row.filter((c) => c === 'dot' || c === 'power').length,
      0
    )
    this.resetPositions()
    this.frightenedTicksLeft = 0
    this.eatChainIndex = 0
    this.isScatterPhase = true
    this.scatterTicksLeft = this.aiTier() === 'high' ? Math.round(7000 / this.getTickSpeed()) : 0
    this.tickCount = 0
  }

  private resetPositions() {
    this.pac = { ...PAC_SPAWN }
    this.pacDir = 'left'
    this.pacNextDir = 'none'
    this.ghosts = GHOST_SPAWNS.map((s, i) => ({
      id: i,
      personality: GHOST_PERSONALITIES[i]!,
      color: GHOST_COLORS[i]!,
      x: s.x,
      y: s.y,
      dir: 'up' as Dir,
      mode: 'chase' as GhostMode,
      spawn: { ...s },
      corner: HOME_CORNERS[i]!
    }))
  }

  aiTier(): AiTier {
    if (this.level <= 2) return 'simple'
    if (this.level <= 4) return 'medium'
    return 'high'
  }

  getTickSpeed(): number {
    return Math.max(90, 180 - (this.level - 1) * 8)
  }

  /**
   * 按下方向鍵時，如果 Pac-Man 目前所在格子就能直接往新方向走（已經站在路口），
   * 立刻套用轉彎；回傳 true 讓呼叫端（頁面層）知道這是一次「當下就生效」的轉彎，
   * 可以把原本排定的下一個 tick 提前觸發（見頁面層 click.dir），畫面才會立刻反映
   * 轉彎，不用等到原本那個 tick 的剩餘時間跑完、還多衝一格才轉。
   * 若目前位置還不能轉（尚未走到路口），就維持原本的緩衝機制，等 movePac()
   * 每個 tick 檢查一次，走到路口時自動轉彎；只是把「下一步」提前對齊到輸入的當下，
   * 不是額外多走一步，長期平均的移動速度／tick 間隔完全不變。
   */
  setDirection(dir: Dir): boolean {
    this.pacNextDir = dir
    const attempt = this.tryMoveFrom(this.pac, dir)
    if (attempt) {
      this.pacDir = dir
      this.pacNextDir = 'none'
      return true
    }
    return false
  }

  private tryMoveFrom(pos: Pos, dir: Dir): Pos | null {
    if (dir === 'none') return null
    const delta = DIR_DELTA[dir]
    let nx = pos.x + delta.x
    const ny = pos.y + delta.y
    if (ny === TUNNEL_ROW) nx = this.wrapX(nx)
    if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) return null
    if (this.isWall(nx, ny)) return null
    return { x: nx, y: ny }
  }

  private isWall(x: number, y: number): boolean {
    return this.maze[y]?.[x] === 'wall'
  }

  private wrapX(x: number): number {
    if (x < 0) return COLS - 1
    if (x >= COLS) return 0
    return x
  }

  private neighborsOpen(pos: Pos, excludeDir: Dir): Array<{ dir: Dir; pos: Pos }> {
    const reverse = OPPOSITE[excludeDir]
    const collect = (allowReverse: boolean) => {
      const result: Array<{ dir: Dir; pos: Pos }> = []
      ;(Object.keys(DIR_DELTA) as Array<Exclude<Dir, 'none'>>).forEach((dir) => {
        if (!allowReverse && dir === reverse) return
        const delta = DIR_DELTA[dir]
        let nx = pos.x + delta.x
        const ny = pos.y + delta.y
        if (ny === TUNNEL_ROW) nx = this.wrapX(nx)
        if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) return
        if (this.isWall(nx, ny)) return
        result.push({ dir, pos: { x: nx, y: ny } })
      })
      return result
    }
    const options = collect(false)
    return options.length > 0 ? options : collect(true)
  }

  private movePac(): { ateDot: boolean; atePower: boolean } {
    if (this.pacNextDir !== 'none') {
      const attempt = this.tryMoveFrom(this.pac, this.pacNextDir)
      if (attempt) {
        this.pacDir = this.pacNextDir
        this.pacNextDir = 'none'
      }
    }

    const moved = this.tryMoveFrom(this.pac, this.pacDir)
    if (!moved) return { ateDot: false, atePower: false }
    this.pac = moved

    const cell = this.maze[moved.y]![moved.x]
    if (cell === 'dot') {
      this.maze[moved.y]![moved.x] = 'empty'
      this.score += 10
      this.dotsRemaining -= 1
      return { ateDot: true, atePower: false }
    }
    if (cell === 'power') {
      this.maze[moved.y]![moved.x] = 'empty'
      this.score += 50
      this.dotsRemaining -= 1
      this.triggerFrightened()
      return { ateDot: false, atePower: true }
    }
    return { ateDot: false, atePower: false }
  }

  private triggerFrightened() {
    this.eatChainIndex = 0
    const durationMs = Math.max(2000, 6000 - (this.level - 1) * 300)
    this.frightenedTicksLeft = Math.round(durationMs / this.getTickSpeed())
    this.ghosts.forEach((g) => {
      if (g.mode !== 'eaten') g.mode = 'frightened'
    })
  }

  private ghostTarget(g: Ghost): Pos {
    if (g.mode === 'eaten') return g.spawn
    if (g.mode === 'frightened') return this.pac
    const tier = this.aiTier()
    if (tier === 'simple') return { ...this.pac }
    if (g.mode === 'scatter') return g.corner

    const facing = this.pacDir === 'none' ? 'left' : this.pacDir
    const delta = DIR_DELTA[facing]
    if (g.personality === 'chaser') return { ...this.pac }
    if (g.personality === 'ambusher') {
      return { x: this.pac.x + delta.x * 4, y: this.pac.y + delta.y * 4 }
    }
    if (g.personality === 'flanker') {
      const blinky = this.ghosts[0] ?? g
      const ahead = { x: this.pac.x + delta.x * 2, y: this.pac.y + delta.y * 2 }
      return { x: ahead.x * 2 - blinky.x, y: ahead.y * 2 - blinky.y }
    }
    // shy：離太近就退回自己的角落，拉開距離才會追
    const dist = Math.abs(this.pac.x - g.x) + Math.abs(this.pac.y - g.y)
    return dist > 8 ? { ...this.pac } : g.corner
  }

  private moveGhost(g: Ghost) {
    const options = this.neighborsOpen({ x: g.x, y: g.y }, g.dir)
    if (options.length === 0) return
    const target = this.ghostTarget(g)
    const flee = g.mode === 'frightened'
    const tier = this.aiTier()

    let chosen = options[0]!
    if (tier === 'simple' && Math.random() < 0.25) {
      chosen = options[Math.floor(Math.random() * options.length)]!
    } else {
      let bestDist = flee ? -Infinity : Infinity
      options.forEach((opt) => {
        const d = Math.abs(opt.pos.x - target.x) + Math.abs(opt.pos.y - target.y)
        if ((flee && d > bestDist) || (!flee && d < bestDist)) {
          bestDist = d
          chosen = opt
        }
      })
    }

    g.dir = chosen.dir
    g.x = chosen.pos.x
    g.y = chosen.pos.y
    if (g.mode === 'eaten' && g.x === g.spawn.x && g.y === g.spawn.y) {
      g.mode = this.isScatterPhase && tier === 'high' ? 'scatter' : 'chase'
    }
  }

  step(): StepResult {
    this.tickCount += 1
    const pacResult = this.movePac()
    const tier = this.aiTier()

    if (tier === 'high') {
      this.scatterTicksLeft -= 1
      if (this.scatterTicksLeft <= 0) {
        this.isScatterPhase = !this.isScatterPhase
        this.scatterTicksLeft = Math.round((this.isScatterPhase ? 7000 : 20000) / this.getTickSpeed())
        this.ghosts.forEach((g) => {
          if (g.mode === 'chase' || g.mode === 'scatter') g.mode = this.isScatterPhase ? 'scatter' : 'chase'
        })
      }
    }

    if (this.frightenedTicksLeft > 0) {
      this.frightenedTicksLeft -= 1
      if (this.frightenedTicksLeft === 0) {
        this.ghosts.forEach((g) => {
          if (g.mode === 'frightened') g.mode = this.isScatterPhase && tier === 'high' ? 'scatter' : 'chase'
        })
      }
    }

    const ghostMoveEveryTicks = tier === 'simple' ? 2 : 1
    if (this.tickCount % ghostMoveEveryTicks === 0) {
      this.ghosts.forEach((g) => this.moveGhost(g))
    }

    let hitGhost = false
    let ateGhostBonus = 0
    const chainScores = [200, 400, 800, 1600]
    this.ghosts.forEach((g) => {
      if (g.x !== this.pac.x || g.y !== this.pac.y) return
      if (g.mode === 'frightened') {
        const bonus = chainScores[Math.min(this.eatChainIndex, chainScores.length - 1)]!
        this.score += bonus
        ateGhostBonus += bonus
        this.eatChainIndex += 1
        g.mode = 'eaten'
      } else if (g.mode !== 'eaten') {
        hitGhost = true
      }
    })

    if (hitGhost) {
      this.lives -= 1
      if (this.lives > 0) this.resetPositions()
    }

    const levelCleared = this.dotsRemaining <= 0
    if (levelCleared) {
      this.level += 1
      this.setupLevel()
    }

    return {
      ateDot: pacResult.ateDot,
      atePower: pacResult.atePower,
      ateGhostBonus,
      hitGhost,
      levelCleared,
      gameOver: this.lives <= 0
    }
  }

  getSnapshot() {
    return {
      maze: this.maze,
      pac: { ...this.pac },
      pacDir: this.pacDir,
      ghosts: this.ghosts.map((g) => ({ ...g })),
      score: this.score,
      lives: this.lives,
      level: this.level
    }
  }
}

const router = useRouter()
const engine = new PacManEngine()
const gameHistory = useGameHistory()

const state = reactive({
  status: 'ready' as Status,
  score: 0,
  lives: 3,
  level: 1,
  maze: [] as CellType[][],
  pac: { ...PAC_SPAWN } as Pos,
  pacDir: 'left' as Dir,
  ghosts: [] as Ghost[],
  message: '點「開始」遊玩，使用方向鍵控制小精靈吃豆並閃避鬼魂。',
  rewardMessage: '',
  levelToast: '',
  levelToastVisible: false,
  hitFlashActive: false,
  powerFlashActive: false,
  waitingOverlayVisible: true,
  readyOverlayVisible: false,
  readyCountdownValue: READY_START,
  resultOverlayVisible: false,
  rateDialogOpen: false,
  ruleDialogOpen: false
})

const PACMAN_RULE = {
  description:
    '使用方向鍵控制小精靈在迷宮中移動吃豆，可隨時改變方向；碰到未受驚嚇的鬼魂會失去一命，命數歸零遊戲結束。' +
    '吃到大力丸後所有鬼魂會短暫進入驚嚇（逃跑）狀態，此時可以反過來吃掉鬼魂拿額外分數；吃光整張迷宮的豆子與大力丸即可過關，進入下一關（分數與命數會延續，不會重置）。',
  scoreRule:
    '豆子 +10 分、大力丸 +50 分；驚嚇模式下連續吃鬼分數倍增（200／400／800／1600，吃到下一顆大力丸會重置倍率）。' +
    '分數會跨關卡累加、沒有關卡數上限，是開放式計分（越玩越高分）。',
  levels: [
    { level: 'Lv.1–2', condition: '簡化版：4 隻鬼共用「直接朝你貪心 + 路口隨機」，速度最慢' },
    { level: 'Lv.3–4', condition: '中等：4 隻鬼各自固定性格（直追／預判包抄／側翼夾擊／怕生），速度提升' },
    { level: 'Lv.5+', condition: '高擬真：同上性格 + 巡邏／追擊交替切換，之後只再加快速度、AI 不再變複雜' }
  ],
  levelsTitle: '難度曲線',
  note: '穿隧通道位於迷宮左右兩側正中間，可從一側走出、從另一側繞回來。'
}

let loopTimer: ReturnType<typeof setTimeout> | null = null
let readyTimer: ReturnType<typeof setInterval> | null = null
let levelToastTimer: ReturnType<typeof setTimeout> | null = null
let hitEffectTimer: ReturnType<typeof setTimeout> | null = null
let powerEffectTimer: ReturnType<typeof setTimeout> | null = null

const statusText = computed(() => {
  if (state.status === 'playing') return 'PLAYING'
  if (state.status === 'pause') return 'PAUSE'
  if (state.status === 'gameover') return 'GAME OVER'
  return 'READY'
})
const statusClass = computed(() => {
  if (state.status === 'playing') return 'is-playing'
  if (state.status === 'pause') return 'is-pause'
  if (state.status === 'gameover') return 'is-gameover'
  return 'is-ready'
})
const canResumeFromPause = computed(
  () =>
    state.status === 'pause' &&
    !state.waitingOverlayVisible &&
    !state.readyOverlayVisible &&
    !state.resultOverlayVisible
)
const canPauseWhilePlaying = computed(() => state.status === 'playing')
const stageStyle = computed(() => ({ width: `${COLS * CELL_SIZE}px`, height: `${ROWS * CELL_SIZE}px` }))
const mazeStyle = computed(() => ({
  gridTemplateColumns: `repeat(${COLS}, ${CELL_SIZE}px)`,
  gridTemplateRows: `repeat(${ROWS}, ${CELL_SIZE}px)`
}))
const flatMazeCells = computed(() => {
  const out: Array<{ x: number; y: number; type: CellType }> = []
  state.maze.forEach((row, y) => row.forEach((type, x) => out.push({ x, y, type })))
  return out
})

/** 私有工具方法：計時器管理、狀態同步、格位樣式 */
const _handlers = {
  syncState: (fullMazeSync: boolean) => {
    const snap = engine.getSnapshot()
    if (fullMazeSync) state.maze = snap.maze.map((row) => [...row])
    state.pac = snap.pac
    state.pacDir = snap.pacDir
    state.ghosts = snap.ghosts
    state.score = snap.score
    state.lives = snap.lives
    state.level = snap.level
  },
  stopLoopTimer: () => {
    if (loopTimer) {
      clearTimeout(loopTimer)
      loopTimer = null
    }
  },
  stopReadyTimer: () => {
    if (readyTimer) {
      clearInterval(readyTimer)
      readyTimer = null
    }
  },
  spriteStyle: (p: Pos) => ({
    width: `${CELL_SIZE}px`,
    height: `${CELL_SIZE}px`,
    transform: `translate(${p.x * CELL_SIZE}px, ${p.y * CELL_SIZE}px)`
  }),
  ghostClass: (g: Ghost) => {
    if (g.mode === 'frightened') return 'is-frightened'
    if (g.mode === 'eaten') return 'is-eaten'
    return ''
  },
  flashLevelToast: (text: string) => {
    if (levelToastTimer) clearTimeout(levelToastTimer)
    state.levelToast = text
    state.levelToastVisible = true
    levelToastTimer = setTimeout(() => {
      state.levelToastVisible = false
      levelToastTimer = null
    }, 1200)
  },
  triggerHitEffect: () => {
    if (hitEffectTimer) clearTimeout(hitEffectTimer)
    state.hitFlashActive = true
    hitEffectTimer = setTimeout(() => {
      state.hitFlashActive = false
      hitEffectTimer = null
    }, 260)
  },
  triggerPowerEffect: () => {
    if (powerEffectTimer) clearTimeout(powerEffectTimer)
    state.powerFlashActive = true
    powerEffectTimer = setTimeout(() => {
      state.powerFlashActive = false
      powerEffectTimer = null
    }, 260)
  }
}

const _actions = {
  /** 單局明確結束（命數歸零）時寫入遊戲紀錄；已登入且有 coin 獎勵時附上提示文字 */
  recordHistory: async () => {
    state.rewardMessage = ''
    try {
      const result = await gameHistory.actions.record('pacman', 'PAC-MAN', {
        score: state.score,
        level: state.level
      })
      if (result.coinReward > 0) {
        state.rewardMessage = result.coinCapped ? `+${result.coinReward} coin（已達今日上限）` : `+${result.coinReward} coin`
      }
    } catch {
      // 紀錄寫入失敗不影響遊戲本身，靜默略過
    }
  },
  finishGame: () => {
    _handlers.stopLoopTimer()
    state.status = 'gameover'
    state.message = `GAME OVER，最終停在第 ${state.level} 關。`
    state.resultOverlayVisible = true
    _actions.recordHistory()
  },
  stepLoop: () => {
    if (state.status !== 'playing') return
    const result = engine.step()
    _handlers.syncState(result.ateDot || result.atePower || result.levelCleared)
    if (result.atePower) _handlers.triggerPowerEffect()
    if (result.hitGhost) _handlers.triggerHitEffect()
    if (result.levelCleared && !result.gameOver) _handlers.flashLevelToast(`LEVEL ${state.level} START`)
    if (result.gameOver) {
      _actions.finishGame()
      return
    }
    loopTimer = setTimeout(_actions.stepLoop, engine.getTickSpeed())
  },
  resetGame: () => {
    _handlers.stopLoopTimer()
    _handlers.stopReadyTimer()
    if (levelToastTimer) {
      clearTimeout(levelToastTimer)
      levelToastTimer = null
    }
    engine.reset(1)
    _handlers.syncState(true)
    state.status = 'ready'
    state.waitingOverlayVisible = true
    state.resultOverlayVisible = false
    state.readyOverlayVisible = false
    state.levelToastVisible = false
    state.hitFlashActive = false
    state.powerFlashActive = false
    state.rewardMessage = ''
    state.message = '點「開始」遊玩，使用方向鍵控制小精靈吃豆並閃避鬼魂。'
  },
  runReadyCountdown: (onDone: () => void) => {
    _handlers.stopReadyTimer()
    state.readyOverlayVisible = true
    state.readyCountdownValue = READY_START
    readyTimer = setInterval(() => {
      if (state.readyCountdownValue <= 1) {
        _handlers.stopReadyTimer()
        state.readyOverlayVisible = false
        onDone()
        return
      }
      state.readyCountdownValue -= 1
    }, 700)
  },
  startGame: () => {
    if (state.status === 'playing' || state.readyOverlayVisible) return
    if (state.status === 'gameover') _actions.resetGame()
    state.waitingOverlayVisible = false
    state.resultOverlayVisible = false
    _actions.runReadyCountdown(() => {
      state.status = 'playing'
      state.message = '遊戲進行中...'
      _handlers.stopLoopTimer()
      loopTimer = setTimeout(_actions.stepLoop, engine.getTickSpeed())
    })
  },
  pauseGame: () => {
    if (state.status !== 'playing') return
    state.status = 'pause'
    state.message = '已暫停'
    _handlers.stopLoopTimer()
    _handlers.stopReadyTimer()
  },
  resumeGame: () => {
    if (!canResumeFromPause.value) return
    state.status = 'playing'
    state.message = '遊戲進行中...'
    _handlers.stopLoopTimer()
    loopTimer = setTimeout(_actions.stepLoop, engine.getTickSpeed())
  },
  playAgain: () => {
    _actions.resetGame()
    _actions.startGame()
  },
  endGameNow: () => {
    _handlers.stopLoopTimer()
    _handlers.stopReadyTimer()
    state.waitingOverlayVisible = false
    state.readyOverlayVisible = false
    state.status = 'gameover'
    state.message = '本局已結束。'
    state.resultOverlayVisible = true
    _actions.recordHistory()
  }
}

const click = {
  /**
   * 若這次按方向鍵當下就成功轉彎（engine.setDirection 回傳 true），代表玩家已經站
   * 在路口——把原本排定、還沒到時間的下一個 tick 提前觸發，讓畫面立刻反映新方向，
   * 不用乾等那個 tick 剩餘的時間跑完（那段等待期間視覺上就是「還在往舊方向衝」）。
   * stepLoop() 結束時一樣會用 engine.getTickSpeed() 重新排下一步，長期平均的
   * tick 間隔不變，這裡只是把「下一步」的時機對齊到輸入當下，不是多走一步。
   */
  dir: (d: Exclude<Dir, 'none'>) => {
    const turnedNow = engine.setDirection(d)
    if (turnedNow && state.status === 'playing') {
      _handlers.stopLoopTimer()
      _actions.stepLoop()
    }
  },
  start: () => _actions.startGame(),
  pause: () => _actions.pauseGame(),
  resume: () => _actions.resumeGame(),
  replay: () => _actions.resetGame(),
  end: () => _actions.endGameNow(),
  again: () => _actions.playAgain(),
  exit: () => router.replace('/game-hall'),
  openRateDialog: () => {
    state.rateDialogOpen = true
  },
  closeRateDialog: () => {
    state.rateDialogOpen = false
  },
  openRuleDialog: () => {
    state.ruleDialogOpen = true
  },
  closeRuleDialog: () => {
    state.ruleDialogOpen = false
  }
}

const onKeydown = (event: KeyboardEvent) => {
  if (state.waitingOverlayVisible || state.readyOverlayVisible || state.resultOverlayVisible) return
  const key = event.key.toLowerCase()
  let handled = false
  if (key === 'arrowup' || key === 'w') {
    click.dir('up')
    handled = true
  }
  if (key === 'arrowdown' || key === 's') {
    click.dir('down')
    handled = true
  }
  if (key === 'arrowleft' || key === 'a') {
    click.dir('left')
    handled = true
  }
  if (key === 'arrowright' || key === 'd') {
    click.dir('right')
    handled = true
  }
  if (handled) event.preventDefault()
}

onMounted(() => {
  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', onKeydown)
  }
  _actions.resetGame()
})

onBeforeUnmount(() => {
  _handlers.stopLoopTimer()
  _handlers.stopReadyTimer()
  if (levelToastTimer) clearTimeout(levelToastTimer)
  if (hitEffectTimer) clearTimeout(hitEffectTimer)
  if (powerEffectTimer) clearTimeout(powerEffectTimer)
  if (typeof window !== 'undefined') {
    window.removeEventListener('keydown', onKeydown)
  }
})
</script>

<template>
  <main class="pm-page" :class="`state-${state.status}`">
    <div class="pm-overlay" />
    <div v-if="state.waitingOverlayVisible" class="game-mask waiting-mask">
      <div class="mask-title">WELCOME</div>
      <p class="waiting-subtitle">PAC-MAN</p>
      <p class="waiting-hint">吃光迷宮豆子過關 · 大力丸可反殺鬼魂 · 難度隨關卡遞增</p>
      <button class="pm-btn waiting-btn waiting-start" type="button" @click="click.start">START</button>
      <button class="pm-btn link waiting-btn" type="button" @click="click.openRateDialog">CONVERT</button>
      <button class="pm-btn link waiting-btn" type="button" @click="click.openRuleDialog">RULE</button>
    </div>
    <div v-if="state.readyOverlayVisible" class="game-mask ready-mask">
      <div class="mask-title">READY</div>
      <div class="mask-count">{{ state.readyCountdownValue }}</div>
    </div>
    <div v-if="state.resultOverlayVisible" class="game-mask result-mask">
      <div class="mask-title">RESULT</div>
      <div class="result-list">
        <div class="result-item"><span>SCORE</span><b>{{ state.score }}</b></div>
        <div class="result-item"><span>止步於</span><b>第 {{ state.level }} 關</b></div>
      </div>
      <p v-if="state.rewardMessage" class="result-reward">{{ state.rewardMessage }}</p>
      <div class="result-actions">
        <button class="pm-btn" type="button" @click="click.again">AGAIN</button>
        <button class="pm-btn danger" type="button" @click="click.exit">EXIT</button>
      </div>
    </div>

    <GameRateDialog :visible="state.rateDialogOpen" game-key="pacman" game-name="PAC-MAN" :accent-color="ACCENT"
      @close="click.closeRateDialog" />
    <GameRuleDialog :visible="state.ruleDialogOpen" game-name="PAC-MAN" :accent-color="ACCENT" v-bind="PACMAN_RULE"
      @close="click.closeRuleDialog" />

    <section class="pm-shell">
      <aside class="pm-side left">
        <button class="pm-btn" type="button" :disabled="!canResumeFromPause" @click="click.resume">START</button>
        <button class="pm-btn" type="button" :disabled="!canPauseWhilePlaying" @click="click.pause">PAUSE</button>
        <button class="pm-btn" type="button" @click="click.replay">REPLAY</button>
        <button class="pm-btn link" type="button" @click="click.end">END</button>
        <button class="pm-btn" type="button" @click="click.openRateDialog">CONVERT</button>
        <button class="pm-btn" type="button" @click="click.openRuleDialog">RULE</button>
      </aside>

      <section class="pm-center">
        <header class="pm-title-wrap">
          <h1 class="pm-title">PAC-MAN</h1>
          <p class="pm-status" :class="statusClass">{{ statusText }}</p>
        </header>

        <div class="pm-frame">
          <div class="pm-stage" :class="{ 'hit-flash': state.hitFlashActive, 'power-flash': state.powerFlashActive }"
            :style="stageStyle">
            <div class="pm-maze" :style="mazeStyle">
              <div v-for="cell in flatMazeCells" :key="`${cell.x}-${cell.y}`" class="pm-cell" :class="`is-${cell.type}`" />
            </div>
            <div class="pm-pac" :style="_handlers.spriteStyle(state.pac)">
              <div class="pm-pac-mouth" :class="`face-${state.pacDir}`" />
            </div>
            <div v-for="g in state.ghosts" :key="g.id" class="pm-ghost" :class="_handlers.ghostClass(g)"
              :style="{ ..._handlers.spriteStyle({ x: g.x, y: g.y }), '--ghost-color': g.color }" />
            <div v-if="state.levelToastVisible" class="pm-level-toast">{{ state.levelToast }}</div>
            <div v-if="state.status === 'pause'" class="pm-board-veil">PAUSED</div>
          </div>
          <div class="pm-panel">
            <span>SCORE: {{ state.score }}</span>
            <span>LIVES: {{ state.lives }}</span>
            <span>LEVEL: {{ state.level }}</span>
          </div>
        </div>

        <p class="pm-message">{{ state.message }}</p>
      </section>

      <aside class="pm-side right">
        <div class="pm-keypad">
          <button class="pm-btn key up" type="button" @click="click.dir('up')">↑</button>
          <button class="pm-btn key left" type="button" @click="click.dir('left')">←</button>
          <button class="pm-btn key down" type="button" @click="click.dir('down')">↓</button>
          <button class="pm-btn key right" type="button" @click="click.dir('right')">→</button>
        </div>
        <div class="pm-help">W A S D / Arrow Keys</div>
      </aside>
    </section>
  </main>
</template>

<style scoped lang="scss">
.pm-page {
  position: relative;
  min-height: 100vh;
  display: grid;
  place-items: center;
  background: radial-gradient(circle at top, #1a0606, #050101 60%);
  overflow: hidden;
  isolation: isolate;

  &::before,
  &::after {
    content: '';
    position: absolute;
    inset: -20%;
    pointer-events: none;
    z-index: 0;
  }

  &::before {
    background: radial-gradient(circle at 20% 20%, rgba(255, 59, 59, 0.18), transparent 45%),
      radial-gradient(circle at 80% 70%, rgba(255, 214, 77, 0.1), transparent 40%);
    filter: blur(40px);
    animation: ambient-drift 12s ease-in-out infinite alternate;
  }

  &::after {
    background: linear-gradient(115deg, rgba(255, 59, 59, 0.05), rgba(0, 0, 0, 0));
    animation: ambient-pulse 4.6s ease-in-out infinite;
  }

  .pm-overlay {
    position: absolute;
    inset: 0;
    background-image: linear-gradient(rgba(255, 59, 59, 0.05) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255, 59, 59, 0.05) 1px, transparent 1px);
    background-size: 28px 28px;
    pointer-events: none;
    z-index: 0;
    animation: grid-drift 14s linear infinite;
  }

  .game-mask {
    position: absolute;
    inset: 0;
    z-index: 4;
    background: rgba(0, 0, 0, 0.78);
    display: grid;
    place-items: center;
    align-content: center;
    gap: 12px;

    .mask-title {
      color: #ff5c5c;
      font-size: clamp(2rem, 8vw, 4rem);
      letter-spacing: 0.25rem;
      font-weight: 900;
    }

    .mask-count {
      color: #ff5c5c;
      font-size: clamp(3rem, 12vw, 7rem);
      font-weight: 900;
      line-height: 1;
    }

    &.waiting-mask {
      background: rgba(0, 0, 0, 0.88);

      .waiting-subtitle {
        margin: 0;
        color: #ffd44d;
        letter-spacing: 0.3rem;
        font-size: 0.95rem;
      }

      .waiting-hint {
        margin: 0;
        max-width: 320px;
        text-align: center;
        color: #ffb0b0;
        font-size: 0.72rem;
        letter-spacing: 0.04rem;
        line-height: 1.6;
      }

      .waiting-btn {
        width: 160px;
      }
    }

    &.result-mask {
      .result-list {
        display: grid;
        gap: 6px;
        min-width: 220px;
      }

      .result-item {
        display: flex;
        justify-content: space-between;
        font-size: 0.85rem;
        color: #ffd0d0;
        letter-spacing: 0.08rem;

        b {
          color: #fff;
          font-size: 1rem;
        }
      }

      .result-reward {
        margin: 0;
        color: #ffd44d;
        font-size: 0.8rem;
        letter-spacing: 0.06rem;
      }

      .result-actions {
        display: flex;
        gap: 10px;
        margin-top: 4px;
      }
    }
  }

  .pm-btn {
    height: 34px;
    padding: 0 16px;
    font-size: 0.72rem;
    letter-spacing: 0.14rem;
    font-weight: 700;
    color: #1a0000;
    background: #ff5c5c;
    border: none;
    cursor: pointer;
    clip-path: polygon(8px 0, 100% 0, calc(100% - 8px) 100%, 0 100%);
    transition: transform 0.1s, box-shadow 0.15s, opacity 0.15s;
    box-shadow: 0 0 12px rgba(255, 92, 92, 0.4);

    &:hover:not(:disabled) {
      box-shadow: 0 0 20px rgba(255, 92, 92, 0.7);
    }

    &:active:not(:disabled) {
      transform: translateY(1px) scale(0.98);
    }

    &:disabled {
      opacity: 0.35;
      cursor: not-allowed;
      box-shadow: none;
    }

    &.link {
      background: none;
      color: #ff8a8a;
      border: 1px solid rgba(255, 92, 92, 0.4);
      box-shadow: none;
      clip-path: none;
    }

    &.danger {
      background: #ff2e2e;
    }
  }

  .pm-shell {
    position: relative;
    z-index: 1;
    display: grid;
    grid-template-columns: 160px 1fr 160px;
    gap: 24px;
    align-items: center;
    padding: 24px;
  }

  .pm-side {
    display: flex;
    flex-direction: column;
    gap: 10px;

    &.right {
      align-items: center;
    }
  }

  .pm-center {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }

  .pm-title-wrap {
    text-align: center;

    .pm-title {
      margin: 0;
      font-size: 1.6rem;
      letter-spacing: 0.3rem;
      font-weight: 900;
      color: #ffd44d;
      text-shadow: 0 0 14px rgba(255, 212, 77, 0.6);
    }

    .pm-status {
      margin: 4px 0 0;
      font-size: 0.7rem;
      letter-spacing: 0.2rem;
      color: #ff8a8a;

      &.is-playing {
        color: #7dffb0;
      }

      &.is-pause {
        color: #ffd44d;
      }

      &.is-gameover {
        color: #ff5c5c;
      }
    }
  }

  .pm-frame {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
  }

  .pm-stage {
    position: relative;
    background: #0a0505;
    border: 2px solid #ff5c5c;
    box-shadow: 0 0 24px rgba(255, 92, 92, 0.35);
    transition: box-shadow 0.15s;

    &.hit-flash {
      box-shadow: 0 0 40px rgba(255, 20, 20, 0.9);
    }

    &.power-flash {
      box-shadow: 0 0 40px rgba(255, 212, 77, 0.85);
    }
  }

  .pm-maze {
    display: grid;
    position: relative;
  }

  .pm-cell {
    position: relative;

    &.is-wall {
      background: rgba(255, 92, 92, 0.16);
      box-shadow: inset 0 0 0 1px rgba(255, 92, 92, 0.3);
    }

    &.is-dot::after {
      content: '';
      position: absolute;
      inset: 0;
      margin: auto;
      width: 3px;
      height: 3px;
      border-radius: 50%;
      background: #ffe9b3;
    }

    &.is-power::after {
      content: '';
      position: absolute;
      inset: 0;
      margin: auto;
      width: 9px;
      height: 9px;
      border-radius: 50%;
      background: #ffe9b3;
      box-shadow: 0 0 8px rgba(255, 233, 179, 0.9);
      animation: power-pulse 0.7s ease-in-out infinite;
    }
  }

  .pm-pac,
  .pm-ghost {
    position: absolute;
    top: 0;
    left: 0;
    transition: transform 0.08s linear;
  }

  /*
   * 之前直接在 .pm-pac 本體上用「circle 疊 clip-path 挖嘴巴」的多邊形，結果實測發現：
   * 同一份 clip-path 多邊形套用在「小尺寸（16px）+ 有 translate transform」的元素上，
   * 挖出來的嘴巴方向會整個反過來，但同一份多邊形套在大尺寸或沒有 translate 的元素上
   * 卻是正確的（懷疑是這個瀏覽器版本在小尺寸+transform 疊加時，clip-path 百分比座標的
   * 呈現有問題，沒有再深究根本原因）。為了不繼續踩這個不穩定的組合，改成更單純可靠的做法：
   * .pm-pac 本體維持一顆單純的圓形（不再對本體本身套用 clip-path），嘴巴改成內層獨立的
   * .pm-pac-mouth 疊圖，用純三角形 clip-path（不跟 border-radius 疊加）、背景色比照迷宮
   * 底色（蓋住黃色圓形製造「缺一角」的錯覺），並靠父層 overflow:hidden＋border-radius
   * 把三角形裁成跟圓形本體切齊——整套改動後已重新用 Playwright 截圖驗證四個方向皆正確。
   */
  .pm-pac {
    /* position:absolute 已由上面 .pm-pac, .pm-ghost 共用規則設定，這裡沿用即可，
       它同時也讓 .pm-pac 成為 .pm-pac-mouth（position:absolute;inset:0）的定位基準，
       不需要再另外宣告 position，避免跟共用規則衝突覆蓋掉 top/left 的預期效果 */
    overflow: hidden;
    border-radius: 50%;
    background: #ffd400;
    box-shadow: 0 0 8px rgba(255, 212, 0, 0.7);
  }

  .pm-pac-mouth {
    position: absolute;
    inset: 0;
    background: #0a0505;
    animation: pac-chomp-right 0.3s steps(2) infinite;

    &.face-left {
      animation-name: pac-chomp-left;
    }

    &.face-up {
      animation-name: pac-chomp-up;
    }

    &.face-down {
      animation-name: pac-chomp-down;
    }
  }

  .pm-ghost {
    border-radius: 50% 50% 0 0;
    background: var(--ghost-color, #ff5c5c);
    box-shadow: 0 0 6px color-mix(in srgb, var(--ghost-color, #ff5c5c) 60%, transparent);

    &.is-frightened {
      background: #2b3bff;
      box-shadow: 0 0 8px rgba(80, 100, 255, 0.8);
      animation: ghost-scared 0.4s steps(2) infinite;
    }

    &.is-eaten {
      background: transparent;
      box-shadow: none;
      opacity: 0.5;
    }
  }

  .pm-level-toast {
    position: absolute;
    top: 8px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0, 0, 0, 0.75);
    border: 1px solid #ffd44d;
    color: #ffd44d;
    font-size: 0.7rem;
    letter-spacing: 0.12rem;
    padding: 4px 10px;
    z-index: 3;
    animation: fadeIn 0.2s ease-out both;
  }

  .pm-board-veil {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    background: rgba(0, 0, 0, 0.6);
    color: #ffd44d;
    font-size: 1rem;
    letter-spacing: 0.2rem;
    font-weight: 900;
    z-index: 3;
  }

  .pm-panel {
    display: flex;
    gap: 16px;
    font-size: 0.72rem;
    letter-spacing: 0.1rem;
    color: #ffb0b0;
  }

  .pm-message {
    font-size: 0.72rem;
    color: #ff8a8a;
    letter-spacing: 0.04rem;
    min-height: 1.2em;
  }

  .pm-keypad {
    display: grid;
    grid-template-columns: repeat(3, 40px);
    grid-template-rows: repeat(2, 40px);
    gap: 6px;
    justify-content: center;

    .key {
      padding: 0;

      &.up {
        grid-column: 2;
        grid-row: 1;
      }

      &.left {
        grid-column: 1;
        grid-row: 2;
      }

      &.down {
        grid-column: 2;
        grid-row: 2;
      }

      &.right {
        grid-column: 3;
        grid-row: 2;
      }
    }
  }

  .pm-help {
    font-size: 0.62rem;
    color: #ff8a8a;
    letter-spacing: 0.04rem;
    text-align: center;
  }
}

@keyframes ambient-drift {
  from {
    transform: translate(0, 0);
  }

  to {
    transform: translate(3%, -3%);
  }
}

@keyframes ambient-pulse {

  0%,
  100% {
    opacity: 0.6;
  }

  50% {
    opacity: 1;
  }
}

@keyframes grid-drift {
  from {
    background-position: 0 0;
  }

  to {
    background-position: 28px 28px;
  }
}

@keyframes power-pulse {

  0%,
  100% {
    transform: scale(1);
    opacity: 1;
  }

  50% {
    transform: scale(1.25);
    opacity: 0.7;
  }
}

/*
 * 嘴巴開合：.pm-pac-mouth 是背景色比照迷宮底色的疊圖，clip-path 只需描出一個單純的
 * 三角形（不再跟 border-radius 疊加，見上面 .pm-pac-mouth 的說明），三角形頂著要面向的
 * 那一側邊界、頂點指向中心；0%／100% 是嘴巴全開（三角形最寬），50% 收回成幾乎重疊的一點
 * （嘴巴全閉，疊圖幾乎消失，看起來就是完整圓形）。四個方向各自獨立一份，皆已重新用
 * Playwright 截圖驗證方向正確。
 */
@keyframes pac-chomp-right {

  0%,
  100% {
    clip-path: polygon(100% 21%, 100% 79%, 44% 50%);
  }

  50% {
    clip-path: polygon(100% 50%, 100% 50%, 44% 50%);
  }
}

@keyframes pac-chomp-left {

  0%,
  100% {
    clip-path: polygon(0 21%, 0 79%, 56% 50%);
  }

  50% {
    clip-path: polygon(0 50%, 0 50%, 56% 50%);
  }
}

@keyframes pac-chomp-up {

  0%,
  100% {
    clip-path: polygon(21% 0, 79% 0, 50% 56%);
  }

  50% {
    clip-path: polygon(50% 0, 50% 0, 50% 56%);
  }
}

@keyframes pac-chomp-down {

  0%,
  100% {
    clip-path: polygon(21% 100%, 79% 100%, 50% 44%);
  }

  50% {
    clip-path: polygon(50% 100%, 50% 100%, 50% 44%);
  }
}

@keyframes ghost-scared {

  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0.6;
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }

  to {
    opacity: 1;
  }
}
</style>
