/**
 * TOWER DEFENSE 遊戲核心邏輯（純 TypeScript，不依賴 Vue／DOM，見 add-tower-defense-game/design.md）。
 *
 * 邏輯依 design.md Decision 1 分層為具名 class（EnemySystem／TowerSystem／ProjectileSystem／
 * WaveSystem／EconomySystem／UpgradeSystem），但物理上收斂在單一檔案，比照全專案單檔 engine 慣例。
 * 座標一律用像素（TD_CELL_SIZE 為單一換算基準），tick 由頁面以 setInterval 驅動、逐次呼叫 step(dt)。
 *
 * 波次：第 1～20 波為手工 WAVE_TABLE，第 21 波起由 generateWave() 程序化生成（design.md Decision 6），
 * Boss 每 10 波固定重複出現，無限延伸、永不設「破關」終點。
 */

// ── 地圖 ──
export const TD_CELL_SIZE = 32
export const TD_GRID_COLS = 12
export const TD_GRID_ROWS = 8
export const TD_STAGE_WIDTH = TD_GRID_COLS * TD_CELL_SIZE
export const TD_STAGE_HEIGHT = TD_GRID_ROWS * TD_CELL_SIZE

type CellCoord = { r: number; c: number }
/** 路徑轉折點（格座標），敵人依序沿這些點的連線移動 */
const PATH_WAYPOINTS_CELLS: CellCoord[] = [
  { r: 0, c: 0 },
  { r: 0, c: 3 },
  { r: 3, c: 3 },
  { r: 3, c: 8 },
  { r: 6, c: 8 },
  { r: 6, c: 11 }
]

const cellCenter = (cell: CellCoord) => ({ x: cell.c * TD_CELL_SIZE + TD_CELL_SIZE / 2, y: cell.r * TD_CELL_SIZE + TD_CELL_SIZE / 2 })

/** 路徑經過的所有格子（含轉折點間的直線段），這些格子 MUST NOT 建塔 */
const buildPathCellSet = (): Set<string> => {
  const set = new Set<string>()
  for (let i = 0; i < PATH_WAYPOINTS_CELLS.length - 1; i++) {
    const a = PATH_WAYPOINTS_CELLS[i]!
    const b = PATH_WAYPOINTS_CELLS[i + 1]!
    if (a.r === b.r) {
      const [from, to] = a.c <= b.c ? [a.c, b.c] : [b.c, a.c]
      for (let c = from; c <= to; c++) set.add(`${a.r},${c}`)
    } else {
      const [from, to] = a.r <= b.r ? [a.r, b.r] : [b.r, a.r]
      for (let r = from; r <= to; r++) set.add(`${r},${a.c}`)
    }
  }
  return set
}
export const PATH_CELLS = buildPathCellSet()
export const isPathCell = (r: number, c: number) => PATH_CELLS.has(`${r},${c}`)

/** 路徑折線的像素座標點與各段累積長度，供敵人依「已走距離」內插目前位置 */
const PATH_POINTS = PATH_WAYPOINTS_CELLS.map(cellCenter)
const PATH_SEGMENT_LENGTHS: number[] = []
for (let i = 0; i < PATH_POINTS.length - 1; i++) {
  const a = PATH_POINTS[i]!
  const b = PATH_POINTS[i + 1]!
  PATH_SEGMENT_LENGTHS.push(Math.hypot(b.x - a.x, b.y - a.y))
}
export const PATH_TOTAL_LENGTH = PATH_SEGMENT_LENGTHS.reduce((sum, len) => sum + len, 0)

const positionAtDistance = (distance: number): { x: number; y: number; reachedEnd: boolean } => {
  if (distance >= PATH_TOTAL_LENGTH) {
    const last = PATH_POINTS[PATH_POINTS.length - 1]!
    return { x: last.x, y: last.y, reachedEnd: true }
  }
  let remaining = distance
  for (let i = 0; i < PATH_SEGMENT_LENGTHS.length; i++) {
    const segLen = PATH_SEGMENT_LENGTHS[i]!
    if (remaining <= segLen) {
      const a = PATH_POINTS[i]!
      const b = PATH_POINTS[i + 1]!
      const t = segLen === 0 ? 0 : remaining / segLen
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, reachedEnd: false }
    }
    remaining -= segLen
  }
  const last = PATH_POINTS[PATH_POINTS.length - 1]!
  return { x: last.x, y: last.y, reachedEnd: true }
}

export const START_POINT = PATH_POINTS[0]!
export const END_POINT = PATH_POINTS[PATH_POINTS.length - 1]!

// ── 塔 ──
export type TowerKind = 'archer' | 'cannon' | 'ice'
export type TowerLevelConfig = {
  damage: number
  /** 每秒攻擊次數 */
  atkSpeed: number
  /** 射程（格） */
  range: number
  /** 升級到此等級所需花費；Lv1 為 0（花費在建造成本 buildCost） */
  upgradeCost: number
  splashRadius?: number
  slowFactor?: number
  slowDurationSec?: number
  critChance?: number
  critMultiplier?: number
  slowedBonusDamage?: number
}
export type TowerConfigEntry = { name: string; icon: string; buildCost: number; levels: TowerLevelConfig[] }

export const TOWER_CONFIG: Record<TowerKind, TowerConfigEntry> = {
  archer: {
    name: '弓箭塔',
    icon: '🏹',
    buildCost: 50,
    levels: [
      { damage: 8, atkSpeed: 1.2, range: 3.5, upgradeCost: 0 },
      { damage: 14, atkSpeed: 1.5, range: 4, upgradeCost: 80 },
      { damage: 22, atkSpeed: 1.8, range: 4.5, upgradeCost: 150, critChance: 0.1, critMultiplier: 2 }
    ]
  },
  cannon: {
    name: '炮塔',
    icon: '💣',
    buildCost: 80,
    levels: [
      { damage: 25, atkSpeed: 0.6, range: 3, upgradeCost: 0, splashRadius: 1.2 },
      { damage: 40, atkSpeed: 0.7, range: 3.2, upgradeCost: 120, splashRadius: 1.4 },
      { damage: 60, atkSpeed: 0.8, range: 3.5, upgradeCost: 200, splashRadius: 1.6 }
    ]
  },
  ice: {
    name: '冰塔',
    icon: '❄️',
    buildCost: 60,
    levels: [
      { damage: 3, atkSpeed: 1.0, range: 1.7, upgradeCost: 0, slowFactor: 0.2, slowDurationSec: 1.5 },
      { damage: 5, atkSpeed: 1.1, range: 3.3, upgradeCost: 90, slowFactor: 0.3, slowDurationSec: 2 },
      { damage: 8, atkSpeed: 1.2, range: 3.6, upgradeCost: 160, slowFactor: 0.4, slowDurationSec: 2.5, slowedBonusDamage: 0.1 }
    ]
  }
}
export const TOWER_MAX_LEVEL = 3

export type Tower = { id: number; kind: TowerKind; row: number; col: number; x: number; y: number; level: number; cooldownSec: number }

// ── 敵人 ──
export type EnemyKind = 'normal' | 'fast' | 'tank' | 'boss'
export const ENEMY_CONFIG: Record<EnemyKind, { baseHp: number; speed: number; reward: number; hpPenalty: number; icon: string }> = {
  normal: { baseHp: 30, speed: 70, reward: 5, hpPenalty: 1, icon: '👾' },
  fast: { baseHp: 15, speed: 126, reward: 4, hpPenalty: 1, icon: '🐜' },
  tank: { baseHp: 120, speed: 42, reward: 12, hpPenalty: 2, icon: '🛡️' },
  boss: { baseHp: 800, speed: 35, reward: 100, hpPenalty: 5, icon: '👹' }
}
/** 每波（第 1～20 波非 Boss）HP 依此比例緩步成長，難度主要來自數量/速度/組成，不是單純堆 HP */
const HP_WAVE_GROWTH_PER_WAVE = 0.1
/** 第 bossIndex 隻 Boss（wave = bossIndex*10）的 HP，等比成長（design.md Decision 6） */
const bossHp = (bossIndex: number) => Math.round(800 * 1.6 ** (bossIndex - 1))

export type Enemy = {
  id: number
  kind: EnemyKind
  hp: number
  maxHp: number
  distance: number
  x: number
  y: number
  slowUntil: number
  slowFactor: number
  vulnerableUntil: number
}

// ── Wave 強化 ──
export type UpgradeOptionKey = 'damage' | 'atkSpeed' | 'gold' | 'range' | 'slow'
export const UPGRADE_OPTION_POOL: Array<{ key: UpgradeOptionKey; label: string; desc: string; baseCost: number }> = [
  { key: 'damage', label: '攻擊力 +15%', desc: '所有防禦塔傷害提升 15%', baseCost: 50 },
  { key: 'atkSpeed', label: '攻速 +15%', desc: '所有防禦塔攻擊速度提升 15%', baseCost: 50 },
  { key: 'gold', label: 'Gold 收益 +20%', desc: '擊殺與過波獲得的 Gold 提升 20%', baseCost: 150 },
  { key: 'range', label: '射程 +15%', desc: '所有防禦塔射程提升 15%', baseCost: 60 },
  { key: 'slow', label: '減速強度 +20%', desc: '冰塔的減速效果提升 20%', baseCost: 50 }
]
/** 每個強化各自獨立計價：每買一次，該項目的價格就漲一次（20 波前漲 5%~30%，20 波後漲 40%~70%），互不影響 */
const priceGrowthRange = (wave: number): [number, number] => (wave > 20 ? [0.4, 0.7] : [0.05, 0.3])

// ── 效能防護（design.md Decision 7）──
const MAX_CONCURRENT_ENEMIES = 40
const MAX_SPAWN_PER_WAVE = 60
const MIN_SPAWN_INTERVAL_MS = 350

// ── 玩家初始資源 ──
const STARTING_GOLD = 350
const STARTING_HP = 20

type WaveEnemyGroup = { kind: EnemyKind; count: number }
type WaveDefinition = { groups: WaveEnemyGroup[]; intervalMs: number; speedMul?: number }

/**
 * 波次未指定自己的 speedMul 時的預設值：前 5 波維持半速（新手教學期），
 * 第 6～15 波線性爬回原速，第 15 波起（含 21+ 程序化波次）回到 1.0（design.md 難度曲線之外的額外緩坡）
 */
const defaultWaveSpeedMul = (wave: number): number => {
  if (wave <= 5) return 0.5
  if (wave >= 15) return 1
  return 0.5 + ((wave - 5) / 10) * 0.5
}

/** 每次出怪的隨機批量（一次放一群，不再一隻一隻放）：第 1～5 波 1-5 隻，第 6 波起 3-8 隻 */
const randomBatchSpawnCount = (wave: number): number => {
  const [min, max] = wave <= 5 ? [1, 5] : [3, 8]
  return min + Math.floor(Math.random() * (max - min + 1))
}
/** 同一批出怪的敵人沿路徑錯開的距離（px），避免疊在同一點看起來像一隻 */
const BATCH_SPAWN_STAGGER_PX = 14

// 第 1～20 波：手工設計的難度曲線（design.md Decision 6），Boss 於 wave10／wave20 出現
const WAVE_TABLE: Record<number, WaveDefinition> = {
  1: { groups: [{ kind: 'normal', count: 8 }], intervalMs: 1400 },
  2: { groups: [{ kind: 'normal', count: 12 }], intervalMs: 1100 },
  3: { groups: [{ kind: 'normal', count: 10 }, { kind: 'fast', count: 4 }], intervalMs: 1100 },
  4: { groups: [{ kind: 'normal', count: 10 }, { kind: 'fast', count: 8 }], intervalMs: 1000 },
  5: { groups: [{ kind: 'normal', count: 14 }, { kind: 'fast', count: 10 }], intervalMs: 900 },
  6: { groups: [{ kind: 'normal', count: 10 }, { kind: 'tank', count: 3 }], intervalMs: 900 },
  7: { groups: [{ kind: 'normal', count: 8 }, { kind: 'fast', count: 8 }, { kind: 'tank', count: 4 }], intervalMs: 850 },
  8: { groups: [{ kind: 'normal', count: 16 }, { kind: 'fast', count: 10 }, { kind: 'tank', count: 4 }], intervalMs: 800 },
  9: { groups: [{ kind: 'normal', count: 14 }, { kind: 'fast', count: 14 }, { kind: 'tank', count: 5 }], intervalMs: 750, speedMul: 1.1 },
  10: { groups: [{ kind: 'boss', count: 1 }, { kind: 'normal', count: 6 }], intervalMs: 800 },
  11: { groups: [{ kind: 'normal', count: 14 }, { kind: 'fast', count: 12 }, { kind: 'tank', count: 5 }], intervalMs: 750 },
  12: { groups: [{ kind: 'fast', count: 18 }, { kind: 'tank', count: 6 }], intervalMs: 700 },
  13: { groups: [{ kind: 'normal', count: 10 }, { kind: 'fast', count: 14 }, { kind: 'tank', count: 7 }], intervalMs: 700 },
  14: { groups: [{ kind: 'normal', count: 16 }, { kind: 'fast', count: 16 }, { kind: 'tank', count: 8 }], intervalMs: 650 },
  15: { groups: [{ kind: 'normal', count: 20 }, { kind: 'fast', count: 16 }, { kind: 'tank', count: 8 }], intervalMs: 600 },
  16: { groups: [{ kind: 'normal', count: 18 }, { kind: 'fast', count: 20 }, { kind: 'tank', count: 9 }], intervalMs: 600 },
  17: { groups: [{ kind: 'normal', count: 18 }, { kind: 'fast', count: 20 }, { kind: 'tank', count: 10 }], intervalMs: 580 },
  18: { groups: [{ kind: 'normal', count: 20 }, { kind: 'fast', count: 22 }, { kind: 'tank', count: 10 }], intervalMs: 560 },
  19: { groups: [{ kind: 'normal', count: 22 }, { kind: 'fast', count: 24 }, { kind: 'tank', count: 12 }], intervalMs: 540 },
  20: { groups: [{ kind: 'boss', count: 1 }, { kind: 'normal', count: 14 }, { kind: 'fast', count: 10 }, { kind: 'tank', count: 6 }], intervalMs: 500 }
}

/** 第 21 波起程序化生成（design.md Decision 6），延續同一組難度維度：數量／組成／間隔持續遞增 */
const generateWave = (wave: number): WaveDefinition => {
  const bossIndex = wave % 10 === 0 ? wave / 10 : null
  const totalCount = Math.min(20 + Math.floor((wave - 20) * 2), MAX_SPAWN_PER_WAVE)
  const tankRatio = Math.min(0.1 + (wave - 20) * 0.01, 0.4)
  const fastRatio = Math.min(0.3 + (wave - 20) * 0.005, 0.45)
  const tankCount = Math.round(totalCount * tankRatio)
  const fastCount = Math.round(totalCount * fastRatio)
  const normalCount = Math.max(totalCount - tankCount - fastCount, 0)
  const intervalMs = Math.max(MIN_SPAWN_INTERVAL_MS, 1200 - wave * 10)

  const groups: WaveEnemyGroup[] = []
  if (bossIndex) {
    groups.push({ kind: 'boss', count: 1 })
    groups.push({ kind: 'normal', count: 6 + bossIndex })
  }
  if (normalCount > 0) groups.push({ kind: 'normal', count: normalCount })
  if (fastCount > 0) groups.push({ kind: 'fast', count: fastCount })
  if (tankCount > 0) groups.push({ kind: 'tank', count: tankCount })
  return { groups, intervalMs }
}

const waveDefinitionFor = (wave: number): WaveDefinition => WAVE_TABLE[wave] ?? generateWave(wave)

/** 把 wave 的敵人分組展開成交錯排列的出怪序列，避免同種類一次連續生成 */
const buildSpawnQueue = (def: WaveDefinition): EnemyKind[] => {
  const lists = def.groups.map((g) => Array(g.count).fill(g.kind) as EnemyKind[])
  const queue: EnemyKind[] = []
  let remaining = lists.some((l) => l.length > 0)
  while (remaining) {
    remaining = false
    for (const list of lists) {
      const next = list.shift()
      if (next) {
        queue.push(next)
        if (list.length > 0) remaining = true
      }
    }
  }
  // Boss 固定排在最後出場，讓玩家先清掉護衛怪
  queue.sort((a, b) => (a === 'boss' ? 1 : 0) - (b === 'boss' ? 1 : 0))
  return queue
}

// ── EconomySystem ──
class EconomySystem {
  gold = STARTING_GOLD
  reset() {
    this.gold = STARTING_GOLD
  }
  canAfford(cost: number) {
    return this.gold >= cost
  }
  spend(cost: number): boolean {
    if (!this.canAfford(cost)) return false
    this.gold -= cost
    return true
  }
  add(amount: number) {
    this.gold += amount
  }
}

// ── UpgradeSystem（Wave 強化，design.md Decision 5）──
class UpgradeSystem {
  globalDamageMult = 1
  globalAtkSpeedMult = 1
  goldMult = 1
  globalRangeMult = 1
  slowMult = 1
  pendingOptions: UpgradeOptionKey[] | null = null
  /** 每個強化各自獨立的目前價格，買越多次那一項越貴，其他項目不受影響 */
  prices: Record<UpgradeOptionKey, number> = Object.fromEntries(
    UPGRADE_OPTION_POOL.map((o) => [o.key, o.baseCost])
  ) as Record<UpgradeOptionKey, number>

  reset() {
    this.globalDamageMult = 1
    this.globalAtkSpeedMult = 1
    this.goldMult = 1
    this.globalRangeMult = 1
    this.slowMult = 1
    this.pendingOptions = null
    this.prices = Object.fromEntries(UPGRADE_OPTION_POOL.map((o) => [o.key, o.baseCost])) as Record<UpgradeOptionKey, number>
  }

  priceFor(key: UpgradeOptionKey): number {
    return Math.round(this.prices[key])
  }

  rollOptions() {
    const pool = [...UPGRADE_OPTION_POOL]
    const picked: UpgradeOptionKey[] = []
    for (let i = 0; i < 3 && pool.length > 0; i++) {
      const idx = Math.floor(Math.random() * pool.length)
      picked.push(pool.splice(idx, 1)[0]!.key)
    }
    this.pendingOptions = picked
  }

  choose(key: UpgradeOptionKey, wave: number): boolean {
    if (!this.pendingOptions || !this.pendingOptions.includes(key)) return false
    if (key === 'damage') this.globalDamageMult *= 1.15
    if (key === 'atkSpeed') this.globalAtkSpeedMult *= 1.15
    if (key === 'gold') this.goldMult *= 1.2
    if (key === 'range') this.globalRangeMult *= 1.15
    if (key === 'slow') this.slowMult *= 1.2
    const [minPct, maxPct] = priceGrowthRange(wave)
    this.prices[key] *= 1 + (minPct + Math.random() * (maxPct - minPct))
    this.pendingOptions = null
    return true
  }

  /** 不強化：略過本次選項，不花錢也不套用任何效果，價格也不會漲 */
  skip() {
    this.pendingOptions = null
  }
}

// ── EnemySystem ──
class EnemySystem {
  enemies: Enemy[] = []
  private nextId = 1

  reset() {
    this.enemies = []
    this.nextId = 1
  }

  /** distanceOffset 可傳負值，讓同一批（batch）出怪的敵人錯開一點距離入場，不會疊在同一個點上 */
  spawn(kind: EnemyKind, wave: number, distanceOffset = 0) {
    const cfg = ENEMY_CONFIG[kind]
    let hp = cfg.baseHp
    if (kind === 'boss') {
      hp = bossHp(wave / 10)
    } else {
      hp = Math.round(cfg.baseHp * (1 + HP_WAVE_GROWTH_PER_WAVE * (wave - 1)))
    }
    const start = positionAtDistance(distanceOffset)
    this.enemies.push({
      id: this.nextId++,
      kind,
      hp,
      maxHp: hp,
      distance: distanceOffset,
      x: start.x,
      y: start.y,
      slowUntil: 0,
      slowFactor: 0,
      vulnerableUntil: 0
    })
  }

  /** 移動所有敵人；回傳抵達終點的敵人（供扣血並移除） */
  tick(dt: number, nowSec: number, waveSpeedMul: number): Enemy[] {
    const reached: Enemy[] = []
    for (const enemy of this.enemies) {
      const cfg = ENEMY_CONFIG[enemy.kind]
      const slowActive = enemy.slowUntil > nowSec
      const slowMul = slowActive ? 1 - enemy.slowFactor : 1
      enemy.distance += cfg.speed * waveSpeedMul * slowMul * dt
      const pos = positionAtDistance(enemy.distance)
      enemy.x = pos.x
      enemy.y = pos.y
      if (pos.reachedEnd) reached.push(enemy)
    }
    if (reached.length > 0) {
      const reachedIds = new Set(reached.map((e) => e.id))
      this.enemies = this.enemies.filter((e) => !reachedIds.has(e.id))
    }
    return reached
  }

  removeDead(): Enemy[] {
    const dead = this.enemies.filter((e) => e.hp <= 0)
    if (dead.length > 0) {
      const deadIds = new Set(dead.map((e) => e.id))
      this.enemies = this.enemies.filter((e) => !deadIds.has(e.id))
    }
    return dead
  }
}

// ── ProjectileSystem（視覺用，命中判定在發射當下已鎖定，design.md Decision 4）──
export type Projectile = {
  id: number
  kind: TowerKind
  fromX: number
  fromY: number
  toX: number
  toY: number
  ttl: number
  /** 固定不變的總飛行秒數，供頁面的 CSS animation-duration 使用（ttl 會隨 tick 遞減） */
  totalTtlSec: number
}
class ProjectileSystem {
  projectiles: Projectile[] = []
  private nextId = 1

  reset() {
    this.projectiles = []
    this.nextId = 1
  }

  spawn(kind: TowerKind, fromX: number, fromY: number, toX: number, toY: number) {
    const dist = Math.hypot(toX - fromX, toY - fromY)
    // 下限抬到 0.15s（1.5 個 tick），確保近距離目標的子彈也至少能被畫面渲染一輪以上，不會一閃即逝
    const ttl = Math.min(0.3, Math.max(0.15, dist / 900))
    this.projectiles.push({ id: this.nextId++, kind, fromX, fromY, toX, toY, ttl, totalTtlSec: ttl })
  }

  tick(dt: number) {
    for (const p of this.projectiles) p.ttl -= dt
    this.projectiles = this.projectiles.filter((p) => p.ttl > 0)
  }
}

// ── TowerSystem ──
class TowerSystem {
  towers: Tower[] = []
  private nextId = 1

  reset() {
    this.towers = []
    this.nextId = 1
  }

  canPlace(row: number, col: number): boolean {
    if (row < 0 || row >= TD_GRID_ROWS || col < 0 || col >= TD_GRID_COLS) return false
    if (isPathCell(row, col)) return false
    return !this.towers.some((t) => t.row === row && t.col === col)
  }

  place(kind: TowerKind, row: number, col: number): Tower | null {
    if (!this.canPlace(row, col)) return null
    const center = cellCenter({ r: row, c: col })
    const tower: Tower = { id: this.nextId++, kind, row, col, x: center.x, y: center.y, level: 1, cooldownSec: 0 }
    this.towers.push(tower)
    return tower
  }

  upgrade(id: number, economy: EconomySystem): boolean {
    const tower = this.towers.find((t) => t.id === id)
    if (!tower) return false
    if (tower.level >= TOWER_MAX_LEVEL) return false
    const nextLevelCfg = TOWER_CONFIG[tower.kind].levels[tower.level]!
    if (!economy.spend(nextLevelCfg.upgradeCost)) return false
    tower.level += 1
    return true
  }

  levelConfig(tower: Tower): TowerLevelConfig {
    return TOWER_CONFIG[tower.kind].levels[tower.level - 1]!
  }
}

// ── WaveSystem ──
class WaveSystem {
  wave = 1
  spawnQueue: EnemyKind[] = []
  spawnTimerSec = 0
  awaitingUpgradeChoice = false
  currentDef: WaveDefinition = WAVE_TABLE[1]!

  reset() {
    this.wave = 1
    this.awaitingUpgradeChoice = false
    this.startWave(1)
  }

  startWave(wave: number) {
    this.wave = wave
    this.currentDef = waveDefinitionFor(wave)
    this.spawnQueue = buildSpawnQueue(this.currentDef)
    this.spawnTimerSec = 0
  }

  isSpawnDone(): boolean {
    return this.spawnQueue.length === 0
  }
}

export type GameStatusTd = 'ready' | 'playing' | 'gameover'

export type TowerDefenseSnapshot = {
  status: GameStatusTd
  gold: number
  hp: number
  wave: number
  score: number
  enemiesAlive: number
  enemiesRemainingInWave: number
  towers: Array<Tower & { config: TowerLevelConfig }>
  enemies: Array<Enemy & { icon: string }>
  projectiles: Projectile[]
  pendingUpgradeOptions: Array<{ key: UpgradeOptionKey; label: string; desc: string; cost: number }> | null
  upgradeMultipliers: { damage: number; atkSpeed: number; gold: number; range: number; slow: number }
  maxWaveReached: number
}

export default class TowerDefenseEngine {
  private economy = new EconomySystem()
  private upgrades = new UpgradeSystem()
  private enemySystem = new EnemySystem()
  private towerSystem = new TowerSystem()
  private projectileSystem = new ProjectileSystem()
  private waveSystem = new WaveSystem()
  private status: GameStatusTd = 'ready'
  private hp = STARTING_HP
  private score = 0
  private clockSec = 0
  private maxWaveReached = 1

  reset() {
    this.economy.reset()
    this.upgrades.reset()
    this.enemySystem.reset()
    this.towerSystem.reset()
    this.projectileSystem.reset()
    this.waveSystem.reset()
    this.status = 'ready'
    this.hp = STARTING_HP
    this.score = 0
    this.clockSec = 0
    this.maxWaveReached = 1
  }

  start() {
    if (this.status === 'gameover') this.reset()
    this.status = 'playing'
  }

  placeTower(kind: TowerKind, row: number, col: number): boolean {
    if (this.status !== 'playing') return false
    const cost = TOWER_CONFIG[kind].buildCost
    if (!this.economy.canAfford(cost)) return false
    if (!this.towerSystem.canPlace(row, col)) return false
    this.economy.spend(cost)
    this.towerSystem.place(kind, row, col)
    return true
  }

  upgradeTower(id: number): boolean {
    if (this.status !== 'playing') return false
    return this.towerSystem.upgrade(id, this.economy)
  }

  chooseWaveUpgrade(key: UpgradeOptionKey): boolean {
    if (!this.waveSystem.awaitingUpgradeChoice) return false
    if (!this.upgrades.pendingOptions?.includes(key)) return false
    if (!this.economy.spend(this.upgrades.priceFor(key))) return false
    this.upgrades.choose(key, this.waveSystem.wave)
    this.waveSystem.awaitingUpgradeChoice = false
    const nextWave = this.waveSystem.wave + 1
    this.maxWaveReached = Math.max(this.maxWaveReached, nextWave)
    this.waveSystem.startWave(nextWave)
    return true
  }

  /** 不強化：免費略過，直接進下一波，價格不會漲 */
  skipWaveUpgrade(): boolean {
    if (!this.waveSystem.awaitingUpgradeChoice) return false
    this.upgrades.skip()
    this.waveSystem.awaitingUpgradeChoice = false
    const nextWave = this.waveSystem.wave + 1
    this.maxWaveReached = Math.max(this.maxWaveReached, nextWave)
    this.waveSystem.startWave(nextWave)
    return true
  }

  private _findTarget(tower: Tower, rangePx: number): Enemy | null {
    let best: Enemy | null = null
    for (const enemy of this.enemySystem.enemies) {
      const dist = Math.hypot(enemy.x - tower.x, enemy.y - tower.y)
      if (dist > rangePx) continue
      if (!best || enemy.distance > best.distance) best = enemy
    }
    return best
  }

  private _applyDamage(enemy: Enemy, amount: number) {
    const bonus = enemy.vulnerableUntil > this.clockSec ? 1.1 : 1
    enemy.hp -= amount * bonus
  }

  private _towersTick(dt: number) {
    for (const tower of this.towerSystem.towers) {
      tower.cooldownSec -= dt
      if (tower.cooldownSec > 0) continue
      const cfg = this.towerSystem.levelConfig(tower)
      const rangePx = cfg.range * this.upgrades.globalRangeMult * TD_CELL_SIZE
      const target = this._findTarget(tower, rangePx)
      if (!target) continue

      const effectiveAtkSpeed = cfg.atkSpeed * this.upgrades.globalAtkSpeedMult
      tower.cooldownSec = 1 / Math.max(effectiveAtkSpeed, 0.01)

      let damage = cfg.damage * this.upgrades.globalDamageMult
      if (cfg.critChance && Math.random() < cfg.critChance) damage *= cfg.critMultiplier ?? 2

      if (tower.kind === 'cannon' && cfg.splashRadius) {
        const splashPx = cfg.splashRadius * TD_CELL_SIZE
        for (const enemy of this.enemySystem.enemies) {
          if (Math.hypot(enemy.x - target.x, enemy.y - target.y) <= splashPx) this._applyDamage(enemy, damage)
        }
      } else {
        this._applyDamage(target, damage)
      }

      if (tower.kind === 'ice' && cfg.slowFactor) {
        const slowFactor = Math.min(0.9, cfg.slowFactor * this.upgrades.slowMult)
        target.slowFactor = slowFactor
        target.slowUntil = this.clockSec + (cfg.slowDurationSec ?? 1)
        if (cfg.slowedBonusDamage) target.vulnerableUntil = target.slowUntil
      }

      this.projectileSystem.spawn(tower.kind, tower.x, tower.y, target.x, target.y)
    }
  }

  /** 每個 tick 由頁面呼叫；dt 為秒數（見頁面 TICK_MS） */
  step(dt: number) {
    if (this.status !== 'playing') return
    this.clockSec += dt

    if (!this.waveSystem.awaitingUpgradeChoice) {
      this.waveSystem.spawnTimerSec -= dt * 1000
      if (this.waveSystem.spawnTimerSec <= 0 && this.waveSystem.spawnQueue.length > 0 && this.enemySystem.enemies.length < MAX_CONCURRENT_ENEMIES) {
        const batchSize = Math.min(
          randomBatchSpawnCount(this.waveSystem.wave),
          this.waveSystem.spawnQueue.length,
          MAX_CONCURRENT_ENEMIES - this.enemySystem.enemies.length
        )
        for (let i = 0; i < batchSize; i++) {
          const kind = this.waveSystem.spawnQueue.shift()!
          this.enemySystem.spawn(kind, this.waveSystem.wave, -i * BATCH_SPAWN_STAGGER_PX)
        }
        this.waveSystem.spawnTimerSec = this.waveSystem.currentDef.intervalMs
      }
    }

    const waveSpeedMul = this.waveSystem.currentDef.speedMul ?? defaultWaveSpeedMul(this.waveSystem.wave)
    const reached = this.enemySystem.tick(dt, this.clockSec, waveSpeedMul)
    for (const enemy of reached) {
      this.hp -= ENEMY_CONFIG[enemy.kind].hpPenalty
    }

    // 先讓「上一輪」的子彈過期，再讓塔開火產生新子彈：避免近距離目標的子彈剛 spawn 就在同一 tick 被扣到 ttl<=0，
    // 導致 getSnapshot() 從未回傳過它、畫面完全看不到子彈飛行
    this.projectileSystem.tick(dt)

    this._towersTick(dt)

    const dead = this.enemySystem.removeDead()
    for (const enemy of dead) {
      const reward = ENEMY_CONFIG[enemy.kind].reward * this.upgrades.goldMult
      this.economy.add(reward)
      this.score += Math.round(ENEMY_CONFIG[enemy.kind].reward * 2)
    }

    if (this.hp <= 0) {
      this.hp = 0
      this.status = 'gameover'
      return
    }

    if (!this.waveSystem.awaitingUpgradeChoice && this.waveSystem.isSpawnDone() && this.enemySystem.enemies.length === 0) {
      this.score += 100 * this.waveSystem.wave
      this.waveSystem.awaitingUpgradeChoice = true
      this.upgrades.rollOptions()
    }
  }

  getSnapshot(): TowerDefenseSnapshot {
    return {
      status: this.status,
      gold: Math.floor(this.economy.gold),
      hp: this.hp,
      wave: this.waveSystem.wave,
      score: Math.round(this.score),
      enemiesAlive: this.enemySystem.enemies.length,
      enemiesRemainingInWave: this.enemySystem.enemies.length + this.waveSystem.spawnQueue.length,
      towers: this.towerSystem.towers.map((t) => ({ ...t, config: this.towerSystem.levelConfig(t) })),
      enemies: this.enemySystem.enemies.map((e) => ({ ...e, icon: ENEMY_CONFIG[e.kind].icon })),
      projectiles: this.projectileSystem.projectiles,
      pendingUpgradeOptions: this.upgrades.pendingOptions
        ? this.upgrades.pendingOptions.map((key) => ({
            ...UPGRADE_OPTION_POOL.find((o) => o.key === key)!,
            cost: this.upgrades.priceFor(key)
          }))
        : null,
      upgradeMultipliers: {
        damage: this.upgrades.globalDamageMult,
        atkSpeed: this.upgrades.globalAtkSpeedMult,
        gold: this.upgrades.goldMult,
        range: this.upgrades.globalRangeMult,
        slow: this.upgrades.slowMult
      },
      maxWaveReached: this.maxWaveReached
    }
  }
}
