<script setup lang="ts">
import { computed } from 'vue'
import { BINGO_NUMBER_MIN, BINGO_NUMBER_MAX } from '#shared/config/bingo'

/** 賓果賓果號碼球（01~80），比照 P3 base/Digit.vue 同一套大小分色寫法 */
const props = defineProps<{
  num?: number | string
  size?: 'xs' | 'sm' | 'md' | 'lg'
  pending?: boolean
  /** 中獎/超級獎號標記（外圈光暈） */
  hit?: boolean
  muted?: boolean
}>()

const num = computed(() => {
  const value = Number(props.num)
  return Number.isInteger(value) && value >= BINGO_NUMBER_MIN && value <= BINGO_NUMBER_MAX ? value : -1
})
const label = computed(() => (num.value >= 0 ? String(num.value).padStart(2, '0') : '?'))
</script>

<template>
  <span class="bingo-ball" :class="[
    `is-${props.size ?? 'md'}`,
    { 'is-pending': props.pending || num < 0, 'is-hit': props.hit, 'is-muted': props.muted }
  ]">{{ props.pending ? '?' : label }}</span>
</template>

<style scoped lang="scss">
.bingo-ball {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  border-radius: 50%;
  font-variant-numeric: tabular-nums;
  font-weight: 800;
  background: var(--color-yellow-black-btn, #fecf13);
  color: var(--color-yellow-btn-text, #38300d);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);

  &.is-xs {
    width: 1.5rem;
    height: 1.5rem;
    font-size: 10px;
  }

  &.is-sm {
    width: 1.8rem;
    height: 1.8rem;
    font-size: 11px;
  }

  &.is-md {
    width: 2.2rem;
    height: 2.2rem;
    font-size: 12px;
  }

  &.is-lg {
    width: 2.75rem;
    height: 2.75rem;
    font-size: 14px;
  }

  &.is-pending {
    background: #f1f5f9;
    color: #94a3b8;
    box-shadow: inset 0 0 0 1px #cbd5e1;
  }

  &.is-muted {
    background: #fff;
    color: #64748b;
    box-shadow: inset 0 0 0 1px #cbd5e1;
  }

  &.is-hit {
    box-shadow: 0 0 0 2px #fff, 0 0 0 4px var(--color-yellow-text, #fbbf24);
  }
}
</style>
