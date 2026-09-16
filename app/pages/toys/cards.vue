<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue'
import BetPanel from '~/components/toys/BetPanel.vue'
import ResultModal from '~/components/toys/ResultModal.vue'
import RewardDisplay from '~/components/toys/RewardDisplay.vue'
import ToyGameHeader from '~/components/toys/ToyGameHeader.vue'
import { useToyCards } from '~/composables/useToyCards'

const round = useToyCards()

const chips = computed(() => round.state.catalog?.betChips ?? [])
const face = computed(() => (round.state.revealed ? round.state.nextRank ?? round.state.rank : round.state.rank))
const modalVisible = computed(() => round.state.revealed && round.state.correct != null && round.state.status !== 'playing')
const modalTitle = computed(() => {
  if (round.state.claimed) return '已領取'
  if (round.state.correct === false) return '猜錯了'
  if (round.state.correct) return `連勝 ${round.state.streak}`
  return '結果'
})
const modalDetail = computed(() => {
  if (round.state.claimed) return `已寫入 F 幣 ${round.state.reward.toLocaleString('zh-TW')}`
  if (round.state.correct === false) return '本輪結束，未領金額已歸零。'
  if (round.state.correct) return `倍率 ×${round.state.multiplier}`
  return ''
})

onMounted(() => {
  void round.actions.load()
})
onBeforeUnmount(() => {
  round.stopReveal()
})
</script>

<template>
  <main class="theme-taiwan-lottery cards">
    <ToyGameHeader :balance="round.state.balance" />
    <section class="cards-body">
      <h1>紙牌</h1>
      <p class="cards-note">猜下一張比現在大、小，或剛好相同。猜錯這輪就結束。</p>
      <p v-if="round.state.catalogError" class="cards-error">{{ round.state.catalogError }}</p>
      <p v-else-if="round.state.error" class="cards-error">{{ round.state.error }}</p>
      <p v-if="round.state.blockedGameKey">其他玩具還沒結束，這一款先不能開。</p>

      <RewardDisplay :pot="round.state.pot" :reward="round.state.reward" />
      <BetPanel :chips="chips" :bet="round.state.bet" :custom-bet="round.state.customBet"
        :disabled="round.state.settling || round.state.rank != null || round.state.status === 'playing'"
        @choose="round.actions.chooseChip" @update:custom-bet="round.state.customBet = $event"
        @apply-custom="round.actions.applyCustom" />

      <article class="card" :class="{ 'is-open': round.state.revealed && round.state.nextRank != null }">
        <span>{{ face ?? '？' }}</span>
      </article>
      <p v-if="round.state.streak > 0" class="cards-streak">連勝 {{ round.state.streak }}</p>

      <div class="choices">
        <button type="button" :disabled="round.state.settling || !round.state.canGuess" @click="round.actions.guess('high')">大</button>
        <button type="button" :disabled="round.state.settling || !round.state.canGuess" @click="round.actions.guess('low')">小</button>
        <button type="button" :disabled="round.state.settling || !round.state.canGuess" @click="round.actions.guess('same')">相同</button>
      </div>
      <button v-if="round.state.rank == null" type="button" class="deal"
        :disabled="round.state.settling || round.state.blockedGameKey != null" @click="round.actions.start">
        發牌
      </button>

      <ResultModal :visible="modalVisible" :title="modalTitle" :detail="modalDetail"
        :can-claim="round.state.canClaim" :can-continue="false"
        :can-replay="round.state.finished && !round.state.canClaim" :busy="round.state.settling"
        @claim="round.actions.claim" @continue="() => {}" @replay="round.actions.playAgain" />
    </section>
  </main>
</template>

<style scoped lang="scss">
.cards-body {
  max-width: 720px;
  margin: 0 auto;
  padding: 24px 16px 48px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.cards-note,
.cards-streak {
  margin: 0;
}

.cards-error {
  margin: 0;
  color: var(--color-accent-800);
}

.card {
  align-self: center;
  width: 140px;
  aspect-ratio: 3 / 4;
  display: grid;
  place-items: center;
  border-radius: var(--radius-md);
  border: 2px solid var(--color-accent-400);
  background: var(--color-neutral-100);
  font-family: var(--font-heading);
  font-size: 64px;
  transition: transform 0.6s ease;

  &.is-open {
    transform: rotateY(180deg);
    background: var(--color-accent-2-200);
  }
}

.choices,
.deal {
  display: flex;
  gap: 8px;
}

.choices button,
.deal {
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
