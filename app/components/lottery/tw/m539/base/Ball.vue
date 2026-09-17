<script setup lang="ts">
import { computed } from 'vue'
import { M539_NUMBER_MIN, M539_NUMBER_MAX } from '#shared/config/m539'

/**
 * 39樂合彩號碼球（01 ~ 49），比照 D539 的 base/Ball.vue 同一套大小分色寫法。
 * 39樂合彩跟隨今彩539 5 個號碼、沒有特別號，因此不需要特別號（金色）樣式。
 */
const props = defineProps<{
  num?: number | string
  size?: 'xs' | 'sm' | 'md' | 'lg'
  pending?: boolean
  /** 中獎/已選標記（外圈光暈） */
  hit?: boolean
  /** 未選取的號碼（選號格用）：淡化顯示 */
  muted?: boolean
}>()

const num = computed(() => {
  const value = Number(props.num)
  return Number.isInteger(value) && value >= M539_NUMBER_MIN && value <= M539_NUMBER_MAX ? value : -1
})
const label = computed(() => (num.value > 0 ? String(num.value).padStart(2, '0') : '?'))
</script>

<template>
  <span class="m539-ball" :class="[
    `is-${props.size ?? 'md'}`,
    { 'is-pending': props.pending || num < 0, 'is-hit': props.hit, 'is-muted': props.muted }
  ]">{{ props.pending ? '?' : label }}</span>
</template>

<style scoped lang="scss">
.m539-ball {
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
    font-size: 15px;
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
