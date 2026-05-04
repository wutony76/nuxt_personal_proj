<script setup>
import SimpleTableOptions from './SimpleTableOptions.vue'

const props = defineProps({
  options: { type: Array, default: () => [] },
  selectedCodes: { type: Array, default: () => [] },
  selectedType: { type: String, default: '' }
})

const emit = defineEmits(['toggle'])
</script>

<template>
  <SimpleTableOptions
    :options="props.options"
    :selected-codes="props.selectedCodes"
    :selected-type="props.selectedType"
    play-label="半波"
    @toggle="emit('toggle', $event)" />
</template>
