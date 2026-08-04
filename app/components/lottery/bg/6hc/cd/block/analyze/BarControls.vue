<script setup lang="ts">
import { SORT } from '~/config/constants'

type AnalyzeModeItem = {
  key: string
  label: string
}

const MODE_LIST: AnalyzeModeItem[] = [
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
  (event: 'update:modelValue', mode: string): void
  (event: 'change', mode: string): void
}>()

const click = {
  mode: (mode: string) => {
    emit('update:modelValue', mode)
    emit('change', mode)
  },
}
</script>

<template>
  <section class="bar-controls">
    <button v-for="mode in MODE_LIST" :key="mode.key" type="button" class="bar-controls-btn"
      :class="{ active: props.modelValue === mode.key }" @click="click.mode(mode.key)">
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

    &:hover:not(.active) {
      background: #fbe3e6;
    }

    &.active {
      background: var(--color-red-main);
      border-color: var(--color-red-main);
      color: #fff;
    }
  }
}
</style>
