<script setup lang="ts">
import { CREDIT_ANALYZE_DIMENSIONS, type CreditAnalyzeDimension } from '#shared/config/cd/analyze'

const props = defineProps({
  modelValue: {
    type: String,
    default: 'number',
  },
})

const emit = defineEmits<{
  (event: 'update:modelValue', dimension: CreditAnalyzeDimension): void
  (event: 'change', dimension: CreditAnalyzeDimension): void
}>()

const click = {
  dimension: (dimension: CreditAnalyzeDimension) => {
    if (props.modelValue === dimension) return
    emit('update:modelValue', dimension)
    emit('change', dimension)
  },
}
</script>

<template>
  <section class="bar-dimensions">
    <button v-for="item in CREDIT_ANALYZE_DIMENSIONS" :key="item.key" type="button" class="bar-dimensions-btn"
      :class="{ active: props.modelValue === item.key }" @click="click.dimension(item.key)">
      {{ item.label }}
    </button>
  </section>
</template>

<style scoped lang="scss">
.bar-dimensions {
  width: 100%;
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  border-bottom: 2px solid #f3b7bf;

  &-btn {
    border: 1px solid #f3b7bf;
    border-bottom: none;
    border-radius: 0.25rem 0.25rem 0 0;
    background: #fff5f6;
    padding: 3px 11px;
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
