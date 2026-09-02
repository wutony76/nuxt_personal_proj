/**
 * FROGGER 遊戲核心邏輯（純 TypeScript，完全不依賴 Vue／DOM，見 design.md Decision 1~6）。
 *
 * 這是全專案第一款「玩家離散跳格移動 ＋ NPC 連續 tick 平移」混合驅動的遊戲：
 *   - Player：只在收到方向輸入時 `move()` 離散跳一格，平時完全靜止（Decision 2）。
 *   - NPC（車輛／浮木）：單一 `tick(dtMs)` 驅動所有 10 條車道的浮點座標累加 + wrap-around 循環（Decision 3）。
 * 兩條驅動路徑寫入同一份 state，各自結束時都呼叫「唯一」的共用判定 `resolveHazard(state)`
 * （Decision 5），由它同時處理撞車／落水／浮木跟隨／終點判定，規則只有一份、不寫兩遍。
 *
 * 座標系統採 `(row, col)` 整數格，row 由下到上編號（Decision 1）：
 *   row 12 = HOME（起點，玩家初始 col 5）、row 7~11 = 5 條 ROAD、row 6 = MEDIAN（安全中線）、
 *   row 1~5 = 5 條 RIVER、row 0 = GOAL（終點列，含 5 個固定欄位蓮花座）。
 *
 * 頁面（frogger.vue）以 `reactive()` 鏡像 `getSnapshot()` 的純資料，template 只負責攤平渲染，
 * Logic 與 Rendering 分離（比照 2048／flappy 的既有寫法）。
 */

// ── Grid / 座標常數（集中設定，需求「集中管理」，見 design.md Decision 1/6）──
export const GRID_COLS = 11
export const GRID_ROWS = 13
export const HOME_ROW = GRID_ROWS - 1 // 12：起點列
export const GOAL_ROW = 0 // 終點列
export const MEDIAN_ROW = 6 // 安全中線（無 NPC）
/** 終點列 5 個蓮花座的固定欄位（唯一安全落點，其餘欄位落水） */
export const GOAL_SLOT_COLS = [0, 2, 5, 8, 10]

// ── Life / Score / Tick 常數（集中設定，見 design.md Decision 6）──
export const LIVES_START_FR = 3
export const HOP_SCORE = 10 // 每次往終點方向推進一格（本命最遠進度更新）
export const GOAL_SCORE = 200 // 跳進一個未佔用的蓮花座
export const LEVEL_CLEAR_BONUS = 500 // 5 個蓮花座全部佔用、完成一輪
export const TICK_MS = 50 // NPC game loop 週期（約 20fps）

// ── 難度遞增常數（Math.max/Math.min 夾限，避免難度無限失控，見 design.md Decision 6）──
/** 每升一級所有車道速度增量比例：baseSpeed × (1 + (level-1) × 此值) */
export const SPEED_GROWTH_PER_LEVEL = 0.15
/** 每升一級間距縮減量（取 floor 讓間距維持整數，見 getLaneGapForLevel） */
export const GAP_SHRINK_PER_LEVEL = 0.5
/** 間距下限，避免車道被塞到完全無縫（撞車必死／河道無法通過） */
export const MIN_GAP = 1

export type LaneType = 'HOME' | 'ROAD' | 'MEDIAN' | 'RIVER' | 'GOAL'
/** 玩家離散移動方向（鍵盤與觸控共用） */
export type MoveDirection = 'up' | 'down' | 'left' | 'right'
/** 車道移動方向：1 = 向右、-1 = 向左 */
export type LaneDirection = 1 | -1
/**
 * 引擎內部狀態（僅 'playing'／'gameover'；頁面另有自己的 4 態 status）。刻意不 export：
 * 外部無人以此名引用，且維持這個泛用名稱不對外曝露可避免跟其他引擎的 GameStatus 系列撞名。
 */
type GameStatus = 'playing' | 'gameover'

/**
 * 車道靜態設定（集中於 `LANE_CONFIGS`，需求「所有速度／車輛數量／河流速度集中設定」）。
 * `baseSpeed` 單位為「格/秒」，`entityLength` 為該車道實體佔用的欄位寬度，`gap` 為相鄰實體間距。
 */
export type LaneConfig = {
  row: number
  type: 'ROAD' | 'RIVER'
  direction: LaneDirection
  baseSpeed: number
  entityLength: number
  gap: number
}

/**
 * 車道上的動態實體（車輛或浮木）。`floatCol` 為左緣的浮點欄位，位於長度 `trackLength` 的
 * 環形虛擬軌道上（Decision 3）；同一條車道所有實體共用同一 `trackLength`，方便 `getOccupiedCols`
 * 與渲染各自獨立計算 wrap-around，不需額外傳參。
 */
export type LaneEntity = {
  id: string
  floatCol: number
  length: number
  trackLength: number
}

export type LaneRuntime = {
  config: LaneConfig
  entities: LaneEntity[]
}

/**
 * 玩家狀態。`raftCol` 為浮點欄位：站在浮木上時隨浮木漂移累加（Decision 4），離散移動時被重置為
 * 當前整數欄位，避免浮點誤差跨 tick 累積；不在 RIVER 列時 `raftCol` 恆等於 `col`。
 */
export type PlayerState = {
  row: number
  col: number
  raftCol: number
}

/**
 * `resolveHazard()` 讀寫的核心 state（純資料，方便單元測試）。`tickDtMs` 由呼叫端設定：
 * 離散移動填 0（浮木不漂移，只做「站上/落水」判定）、NPC tick 填實際 dt（浮木帶著玩家漂移）。
 */
export type FroggerCoreState = {
  player: PlayerState
  lanes: LaneRuntime[]
  goalSlots: boolean[]
  level: number
  tickDtMs: number
}

/**
 * 單一共用判定的結果（Decision 5）：
 *   - `COLLISION`：ROAD 撞車（致命，扣 1 命重生）
 *   - `FALL_IN_WATER`：RIVER 落水或 GOAL 落錯欄位（致命，扣 1 命重生）
 *   - `ON_RAFT`：站在浮木上安全漂移（非致命，僅表示已隨浮木更新座標）
 *   - `GOAL_FILLED`：跳進未佔用蓮花座（計分並重生，湊滿 5 個時完成一輪）
 */
export type HazardResult =
  | { type: 'COLLISION' }
  | { type: 'FALL_IN_WATER' }
  | { type: 'ON_RAFT' }
  | { type: 'GOAL_FILLED'; slotIndex: number }

/**
 * `move()` / `tick()` 回傳給頁面的事件摘要：`hazard` 為本次共用判定結果（供頁面挑選撞車/落水/
 * 進終點的提示文字），`roundCleared` 表示這一步剛好湊滿 5 蓮花座完成一輪，`gameOver` 表示命數歸零。
 */
export type FroggerEvent = {
  hazard: HazardResult | null
  roundCleared: boolean
  gameOver: boolean
}

/**
 * 10 條動態車道設定（索引不重要，`row` 才是定位鍵）。所有實體週期 `entityLength + gap`
 * 皆取自 {3,4,6}，讓每條車道的 `trackLength` 都落在 12（GRID_COLS 11 的最小 ≥ 且可整除的長度），
 * 換算後每條車道 wrap-around 循環的密度都可預期（見 generateLaneEntities）。
 */
export const LANE_CONFIGS: LaneConfig[] = [
  // ROAD（rows 7~11）：越靠近終點（row 越小）越快，方向左右交錯
  { row: 11, type: 'ROAD', direction: -1, baseSpeed: 1.6, entityLength: 2, gap: 2 },
  { row: 10, type: 'ROAD', direction: 1, baseSpeed: 2.0, entityLength: 1, gap: 3 },
  { row: 9, type: 'ROAD', direction: -1, baseSpeed: 2.6, entityLength: 2, gap: 4 },
  { row: 8, type: 'ROAD', direction: 1, baseSpeed: 1.4, entityLength: 3, gap: 3 },
  { row: 7, type: 'ROAD', direction: -1, baseSpeed: 3.0, entityLength: 1, gap: 2 },
  // RIVER（rows 1~5）：浮木長度較大、方向左右交錯，速度整體比車道略緩
  { row: 5, type: 'RIVER', direction: 1, baseSpeed: 1.4, entityLength: 3, gap: 3 },
  { row: 4, type: 'RIVER', direction: -1, baseSpeed: 1.8, entityLength: 2, gap: 2 },
  { row: 3, type: 'RIVER', direction: 1, baseSpeed: 1.1, entityLength: 4, gap: 2 },
  { row: 2, type: 'RIVER', direction: -1, baseSpeed: 2.2, entityLength: 2, gap: 2 },
  { row: 1, type: 'RIVER', direction: 1, baseSpeed: 1.6, entityLength: 3, gap: 3 }
]

// ── Grid / 座標工具（tasks 5.2）──

/** 依 row 回傳地形類型（見 design.md Decision 1 的分層編號） */
export const rowType = (row: number): LaneType => {
  if (row === HOME_ROW) return 'HOME'
  if (row === GOAL_ROW) return 'GOAL'
  if (row === MEDIAN_ROW) return 'MEDIAN'
  if (row >= 1 && row <= 5) return 'RIVER'
  if (row >= 7 && row <= 11) return 'ROAD'
  return 'MEDIAN'
}

export const isInBounds = (row: number, col: number): boolean =>
  row >= 0 && row < GRID_ROWS && col >= 0 && col < GRID_COLS

/** 玩家起點：HOME 列正中央（col 5），raftCol 與 col 同步 */
export const createHomePosition = (): PlayerState => {
  const col = Math.floor(GRID_COLS / 2)
  return { row: HOME_ROW, col, raftCol: col }
}

// ── Level / 難度（tasks 5.6）──

/** 該車道在指定 level 的速度（格/秒）：隨 level 線性增加，無下修 */
export const getLaneSpeedForLevel = (config: LaneConfig, level: number): number =>
  config.baseSpeed * (1 + (level - 1) * SPEED_GROWTH_PER_LEVEL)

/** 該車道在指定 level 的間距：隨 level 縮減、夾住 MIN_GAP 下限，並取整數維持 trackLength 可整除 */
export const getLaneGapForLevel = (config: LaneConfig, level: number): number =>
  Math.max(MIN_GAP, config.gap - Math.floor((level - 1) * GAP_SHRINK_PER_LEVEL))

// ── Lane 實體產生 / tick / 佔用格（tasks 5.3，見 design.md Decision 3）──

/**
 * 依 `entityLength + gap` 週期在環形軌道上均勻分佈初始實體。
 * `count` 取「足以覆蓋可視寬度」的最小整數，`trackLength = count × cycle` 保證軌道長度是週期的
 * 整數倍（環上實體等距、wrap 無縫），且 ≥ GRID_COLS（可視區恆為軌道的子窗）。
 */
export const generateLaneEntities = (config: LaneConfig, level: number): LaneEntity[] => {
  const gap = getLaneGapForLevel(config, level)
  const cycle = config.entityLength + gap
  const count = Math.max(1, Math.ceil(GRID_COLS / cycle))
  const trackLength = count * cycle
  const entities: LaneEntity[] = []
  for (let i = 0; i < count; i += 1) {
    entities.push({
      id: `${config.row}-${i}`,
      floatCol: i * cycle,
      length: config.entityLength,
      trackLength
    })
  }
  return entities
}

/**
 * 推進一條車道一個 tick（就地修改 entities）：每個實體浮點座標 `+= direction × speed × dt`，
 * 並用 `((x % L) + L) % L` 把座標 wrap 回 `[0, trackLength)`，超出邊界的實體從另一側循環出現，
 * 不需額外的 spawn/despawn 生命週期管理（Decision 3）。
 */
export const advanceLane = (entities: LaneEntity[], config: LaneConfig, level: number, dtMs: number): void => {
  const speed = getLaneSpeedForLevel(config, level)
  const delta = config.direction * speed * (dtMs / 1000)
  for (const entity of entities) {
    const L = entity.trackLength
    const next = entity.floatCol + delta
    entity.floatCol = ((next % L) + L) % L
  }
}

/**
 * 該實體目前佔用的可視整數欄位集合（供碰撞判定，見 Decision 5）。
 * 同時考慮「本體」與「向左 wrap 的分身（floatCol − trackLength）」，讓跨越環形軌道接縫的實體
 * 佔用格正確地從右側延續到左側（例如浮木尾端剛滑出右邊、頭端已從左邊滑入）；只取落在
 * `[0, GRID_COLS)` 的欄位，軌道緩衝區（≥ GRID_COLS 的欄位）自動排除。
 */
export const getOccupiedCols = (entity: LaneEntity): Set<number> => {
  const cols = new Set<number>()
  const base = Math.round(entity.floatCol)
  for (const offset of [0, -entity.trackLength]) {
    for (let k = 0; k < entity.length; k += 1) {
      const col = base + offset + k
      if (col >= 0 && col < GRID_COLS) cols.add(col)
    }
  }
  return cols
}

/** 該車道是否有任一實體佔用指定欄位 */
const laneOccupiesCol = (lane: LaneRuntime, col: number): boolean =>
  lane.entities.some((entity) => getOccupiedCols(entity).has(col))

/** 依 row 找出對應的動態車道（ROAD／RIVER），HOME／MEDIAN／GOAL 回傳 undefined */
const findLane = (state: FroggerCoreState, row: number): LaneRuntime | undefined =>
  state.lanes.find((lane) => lane.config.row === row)

// ── Player 離散移動（tasks 5.4）──

/**
 * 玩家離散移動一格（就地修改 player）：邊界檢查後更新 row/col，並把 `raftCol` 重置為移動後的
 * 整數欄位（避免浮點漂移殘留，見 Decision 4）。回傳是否為有效移動（撞牆等無效移動回傳 false）。
 * 本函式「不含」hazard 判定，撞車／落水／終點統一交給 `resolveHazard()`（Decision 5）。
 */
export const movePlayer = (player: PlayerState, direction: MoveDirection): boolean => {
  let { row, col } = player
  if (direction === 'up') row -= 1
  else if (direction === 'down') row += 1
  else if (direction === 'left') col -= 1
  else col += 1
  if (!isInBounds(row, col)) return false
  player.row = row
  player.col = col
  player.raftCol = col
  return true
}

// ── 單一共用判定：撞車／落水／浮木跟隨／終點（tasks 5.5，見 design.md Decision 5）──

/**
 * 唯一的碰撞/落水/漂移/終點判定入口，供 `movePlayer()` 後與 `tick()` 後兩處共用（Decision 5）。
 * 依玩家所在列的 `LaneType` 分流：
 *   - HOME / MEDIAN：恆安全，回傳 null。
 *   - ROAD：玩家欄位與任一車輛佔用格重疊 → COLLISION。
 *   - RIVER：腳下有浮木 → 隨浮木漂移（raftCol += direction×speed×dt，dt 為 0 時等於原地判定），
 *            漂移後欄位超出邊界 → FALL_IN_WATER，否則 ON_RAFT；腳下無浮木 → FALL_IN_WATER。
 *   - GOAL：命中未佔用蓮花座 → GOAL_FILLED；非蓮花座欄位或已佔用蓮花座 → FALL_IN_WATER。
 * 就地更新 RIVER 的 raftCol/col（漂移是安全的連續位移）；致命與計分後果由呼叫端（引擎）處理。
 */
export const resolveHazard = (state: FroggerCoreState): HazardResult | null => {
  const { player } = state
  const type = rowType(player.row)

  if (type === 'HOME' || type === 'MEDIAN') return null

  if (type === 'ROAD') {
    const lane = findLane(state, player.row)
    if (lane && laneOccupiesCol(lane, player.col)) return { type: 'COLLISION' }
    return null
  }

  if (type === 'RIVER') {
    const lane = findLane(state, player.row)
    if (!lane) return { type: 'FALL_IN_WATER' }
    // 先以「漂移前」的整數欄位判定腳下是否有浮木；無浮木代表跳進水裡或浮木已漂走 → 落水
    if (!laneOccupiesCol(lane, player.col)) return { type: 'FALL_IN_WATER' }
    // 有浮木：讓玩家隨浮木同步位移（dt 為 0 的離散移動不漂移，只確認站上去安全）
    const speed = getLaneSpeedForLevel(lane.config, state.level)
    player.raftCol += lane.config.direction * speed * (state.tickDtMs / 1000)
    player.col = Math.round(player.raftCol)
    // 被浮木沖出棋盤左右邊界 → 落水（見 spec「平台跟隨移動將玩家帶出邊界判定落水」）
    if (player.col < 0 || player.col >= GRID_COLS) return { type: 'FALL_IN_WATER' }
    return { type: 'ON_RAFT' }
  }

  // GOAL：只有 5 個固定蓮花座欄位安全，其餘一律落水
  const slotIndex = GOAL_SLOT_COLS.indexOf(player.col)
  if (slotIndex < 0) return { type: 'FALL_IN_WATER' }
  if (state.goalSlots[slotIndex]) return { type: 'FALL_IN_WATER' }
  return { type: 'GOAL_FILLED', slotIndex }
}

// ── Snapshot 型別（頁面 reactive 鏡像用）──

export type LaneEntitySnapshot = { id: string; floatCol: number; length: number; trackLength: number }
export type LaneSnapshot = {
  row: number
  type: 'ROAD' | 'RIVER'
  direction: LaneDirection
  entities: LaneEntitySnapshot[]
}
export type FroggerSnapshot = {
  player: PlayerState
  lanes: LaneSnapshot[]
  goalSlots: boolean[]
  goalSlotCols: number[]
  lives: number
  score: number
  level: number
  status: GameStatus
  /** 已完成的輪數（5 蓮花座全滿計 1 輪），供 HUD 與紀錄 meta 使用 */
  roundsCleared: number
  /** 本局累計跳進蓮花座的總次數，供紀錄 meta 使用 */
  goalsFilled: number
}

/** 依 level 重建全部 10 條車道實體（開局與每完成一輪各呼叫一次，見 Decision 6） */
const buildLanes = (level: number): LaneRuntime[] =>
  LANE_CONFIGS.map((config) => ({ config, entities: generateLaneEntities(config, level) }))

/**
 * FROGGER 引擎：整合 Grid／車道／玩家／碰撞／Level／Score（tasks 5.7）。
 * 對外只暴露 `tick()` / `move()` / `reset()` / `getSnapshot()`，內部 state 由 `resolveHazard()`
 * 這唯一判定驅動後果（扣命重生／計分／完成一輪難度遞增）。
 */
export default class FroggerEngine {
  private state: FroggerCoreState = {
    player: createHomePosition(),
    lanes: [],
    goalSlots: [],
    level: 1,
    tickDtMs: 0
  }
  private score = 0
  private lives = LIVES_START_FR
  private status: GameStatus = 'playing'
  /** 本命最遠進度（此趟到過最小的 row）；用來判斷「往終點推進一格」以計 HOP 分數，重生時重置 */
  private furthestRow = HOME_ROW
  private roundsCleared = 0
  private goalsFilled = 0

  constructor() {
    this.reset()
  }

  /**
   * 是否已 Game Over。刻意做成獨立方法：`move()`／`tick()` 開頭的 `status !== 'playing'` 守衛會把
   * `this.status` 型別窄化成 `'playing'`，其後 `applyHazard()` 可能改成 `'gameover'` 但 TS 控制流
   * 不追蹤這個副作用；透過本方法重新讀取 `this.status`，避免呼叫端出現「兩型別無重疊」的誤判。
   */
  private gameIsOver(): boolean {
    return this.status === 'gameover'
  }

  /** 完整重置所有對局狀態（見 spec「Restart 完整重置」），不殘留上一局資料 */
  reset(): void {
    this.score = 0
    this.lives = LIVES_START_FR
    this.status = 'playing'
    this.furthestRow = HOME_ROW
    this.roundsCleared = 0
    this.goalsFilled = 0
    this.state = {
      player: createHomePosition(),
      lanes: buildLanes(1),
      goalSlots: GOAL_SLOT_COLS.map(() => false),
      level: 1,
      tickDtMs: 0
    }
  }

  /**
   * 玩家離散移動一格：更新座標 → 若往終點推進則計 HOP 分 → 呼叫共用 `resolveHazard()` 結算。
   * 沒有輸入時完全不呼叫此方法，玩家保持靜止（Decision 2）。
   */
  move(direction: MoveDirection): FroggerEvent {
    if (this.status !== 'playing') return { hazard: null, roundCleared: false, gameOver: true }
    const moved = movePlayer(this.state.player, direction)
    if (!moved) return { hazard: null, roundCleared: false, gameOver: false }
    if (this.state.player.row < this.furthestRow) {
      this.furthestRow = this.state.player.row
      this.score += HOP_SCORE
    }
    this.state.tickDtMs = 0
    const before = this.roundsCleared
    const hazard = resolveHazard(this.state)
    this.applyHazard(hazard)
    return { hazard, roundCleared: this.roundsCleared > before, gameOver: this.gameIsOver() }
  }

  /**
   * NPC 連續 tick：推進所有車道 → 呼叫共用 `resolveHazard()`（此時 dt 非 0，浮木會帶著玩家漂移）。
   * 非 PLAYING 狀態直接 return（Pause 期間頁面讓 tick 提前結束，不需清除/重建 interval，見 Risks）。
   */
  tick(dtMs: number): FroggerEvent {
    if (this.status !== 'playing') return { hazard: null, roundCleared: false, gameOver: true }
    for (const lane of this.state.lanes) {
      advanceLane(lane.entities, lane.config, this.state.level, dtMs)
    }
    this.state.tickDtMs = dtMs
    const before = this.roundsCleared
    const hazard = resolveHazard(this.state)
    this.applyHazard(hazard)
    return { hazard, roundCleared: this.roundsCleared > before, gameOver: this.gameIsOver() }
  }

  /** 依 `resolveHazard()` 的結果套用後果（扣命重生／計分／完成一輪難度遞增） */
  private applyHazard(result: HazardResult | null): void {
    if (!result || result.type === 'ON_RAFT') return

    if (result.type === 'COLLISION' || result.type === 'FALL_IN_WATER') {
      this.loseLife()
      return
    }

    // GOAL_FILLED：標記蓮花座、計 GOAL 分、重生準備下一趟
    this.state.goalSlots[result.slotIndex] = true
    this.score += GOAL_SCORE
    this.goalsFilled += 1
    this.respawnPlayer()

    // 5 個蓮花座全部佔用 → 完成一輪：計 LEVEL CLEAR 分、level+1、重建車道、蓮花座清空（Decision 6）
    if (this.state.goalSlots.every((filled) => filled)) {
      this.score += LEVEL_CLEAR_BONUS
      this.roundsCleared += 1
      this.state.level += 1
      this.state.goalSlots = GOAL_SLOT_COLS.map(() => false)
      this.state.lanes = buildLanes(this.state.level)
    }
  }

  /** 撞車/落水扣 1 命；歸零 → Game Over（不再移動或判定），否則重生回起點（不影響 level/score/蓮花座） */
  private loseLife(): void {
    this.lives -= 1
    if (this.lives <= 0) {
      this.lives = 0
      this.status = 'gameover'
      return
    }
    this.respawnPlayer()
  }

  private respawnPlayer(): void {
    this.state.player = createHomePosition()
    this.furthestRow = HOME_ROW
  }

  /** 對外回傳純資料快照（深拷貝車道實體與玩家，頁面用 reactive() 鏡像） */
  getSnapshot(): FroggerSnapshot {
    return {
      player: { ...this.state.player },
      lanes: this.state.lanes.map((lane) => ({
        row: lane.config.row,
        type: lane.config.type,
        direction: lane.config.direction,
        entities: lane.entities.map((entity) => ({
          id: entity.id,
          floatCol: entity.floatCol,
          length: entity.length,
          trackLength: entity.trackLength
        }))
      })),
      goalSlots: [...this.state.goalSlots],
      goalSlotCols: [...GOAL_SLOT_COLS],
      lives: this.lives,
      score: this.score,
      level: this.state.level,
      status: this.status,
      roundsCleared: this.roundsCleared,
      goalsFilled: this.goalsFilled
    }
  }
}
