<script setup lang="ts">
import { computed } from 'vue'
import { P3_DIGIT_MIN, P3_DIGIT_MAX } from '#shared/config/p3'

/**
 * 3星彩單一數字球（0 ~ 9），比照 M649/D539 的 base/Ball.vue 同一套大小分色寫法，
 * 差異只在顯示值是單一數字（0~9）而非兩碼號碼。
 */
const props = defineProps<{
  num?: number | string
  size?: 'xs' | 'sm' | 'md' | 'lg'
  pending?: boolean
  /** 中獎/已選標記（外圈光暈） */
  hit?: boolean
  muted?: boolean
}>()

const digit = computed(() => {
  const value = Number(props.num)
  return Number.isInteger(value) && value >= P3_DIGIT_MIN && value <= P3_DIGIT_MAX ? value : -1
})
const label = computed(() => (digit.value >= 0 ? String(digit.value) : '?'))
</script>

<template>
  <span class="p3-digit" :class="[
    `is-${props.size ?? 'md'}`,
    { 'is-pending': props.pending || digit < 0, 'is-hit': props.hit, 'is-muted': props.muted }
  ]">{{ props.pending ? '?' : label }}</span>
</template>

<style scoped lang="scss">
.p3-digit {
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
