<script setup>
import SimpleTableOptions from './SimpleTableOptions.vue'

const props = defineProps({
  options: { type: Array, default: () => [] },
  selectedCodes: { type: Array, default: () => [] },
  selectedType: { type: String, default: '' },
  amount: { type: Number, default: 0 }
})

const emit = defineEmits(['toggle'])
</script>

<template>
  <SimpleTableOptions
    :options="props.options"
    :selected-codes="props.selectedCodes"
    :selected-type="props.selectedType"
    :amount="props.amount"
    play-label="正碼"
    @toggle="emit('toggle', $event)" />
</template>
