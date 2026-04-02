<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'

type RacingStatus = 'ready' | 'playing' | 'pause' | 'gameover'
type WallRow = {
  id: number
  wallIndex: number
  roadStart: number
  roadLen: number
}
type RacingSnapshot = {
  carX: number
  rows: WallRow[]
  score: number
  level: number
  dodgeCount: number
}

class RacingEngine {
  private readonly cols = 30
  private readonly cell = 10
  private readonly stageRows = 38
  private readonly wallMargin = 2
  private readonly carWidthCells = 3
  private readonly startCarX = 140
  private readonly carY = 250
  private readonly tickDistance = 10
  private readonly warmupRows = 5
  private rows: WallRow[] = []
  private carX = this.startCarX
  private score = 0
  private level = 1
  private dodgeCount = 0
  private rowCounter = 0
  private scoreCounter = 0
  private warmupRowsRemaining = 0
  private recordPos = [
    { startX: this.startCarX / this.cell, len: 6 },
    { startX: this.startCarX / this.cell, len: 6 }
  ]

  reset() {
    this.rows = []
    this.carX = this.startCarX
    this.score = 0
    this.level = 1
    this.dodgeCount = 0
    this.rowCounter = 0
    this.scoreCounter = 0
    this.warmupRowsRemaining = this.warmupRows
    this.recordPos = [
      { startX: this.startCarX / this.cell, len: 6 },
      { startX: this.startCarX / this.cell, len: 6 }
    ]
    for (let i = 0; i < this.stageRows; i += 1) {
      const row = this.produceWarmupRow()
      row.wallIndex = this.stageRows - 1 - i
      this.rows.push(row)
    }
  }

  moveLeft() {
    this.carX = Math.max(0, this.carX - this.tickDistance)
  }

  moveRight() {
    this.carX = Math.min((this.cols - this.carWidthCells) * this.cell, this.carX + this.tickDistance)
  }

  getTickMs() {
    // Gradually speed up by travelled distance (dodgeCount), not only by level jumps.
    const baseMs = 500
    const minMs = 170
    const distanceStep = 8 // every 8 dodges, speed increases a bit
    const speedGainPerStep = 6
    const gained = Math.floor(this.dodgeCount / distanceStep) * speedGainPerStep
    return Math.max(minMs, baseMs - gained)
  }

  step() {
    this.rows.forEach((r) => {
      r.wallIndex += 1
    })
    const nextRow = this.warmupRowsRemaining > 0 ? this.produceWarmupRow() : this.produceRow()
    if (this.warmupRowsRemaining > 0) {
      this.warmupRowsRemaining -= 1
    }
    this.rows = [nextRow, ...this.rows.filter((r) => r.wallIndex <= this.stageRows)]
    this.calcScore()
    return { gameOver: this.hasCollision() }
  }

  getSnapshot(): RacingSnapshot {
    return {
      carX: this.carX,
      rows: this.rows.map((x) => ({ ...x })),
      score: this.score,
      level: this.level,
      dodgeCount: this.dodgeCount
    }
  }

  private produceRow(): WallRow {
    this.rowCounter += 1
    const recordIndex = this.rowCounter % 2
    const fallback = { startX: this.startCarX / this.cell, len: 6 }
    const other = this.recordPos[1 - recordIndex] ?? fallback
    const current = this.recordPos[recordIndex] ?? fallback

    const profile = this.getDifficultyProfile()
    const roadLen = this.randInt(profile.roadMin, profile.roadMax)

    const currentCenter = current.startX + Math.floor(current.len / 2)
    const driftedCenter = currentCenter + this.randInt(-profile.maxShift, profile.maxShift)
    const targetStart = driftedCenter - Math.floor(roadLen / 2)
    const targetEnd = targetStart + roadLen

    const minFromCurrent = current.startX - roadLen + this.carWidthCells
    const maxFromCurrent = current.startX + current.len - this.carWidthCells
    const minFromOther = other.startX - roadLen + this.carWidthCells
    const maxFromOther = other.startX + other.len - this.carWidthCells

    const hardMin = this.wallMargin
    const hardMax = this.cols - this.wallMargin - roadLen

    let canStartPos = Math.max(hardMin, minFromCurrent, minFromOther)
    let canEndPos = Math.min(hardMax, maxFromCurrent, maxFromOther)

    if (canStartPos > canEndPos) {
      const fallbackCenter = Math.round((current.startX + other.startX) / 2)
      canStartPos = Math.max(hardMin, Math.min(hardMax, fallbackCenter - Math.floor(roadLen / 2)))
      canEndPos = canStartPos
    }

    let start = Math.min(canEndPos, Math.max(canStartPos, targetStart))
    if (start < canStartPos || start > canEndPos) {
      start = this.randInt(canStartPos, canEndPos)
    }
    if (targetEnd > this.cols - this.wallMargin) {
      start = Math.min(start, this.cols - this.wallMargin - roadLen)
    }
    current.startX = start
    current.len = roadLen

    return {
      id: this.rowCounter,
      wallIndex: 0,
      roadStart: start,
      roadLen
    }
  }

  private produceWarmupRow(): WallRow {
    this.rowCounter += 1
    return {
      id: this.rowCounter,
      wallIndex: 0,
      roadStart: this.wallMargin,
      roadLen: this.cols - this.wallMargin * 2
    }
  }

  private hasCollision() {
    const rowIndex = Math.floor(this.carY / this.cell)
    const rowA = this.rows.find((r) => r.wallIndex === rowIndex)
    const rowB = this.rows.find((r) => r.wallIndex === rowIndex + 1)
    if (!rowA && !rowB) return false

    const handX = this.carX + this.cell
    const bodyX = this.carX
    const roadBounds = (row: WallRow) => ({
      start: row.roadStart * this.cell,
      end: (row.roadStart + row.roadLen) * this.cell
    })

    if (rowA) {
      const road = roadBounds(rowA)
      if (handX < road.start || handX > road.end - this.cell) return true
    }
    if (rowB) {
      const road = roadBounds(rowB)
      if (bodyX < road.start || bodyX > road.end - this.carWidthCells * this.cell) return true
    }
    return false
  }

  private calcScore() {
    this.scoreCounter += 1
    if (this.scoreCounter % 5 === 0) {
      this.scoreCounter = 0
      this.score += 1
      this.dodgeCount += 1
    }
    if (this.score >= 999) this.level = 3
    else if (this.score >= 200) this.level = 2
    else this.level = 1
  }

  private getDifficultyProfile() {
    if (this.level >= 3) {
      return {
        roadMin: 4,
        roadMax: 6,
        maxShift: 4
      }
    }
    if (this.level === 2) {
      return {
        roadMin: 5,
        roadMax: 7,
        maxShift: 3
      }
    }
    return {
      roadMin: 6,
      roadMax: 8,
      maxShift: 2
    }
  }

  private randInt(min: number, max: number) {
    if (max <= min) return min
    return Math.floor(Math.random() * (max - min + 1)) + min
  }
}

const router = useRouter()
const engine = new RacingEngine()
const status = ref<RacingStatus>('ready')
const message = ref('按 START 開始，使用 ← → 或 A D 操作。')
const waitingOverlayVisible = ref(true)
const readyOverlayVisible = ref(false)
const readyCountdownValue = ref(3)
const resultOverlayVisible = ref(false)
const carX = ref(140)
const rows = ref<WallRow[]>([])
const score = ref(0)
const level = ref(1)
const dodgeCount = ref(0)
let racingTimer: ReturnType<typeof setTimeout> | null = null
let readyTimer: ReturnType<typeof setInterval> | null = null

const statusText = computed(() => {
  if (status.value === 'playing') return 'PLAYING'
  if (status.value === 'pause') return 'PAUSE'
  if (status.value === 'gameover') return 'GAME OVER'
  return 'READY'
})

const canResumeFromPause = computed(
  () =>
    status.value === 'pause' &&
    !waitingOverlayVisible.value &&
    !readyOverlayVisible.value &&
    !resultOverlayVisible.value
)
const canPauseWhilePlaying = computed(() => status.value === 'playing')

const syncState = () => {
  const snap = engine.getSnapshot()
  carX.value = snap.carX
  rows.value = snap.rows
  score.value = snap.score
  level.value = snap.level
  dodgeCount.value = snap.dodgeCount
}

const stopRacingTimer = () => {
  if (!racingTimer) return
  clearTimeout(racingTimer)
  racingTimer = null
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

const stepRacing = () => {
  if (status.value !== 'playing') return
  const stepResult = engine.step()
  syncState()
  if (stepResult.gameOver) {
    status.value = 'gameover'
    message.value = '撞牆了，遊戲結束。'
    resultOverlayVisible.value = true
    stopRacingTimer()
  }
}

const racingLoop = () => {
  stepRacing()
  if (status.value !== 'playing') return
  racingTimer = setTimeout(racingLoop, engine.getTickMs())
}

const resetRacing = () => {
  stopRacingTimer()
  stopReadyTimer()
  engine.reset()
  syncState()
  status.value = 'ready'
  waitingOverlayVisible.value = true
  readyOverlayVisible.value = false
  resultOverlayVisible.value = false
  message.value = '按 START 開始，使用 ← → 或 A D 操作。'
}

const startRacing = () => {
  if (status.value === 'playing' || readyOverlayVisible.value) return
  waitingOverlayVisible.value = false
  resultOverlayVisible.value = false
  runReadyCountdown(() => {
    status.value = 'playing'
    message.value = 'RACING...'
    stopRacingTimer()
    racingTimer = setTimeout(racingLoop, engine.getTickMs())
  })
}

const pauseRacing = () => {
  if (status.value !== 'playing') return
  status.value = 'pause'
  message.value = '已暫停'
  stopRacingTimer()
  stopReadyTimer()
}

const resumeRacing = () => {
  if (!canResumeFromPause.value) return
  status.value = 'playing'
  message.value = 'RACING...'
  stopRacingTimer()
  racingTimer = setTimeout(racingLoop, engine.getTickMs())
}

const playAgain = () => {
  resetRacing()
  startRacing()
}

const endGameNow = () => {
  stopRacingTimer()
  stopReadyTimer()
  waitingOverlayVisible.value = false
  readyOverlayVisible.value = false
  status.value = 'gameover'
  message.value = '本局已結束。'
  resultOverlayVisible.value = true
}

const exitToGameHall = () => {
  router.replace('/game-hall')
}

const onKeydown = (event: KeyboardEvent) => {
  if (waitingOverlayVisible.value || readyOverlayVisible.value || resultOverlayVisible.value) return
  const key = event.key.toLowerCase()
  if (key === 'arrowleft' || key === 'a') {
    engine.moveLeft()
    syncState()
    event.preventDefault()
  }
  if (key === 'arrowright' || key === 'd') {
    engine.moveRight()
    syncState()
    event.preventDefault()
  }
}

const moveLeft = () => {
  engine.moveLeft()
  syncState()
}

const moveRight = () => {
  engine.moveRight()
  syncState()
}

onMounted(() => {
  resetRacing()
  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', onKeydown)
  }
})

onUnmounted(() => {
  stopRacingTimer()
  stopReadyTimer()
  if (typeof window !== 'undefined') {
    window.removeEventListener('keydown', onKeydown)
  }
})
</script>

<template>
  <main class="racing-page">
    <div class="racing-overlay" />

    <div v-if="waitingOverlayVisible" class="game-mask waiting-mask">
      <div class="mask-title">WELCOME</div>
      <p class="waiting-subtitle">RACING GAME</p>
      <button class="racing-btn waiting-start" type="button" @click="startRacing">START</button>
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
        <div class="result-item"><span>DODGE</span><b>{{ dodgeCount }}</b></div>
      </div>
      <div class="result-actions">
        <button class="racing-btn" type="button" @click="playAgain">AGAIN</button>
        <button class="racing-btn danger" type="button" @click="exitToGameHall">EXIT</button>
      </div>
    </div>

    <section class="racing-shell">
      <aside class="racing-side left">
        <button class="racing-btn" type="button" :disabled="!canResumeFromPause" @click="resumeRacing">START</button>
        <button class="racing-btn" type="button" :disabled="!canPauseWhilePlaying" @click="pauseRacing">PAUSE</button>
        <button class="racing-btn" type="button" @click="resetRacing">REPLAY</button>
        <button class="racing-btn link" type="button" @click="endGameNow">END</button>
      </aside>

      <section class="racing-center">
        <header class="racing-title-wrap">
          <h1 class="racing-title">RACING</h1>
          <p class="racing-status">{{ statusText }}</p>
        </header>

        <div class="racing-frame">
          <div class="racing-stage">
            <div class="wall-layer">
              <div v-for="row in rows" :key="row.id" class="wall-row" :style="{ top: `${row.wallIndex * 10}px` }">
                <div v-for="col in 30" :key="`${row.id}-${col}`" class="wall-cell"
                  :class="col - 1 >= row.roadStart && col - 1 < row.roadStart + row.roadLen ? 'road' : 'brick'" />
              </div>
            </div>
            <div class="racing-car" :style="{ left: `${carX}px`, top: '250px' }">
              <div class="head">
                <div />
              </div>
              <div class="body">
                <div />
                <div />
                <div />
              </div>
            </div>
          </div>
          <div class="racing-panel">
            <span>SCORE: {{ score }}</span>
            <span>LEVEL: {{ level }}</span>
            <span>DODGE: {{ dodgeCount }}</span>
          </div>
        </div>

        <p class="racing-message">{{ message }}</p>
      </section>

      <aside class="racing-side right">
        <button class="racing-btn key" type="button" @click="moveLeft">← </button>
        <button class="racing-btn key" type="button" @click="moveRight"> →</button>
        <div class="racing-help">A D / Arrow Left Right</div>
      </aside>
    </section>
  </main>
</template>

<style scoped lang="scss">
.racing-page {
  position: relative;
  min-height: 100vh;
  display: grid;
  place-items: center;
  overflow: hidden;
  background: radial-gradient(circle at top, #1f2754, #090d1e 65%);

  .racing-overlay {
    position: absolute;
    inset: 0;
    pointer-events: none;
    background-image: linear-gradient(rgba(56, 189, 248, 0.06) 1px, transparent 1px),
      linear-gradient(90deg, rgba(56, 189, 248, 0.06) 1px, transparent 1px);
    background-size: 24px 24px;
  }

  .racing-shell {
    position: relative;
    z-index: 1;
    width: min(1080px, 100%);
    padding: 20px;
    display: grid;
    grid-template-columns: 180px 1fr 180px;
    gap: 20px;
    align-items: center;
  }

  .racing-side {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .racing-btn {
    border: 1px solid rgba(56, 189, 248, 0.5);
    border-radius: 8px;
    padding: 10px 12px;
    background: rgba(8, 23, 52, 0.8);
    color: #93dbff;
    font-weight: 700;
    letter-spacing: 0.4px;
    transition: 0.2s ease;
    display: grid;
    place-items: center;
    text-align: center;
    line-height: 1.2;

    &:hover {
      border-color: #7dd3fc;
      box-shadow: 0 0 14px rgba(56, 189, 248, 0.35);
    }

    &:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }

    &.danger {
      border-color: rgba(248, 113, 113, 0.5);
      color: #fecaca;
    }
  }

  .racing-center {
    text-align: center;
  }

  .racing-title {
    margin: 0;
    color: #67e8f9;
    font-size: clamp(2rem, 5vw, 3.4rem);
    letter-spacing: 0.18rem;
  }

  .racing-status {
    margin: 4px 0 0;
    color: #bfdbfe;
    letter-spacing: 0.18rem;
    font-size: 0.85rem;
  }

  .racing-frame {
    width: 360px;
    height: 460px;
    margin: 10px auto 0;
    border: 10px solid #111827;
    border-radius: 18px;
    background: #0b1220;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    align-items: center;
    padding-top: 18px;
  }

  .racing-stage {
    position: relative;
    width: 304px;
    height: 384px;
    border: 2px solid #111;
    overflow: hidden;
    background: #b7d4a8;
  }

  .wall-layer {
    position: absolute;
    inset: 0;
  }

  .wall-row {
    position: absolute;
    left: 0;
    display: flex;
  }

  .wall-cell {
    width: 10px;
    height: 10px;
    box-sizing: border-box;

    &.brick {
      background: rgb(165, 95, 10);
      border: 1px solid #b7d4a8;
    }

    &.road {
      background: #b7d4a8;
      border: 1px solid #b7d4a8;
    }
  }

  .racing-car {
    position: absolute;
    width: 30px;
    height: 20px;

    .head {
      width: 10px;
      position: relative;
      left: 10px;
      top: 0;

      >div {
        width: 10px;
        height: 10px;
        background: #f00;
        border: 1px solid #b7d4a8;
        box-sizing: border-box;
      }
    }

    .body {
      display: flex;

      >div {
        width: 10px;
        height: 10px;
        background: #f00;
        border: 1px solid #b7d4a8;
        box-sizing: border-box;
      }
    }
  }

  .racing-panel {
    width: 304px;
    margin-top: 6px;
    display: flex;
    justify-content: space-between;
    color: #67e8f9;
    font-weight: 800;
    font-size: 0.82rem;
  }

  .racing-message {
    margin-top: 8px;
    color: #bfdbfe;
    font-size: 0.84rem;
  }

  .racing-help {
    margin-top: 4px;
    color: #bae6fd;
    font-size: 0.8rem;
    text-align: center;
  }

  .racing-side.right {
    display: grid;
    grid-template-columns: repeat(2, 50px);
    justify-content: center;
    gap: 8px;
    margin-top: 250px;

    .racing-btn.key {
      width: 50px;
      height: 50px;
      padding: 0;
      font-size: 1.1rem;
      line-height: 1;
    }

    .racing-help {
      grid-column: 1 / -1;
      margin-top: 2px;
    }
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
    color: #67e8f9;
    font-size: clamp(2rem, 7vw, 4rem);
    letter-spacing: 0.25rem;
    font-weight: 900;
  }

  .mask-count {
    color: #93c5fd;
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
    border: 1px solid rgba(56, 189, 248, 0.4);
    background: rgba(8, 23, 52, 0.7);
    color: #bae6fd;
    padding: 8px 10px;
  }

  .result-actions {
    margin-top: 6px;
    display: flex;
    gap: 10px;
  }
}

@media (max-width: 980px) {
  .racing-page {
    .racing-shell {
      grid-template-columns: 1fr;
      padding: 14px;
    }

    .racing-side {
      flex-direction: row;
      flex-wrap: wrap;
      justify-content: center;
    }

    .racing-side.right {
      grid-template-columns: repeat(2, 50px);
    }
  }
}
</style>
