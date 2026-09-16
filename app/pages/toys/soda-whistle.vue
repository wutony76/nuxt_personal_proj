<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue'
import BetPanel from '~/components/toys/BetPanel.vue'
import ResultModal from '~/components/toys/ResultModal.vue'
import RewardDisplay from '~/components/toys/RewardDisplay.vue'
import ToyGameHeader from '~/components/toys/ToyGameHeader.vue'
import { useToySoda } from '~/composables/useToySoda'

const round = useToySoda()

const chips = computed(() => round.state.catalog?.betChips ?? [])
const height = computed(() => `${Math.min(100, 18 + round.state.step * 14)}%`)
const modalVisible = computed(() => round.state.revealed && round.state.busted != null && round.state.status !== 'playing')
const modalTitle = computed(() => {
  if (round.state.claimed) return '已領取'
  if (round.state.busted) return '吹破了'
  return `第 ${round.state.step} 階`
})
const modalDetail = computed(() => {
  if (round.state.claimed) return `已寫入 F 幣 ${round.state.reward.toLocaleString('zh-TW')}`
  if (round.state.busted) return '本輪結束，未領金額已歸零。'
  return `這一階 ${round.state.prize.toLocaleString('zh-TW')}`
})

onMounted(() => {
  void round.actions.load()
})
onBeforeUnmount(() => {
  round.stopReveal()
})
</script>

<template>
  <main class="theme-taiwan-lottery soda">
    <ToyGameHeader :balance="round.state.balance" />
    <section class="soda-body">
      <h1>汽水笛</h1>
      <p class="soda-note">繼續吹會提高獎金，也更容易吹破。吹破這一輪就沒了。</p>
      <p v-if="round.state.catalogError" class="soda-error">{{ round.state.catalogError }}</p>
      <p v-else-if="round.state.error" class="soda-error">{{ round.state.error }}</p>
      <p v-if="round.state.blockedGameKey">其他玩具還沒結束，這一款先不能開。</p>

      <RewardDisplay :pot="round.state.pot" :reward="round.state.reward" />
      <BetPanel :chips="chips" :bet="round.state.bet" :custom-bet="round.state.customBet"
        :disabled="round.state.settling || round.state.pot > 0 || round.state.status === 'playing'"
        @choose="round.actions.chooseChip" @update:custom-bet="round.state.customBet = $event"
        @apply-custom="round.actions.applyCustom" />

      <div class="whistle" :class="{ 'is-blowing': round.state.status === 'playing', 'is-burst': round.state.revealed && round.state.busted }">
        <span class="foam" :style="{ height }" />
      </div>

      <button v-if="round.state.pot <= 0 && !round.state.canClaim" type="button" class="blow"
        :disabled="round.state.settling || round.state.status === 'playing' || round.state.blockedGameKey != null"
        @click="round.actions.start">
        吹
      </button>

      <ResultModal :visible="modalVisible" :title="modalTitle" :detail="modalDetail"
        continue-label="繼續吹" :can-claim="round.state.canClaim" :can-continue="round.state.canContinue"
        :can-replay="round.state.finished && !round.state.canClaim" :busy="round.state.settling"
        @claim="round.actions.claim" @continue="round.actions.blow" @replay="round.actions.playAgain" />
    </section>
  </main>
</template>

<style scoped lang="scss">
.soda-body {
  max-width: 720px;
  margin: 0 auto;
  padding: 24px 16px 48px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.soda-note {
  margin: 0;
}

.soda-error {
  margin: 0;
  color: var(--color-accent-800);
}

.whistle {
  align-self: center;
  width: 88px;
  height: 220px;
  border-radius: 40px 40px 18px 18px;
  border: 3px solid var(--color-accent-400);
  background: var(--color-neutral-100);
  position: relative;
  overflow: hidden;

  &.is-blowing {
    animation: shake 0.6s ease;
  }

  &.is-burst {
    border-color: var(--color-accent-800);
  }
}

.foam {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--color-accent-2-200);
  transition: height 0.6s ease;
}

.blow {
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

@keyframes shake {
  0%,
  100% { transform: rotate(0deg); }
  30% { transform: rotate(-4deg); }
  70% { transform: rotate(4deg); }
}
</style>
