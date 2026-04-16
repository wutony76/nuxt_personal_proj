<script setup lang="ts">
import { SORT } from '~/config/constants'
type AnalyzeModeKey = string

type AnalyzeModeItem = {
  key: AnalyzeModeKey
  label: string
}

const modeList: AnalyzeModeItem[] = [
  { key: SORT.DEFAULT, label: '預設' },
  { key: SORT.BET_COUNT_USER, label: '下注次數(自)' },
  { key: SORT.OPEN_COUNT_SYSTEM, label: '攪出次數(系)' },
  { key: SORT.GAP_ISSUE_SYSTEM, label: '相隔期數(系)' },
]

const props = defineProps({
  modelValue: {
    type: String,
    default: SORT.DEFAULT,
  },
})

const emit = defineEmits<{
  (event: 'update:modelValue', mode: AnalyzeModeKey): void
  (event: 'change', mode: AnalyzeModeKey): void
}>()

const clickMode = (mode: AnalyzeModeKey) => {
  emit('update:modelValue', mode)
  emit('change', mode)
}
</script>

<template>
  <section class="bar-controls">
    <button v-for="mode in modeList" :key="mode.key" type="button" class="bar-controls-btn"
      :class="{ active: props.modelValue === mode.key }" @click="clickMode(mode.key)">
      {{ mode.label }}
    </button>
  </section>
</template>

<style scoped lang="scss">
.bar-controls {
  display: inline-flex;
  gap: 5px;
  flex-wrap: wrap;
  vertical-align: middle;

  &-btn {
    border: 1px solid #f3b7bf;
    border-radius: 0.25rem;
    background: #fff5f6;
    padding: 1px 5px;
    font-size: 13px;
    font-weight: 700;
    color: var(--color-red-main);
    cursor: pointer;
    transition: all 0.15s ease;

    &.active {
      background: var(--color-red-main);
      color: #fff;
      border-color: var(--color-red-main);
    }
  }
}
</style>
