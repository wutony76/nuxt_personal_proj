<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'

type GameStatus = 'ready' | 'playing' | 'pause' | 'gameover'
type PieceType = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L'
type ActivePiece = {
  type: PieceType
  matrix: number[][]
  x: number
  y: number
}
type Snapshot = {
  board: number[][]
  active: ActivePiece | null
  score: number
  level: number
  lineCount: number
}

const PIECE_ID: Record<PieceType, number> = {
  I: 1,
  O: 2,
  T: 3,
  S: 4,
  Z: 5,
  J: 6,
  L: 7
}

const BASE_SHAPES: Record<PieceType, number[][]> = {
  I: [[1, 1, 1, 1]],
  O: [
    [1, 1],
    [1, 1]
  ],
  T: [
    [0, 1, 0],
    [1, 1, 1]
  ],
  S: [
    [0, 1, 1],
    [1, 1, 0]
  ],
  Z: [
    [1, 1, 0],
    [0, 1, 1]
  ],
  J: [
    [1, 0, 0],
    [1, 1, 1]
  ],
  L: [
    [0, 0, 1],
    [1, 1, 1]
  ]
}

class TetriminosEngine {
  private readonly rows = 20
  private readonly cols = 12
  private board: number[][] = []
  private active: ActivePiece | null = null
  private score = 0
  private level = 1
  private lineCount = 0

  reset() {
    this.board = Array.from({ length: this.rows }, () => Array.from({ length: this.cols }, () => 0))
    this.active = null
    this.score = 0
    this.level = 1
    this.lineCount = 0
    return this.spawnPiece()
  }

  getTickMs() {
    const base = 520
    const min = 120
    return Math.max(min, base - (this.level - 1) * 40 - Math.floor(this.lineCount / 2) * 6)
  }

  stepDown() {
    if (!this.active) return { gameOver: false, cleared: 0 }
    if (this.canPlace(this.active.matrix, this.active.x, this.active.y + 1)) {
      this.active.y += 1
      return { gameOver: false, cleared: 0 }
    }
    this.mergeActiveToBoard()
    const cleared = this.clearLines()
    const spawnOk = this.spawnPiece()
    return { gameOver: !spawnOk, cleared }
  }

  moveLeft() {
    if (!this.active) return
    if (this.canPlace(this.active.matrix, this.active.x - 1, this.active.y)) {
      this.active.x -= 1
    }
  }

  moveRight() {
    if (!this.active) return
    if (this.canPlace(this.active.matrix, this.active.x + 1, this.active.y)) {
      this.active.x += 1
    }
  }

  rotate() {
    if (!this.active) return
    const rotated = this.rotateMatrixCW(this.active.matrix)
    if (this.canPlace(rotated, this.active.x, this.active.y)) {
      this.active.matrix = rotated
      return
    }
    const kicks = [-1, 1, -2, 2]
    for (const offset of kicks) {
      if (this.canPlace(rotated, this.active.x + offset, this.active.y)) {
        this.active.x += offset
        this.active.matrix = rotated
        return
      }
    }
  }

  softDrop() {
    return this.stepDown()
  }

  getSnapshot(): Snapshot {
    return {
      board: this.board.map((r) => [...r]),
      active: this.active
        ? {
          type: this.active.type,
          matrix: this.active.matrix.map((r) => [...r]),
          x: this.active.x,
          y: this.active.y
        }
        : null,
      score: this.score,
      level: this.level,
      lineCount: this.lineCount
    }
  }

  private spawnPiece() {
    const types: PieceType[] = ['I', 'O', 'T', 'S', 'Z', 'J', 'L']
    const type = types[Math.floor(Math.random() * types.length)] ?? 'T'
    const matrix = BASE_SHAPES[type].map((r) => [...r])
    const x = Math.floor((this.cols - matrix[0].length) / 2)
    const y = 0
    if (!this.canPlace(matrix, x, y)) {
      return false
    }
    this.active = { type, matrix, x, y }
    return true
  }

  private canPlace(matrix: number[][], x: number, y: number) {
    for (let r = 0; r < matrix.length; r += 1) {
      for (let c = 0; c < matrix[r].length; c += 1) {
        if (!matrix[r][c]) continue
        const nx = x + c
        const ny = y + r
        if (nx < 0 || nx >= this.cols || ny < 0 || ny >= this.rows) {
          return false
        }
        if (this.board[ny]?.[nx]) {
          return false
        }
      }
    }
    return true
  }

  private mergeActiveToBoard() {
    if (!this.active) return
    const id = PIECE_ID[this.active.type]
    for (let r = 0; r < this.active.matrix.length; r += 1) {
      for (let c = 0; c < this.active.matrix[r].length; c += 1) {
        if (!this.active.matrix[r][c]) continue
        const nx = this.active.x + c
        const ny = this.active.y + r
        if (ny >= 0 && ny < this.rows && nx >= 0 && nx < this.cols) {
          this.board[ny][nx] = id
        }
      }
    }
    this.active = null
  }

  private clearLines() {
    let cleared = 0
    this.board = this.board.filter((row) => {
      if (row.every((v) => v > 0)) {
        cleared += 1
        return false
      }
      return true
    })
    while (this.board.length < this.rows) {
      this.board.unshift(Array.from({ length: this.cols }, () => 0))
    }
    if (cleared > 0) {
      this.lineCount += cleared
      this.score += cleared * 100 + (cleared - 1) * 50
      this.level = Math.min(9, 1 + Math.floor(this.lineCount / 10))
    }
    return cleared
  }

  private rotateMatrixCW(matrix: number[][]) {
    const h = matrix.length
    const w = matrix[0]?.length ?? 0
    const next: number[][] = Array.from({ length: w }, () => Array.from({ length: h }, () => 0))
    for (let r = 0; r < h; r += 1) {
      for (let c = 0; c < w; c += 1) {
        next[c][h - 1 - r] = matrix[r][c]
      }
    }
    return next
  }
}

const router = useRouter()
const engine = new TetriminosEngine()

const gameStatus = ref<GameStatus>('ready')
const waitingOverlayVisible = ref(true)
const readyOverlayVisible = ref(false)
const readyCountdownValue = ref(3)
const resultOverlayVisible = ref(false)
const message = ref('按 START 開始，方向鍵移動，↑ 旋轉，↓ 加速。')

const boardView = ref<number[][]>([])
const score = ref(0)
const level = ref(1)
const lineCount = ref(0)

let gameTimer: ReturnType<typeof setTimeout> | null = null
let readyTimer: ReturnType<typeof setInterval> | null = null

const statusText = computed(() => {
  if (gameStatus.value === 'playing') return 'PLAYING'
  if (gameStatus.value === 'pause') return 'PAUSE'
  if (gameStatus.value === 'gameover') return 'GAME OVER'
  return 'READY'
})

const canResumeFromPause = computed(
  () =>
    gameStatus.value === 'pause' &&
    !waitingOverlayVisible.value &&
    !readyOverlayVisible.value &&
    !resultOverlayVisible.value
)
const canPauseWhilePlaying = computed(() => gameStatus.value === 'playing')

const rebuildBoardView = () => {
  const snap = engine.getSnapshot()
  const merged = snap.board.map((r) => [...r])
  if (snap.active) {
    const id = PIECE_ID[snap.active.type]
    for (let r = 0; r < snap.active.matrix.length; r += 1) {
      for (let c = 0; c < snap.active.matrix[r].length; c += 1) {
        if (!snap.active.matrix[r][c]) continue
        const y = snap.active.y + r
        const x = snap.active.x + c
        if (y >= 0 && y < merged.length && x >= 0 && x < merged[0].length) {
          merged[y][x] = id
        }
      }
    }
  }
  boardView.value = merged
  score.value = snap.score
  level.value = snap.level
  lineCount.value = snap.lineCount
}

const stopGameTimer = () => {
  if (!gameTimer) return
  clearTimeout(gameTimer)
  gameTimer = null
}

const stopReadyTimer = () => {
  if (!readyTimer) return
  clearInterval(readyTimer)
  readyTimer = null
}

const runReadyCountdown = (onDone: () => void) => {
  stopReadyTimer()
  readyOverlayVisible.value = true
  readyCountdownValue.value = 3
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

const gameStep = () => {
  if (gameStatus.value !== 'playing') return
  const result = engine.stepDown()
  rebuildBoardView()
  if (result.gameOver) {
    gameStatus.value = 'gameover'
    message.value = '堆到頂了，遊戲結束。'
    resultOverlayVisible.value = true
    stopGameTimer()
  }
}

const gameLoop = () => {
  gameStep()
  if (gameStatus.value !== 'playing') return
  gameTimer = setTimeout(gameLoop, engine.getTickMs())
}

const resetGame = () => {
  stopGameTimer()
  stopReadyTimer()
  engine.reset()
  rebuildBoardView()
  gameStatus.value = 'ready'
  waitingOverlayVisible.value = true
  readyOverlayVisible.value = false
  resultOverlayVisible.value = false
  message.value = '按 START 開始，方向鍵移動，↑ 旋轉，↓ 加速。'
}

const startGame = () => {
  if (gameStatus.value === 'playing' || readyOverlayVisible.value) return
  waitingOverlayVisible.value = false
  resultOverlayVisible.value = false
  runReadyCountdown(() => {
    gameStatus.value = 'playing'
    message.value = '方塊下落中...'
    stopGameTimer()
    gameTimer = setTimeout(gameLoop, engine.getTickMs())
  })
}

const pauseGame = () => {
  if (gameStatus.value !== 'playing') return
  gameStatus.value = 'pause'
  message.value = '已暫停'
  stopGameTimer()
  stopReadyTimer()
}

const resumeGame = () => {
  if (!canResumeFromPause.value) return
  gameStatus.value = 'playing'
  message.value = '方塊下落中...'
  stopGameTimer()
  gameTimer = setTimeout(gameLoop, engine.getTickMs())
}

const playAgain = () => {
  resetGame()
  startGame()
}

const endGameNow = () => {
  stopGameTimer()
  stopReadyTimer()
  waitingOverlayVisible.value = false
  readyOverlayVisible.value = false
  gameStatus.value = 'gameover'
  message.value = '本局已結束。'
  resultOverlayVisible.value = true
}

const exitToGameHall = () => {
  router.replace('/game-hall')
}

const moveLeft = () => {
  engine.moveLeft()
  rebuildBoardView()
}

const moveRight = () => {
  engine.moveRight()
  rebuildBoardView()
}

const rotate = () => {
  engine.rotate()
  rebuildBoardView()
}

const softDrop = () => {
  if (gameStatus.value !== 'playing') return
  engine.softDrop()
  rebuildBoardView()
}

const onKeydown = (event: KeyboardEvent) => {
  if (waitingOverlayVisible.value || readyOverlayVisible.value || resultOverlayVisible.value) return
  const key = event.key.toLowerCase()
  if (key === 'arrowleft' || key === 'a') {
    moveLeft()
    event.preventDefault()
  }
  if (key === 'arrowright' || key === 'd') {
    moveRight()
    event.preventDefault()
  }
  if (key === 'arrowup' || key === 'w') {
    rotate()
    event.preventDefault()
  }
  if (key === 'arrowdown' || key === 's') {
    softDrop()
    event.preventDefault()
  }
}

onMounted(() => {
  resetGame()
  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', onKeydown)
  }
})

onUnmounted(() => {
  stopGameTimer()
  stopReadyTimer()
  if (typeof window !== 'undefined') {
    window.removeEventListener('keydown', onKeydown)
  }
})
</script>

<template>
  <main class="tetri-page">
    <div class="tetri-overlay" />

    <div v-if="waitingOverlayVisible" class="game-mask waiting-mask">
      <div class="mask-title">WELCOME</div>
      <p class="waiting-subtitle">TETRIMINOS</p>
      <button class="tetri-btn waiting-start" type="button" @click="startGame">START</button>
    </div>

    <div v-if="readyOverlayVisible" class="game-mask ready-mask">
      <div class="mask-title">READY</div>
      <div class="mask-count">{{ readyCountdownValue }}</div>
    </div>

    <div v-if="resultOverlayVisible" class="game-mask result-mask">
      <div class="mask-title">RESULT</div>
      <div class="result-list">
        <div class="result-item"><span>SCORE</span><b>{{ score }}</b></div>
        <div class="result-item"><span>LEVEL</span><b>{{ level }}</b></div>
        <div class="result-item"><span>LINES</span><b>{{ lineCount }}</b></div>
      </div>
      <div class="result-actions">
        <button class="tetri-btn" type="button" @click="playAgain">AGAIN</button>
        <button class="tetri-btn danger" type="button" @click="exitToGameHall">EXIT</button>
      </div>
    </div>

    <section class="tetri-shell">
      <aside class="tetri-side left">
        <button class="tetri-btn" type="button" :disabled="!canResumeFromPause" @click="resumeGame">START</button>
        <button class="tetri-btn" type="button" :disabled="!canPauseWhilePlaying" @click="pauseGame">PAUSE</button>
        <button class="tetri-btn" type="button" @click="resetGame">REPLAY</button>
        <button class="tetri-btn" type="button" @click="endGameNow">END</button>
      </aside>

      <section class="tetri-center">
        <header class="tetri-title-wrap">
          <h1 class="tetri-title">TETRIMINOS</h1>
          <p class="tetri-status">{{ statusText }}</p>
        </header>

        <div class="tetri-frame">
          <div class="tetri-panel top">
            <span>SCORE: {{ score }}</span>
          </div>
          <div class="tetri-stage">
            <div v-for="(row, y) in boardView" :key="`r-${y}`" class="tetri-row">
              <div v-for="(cell, x) in row" :key="`c-${x}`" class="tetri-cell"
                :class="cell ? `color-${cell}` : 'empty'" />
            </div>
          </div>
          <div class="tetri-panel bottom">
            <span>LEVEL: {{ level }}</span>
            <span>LINES: {{ lineCount }}</span>
          </div>
        </div>

        <p class="tetri-message">{{ message }}</p>
      </section>

      <aside class="tetri-side right">
        <button class="tetri-btn key" type="button" @click="moveLeft">←</button>
        <button class="tetri-btn key" type="button" @click="moveRight">→</button>
        <button class="tetri-btn key" type="button" @click="rotate">↻</button>
        <button class="tetri-btn key" type="button" @click="softDrop">↓</button>
        <div class="tetri-help">A D / W / S</div>
      </aside>
    </section>
  </main>
</template>

<style scoped lang="scss">
.tetri-page {
  --tetri-cols: 12;
  --tetri-rows: 20;
  --tetri-cell-size: 18px;
  --tetri-stage-border: 2px;
  --tetri-stage-width: calc(var(--tetri-cell-size) * var(--tetri-cols) + var(--tetri-stage-border) * 2);
  --tetri-stage-height: calc(var(--tetri-cell-size) * var(--tetri-rows) + var(--tetri-stage-border) * 2);
  --tetri-frame-side-gap: 20px;
  --tetri-frame-width: calc(var(--tetri-stage-width) + var(--tetri-frame-side-gap) * 2);

  position: relative;
  min-height: 100vh;
  display: grid;
  place-items: center;
  overflow: hidden;
  background: radial-gradient(circle at top, #2b1a53, #0b0e22 65%);

  .tetri-overlay {
    position: absolute;
    inset: 0;
    pointer-events: none;
    background-image: linear-gradient(rgba(168, 85, 247, 0.06) 1px, transparent 1px),
      linear-gradient(90deg, rgba(168, 85, 247, 0.06) 1px, transparent 1px);
    background-size: 22px 22px;
  }

  .tetri-shell {
    position: relative;
    z-index: 1;
    width: min(1080px, 100%);
    padding: 18px;
    display: grid;
    grid-template-columns: 180px 1fr 180px;
    gap: 20px;
    align-items: center;
  }

  .tetri-side {
    display: flex;
    flex-direction: column;
    gap: 12px;

    &.right {
      display: grid;
      grid-template-columns: repeat(2, 56px);
      justify-content: center;
      gap: 8px;
      margin-top: 14px;

      .tetri-btn.key {
        width: 56px;
        height: 56px;
        padding: 0;
        font-size: 1.2rem;
        line-height: 1;
      }

      .tetri-help {
        grid-column: 1 / -1;
      }
    }
  }

  .tetri-btn {
    border: 1px solid rgba(196, 181, 253, 0.5);
    border-radius: 8px;
    padding: 10px 12px;
    background: rgba(30, 27, 75, 0.78);
    color: #ddd6fe;
    font-weight: 700;
    letter-spacing: 0.4px;
    transition: 0.2s ease;
    display: grid;
    place-items: center;

    &:hover {
      border-color: #c4b5fd;
      box-shadow: 0 0 14px rgba(168, 85, 247, 0.35);
    }

    &:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }

    &.danger {
      border-color: rgba(251, 113, 133, 0.55);
      color: #fecdd3;
    }
  }

  .tetri-center {
    text-align: center;
  }

  .tetri-title {
    margin: 0;
    color: #c4b5fd;
    font-size: clamp(2rem, 5vw, 3.2rem);
    font-weight: 900;
    letter-spacing: 0.16rem;
  }

  .tetri-status {
    margin: 4px 0 0;
    color: #ddd6fe;
    letter-spacing: 0.16rem;
    font-size: 0.84rem;
  }

  .tetri-frame {
    width: var(--tetri-frame-width);
    height: 465px;
    margin: 10px auto 0;
    border: 10px solid #111827;
    border-radius: 18px;
    background: #141a2f;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    padding-top: 12px;
  }

  .tetri-stage {
    width: var(--tetri-stage-width);
    height: var(--tetri-stage-height);
    border: var(--tetri-stage-border) solid #111;
    box-sizing: border-box;
    display: grid;
    grid-template-rows: repeat(var(--tetri-rows), var(--tetri-cell-size));
    background: #0f172a;
    overflow: hidden;
  }

  .tetri-row {
    display: grid;
    grid-template-columns: repeat(var(--tetri-cols), var(--tetri-cell-size));
    grid-template-rows: var(--tetri-cell-size);
  }

  .tetri-cell {
    width: var(--tetri-cell-size);
    height: var(--tetri-cell-size);
    box-sizing: border-box;
    border: 1px solid rgba(30, 41, 59, 0.55);

    &.empty {
      background: rgba(15, 23, 42, 0.95);
    }

    &.color-1 {
      background: #22d3ee;
    }

    &.color-2 {
      background: #fbbf24;
    }

    &.color-3 {
      background: #a78bfa;
    }

    &.color-4 {
      background: #4ade80;
    }

    &.color-5 {
      background: #f87171;
    }

    &.color-6 {
      background: #60a5fa;
    }

    &.color-7 {
      background: #fb923c;
    }
  }

  .tetri-panel {
    width: var(--tetri-stage-width);
    display: flex;
    color: #c4b5fd;
    font-weight: 800;
    font-size: 0.82rem;

    &.top {
      margin-bottom: 8px;
      justify-content: flex-start;
    }

    &.bottom {
      margin-top: 8px;
      justify-content: space-between;
    }
  }

  .tetri-message {
    margin-top: 10px;
    color: #ddd6fe;
    font-size: 0.84rem;
  }

  .tetri-help {
    margin-top: 2px;
    color: #ddd6fe;
    font-size: 0.78rem;
    text-align: center;
  }

  .game-mask {
    position: absolute;
    inset: 0;
    z-index: 4;
    display: grid;
    place-items: center;
    align-content: center;
    gap: 12px;
    background: rgba(0, 0, 0, 0.78);
  }

  .mask-title {
    color: #c4b5fd;
    font-size: clamp(2rem, 8vw, 4rem);
    letter-spacing: 0.24rem;
    font-weight: 900;
  }

  .mask-count {
    color: #c4b5fd;
    font-size: clamp(3rem, 12vw, 7rem);
    font-weight: 900;
    line-height: 1;
  }

  .result-list {
    display: grid;
    gap: 8px;
    width: 260px;
  }

  .result-item {
    display: flex;
    justify-content: space-between;
    border: 1px solid rgba(167, 139, 250, 0.42);
    background: rgba(30, 27, 75, 0.72);
    color: #ddd6fe;
    padding: 8px 10px;
  }

  .result-actions {
    margin-top: 8px;
    display: flex;
    gap: 10px;
  }
}

@media (max-width: 980px) {
  .tetri-page {
    .tetri-shell {
      grid-template-columns: 1fr;
      padding: 14px;
    }

    .tetri-side {
      flex-direction: row;
      flex-wrap: wrap;
      justify-content: center;

      &.right {
        grid-template-columns: repeat(2, 56px);
        margin-top: 0;
      }
    }
  }
}
</style>
