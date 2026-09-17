<script setup lang="ts">
import { computed } from 'vue'
import { useSuperlotto } from '~/composables/useSuperlotto'
import { SUPERLOTTO_BET_AMOUNT, SUPERLOTTO_ZONE_A_PICK } from '#shared/config/superlotto'

/** 目前已填寫的 A~E 各組（兩區）號碼與狀態一覽（送單前的預覽清單） */
const { slots, totalAmount, actions } = useSuperlotto()

const rows = computed(() => slots.map((slot) => {
  const ready = slot.zoneA.length === SUPERLOTTO_ZONE_A_PICK && slot.zoneB !== null
  const zoneAText = slot.zoneA.map((n) => String(n).padStart(2, '0')).join(', ')
  const zoneBText = slot.zoneB === null ? '—' : String(slot.zoneB).padStart(2, '0')
  return {
    id: slot.id,
    ready,
    zoneAText: slot.zoneA.length > 0 ? zoneAText : `第一區 ${slot.zoneA.length}/${SUPERLOTTO_ZONE_A_PICK}`,
    zoneBText,
    label: ready ? `${zoneAText}｜${zoneBText}` : `尚未選滿（第一區 ${slot.zoneA.length}/${SUPERLOTTO_ZONE_A_PICK}、第二區 ${slot.zoneB === null ? 0 : 1}/1）`
  }
}))

const click = {
  /** 刪除某一組（見 useSuperlotto.ts removeSlot：至少保留 1 組，刪到剩最後一組時只清空不刪除） */
  remove: (slotId: string) => actions.removeSlot(slotId)
}
</script>

<template>
  <div class="superlotto-curr-items">
    <h3 class="superlotto-curr-title">投注單</h3>
    <ul class="superlotto-curr-list">
      <li v-for="row in rows" :key="row.id" class="superlotto-curr-row" :class="{ 'is-ready': row.ready }">
        <span class="superlotto-curr-tag">{{ row.id }}</span>
        <span class="superlotto-curr-numbers">{{ row.label }}</span>
        <span v-if="row.ready" class="superlotto-curr-amount">{{ SUPERLOTTO_BET_AMOUNT }}</span>
        <button type="button" class="superlotto-curr-del" title="刪除這組" @click="click.remove(row.id)">×</button>
      </li>
    </ul>
    <div class="superlotto-curr-total">
      <span>總金額</span>
      <strong>{{ totalAmount }}</strong>
    </div>
  </div>
</template>

<style scoped lang="scss">
.superlotto-curr-items {
  border: 1px solid var(--color-neutral-300, #dcd3c4);
  border-radius: var(--base-radius, 0.375rem);
  background: var(--color-neutral-100, #f9f4ed);
  padding: 0.75rem;
}

.superlotto-curr-title {
  margin: 0 0 0.5rem;
  font-size: 13px;
  font-weight: 700;
  font-family: var(--font-heading);
  color: var(--color-accent-700, #8c491a);
}

.superlotto-curr-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.superlotto-curr-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 12px;
  color: var(--color-neutral-700, #645c50);

  &.is-ready {
    color: var(--color-accent-700, #8c491a);
    font-weight: 600;
  }

  .superlotto-curr-tag {
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

  .superlotto-curr-numbers {
    flex: 1 1 auto;
    min-width: 0;
  }

  .superlotto-curr-amount {
    margin-left: auto;
  }

  .superlotto-curr-del {
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

.superlotto-curr-total {
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
