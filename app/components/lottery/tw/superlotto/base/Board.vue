<script setup lang="ts">
import { computed } from 'vue'
import {
  SUPERLOTTO_ZONE_A_MIN,
  SUPERLOTTO_ZONE_A_MAX,
  SUPERLOTTO_ZONE_A_PICK,
  SUPERLOTTO_ZONE_B_MIN,
  SUPERLOTTO_ZONE_B_MAX,
  SUPERLOTTO_ZONE_B_PICK
} from '#shared/config/superlotto'
import { useSuperlotto } from '~/composables/useSuperlotto'
import type { SuperlottoSlot } from '~/composables/useSuperlotto'

/**
 * 威力彩投注區——本站唯一「兩區選號」的盤面（見 openspec/changes/add-tw-lottery-suite/design.md
 * Decision 4）：第一區 01–38 選 6、第二區 01–08 選 1，兩個獨立子網格並排、各自可獨立點選。
 * 對應 A~E 其中一組注格；沿用 dlt base/Board.vue 的號碼格 UI，class 前綴改 `superlotto-`。
 */
const props = defineProps<{ slot: SuperlottoSlot; disabled?: boolean }>()

const { actions } = useSuperlotto()

const zoneANumbers = computed(() =>
  Array.from({ length: SUPERLOTTO_ZONE_A_MAX - SUPERLOTTO_ZONE_A_MIN + 1 }, (_, i) => SUPERLOTTO_ZONE_A_MIN + i)
)
const zoneBNumbers = computed(() =>
  Array.from({ length: SUPERLOTTO_ZONE_B_MAX - SUPERLOTTO_ZONE_B_MIN + 1 }, (_, i) => SUPERLOTTO_ZONE_B_MIN + i)
)
const isZoneAFull = computed(() => props.slot.zoneA.length >= SUPERLOTTO_ZONE_A_PICK)
const isZoneBFull = computed(() => props.slot.zoneB !== null)
const isReady = computed(() => isZoneAFull.value && isZoneBFull.value)

const click = {
  toggleA: (num: number) => {
    if (props.disabled) return
    actions.toggleNumber(props.slot.id, 'a', num)
  },
  toggleB: (num: number) => {
    if (props.disabled) return
    actions.toggleNumber(props.slot.id, 'b', num)
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
  <div class="superlotto-board" :class="{ 'is-disabled': disabled }">
    <div class="superlotto-board-head">
      <span class="superlotto-board-title">第 {{ slot.id }} 組</span>
      <span class="superlotto-board-count" :class="{ 'is-full': isReady }">
        第一區 {{ slot.zoneA.length }}/{{ SUPERLOTTO_ZONE_A_PICK }}
         · 第二區 {{ slot.zoneB === null ? 0 : 1 }}/{{ SUPERLOTTO_ZONE_B_PICK }}
      </span>
      <div class="superlotto-board-actions">
        <button type="button" class="superlotto-board-btn superlotto-board-btn-primary" :disabled="disabled"
          @click="click.quickPick">電腦選號</button>
        <button type="button" class="superlotto-board-btn" :disabled="disabled" @click="click.clear">清空</button>
      </div>
    </div>

    <div class="superlotto-board-zones">
      <div class="superlotto-zone">
        <div class="superlotto-zone-label">
          第一區 <span>01–38 選 {{ SUPERLOTTO_ZONE_A_PICK }}</span>
        </div>
        <div class="superlotto-board-grid is-zone-a">
          <button v-for="num in zoneANumbers" :key="`a-${num}`" type="button" class="superlotto-board-cell"
            :disabled="disabled || (!slot.zoneA.includes(num) && isZoneAFull)"
            :class="{ 'is-selected': slot.zoneA.includes(num) }" @click="click.toggleA(num)">
            {{ num }}
          </button>
        </div>
      </div>

      <div class="superlotto-zone">
        <div class="superlotto-zone-label is-zone-b">
          第二區 <span>01–08 選 {{ SUPERLOTTO_ZONE_B_PICK }}</span>
        </div>
        <div class="superlotto-board-grid is-zone-b">
          <button v-for="num in zoneBNumbers" :key="`b-${num}`" type="button" class="superlotto-board-cell is-zone-b"
            :disabled="disabled"
            :class="{ 'is-selected': slot.zoneB === num }" @click="click.toggleB(num)">
            {{ num }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.superlotto-board {
  border: 1px solid var(--color-neutral-300, #dcd3c4);
  border-radius: var(--base-radius, 0.375rem);
  background: var(--color-neutral-100, #f9f4ed);
  padding: 0.75rem;

  &.is-disabled {
    opacity: 0.6;
  }
}

.superlotto-board-head {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;

  .superlotto-board-title {
    font-size: 14px;
    font-weight: 700;
    font-family: var(--font-heading);
    color: var(--color-accent-700, #8c491a);
  }

  .superlotto-board-count {
    font-size: 12px;
    color: var(--color-neutral-700, #645c50);

    &.is-full {
      color: #15803d;
      font-weight: 700;
    }
  }

  .superlotto-board-actions {
    margin-left: auto;
    display: flex;
    gap: 0.375rem;
  }

  .superlotto-board-btn {
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

    &.superlotto-board-btn-primary {
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

.superlotto-board-zones {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  align-items: flex-start;
}

.superlotto-zone {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;

  &:first-child {
    flex: 1 1 320px;
    min-width: 0;
  }

  &:last-child {
    flex: 0 0 auto;
  }
}

.superlotto-zone-label {
  display: flex;
  align-items: baseline;
  gap: 0.35rem;
  font-size: 13px;
  font-weight: 700;
  font-family: var(--font-heading);
  color: #6c2424;

  span {
    font-size: 11px;
    font-weight: 400;
    color: var(--color-neutral-700, #645c50);
  }

  &.is-zone-b {
    color: var(--color-accent-700, #8c491a);
  }
}

.superlotto-board-grid {
  display: grid;
  gap: 0.4rem;
  background: #fff8e7;
  border: 1px solid #d1242f;
  border-radius: 0.25rem;
  padding: 0.6rem;

  &.is-zone-a {
    grid-template-columns: repeat(10, 30px);
    justify-content: center;
  }

  &.is-zone-b {
    grid-template-columns: repeat(4, 30px);
    justify-content: center;
    border-color: var(--color-accent-700, #8c491a);
    background: #fff2eb;
  }
}

.superlotto-board-cell {
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

  &.is-zone-b {
    border-color: var(--color-accent-700, #8c491a);
    color: var(--color-accent-700, #8c491a);

    &.is-selected {
      background: var(--color-accent-700, #8c491a);
      border-color: var(--color-accent-700, #8c491a);
      color: #fff;
    }
  }

  &:disabled {
    cursor: default;
    opacity: 0.45;
  }
}
</style>
