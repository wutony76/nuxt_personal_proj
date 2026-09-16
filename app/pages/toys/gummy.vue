<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue'
import BetPanel from '~/components/toys/BetPanel.vue'
import ResultModal from '~/components/toys/ResultModal.vue'
import RewardDisplay from '~/components/toys/RewardDisplay.vue'
import ToyGameHeader from '~/components/toys/ToyGameHeader.vue'
import { useToyGummy } from '~/composables/useToyGummy'
import type { ToyGummyColor } from '~/services/api'

const round = useToyGummy()
const colors: Array<{ id: ToyGummyColor; label: string }> = [
  { id: 'red', label: '紅' },
  { id: 'yellow', label: '黃' },
  { id: 'blue', label: '藍' },
  { id: 'green', label: '綠' }
]
const labelOf = (id: ToyGummyColor) => colors.find((item) => item.id === id)?.label ?? id

const chips = computed(() => round.state.catalog?.betChips ?? [])
const recent = computed(() => {
  const slots: Array<ToyGummyColor | null> = [null, null, null, null]
  round.state.history.slice(-4).forEach((color, index) => {
    slots[index] = color
  })
  return slots
})
const modalVisible = computed(() => round.state.revealed && round.state.correct != null && round.state.status !== 'playing')
const modalTitle = computed(() => {
  if (round.state.claimed) return '已領取'
  if (round.state.correct === false) return '猜錯了'
  return `連勝 ${round.state.streak}`
})
const modalDetail = computed(() => {
  if (round.state.claimed) return `已寫入 F 幣 ${round.state.reward.toLocaleString('zh-TW')}`
  if (round.state.correct === false) return '本輪結束，未領金額已歸零。'
  return `這一顆是${round.state.color ? labelOf(round.state.color) : ''}，倍率 ×${round.state.multiplier}`
})

onMounted(() => {
  void round.actions.load()
})
onBeforeUnmount(() => {
  round.stopReveal()
})
</script>

<template>
  <main class="theme-taiwan-lottery gummy">
    <ToyGameHeader :balance="round.state.balance" />
    <section class="gummy-body">
      <h1>橡皮糖</h1>
      <p class="gummy-note">猜下一顆顏色。下面四格只放真正抽出過的糖。</p>
      <p v-if="round.state.catalogError" class="gummy-error">{{ round.state.catalogError }}</p>
      <p v-else-if="round.state.error" class="gummy-error">{{ round.state.error }}</p>
      <p v-if="round.state.blockedGameKey">其他玩具還沒結束，這一款先不能開。</p>

      <RewardDisplay :pot="round.state.pot" :reward="round.state.reward" />
      <BetPanel :chips="chips" :bet="round.state.bet" :custom-bet="round.state.customBet"
        :disabled="round.state.settling || round.state.canGuess || round.state.pot > 0"
        @choose="round.actions.chooseChip" @update:custom-bet="round.state.customBet = $event"
        @apply-custom="round.actions.applyCustom" />

      <div class="trail">
        <span v-for="(color, index) in recent" :key="index" class="candy" :class="color ? `is-${color}` : 'is-empty'">
          {{ color ? labelOf(color) : '·' }}
        </span>
      </div>
      <p v-if="round.state.status === 'playing'" class="gummy-note">下一顆是 {{ round.state.color ? labelOf(round.state.color) : '…' }}</p>

      <div class="choices">
        <button v-for="item in colors" :key="item.id" type="button" :class="`is-${item.id}`"
          :disabled="round.state.settling || !round.state.canGuess" @click="round.actions.guess(item.id)">
          {{ item.label }}
        </button>
      </div>
      <button v-if="!round.state.canGuess && round.state.pot <= 0" type="button" class="deal"
        :disabled="round.state.settling || round.state.blockedGameKey != null" @click="round.actions.start">
        開始
      </button>

      <ResultModal :visible="modalVisible" :title="modalTitle" :detail="modalDetail"
        :can-claim="round.state.canClaim" :can-continue="false"
        :can-replay="round.state.finished && !round.state.canClaim" :busy="round.state.settling"
        @claim="round.actions.claim" @continue="() => {}" @replay="round.actions.playAgain" />
    </section>
  </main>
</template>

<style scoped lang="scss">
.gummy-body {
  max-width: 720px;
  margin: 0 auto;
  padding: 24px 16px 48px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.gummy-note {
  margin: 0;
}

.gummy-error {
  margin: 0;
  color: var(--color-accent-800);
}

.trail,
.choices {
  display: flex;
  gap: 8px;
}

.candy,
.choices button,
.deal {
  border: 0;
  border-radius: 999px;
  min-width: 64px;
  padding: 10px 14px;
  font-weight: 700;
}

.candy {
  display: grid;
  place-items: center;
  background: var(--color-neutral-100);
}

.is-red { background: #c4503a; color: #f5ead8; }
.is-yellow { background: #d6a03a; color: #2e2b25; }
.is-blue { background: #3d6f8f; color: #f5ead8; }
.is-green { background: #5d7a45; color: #f5ead8; }
.is-empty { color: var(--color-accent-400); }

.choices button,
.deal {
  cursor: pointer;

  &:disabled {
    opacity: 0.45;
    cursor: default;
  }
}

.deal {
  background: var(--color-accent);
  color: var(--color-bg);
}
</style>
