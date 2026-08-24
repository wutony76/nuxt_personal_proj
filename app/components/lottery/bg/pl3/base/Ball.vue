<script setup lang="ts">
import { computed } from 'vue'
import { PL3_DIGIT_MAX } from '#shared/config/pl3'

/**
 * 排列3號碼球（0 ~ 9）
 *
 * 與 eggs / ssc 的 base/Ball.vue 同一套視覺風格：號碼可重複，用「大小分色」
 * （單顆點數 ≥5 為大、<5 為小）一眼看出分布，純粹是視覺分色，不代表判定。
 */
const props = defineProps<{
  digit?: number | string
  size?: 'xs' | 'sm' | 'md' | 'lg'
  /** 未開獎時顯示問號 */
  pending?: boolean
  /** 中獎標記（外圈光暈） */
  hit?: boolean
}>()

/** -1 代表「不是合法號碼」（未開獎或格式不合），畫成待開獎球 */
const digit = computed(() => {
  const num = Number(props.digit)
  return Number.isInteger(num) && num >= 0 && num <= PL3_DIGIT_MAX ? num : -1
})
const label = computed(() => (digit.value >= 0 ? String(digit.value) : '?'))
const isBig = computed(() => digit.value >= 5)
</script>

<template>
  <span class="pl3-ball" :class="[
    `is-${props.size ?? 'md'}`,
    digit >= 0 ? (isBig ? 'is-big' : 'is-small') : '',
    { 'is-pending': props.pending || digit < 0, 'is-hit': props.hit }
  ]">{{ props.pending ? '?' : label }}</span>
</template>

<style scoped lang="scss">
.pl3-ball {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  border-radius: 50%;
  font-variant-numeric: tabular-nums;
  font-weight: 800;
  background: #94a3b8;
  color: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);

  &.is-big {
    background: #dc2626;
  }

  &.is-small {
    background: #2563eb;
  }

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
