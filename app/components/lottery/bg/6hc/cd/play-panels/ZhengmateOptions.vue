<script setup lang="ts">
import type { PropType } from 'vue'
import type { PlayOption } from '#shared/config/6hc-cd'
import SimpleTableOptions from './SimpleTableOptions.vue'

const props = defineProps({
  options: { type: Array as PropType<PlayOption[]>, default: () => [] },
  selectedCodes: { type: Array as PropType<string[]>, default: () => [] },
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
    play-label="正碼特"
    @toggle="emit('toggle', $event)" />
</template>
