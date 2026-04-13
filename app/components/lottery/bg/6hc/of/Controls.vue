<script setup lang="ts">
import ControlCoin from '~/components/lottery/bg/6hc/of/ControlCoin.vue'
import { GAME_6HC_OF } from '~/config/constants'

const props = withDefaults(defineProps<{
  hint?: string
}>(), {
  hint: '單式玩法需選 7 碼'
})

const emit = defineEmits<{
  add: []
}>()

const { state: mxState, handle: mxHandle } = use6hcOfficial()

const onRandom = () => {
  const count = mxState.status === GAME_6HC_OF.SINGLE.key ? 7 : 8
  mxHandle.randomSelect(count)
}

const onClear = () => {
  mxHandle.clearSelect()
}

const onAdd = () => {
  emit('add')
}
</script>

<template>
  <div class="controls">
    <div class="controls-actions">
      <div class="left">
        <button type="button" class="action-btn" @click="onRandom">隨機選號</button>
        <button type="button" class="action-btn" @click="onAdd">加入</button>
      </div>
      <div class="right">
        <button type="button" class="action-btn ghost" @click="onClear">清空</button>
      </div>
    </div>

    <div class="hint">{{ props.hint }}</div>
    <div class="group">
      <slot />
    </div>
    <ControlCoin />
  </div>
</template>

<style scoped lang="scss">
.controls {
  background: #fff7f8;
  display: flex;
  flex-direction: column;
  flex: 1;
  border: 1px solid #fee2e2;
  border-radius: 6px;
  padding: 12px;
  gap: 12px;

  .controls-actions {
    display: flex;
    justify-content: space-between;

    .left {
      display: flex;
      gap: 8px;
    }

    .action-btn {
      border: 1px solid var(--color-red-main);
      border-radius: 4px;
      background: var(--color-red-main);
      color: #fff;
      padding: 6px 12px;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;

      &.ghost {
        background: #fff;
        color: var(--color-red-main);
      }
    }
  }

  .hint {
    font-size: 12px;
    line-height: 1.4;
    color: var(--color-red-desc);
  }

  .group {
    background: #fff;
    flex: 1;
    overflow-y: auto;
    border: 1px solid #fee2e2;
    border-radius: var(--base-radius);
    min-height: 120px;
  }
}
</style>