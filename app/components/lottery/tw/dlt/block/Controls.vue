<script setup lang="ts">
import { computed, reactive } from 'vue'
import { useDlt } from '~/composables/useDlt'

/** 送出／清空／新增一組（最多 5 組）／刪除某一組 */
const { slots, canAddSlot, canSubmit, state, actions, fetch } = useDlt()

const local = reactive({ removeId: '' })

const click = {
  addSlot: () => actions.addSlot(),
  removeSlot: () => {
    if (!local.removeId) return
    actions.removeSlot(local.removeId)
    local.removeId = ''
  },
  clearAll: () => actions.clearAll(),
  submit: async () => {
    const result = await fetch.submit()
    if (!result.ok && result.message) state.message = result.message
  }
}

const removableIds = computed(() => slots.map((s) => s.id))
</script>

<template>
  <div class="dlt-controls">
    <div class="dlt-controls-row">
      <button type="button" class="dlt-btn" :disabled="!canAddSlot" @click="click.addSlot">
        新增一組（最多 5 組）
      </button>
      <select v-model="local.removeId" class="dlt-select">
        <option value="">刪除哪一組？</option>
        <option v-for="id in removableIds" :key="id" :value="id">第 {{ id }} 組</option>
      </select>
      <button type="button" class="dlt-btn" :disabled="!local.removeId" @click="click.removeSlot">刪除</button>
      <button type="button" class="dlt-btn dlt-btn-plain" @click="click.clearAll">全部清空</button>
    </div>

    <div class="dlt-controls-row">
      <button type="button" class="dlt-btn dlt-btn-submit" :disabled="!canSubmit" @click="click.submit">
        {{ state.submitStatus === 'loading' ? '送出中…' : '送出投注' }}
      </button>
      <span v-if="state.message" class="dlt-message" :class="{ 'is-error': state.submitStatus === 'error' }">
        {{ state.message }}
      </span>
    </div>
  </div>
</template>

<style scoped lang="scss">
.dlt-controls {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.dlt-controls-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.dlt-btn {
  border: 1px solid var(--color-red-main, #7f1d1d);
  background: var(--color-red-main, #7f1d1d);
  color: #fff;
  border-radius: 0.25rem;
  font-size: 13px;
  font-weight: 700;
  padding: 6px 14px;
  cursor: pointer;

  &:disabled {
    opacity: 0.5;
    cursor: default;
  }

  &.dlt-btn-plain {
    background: #fff;
    color: var(--color-red-main, #7f1d1d);
  }

  &.dlt-btn-submit {
    font-size: 15px;
    padding: 8px 24px;
  }
}

.dlt-select {
  border: 1px solid #fee2e2;
  border-radius: 0.25rem;
  font-size: 13px;
  padding: 5px 8px;
}

.dlt-message {
  font-size: 12px;
  color: #15803d;

  &.is-error {
    color: #dc2626;
  }
}
</style>
