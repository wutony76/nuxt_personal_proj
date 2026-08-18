<script setup lang="ts">
import { computed } from 'vue'
import { EGGS_BIG_LINE, EGGS_DIGIT_MAX } from '#shared/config/eggs'

/**
 * PC蛋蛋號碼球（0 ~ 9）
 *
 * 與 ssc 的 base/Ball.vue 同一套（三球結構完全相同）：號碼可重複，
 * 改用「大小分色」而非固定色，一眼看得出大小分布（兩面／大小單雙都吃它）。
 * ⚠️ 大小分界改用 EGGS_BIG_LINE（依和值 >13 才算大），本球只依單顆點數的 ≥5/<5 上色，
 *    純粹是視覺分色，不代表該顆球本身有大小判定。
 */
const props = defineProps<{
  digit?: number | string
  size?: 'xs' | 'sm' | 'md' | 'lg'
  /** 未開獎時顯示問號 */
  pending?: boolean
  /** 中獎標記（外圈光暈） */
  hit?: boolean
  /** 未選取的號碼（選號格用）：淡化顯示 */
  muted?: boolean
}>()

/** -1 代表「不是合法號碼」（未開獎或格式不合），畫成待開獎球 */
const digit = computed(() => {
  const num = Number(props.digit)
  return Number.isInteger(num) && num >= 0 && num <= EGGS_DIGIT_MAX ? num : -1
})
const label = computed(() => (digit.value >= 0 ? String(digit.value) : '?'))
const isBig = computed(() => digit.value >= Math.ceil((EGGS_BIG_LINE + 1) / 3))
</script>

<template>
  <span class="eggs-ball" :class="[
    `is-${props.size ?? 'md'}`,
    digit >= 0 ? (isBig ? 'is-big' : 'is-small') : '',
    { 'is-pending': props.pending || digit < 0, 'is-hit': props.hit, 'is-muted': props.muted }
  ]">{{ props.pending ? '?' : label }}</span>
</template>

<style scoped lang="scss">
.eggs-ball {
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
