<script setup>
const props = defineProps({
  options: {
    type: Array,
    default: () => []
  },
  selectedCodes: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['toggle'])

const click = {
  toggle: (option) => {
    emit('toggle', option)
  }
}
</script>

<template>
  <div class="option-grid">
    <button
      v-for="option in props.options"
      :key="option.id"
      type="button"
      class="option-item"
      :class="{ active: props.selectedCodes.includes(option.label) }"
      @click="click.toggle(option)">
      {{ option.label }}
    </button>
  </div>
</template>

<style scoped lang="scss">
.option-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  max-height: 250px;
  overflow: auto;
}

.option-item {
  border: 1px solid #bfd8ea;
  border-radius: 999px;
  padding: 0.12rem 0.6rem;
  background: #fff;
  color: #5f7f95;
  font-size: 0.72rem;
  cursor: pointer;

  &.active {
    border-color: #2d9fe2;
    background: #2d9fe2;
    color: #fff;
  }
}
</style>
