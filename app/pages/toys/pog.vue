<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue'
import BetPanel from '~/components/toys/BetPanel.vue'
import ResultModal from '~/components/toys/ResultModal.vue'
import ToyGameHeader from '~/components/toys/ToyGameHeader.vue'
import { useToyPog } from '~/composables/useToyPog'
import type { ToyPogCard } from '~/services/api'

const round = useToyPog()
const chips = computed(() => round.state.catalog?.betChips ?? [])
const face = (card: ToyPogCard | null | undefined) => {
  if (!card) return '標'
  if (card.kind === 'king') return '王'
  if (card.kind === 'shield') return '盾'
  if (card.kind === 'swap') return '換'
  if (card.kind === 'bomb') return '炸'
  return String(card.rank)
}
const modalVisible = computed(() => round.state.settled && round.state.revealed)
const modalTitle = computed(() => {
  if (round.state.playerWins > round.state.npcWins) return '你贏的回合比較多'
  if (round.state.playerWins === round.state.npcWins) return '回合數相同'
  return '對方贏的回合比較多'
})
const modalDetail = computed(() => {
  if (round.state.reward > 0 && round.state.playerWins === round.state.npcWins) return `注額 ${round.state.reward.toLocaleString('zh-TW')} 已退回。`
  if (round.state.reward > 0) return `已寫入 F 幣 ${round.state.reward.toLocaleString('zh-TW')}（×${round.state.multiplier}）`
  return '這局不加帳。'
})

onMounted(() => {
  void round.actions.load()
})
onBeforeUnmount(() => {
  round.stopReveal()
})
</script>

<template>
  <main class="theme-taiwan-lottery pog">
    <ToyGameHeader :balance="round.state.balance" />
    <section class="pog-body">
      <h1>尪仔標</h1>
      <p class="pog-note">五張打完才結算。換會在出牌前重抽，炸會壓低對方下一張。</p>
      <p v-if="round.state.catalogError" class="pog-error">{{ round.state.catalogError }}</p>
      <p v-else-if="round.state.error" class="pog-error">{{ round.state.error }}</p>
      <p v-if="round.state.blocked">其他玩具還沒結束，這一款先不能開。</p>
      <p>你 {{ round.state.playerWins }} · 對方 {{ round.state.npcWins }}</p>

      <article class="trick" :class="{ 'is-open': round.state.revealed && round.state.last }">
        <span>你 {{ face(round.state.revealed ? round.state.last?.player : null) }}</span>
        <span>對方 {{ face(round.state.revealed ? round.state.last?.npc : null) }}</span>
      </article>

      <div class="hand">
        <button v-for="card in round.state.hand" :key="card.id" type="button"
          :disabled="!round.state.canPlay || round.state.settling || round.state.status === 'playing'"
          @click="round.actions.play(card.id)">
          {{ face(card) }}
        </button>
      </div>

      <BetPanel v-if="!round.state.canPlay" :chips="chips" :bet="round.state.bet" :custom-bet="round.state.customBet"
        :disabled="round.state.settling || round.state.status === 'playing'"
        @choose="round.actions.chooseChip" @update:custom-bet="round.state.customBet = $event"
        @apply-custom="round.actions.applyCustom" />
      <button v-if="!round.state.canPlay && !round.state.settled" type="button" class="deal"
        :disabled="round.state.settling || round.state.blocked" @click="round.actions.start">
        發牌
      </button>

      <ResultModal :visible="modalVisible" :title="modalTitle" :detail="modalDetail"
        :can-claim="false" :can-continue="false" :can-replay="round.state.settled"
        :busy="round.state.settling" @claim="() => {}" @continue="() => {}" @replay="round.actions.playAgain" />
    </section>
  </main>
</template>

<style scoped lang="scss">
.pog-body {
  max-width: 720px;
  margin: 0 auto;
  padding: 24px 16px 48px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.pog-note {
  margin: 0;
}

.pog-error {
  margin: 0;
  color: var(--color-accent-800);
}

.trick,
.hand {
  display: flex;
  gap: 8px;
}

.trick span,
.hand button,
.deal {
  border-radius: var(--radius-md);
  min-width: 64px;
  padding: 14px;
  font-family: var(--font-heading);
  font-size: 24px;
}

.trick span {
  background: var(--color-neutral-100);
  border: 2px solid var(--color-accent-400);
}

.hand button,
.deal {
  border: 0;
  background: var(--color-accent);
  color: var(--color-bg);
  cursor: pointer;

  &:disabled {
    opacity: 0.45;
    cursor: default;
  }
}
</style>
