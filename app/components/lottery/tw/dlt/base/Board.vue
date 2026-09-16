<script setup lang="ts">
import { computed } from 'vue'
import { DLT_NUMBER_MIN, DLT_NUMBER_MAX, DLT_PICK_COUNT } from '#shared/config/dlt'
import { useDlt } from '~/composables/useDlt'
import type { DltSlot } from '~/composables/useDlt'

/**
 * 大樂透投注區——還原官方紙本投注單：1~49 排成 7×7 方格供圈選（不是 kl10/kl8 那種號碼池），
 * 對應 A~E 其中一組注格（見 openspec/changes/add-dlt/design.md Decision 9）。
 */
const props = defineProps<{ slot: DltSlot; disabled?: boolean }>()

const { actions } = useDlt()

const numbers = computed(() => Array.from({ length: DLT_NUMBER_MAX - DLT_NUMBER_MIN + 1 }, (_, i) => DLT_NUMBER_MIN + i))
const isFull = computed(() => props.slot.numbers.length >= DLT_PICK_COUNT)

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
  <div class="dlt-board" :class="{ 'is-disabled': disabled }">
    <div class="dlt-board-head">
      <span class="dlt-board-title">第 {{ slot.id }} 組</span>
      <span class="dlt-board-count" :class="{ 'is-full': isFull }">已選 {{ slot.numbers.length }} / {{ DLT_PICK_COUNT }}</span>
      <div class="dlt-board-actions">
        <button type="button" class="dlt-board-btn" :disabled="disabled" @click="click.quickPick">電腦選號</button>
        <button type="button" class="dlt-board-btn" :disabled="disabled" @click="click.clear">清空</button>
      </div>
    </div>

    <div class="dlt-board-grid">
      <button v-for="num in numbers" :key="num" type="button" class="dlt-board-cell"
        :disabled="disabled || (!slot.numbers.includes(num) && isFull)"
        :class="{ 'is-selected': slot.numbers.includes(num) }" @click="click.toggle(num)">
        {{ num }}
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.dlt-board {
  border: 1px solid var(--color-neutral-300, #dcd3c4);
  border-radius: var(--base-radius, 0.375rem);
  background: var(--color-neutral-100, #f9f4ed);
  padding: 0.75rem;

  &.is-disabled {
    opacity: 0.6;
  }
}

.dlt-board-head {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;

  .dlt-board-title {
    font-size: 14px;
    font-weight: 700;
    font-family: var(--font-heading);
    color: var(--color-accent-700, #8c491a);
  }

  .dlt-board-count {
    font-size: 12px;
    color: var(--color-neutral-700, #645c50);

    &.is-full {
      color: #15803d;
      font-weight: 700;
    }
  }

  .dlt-board-actions {
    margin-left: auto;
    display: flex;
    gap: 0.375rem;
  }

  .dlt-board-btn {
    border: 1px solid var(--color-accent-700, #8c491a);
    border-radius: 0.25rem;
    background: var(--color-neutral-100, #f9f4ed);
    color: var(--color-accent-700, #8c491a);
    font-size: 12px;
    padding: 3px 8px;
    cursor: pointer;

    &:disabled {
      opacity: 0.5;
      cursor: default;
    }
  }
}

.dlt-board-grid {
  display: grid;
  grid-template-columns: repeat(10, 30px);
  justify-content: center;
  gap: 0.4rem;
  background: #fff8e7;
  border: 1px solid #d1242f;
  border-radius: 0.25rem;
  padding: 0.6rem;
}

.dlt-board-cell {
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
  }

  &:disabled {
    cursor: default;
    opacity: 0.45;
  }
}
</style>
