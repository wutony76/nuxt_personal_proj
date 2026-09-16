<script setup lang="ts">
defineProps<{
  label: string
  tone?: 'primary' | 'secondary'
  disabled?: boolean
}>()

const emit = defineEmits<{ click: [] }>()
</script>

<template>
  <button type="button" class="toy-btn" :class="tone === 'secondary' ? 'is-secondary' : 'is-primary'" :disabled="disabled"
    @click="emit('click')">
    {{ label }}
  </button>
</template>

<style scoped lang="scss">
.toy-btn {
  border-radius: 999px;
  border: 2px solid transparent;
  padding: 12px 18px;
  font-family: var(--font-heading, serif);
  font-weight: 900;
  cursor: pointer;

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &.is-primary {
    background: var(--color-accent, #c67139);
    color: var(--color-bg, #f5ead8);
  }

  &.is-secondary {
    background: transparent;
    border-color: var(--color-accent-2-400, #aebf92);
    color: var(--color-accent-2-800, #3d472b);
  }
}
</style>
