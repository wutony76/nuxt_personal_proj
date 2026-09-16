<script setup lang="ts">
import { computed } from 'vue'
import { M649_NUMBER_MIN, M649_NUMBER_MAX } from '#shared/config/m649'
import { useM649 } from '~/composables/useM649'
import type { M649Slot } from '~/composables/useM649'

/**
 * 49樂合彩投注區——與 DLT/D539「固定選 N 個」最大的不同：**每一組要先選「玩幾合」**
 * （二合/三合/四合，即 2/3/4），選定後才決定要從 01–49 選滿幾個號碼；開獎後號碼全部被開出
 * 才中獎。合數是這一組自己的（切換合數會清空這組已選號碼），對應 A~E 其中一組注格。
 */
const props = defineProps<{ slot: M649Slot; disabled?: boolean }>()

const { pickOptions, actions } = useM649()

const PICK_LABEL: Record<number, string> = { 2: '二合', 3: '三合', 4: '四合' }

const numbers = computed(() => Array.from({ length: M649_NUMBER_MAX - M649_NUMBER_MIN + 1 }, (_, i) => M649_NUMBER_MIN + i))
const isFull = computed(() => props.slot.numbers.length >= props.slot.pickCount)

const click = {
  setPick: (pickCount: number) => {
    if (props.disabled) return
    actions.setPickCount(props.slot.id, pickCount)
  },
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
  <div class="m649-board" :class="{ 'is-disabled': disabled }">
    <div class="m649-board-head">
      <span class="m649-board-title">第 {{ slot.id }} 組</span>
      <div class="m649-board-modes" role="group" aria-label="選擇玩幾合">
        <button v-for="opt in pickOptions" :key="opt" type="button" class="m649-board-mode"
          :class="{ 'is-active': slot.pickCount === opt }" :disabled="disabled" @click="click.setPick(opt)">
          {{ PICK_LABEL[opt] }}
        </button>
      </div>
      <span class="m649-board-count" :class="{ 'is-full': isFull }">已選 {{ slot.numbers.length }} / {{ slot.pickCount }}</span>
      <div class="m649-board-actions">
        <button type="button" class="m649-board-btn m649-board-btn-primary" :disabled="disabled"
          @click="click.quickPick">電腦選號</button>
        <button type="button" class="m649-board-btn" :disabled="disabled" @click="click.clear">清空</button>
      </div>
    </div>

    <div class="m649-board-grid">
      <button v-for="num in numbers" :key="num" type="button" class="m649-board-cell"
        :disabled="disabled || (!slot.numbers.includes(num) && isFull)"
        :class="{ 'is-selected': slot.numbers.includes(num) }" @click="click.toggle(num)">
        {{ num }}
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.m649-board {
  border: 1px solid var(--color-neutral-300, #dcd3c4);
  border-radius: var(--base-radius, 0.375rem);
  background: var(--color-neutral-100, #f9f4ed);
  padding: 0.75rem;

  &.is-disabled {
    opacity: 0.6;
  }
}

.m649-board-head {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-bottom: 0.5rem;

  .m649-board-title {
    font-size: 14px;
    font-weight: 700;
    font-family: var(--font-heading);
    color: var(--color-accent-700, #8c491a);
  }

  .m649-board-count {
    font-size: 12px;
    color: var(--color-neutral-700, #645c50);

    &.is-full {
      color: #15803d;
      font-weight: 700;
    }
  }

  .m649-board-actions {
    margin-left: auto;
    display: flex;
    gap: 0.375rem;
  }

  .m649-board-btn {
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

    &.m649-board-btn-primary {
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

/* 「玩幾合」切換：二合/三合/四合，選中的高亮成主色實心 */
.m649-board-modes {
  display: inline-flex;
  gap: 0.25rem;
  padding: 2px;
  border-radius: 999px;
  background: var(--color-neutral-200, #eee7db);

  .m649-board-mode {
    border: 1px solid transparent;
    border-radius: 999px;
    background: transparent;
    color: var(--color-accent-700, #8c491a);
    font-size: 12px;
    font-weight: 700;
    padding: 3px 12px;
    cursor: pointer;
    transition: background-color 0.15s ease, color 0.15s ease;

    &:hover:not(:disabled):not(.is-active) {
      background: var(--color-accent-100, #fff2eb);
    }

    &.is-active {
      background: var(--color-accent-700, #8c491a);
      color: #fff;
    }

    &:disabled {
      opacity: 0.5;
      cursor: default;
    }
  }
}

.m649-board-grid {
  display: grid;
  grid-template-columns: repeat(10, 30px);
  justify-content: center;
  gap: 0.4rem;
  background: #fff8e7;
  border: 1px solid #d1242f;
  border-radius: 0.25rem;
  padding: 0.6rem;
}

.m649-board-cell {
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
