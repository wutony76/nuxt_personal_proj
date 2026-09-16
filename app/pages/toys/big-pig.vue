<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue'
import BetPanel from '~/components/toys/BetPanel.vue'
import ResultModal from '~/components/toys/ResultModal.vue'
import ToyGameHeader from '~/components/toys/ToyGameHeader.vue'
import { useToyBigPig } from '~/composables/useToyBigPig'

const round = useToyBigPig()
const chips = computed(() => round.state.catalog?.betChips ?? [])
const faces = computed(() => round.state.revealed ? round.state.player : null)
const npcFaces = computed(() => round.state.revealed ? round.state.npc : null)
const sum = (pair: [number, number] | null) => (pair ? pair[0] + pair[1] : 0)
const titles: Record<string, string> = {
  tie: '和局',
  gold: '金豬',
  pair: '雙豬',
  win: '你贏了',
  tiny: '小豬',
  lose: '大豬公贏了'
}
const modalVisible = computed(() => round.state.revealed && round.state.kind != null)
const modalTitle = computed(() => titles[round.state.kind ?? ''] ?? '結果')
const modalDetail = computed(() => {
  if (round.state.kind === 'tie') return `注額 ${round.state.reward.toLocaleString('zh-TW')} 已退回。`
  if (round.state.reward > 0) return `已寫入 F 幣 ${round.state.reward.toLocaleString('zh-TW')}（×${round.state.multiplier}）`
  return '這局不加帳，注額也不退。'
})

onMounted(() => {
  void round.actions.load()
})
onBeforeUnmount(() => {
  round.stopReveal()
})
</script>

<template>
  <main class="theme-taiwan-lottery pig">
    <ToyGameHeader :balance="round.state.balance" />
    <section class="pig-body">
      <h1>大豬公</h1>
      <p class="pig-note">先比點數和。你贏了才看是不是金豬或對子。</p>
      <p v-if="round.state.catalogError" class="pig-error">{{ round.state.catalogError }}</p>
      <p v-else-if="round.state.error" class="pig-error">{{ round.state.error }}</p>
      <p v-if="round.state.blocked">其他玩具還沒結束，這一款先不能開。</p>

      <div class="table">
        <article>
          <h2>你 {{ faces ? sum(round.state.player) : '' }}</h2>
          <div class="dice" :class="{ 'is-rolling': round.state.status === 'playing' }">
            <span>{{ faces?.[0] ?? '豬' }}</span>
            <span>{{ faces?.[1] ?? '豬' }}</span>
          </div>
        </article>
        <article>
          <h2>大豬公 {{ npcFaces ? sum(round.state.npc) : '' }}</h2>
          <div class="dice" :class="{ 'is-rolling': round.state.status === 'playing' }">
            <span>{{ npcFaces?.[0] ?? '豬' }}</span>
            <span>{{ npcFaces?.[1] ?? '豬' }}</span>
          </div>
        </article>
      </div>

      <BetPanel :chips="chips" :bet="round.state.bet" :custom-bet="round.state.customBet"
        :disabled="round.state.settling || round.state.status === 'playing'"
        @choose="round.actions.chooseChip" @update:custom-bet="round.state.customBet = $event"
        @apply-custom="round.actions.applyCustom" />
      <button type="button" class="roll" :disabled="round.state.settling || round.state.status === 'playing' || round.state.blocked"
        @click="round.actions.roll">
        擲骰
      </button>

      <ResultModal :visible="modalVisible" :title="modalTitle" :detail="modalDetail"
        :can-claim="false" :can-continue="false" :can-replay="round.state.status !== 'playing'"
        :busy="round.state.settling" @claim="() => {}" @continue="() => {}" @replay="round.actions.playAgain" />
    </section>
  </main>
</template>

<style scoped lang="scss">
.pig-body {
  max-width: 720px;
  margin: 0 auto;
  padding: 24px 16px 48px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.pig-note {
  margin: 0;
}

.pig-error {
  margin: 0;
  color: var(--color-accent-800);
}

.table {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;

  h2 {
    margin: 0 0 8px;
    font-size: 18px;
  }
}

.dice {
  display: flex;
  gap: 8px;

  span {
    width: 64px;
    height: 64px;
    display: grid;
    place-items: center;
    border-radius: var(--radius-md);
    border: 2px solid var(--color-accent-400);
    background: var(--color-neutral-100);
    font-size: 28px;
    font-family: var(--font-heading);
  }

  &.is-rolling span {
    animation: shake 0.6s ease;
  }
}

.roll {
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
  30% { transform: rotate(-8deg); }
  70% { transform: rotate(8deg); }
}
</style>
