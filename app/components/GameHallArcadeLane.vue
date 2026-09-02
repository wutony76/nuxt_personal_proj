<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

const SLOT_COUNT = 22
const PELLET_COUNT = 10
const PAC_SPEED = 0.38
const SNAKE_SPEED = 0.38
const TICK_MS = 32
const GHOST_LAG = [10, 12, 13, 15, 18, 20, 30]
const EAT_THRESHOLD = 2.8

const SNAKE_INITIAL_BODY = 2

const SNAKE_HEAD_PX = 18
const SNAKE_BODY_PX = 14
const SNAKE_GAP_PX = 3
const SNAKE_HEAD_OFFSET_PX = 9

const SNAKE_PELLET_SPAWN_STEP_MS = 70

type Phase = 'pac' | 'snake'

const phase = ref<Phase>('pac')
const showActors = ref(false)
const pelletSlots = ref<number[]>([])
const eatenSlots = ref<number[]>([])
const pacX = ref(-10)
const snakeX = ref(110)
const snakeBodyCount = ref(SNAKE_INITIAL_BODY)
const snakeCanMove = ref(false)
const trackRef = ref<HTMLElement | null>(null)

let tickTimer: ReturnType<typeof setInterval> | null = null
let pauseTimer: ReturnType<typeof setTimeout> | null = null
let snakeSpawnTimer: ReturnType<typeof setTimeout> | null = null

/**
 * 將格子索引轉為軌道上的百分比位置（左右留白）
 * @param {number} slot 格子索引
 * @returns {number} 0–100 的百分比
 */
const slotToPercent = (slot: number): number => 4 + (slot / (SLOT_COUNT - 1)) * 92

/**
 * 隨機選取豆子格子（不填滿整列）
 * @param {number} count 豆子數量
 * @returns {number[]} 排序後的格子索引
 */
const _pickRandomSlots = (count: number): number[] => {
  const pool = Array.from({ length: SLOT_COUNT }, (_, i) => i)
  const picked: number[] = []
  for (let i = 0; i < count && pool.length > 0; i++) {
    const idx = Math.floor(Math.random() * pool.length)
    const [slot] = pool.splice(idx, 1)
    if (slot !== undefined) picked.push(slot)
  }
  return picked.toSorted((a, b) => a - b)
}

const ghostPositions = computed(() => GHOST_LAG.map((lag) => pacX.value - lag))

/**
 * 豆子出現動畫延遲：貪吃蛇階段由右到左依次出現
 * @param {number} slot 格子索引
 * @returns {string} CSS animation-delay
 */
const pelletPopDelay = (slot: number): string => {
  if (phase.value === 'snake') {
    const sorted = pelletSlots.value.toSorted((a, b) => slotToPercent(b) - slotToPercent(a))
    const order = sorted.indexOf(slot)
    return `${order * (SNAKE_PELLET_SPAWN_STEP_MS / 1000)}s`
  }
  const idx = pelletSlots.value.indexOf(slot)
  return `${idx * 0.06}s`
}

/**
 * 估算蛇身總寬（頭 + 身體段）
 * @returns {number} 像素寬度
 */
const _snakeWidthPx = (): number => {
  const bodies = snakeBodyCount.value
  if (bodies === 0) return SNAKE_HEAD_PX
  return SNAKE_HEAD_PX + bodies * SNAKE_BODY_PX + (bodies - 1) * SNAKE_GAP_PX
}

/**
 * 蛇是否已完整離開左側（尾巴也過界，避免身體還在畫面上就輪播）
 * @returns {boolean}
 */
const _isSnakeFullyOffLeft = (): boolean => {
  const trackW = trackRef.value?.clientWidth ?? 720
  const leftPx = (snakeX.value / 100) * trackW - SNAKE_HEAD_OFFSET_PX
  return leftPx + _snakeWidthPx() < -8
}

const isEaten = (slot: number) => eatenSlots.value.includes(slot)

const _markEaten = (slot: number) => {
  if (eatenSlots.value.includes(slot)) return
  eatenSlots.value = [...eatenSlots.value, slot]
  if (phase.value === 'snake') {
    snakeBodyCount.value += 1
  }
}

const _startPac = () => {
  phase.value = 'pac'
  pelletSlots.value = _pickRandomSlots(PELLET_COUNT)
  eatenSlots.value = []
  pacX.value = -10
  showActors.value = true
}

const _startSnake = () => {
  phase.value = 'snake'
  pelletSlots.value = _pickRandomSlots(PELLET_COUNT)
  eatenSlots.value = []
  snakeX.value = 110
  snakeBodyCount.value = SNAKE_INITIAL_BODY
  snakeCanMove.value = false
  showActors.value = true
  if (snakeSpawnTimer) clearTimeout(snakeSpawnTimer)
  const spawnDoneMs = (PELLET_COUNT - 1) * SNAKE_PELLET_SPAWN_STEP_MS + 120
  snakeSpawnTimer = setTimeout(() => {
    snakeCanMove.value = true
    snakeSpawnTimer = null
  }, spawnDoneMs)
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
  }, 480)
}

const _tick = () => {
  if (phase.value === 'pac') {
    pacX.value += PAC_SPEED
    pelletSlots.value.forEach((slot) => {
      if (Math.abs(pacX.value - slotToPercent(slot)) < EAT_THRESHOLD) {
        _markEaten(slot)
      }
    })
    if (pacX.value > 112 + Math.max(...GHOST_LAG)) {
      _pauseThen(_startSnake)
    }
    return
  }

  snakeX.value -= snakeCanMove.value ? SNAKE_SPEED : 0
  pelletSlots.value.forEach((slot) => {
    if (Math.abs(snakeX.value - slotToPercent(slot)) < EAT_THRESHOLD) {
      _markEaten(slot)
    }
  })
  if (_isSnakeFullyOffLeft()) {
    _pauseThen(_startPac)
  }
}

onMounted(() => {
  _startPac()
  tickTimer = setInterval(_tick, TICK_MS)
})

onBeforeUnmount(() => {
  if (tickTimer) clearInterval(tickTimer)
  if (pauseTimer) clearTimeout(pauseTimer)
  if (snakeSpawnTimer) clearTimeout(snakeSpawnTimer)
})
</script>

<template>
  <div class="arcade-lane" aria-hidden="true">
    <div ref="trackRef" class="track">
      <div
        v-for="slot in pelletSlots"
        v-show="!isEaten(slot)"
        :key="`${phase}-${slot}`"
        class="pellet"
        :class="{
          'is-pac': phase === 'pac',
          'is-snake': phase === 'snake',
        }"
        :style="{
          left: `${slotToPercent(slot)}%`,
          '--pellet-delay': pelletPopDelay(slot),
        }"
      />

      <template v-if="phase === 'pac' && showActors">
        <div class="pacman" :style="{ left: `${pacX}%` }" />
        <div
          v-for="(gx, i) in ghostPositions"
          :key="`ghost-${i}`"
          class="ghost"
          :class="`ghost-${i}`"
          :style="{ left: `${gx}%` }"
        />
      </template>

      <template v-if="phase === 'snake' && showActors">
        <div class="snake" :style="{ left: `${snakeX}%` }">
          <span class="snake-seg snake-head" />
          <span
            v-for="n in snakeBodyCount"
            :key="`snake-body-${n}`"
            class="snake-seg snake-body"
          />
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped lang="scss">
.arcade-lane {
  margin-bottom: 20px;
}

.track {
  position: relative;
  height: 30px;
  overflow: hidden;
}

.pellet {
  position: absolute;
  top: 50%;
  width: 8px;
  height: 8px;
  margin: -4px 0 0 -4px;
  border-radius: 50%;
  animation: pellet-pop 0.35s ease-out var(--pellet-delay, 0s) both;

  &.is-pac {
    background: #ffd83b;
    box-shadow: 0 0 6px #ffd83b, 0 0 12px rgba(255, 216, 59, 0.65);
  }

  &.is-snake {
    background: #22ff22;
    box-shadow: 0 0 6px #22ff22, 0 0 12px rgba(34, 255, 34, 0.55);
  }
}

.pacman {
  position: absolute;
  top: 50%;
  width: 20px;
  height: 20px;
  margin: -10px 0 0 -10px;
  background: #ffd83b;
  border-radius: 50%;
  box-shadow: 0 0 10px rgba(255, 216, 59, 0.85);
  z-index: 3;

  &::after {
    content: '';
    position: absolute;
    inset: 0;
    background: #0a0618;
    clip-path: polygon(100% 0, 100% 100%, 42% 50%);
    animation: pac-chomp 0.24s steps(2, end) infinite;
  }
}

.ghost {
  position: absolute;
  top: 50%;
  width: 18px;
  height: 18px;
  margin: -9px 0 0 -9px;
  border-radius: 9px 9px 3px 3px;
  z-index: 2;

  &::before,
  &::after {
    content: '';
    position: absolute;
    top: 5px;
    width: 4px;
    height: 4px;
    background: #fff;
    border-radius: 50%;
  }

  &::before {
    left: 4px;
  }

  &::after {
    right: 4px;
  }

  &.ghost-0 {
    background: #ff2121;
    box-shadow: 0 0 8px rgba(255, 33, 33, 0.8);
  }

  &.ghost-1 {
    background: #ffb8ff;
    box-shadow: 0 0 8px rgba(255, 184, 255, 0.8);
  }

  &.ghost-2 {
    background: #00e8e8;
    box-shadow: 0 0 8px rgba(0, 232, 232, 0.8);
  }

  &.ghost-3 {
    background: #ffb852;
    box-shadow: 0 0 8px rgba(255, 184, 82, 0.8);
  }

  &.ghost-4 {
    background: #7bc96f;
    box-shadow: 0 0 8px rgba(123, 201, 111, 0.8);
  }

  &.ghost-5 {
    background: #bc7dff;
    box-shadow: 0 0 8px rgba(188, 125, 255, 0.8);
  }

  &.ghost-6 {
    background: #ff6eb4;
    box-shadow: 0 0 8px rgba(255, 110, 180, 0.8);
  }
}

.snake {
  position: absolute;
  top: 50%;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 3px;
  margin-top: -9px;
  margin-left: -9px;
  z-index: 3;
}

.snake-seg {
  flex-shrink: 0;

  &.snake-head {
    position: relative;
    width: 18px;
    height: 18px;
    background: #22ff22;
    border-radius: 4px 2px 2px 4px;
    box-shadow: 0 0 8px rgba(34, 255, 34, 0.85);

    /* 朝左移動：眼睛在左側 */
    &::before {
      content: '';
      position: absolute;
      top: 4px;
      left: 3px;
      width: 4px;
      height: 4px;
      background: #0a2810;
      border-radius: 50%;
    }

    &::after {
      content: '';
      position: absolute;
      top: 50%;
      left: 1px;
      width: 0;
      height: 0;
      margin-top: -3px;
      border-top: 3px solid transparent;
      border-bottom: 3px solid transparent;
      border-right: 4px solid #0a2810;
    }
  }

  &.snake-body {
    width: 14px;
    height: 14px;
    background: #1adb1a;
    border-radius: 3px;
    box-shadow: 0 0 4px rgba(34, 255, 34, 0.5);
  }
}

@keyframes pellet-pop {
  from {
    opacity: 0;
    transform: scale(0);
  }

  to {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes pac-chomp {
  /* 張嘴：開口縮小 */
  0%,
  100% {
    clip-path: polygon(100% 0, 100% 100%, 42% 50%);
  }

  /* 閉嘴：幾乎合攏 */
  50% {
    clip-path: polygon(100% 0, 100% 100%, 91% 49.5%, 91% 50.5%);
  }
}
</style>
