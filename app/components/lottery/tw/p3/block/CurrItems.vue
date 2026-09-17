<script setup lang="ts">
import { computed } from 'vue'
import { useP3 } from '~/composables/useP3'
import { P3_BET_AMOUNT, P3_BET_TYPES } from '#shared/config/p3'

/** 目前已填寫的 A~E 各組下注方式／數字與狀態一覽（送單前的預覽清單） */
const { slots, totalAmount, actions } = useP3()

const BET_TYPE_LABEL: Record<string, string> = Object.fromEntries(P3_BET_TYPES.map((t) => [t.key, t.label]))

const rows = computed(() => slots.map((slot) => {
  const ready = slot.digits.every((d) => d !== null)
  return {
    id: slot.id,
    mode: BET_TYPE_LABEL[slot.betType] ?? slot.betType,
    label: ready
      ? slot.digits.join('')
      : `尚未選滿（${slot.digits.filter((d) => d !== null).length}/3）`,
    ready
  }
}))

const click = {
  /** 刪除某一組（見 useP3.ts removeSlot：至少保留 1 組，刪到剩最後一組時只清空不刪除） */
  remove: (slotId: string) => actions.removeSlot(slotId)
}
</script>

<template>
  <div class="p3-curr-items">
    <h3 class="p3-curr-title">投注單</h3>
    <ul class="p3-curr-list">
      <li v-for="row in rows" :key="row.id" class="p3-curr-row" :class="{ 'is-ready': row.ready }">
        <span class="p3-curr-tag">{{ row.id }}</span>
        <span class="p3-curr-mode">{{ row.mode }}</span>
        <span class="p3-curr-numbers">{{ row.label }}</span>
        <span v-if="row.ready" class="p3-curr-amount">{{ P3_BET_AMOUNT }}</span>
        <button type="button" class="p3-curr-del" title="刪除這組" @click="click.remove(row.id)">×</button>
      </li>
    </ul>
    <div class="p3-curr-total">
      <span>總金額</span>
      <strong>{{ totalAmount }}</strong>
    </div>
  </div>
</template>

<style scoped lang="scss">
.p3-curr-items {
  border: 1px solid var(--color-neutral-300, #dcd3c4);
  border-radius: var(--base-radius, 0.375rem);
  background: var(--color-neutral-100, #f9f4ed);
  padding: 0.75rem;
}

.p3-curr-title {
  margin: 0 0 0.5rem;
  font-size: 13px;
  font-weight: 700;
  font-family: var(--font-heading);
  color: var(--color-accent-700, #8c491a);
}

.p3-curr-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.p3-curr-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 12px;
  color: var(--color-neutral-700, #645c50);

  &.is-ready {
    color: var(--color-accent-700, #8c491a);
    font-weight: 600;
  }

  .p3-curr-tag {
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

  .p3-curr-mode {
    flex: none;
    padding: 1px 6px;
    border-radius: 999px;
    background: var(--color-accent-2-200, #e1eecc);
    border: 1px solid var(--color-accent-2-400, #aebf92);
    font-size: 11px;
    font-weight: 700;
    color: var(--color-accent-2-800, #3d472b);
  }

  .p3-curr-numbers {
    flex: 1 1 auto;
    min-width: 0;
  }

  .p3-curr-amount {
    margin-left: auto;
  }

  .p3-curr-del {
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

.p3-curr-total {
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
