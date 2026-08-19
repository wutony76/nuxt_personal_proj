<script setup lang="ts">
import { computed } from 'vue'
import { x5NumberLabel, X5_BIG_LINE, X5_NUMBER_MAX, X5_NUMBER_MIN } from '#shared/config/x5'

/**
 * 11選5 號碼球（01 ~ 11）
 *
 * 對應 ssc 的 Ball.vue、k3 的 Dice.vue、pk10 的 Car.vue。
 * ⚠️ 號碼一律**補零兩位**顯示（01 ~ 11）—— 11選5 的通行寫法，
 *    且兩位數對齊後號碼球排成一列時不會忽寬忽窄。
 * ⚠️ 11選5 一期開 5 個**不重複**號碼，理論上可以像 pk10 那樣一號一色；
 *    但這裡沿用 ssc 的「大小分色」（≥ X5_BIG_LINE 為大／否則為小），
 *    因為看板上最常看的面就是大小（兩面分頁整組都吃它），
 *    11 個顏色反而看不出分布。
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
  return Number.isInteger(num) && num >= X5_NUMBER_MIN && num <= X5_NUMBER_MAX ? num : -1
})
const label = computed(() => (digit.value >= 0 ? x5NumberLabel(digit.value) : '?'))
const isBig = computed(() => digit.value >= X5_BIG_LINE)
</script>

<template>
  <span class="x5-ball" :class="[
    `is-${props.size ?? 'md'}`,
    digit >= 0 ? (isBig ? 'is-big' : 'is-small') : '',
    { 'is-pending': props.pending || digit < 0, 'is-hit': props.hit, 'is-muted': props.muted }
  ]">{{ props.pending ? '?' : label }}</span>
</template>

<style scoped lang="scss">
.x5-ball {
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

  /* 大（≥7）暖色、小（1~6）冷色 —— 與兩面分頁的大小分界同一條線 */
  &.is-big {
    background: #dc2626;
  }

  &.is-small {
    background: #2563eb;
  }

  /* ⚠️ 字級比 ssc 的球小一級：11選5 一律顯示兩位數（01 ~ 11），
     沿用單位數的字級會把球撐爆或溢出 */
  &.is-xs {
    width: 1.35rem;
    height: 1.35rem;
    font-size: 9px;
  }

  &.is-sm {
    width: 1.65rem;
    height: 1.65rem;
    font-size: 10px;
  }

  &.is-md {
    width: 2.1rem;
    height: 2.1rem;
    font-size: 12px;
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
