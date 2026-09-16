<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue'
import BetPanel from '~/components/toys/BetPanel.vue'
import ResultModal from '~/components/toys/ResultModal.vue'
import ToyGameHeader from '~/components/toys/ToyGameHeader.vue'
import { useToyBamboo } from '~/composables/useToyBamboo'
import type { ToyBambooTarget } from '~/services/api'

const round = useToyBamboo()
const targets: Array<{ id: ToyBambooTarget; label: string; odds: string }> = [
  { id: 'm10', label: '≥10m', odds: '×1.1' },
  { id: 'm20', label: '≥20m', odds: '×1.4' },
  { id: 'm30', label: '≥30m', odds: '×2' },
  { id: 'm40', label: '≥40m', odds: '×4' },
  { id: 'm50', label: '≥50m', odds: '×15' }
]

const chips = computed(() => round.state.catalog?.betChips ?? [])
const lift = computed(() => `${Math.round((round.state.shownHeight / 69) * 180)}px`)
const modalVisible = computed(() => round.state.revealed && round.state.height != null)
const modalTitle = computed(() => (round.state.hit ? `飛到 ${round.state.height}m` : `只到 ${round.state.height}m`))
const modalDetail = computed(() => {
  if (round.state.hit) return `已寫入 F 幣 ${round.state.reward.toLocaleString('zh-TW')}（×${round.state.multiplier}）`
  return '沒達標，F 幣不加帳。'
})

onMounted(() => {
  void round.actions.load()
})
onBeforeUnmount(() => {
  round.stopReveal()
})
</script>

<template>
  <main class="theme-taiwan-lottery bamboo">
    <ToyGameHeader :balance="round.state.balance" />
    <section class="bamboo-body">
      <h1>竹蜻蜓</h1>
      <p class="bamboo-note">先選要飛多高。高度在轉出去之前就決定了。</p>
      <p v-if="round.state.catalogError" class="bamboo-error">{{ round.state.catalogError }}</p>
      <p v-else-if="round.state.error" class="bamboo-error">{{ round.state.error }}</p>
      <p v-if="round.state.blocked">其他玩具還沒結束，這一款先不能開。</p>

      <div class="sky">
        <span class="copter" :style="{ transform: `translateY(-${lift})` }">蜓</span>
        <strong v-if="round.state.shownHeight > 0">{{ round.state.shownHeight }}m</strong>
      </div>

      <div class="targets">
        <button v-for="item in targets" :key="item.id" type="button"
          :class="{ 'is-on': round.state.target === item.id }"
          :disabled="round.state.status === 'playing' || round.state.settling"
          @click="round.actions.chooseTarget(item.id)">
          {{ item.label }} {{ item.odds }}
        </button>
      </div>

      <BetPanel :chips="chips" :bet="round.state.bet" :custom-bet="round.state.customBet"
        :disabled="round.state.settling || round.state.status === 'playing'"
        @choose="round.actions.chooseChip" @update:custom-bet="round.state.customBet = $event"
        @apply-custom="round.actions.applyCustom" />

      <button type="button" class="launch" :disabled="round.state.settling || round.state.status === 'playing' || round.state.blocked"
        @click="round.actions.launch">
        轉出去
      </button>

      <ResultModal :visible="modalVisible" :title="modalTitle" :detail="modalDetail"
        :can-claim="false" :can-continue="false" :can-replay="round.state.status !== 'playing'"
        :busy="round.state.settling" @claim="() => {}" @continue="() => {}" @replay="round.actions.playAgain" />
    </section>
  </main>
</template>

<style scoped lang="scss">
.bamboo-body {
  max-width: 720px;
  margin: 0 auto;
  padding: 24px 16px 48px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.bamboo-note {
  margin: 0;
}

.bamboo-error {
  margin: 0;
  color: var(--color-accent-800);
}

.sky {
  height: 220px;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: 12px;
  border-radius: var(--radius-md);
  background: var(--color-neutral-100);
}

.copter {
  font-family: var(--font-heading);
  font-size: 42px;
  transition: transform 0.6s ease;
}

.targets {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;

  button {
    border: 2px solid var(--color-accent-400);
    border-radius: 999px;
    padding: 8px 12px;
    background: transparent;
    cursor: pointer;

    &.is-on {
      background: var(--color-accent);
      color: var(--color-bg);
    }
  }
}

.launch {
  border: 0;
  border-radius: 999px;
  padding: 10px 18px;
  background: var(--color-accent);
  color: var(--color-bg);
  font-weight: 700;
  cursor: pointer;

  &:disabled {
    opacity: 0.45;
    cursor: default;
  }
}
</style>
