<script setup lang="ts">
defineProps<{
  visible: boolean
  title: string
  detail: string
  canClaim: boolean
  canContinue: boolean
  canReplay: boolean
  busy: boolean
}>()

const emit = defineEmits<{
  claim: []
  continue: []
  replay: []
}>()
</script>

<template>
  <section v-if="visible" class="result-modal">
    <h2>{{ title }}</h2>
    <p>{{ detail }}</p>
    <div class="result-actions">
      <button v-if="canClaim" type="button" :disabled="busy" @click="emit('claim')">領取</button>
      <button v-if="canContinue" type="button" :disabled="busy" @click="emit('continue')">繼續抽</button>
      <button v-if="canReplay" type="button" :disabled="busy" @click="emit('replay')">再玩一次</button>
      <NuxtLink to="/lottery-hall-taiwan#tw-shelf">回大廳</NuxtLink>
    </div>
  </section>
</template>

<style scoped lang="scss">
.result-modal {
  background: var(--color-surface, #ebddc5);
  border: 2px solid var(--color-accent-2-400, #aebf92);
  border-radius: var(--radius-lg, 28px);
  padding: 18px;

  h2 {
    margin: 0 0 8px;
    color: var(--color-accent-2-800, #3d472b);
  }

  p {
    margin: 0 0 14px;
  }
}

.result-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;

  button,
  a {
    border-radius: 999px;
    border: 0;
    padding: 10px 16px;
    background: var(--color-accent, #c67139);
    color: var(--color-bg, #f5ead8);
    text-decoration: none;
    font-weight: 700;
  }
}
</style>
