<script setup lang="ts">
import { computed } from 'vue'
import { SSC_BIG_LINE, SSC_DIGIT_MAX } from '#shared/config/ssc'

/**
 * 時時彩號碼球（0 ~ 9）
 *
 * 對應 k3 的 Dice.vue、pk10 的 Car.vue。
 * ⚠️ 與 pk10 的車號球最大的不同：時時彩的號碼**可以重複**，
 *    所以不能像賽車那樣「一個號碼一個固定色」來辨識 —— 同一期可能出現兩顆 7。
 *    這裡改用「大小分色」（≥5 為大／<5 為小），讓看板一眼看得出大小分布，
 *    這也是玩家最常看的一個面（兩面、大小單雙都吃它）。
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
  return Number.isInteger(num) && num >= 0 && num <= SSC_DIGIT_MAX ? num : -1
})
const label = computed(() => (digit.value >= 0 ? String(digit.value) : '?'))
const isBig = computed(() => digit.value >= SSC_BIG_LINE)
</script>

<template>
  <span class="ssc-ball" :class="[
    `is-${props.size ?? 'md'}`,
    digit >= 0 ? (isBig ? 'is-big' : 'is-small') : '',
    { 'is-pending': props.pending || digit < 0, 'is-hit': props.hit, 'is-muted': props.muted }
  ]">{{ props.pending ? '?' : label }}</span>
</template>

<style scoped lang="scss">
.ssc-ball {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  border-radius: 50%;
  /* 等寬數字，號碼球排成一列時寬度才一致 */
  font-variant-numeric: tabular-nums;
  font-weight: 800;
  background: #94a3b8;
  color: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);

  /* 大（≥5）暖色、小（<5）冷色 —— 與兩面／大小單雙的分界同一條線 */
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

  /* 選號格裡沒被選到的號碼：留白底＋灰字，與選中的實心球拉開對比 */
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
