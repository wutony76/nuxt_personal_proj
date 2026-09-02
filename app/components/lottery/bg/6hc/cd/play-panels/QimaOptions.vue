<script setup lang="ts">
import type { PropType } from 'vue'
import type { PlayOption } from '#shared/config/6hc-cd'
import SimpleTableOptions from './SimpleTableOptions.vue'

const props = defineProps({
  options: { type: Array as PropType<PlayOption[]>, default: () => [] },
  selectedCodes: { type: Array as PropType<string[]>, default: () => [] },
  selectedType: { type: String, default: '' }
})

const emit = defineEmits(['toggle'])
</script>

<template>
  <SimpleTableOptions
    :options="props.options"
    :selected-codes="props.selectedCodes"
    :selected-type="props.selectedType"
    play-label="七碼"
    @toggle="emit('toggle', $event)" />
</template>
