<script setup lang="ts">
import { computed } from 'vue'

/** 骰子：以點陣呈現 1 ~ 6，比純數字更容易一眼判讀 */
const props = defineProps<{
  num?: number | string
  size?: 'sm' | 'md' | 'lg'
  /** 未開獎時顯示問號 */
  pending?: boolean
}>()

/** 各點數的點位（3×3 網格的索引 0 ~ 8） */
const PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8]
}

const point = computed(() => {
  const num = Number(props.num)
  return Number.isInteger(num) && num >= 1 && num <= 6 ? num : 0
})
const pips = computed(() => PIPS[point.value] ?? [])
</script>

<template>
  <div class="k3-dice" :class="[`is-${props.size ?? 'md'}`, { 'is-pending': props.pending || point === 0 }]">
    <span v-if="props.pending || point === 0" class="dice-pending">?</span>
    <span v-for="i in 9" v-else :key="i" class="dice-cell">
      <i v-if="pips.includes(i - 1)" class="dice-pip" />
    </span>
  </div>
</template>

<style scoped lang="scss">
.k3-dice {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(3, 1fr);
  border: 2px solid var(--color-red-main);
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.12);

  &.is-sm { width: 1.9rem; height: 1.9rem; padding: 2px; }
  &.is-md { width: 2.8rem; height: 2.8rem; padding: 3px; }
  &.is-lg { width: 3.6rem; height: 3.6rem; padding: 4px; }

  .dice-cell {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .dice-pip {
    width: 60%;
    height: 60%;
    border-radius: 50%;
    background: var(--color-red-main);
  }

  &.is-pending {
    border-color: #cbd5e1;
    background: #f8fafc;
    place-items: center;

    .dice-pending {
      grid-column: 1 / -1;
      grid-row: 1 / -1;
      font-size: 1.2rem;
      font-weight: 700;
      color: #94a3b8;
    }
  }
}
</style>
