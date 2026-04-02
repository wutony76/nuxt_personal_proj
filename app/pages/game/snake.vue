<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'

type Direction = 'up' | 'down' | 'left' | 'right'
type Position = { x: number; y: number }
type SnakeStatus = 'ready' | 'playing' | 'pause' | 'gameover'
type SnakeSnapshot = {
  bodies: Position[]
  food: Position
  direction: Direction
  score: number
  level: number
  fruitCount: number
}
type SnakeStepResult = {
  gameOver: boolean
  ate: boolean
  boardFull?: boolean
}

class SnakeEngine {
  private bodies: Position[] = []
  private food: Position = { x: 0, y: 0 }
  private direction: Direction = 'right'
  private nextDirection: Direction | null = null
  private score = 0
  private level = 1
  private fruitCount = 0

  constructor(
    private readonly boardSize: number,
    private readonly baseSpeed: number
  ) {
    this.reset()
  }

  reset() {
    const spawn = this.randomFood([]) ?? { x: 0, y: 0 }
    this.bodies = [spawn]
    this.food = this.randomFood(this.bodies) ?? { x: 0, y: 0 }
    this.direction = 'right'
    this.nextDirection = null
    this.score = 0
    this.level = 1
    this.fruitCount = 0
  }

  setDirection(dir: Direction) {
    const isReverse =
      (this.direction === 'up' && dir === 'down') ||
      (this.direction === 'down' && dir === 'up') ||
      (this.direction === 'left' && dir === 'right') ||
      (this.direction === 'right' && dir === 'left')

    if (!isReverse) {
      this.nextDirection = dir
    }
  }

  step(): SnakeStepResult {
    if (this.nextDirection) {
      this.direction = this.nextDirection
      this.nextDirection = null
    }

    const head = this.bodies[0]
    if (!head) {
      return { gameOver: true, ate: false }
    }

    const nextHead = this.getNextHead(head, this.direction)
    const ate = nextHead.x === this.food.x && nextHead.y === this.food.y

    // If not eating, tail moves away this tick, so it should not count as collision.
    const collisionTargets = ate ? this.bodies : this.bodies.slice(0, -1)
    if (collisionTargets.some((b) => b.x === nextHead.x && b.y === nextHead.y)) {
      return { gameOver: true, ate: false }
    }

    const nextBodies = [nextHead, ...this.bodies]
    let boardFull = false

    if (!ate) {
      nextBodies.pop()
    } else {
      const nextFood = this.randomFood(nextBodies)
      if (nextFood) {
        this.food = nextFood
      } else {
        boardFull = true
      }
      this.fruitCount += 1
    }

    this.bodies = nextBodies
    this.score = Math.max(nextBodies.length - 1, 0)
    this.level = this.calcLevelByLength(this.score)

    return { gameOver: boardFull, ate, boardFull }
  }

  getTickSpeed() {
    return this.calcSpeedByLevel(this.level)
  }

  getSnapshot(): SnakeSnapshot {
    return {
      bodies: this.bodies.map((b) => ({ ...b })),
      food: { ...this.food },
      direction: this.direction,
      score: this.score,
      level: this.level,
      fruitCount: this.fruitCount
    }
  }

  private getNextHead(head: Position, direction: Direction): Position {
    const nextHead: Position = { x: head.x, y: head.y }

    if (direction === 'up') nextHead.y -= 1
    if (direction === 'down') nextHead.y += 1
    if (direction === 'left') nextHead.x -= 1
    if (direction === 'right') nextHead.x += 1

    if (nextHead.x < 0) nextHead.x = this.boardSize - 1
    if (nextHead.x >= this.boardSize) nextHead.x = 0
    if (nextHead.y < 0) nextHead.y = this.boardSize - 1
    if (nextHead.y >= this.boardSize) nextHead.y = 0

    return nextHead
  }

  private randomFood(occupied: Position[]): Position | null {
    const capacity = this.boardSize * this.boardSize
    if (occupied.length >= capacity) {
      return null
    }

    const occupiedSet = new Set(occupied.map((b) => `${b.x},${b.y}`))

    // Try random first for natural distribution.
    for (let i = 0; i < capacity; i += 1) {
      const candidate = {
        x: Math.floor(Math.random() * this.boardSize),
        y: Math.floor(Math.random() * this.boardSize)
      }
      if (!occupiedSet.has(`${candidate.x},${candidate.y}`)) {
        return candidate
      }
    }

    // Fallback deterministic scan to guarantee finding a free slot.
    for (let y = 0; y < this.boardSize; y += 1) {
      for (let x = 0; x < this.boardSize; x += 1) {
        if (!occupiedSet.has(`${x},${y}`)) {
          return { x, y }
        }
      }
    }

    return null
  }

  private calcLevelByLength(len: number) {
    if (len >= 90) return 6
    if (len >= 50) return 5
    if (len >= 30) return 4
    if (len >= 15) return 3
    if (len >= 5) return 2
    return 1
  }

  private calcSpeedByLevel(level: number) {
    switch (level) {
      case 2:
        return 220
      case 3:
        return 190
      case 4:
        return 165
      case 5:
        return 140
      case 6:
        return 118
      default:
        return this.baseSpeed
    }
  }
}

const CELL_SIZE = 10
const STAGE_BORDER_PX = 2
const STAGE_OUTER_PX = 304
const STAGE_INNER_PX = STAGE_OUTER_PX - STAGE_BORDER_PX * 2
const BOARD_SIZE = Math.floor(STAGE_INNER_PX / CELL_SIZE)
const BASE_SPEED = 260
const READY_START = 3

const router = useRouter()
const snakeEngine = new SnakeEngine(BOARD_SIZE, BASE_SPEED)
const snakeBodies = ref<Position[]>([{ x: 5, y: 5 }])
const snakeFood = ref<Position>({ x: 12, y: 12 })
const snakeDirection = ref<Direction>('right')
const snakeStatus = ref<SnakeStatus>('ready')
const snakeScore = ref(0)
const snakeLevel = ref(1)
const snakeFruitCount = ref(0)
const snakeMessage = ref('點「開始」遊玩，使用方向鍵或 WASD 控制。')
let snakeTimer: ReturnType<typeof setTimeout> | null = null
let readyTimer: ReturnType<typeof setInterval> | null = null
const waitingOverlayVisible = ref(true)
const readyOverlayVisible = ref(false)
const readyCountdownValue = ref(3)
const resultOverlayVisible = ref(false)
const fruitFlashActive = ref(false)
const stageShakeActive = ref(false)
let fruitEffectTimer: ReturnType<typeof setTimeout> | null = null

const snakeBoardStyle = computed(() => ({
  width: `${STAGE_OUTER_PX}px`,
  height: `${STAGE_OUTER_PX}px`
}))

const snakeStatusText = computed(() => {
  if (snakeStatus.value === 'playing') return 'PLAYING'
  if (snakeStatus.value === 'pause') return 'PAUSE'
  if (snakeStatus.value === 'gameover') return 'GAME OVER'
  return 'READY'
})

const snakeStatusClass = computed(() => {
  if (snakeStatus.value === 'playing') return 'is-playing'
  if (snakeStatus.value === 'pause') return 'is-pause'
  if (snakeStatus.value === 'gameover') return 'is-gameover'
  return 'is-ready'
})
const canResumeFromPause = computed(
  () =>
    snakeStatus.value === 'pause' &&
    !waitingOverlayVisible.value &&
    !readyOverlayVisible.value &&
    !resultOverlayVisible.value
)
const canPauseWhilePlaying = computed(() => snakeStatus.value === 'playing')

const snakeCellStyle = (pos: Position) => ({
  width: `${CELL_SIZE}px`,
  height: `${CELL_SIZE}px`,
  transform: `translate(${pos.x * CELL_SIZE}px, ${pos.y * CELL_SIZE}px)`
})

const syncSnakeState = () => {
  const snapshot = snakeEngine.getSnapshot()
  snakeBodies.value = snapshot.bodies
  snakeFood.value = snapshot.food
  snakeDirection.value = snapshot.direction
  snakeScore.value = snapshot.score
  snakeLevel.value = snapshot.level
  snakeFruitCount.value = snapshot.fruitCount
}

const stopSnakeTimer = () => {
  if (snakeTimer) {
    clearTimeout(snakeTimer)
    snakeTimer = null
  }
}

const stopReadyTimer = () => {
  if (readyTimer) {
    clearInterval(readyTimer)
    readyTimer = null
  }
}

const stopFruitEffectTimer = () => {
  if (fruitEffectTimer) {
    clearTimeout(fruitEffectTimer)
    fruitEffectTimer = null
  }
}

const triggerEatEffect = () => {
  stopFruitEffectTimer()
  fruitFlashActive.value = true
  stageShakeActive.value = true
  fruitEffectTimer = setTimeout(() => {
    fruitFlashActive.value = false
    stageShakeActive.value = false
    fruitEffectTimer = null
  }, 180)
}

const runReadyCountdown = (onDone: () => void) => {
  stopReadyTimer()
  readyOverlayVisible.value = true
  readyCountdownValue.value = READY_START
  readyTimer = setInterval(() => {
    if (readyCountdownValue.value <= 1) {
      stopReadyTimer()
      readyOverlayVisible.value = false
      onDone()
      return
    }
    readyCountdownValue.value -= 1
  }, 700)
}

const snakeStep = () => {
  if (snakeStatus.value !== 'playing') return

  const stepResult = snakeEngine.step()
  if (stepResult.gameOver) {
    snakeStatus.value = 'gameover'
    snakeMessage.value = stepResult.boardFull ? '恭喜通關！棋盤已滿。' : '撞到自己了，遊戲結束。'
    resultOverlayVisible.value = true
    stopSnakeTimer()
    return
  }
  syncSnakeState()
  if (stepResult.ate) {
    triggerEatEffect()
  }
}

const snakeLoop = () => {
  snakeStep()
  if (snakeStatus.value !== 'playing') return
  snakeTimer = setTimeout(snakeLoop, snakeEngine.getTickSpeed())
}

const resetSnake = () => {
  stopSnakeTimer()
  stopReadyTimer()
  stopFruitEffectTimer()
  snakeEngine.reset()
  syncSnakeState()
  snakeStatus.value = 'ready'
  waitingOverlayVisible.value = true
  resultOverlayVisible.value = false
  readyOverlayVisible.value = false
  fruitFlashActive.value = false
  stageShakeActive.value = false
  snakeMessage.value = '點「開始」遊玩，使用方向鍵或 WASD 控制。'
}

const updateSnakeDirection = (dir: Direction) => {
  snakeEngine.setDirection(dir)
}

const onSnakeKeydown = (event: KeyboardEvent) => {
  if (waitingOverlayVisible.value || readyOverlayVisible.value || resultOverlayVisible.value) return
  const key = event.key.toLowerCase()
  let handled = false
  if (key === 'arrowup' || key === 'w') {
    updateSnakeDirection('up')
    handled = true
  }
  if (key === 'arrowdown' || key === 's') {
    updateSnakeDirection('down')
    handled = true
  }
  if (key === 'arrowleft' || key === 'a') {
    updateSnakeDirection('left')
    handled = true
  }
  if (key === 'arrowright' || key === 'd') {
    updateSnakeDirection('right')
    handled = true
  }
  if (handled) {
    event.preventDefault()
  }
}

const startSnake = () => {
  if (snakeStatus.value === 'playing' || readyOverlayVisible.value) return
  if (snakeStatus.value === 'gameover') resetSnake()
  waitingOverlayVisible.value = false
  resultOverlayVisible.value = false
  runReadyCountdown(() => {
    snakeStatus.value = 'playing'
    snakeMessage.value = '遊戲進行中...'
    stopSnakeTimer()
    snakeTimer = setTimeout(snakeLoop, snakeEngine.getTickSpeed())
  })
}

const pauseSnake = () => {
  if (snakeStatus.value !== 'playing') return
  snakeStatus.value = 'pause'
  snakeMessage.value = '已暫停'
  stopSnakeTimer()
  stopReadyTimer()
}

const resumeSnake = () => {
  if (!canResumeFromPause.value) return
  snakeStatus.value = 'playing'
  snakeMessage.value = '遊戲進行中...'
  stopSnakeTimer()
  snakeTimer = setTimeout(snakeLoop, snakeEngine.getTickSpeed())
}

const playAgain = () => {
  resetSnake()
  startSnake()
}

const startFromWaiting = () => {
  startSnake()
}

const endGameNow = () => {
  stopSnakeTimer()
  stopReadyTimer()
  stopFruitEffectTimer()
  fruitFlashActive.value = false
  stageShakeActive.value = false
  waitingOverlayVisible.value = false
  readyOverlayVisible.value = false
  snakeStatus.value = 'gameover'
  snakeMessage.value = '本局已結束。'
  resultOverlayVisible.value = true
}

const exitResultToWelcome = () => {
  router.replace('/game-hall')
}

onMounted(() => {
  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', onSnakeKeydown)
  }
  resetSnake()
  waitingOverlayVisible.value = true
})

onUnmounted(() => {
  stopSnakeTimer()
  stopReadyTimer()
  stopFruitEffectTimer()
  if (typeof window !== 'undefined') {
    window.removeEventListener('keydown', onSnakeKeydown)
  }
})
</script>

<template>
  <main class="snake-page" :class="`state-${snakeStatus}`">
    <div class="snake-overlay" />
    <div v-if="waitingOverlayVisible" class="game-mask waiting-mask">
      <div class="mask-title">WELCOME</div>
      <p class="waiting-subtitle">SNAKE GAME</p>
      <button class="snake-btn waiting-start" type="button" @click="startFromWaiting">START</button>
    </div>
    <div v-if="readyOverlayVisible" class="game-mask ready-mask">
      <div class="mask-title">READY</div>
      <div class="mask-count">{{ readyCountdownValue }}</div>
    </div>
    <div v-if="resultOverlayVisible" class="game-mask result-mask">
      <div class="mask-title">RESULT</div>
      <div class="result-list">
        <div class="result-item"><span>SCORE</span><b>{{ snakeScore }}</b></div>
        <div class="result-item"><span>LEVEL</span><b>{{ snakeLevel }}</b></div>
        <div class="result-item"><span>FRUIT</span><b>{{ snakeFruitCount }}</b></div>
      </div>
      <div class="result-actions">
        <button class="snake-btn" type="button" @click="playAgain">AGAIN</button>
        <button class="snake-btn danger" type="button" @click="exitResultToWelcome">EXIT</button>
      </div>
    </div>
    <section class="snake-shell">
      <aside class="snake-side left">
        <button class="snake-btn" type="button" :disabled="!canResumeFromPause" @click="resumeSnake">START</button>
        <button class="snake-btn" type="button" :disabled="!canPauseWhilePlaying" @click="pauseSnake">PAUSE</button>
        <button class="snake-btn" type="button" @click="resetSnake">REPLAY</button>
        <button class="snake-btn link" type="button" @click="endGameNow">END</button>
      </aside>

      <section class="snake-center">
        <header class="snake-title-wrap">
          <h1 class="snake-title">SNAKE</h1>
          <p class="snake-status" :class="snakeStatusClass">{{ snakeStatusText }}</p>
        </header>

        <div class="snake-frame">
          <div class="snake-stage" :class="{ 'fruit-flash': fruitFlashActive, 'stage-shake': stageShakeActive }"
            :style="snakeBoardStyle">
            <i class="snake-scan" :class="{ active: snakeStatus === 'playing' }" />
            <div class="snake-food" :style="snakeCellStyle(snakeFood)" />
            <div v-for="(body, idx) in snakeBodies" :key="`${body.x}-${body.y}-${idx}`" class="snake-segment"
              :class="idx === 0 ? 'head' : 'body'" :style="snakeCellStyle(body)" />
          </div>
          <div class="snake-panel">
            <span>SCORE: {{ snakeScore }}</span>
            <span>LEVEL: {{ snakeLevel }}</span>
            <span>FRUIT: {{ snakeFruitCount }}</span>
          </div>
        </div>

        <p class="snake-message">{{ snakeMessage }}</p>
      </section>

      <aside class="snake-side right">
        <div class="snake-keypad">
          <button class="snake-btn key up" type="button" @click="updateSnakeDirection('up')">↑</button>
          <button class="snake-btn key left" type="button" @click="updateSnakeDirection('left')">←</button>
          <button class="snake-btn key down" type="button" @click="updateSnakeDirection('down')">↓</button>
          <button class="snake-btn key right" type="button" @click="updateSnakeDirection('right')">→</button>
        </div>
        <div class="snake-help">W A S D / Arrow Keys</div>
      </aside>
    </section>
  </main>
</template>

<style scoped lang="scss">
.snake-page {
  position: relative;
  min-height: 100vh;
  display: grid;
  place-items: center;
  // background: radial-gradient(circle at top, #102510, #030603 60%);
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
    background: radial-gradient(circle at 20% 20%, rgba(24, 255, 120, 0.18), transparent 45%),
      radial-gradient(circle at 80% 70%, rgba(32, 180, 255, 0.12), transparent 40%);
    filter: blur(40px);
    animation: ambient-drift 12s ease-in-out infinite alternate;
  }

  &::after {
    background: linear-gradient(115deg, rgba(50, 255, 180, 0.04), rgba(0, 0, 0, 0));
    animation: ambient-pulse 4.6s ease-in-out infinite;
  }

  .snake-overlay {
    position: absolute;
    inset: 0;
    background-image: linear-gradient(rgba(0, 255, 120, 0.05) 1px,
        transparent 1px),
      linear-gradient(90deg, rgba(0, 255, 120, 0.05) 1px, transparent 1px);
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
      color: #20ff20;
      font-size: clamp(2rem, 8vw, 4rem);
      letter-spacing: 0.25rem;
      font-weight: 900;
    }

    .mask-count {
      color: #20ff20;
      font-size: clamp(3rem, 12vw, 7rem);
      font-weight: 900;
      line-height: 1;
    }

    &.waiting-mask {
      background: rgba(0, 0, 0, 0.88);

      .waiting-subtitle {
        margin: 0;
        color: #83ff83;
        letter-spacing: 0.3rem;
        font-size: 0.95rem;
      }

      .waiting-start {
        min-width: 160px;
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
        border: 1px solid rgba(32, 255, 32, 0.4);
        background: rgba(0, 40, 0, 0.65);
        color: #8dff8d;
        padding: 8px 10px;
      }

      .result-actions {
        margin-top: 8px;
        display: flex;
        gap: 10px;
      }
    }
  }

  .snake-shell {
    position: relative;
    z-index: 1;
    width: min(1100px, 100%);
    padding: 24px;
    display: grid;
    grid-template-columns: 180px 1fr 180px;
    gap: 20px;
    align-items: center;
  }

  .snake-side {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .snake-btn {
    position: relative;
    overflow: hidden;
    border: 1px solid rgba(0, 255, 100, 0.4);
    border-radius: 6px;
    padding: 10px 12px;
    background: rgba(0, 20, 0, 0.75);
    color: #23ff23;
    font-weight: 700;
    letter-spacing: 0.5px;
    transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;

    &::after {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(105deg, transparent 35%, rgba(200, 255, 200, 0.25) 50%, transparent 65%);
      transform: translateX(-150%);
      transition: transform 0.35s ease;
      pointer-events: none;
    }

    &:hover {
      border-color: #22ff22;
      box-shadow: 0 0 12px rgba(34, 255, 34, 0.35);
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

  .snake-center {
    text-align: center;

    .snake-title-wrap {
      margin-bottom: 8px;
    }

    .snake-title {
      margin: 0;
      color: #22ff22;
      font-size: clamp(2rem, 6vw, 3.6rem);
      letter-spacing: 0.2rem;
      font-weight: 900;
      text-shadow: 0 0 14px rgba(32, 255, 32, 0.42);
      animation: title-float 2.6s ease-in-out infinite;
    }

    .snake-status {
      margin: 2px 0 0;
      color: #9eff9e;
      font-size: 0.9rem;
      letter-spacing: 0.2rem;

      &.is-playing {
        color: #48ff48;
      }

      &.is-pause {
        color: #ffcc33;
      }

      &.is-gameover {
        color: #ff5e5e;
      }
    }

    .snake-frame {
      width: 360px;
      height: 420px;
      margin: 12px auto 0;
      background: #b7d4a8;
      border: 10px solid #86c896;
      border-radius: 18px;
      display: flex;
      flex-direction: column;
      justify-content: space-around;
      align-items: center;
      box-shadow: 0 0 0 1px rgba(160, 210, 130, 0.2), 0 0 24px rgba(20, 255, 80, 0.14);
      animation: frame-glow 5.4s ease-in-out infinite, frame-border-breathe 14s ease-in-out infinite;
    }

    .snake-stage {
      position: relative;
      border: 2px solid #111;
      background: #b7d4a8;
      overflow: hidden;

      &.fruit-flash {
        animation: stage-flash 180ms ease-out;
      }

      &.stage-shake {
        animation: stage-shake 170ms ease-out;
      }

      .snake-food,
      .snake-segment {
        position: absolute;
        box-sizing: border-box;
      }

      .snake-food {
        background: #c53b33;
      }

      .snake-segment {
        &.body {
          background: #111;
          border: 1px solid #b7d4a8;
        }

        &.head {
          background: #f00;
          border: 1px solid #b7d4a8;
        }
      }

      .snake-scan {
        position: absolute;
        inset: -40% -50%;
        pointer-events: none;
        transform: translateY(-120%) rotate(-24deg);
        background-image: linear-gradient(to bottom,
            rgba(255, 255, 255, 0),
            rgba(120, 190, 255, 0.22),
            rgba(255, 255, 255, 0));

        &.active {
          animation: scan-move 2.2s linear infinite;
        }
      }
    }

    .snake-panel {
      position: relative;
      overflow: hidden;
      width: 304px;
      display: flex;
      justify-content: space-between;
      color: #f00;
      font-weight: 800;
      text-shadow: 0 0 6px rgba(255, 0, 0, 0.45);

      &::after {
        content: '';
        position: absolute;
        inset: 0;
        background: linear-gradient(90deg, transparent, rgba(120, 200, 255, 0.28), transparent);
        transform: translateX(-120%);
        animation: hud-scan 3.4s linear infinite;
      }
    }

    .snake-message {
      margin-top: 14px;
      color: #76ff76;
      font-size: 0.85rem;
      animation: subtle-fade 2.8s ease-in-out infinite;
    }
  }

  .snake-help {
    margin-top: 4px;
    color: #7fff7f;
    font-size: 0.8rem;
    text-align: center;
  }

  .snake-keypad {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    grid-template-rows: repeat(2, 1fr);
    gap: 8px;

    .key {
      min-width: 52px;
      min-height: 52px;
      display: grid;
      place-items: center;
      font-size: 1.15rem;
      line-height: 1;
    }

    .up {
      grid-column: 2;
      grid-row: 1;
    }

    .left {
      grid-column: 1;
      grid-row: 2;
    }

    .down {
      grid-column: 2;
      grid-row: 2;
    }

    .right {
      grid-column: 3;
      grid-row: 2;
    }
  }
}

@keyframes scan-move {
  0% {
    transform: translateY(-120%) rotate(-24deg);
  }

  100% {
    transform: translateY(120%) rotate(-24deg);
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
    box-shadow: 0 0 0 1px rgba(160, 210, 130, 0.24), 0 0 28px rgba(20, 255, 80, 0.18);
  }

  35% {
    box-shadow: 0 0 0 1px rgba(190, 240, 150, 0.42), 0 0 46px rgba(55, 255, 120, 0.34);
  }

  70% {
    box-shadow: 0 0 0 1px rgba(150, 230, 190, 0.36), 0 0 40px rgba(60, 230, 170, 0.28);
  }
}

@keyframes frame-border-breathe {
  0%,
  100% {
    border-color: #7fbf8f;
  }

  35% {
    border-color: #93d5a4;
  }

  70% {
    border-color: #7dc8a9;
  }
}

@keyframes stage-flash {
  0% {
    box-shadow: inset 0 0 0 0 rgba(255, 255, 210, 0.95);
    filter: brightness(1.32) saturate(1.15);
  }

  100% {
    box-shadow: inset 0 0 0 22px rgba(255, 255, 210, 0);
    filter: brightness(1) saturate(1);
  }
}

@keyframes stage-shake {
  0% {
    transform: translate3d(0, 0, 0);
  }

  25% {
    transform: translate3d(-2px, 1px, 0);
  }

  50% {
    transform: translate3d(2px, -1px, 0);
  }

  75% {
    transform: translate3d(-1px, 1px, 0);
  }

  100% {
    transform: translate3d(0, 0, 0);
  }
}

@keyframes hud-scan {
  0% {
    transform: translateX(-120%);
  }

  100% {
    transform: translateX(120%);
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
  .snake-page {
    .snake-shell {
      grid-template-columns: 1fr;
      padding: 16px;
    }

    .snake-side {
      flex-direction: row;
      flex-wrap: wrap;
      justify-content: center;
    }
  }
}
</style>
