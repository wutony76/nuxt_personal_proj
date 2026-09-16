<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue'
import BetPanel from '~/components/toys/BetPanel.vue'
import ResultModal from '~/components/toys/ResultModal.vue'
import ToyGameHeader from '~/components/toys/ToyGameHeader.vue'
import { useToyWhistle } from '~/composables/useToyWhistle'
import type { ToyWhistleChoice } from '~/services/api'

const round = useToyWhistle()
const choices: Array<{ id: ToyWhistleChoice; label: string }> = [
  { id: 'short', label: '短' },
  { id: 'mid', label: '中' },
  { id: 'long', label: '長' }
]
const labelOf = (id: ToyWhistleChoice | null) => choices.find((item) => item.id === id)?.label ?? '·'
const chips = computed(() => round.state.catalog?.betChips ?? [])
const modalVisible = computed(() => round.state.revealed && round.state.outcome != null)
const modalTitle = computed(() => {
  if (round.state.outcome === 'win') return '你贏了'
  if (round.state.outcome === 'tie') return '相同'
  return '對方贏了'
})
const modalDetail = computed(() => {
  if (round.state.outcome === 'tie') return `注額 ${round.state.reward.toLocaleString('zh-TW')} 已退回。`
  if (round.state.outcome === 'win') return `已寫入 F 幣 ${round.state.reward.toLocaleString('zh-TW')}（×1.9）`
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
  <main class="theme-taiwan-lottery candy">
    <ToyGameHeader :balance="round.state.balance" />
    <section class="candy-body">
      <h1>哨子糖</h1>
      <p class="candy-note">短壓長、長壓中、中壓短。倒數只是演出。</p>
      <p v-if="round.state.catalogError" class="candy-error">{{ round.state.catalogError }}</p>
      <p v-else-if="round.state.error" class="candy-error">{{ round.state.error }}</p>
      <p v-if="round.state.blocked">其他玩具還沒結束，這一款先不能開。</p>

      <p class="count">{{ round.state.countdown ?? (round.state.revealed ? labelOf(round.state.npc) : '哨') }}</p>
      <p v-if="round.state.revealed">你 {{ labelOf(round.state.player) }} · 對方 {{ labelOf(round.state.npc) }}</p>

      <div class="history">
        <span v-for="(item, index) in round.state.history" :key="index">{{ labelOf(item) }}</span>
        <span v-if="round.state.history.length === 0">還沒比過</span>
      </div>

      <div class="choices">
        <button v-for="item in choices" :key="item.id" type="button" :class="{ 'is-on': round.state.choice === item.id }"
          :disabled="round.state.status === 'playing'" @click="round.actions.choose(item.id)">
          {{ item.label }}
        </button>
      </div>

      <BetPanel :chips="chips" :bet="round.state.bet" :custom-bet="round.state.customBet"
        :disabled="round.state.settling || round.state.status === 'playing'"
        @choose="round.actions.chooseChip" @update:custom-bet="round.state.customBet = $event"
        @apply-custom="round.actions.applyCustom" />
      <button type="button" class="go" :disabled="round.state.settling || round.state.status === 'playing' || round.state.blocked"
        @click="round.actions.play">
        比一輪
      </button>

      <ResultModal :visible="modalVisible" :title="modalTitle" :detail="modalDetail"
        :can-claim="false" :can-continue="false" :can-replay="round.state.status !== 'playing'"
        :busy="round.state.settling" @claim="() => {}" @continue="() => {}" @replay="round.actions.playAgain" />
    </section>
  </main>
</template>

<style scoped lang="scss">
.candy-body {
  max-width: 720px;
  margin: 0 auto;
  padding: 24px 16px 48px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.candy-note {
  margin: 0;
}

.candy-error {
  margin: 0;
  color: var(--color-accent-800);
}

.count {
  margin: 0;
  font-family: var(--font-heading);
  font-size: 64px;
}

.history,
.choices {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.history span,
.choices button,
.go {
  border-radius: 999px;
  padding: 8px 14px;
  font-weight: 700;
}

.history span {
  background: var(--color-accent-2-200);
}

.choices button,
.go {
  border: 0;
  background: var(--color-accent);
  color: var(--color-bg);
  cursor: pointer;

  &:disabled {
    opacity: 0.45;
    cursor: default;
  }
}

.choices button.is-on {
  outline: 3px solid var(--color-accent-2-800);
}
</style>
