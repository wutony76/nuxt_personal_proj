<script setup lang="ts">
import { computed } from 'vue'
import { useM539 } from '~/composables/useM539'
import { M539_BET_AMOUNT } from '#shared/config/m539'

/** 目前已填寫的 A~E 各組合數／號碼與狀態一覽（送單前的預覽清單） */
const { slots, totalAmount, actions } = useM539()

const PICK_LABEL: Record<number, string> = { 2: '二合', 3: '三合', 4: '四合' }

const rows = computed(() => slots.map((slot) => ({
  id: slot.id,
  mode: PICK_LABEL[slot.pickCount] ?? `${slot.pickCount}合`,
  label: slot.numbers.length === slot.pickCount
    ? slot.numbers.map((n) => String(n).padStart(2, '0')).join(', ')
    : `尚未選滿（${slot.numbers.length}/${slot.pickCount}）`,
  ready: slot.numbers.length === slot.pickCount
})))

const click = {
  /** 刪除某一組（見 useM539.ts removeSlot：至少保留 1 組，刪到剩最後一組時只清空不刪除） */
  remove: (slotId: string) => actions.removeSlot(slotId)
}
</script>

<template>
  <div class="m539-curr-items">
    <h3 class="m539-curr-title">投注單</h3>
    <ul class="m539-curr-list">
      <li v-for="row in rows" :key="row.id" class="m539-curr-row" :class="{ 'is-ready': row.ready }">
        <span class="m539-curr-tag">{{ row.id }}</span>
        <span class="m539-curr-mode">{{ row.mode }}</span>
        <span class="m539-curr-numbers">{{ row.label }}</span>
        <span v-if="row.ready" class="m539-curr-amount">{{ M539_BET_AMOUNT }}</span>
        <button type="button" class="m539-curr-del" title="刪除這組" @click="click.remove(row.id)">×</button>
      </li>
    </ul>
    <div class="m539-curr-total">
      <span>總金額</span>
      <strong>{{ totalAmount }}</strong>
    </div>
  </div>
</template>

<style scoped lang="scss">
.m539-curr-items {
  border: 1px solid var(--color-neutral-300, #dcd3c4);
  border-radius: var(--base-radius, 0.375rem);
  background: var(--color-neutral-100, #f9f4ed);
  padding: 0.75rem;
}

.m539-curr-title {
  margin: 0 0 0.5rem;
  font-size: 13px;
  font-weight: 700;
  font-family: var(--font-heading);
  color: var(--color-accent-700, #8c491a);
}

.m539-curr-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.m539-curr-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 12px;
  color: var(--color-neutral-700, #645c50);

  &.is-ready {
    color: var(--color-accent-700, #8c491a);
    font-weight: 600;
  }

  .m539-curr-tag {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    border-radius: 4px;
    background: var(--color-neutral-300, #dcd3c4);
    font-weight: 700;
    font-size: 11px;
  }

  .m539-curr-mode {
    flex: none;
    padding: 1px 6px;
    border-radius: 999px;
    background: var(--color-accent-2-200, #e1eecc);
    border: 1px solid var(--color-accent-2-400, #aebf92);
    font-size: 11px;
    font-weight: 700;
    color: var(--color-accent-2-800, #3d472b);
  }

  .m539-curr-numbers {
    flex: 1 1 auto;
    min-width: 0;
  }

  .m539-curr-amount {
    margin-left: auto;
  }

  .m539-curr-del {
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

.m539-curr-total {
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
