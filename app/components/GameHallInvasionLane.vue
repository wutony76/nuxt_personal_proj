<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

type Phase = 'invasion' | 'typing'
type Alien = { id: number; row: number; col: number; alive: boolean }
type Bullet = { id: number; x: number; y: number }
type Fx = { id: number; x: number; y: number; ttl: number }
type ScorePop = Fx & { text: string }
type ActiveWord = { id: number; text: string; x: number; y: number; revealed: number }
type RisingWord = { id: number; text: string; x: number; y: number }

const ROWS = 7
const COLS = 9
const ROW_TOP_START = 6
const ROW_GAP = 7
const COL_START = 6
const COL_GAP = 88 / (COLS - 1)
const BOTTOM_LIMIT = 80
const DESCENT_SPEED = 0.06

const TURRET_Y = 90
const SWEEP_SPEED = 0.02
const FIRE_EVERY_TICKS = 12
const BULLET_SPEED = 2.2
const COL_HIT_RADIUS = 6
const ROW_HIT_RADIUS = 5
const EXPLOSION_TTL = 6

const WORDS = ['CODE', 'GAME', 'TYPE', 'WIN', 'JUMP', 'HERO', 'FAST', 'GLOW', 'STAR', 'PLAY']
const CHAR_TICKS = 4
const WORD_RISE_SPEED = 0.35
const SCORE_TTL = 20
const SCORE_RISE_SPEED = 0.6
const WORDS_PER_CYCLE = 5

const TICK_MS = 40
const PAUSE_MS = 480

/** 依格子索引換算成軌道上的百分比座標，比照 GameHallArcadeLane 的 slotToPercent 慣例 */
const rowToPercent = (row: number): number => ROW_TOP_START + row * ROW_GAP
const colToPercent = (col: number): number => COL_START + col * COL_GAP
const rowClass = (row: number): string => (row < 2 ? 'row-a' : row < 5 ? 'row-b' : 'row-c')

const phase = ref<Phase>('invasion')
const showActors = ref(false)

const aliens = ref<Alien[]>([])
const bullets = ref<Bullet[]>([])
const explosions = ref<Fx[]>([])
const formationY = ref(0)
const turretX = ref(50)

const activeWord = ref<ActiveWord | null>(null)
const risingWords = ref<RisingWord[]>([])
const scorePops = ref<ScorePop[]>([])
const completedCount = ref(0)

let tickTimer: ReturnType<typeof setInterval> | null = null
let pauseTimer: ReturnType<typeof setTimeout> | null = null
let _idSeq = 0
let _turretT = 0
let _fireCounter = 0
let _typeCounter = 0

const _nextId = () => (_idSeq += 1)

/**
 * 隨機建立外星人陣型：每列固定填滿並偶爾隨機空一格，做出「隨機鋪滿」的錯落感
 * 只在 onMounted 之後（含每輪重啟）呼叫，避免 SSR/CSR 產生不同結果造成 hydration mismatch
 * @returns {Alien[]} 本輪陣型
 */
const _buildFormation = (): Alien[] => {
  const list: Alien[] = []
  for (let row = 0; row < ROWS; row++) {
    const gapCol = Math.random() < 0.85 ? Math.floor(Math.random() * COLS) : -1
    for (let col = 0; col < COLS; col++) {
      if (col === gapCol) continue
      list.push({ id: _nextId(), row, col, alive: true })
    }
  }
  return list
}

const _startInvasion = () => {
  phase.value = 'invasion'
  aliens.value = _buildFormation()
  bullets.value = []
  explosions.value = []
  formationY.value = 0
  turretX.value = 50
  _turretT = 0
  _fireCounter = 0
  showActors.value = true
}

const _startTyping = () => {
  phase.value = 'typing'
  activeWord.value = null
  risingWords.value = []
  scorePops.value = []
  completedCount.value = 0
  _typeCounter = 0
  showActors.value = true
}

const _pauseThen = (next: () => void) => {
  showActors.value = false
  if (tickTimer) {
    clearInterval(tickTimer)
    tickTimer = null
  }
  if (pauseTimer) clearTimeout(pauseTimer)
  pauseTimer = setTimeout(() => {
    next()
    tickTimer = setInterval(_tick, TICK_MS)
  }, PAUSE_MS)
}

const _spawnNextWord = () => {
  const text = WORDS[Math.floor(Math.random() * WORDS.length)]!
  activeWord.value = { id: _nextId(), text, x: 12 + Math.random() * 76, y: 88, revealed: 0 }
}

const _tickInvasion = () => {
  formationY.value += DESCENT_SPEED

  _turretT += 1
  turretX.value = 50 + 44 * Math.sin(_turretT * SWEEP_SPEED)

  _fireCounter += 1
  if (_fireCounter >= FIRE_EVERY_TICKS) {
    _fireCounter = 0
    bullets.value.push({ id: _nextId(), x: turretX.value, y: TURRET_Y })
  }

  bullets.value.forEach((b) => {
    b.y -= BULLET_SPEED
  })

  for (const bullet of bullets.value) {
    const target = aliens.value.find(
      (a) =>
        a.alive
        && Math.abs(colToPercent(a.col) - bullet.x) < COL_HIT_RADIUS
        && Math.abs(rowToPercent(a.row) + formationY.value - bullet.y) < ROW_HIT_RADIUS,
    )
    if (target) {
      target.alive = false
      explosions.value.push({ id: _nextId(), x: bullet.x, y: bullet.y, ttl: EXPLOSION_TTL })
      bullet.y = -999
    }
  }
  bullets.value = bullets.value.filter((b) => b.y > 0)

  explosions.value.forEach((e) => (e.ttl -= 1))
  explosions.value = explosions.value.filter((e) => e.ttl > 0)

  const aliveRows = aliens.value.filter((a) => a.alive).map((a) => a.row)
  const frontRow = aliveRows.length ? Math.max(...aliveRows) : -1
  const reachedBottom = frontRow === -1 || rowToPercent(frontRow) + formationY.value >= BOTTOM_LIMIT
  if (reachedBottom) _pauseThen(_startTyping)
}

const _tickTyping = () => {
  if (activeWord.value) {
    activeWord.value.y -= WORD_RISE_SPEED
    _typeCounter += 1
    if (_typeCounter >= CHAR_TICKS) {
      _typeCounter = 0
      if (activeWord.value.revealed < activeWord.value.text.length) {
        activeWord.value.revealed += 1
      }
      if (activeWord.value.revealed === activeWord.value.text.length) {
        scorePops.value.push({ id: _nextId(), x: activeWord.value.x, y: activeWord.value.y, ttl: SCORE_TTL, text: '+10' })
        risingWords.value.push({ id: activeWord.value.id, text: activeWord.value.text, x: activeWord.value.x, y: activeWord.value.y })
        completedCount.value += 1
        activeWord.value = null
      }
    }
  } else {
    _spawnNextWord()
  }

  risingWords.value.forEach((w) => (w.y -= WORD_RISE_SPEED))
  risingWords.value = risingWords.value.filter((w) => w.y > -8)

  scorePops.value.forEach((s) => {
    s.y -= SCORE_RISE_SPEED
    s.ttl -= 1
  })
  scorePops.value = scorePops.value.filter((s) => s.ttl > 0)

  if (completedCount.value >= WORDS_PER_CYCLE) _pauseThen(_startInvasion)
}

const _tick = () => {
  if (phase.value === 'invasion') _tickInvasion()
  else _tickTyping()
}

onMounted(() => {
  _startInvasion()
  tickTimer = setInterval(_tick, TICK_MS)
})

onBeforeUnmount(() => {
  if (tickTimer) clearInterval(tickTimer)
  if (pauseTimer) clearTimeout(pauseTimer)
})
</script>

<template>
  <section class="hud-panel invasion-panel" aria-hidden="true">
    <div class="panel-title">
      <h2>INVASION.SIM</h2>
      <div class="meta">// 外星人入侵模擬 · 自動打字防禦 · <b>LIVE</b></div>
    </div>

    <div class="stage">
      <template v-if="phase === 'invasion' && showActors">
        <span
          v-for="alien in aliens"
          v-show="alien.alive"
          :key="alien.id"
          class="alien"
          :class="rowClass(alien.row)"
          :style="{ left: `${colToPercent(alien.col)}%`, top: `${rowToPercent(alien.row) + formationY}%` }"
        >👾</span>

        <span class="turret" :style="{ left: `${turretX}%`, top: `${TURRET_Y}%` }" />

        <span v-for="b in bullets" :key="`b-${b.id}`" class="bullet" :style="{ left: `${b.x}%`, top: `${b.y}%` }" />

        <span v-for="e in explosions" :key="`e-${e.id}`" class="explosion" :style="{ left: `${e.x}%`, top: `${e.y}%` }" />
      </template>

      <template v-if="phase === 'typing' && showActors">
        <div v-if="activeWord" class="word" :style="{ left: `${activeWord.x}%`, top: `${activeWord.y}%` }">
          <span class="typed">{{ activeWord.text.slice(0, activeWord.revealed) }}</span
          ><span class="cursor">_</span><span class="pending">{{ activeWord.text.slice(activeWord.revealed) }}</span>
        </div>

        <div v-for="w in risingWords" :key="`w-${w.id}`" class="word done" :style="{ left: `${w.x}%`, top: `${w.y}%` }">
          {{ w.text }}
        </div>

        <span v-for="s in scorePops" :key="`s-${s.id}`" class="score-pop" :style="{ left: `${s.x}%`, top: `${s.y}%` }">{{ s.text }}</span>
      </template>
    </div>
  </section>
</template>

<style scoped lang="scss">
.invasion-panel {
  position: relative;
  background: var(--panel);
  border: 1px solid var(--cyan);
  padding: 22px;
  margin: 24px 0;
  animation: iv-fade-slide-up 0.55s ease-out 0.35s both;
}

.panel-title {
  display: flex;
  align-items: baseline;
  gap: 14px;
  margin-bottom: 18px;

  h2 {
    font-family: "Orbitron", sans-serif;
    font-weight: 700;
    font-size: 18px;
    letter-spacing: 0.22em;
    color: #fff;
    text-shadow: 0 0 10px rgba(0, 229, 255, 0.4);
  }

  .meta {
    color: var(--text-mute);
    font-size: 11px;
    letter-spacing: 0.2em;

    b {
      color: var(--magenta);
      font-weight: 400;
    }
  }
}

.stage {
  position: relative;
  height: 260px;
  overflow: hidden;
}

.alien {
  position: absolute;
  transform: translate(-50%, -50%);
  font-size: 20px;
  line-height: 1;
  animation: iv-sway 2.4s ease-in-out infinite;
  filter: drop-shadow(0 0 4px currentColor);

  &.row-a {
    color: var(--magenta);
  }

  &.row-b {
    color: var(--amber);
  }

  &.row-c {
    color: var(--green);
  }
}

.turret {
  position: absolute;
  width: 22px;
  height: 16px;
  margin: -16px 0 0 -11px;
  background: var(--cyan);
  clip-path: polygon(50% 0, 100% 100%, 0 100%);
  box-shadow: 0 0 10px rgba(0, 229, 255, 0.7);

  &::after {
    content: '';
    position: absolute;
    left: 50%;
    top: -8px;
    width: 4px;
    height: 8px;
    margin-left: -2px;
    background: var(--cyan);
  }
}

.bullet {
  position: absolute;
  width: 3px;
  height: 10px;
  margin: -5px 0 0 -1.5px;
  background: var(--cyan-soft);
  box-shadow: 0 0 6px var(--cyan);
}

.explosion {
  position: absolute;
  width: 18px;
  height: 18px;
  margin: -9px 0 0 -9px;
  border-radius: 50%;
  background: radial-gradient(circle, #fff, var(--amber) 45%, transparent 70%);
  animation: iv-explode 0.24s ease-out both;
}

.word {
  position: absolute;
  transform: translate(-50%, -50%);
  font-family: "Share Tech Mono", monospace;
  font-size: 18px;
  letter-spacing: 0.1em;
  white-space: nowrap;

  .typed {
    color: var(--green);
    text-shadow: 0 0 8px rgba(57, 255, 160, 0.6);
  }

  .pending {
    color: var(--text-mute);
  }

  .cursor {
    color: #fff;
    animation: iv-blink 0.6s steps(2) infinite;
  }

  &.done {
    color: var(--green);
    text-shadow: 0 0 8px rgba(57, 255, 160, 0.6);
    opacity: 0.75;
  }
}

.score-pop {
  position: absolute;
  transform: translate(-50%, -50%);
  font-family: "Orbitron", sans-serif;
  font-weight: 700;
  font-size: 14px;
  color: var(--amber);
  text-shadow: 0 0 8px rgba(255, 182, 39, 0.7);
}

@keyframes iv-fade-slide-up {
  from {
    transform: translateY(40px);
    opacity: 0;
  }

  to {
    transform: translateY(0);
    opacity: 1;
  }
}

@keyframes iv-sway {

  0%,
  100% {
    transform: translate(-50%, -50%);
  }

  50% {
    transform: translate(calc(-50% + 3px), -50%);
  }
}

@keyframes iv-explode {
  from {
    transform: scale(0.3);
    opacity: 1;
  }

  to {
    transform: scale(1.4);
    opacity: 0;
  }
}

@keyframes iv-blink {

  0%,
  49% {
    opacity: 1;
  }

  50%,
  100% {
    opacity: 0.15;
  }
}
</style>
