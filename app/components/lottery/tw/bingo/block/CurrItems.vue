<script setup lang="ts">
import { computed } from 'vue'
import { useBingo } from '~/composables/useBingo'
import { BINGO_BET_UNIT, BINGO_BET_TYPES } from '#shared/config/bingo'

/** 目前已加入的注單一覽（送單前的預覽清單），4 種投注類型混合排列，各自顯示標籤與內容摘要 */
const { slots, totalAmount, actions } = useBingo()

const BET_TYPE_LABEL: Record<string, string> = Object.fromEntries(BINGO_BET_TYPES.map((t) => [t.key, t.label]))

const rows = computed(() => slots.map((slot) => {
  const label = slot.betType === 'star'
    ? `${slot.star} 星｜${slot.numbers.map((n) => String(n).padStart(2, '0')).join(',')}`
    : slot.betType === 'super'
      ? String(slot.number).padStart(2, '0')
      : slot.pick
  return { id: slot.id, mode: BET_TYPE_LABEL[slot.betType] ?? slot.betType, label }
}))

const click = {
  remove: (id: string) => actions.removeSlot(id)
}
</script>

<template>
  <div class="bingo-curr-items">
    <h3 class="bingo-curr-title">投注單</h3>
    <ul class="bingo-curr-list">
      <li v-for="row in rows" :key="row.id" class="bingo-curr-row">
        <span class="bingo-curr-mode">{{ row.mode }}</span>
        <span class="bingo-curr-content">{{ row.label }}</span>
        <span class="bingo-curr-amount">{{ BINGO_BET_UNIT }}</span>
        <button type="button" class="bingo-curr-del" title="刪除這組" @click="click.remove(row.id)">×</button>
      </li>
      <li v-if="rows.length === 0" class="bingo-curr-empty">尚未加入任何注單</li>
    </ul>
    <div class="bingo-curr-total">
      <span>總金額</span>
      <strong>{{ totalAmount }}</strong>
    </div>
  </div>
</template>

<style scoped lang="scss">
.bingo-curr-items {
  border: 1px solid var(--color-neutral-300, #dcd3c4);
  border-radius: var(--base-radius, 0.375rem);
  background: var(--color-neutral-100, #f9f4ed);
  padding: 0.75rem;
}

.bingo-curr-title {
  margin: 0 0 0.5rem;
  font-size: 13px;
  font-weight: 700;
  font-family: var(--font-heading);
  color: var(--color-accent-700, #8c491a);
}

.bingo-curr-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  max-height: 220px;
  overflow-y: auto;
}

.bingo-curr-empty {
  font-size: 12px;
  color: var(--color-neutral-700, #645c50);
}

.bingo-curr-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 12px;
  color: var(--color-accent-700, #8c491a);
  font-weight: 600;

  .bingo-curr-mode {
    flex: none;
    padding: 1px 6px;
    border-radius: 999px;
    background: var(--color-accent-2-200, #e1eecc);
    border: 1px solid var(--color-accent-2-400, #aebf92);
    font-size: 11px;
    font-weight: 700;
    color: var(--color-accent-2-800, #3d472b);
  }

  .bingo-curr-content {
    flex: 1 1 auto;
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .bingo-curr-amount {
    margin-left: auto;
  }

  .bingo-curr-del {
    flex: none;
    width: 18px;
    height: 18px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: 4px;
    background: none;
    padding: 0;
    font-size: 14px;
    line-height: 1;
    color: var(--color-neutral-700, #645c50);
    cursor: pointer;

    &:hover {
      background: var(--color-neutral-300, #dcd3c4);
      color: var(--color-accent-700, #8c491a);
    }
  }
}

.bingo-curr-total {
  margin-top: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px dashed var(--color-neutral-400, #c0b6a5);
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  font-weight: 700;
  color: var(--color-accent-700, #8c491a);
}
</style>
