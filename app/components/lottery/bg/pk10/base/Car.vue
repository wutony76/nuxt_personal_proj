<script setup lang="ts">
import { computed } from 'vue'
import { PK10_CAR_COUNT, pk10CarCode } from '#shared/config/pk10'

/**
 * PK10 賽車號碼球
 *
 * 對應 k3 的 Dice.vue —— 快3 是骰子點陣，PK10 是 1 ~ 10 的車號球。
 * 每台車一個固定色（同 pcv2 的賽車配色慣例），這樣路珠與開獎名次一眼就能認出同一台車；
 * ⚠️ 顏色只跟「車號」綁，不跟名次綁 —— 名次是位置，會期期不同。
 */
const props = defineProps<{
  car?: number | string
  size?: 'xs' | 'sm' | 'md' | 'lg'
  /** 未開獎時顯示問號 */
  pending?: boolean
  /** 中獎標記（外圈光暈） */
  hit?: boolean
}>()

/** 10 台車的固定配色（1 ~ 10） */
const CAR_COLORS: Record<number, string> = {
  1: '#facc15',
  2: '#3b82f6',
  3: '#6b7280',
  4: '#fb923c',
  5: '#22d3ee',
  6: '#1e3a8a',
  7: '#e5e7eb',
  8: '#ef4444',
  9: '#7c3aed',
  10: '#16a34a'
}
/** 淺底色的車號要用深色字，不然看不見 */
const LIGHT_CARS = new Set([1, 5, 7])

const car = computed(() => {
  const num = Number(props.car)
  return Number.isInteger(num) && num >= 1 && num <= PK10_CAR_COUNT ? num : 0
})
const label = computed(() => (car.value > 0 ? pk10CarCode(car.value) : '?'))
const style = computed(() => {
  if (car.value === 0) return {}
  return {
    '--car-bg': CAR_COLORS[car.value] ?? '#94a3b8',
    '--car-fg': LIGHT_CARS.has(car.value) ? '#1f2937' : '#fff'
  }
})
</script>

<template>
  <span class="pk10-car" :class="[
    `is-${props.size ?? 'md'}`,
    { 'is-pending': props.pending || car === 0, 'is-hit': props.hit }
  ]" :style="style">{{ props.pending ? '?' : label }}</span>
</template>

<style scoped lang="scss">
.pk10-car {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  border-radius: 50%;
  /* 車號一律等寬數字，01 與 10 的寬度才一致 */
  font-variant-numeric: tabular-nums;
  font-weight: 800;
  background: var(--car-bg, #94a3b8);
  color: var(--car-fg, #fff);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);

  &.is-xs {
    width: 1.35rem;
    height: 1.35rem;
    font-size: 10px;
  }

  &.is-sm {
    width: 1.65rem;
    height: 1.65rem;
    font-size: 11px;
  }

  &.is-md {
    width: 2.1rem;
    height: 2.1rem;
    font-size: 13px;
  }

  &.is-lg {
    width: 2.75rem;
    height: 2.75rem;
    font-size: 16px;
  }

  /* 淺底色的球補一圈邊，白底上才看得出邊界 */
  &.is-pending {
    background: #f1f5f9;
    color: #94a3b8;
    box-shadow: inset 0 0 0 1px #cbd5e1;
  }

  &.is-hit {
    box-shadow: 0 0 0 2px #fff, 0 0 0 4px var(--color-yellow-text, #fbbf24);
  }
}
</style>
