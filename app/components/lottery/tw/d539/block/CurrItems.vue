<script setup lang="ts">
import { computed } from 'vue'
import { useD539 } from '~/composables/useD539'
import { D539_PICK_COUNT } from '#shared/config/d539'

/** 目前已填寫的 A~E 各組號碼與狀態一覽（送單前的預覽清單） */
const { slots, totalAmount, actions } = useD539()

const rows = computed(() => slots.map((slot) => ({
  id: slot.id,
  label: slot.numbers.length === D539_PICK_COUNT
    ? slot.numbers.map((n) => String(n).padStart(2, '0')).join(', ')
    : `尚未選滿（${slot.numbers.length}/${D539_PICK_COUNT}）`,
  ready: slot.numbers.length === D539_PICK_COUNT
})))

const click = {
  /** 刪除某一組（見 useD539.ts removeSlot：至少保留 1 組，刪到剩最後一組時只清空不刪除） */
  remove: (slotId: string) => actions.removeSlot(slotId)
}
</script>

<template>
  <div class="d539-curr-items">
    <h3 class="d539-curr-title">投注單</h3>
    <ul class="d539-curr-list">
      <li v-for="row in rows" :key="row.id" class="d539-curr-row" :class="{ 'is-ready': row.ready }">
        <span class="d539-curr-tag">{{ row.id }}</span>
        <span class="d539-curr-numbers">{{ row.label }}</span>
        <span v-if="row.ready" class="d539-curr-amount">50</span>
        <button type="button" class="d539-curr-del" title="刪除這組" @click="click.remove(row.id)">×</button>
      </li>
    </ul>
    <div class="d539-curr-total">
      <span>總金額</span>
      <strong>{{ totalAmount }}</strong>
    </div>
  </div>
</template>

<style scoped lang="scss">
.d539-curr-items {
  border: 1px solid var(--color-neutral-300, #dcd3c4);
  border-radius: var(--base-radius, 0.375rem);
  background: var(--color-neutral-100, #f9f4ed);
  padding: 0.75rem;
}

.d539-curr-title {
  margin: 0 0 0.5rem;
  font-size: 13px;
  font-weight: 700;
  font-family: var(--font-heading);
  color: var(--color-accent-700, #8c491a);
}

.d539-curr-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.d539-curr-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 12px;
  color: var(--color-neutral-700, #645c50);

  &.is-ready {
    color: var(--color-accent-700, #8c491a);
    font-weight: 600;
  }

  .d539-curr-tag {
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

  .d539-curr-amount {
    margin-left: auto;
  }

  .d539-curr-del {
    flex: none;
    margin-left: auto;
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

.d539-curr-total {
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
