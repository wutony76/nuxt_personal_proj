<script setup lang="ts">
defineProps<{
  chips: number[]
  bet: number
  customBet: string
  disabled: boolean
}>()

const emit = defineEmits<{
  choose: [amount: number]
  'update:customBet': [value: string]
  applyCustom: []
}>()
</script>

<template>
  <section class="bet-panel">
    <p class="bet-label">下注</p>
    <div class="bet-chips">
      <button v-for="chip in chips" :key="chip" type="button" class="chip" :class="{ 'is-on': bet === chip }"
        :disabled="disabled" @click="emit('choose', chip)">
        {{ chip }}
      </button>
      <label class="custom">
        自訂
        <input :value="customBet" type="number" min="1" step="1" :disabled="disabled"
          @input="emit('update:customBet', ($event.target as HTMLInputElement).value)">
      </label>
      <button type="button" class="chip" :disabled="disabled" @click="emit('applyCustom')">套用</button>
    </div>
  </section>
</template>

<style scoped lang="scss">
.bet-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.bet-label {
  margin: 0;
  font-size: 13px;
  color: var(--color-neutral-700, #645c50);
}

.bet-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.chip,
.custom input {
  border-radius: 999px;
  border: 1px solid var(--color-neutral-400, #c0b6a5);
  background: var(--color-bg, #f5ead8);
  padding: 8px 12px;
}

.chip.is-on {
  background: var(--color-accent-200, #ffe1d0);
  border-color: var(--color-accent-700, #8c491a);
}

.custom {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
}
</style>
