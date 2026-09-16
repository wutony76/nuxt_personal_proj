<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue'
import BetPanel from '~/components/toys/BetPanel.vue'
import ResultModal from '~/components/toys/ResultModal.vue'
import RewardDisplay from '~/components/toys/RewardDisplay.vue'
import ToyGameHeader from '~/components/toys/ToyGameHeader.vue'
import { useToyRound } from '~/composables/useToyRound'

const round = useToyRound()

const cells = computed(() => round.state.catalog?.luckyDraw.cells ?? 12)
const chips = computed(() => round.state.catalog?.betChips ?? [])
const modalVisible = computed(() => round.state.status === 'result' && round.state.revealed && !round.state.picking)
const modalTitle = computed(() => {
  if (round.state.claimed) return '已領取'
  if (round.state.result?.multiplier === 0) return '這格是空的'
  if (round.state.result) return round.state.result.label
  return '結果'
})
const modalDetail = computed(() => {
  if (round.state.blockedGameKey) return '其他玩具還有未領金額，先回那一款處理。'
  if (round.state.claimed) return `已寫入 F 幣 ${round.state.reward.toLocaleString('zh-TW')}`
  if (round.state.result?.multiplier === 0) return '本輪結束，未領金額已歸零。'
  if (round.state.result) return `倍率 ×${round.state.result.multiplier}`
  return ''
})

const click = {
  pick: (index: number) => {
    if (round.state.settling || round.state.status === 'playing') return
    if (round.state.picking) {
      void round.actions.continueDraw(index)
      return
    }
    if (round.state.pot > 0) return
    void round.actions.start(index)
  }
}

onMounted(() => {
  void round.actions.load()
})
onBeforeUnmount(() => {
  round.stopReveal()
})
</script>

<template>
  <main class="theme-taiwan-lottery lucky">
    <ToyGameHeader :balance="round.state.balance" />
    <section class="lucky-body">
      <h1>抽抽樂</h1>
      <p v-if="round.state.catalogError" class="lucky-error">{{ round.state.catalogError }}</p>
      <p v-else-if="round.state.error" class="lucky-error">{{ round.state.error }}</p>
      <p v-if="round.state.blockedGameKey">其他玩具還有未領金額，這一款先不能開。</p>

      <RewardDisplay :pot="round.state.pot" :reward="round.state.reward" />
      <BetPanel :chips="chips" :bet="round.state.bet" :custom-bet="round.state.customBet"
        :disabled="round.state.settling || round.state.status === 'playing' || round.state.pot > 0"
        @choose="round.actions.chooseChip" @update:custom-bet="round.state.customBet = $event"
        @apply-custom="round.actions.applyCustom" />

      <div class="grid" :class="{ 'is-locked': round.state.settling || round.state.status === 'playing' }">
        <button v-for="index in cells" :key="index - 1" type="button" class="cell"
          :class="{ 'is-open': round.state.revealed && round.state.result?.cellIndex === index - 1 }"
          :disabled="round.state.settling || round.state.status === 'playing' || (round.state.pot > 0 && !round.state.picking)"
          @click="click.pick(index - 1)">
          <span v-if="round.state.revealed && round.state.result?.cellIndex === index - 1">
            {{ round.state.result.label }}
          </span>
          <span v-else>🎁</span>
        </button>
      </div>

      <ResultModal :visible="modalVisible" :title="modalTitle" :detail="modalDetail"
        :can-claim="round.state.canClaim" :can-continue="round.state.canContinue"
        :can-replay="round.state.pot <= 0 && !round.state.canClaim" :busy="round.state.settling"
        @claim="round.actions.claim" @continue="round.actions.armContinue" @replay="round.actions.playAgain" />
    </section>
  </main>
</template>

<style scoped lang="scss">
.lucky-body {
  max-width: 720px;
  margin: 0 auto;
  padding: 24px 16px 48px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.lucky-error {
  margin: 0;
  color: var(--color-accent-800);
}

.grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}

.cell {
  aspect-ratio: 1;
  border-radius: var(--radius-md);
  border: 2px solid var(--color-accent-400);
  background: var(--color-neutral-100);
  font-size: 28px;
  cursor: pointer;
  transition: transform 0.6s ease;

  &.is-open {
    transform: rotateY(180deg);
    background: var(--color-accent-2-200);
    font-size: 18px;
    font-family: var(--font-heading);
  }

  &:disabled {
    cursor: not-allowed;
  }
}
</style>
