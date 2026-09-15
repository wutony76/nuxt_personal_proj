<script setup lang="ts">
import { computed } from 'vue'
import { useDlt } from '~/composables/useDlt'
import { DLT_PICK_COUNT } from '#shared/config/dlt'

/** 目前已填寫的 A~E 各組號碼與狀態一覽（送單前的預覽清單） */
const { slots, totalAmount, actions } = useDlt()

const rows = computed(() => slots.map((slot) => ({
  id: slot.id,
  label: slot.numbers.length === DLT_PICK_COUNT
    ? slot.numbers.map((n) => String(n).padStart(2, '0')).join(', ')
    : `尚未選滿（${slot.numbers.length}/${DLT_PICK_COUNT}）`,
  ready: slot.numbers.length === DLT_PICK_COUNT
})))

const click = {
  /** 刪除某一組（見 useDlt.ts removeSlot：至少保留 1 組，刪到剩最後一組時只清空不刪除） */
  remove: (slotId: string) => actions.removeSlot(slotId)
}
</script>

<template>
  <div class="dlt-curr-items">
    <h3 class="dlt-curr-title">投注單</h3>
    <ul class="dlt-curr-list">
      <li v-for="row in rows" :key="row.id" class="dlt-curr-row" :class="{ 'is-ready': row.ready }">
        <span class="dlt-curr-tag">{{ row.id }}</span>
        <span class="dlt-curr-numbers">{{ row.label }}</span>
        <span v-if="row.ready" class="dlt-curr-amount">50</span>
        <button type="button" class="dlt-curr-del" title="刪除這組" @click="click.remove(row.id)">×</button>
      </li>
    </ul>
    <div class="dlt-curr-total">
      <span>總金額</span>
      <strong>{{ totalAmount }}</strong>
    </div>
  </div>
</template>

<style scoped lang="scss">
.dlt-curr-items {
  border: 1px solid #fee2e2;
  border-radius: var(--base-radius, 0.375rem);
  background: #fff;
  padding: 0.75rem;
}

.dlt-curr-title {
  margin: 0 0 0.5rem;
  font-size: 13px;
  font-weight: 700;
  color: var(--color-red-main, #7f1d1d);
}

.dlt-curr-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.dlt-curr-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 12px;
  color: #9ca3af;

  &.is-ready {
    color: var(--color-red-main, #7f1d1d);
    font-weight: 600;
  }

  .dlt-curr-tag {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    border-radius: 4px;
    background: #fee2e2;
    font-weight: 700;
    font-size: 11px;
  }

  .dlt-curr-amount {
    margin-left: auto;
  }

  .dlt-curr-del {
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
    color: var(--color-red-desc, #9ca3af);
    cursor: pointer;

    &:hover {
      background: #fee2e2;
      color: var(--color-red-main, #7f1d1d);
    }
  }
}

.dlt-curr-total {
  margin-top: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px dashed #fee2e2;
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  font-weight: 700;
  color: var(--color-red-main, #7f1d1d);
}
</style>
