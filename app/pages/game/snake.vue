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
    const spawn = this.randomFood([])
    this.bodies = [spawn]
    this.food = this.randomFood(this.bodies)
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

  step() {
    if (this.nextDirection) {
      this.direction = this.nextDirection
      this.nextDirection = null
    }

    const head = this.bodies[0]
    if (!head) {
      return { gameOver: true }
    }

    const nextHead = this.getNextHead(head, this.direction)

    if (this.bodies.some((b) => b.x === nextHead.x && b.y === nextHead.y)) {
      return { gameOver: true }
    }

    const nextBodies = [nextHead, ...this.bodies]
    const ate = nextHead.x === this.food.x && nextHead.y === this.food.y

    if (!ate) {
      nextBodies.pop()
    } else {
      this.food = this.randomFood(nextBodies)
      this.fruitCount += 1
    }

    this.bodies = nextBodies
    this.score = Math.max(nextBodies.length - 1, 0)
    this.level = this.calcLevelByLength(this.score)

    return { gameOver: false }
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

  private randomFood(occupied: Position[]) {
    while (true) {
      const next = {
        x: Math.floor(Math.random() * this.boardSize),
        y: Math.floor(Math.random() * this.boardSize)
      }
      if (!occupied.some((b) => b.x === next.x && b.y === next.y)) {
        return next
      }
    }
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
let snakeNextDirection: Direction | null = null
const waitingOverlayVisible = ref(true)
const readyOverlayVisible = ref(false)
const readyCountdownValue = ref(3)
const resultOverlayVisible = ref(false)

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
    snakeMessage.value = '撞到自己了，遊戲結束。'
    resultOverlayVisible.value = true
    stopSnakeTimer()
    return
  }
  syncSnakeState()
}

const snakeLoop = () => {
  snakeStep()
  if (snakeStatus.value !== 'playing') return
  snakeTimer = setTimeout(snakeLoop, snakeEngine.getTickSpeed())
}

const resetSnake = () => {
  stopSnakeTimer()
  stopReadyTimer()
  snakeEngine.reset()
  syncSnakeState()
  snakeStatus.value = 'ready'
  waitingOverlayVisible.value = true
  resultOverlayVisible.value = false
  readyOverlayVisible.value = false
  snakeMessage.value = '點「開始」遊玩，使用方向鍵或 WASD 控制。'
}

const updateSnakeDirection = (dir: Direction) => {
  snakeEngine.setDirection(dir)
}

const onSnakeKeydown = (event: KeyboardEvent) => {
  if (waitingOverlayVisible.value || readyOverlayVisible.value || resultOverlayVisible.value) return
  const key = event.key.toLowerCase()
  if (key === 'arrowup' || key === 'w') updateSnakeDirection('up')
  if (key === 'arrowdown' || key === 's') updateSnakeDirection('down')
  if (key === 'arrowleft' || key === 'a') updateSnakeDirection('left')
  if (key === 'arrowright' || key === 'd') updateSnakeDirection('right')
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

const exitGame = () => {
  router.push('/game-hall')
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
  if (typeof window !== 'undefined') {
    window.removeEventListener('keydown', onSnakeKeydown)
  }
})
</script>

<template>
  <main class="snake-page">
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
        <button class="snake-btn danger" type="button" @click="exitGame">EXIT</button>
      </div>
    </div>
    <section class="snake-shell">
      <aside class="snake-side left">
        <button class="snake-btn" type="button" :disabled="!canResumeFromPause" @click="resumeSnake">START</button>
        <button class="snake-btn" type="button" :disabled="!canPauseWhilePlaying" @click="pauseSnake">PAUSE</button>
        <button class="snake-btn" type="button" @click="resetSnake">REPLAY</button>
        <NuxtLink class="snake-btn link" to="/game-hall">BACK</NuxtLink>
      </aside>

      <section class="snake-center">
        <header class="snake-title-wrap">
          <h1 class="snake-title">SNAKE</h1>
          <p class="snake-status" :class="snakeStatusClass">{{ snakeStatusText }}</p>
        </header>

        <div class="snake-frame">
          <div class="snake-stage" :style="snakeBoardStyle">
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
  background: radial-gradient(circle at top, #102510, #030603 60%);
  overflow: hidden;

  .snake-overlay {
    position: absolute;
    inset: 0;
    background-image: linear-gradient(rgba(0, 255, 120, 0.05) 1px,
        transparent 1px),
      linear-gradient(90deg, rgba(0, 255, 120, 0.05) 1px, transparent 1px);
    background-size: 28px 28px;
    pointer-events: none;
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
    border: 1px solid rgba(0, 255, 100, 0.4);
    border-radius: 6px;
    padding: 10px 12px;
    background: rgba(0, 20, 0, 0.75);
    color: #23ff23;
    font-weight: 700;
    letter-spacing: 0.5px;

    &:hover {
      border-color: #22ff22;
      box-shadow: 0 0 12px rgba(34, 255, 34, 0.35);
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
      border: 10px solid #101010;
      border-radius: 18px;
      display: flex;
      flex-direction: column;
      justify-content: space-around;
      align-items: center;
    }

    .snake-stage {
      position: relative;
      border: 2px solid #111;
      background: #b7d4a8;
      overflow: hidden;

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
            rgba(240, 255, 220, 0.18),
            rgba(255, 255, 255, 0));

        &.active {
          animation: scan-move 2.2s linear infinite;
        }
      }
    }

    .snake-panel {
      width: 304px;
      display: flex;
      justify-content: space-between;
      color: #f00;
      font-weight: 800;
    }

    .snake-message {
      margin-top: 14px;
      color: #76ff76;
      font-size: 0.85rem;
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
