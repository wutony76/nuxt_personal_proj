<script setup lang="ts">
import { computed } from 'vue'
import { D539_NUMBER_MIN, D539_NUMBER_MAX, D539_PICK_COUNT } from '#shared/config/d539'
import { useD539 } from '~/composables/useD539'
import type { D539Slot } from '~/composables/useD539'

/**
 * 今彩539投注區——比照 DLT base/Board.vue，還原官方紙本投注單：01~39 排成方格供圈選，
 * 對應 A~E 其中一組注格。今彩539是單一號碼池、選滿 5 個即可，**沒有特別號**，
 * 因此不需要 DLT 那組「特別號」獨立 UI（本站大樂透的特別號來自官方第 7 顆球，今彩539沒有）。
 */
const props = defineProps<{ slot: D539Slot; disabled?: boolean }>()

const { actions } = useD539()

const numbers = computed(() => Array.from({ length: D539_NUMBER_MAX - D539_NUMBER_MIN + 1 }, (_, i) => D539_NUMBER_MIN + i))
const isFull = computed(() => props.slot.numbers.length >= D539_PICK_COUNT)

const click = {
  toggle: (num: number) => {
    if (props.disabled) return
    actions.toggleNumber(props.slot.id, num)
  },
  quickPick: () => {
    if (props.disabled) return
    actions.quickPick(props.slot.id)
  },
  clear: () => {
    if (props.disabled) return
    actions.clearSlot(props.slot.id)
  }
}
</script>

<template>
  <div class="d539-board" :class="{ 'is-disabled': disabled }">
    <div class="d539-board-head">
      <span class="d539-board-title">第 {{ slot.id }} 組</span>
      <span class="d539-board-count" :class="{ 'is-full': isFull }">已選 {{ slot.numbers.length }} / {{ D539_PICK_COUNT }}</span>
      <div class="d539-board-actions">
        <button type="button" class="d539-board-btn d539-board-btn-primary" :disabled="disabled"
          @click="click.quickPick">電腦選號</button>
        <button type="button" class="d539-board-btn" :disabled="disabled" @click="click.clear">清空</button>
      </div>
    </div>

    <div class="d539-board-grid">
      <button v-for="num in numbers" :key="num" type="button" class="d539-board-cell"
        :disabled="disabled || (!slot.numbers.includes(num) && isFull)"
        :class="{ 'is-selected': slot.numbers.includes(num) }" @click="click.toggle(num)">
        {{ num }}
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.d539-board {
  border: 1px solid var(--color-neutral-300, #dcd3c4);
  border-radius: var(--base-radius, 0.375rem);
  background: var(--color-neutral-100, #f9f4ed);
  padding: 0.75rem;

  &.is-disabled {
    opacity: 0.6;
  }
}

.d539-board-head {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;

  .d539-board-title {
    font-size: 14px;
    font-weight: 700;
    font-family: var(--font-heading);
    color: var(--color-accent-700, #8c491a);
  }

  .d539-board-count {
    font-size: 12px;
    color: var(--color-neutral-700, #645c50);

    &.is-full {
      color: #15803d;
      font-weight: 700;
    }
  }

  .d539-board-actions {
    margin-left: auto;
    display: flex;
    gap: 0.375rem;
  }

  .d539-board-btn {
    border: 1px solid var(--color-accent-700, #8c491a);
    border-radius: 0.25rem;
    background: var(--color-neutral-100, #f9f4ed);
    color: var(--color-accent-700, #8c491a);
    font-size: 12px;
    padding: 3px 8px;
    cursor: pointer;
    transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;

    &:hover:not(:disabled) {
      background: var(--color-accent-100, #fff2eb);
    }

    &:disabled {
      opacity: 0.5;
      cursor: default;
    }

    &.d539-board-btn-primary {
      border-color: var(--color-accent-700, #8c491a);
      background: var(--color-accent-700, #8c491a);
      color: #fff;

      &:hover:not(:disabled) {
        background: var(--color-accent-800, #643312);
        border-color: var(--color-accent-800, #643312);
      }
    }
  }
}

.d539-board-grid {
  display: grid;
  grid-template-columns: repeat(10, 30px);
  justify-content: center;
  gap: 0.4rem;
  background: #fff8e7;
  border: 1px solid #d1242f;
  border-radius: 0.25rem;
  padding: 0.6rem;
}

.d539-board-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: 1.5px solid #d1242f;
  border-radius: 2px;
  background: #fffdf8;
  color: #d1242f;
  font-family: var(--font-heading, inherit);
  font-weight: 700;
  font-size: 14px;
  font-variant-numeric: tabular-nums;
  padding: 0;
  cursor: pointer;
  transition: background-color 0.1s ease, color 0.1s ease;

  &.is-selected {
    background: #6c2424;
    border-color: #6c2424;
    color: #fff;
    box-shadow: inset 0 -3px 0 rgba(0, 0, 0, 0.28);
  }

  &:disabled {
    cursor: default;
    opacity: 0.45;
  }
}
</style>
