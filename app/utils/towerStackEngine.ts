/**
 * TOWER STACK 遊戲核心邏輯（純 TypeScript，完全不依賴 Vue／DOM，見 design.md）。
 *
 * 這是全專案唯一「移動方塊寬度會依玩家操作動態縮減」的疊塔玩法，核心是三步驟串接：
 *   1. Overlap Detection（一維水平區間交集，見 design.md Decision 1）：新方塊落下瞬間，
 *      以其水平範圍 [blockLeft, blockRight] 與塔頂現有層 [layerLeft, layerRight] 求交集寬度。
 *   2. Block Resize（見 design.md Decision 2）：交集寬度 > 0 且非 Perfect 時，新層的寬度／位置
 *      設為交集範圍，且「下一顆移動方塊的初始寬度沿用本次新層寬度」，塔身因此單調變窄。
 *   3. Falling Piece（見 design.md Decision 3）：未落入交集範圍的懸空矩形生成一個掉落碎片，
 *      每 tick 以固定重力常數等加速度下墜，離開舞台或超過生命週期上限即移除。
 *
 * Perfect／Combo（見 design.md Decision 4）：偏移量在 perfectThreshold 內判定為 Perfect，
 * 維持原寬、不產生碎片、Combo 遞增並額外加分；任何非 Perfect 的成功疊放會讓 Combo 歸零。
 *
 * 座標採「螢幕式」局部座標：y=0 在舞台頂端、向下遞增（與 breakout 一致，掉落＝y 增加）。
 * 塔身第 i 層（index 0 = 最底的地基層）的上緣 localY = TS_STAGE_HEIGHT - (i+1) * BLOCK_HEIGHT，
 * 移動方塊懸在塔頂正上方一層。塔身超出可視高度時，由頁面對整個塔身容器套 translateY(cameraY)
 * 做「鏡頭下移」（見 design.md Decision 6），engine 只算出建議的 cameraY，不碰 DOM。
 *
 * 型別刻意採 towerStack 專屬命名（Layer／MovingBlock／FallingPiece…）以免與其他 utils 的
 * auto-import 型別（如 GameStatus）撞名，比照 connect4Engine／lightsOutEngine 的既有處理。
 */

// ── 型別（見 tasks 5.1）──
/** 對外共用的狀態型別：engine 只會產生 'playing' / 'gameover'，'ready' / 'paused' 由頁面層管理 */
export type TowerStackPhase = 'ready' | 'playing' | 'paused' | 'gameover'
/** 已固定的塔身層：只需要水平位置 x 與寬度 width，垂直位置由層索引推導 */
export type Layer = { id: number; x: number; width: number }
/** 塔頂上方左右來回移動、等待落下的方塊；dir = 1 向右、-1 向左 */
export type MovingBlock = { x: number; width: number; dir: 1 | -1 }
/** 掉落碎片：帶初始位置、下落速度 vy 與已存在 tick 數 age（見 design.md Decision 3） */
export type FallingPiece = { id: number; x: number; y: number; width: number; height: number; vy: number; age: number }
/** 一維區間交集結果（見 design.md Decision 1） */
export type OverlapResult = { overlapLeft: number; overlapRight: number; overlapWidth: number }

/** dropBlock() 的結果，供頁面決定後續 UI（Perfect 提示／Game Over overlay 等） */
export type DropOutcome = {
  /** 完全沒有重疊（overlapWidth <= 0），本次判定 Game Over */
  gameOver: boolean
  /** 偏移在 perfectThreshold 內，判定 Perfect */
  perfect: boolean
  /** 是否確實疊上一層（Game Over 時為 false） */
  placed: boolean
  /** 本次疊放後的 Combo 計數 */
  combo: number
  /** 本次疊放獲得的分數（含 Perfect／Combo 加成） */
  gainedScore: number
}

export type TowerStackSnapshot = {
  layers: Array<{ id: number; x: number; width: number; y: number }>
  movingBlock: { x: number; width: number; y: number } | null
  fallingPieces: Array<{ id: number; x: number; y: number; width: number; height: number }>
  score: number
  combo: number
  maxCombo: number
  perfectCount: number
  /** 塔高（層數，含地基層） */
  height: number
  /** 目前塔頂寬度，供頁面計算 finalWidthRatio */
  topWidth: number
  blockSpeed: number
  /** 建議的鏡頭下移量（頁面套在塔身容器的 translateY，見 design.md Decision 6） */
  cameraY: number
  phase: TowerStackPhase
}

// ── 集中管理的遊戲參數（見 design.md Decision 5，數值已拍板，不可自行更動）──
export const TOWER_STACK_CONFIG = {
  /** 初始移動速度（px/tick，TICK_MS=16） */
  blockSpeed: 2.2,
  /** 每次成功疊放後的速度增量 */
  speedIncrease: 0.08,
  /** 速度上限（封頂，避免塔身極窄時抖動到無法判讀） */
  maxSpeed: 5.5,
  /** Perfect 判定的位移像素閾值（絕對像素，非比例，見 design.md Decision 4） */
  perfectThreshold: 6,
  /** 每層基礎分（含 Perfect） */
  baseScorePerLayer: 10,
  /** Perfect 額外基礎加分 */
  perfectBonus: 10,
  /** Combo 每一階的加分 */
  comboBonusStep: 8,
  /** Combo 加成封頂（避免極端連續 Perfect 局分數失控） */
  comboBonusCap: 10
} as const

// ── 舞台與物理常數（集中管理，頁面渲染與 engine 共用同一份，不重複硬編碼）──
export const TS_STAGE_WIDTH = 400
export const TS_STAGE_HEIGHT = 480
export const BLOCK_HEIGHT = 24
export const INITIAL_BLOCK_WIDTH = 160
/** 鏡頭啟動門檻：移動方塊經鏡頭下移後，至少距離舞台頂端這麼多 px（塔夠高才開始捲動） */
export const MIN_VISIBLE_Y = 72
/** 掉落碎片的重力常數（等加速度直線下墜，見 design.md Decision 3／Non-Goal） */
export const TS_GRAVITY = 0.6
/** 掉落碎片的初始下落速度 */
export const FALLING_PIECE_INITIAL_VY = 2
/** 掉落碎片生命週期上限（tick）：離開舞台前的雙重清除保險，避免罕見情況殘留 */
export const FALLING_PIECE_MAX_AGE = 70

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value))

/** 塔身第 index 層（0 = 地基層）上緣的局部 y 座標 */
export const layerTopY = (index: number): number => TS_STAGE_HEIGHT - (index + 1) * BLOCK_HEIGHT

/** 地基層 x：初始寬度置中 */
export const baseLayerX = (): number => (TS_STAGE_WIDTH - INITIAL_BLOCK_WIDTH) / 2

/**
 * Overlap Detection（見 design.md Decision 1／tasks 5.2）：一維水平區間交集。
 * overlapWidth <= 0 代表完全沒有重疊（Game Over 候選）。純函式，不依賴任何狀態。
 */
export const detectOverlap = (
  layer: { x: number; width: number },
  block: { x: number; width: number }
): OverlapResult => {
  const overlapLeft = Math.max(layer.x, block.x)
  const overlapRight = Math.min(layer.x + layer.width, block.x + block.width)
  return { overlapLeft, overlapRight, overlapWidth: overlapRight - overlapLeft }
}

/**
 * 偏移量：塔頂層寬度與交集寬度之差（= 移動方塊相對塔頂的水平位移量，恆 >= 0）。
 * 因移動方塊寬度恆等於塔頂寬度（見 design.md Decision 2），此值即為單側懸空寬度。
 */
export const computeOffset = (layerWidth: number, overlapWidth: number): number =>
  Math.max(0, layerWidth - overlapWidth)

/**
 * Perfect 判定（見 design.md Decision 4／tasks 5.4）：偏移量 <= perfectThreshold 即為 Perfect。
 * 採絕對像素閾值（非比例），讓手感在整場遊戲維持一致，不因塔身變窄而額外變嚴苛。
 */
export const checkPerfect = (layerWidth: number, overlapWidth: number, perfectThreshold: number): boolean =>
  computeOffset(layerWidth, overlapWidth) <= perfectThreshold

/**
 * Block Resize（見 design.md Decision 2／tasks 5.3）：新層寬度＝交集寬度、位置＝交集起點。
 * 回傳結果同時作為（a）疊上塔頂的新層資料，與（b）下一顆移動方塊的初始寬度，塔身因此單調變窄。
 */
export const resizeBlock = (overlap: OverlapResult): { x: number; width: number } => ({
  x: overlap.overlapLeft,
  width: overlap.overlapWidth
})

/**
 * 計算未落入交集範圍的懸空矩形（見 design.md Decision 3）。因移動方塊寬度恆等於塔頂寬度，
 * 偏移只會讓其中一側懸空，回傳單一矩形；完全對齊（無懸空）時回傳 null。
 */
export const computeOverhang = (
  block: { x: number; width: number },
  overlap: OverlapResult
): { x: number; width: number } | null => {
  const leftWidth = overlap.overlapLeft - block.x
  const rightWidth = block.x + block.width - overlap.overlapRight
  if (leftWidth > 0) return { x: block.x, width: leftWidth }
  if (rightWidth > 0) return { x: overlap.overlapRight, width: rightWidth }
  return null
}

/** 難度遞增（見 tasks 5.6）：速度依 increase 遞增並以 max 封頂 */
export const nextBlockSpeed = (current: number, increase: number, max: number): number =>
  Math.min(max, current + increase)

/**
 * 掉落碎片每 tick 更新（見 design.md Decision 3／tasks 5.5）：以固定重力等加速度下墜，age 累加。
 * 純函式，回傳更新後的新碎片物件（不修改傳入物件）。
 */
export const advanceFallingPiece = (piece: FallingPiece, gravity: number): FallingPiece => {
  const vy = piece.vy + gravity
  return { ...piece, vy, y: piece.y + vy, age: piece.age + 1 }
}

/**
 * 批次更新掉落碎片並移除離開舞台（y > removeBelowY）或超過生命週期上限（age >= maxAge）者。
 * 見 spec「碎片 SHALL 隨 tick 更新下落位置，離開畫面或存在時間超過上限後 MUST NOT 再被渲染」。
 */
export const updateFallingPieces = (
  pieces: FallingPiece[],
  gravity: number,
  removeBelowY: number,
  maxAge: number
): FallingPiece[] =>
  pieces
    .map((piece) => advanceFallingPiece(piece, gravity))
    .filter((piece) => piece.y <= removeBelowY && piece.age < maxAge)

/**
 * TowerStackEngine（見 tasks 5.8）：整合 Overlap Detection／Block Resize／Falling Piece／
 * Perfect／Combo／難度遞增。tick-driven（step 驅動移動方塊位移與碎片更新），
 * dropBlock 觸發整條疊放判定流程。純 TS，不依賴 Vue；頁面以 getSnapshot() 取純資料鏡像。
 */
export class TowerStackEngine {
  private layers: Layer[] = []
  private movingBlock: MovingBlock | null = null
  private fallingPieces: FallingPiece[] = []
  private score = 0
  private combo = 0
  private maxCombo = 0
  private perfectCount = 0
  private blockSpeed: number = TOWER_STACK_CONFIG.blockSpeed
  private phase: TowerStackPhase = 'ready'
  private nextLayerId = 1
  private nextPieceId = 1

  constructor() {
    this.reset()
  }

  /** 完整重置所有對局狀態（見 spec Restart 規格／tasks 6.9）：地基層置中、移動方塊回初始寬度 */
  reset(): void {
    this.layers = [{ id: this.nextLayerId++, x: baseLayerX(), width: INITIAL_BLOCK_WIDTH }]
    this.fallingPieces = []
    this.score = 0
    this.combo = 0
    this.maxCombo = 0
    this.perfectCount = 0
    this.blockSpeed = TOWER_STACK_CONFIG.blockSpeed
    this.phase = 'playing'
    this.spawnMovingBlock(INITIAL_BLOCK_WIDTH)
  }

  isOver(): boolean {
    return this.phase === 'gameover'
  }

  private topLayer(): Layer {
    return this.layers[this.layers.length - 1]!
  }

  /** 在塔頂上方生成新的移動方塊：寬度沿用新塔頂寬度，一律從左緣起步向右掃（見 design.md Decision 2） */
  private spawnMovingBlock(width: number): void {
    this.movingBlock = { x: 0, width, dir: 1 }
  }

  private spawnFallingPiece(x: number, y: number, width: number): void {
    this.fallingPieces.push({
      id: this.nextPieceId++,
      x,
      y,
      width,
      height: BLOCK_HEIGHT,
      vy: FALLING_PIECE_INITIAL_VY,
      age: 0
    })
  }

  /**
   * 落下方塊（見 tasks 5.8）：Overlap Detection → Game Over 判定 → Perfect 判定 →
   * Block Resize / Falling Piece → 難度遞增 → 生成下一顆移動方塊。
   * 只有 phase === 'playing' 且有移動方塊時有效。
   */
  dropBlock(): DropOutcome | null {
    if (this.phase !== 'playing' || !this.movingBlock) return null

    const top = this.topLayer()
    const block = { x: this.movingBlock.x, width: this.movingBlock.width }
    const dropY = layerTopY(this.layers.length)
    const overlap = detectOverlap(top, block)

    // Game Over：完全沒有重疊（見 spec「overlapWidth <= 0 SHALL 立即判定 Game Over」，
    // MUST NOT 允許以零寬度／負寬度的層繼續疊放）。整顆未命中的方塊化為掉落碎片增加視覺回饋。
    if (overlap.overlapWidth <= 0) {
      this.spawnFallingPiece(block.x, dropY, block.width)
      this.movingBlock = null
      this.phase = 'gameover'
      return { gameOver: true, perfect: false, placed: false, combo: this.combo, gainedScore: 0 }
    }

    const perfect = checkPerfect(top.width, overlap.overlapWidth, TOWER_STACK_CONFIG.perfectThreshold)
    let gainedScore = TOWER_STACK_CONFIG.baseScorePerLayer

    if (perfect) {
      // Perfect：維持塔頂原寬並對齊（不縮減、不產生掉落碎片），Combo 遞增並額外加分
      this.layers.push({ id: this.nextLayerId++, x: top.x, width: top.width })
      this.combo += 1
      this.maxCombo = Math.max(this.maxCombo, this.combo)
      this.perfectCount += 1
      gainedScore +=
        TOWER_STACK_CONFIG.perfectBonus +
        Math.min(this.combo, TOWER_STACK_CONFIG.comboBonusCap) * TOWER_STACK_CONFIG.comboBonusStep
    } else {
      // 一般疊放：依交集縮減新層寬度／位置，未重疊部分生成掉落碎片，Combo 歸零
      const resized = resizeBlock(overlap)
      const overhang = computeOverhang(block, overlap)
      if (overhang) this.spawnFallingPiece(overhang.x, dropY, overhang.width)
      this.layers.push({ id: this.nextLayerId++, x: resized.x, width: resized.width })
      this.combo = 0
    }

    this.score += gainedScore
    // 難度遞增：每次成功疊放後速度遞增並封頂（見 tasks 5.6）
    this.blockSpeed = nextBlockSpeed(this.blockSpeed, TOWER_STACK_CONFIG.speedIncrease, TOWER_STACK_CONFIG.maxSpeed)
    // 下一顆移動方塊沿用新塔頂寬度（見 design.md Decision 2）
    this.spawnMovingBlock(this.topLayer().width)

    return { gameOver: false, perfect, placed: true, combo: this.combo, gainedScore }
  }

  /**
   * tick 驅動（見 tasks 5.8）：phase === 'playing' 時移動方塊左右來回、抵達邊界反彈；
   * 掉落碎片一律每 tick 更新（讓 Game Over 後殘留碎片也能落完再消失）。
   */
  step(): void {
    if (this.phase === 'playing' && this.movingBlock) {
      const block = this.movingBlock
      block.x += this.blockSpeed * block.dir
      if (block.x <= 0) {
        block.x = 0
        block.dir = 1
      } else if (block.x + block.width >= TS_STAGE_WIDTH) {
        block.x = TS_STAGE_WIDTH - block.width
        block.dir = -1
      }
    }
    this.fallingPieces = updateFallingPieces(
      this.fallingPieces,
      TS_GRAVITY,
      TS_STAGE_HEIGHT,
      FALLING_PIECE_MAX_AGE
    )
  }

  /** 建議的鏡頭下移量：塔夠高時讓移動方塊維持在 MIN_VISIBLE_Y，塔矮時為 0（不捲動，見 design.md Decision 6） */
  private cameraY(): number {
    return Math.max(0, MIN_VISIBLE_Y - layerTopY(this.layers.length))
  }

  /** 對外回傳純資料快照（深拷貝陣列，頁面用 reactive() 鏡像；y 為局部座標，頁面另套 cameraY） */
  getSnapshot(): TowerStackSnapshot {
    const cameraY = this.cameraY()
    return {
      layers: this.layers.map((layer, index) => ({
        id: layer.id,
        x: layer.x,
        width: layer.width,
        y: layerTopY(index)
      })),
      movingBlock: this.movingBlock
        ? { x: this.movingBlock.x, width: this.movingBlock.width, y: layerTopY(this.layers.length) }
        : null,
      fallingPieces: this.fallingPieces.map((piece) => ({
        id: piece.id,
        x: piece.x,
        y: piece.y,
        width: piece.width,
        height: piece.height
      })),
      score: this.score,
      combo: this.combo,
      maxCombo: this.maxCombo,
      perfectCount: this.perfectCount,
      height: this.layers.length,
      topWidth: this.topLayer().width,
      blockSpeed: clamp(this.blockSpeed, TOWER_STACK_CONFIG.blockSpeed, TOWER_STACK_CONFIG.maxSpeed),
      cameraY,
      phase: this.phase
    }
  }
}

export default TowerStackEngine
