<script setup lang="ts">
import { computed } from 'vue'
import { kl10NumberLabel, KL10_BIG_LINE, KL10_NUMBER_MAX, KL10_NUMBER_MIN } from '#shared/config/kl10'

/**
 * 快樂十分號碼球（01 ~ 20）
 *
 * 與 11x5 的 base/Ball.vue 同一套（號碼不重複、一律補零兩位），
 * 用「大小分色」讓開獎號的大小分布一眼看得出來（正和單球大小、兩面上下盤都吃這個概念）。
 * ⚠️ 這裡的大小就是**單球**的大小（號碼 ≥ KL10_BIG_LINE 為大），與「總和大小」是兩件事，
 *    總和的標示在 Header／History 上另外顯示。
 */
const props = defineProps<{
  num?: number | string
  size?: 'xs' | 'sm' | 'md' | 'lg'
  /** 未開獎時顯示問號 */
  pending?: boolean
  /** 中獎標記（外圈光暈） */
  hit?: boolean
  /** 未選取的號碼（選號格用）：淡化顯示 */
  muted?: boolean
}>()

/** -1 代表「不是合法號碼」（未開獎或格式不合），畫成待開獎球 */
const num = computed(() => {
  const value = Number(props.num)
  return Number.isInteger(value) && value >= KL10_NUMBER_MIN && value <= KL10_NUMBER_MAX ? value : -1
})
const label = computed(() => (num.value > 0 ? kl10NumberLabel(num.value) : '?'))
const isBig = computed(() => num.value >= KL10_BIG_LINE)
</script>

<template>
  <span class="kl10-ball" :class="[
    `is-${props.size ?? 'md'}`,
    num > 0 ? (isBig ? 'is-big' : 'is-small') : '',
    { 'is-pending': props.pending || num < 0, 'is-hit': props.hit, 'is-muted': props.muted }
  ]">{{ props.pending ? '?' : label }}</span>
</template>

<style scoped lang="scss">
.kl10-ball {
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
