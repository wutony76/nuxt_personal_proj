/**
 * WHACK-A-MOLE 遊戲核心邏輯（純 TypeScript，完全不依賴 Vue／DOM，見 design.md）。
 *
 * 本引擎的核心是「三種互不重疊的計時器」（見 design.md Context / Decision 2）：
 *   1. Game Timer   —— 60 秒倒數，由頁面每秒呼叫 `tickGameTimer()` 驅動（引擎不自持 interval）。
 *   2. Spawn Timer  —— 決定「下一隻地鼠何時出現」，引擎內部持有的獨立 `setTimeout`（`spawnTimerId`）。
 *   3. Lifetime Timer —— 決定「當前地鼠何時自動消失」，引擎內部持有的另一個獨立 `setTimeout`（`lifetimeTimerId`）。
 *
 * Spawn 與 Lifetime 兩個 `setTimeout` 資料結構上互不耦合、互不呼叫對方，只透過 Game State
 * （`holes` 陣列）間接產生「地鼠消失 → 排程生成 → 生成 → 排程消失」的循環（見 design.md Decision 2）。
 * 任一時刻兩者最多只有一個有效：畫面上有地鼠時只有 Lifetime Timer，沒有地鼠時只有 Spawn Timer，
 * 因此「同一時間最多一隻地鼠」（Decision 1）由設計本身保證。
 *
 * 非同步狀態變更（地鼠冒出／逾時消失）發生在 `setTimeout` callback 內，透過建構時注入的 `onChange`
 * 通知頁面重新同步 `getSnapshot()`；玩家點擊等同步操作由頁面呼叫後自行同步。
 * `random` 亦可注入，方便單元測試以決定性亂數驗證洞穴挑選與存活/間隔時間。
 */

// ── 型別 ──
export type WhackStatus = 'idle' | 'playing' | 'paused' | 'gameover'

/** 單一洞穴狀態；任一時刻最多一個洞穴的 `moleActive === true`（見 design.md Decision 1） */
export type Hole = {
  index: number
  moleActive: boolean
  /** 該地鼠冒出的時間戳（Date.now()），供頁面播放動畫；無地鼠為 null */
  moleSpawnedAt: number | null
}

export type HoleSnapshot = { index: number; moleActive: boolean; moleSpawnedAt: number | null }

export type WhackAMoleSnapshot = {
  holes: HoleSnapshot[]
  score: number
  combo: number
  multiplier: number
  remainingSec: number
  status: WhackStatus
  /** 本局累計命中數，供 HUD／紀錄 meta 使用 */
  hits: number
  /** 本局累計 miss 數（點空洞穴或已消失地鼠格），供紀錄 meta 使用 */
  misses: number
  /** 本局累計生成的地鼠數，供紀錄 meta 使用 */
  spawns: number
}

/** clickHole 判定結果：HIT（命中）／MISS（點空洞穴）／IGNORED（非遊戲中或無效格） */
export type ClickOutcome = 'HIT' | 'MISS' | 'IGNORED'
export type ClickResult = {
  outcome: ClickOutcome
  holeIndex: number
  /** HIT 時本次獲得的分數（HIT_BASE_SCORE × 當下倍率），非 HIT 為 0 */
  gained: number
}

// ── Grid / 對局常數（集中管理，需求「Timer、Spawn、Score、Game State 分離」，見 design.md Decision 1）──
export const HOLE_COUNT = 9
export const GAME_DURATION_SEC = 60

// ── 難度遞增常數（見 design.md Decision 3；隨已過遊戲時間線性遞減至下限後不再縮短）──
/** 地鼠存活時間上限：開局值 */
export const LIFETIME_CEILING_START_MS = 1400
/** 地鼠存活時間上限：下限（不再隨時間縮短） */
export const LIFETIME_CEILING_MIN_MS = 500
/** 每經過 1 秒遊戲時間，存活時間上限遞減量 */
export const LIFETIME_DECAY_PER_SEC = 12
/** Spawn 間隔上限：開局值 */
export const SPAWN_CEILING_START_MS = 900
/** Spawn 間隔上限：下限 */
export const SPAWN_CEILING_MIN_MS = 400
/** 每經過 1 秒遊戲時間，Spawn 間隔上限遞減量 */
export const SPAWN_DECAY_PER_SEC = 8
/** 實際存活時間／間隔取「當下上限的此比例 ~ 100%」隨機值，保留隨機性（見 design.md Decision 3） */
export const DURATION_RANDOM_FLOOR_RATIO = 0.6

// ── Combo／計分常數（沿用 typing.vue 相同數值與模式，見 design.md Decision 4）──
export const COMBO_THRESHOLDS = [0, 5, 12, 24]
export const COMBO_MULTIPLIERS = [1, 2, 3, 4]
export const HIT_BASE_SCORE = 10

// ── 難度公式（純函式，方便單元測試，見 design.md Decision 3）──

/** 依已過遊戲時間（ms）計算目前地鼠存活時間上限：線性遞減，夾住下限 */
export const currentLifetimeCeiling = (elapsedMs: number): number => {
  const elapsedSec = Math.max(0, elapsedMs) / 1000
  return Math.max(LIFETIME_CEILING_MIN_MS, LIFETIME_CEILING_START_MS - elapsedSec * LIFETIME_DECAY_PER_SEC)
}

/** 依已過遊戲時間（ms）計算目前 Spawn 間隔上限：線性遞減，夾住下限 */
export const currentSpawnCeiling = (elapsedMs: number): number => {
  const elapsedSec = Math.max(0, elapsedMs) / 1000
  return Math.max(SPAWN_CEILING_MIN_MS, SPAWN_CEILING_START_MS - elapsedSec * SPAWN_DECAY_PER_SEC)
}

/** Combo → 得分倍率（沿用 typing.vue 的倒序尋找門檻模式，見 design.md Decision 4） */
export const calcMultiplier = (combo: number): number => {
  let multiplier = COMBO_MULTIPLIERS[0]!
  for (let i = COMBO_THRESHOLDS.length - 1; i >= 0; i -= 1) {
    if (combo >= COMBO_THRESHOLDS[i]!) {
      multiplier = COMBO_MULTIPLIERS[i]!
      break
    }
  }
  return multiplier
}

/** 初始化 9 個空洞穴 */
const createHoles = (): Hole[] =>
  Array.from({ length: HOLE_COUNT }, (_, index) => ({ index, moleActive: false, moleSpawnedAt: null }))

type TimerHandle = ReturnType<typeof setTimeout>

export type WhackAMoleEngineOptions = {
  /** 隨機源（測試可注入決定性亂數），預設 Math.random */
  random?: () => number
  /** 地鼠冒出／逾時消失等非同步狀態變更後的通知，供頁面重新同步 snapshot */
  onChange?: () => void
}

/**
 * WHACK-A-MOLE 引擎：整合 Spawn／Lifetime／Score／Combo／Game State（tasks 5.7）。
 * 對外提供 `start/pause/resume/restart/reset`、`tickGameTimer`、`clickHole`、`getSnapshot`，
 * 以及 `spawnMole/expireMole`（由內部兩個獨立 `setTimeout` 觸發，亦公開供單元測試直接呼叫）。
 */
export default class WhackAMoleEngine {
  private holes: Hole[]
  private score = 0
  private combo = 0
  private multiplier = COMBO_MULTIPLIERS[0]!
  private remainingSec = GAME_DURATION_SEC
  private status: WhackStatus = 'idle'
  private hits = 0
  private misses = 0
  private spawns = 0

  /** 兩個互不耦合的獨立計時器控制代碼（見 design.md Decision 2） */
  private spawnTimerId: TimerHandle | null = null
  private lifetimeTimerId: TimerHandle | null = null

  private random: () => number
  private onChange: () => void

  constructor(options: WhackAMoleEngineOptions = {}) {
    this.random = options.random ?? Math.random
    this.onChange = options.onChange ?? (() => {})
    this.holes = createHoles()
  }

  /** 設定非同步狀態變更通知（頁面於 _handlers 定義後掛上，避免 setup 頂層宣告順序問題） */
  setOnChange(callback: () => void): void {
    this.onChange = callback
  }

  // ── 難度：以剩餘秒數推導已過遊戲時間（暫停時不前進，故 pause 安全）──
  private elapsedMs(): number {
    return (GAME_DURATION_SEC - this.remainingSec) * 1000
  }

  private randomBetween(ceiling: number): number {
    const floor = ceiling * DURATION_RANDOM_FLOOR_RATIO
    return floor + this.random() * (ceiling - floor)
  }

  // ── 計時器管理（Pause／Restart／Game Over 時務必逐一清除，避免殘留誤觸發，見 design.md Risks）──
  private clearSpawnTimer(): void {
    if (this.spawnTimerId !== null) {
      clearTimeout(this.spawnTimerId)
      this.spawnTimerId = null
    }
  }

  private clearLifetimeTimer(): void {
    if (this.lifetimeTimerId !== null) {
      clearTimeout(this.lifetimeTimerId)
      this.lifetimeTimerId = null
    }
  }

  private clearAllTimers(): void {
    this.clearSpawnTimer()
    this.clearLifetimeTimer()
  }

  /** 排程下一次地鼠生成（僅在畫面上沒有地鼠時呼叫）；與 Lifetime Timer 完全獨立 */
  private scheduleSpawn(): void {
    this.clearSpawnTimer()
    const delay = this.randomBetween(currentSpawnCeiling(this.elapsedMs()))
    this.spawnTimerId = setTimeout(() => {
      this.spawnTimerId = null
      this.spawnMole()
    }, delay)
  }

  /** 排程當前地鼠的自動消失；與 Spawn Timer 完全獨立 */
  private scheduleLifetime(holeIndex: number): void {
    this.clearLifetimeTimer()
    const duration = this.randomBetween(currentLifetimeCeiling(this.elapsedMs()))
    this.lifetimeTimerId = setTimeout(() => {
      this.lifetimeTimerId = null
      this.expireMole(holeIndex)
    }, duration)
  }

  // ── Spawn / Lifetime 邏輯（tasks 5.3 / 5.4）──

  /**
   * 地鼠生成：從所有空洞穴隨機挑一個冒出，並排程其 Lifetime Timer。
   * 守衛「同一時間最多一隻地鼠」（Decision 1）——已有地鼠則不生成；生成後不再保留 Spawn 排程，
   * 改由該地鼠消失（擊中或逾時）後再排程下一隻，形成兩計時器的接力循環。
   */
  spawnMole(): void {
    if (this.status !== 'playing') return
    if (this.holes.some((hole) => hole.moleActive)) return
    const emptyHoles = this.holes.filter((hole) => !hole.moleActive)
    if (emptyHoles.length === 0) return
    const target = emptyHoles[Math.floor(this.random() * emptyHoles.length)]!
    target.moleActive = true
    target.moleSpawnedAt = Date.now()
    this.spawns += 1
    this.clearSpawnTimer()
    this.scheduleLifetime(target.index)
    this.onChange()
  }

  /**
   * 地鼠逾時自動消失：若該格仍是同一隻未被擊中的地鼠，縮回（不計分、不扣分），
   * 清除其 Lifetime Timer 並排程下一次生成（tasks 5.4）。
   */
  expireMole(holeIndex: number): void {
    if (this.status !== 'playing') return
    const hole = this.holes[holeIndex]
    if (!hole || !hole.moleActive) return
    hole.moleActive = false
    hole.moleSpawnedAt = null
    this.clearLifetimeTimer()
    this.scheduleSpawn()
    this.onChange()
  }

  // ── 玩家輸入（tasks 5.5，見 design.md Decision 5）──

  /**
   * 玩家點擊某洞穴：
   *   命中（moleActive）→ 得分（HIT_BASE_SCORE × 當下倍率）+ combo+1 + 清除該地鼠與其 Lifetime Timer
   *                      + 排程下一次生成；
   *   未命中（空洞穴／已消失地鼠格）→ combo 歸零、倍率回到最低，分數不變。
   */
  clickHole(holeIndex: number): ClickResult {
    if (this.status !== 'playing') return { outcome: 'IGNORED', holeIndex, gained: 0 }
    const hole = this.holes[holeIndex]
    if (!hole) return { outcome: 'IGNORED', holeIndex, gained: 0 }

    if (hole.moleActive) {
      this.combo += 1
      this.multiplier = calcMultiplier(this.combo)
      const gained = HIT_BASE_SCORE * this.multiplier
      this.score += gained
      this.hits += 1
      hole.moleActive = false
      hole.moleSpawnedAt = null
      this.clearLifetimeTimer()
      this.scheduleSpawn()
      return { outcome: 'HIT', holeIndex, gained }
    }

    this.combo = 0
    this.multiplier = COMBO_MULTIPLIERS[0]!
    this.misses += 1
    return { outcome: 'MISS', holeIndex, gained: 0 }
  }

  // ── Game State / Timer（tasks 5.6）──

  /** 完整重置（不排程任何計時器）；status 回到 idle，不殘留上一局資料 */
  reset(): void {
    this.clearAllTimers()
    this.holes = createHoles()
    this.score = 0
    this.combo = 0
    this.multiplier = COMBO_MULTIPLIERS[0]!
    this.remainingSec = GAME_DURATION_SEC
    this.status = 'idle'
    this.hits = 0
    this.misses = 0
    this.spawns = 0
  }

  /** 開始新的一局：完整重置後進入 playing，並排程第一隻地鼠的 Spawn Timer */
  start(): void {
    this.reset()
    this.status = 'playing'
    this.scheduleSpawn()
  }

  /** 重新開始：等同開新局（完整重置 + 重新排程），不殘留上一局的洞穴／計時器／分數／combo（spec Restart） */
  restart(): void {
    this.start()
  }

  /** 暫停：停用兩個計時器（不消耗任何 Timer），保留當前洞穴／分數／combo／剩餘秒數 */
  pause(): void {
    if (this.status !== 'playing') return
    this.status = 'paused'
    this.clearAllTimers()
  }

  /** 續玩：回到 playing；有地鼠則給它全新的存活時間，否則排程下一次生成（避免殘留計時器誤觸發） */
  resume(): void {
    if (this.status !== 'paused') return
    this.status = 'playing'
    const activeHole = this.holes.find((hole) => hole.moleActive)
    if (activeHole) this.scheduleLifetime(activeHole.index)
    else this.scheduleSpawn()
  }

  /** Game Timer：每秒呼叫一次遞減剩餘秒數，歸零時進入 Game Over；回傳本次是否結束遊戲 */
  tickGameTimer(): boolean {
    if (this.status !== 'playing') return false
    this.remainingSec -= 1
    if (this.remainingSec <= 0) {
      this.remainingSec = 0
      this.gameOver()
      return true
    }
    return false
  }

  /** 結束遊戲：清除所有計時器，status = 'gameover'（見 spec「倒數計時歸零立即結束」） */
  gameOver(): void {
    this.clearAllTimers()
    this.status = 'gameover'
  }

  // ── 內省（供頁面判斷與單元測試斷言計時器狀態）──
  isSpawnScheduled(): boolean {
    return this.spawnTimerId !== null
  }

  isLifetimeScheduled(): boolean {
    return this.lifetimeTimerId !== null
  }

  getStatus(): WhackStatus {
    return this.status
  }

  activeMoleCount(): number {
    return this.holes.reduce((count, hole) => count + (hole.moleActive ? 1 : 0), 0)
  }

  /** 對外回傳純資料快照（頁面用 reactive() 鏡像） */
  getSnapshot(): WhackAMoleSnapshot {
    return {
      holes: this.holes.map((hole) => ({ index: hole.index, moleActive: hole.moleActive, moleSpawnedAt: hole.moleSpawnedAt })),
      score: this.score,
      combo: this.combo,
      multiplier: this.multiplier,
      remainingSec: this.remainingSec,
      status: this.status,
      hits: this.hits,
      misses: this.misses,
      spawns: this.spawns
    }
  }
}
