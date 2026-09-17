<script setup lang="ts">
import { computed } from 'vue'
import { P4_DIGIT_MIN, P4_DIGIT_MAX, P4_DIGIT_COUNT } from '#shared/config/p4'
import { useP4 } from '~/composables/useP4'
import type { P4Slot } from '~/composables/useP4'

/**
 * 4星彩投注區——與 P3 的不同：只有「正彩」「組彩」兩種下注方式（沒有對彩），且逐位輸入是
 * 千/百/十/個 4 位，不是 3 位。每一組要先選「下注方式」，選定後逐位填入 0~9 數字（可重複）。
 * 切換下注方式會清空這組已選數字，對應 A~E 其中一組注格。
 */
const props = defineProps<{ slot: P4Slot; disabled?: boolean }>()

const { betTypeOptions, actions } = useP4()

const PLACE_NAMES = ['千位', '百位', '十位', '個位']
const digitPool = computed(() => Array.from({ length: P4_DIGIT_MAX - P4_DIGIT_MIN + 1 }, (_, i) => P4_DIGIT_MIN + i))
const isFull = computed(() => props.slot.digits.every((d) => d !== null))

const click = {
  setBetType: (betType: P4Slot['betType']) => {
    if (props.disabled) return
    actions.setBetType(props.slot.id, betType)
  },
  setDigit: (position: number, digit: number) => {
    if (props.disabled) return
    actions.setDigit(props.slot.id, position, digit)
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
  <div class="p4-board" :class="{ 'is-disabled': disabled }">
    <div class="p4-board-head">
      <span class="p4-board-title">第 {{ slot.id }} 組</span>
      <div class="p4-board-modes" role="group" aria-label="選擇下注方式">
        <button v-for="opt in betTypeOptions" :key="opt.key" type="button" class="p4-board-mode"
          :class="{ 'is-active': slot.betType === opt.key }" :disabled="disabled" :title="opt.desc"
          @click="click.setBetType(opt.key)">
          {{ opt.label }}
        </button>
      </div>
      <span class="p4-board-count" :class="{ 'is-full': isFull }">已選 {{ slot.digits.filter((d) => d !== null).length }} / {{ P4_DIGIT_COUNT }}</span>
      <div class="p4-board-actions">
        <button type="button" class="p4-board-btn p4-board-btn-primary" :disabled="disabled"
          @click="click.quickPick">電腦選號</button>
        <button type="button" class="p4-board-btn" :disabled="disabled" @click="click.clear">清空</button>
      </div>
    </div>

    <div class="p4-board-places">
      <div v-for="(name, position) in PLACE_NAMES" :key="name" class="p4-board-place">
        <div class="p4-place-head">
          <span class="p4-place-name">{{ name }}</span>
          <span class="p4-place-value">{{ slot.digits[position] === null ? '—' : slot.digits[position] }}</span>
        </div>
        <div class="p4-board-grid">
          <button v-for="digit in digitPool" :key="digit" type="button" class="p4-board-cell"
            :disabled="disabled" :class="{ 'is-selected': slot.digits[position] === digit }"
            @click="click.setDigit(position, digit)">
            {{ digit }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.p4-board {
  border: 1px solid var(--color-neutral-300, #dcd3c4);
  border-radius: var(--base-radius, 0.375rem);
  background: var(--color-neutral-100, #f9f4ed);
  padding: 0.75rem;

  &.is-disabled {
    opacity: 0.6;
  }
}

.p4-board-head {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-bottom: 0.5rem;

  .p4-board-title {
    font-size: 14px;
    font-weight: 700;
    font-family: var(--font-heading);
    color: var(--color-accent-700, #8c491a);
  }

  .p4-board-count {
    font-size: 12px;
    color: var(--color-neutral-700, #645c50);

    &.is-full {
      color: #15803d;
      font-weight: 700;
    }
  }

  .p4-board-actions {
    margin-left: auto;
    display: flex;
    gap: 0.375rem;
  }

  .p4-board-btn {
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

    &.p4-board-btn-primary {
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

/* 「下注方式」切換：正彩/組彩，選中的高亮成主色實心 */
.p4-board-modes {
  display: inline-flex;
  gap: 0.25rem;
  padding: 2px;
  border-radius: 999px;
  background: var(--color-neutral-200, #eee7db);
  flex-wrap: wrap;

  .p4-board-mode {
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

.p4-board-places {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.p4-board-place {
  flex: 1 1 160px;
  min-width: 160px;
  background: #fff8e7;
  border: 1px solid #d1242f;
  border-radius: 0.25rem;
  padding: 0.5rem;

  .p4-place-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.4rem;

    .p4-place-name {
      font-size: 12px;
      font-weight: 700;
      color: var(--color-accent-700, #8c491a);
    }

    .p4-place-value {
      font-size: 15px;
      font-weight: 900;
      font-variant-numeric: tabular-nums;
      color: #d1242f;
    }
  }
}

.p4-board-grid {
  display: grid;
  grid-template-columns: repeat(5, 28px);
  justify-content: center;
  gap: 0.3rem;
}

.p4-board-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: 1.5px solid #d1242f;
  border-radius: 2px;
  background: #fffdf8;
  color: #d1242f;
  font-family: var(--font-heading, inherit);
  font-weight: 700;
  font-size: 13px;
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
