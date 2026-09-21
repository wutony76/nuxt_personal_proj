<script setup lang="ts">
import { watch } from 'vue'
import { useToyHistory } from '~/composables/useToyHistory'

const props = defineProps<{
  visible: boolean
}>()
const emit = defineEmits<{ close: [] }>()

const { records, totals, loading, ensureLoaded } = useToyHistory()

watch(() => props.visible, (visible) => {
  if (visible) void ensureLoaded()
}, { immediate: true })

const pad2 = (value: number) => String(value).padStart(2, '0')
const formatTime = (createdAt: number) => {
  const date = new Date(createdAt)
  if (Number.isNaN(date.getTime())) return '-'
  return `${date.getMonth() + 1}/${pad2(date.getDate())} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`
}

const click = {
  close: () => emit('close')
}
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="toy-history-mask theme-taiwan-lottery" @click.self="click.close()">
      <section class="toy-history" role="dialog" aria-label="購買紀錄">
        <header class="toy-history-head">
          <h2>購買紀錄</h2>
          <button type="button" class="toy-history-close" aria-label="關閉" @click="click.close()">×</button>
        </header>

        <div class="toy-history-summary">
          <div class="toy-history-stat">
            <div class="k">共下注</div>
            <div class="v">{{ totals.bet.toLocaleString('zh-TW') }}</div>
          </div>
          <div class="toy-history-stat">
            <div class="k">共獲得</div>
            <div class="v is-accent">{{ totals.reward.toLocaleString('zh-TW') }}</div>
          </div>
          <div class="toy-history-stat">
            <div class="k">紀錄筆數</div>
            <div class="v">{{ totals.count }}</div>
          </div>
        </div>

        <div class="toy-history-body taiwan-lottery-scrollbar">
          <p v-if="loading" class="toy-history-empty">載入中...</p>
          <p v-else-if="records.length === 0" class="toy-history-empty">尚無購買紀錄</p>
          <div v-else class="toy-history-list">
            <div v-for="r in records" :key="r.id" class="toy-history-row" :class="{ 'is-reward': r.type === 'toy-reward' }">
              <span class="note">{{ r.note }}</span>
              <span class="amount">{{ r.amount > 0 ? '+' : '' }}{{ r.amount.toLocaleString('zh-TW') }}</span>
              <span class="time">{{ formatTime(r.createdAt) }}</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  </Teleport>
</template>

<style scoped lang="scss">
.toy-history-mask {
  position: fixed;
  inset: 0;
  z-index: 1001;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: rgba(15, 23, 42, 0.45);
}

.toy-history {
  width: min(480px, 96vw);
  max-height: 86vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 4px solid var(--color-accent-700, #8c491a);
  border-radius: 12px;
  background: var(--color-neutral-100, #f9f4ed);
}

.toy-history-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  background: #2e2b25;
  border-bottom: 2px solid var(--color-accent-2-400, #aebf92);

  h2 {
    margin: 0;
    font-family: var(--font-heading, serif);
    font-size: 20px;
    color: var(--color-bg, #f5ead8);
  }
}

.toy-history-close {
  border: 0;
  background: transparent;
  color: var(--color-accent-300, #ffc6a5);
  font-size: 28px;
  line-height: 1;
  cursor: pointer;

  &:hover {
    color: var(--color-bg, #f5ead8);
  }
}

.toy-history-summary {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  padding: 14px 16px 0;

  .toy-history-stat {
    background: var(--color-neutral-200, #ede4d3);
    border: 1px dashed var(--color-neutral-400, #c0b6a5);
    border-radius: var(--radius-sm, 8px);
    padding: 8px 10px;
    text-align: center;

    .k {
      font-size: 10px;
      letter-spacing: 0.1em;
      color: var(--color-neutral-600, #82796a);
    }

    .v {
      margin-top: 4px;
      font-family: var(--font-heading, serif);
      font-weight: 900;
      font-size: 17px;
      color: var(--color-neutral-900, #2e2b25);

      &.is-accent {
        color: var(--color-accent-700, #8c491a);
      }
    }
  }
}

.toy-history-body {
  overflow: auto;
  padding: 14px 16px 16px;
}

.toy-history-empty {
  margin: 0;
  padding: 30px 10px;
  text-align: center;
  color: var(--color-neutral-600, #82796a);
  font-size: 13px;
}

.toy-history-list {
  border: 1px solid var(--color-neutral-300, #dcd3c4);
  border-radius: var(--radius-sm, 8px);
  overflow: hidden;
}

.toy-history-row {
  display: grid;
  grid-template-columns: 1fr auto auto;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  font-size: 13px;
  background: var(--color-bg, #f5ead8);
  border-bottom: 1px solid var(--color-neutral-300, #dcd3c4);

  &:last-child {
    border-bottom: none;
  }

  .note {
    color: var(--color-neutral-800, #474238);
  }

  .amount {
    font-family: var(--font-heading, serif);
    font-weight: 900;
    color: var(--color-red-main, #c12419);
    text-align: right;
  }

  .time {
    color: var(--color-neutral-600, #82796a);
    font-size: 11px;
    text-align: right;
    white-space: nowrap;
  }

  &.is-reward .amount {
    color: var(--color-accent-2-700, #56633f);
  }
}
</style>
