<script setup lang="ts">
import { inject } from 'vue'

const closeToy = inject<(() => void) | null>('closeToyDialog', null)

defineProps<{
  visible: boolean
  title: string
  detail: string
  canClaim: boolean
  canContinue: boolean
  canReplay: boolean
  busy: boolean
  continueLabel?: string
}>()

const emit = defineEmits<{
  claim: []
  continue: []
  replay: []
}>()
</script>

<template>
  <div v-if="visible" class="result-modal-mask">
    <section class="result-modal taiwan-lottery-scrollbar" role="dialog" :aria-label="title">
      <h2>{{ title }}</h2>
      <p>{{ detail }}</p>
      <div class="result-actions">
        <button v-if="canClaim" type="button" class="is-claim" :disabled="busy" @click="emit('claim')">領取</button>
        <button v-if="canContinue" type="button" class="is-continue" :disabled="busy" @click="emit('continue')">{{ continueLabel || '繼續抽' }}</button>
        <button v-if="canReplay" type="button" class="is-continue" :disabled="busy" @click="emit('replay')">再玩一次</button>
        <button v-if="closeToy" type="button" class="is-close" @click="closeToy()">關閉</button>
        <NuxtLink v-else class="is-close" to="/lottery-hall-taiwan#tw-shelf">回大廳</NuxtLink>
      </div>
    </section>
  </div>
</template>

<style scoped lang="scss">
.result-modal-mask {
  position: fixed;
  inset: 0;
  z-index: 1010;
  display: grid;
  place-items: center;
  padding: 16px;
  background: rgba(46, 43, 37, 0.55);
}

.result-modal {
  width: min(420px, 100%);
  max-height: 85vh;
  overflow-y: auto;
  background: var(--color-surface, #ebddc5);
  border: 2px solid var(--color-accent-2-400, #aebf92);
  border-radius: var(--radius-lg, 28px);
  padding: 20px;
  box-shadow: var(--shadow-lg);
  animation: result-modal-in 0.18s ease-out both;

  h2 {
    margin: 0 0 8px;
    color: var(--color-accent-2-800, #3d472b);
  }

  p {
    margin: 0 0 14px;
  }
}

@keyframes result-modal-in {
  from {
    opacity: 0;
    transform: translateY(10px) scale(0.98);
  }

  to {
    opacity: 1;
    transform: translateY(0) scale(1);
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
    cursor: pointer;

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }

  .is-claim {
    background: #dc2626;
  }

  .is-continue {
    background: var(--color-accent-2-700, #56633f);
  }

  .is-close {
    background: #2e2b25;
  }
}
</style>
