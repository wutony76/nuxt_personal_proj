<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useGameHistory } from '~/composables/useGameHistory'

type RunnerStatus = 'ready' | 'playing' | 'pause' | 'gameover'
type PlayerState = 'standing' | 'jumping' | 'ducking'
type ObstacleType = 'ground' | 'air'
type Obstacle = { id: number; type: ObstacleType; x: number; width: number }
type StepResult = { gameOver: boolean }

const STAGE_WIDTH = 500
const STAGE_HEIGHT = 230
const GROUND_Y = 200
const PLAYER_X = 60
const PLAYER_WIDTH = 30
const STANDING_HEIGHT = 46
const DUCK_HEIGHT = 22
const GROUND_OBSTACLE_HEIGHT = 20
const GROUND_OBSTACLE_WIDTH = 18
const AIR_OBSTACLE_TOP = 155
const AIR_OBSTACLE_HEIGHT = 20
const AIR_OBSTACLE_WIDTH = 26
/**
 * 跳躍高度（JUMP_HEIGHT=40）刻意抓在「地面障礙高度（20）」與「空中障礙頂部距地高度（45）」之間：
 * 跳到一定高度才能真正越過地面障礙（不是隨便起跳就安全，考驗時機），但無論跳多高都還是會撞到
 * 空中障礙（跳躍全程 box 的下緣都低於空中障礙頂部）——這是設計上刻意的規則，見 design.md Decision 5。
 */
const JUMP_HEIGHT = 40
const JUMP_DURATION_TICKS = 34
const TICK_MS = 16
const READY_START = 3
const BASE_SCROLL_SPEED = 3
const SCROLL_SPEED_PER_LEVEL = 0.6
const BASE_SPAWN_TICKS = 70
const SPAWN_TICKS_PER_LEVEL = 8
const MIN_SPAWN_TICKS = 34
const LEVEL_SCORE_THRESHOLDS = [0, 50, 120, 230, 400]
const AIR_OBSTACLE_CHANCE_BASE = 0.2
const AIR_OBSTACLE_CHANCE_PER_LEVEL = 0.08

const calcRunnerLevel = (score: number) => {
  let level = 1
  for (let i = LEVEL_SCORE_THRESHOLDS.length - 1; i >= 0; i -= 1) {
    if (score >= LEVEL_SCORE_THRESHOLDS[i]!) {
      level = i + 1
      break
    }
  }
  return level
}

/**
 * 側視角跑酷的核心邏輯：角色固定 x 座標，障礙物由右向左捲動；跳躍用簡易重力 physics
 * （比照 pong.vue 的 tick 積分速度手法），下蹲是單純的碰撞箱切換（無位移曲線）。
 * 只有這一款遊戲用到，不抽到 app/utils/（見 openspec/changes/add-runner-game/design.md）。
 */
class RunnerEngine {
  playerState: PlayerState = 'standing'
  private jumpTick = 0
  private duckHeld = false
  private obstacles: Obstacle[] = []
  private nextObstacleId = 1
  private ticksUntilSpawn = BASE_SPAWN_TICKS
  private distance = 0
  private level = 1

  reset() {
    this.playerState = 'standing'
    this.jumpTick = 0
    this.duckHeld = false
    this.obstacles = []
    this.ticksUntilSpawn = BASE_SPAWN_TICKS
    this.distance = 0
    this.level = 1
  }

  private get scrollSpeed() {
    return BASE_SCROLL_SPEED + (this.level - 1) * SCROLL_SPEED_PER_LEVEL
  }

  private get spawnTicks() {
    return Math.max(MIN_SPAWN_TICKS, BASE_SPAWN_TICKS - (this.level - 1) * SPAWN_TICKS_PER_LEVEL)
  }

  /** 跳躍高度隨 tick 走一個對稱的拋物線（上升到 JUMP_DURATION_TICKS/2 後下降），純粹視覺＋碰撞判定用 */
  private get jumpOffset(): number {
    if (this.playerState !== 'jumping') return 0
    const half = JUMP_DURATION_TICKS / 2
    const progress = this.jumpTick <= half ? this.jumpTick / half : (JUMP_DURATION_TICKS - this.jumpTick) / half
    return JUMP_HEIGHT * Math.max(0, Math.min(1, progress))
  }

  jump() {
    if (this.playerState === 'standing') {
      this.playerState = 'jumping'
      this.jumpTick = 0
    }
  }

  setDuckHeld(held: boolean) {
    this.duckHeld = held
    if (this.playerState === 'standing' && held) {
      this.playerState = 'ducking'
    } else if (this.playerState === 'ducking' && !held) {
      this.playerState = 'standing'
    }
  }

  private playerBox(): { top: number; bottom: number } {
    if (this.playerState === 'jumping') {
      const offset = this.jumpOffset
      return { top: GROUND_Y - STANDING_HEIGHT - offset, bottom: GROUND_Y - offset }
    }
    if (this.playerState === 'ducking') {
      return { top: GROUND_Y - DUCK_HEIGHT, bottom: GROUND_Y }
    }
    return { top: GROUND_Y - STANDING_HEIGHT, bottom: GROUND_Y }
  }

  private obstacleBox(ob: Obstacle): { top: number; bottom: number } {
    if (ob.type === 'ground') {
      return { top: GROUND_Y - GROUND_OBSTACLE_HEIGHT, bottom: GROUND_Y }
    }
    return { top: AIR_OBSTACLE_TOP, bottom: AIR_OBSTACLE_TOP + AIR_OBSTACLE_HEIGHT }
  }

  private overlapsX(ob: Obstacle): boolean {
    return ob.x < PLAYER_X + PLAYER_WIDTH && ob.x + ob.width > PLAYER_X
  }

  private overlapsY(ob: Obstacle): boolean {
    const player = this.playerBox()
    const target = this.obstacleBox(ob)
    return player.top < target.bottom && target.top < player.bottom
  }

  private spawnObstacle() {
    const isAir = Math.random() < Math.min(0.6, AIR_OBSTACLE_CHANCE_BASE + (this.level - 1) * AIR_OBSTACLE_CHANCE_PER_LEVEL)
    const width = isAir ? AIR_OBSTACLE_WIDTH : GROUND_OBSTACLE_WIDTH
    this.obstacles.push({ id: this.nextObstacleId++, type: isAir ? 'air' : 'ground', x: STAGE_WIDTH, width })
  }

  step(): StepResult {
    // 跳躍計時
    if (this.playerState === 'jumping') {
      this.jumpTick += 1
      if (this.jumpTick >= JUMP_DURATION_TICKS) {
        this.playerState = this.duckHeld ? 'ducking' : 'standing'
        this.jumpTick = 0
      }
    }

    // 障礙物捲動與回收
    const speed = this.scrollSpeed
    this.obstacles = this.obstacles.filter((ob) => ob.x + ob.width > -20)
    this.obstacles.forEach((ob) => {
      ob.x -= speed
    })

    // 生成新障礙
    this.ticksUntilSpawn -= 1
    if (this.ticksUntilSpawn <= 0) {
      this.spawnObstacle()
      this.ticksUntilSpawn = this.spawnTicks
    }

    // 距離／分數與等級
    this.distance += speed
    this.level = calcRunnerLevel(this.score)

    // 碰撞判定
    const hit = this.obstacles.some((ob) => this.overlapsX(ob) && this.overlapsY(ob))

    return { gameOver: hit }
  }

  // 分數量級調降為原本的 1/3（distance 除數 10→30），等級門檻與 server 端 coinRate/maxReasonableScore
  // 同步等比例調整（見 server/services/game/retro/runner.ts），維持同樣的升級節奏與 coin 賺取速度不變，
  // 只是畫面上的分數數字漲得更慢——比照 match3-games design.md Decision 8 同一類調整手法
  get score(): number {
    return Math.floor(this.distance / 30)
  }

  getSnapshot() {
    return {
      playerState: this.playerState,
      jumpOffset: this.jumpOffset,
      obstacles: this.obstacles.map((ob) => ({ ...ob })),
      score: this.score,
      level: this.level
    }
  }
}

const router = useRouter()
const engine = new RunnerEngine()
const gameHistory = useGameHistory()

const state = reactive({
  status: 'ready' as RunnerStatus,
  playerState: 'standing' as PlayerState,
  jumpOffset: 0,
  obstacles: [] as Obstacle[],
  score: 0,
  level: 1,
  message: '按「開始」後用 ↑/W 或空白鍵跳躍，↓/S 下蹲。',
  rewardMessage: '',
  waitingOverlayVisible: true,
  readyOverlayVisible: false,
  readyCountdownValue: READY_START,
  resultOverlayVisible: false,
  rateDialogOpen: false,
  ruleDialogOpen: false
})

const RUNNER_RULE = {
  description:
    '角色固定在畫面左側自動奔跑，地面障礙需跳躍（↑/W/空白鍵）閃避，空中障礙需下蹲（↓/S）閃避；' +
    '撞到任一障礙物即結束。無論跳多高都無法閃避空中障礙，只有下蹲才行；下蹲也無法閃避地面障礙，只有跳躍才行。',
  scoreRule: 'SCORE ＝ 存活距離，隨時間持續累加，沒有上限；等級隨分數提升，捲動速度與障礙密度會同步提高。',
  levels: LEVEL_SCORE_THRESHOLDS.map((threshold, idx) => ({
    level: idx + 1,
    condition: idx + 1 < LEVEL_SCORE_THRESHOLDS.length ? `${threshold}–${LEVEL_SCORE_THRESHOLDS[idx + 1]! - 1} 分` : `${threshold} 分以上`
  })),
  note: '等級越高，捲動速度越快、障礙物間距越短、空中障礙出現比例越高。'
}

let tickTimer: ReturnType<typeof setInterval> | null = null
let readyTimer: ReturnType<typeof setInterval> | null = null

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
  () => state.status === 'pause' && !state.waitingOverlayVisible && !state.readyOverlayVisible && !state.resultOverlayVisible
)
const canPauseWhilePlaying = computed(() => state.status === 'playing')

const playerTop = computed(() => {
  if (state.playerState === 'jumping') return GROUND_Y - STANDING_HEIGHT - state.jumpOffset
  if (state.playerState === 'ducking') return GROUND_Y - DUCK_HEIGHT
  return GROUND_Y - STANDING_HEIGHT
})
const playerHeight = computed(() => (state.playerState === 'ducking' ? DUCK_HEIGHT : STANDING_HEIGHT))

/** 私有工具方法：計時器管理、狀態同步 */
const _handlers = {
  syncState: () => {
    const snap = engine.getSnapshot()
    state.playerState = snap.playerState
    state.jumpOffset = snap.jumpOffset
    state.obstacles = snap.obstacles
    state.score = snap.score
    state.level = snap.level
  },
  stopTickTimer: () => {
    if (tickTimer) {
      clearInterval(tickTimer)
      tickTimer = null
    }
  },
  stopReadyTimer: () => {
    if (readyTimer) {
      clearInterval(readyTimer)
      readyTimer = null
    }
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
  obstacleStyle: (ob: Obstacle) => {
    const top = ob.type === 'ground' ? GROUND_Y - GROUND_OBSTACLE_HEIGHT : AIR_OBSTACLE_TOP
    const height = ob.type === 'ground' ? GROUND_OBSTACLE_HEIGHT : AIR_OBSTACLE_HEIGHT
    return `left: ${ob.x}px; top: ${top}px; width: ${ob.width}px; height: ${height}px;`
  }
}

const _actions = {
  recordHistory: async () => {
    state.rewardMessage = ''
    try {
      const result = await gameHistory.actions.record('runner', 'RUNNER', {
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
    state.status = 'gameover'
    state.message = '撞到障礙物了，遊戲結束。'
    state.resultOverlayVisible = true
    _handlers.stopTickTimer()
    _actions.recordHistory()
  },
  startTickLoop: () => {
    _handlers.stopTickTimer()
    tickTimer = setInterval(() => {
      if (state.status !== 'playing') return
      const result = engine.step()
      _handlers.syncState()
      if (result.gameOver) {
        _actions.finishGame()
      }
    }, TICK_MS)
  },
  resetGame: () => {
    _handlers.stopTickTimer()
    _handlers.stopReadyTimer()
    engine.reset()
    _handlers.syncState()
    state.status = 'ready'
    state.waitingOverlayVisible = true
    state.resultOverlayVisible = false
    state.readyOverlayVisible = false
    state.rewardMessage = ''
    state.message = '按「開始」後用 ↑/W 或空白鍵跳躍，↓/S 下蹲。'
  },
  startGame: () => {
    if (state.status === 'playing' || state.readyOverlayVisible) return
    if (state.status === 'gameover') _actions.resetGame()
    state.waitingOverlayVisible = false
    state.resultOverlayVisible = false
    _handlers.runReadyCountdown(() => {
      state.status = 'playing'
      state.message = '遊戲進行中...'
      _actions.startTickLoop()
    })
  },
  pauseGame: () => {
    if (state.status !== 'playing') return
    state.status = 'pause'
    state.message = '已暫停'
    _handlers.stopTickTimer()
  },
  resumeGame: () => {
    if (!canResumeFromPause.value) return
    state.status = 'playing'
    state.message = '遊戲進行中...'
    _actions.startTickLoop()
  },
  playAgain: () => {
    _actions.resetGame()
    _actions.startGame()
  },
  endGameNow: () => {
    _handlers.stopTickTimer()
    _handlers.stopReadyTimer()
    state.waitingOverlayVisible = false
    state.readyOverlayVisible = false
    state.status = 'gameover'
    state.message = '本局已結束。'
    state.resultOverlayVisible = true
    _actions.recordHistory()
  }
}

const onRunnerKeydown = (event: KeyboardEvent) => {
  if (state.status !== 'playing') return
  const key = event.key.toLowerCase()
  if (key === 'arrowup' || key === 'w' || key === ' ') {
    engine.jump()
    event.preventDefault()
  }
  if (key === 'arrowdown' || key === 's') {
    engine.setDuckHeld(true)
    event.preventDefault()
  }
}
const onRunnerKeyup = (event: KeyboardEvent) => {
  const key = event.key.toLowerCase()
  if (key === 'arrowdown' || key === 's') {
    engine.setDuckHeld(false)
  }
}

const click = {
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

onMounted(() => {
  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', onRunnerKeydown)
    window.addEventListener('keyup', onRunnerKeyup)
  }
  _actions.resetGame()
  state.waitingOverlayVisible = true
})

onBeforeUnmount(() => {
  _handlers.stopTickTimer()
  _handlers.stopReadyTimer()
  if (typeof window !== 'undefined') {
    window.removeEventListener('keydown', onRunnerKeydown)
    window.removeEventListener('keyup', onRunnerKeyup)
  }
})
</script>

<template>
  <main class="rn-page" :class="`state-${state.status}`">
    <div class="rn-overlay" />
    <div v-if="state.waitingOverlayVisible" class="game-mask waiting-mask">
      <div class="mask-title">WELCOME</div>
      <p class="waiting-subtitle">RUNNER</p>
      <button class="rn-btn waiting-btn waiting-start" type="button" @click="click.start">START</button>
      <button class="rn-btn link waiting-btn" type="button" @click="click.openRateDialog">CONVERT</button>
      <button class="rn-btn link waiting-btn" type="button" @click="click.openRuleDialog">RULE</button>
    </div>
    <div v-if="state.readyOverlayVisible" class="game-mask ready-mask">
      <div class="mask-title">READY</div>
      <div class="mask-count">{{ state.readyCountdownValue }}</div>
    </div>
    <div v-if="state.resultOverlayVisible" class="game-mask result-mask">
      <div class="mask-title">RESULT</div>
      <div class="result-list">
        <div class="result-item"><span>SCORE</span><b>{{ state.score }}</b></div>
        <div class="result-item"><span>LEVEL</span><b>{{ state.level }}</b></div>
      </div>
      <p v-if="state.rewardMessage" class="result-reward">{{ state.rewardMessage }}</p>
      <div class="result-actions">
        <button class="rn-btn" type="button" @click="click.again">AGAIN</button>
        <button class="rn-btn danger" type="button" @click="click.exit">EXIT</button>
      </div>
    </div>

    <GameRateDialog :visible="state.rateDialogOpen" game-key="runner" game-name="RUNNER" accent-color="#ffd400"
      @close="click.closeRateDialog" />
    <GameRuleDialog :visible="state.ruleDialogOpen" game-name="RUNNER" accent-color="#ffd400" v-bind="RUNNER_RULE"
      @close="click.closeRuleDialog" />

    <section class="rn-shell">
      <aside class="rn-side left">
        <button class="rn-btn" type="button" :disabled="!canResumeFromPause" @click="click.resume">START</button>
        <button class="rn-btn" type="button" :disabled="!canPauseWhilePlaying" @click="click.pause">PAUSE</button>
        <button class="rn-btn" type="button" @click="click.replay">REPLAY</button>
        <button class="rn-btn link" type="button" @click="click.end">END</button>
        <button class="rn-btn" type="button" @click="click.openRateDialog">CONVERT</button>
        <button class="rn-btn" type="button" @click="click.openRuleDialog">RULE</button>
      </aside>

      <section class="rn-center">
        <header class="rn-title-wrap">
          <h1 class="rn-title">RUNNER</h1>
          <p class="rn-status" :class="statusClass">{{ statusText }}</p>
        </header>

        <div class="rn-frame">
          <div class="rn-stage">
            <i class="rn-ground-line" />
            <div v-for="ob in state.obstacles" :key="ob.id" class="rn-obstacle" :class="ob.type"
              :style="_handlers.obstacleStyle(ob)" />
            <div class="rn-player" :class="state.playerState"
              :style="`top: ${playerTop}px; height: ${playerHeight}px;`" />
          </div>
          <div class="rn-panel">
            <span>SCORE: {{ state.score }}</span>
            <span>LEVEL: {{ state.level }}</span>
          </div>
        </div>

        <p class="rn-message">{{ state.message }}</p>
      </section>

      <aside class="rn-side right">
        <div class="rn-help-panel">
          <p class="rn-help-title">HOW TO PLAY</p>
          <p class="rn-help-text">↑/W/空白鍵跳躍閃避地面障礙，↓/S 下蹲閃避空中障礙；撞到任一障礙即結束，存活越久分數越高。</p>
        </div>
      </aside>
    </section>
  </main>
</template>

<style scoped lang="scss">
.rn-page {
  position: relative;
  min-height: 100vh;
  display: grid;
  place-items: center;
  background: radial-gradient(circle at top, #1a1600, #030200 60%);
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
    background: radial-gradient(circle at 20% 20%, rgba(255, 212, 0, 0.16), transparent 45%),
      radial-gradient(circle at 80% 70%, rgba(255, 230, 120, 0.1), transparent 40%);
    filter: blur(40px);
    animation: ambient-drift 12s ease-in-out infinite alternate;
  }

  &::after {
    background: linear-gradient(115deg, rgba(255, 212, 0, 0.05), rgba(0, 0, 0, 0));
    animation: ambient-pulse 4.6s ease-in-out infinite;
  }

  .rn-overlay {
    position: absolute;
    inset: 0;
    background-image: linear-gradient(rgba(255, 212, 0, 0.05) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255, 212, 0, 0.05) 1px, transparent 1px);
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
      color: #ffd400;
      font-size: clamp(2rem, 8vw, 4rem);
      letter-spacing: 0.25rem;
      font-weight: 900;
    }

    .mask-count {
      color: #ffd400;
      font-size: clamp(3rem, 12vw, 7rem);
      font-weight: 900;
      line-height: 1;
    }

    &.waiting-mask {
      background: rgba(0, 0, 0, 0.88);

      .waiting-subtitle {
        margin: 0;
        color: #ffe98f;
        letter-spacing: 0.3rem;
        font-size: 0.95rem;
      }

      .waiting-btn {
        width: 160px;
      }
    }

    &.result-mask {
      .result-list {
        display: grid;
        gap: 8px;
        width: 260px;
      }

      .result-item {
        display: flex;
        justify-content: space-between;
        border: 1px solid rgba(255, 212, 0, 0.4);
        background: rgba(40, 34, 0, 0.65);
        color: #ffe98f;
        padding: 8px 10px;
      }

      .result-reward {
        margin: 8px 0 0;
        color: #ffe066;
        font-size: 0.85rem;
        text-align: center;
        letter-spacing: 0.05em;
      }

      .result-actions {
        margin-top: 8px;
        display: flex;
        gap: 10px;
      }
    }
  }

  .rn-shell {
    position: relative;
    z-index: 1;
    width: min(1100px, 100%);
    padding: 24px;
    display: grid;
    grid-template-columns: 180px 1fr 180px;
    gap: 20px;
    align-items: center;
  }

  .rn-side {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .rn-btn {
    position: relative;
    overflow: hidden;
    border: 1px solid rgba(255, 212, 0, 0.4);
    border-radius: 6px;
    padding: 10px 12px;
    background: rgba(26, 22, 0, 0.75);
    color: #ffd400;
    font-weight: 700;
    letter-spacing: 0.5px;
    transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;

    &::after {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(105deg, transparent 35%, rgba(255, 244, 190, 0.25) 50%, transparent 65%);
      transform: translateX(-150%);
      transition: transform 0.35s ease;
      pointer-events: none;
    }

    &:hover {
      border-color: #ffd400;
      box-shadow: 0 0 12px rgba(255, 212, 0, 0.35);
      transform: translateY(-1px);

      &::after {
        transform: translateX(150%);
      }
    }

    &:disabled {
      opacity: 0.45;
      cursor: not-allowed;
      box-shadow: none;
    }

    &.link {
      text-align: center;
      text-decoration: none;
    }

    &.danger {
      border-color: rgba(255, 60, 60, 0.5);
      color: #ff7d7d;
    }
  }

  .rn-center {
    text-align: center;

    .rn-title-wrap {
      margin-bottom: 8px;
    }

    .rn-title {
      margin: 0;
      color: #ffd400;
      font-size: clamp(1.7rem, 5vw, 3rem);
      letter-spacing: 0.14rem;
      font-weight: 900;
      text-shadow: 0 0 14px rgba(255, 212, 0, 0.42);
      animation: title-float 2.6s ease-in-out infinite;
    }

    .rn-status {
      margin: 2px 0 0;
      color: #ffe98f;
      font-size: 0.9rem;
      letter-spacing: 0.2rem;

      &.is-playing {
        color: #ffd400;
      }

      &.is-pause {
        color: #ffcc33;
      }

      &.is-gameover {
        color: #ff5e5e;
      }
    }

    .rn-frame {
      width: fit-content;
      margin: 12px auto 0;
      padding: 14px;
      background: #1a1600;
      border: 10px solid #4a4012;
      border-radius: 18px;
      box-shadow: 0 0 0 1px rgba(255, 212, 0, 0.2), 0 0 24px rgba(255, 212, 0, 0.14);
      animation: frame-glow 5.4s ease-in-out infinite;
    }

    .rn-stage {
      box-sizing: content-box;
      position: relative;
      width: 500px;
      height: 230px;
      background: #0a0800;
      border: 2px solid #000;
      border-radius: 8px;
      overflow: hidden;

      .rn-ground-line {
        position: absolute;
        left: 0;
        right: 0;
        top: 200px;
        height: 2px;
        background: rgba(255, 212, 0, 0.35);
      }

      .rn-obstacle {
        position: absolute;
        border-radius: 3px;
        will-change: left;

        &.ground {
          background: #ff5e5e;
          box-shadow: 0 0 6px rgba(255, 94, 94, 0.6);
        }

        &.air {
          background: #5cc8ff;
          box-shadow: 0 0 6px rgba(92, 200, 255, 0.6);
        }
      }

      .rn-player {
        position: absolute;
        left: 60px;
        width: 30px;
        background: #ffd400;
        border-radius: 4px;
        box-shadow: 0 0 8px rgba(255, 212, 0, 0.6);
        transition: height 0.08s ease;
        will-change: top, height;

        &.jumping {
          background: #fff2b0;
        }

        &.ducking {
          background: #ffb700;
        }
      }
    }

    .rn-panel {
      margin-top: 10px;
      display: flex;
      justify-content: space-between;
      color: #ffd400;
      font-weight: 800;
      text-shadow: 0 0 6px rgba(255, 212, 0, 0.45);
    }

    .rn-message {
      margin-top: 14px;
      color: #ffe98f;
      font-size: 0.85rem;
      animation: subtle-fade 2.8s ease-in-out infinite;
    }
  }

  .rn-help-panel {
    border: 1px solid rgba(255, 212, 0, 0.3);
    border-radius: 8px;
    padding: 12px;
    background: rgba(26, 22, 0, 0.5);

    .rn-help-title {
      margin: 0 0 6px;
      color: #ffd400;
      font-size: 0.75rem;
      letter-spacing: 0.14rem;
      font-weight: 800;
    }

    .rn-help-text {
      margin: 0;
      color: #ffe98f;
      font-size: 0.78rem;
      line-height: 1.6;
    }
  }
}

@keyframes ambient-drift {
  0% {
    transform: translate(-1.5%, -1%) scale(1);
  }

  100% {
    transform: translate(1.5%, 1%) scale(1.06);
  }
}

@keyframes ambient-pulse {

  0%,
  100% {
    opacity: 0.35;
  }

  50% {
    opacity: 0.75;
  }
}

@keyframes grid-drift {
  0% {
    transform: translate(0, 0);
  }

  100% {
    transform: translate(14px, 14px);
  }
}

@keyframes title-float {

  0%,
  100% {
    transform: translateY(0);
  }

  50% {
    transform: translateY(-2px);
  }
}

@keyframes frame-glow {

  0%,
  100% {
    box-shadow: 0 0 0 1px rgba(255, 212, 0, 0.2), 0 0 24px rgba(255, 212, 0, 0.14);
  }

  50% {
    box-shadow: 0 0 0 1px rgba(255, 230, 140, 0.35), 0 0 40px rgba(255, 212, 0, 0.28);
  }
}

@keyframes subtle-fade {

  0%,
  100% {
    opacity: 0.7;
  }

  50% {
    opacity: 1;
  }
}

@media (max-width: 980px) {
  .rn-page {
    .rn-shell {
      grid-template-columns: 1fr;
      padding: 16px;
    }

    .rn-side {
      flex-direction: row;
      flex-wrap: wrap;
      justify-content: center;
    }
  }
}
</style>
