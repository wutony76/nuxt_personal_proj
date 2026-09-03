<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

type Phase = 'invasion' | 'typing'
type Alien = { id: number; row: number; col: number; alive: boolean; hp: number; hitTtl: number }
type Bullet = { id: number; x: number; y: number }
type Fx = { id: number; x: number; y: number; ttl: number }
type ScorePop = Fx & { text: string }
type TypingWord = { id: number; text: string; x: number; y: number; revealed: number; size: number }

const ROWS = 7
const COLS = 9
const ROW_TOP_START = 6
const ROW_GAP = 10
const COL_START = 18
const COL_GAP = (100 - 2 * COL_START) / (COLS - 1)
const BOTTOM_LIMIT = 100
const DESCENT_SPEED = 0.06
/** 左右擺動幅度：COL_START 需留夠邊界（>= 這裡的振幅 + 外星人半寬），移動才不會切到畫面邊緣 */
const SWAY_AMPLITUDE = 10
const SWAY_SPEED = 0.015

const TURRET_Y = 100
const TURRET_MOVE_SPEED = 0.6
const TURRET_RETARGET_MIN = 15
const TURRET_RETARGET_RANGE = 35
const FIRE_EVERY_TICKS = 12
const BULLET_SPEED = 2.2
const COL_HIT_RADIUS = 6
const ROW_HIT_RADIUS = 5
const EXPLOSION_TTL = 6
const HIT_FLASH_TTL = 6

const WORDS = [
  'CODE', 'GAME', 'TYPE', 'JUMP', 'HERO', 'GLOW', 'STAR',
  'RETRO', 'ARCADE', 'LASER', 'ROBOT', 'PLANET', 'GALAXY', 'ROCKET', 'WIZARD', 'DRAGON',
  'CASTLE', 'KNIGHT', 'PIRATE', 'RAINBOW', 'CRYSTAL', 'PHANTOM', 'THUNDER', 'MYSTERY',
  'ADVENTURE', 'CHALLENGE', 'KEYBOARD', 'CHAMPION', 'ELECTRIC',
]
const WORD_SIZES = [14, 18, 22, 28, 34, 40]
const CHAR_TICKS = 4
const WORD_RISE_SPEED = 0.55
const WORD_TOP_LIMIT = 4
const MAX_WORDS = 60
const SPAWN_BASE_TICKS = 14
const SPAWN_MIN_TICKS = 4
const SPAWN_DECAY_PER_WORD = 1
const SCORE_TTL = 20
const SCORE_RISE_SPEED = 0.6

const TICK_MS = 40
const FREEZE_MS = 1500

/** 經典像素外星人造型（11x8 網格），用 SVG rect 畫出來取代 emoji，顏色才能真的隨排別變色 */
const ALIEN_PIXEL_ROWS = [
  '..X.....X..',
  '...X...X...',
  '..XXXXXXX..',
  '.XX.XXX.XX.',
  'XXXXXXXXXXX',
  'X.XXXXXXX.X',
  'X.X.....X.X',
  '...XX.XX...',
]
const ALIEN_PIXEL_CELLS = ALIEN_PIXEL_ROWS.flatMap((rowStr, y) =>
  [...rowStr].flatMap((ch, x) => (ch === 'X' ? [{ x, y }] : [])),
)

/** 依格子索引換算成軌道上的百分比座標，比照 GameHallArcadeLane 的 slotToPercent 慣例 */
const rowToPercent = (row: number): number => ROW_TOP_START + row * ROW_GAP
const colToPercent = (col: number): number => COL_START + col * COL_GAP
const rowClass = (row: number): string => (row < 2 ? 'row-a' : row < 5 ? 'row-b' : 'row-c')

const phase = ref<Phase>('invasion')
const showActors = ref(false)
const isFrozen = ref(false)

const aliens = ref<Alien[]>([])
const bullets = ref<Bullet[]>([])
const explosions = ref<Fx[]>([])
const formationY = ref(0)
const formationX = ref(0)
const turretX = ref(50)

const words = ref<TypingWord[]>([])
const scorePops = ref<ScorePop[]>([])

let tickTimer: ReturnType<typeof setInterval> | null = null
let pauseTimer: ReturnType<typeof setTimeout> | null = null
let _idSeq = 0
let _swayT = 0
let _fireCounter = 0
let _typeCounter = 0
let _spawnCounter = 0
let _spawnedCount = 0
let _turretTargetX = 50
let _turretRetargetCounter = 0

const _nextId = () => (_idSeq += 1)

/**
 * 依排別決定外星人的血量：紅排（row-a）耐打程度隨機 1~5 下，黃排（row-b）固定要打兩下，其餘一擊必殺
 * @param {number} row 格子所在列
 * @returns {number} 血量
 */
const _rowHp = (row: number): number => {
  const cls = rowClass(row)
  if (cls === 'row-a') return 1 + Math.floor(Math.random() * 5)
  if (cls === 'row-b') return 2
  return 1
}

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
      list.push({ id: _nextId(), row, col, alive: true, hp: _rowHp(row), hitTtl: 0 })
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
  formationX.value = 0
  turretX.value = 50
  _turretTargetX = 50
  _turretRetargetCounter = 0
  _swayT = 0
  _fireCounter = 0
  showActors.value = true
}

const _startTyping = () => {
  phase.value = 'typing'
  words.value = []
  scorePops.value = []
  _typeCounter = 0
  _spawnCounter = 0
  _spawnedCount = 0
  showActors.value = true
}

const _stopTick = () => {
  if (tickTimer) {
    clearInterval(tickTimer)
    tickTimer = null
  }
}

/**
 * 分頁不在前景時就不用跑（反正也看不到、瀏覽器也會把 setInterval 降頻),
 * 只有在「不是凍結轉場中、目前沒有在跑、分頁可見」時才重啟計時器，避免跟凍結轉場的重啟時機互相搶跑
 * @returns {void}
 */
const _resumeTickIfNeeded = () => {
  if (!tickTimer && !pauseTimer && !document.hidden) {
    tickTimer = setInterval(_tick, TICK_MS)
  }
}

const _handleVisibilityChange = () => {
  if (document.hidden) {
    _stopTick()
  }
  else {
    _resumeTickIfNeeded()
  }
}

/**
 * 畫面凍結在目前狀態（不清空、不隱藏）幾秒後才重啟下一輪，比照使用者要求的「全部停住再接著跑」
 * @param {() => void} next 凍結時間到之後要執行的重啟函式
 * @returns {void}
 */
const _pauseThen = (next: () => void) => {
  isFrozen.value = true
  _stopTick()
  if (pauseTimer) clearTimeout(pauseTimer)
  pauseTimer = setTimeout(() => {
    isFrozen.value = false
    pauseTimer = null
    next()
    _resumeTickIfNeeded()
  }, FREEZE_MS)
}

/**
 * 打字階段丟出下一個字：字的大小隨機（大小不一），出生位置固定在畫面底部
 * @returns {void}
 */
const _spawnWord = () => {
  const text = WORDS[Math.floor(Math.random() * WORDS.length)]!
  const size = WORD_SIZES[Math.floor(Math.random() * WORD_SIZES.length)]!
  words.value.push({ id: _nextId(), text, x: 6 + Math.random() * 88, y: 96, revealed: 0, size })
  _spawnedCount += 1
}

/**
 * 隨機挑一個還活著的外星人所在欄位當作砲台下一個瞄準點，讓移動看起來有目的（追著打）而不是規律掃射
 * 找不到存活目標時（例如剛好都死光）退回畫面中央，避免砲台卡住不動
 * @returns {number} 目標的橫向百分比座標
 */
const _pickTurretTarget = (): number => {
  const aliveCols = aliens.value.filter((a) => a.alive).map((a) => colToPercent(a.col) + formationX.value)
  if (aliveCols.length === 0) return 50
  return aliveCols[Math.floor(Math.random() * aliveCols.length)]!
}

const _tickInvasion = () => {
  formationY.value += DESCENT_SPEED

  _swayT += 1
  formationX.value = Math.sin(_swayT * SWAY_SPEED) * SWAY_AMPLITUDE

  _turretRetargetCounter -= 1
  if (_turretRetargetCounter <= 0 || Math.abs(turretX.value - _turretTargetX) < 1.5) {
    _turretTargetX = _pickTurretTarget()
    _turretRetargetCounter = TURRET_RETARGET_MIN + Math.floor(Math.random() * TURRET_RETARGET_RANGE)
  }
  const turretDelta = _turretTargetX - turretX.value
  turretX.value += Math.sign(turretDelta) * Math.min(TURRET_MOVE_SPEED, Math.abs(turretDelta))

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
        && Math.abs(colToPercent(a.col) + formationX.value - bullet.x) < COL_HIT_RADIUS
        && Math.abs(rowToPercent(a.row) + formationY.value - bullet.y) < ROW_HIT_RADIUS,
    )
    if (target) {
      target.hp -= 1
      if (target.hp <= 0) {
        target.alive = false
        explosions.value.push({ id: _nextId(), x: bullet.x, y: bullet.y, ttl: EXPLOSION_TTL })
      }
      else {
        target.hitTtl = HIT_FLASH_TTL
      }
      bullet.y = -999
    }
  }
  bullets.value = bullets.value.filter((b) => b.y > 0)

  aliens.value.forEach((a) => {
    if (a.hitTtl > 0) a.hitTtl -= 1
  })

  explosions.value.forEach((e) => (e.ttl -= 1))
  explosions.value = explosions.value.filter((e) => e.ttl > 0)

  const aliveRows = aliens.value.filter((a) => a.alive).map((a) => a.row)
  const frontRow = aliveRows.length ? Math.max(...aliveRows) : -1
  const reachedBottom = frontRow === -1 || rowToPercent(frontRow) + formationY.value >= BOTTOM_LIMIT
  /** 陣型觸底（碰到砲台）→ 轉場進入自動打字階段 */
  if (reachedBottom) _pauseThen(_startTyping)
}

const _tickTyping = () => {
  _spawnCounter -= 1
  if (_spawnCounter <= 0) {
    if (words.value.length < MAX_WORDS) _spawnWord()
    _spawnCounter = Math.max(SPAWN_MIN_TICKS, SPAWN_BASE_TICKS - _spawnedCount * SPAWN_DECAY_PER_WORD)
  }

  /** 只有排最前面（最早出現）的字會被自動輸入，其餘字只是持續上升排隊等輪到它 */
  const active = words.value[0]
  if (active) {
    _typeCounter += 1
    if (_typeCounter >= CHAR_TICKS) {
      _typeCounter = 0
      if (active.revealed < active.text.length) active.revealed += 1
      if (active.revealed === active.text.length) {
        scorePops.value.push({ id: _nextId(), x: active.x, y: active.y, ttl: SCORE_TTL, text: '+10' })
        words.value.shift()
      }
    }
  }

  words.value.forEach((w) => (w.y -= WORD_RISE_SPEED))

  scorePops.value.forEach((s) => {
    s.y -= SCORE_RISE_SPEED
    s.ttl -= 1
  })
  scorePops.value = scorePops.value.filter((s) => s.ttl > 0)

  /** 排隊越來越久的字來不及打完就衝到最上方 → 防線失守，轉場回外星人入侵階段 */
  if (words.value.some((w) => w.y <= WORD_TOP_LIMIT)) _pauseThen(_startInvasion)
}

const _tick = () => {
  if (phase.value === 'invasion') _tickInvasion()
  else _tickTyping()
}

onMounted(() => {
  _startInvasion()
  _resumeTickIfNeeded()
  document.addEventListener('visibilitychange', _handleVisibilityChange)
})

onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', _handleVisibilityChange)
  _stopTick()
  if (pauseTimer) clearTimeout(pauseTimer)
})
</script>

<template>
  <div class="invasion-lane" aria-hidden="true">
    <div class="stage" :class="{ 'is-frozen': isFrozen }">
      <template v-if="phase === 'invasion' && showActors">
        <span
          v-for="alien in aliens"
          v-show="alien.alive"
          :key="alien.id"
          class="alien"
          :class="[rowClass(alien.row), { 'is-hit': alien.hitTtl > 0 }]"
          :style="{ left: `${colToPercent(alien.col) + formationX}%`, top: `${rowToPercent(alien.row) + formationY}%` }"
        >
          <svg viewBox="0 0 11 8" class="alien-svg">
            <rect v-for="(c, i) in ALIEN_PIXEL_CELLS" :key="i" :x="c.x" :y="c.y" width="1" height="1" />
          </svg>
        </span>

        <span class="turret" :style="{ left: `${turretX}%`, top: `${TURRET_Y}%` }" />

        <span v-for="b in bullets" :key="`b-${b.id}`" class="bullet" :style="{ left: `${b.x}%`, top: `${b.y}%` }" />

        <span v-for="e in explosions" :key="`e-${e.id}`" class="explosion" :style="{ left: `${e.x}%`, top: `${e.y}%` }" />
      </template>

      <template v-if="phase === 'typing' && showActors">
        <div
          v-for="(w, idx) in words"
          :key="w.id"
          class="word"
          :class="{ active: idx === 0 }"
          :style="{ left: `${w.x}%`, top: `${w.y}%`, fontSize: `${w.size}px` }"
        >
          <template v-if="idx === 0">
            <span class="typed">{{ w.text.slice(0, w.revealed) }}</span
            ><span class="cursor">_</span><span class="pending">{{ w.text.slice(w.revealed) }}</span>
          </template>
          <template v-else>
            <span class="pending">{{ w.text }}</span>
          </template>
        </div>

        <span v-for="s in scorePops" :key="`s-${s.id}`" class="score-pop" :style="{ left: `${s.x}%`, top: `${s.y}%` }">{{ s.text }}</span>
      </template>
    </div>
  </div>
</template>

<style scoped lang="scss">
.stage {
  position: relative;
  height: 360px;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    background-image:
      radial-gradient(1.5px 1.5px at 8% 20%, rgba(255, 255, 255, 0.8), transparent),
      radial-gradient(1.5px 1.5px at 22% 68%, rgba(255, 255, 255, 0.5), transparent),
      radial-gradient(1.5px 1.5px at 38% 12%, rgba(255, 255, 255, 0.7), transparent),
      radial-gradient(1.5px 1.5px at 55% 48%, rgba(255, 255, 255, 0.45), transparent),
      radial-gradient(1.5px 1.5px at 68% 82%, rgba(255, 255, 255, 0.65), transparent),
      radial-gradient(1.5px 1.5px at 80% 28%, rgba(255, 255, 255, 0.55), transparent),
      radial-gradient(1.5px 1.5px at 92% 60%, rgba(255, 255, 255, 0.8), transparent),
      radial-gradient(1.5px 1.5px at 15% 90%, rgba(255, 255, 255, 0.4), transparent),
      radial-gradient(1.5px 1.5px at 47% 92%, rgba(255, 255, 255, 0.5), transparent);
    animation: iv-twinkle 3.6s ease-in-out infinite;
  }

  &.is-frozen {
    &::before {
      animation-play-state: paused;
    }

    * {
      animation-play-state: paused;
    }
  }
}

.alien {
  position: absolute;
  display: block;
  width: 33px;
  height: 24px;
  transform: translate(-50%, -50%);
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

  /** 中彈但沒死：短暫閃白，讓玩家看得出打中了但還沒解決掉 */
  &.is-hit {
    color: #fff;
    filter: drop-shadow(0 0 8px #fff);
  }

  /*
   * 欄距是依 stage 寬度算的百分比，寬度縮小時同樣的像素尺寸會擠在一起黏成一片，
   * 所以窄螢幕改用較小的固定尺寸，維持跟欄距相近的比例、外星人之間才不會疊在一起
   */
  @media (max-width: 1024px) {
    width: 24px;
    height: 17px;
    filter: drop-shadow(0 0 3px currentColor);
  }

  @media (max-width: 560px) {
    width: 15px;
    height: 11px;
    filter: drop-shadow(0 0 2px currentColor);
  }
}

.alien-svg {
  width: 100%;
  height: 100%;
  display: block;

  rect {
    fill: currentColor;
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

@keyframes iv-twinkle {

  0%,
  100% {
    opacity: 0.55;
  }

  50% {
    opacity: 1;
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
