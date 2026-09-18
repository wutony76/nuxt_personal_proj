<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, watch } from 'vue'
import BetPanel from '~/components/toys/BetPanel.vue'
import BlockedModal from '~/components/toys/BlockedModal.vue'
import ResultModal from '~/components/toys/ResultModal.vue'
import ToyGameHeader from '~/components/toys/ToyGameHeader.vue'
import { useToyPog } from '~/composables/useToyPog'
import type { ToyPogCard } from '~/services/api'

/** 版面套用抽抽樂 (lucky-draw.vue) 的視覺骨架（統計列＋分頁＋卡片框），
 *  出牌/發牌/結算行為維持 useToyPog 既有邏輯不變，這款五回合出牌定勝負，沒有連乘機制。 */
const round = useToyPog()
const chips = computed(() => round.state.catalog?.betChips ?? [])
const blockedItem = computed(() =>
  round.state.catalog?.items.find((item) => item.slug === round.state.blockedGameKey) ?? null
)
const face = (card: ToyPogCard | null | undefined) => {
  if (!card) return '標'
  if (card.kind === 'king') return '王'
  if (card.kind === 'shield') return '盾'
  if (card.kind === 'swap') return '換'
  if (card.kind === 'bomb') return '炸'
  return String(card.rank)
}
type MainTab = 'game' | 'rules'
const ui = reactive({ mainTab: 'game' as MainTab, resultReady: false })

/** 每回合出牌結果先讓玩家看 1 秒，才解鎖操作／彈出結算視窗；這段期間鎖住手牌與發牌 */
let resultDelayTimer: ReturnType<typeof setTimeout> | null = null
watch(() => round.state.revealed, (revealed) => {
  if (resultDelayTimer) {
    clearTimeout(resultDelayTimer)
    resultDelayTimer = null
  }
  if (revealed) {
    resultDelayTimer = setTimeout(() => {
      ui.resultReady = true
      resultDelayTimer = null
    }, 1000)
  } else {
    ui.resultReady = false
  }
}, { immediate: true })

const isLocked = computed(() =>
  round.state.settling || round.state.status === 'playing' || (round.state.revealed && !ui.resultReady)
)

const modalVisible = computed(() => round.state.settled && round.state.revealed && ui.resultReady)
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

const money = (value: number) => Math.floor(value).toLocaleString('zh-TW')

/** 已完成回合數：發牌時手牌有 5 張，出一張少一張，5 減剩餘手牌數＝已出牌回合；
 *  結算後手牌會被清空（見 pog.ts 的 settled 分支），視為 5 回合已滿。沒有連乘機制，這裡只算「打了幾回合」。 */
const completedRounds = computed(() => {
  const s = round.state
  if (s.settled) return 5
  if (s.canPlay) return 5 - s.hand.length
  return 0
})
const progressPercent = computed(() => `${(completedRounds.value / 5) * 100}%`)
const roundLabel = computed(() => {
  const s = round.state
  if (s.settled) return '已結束 5/5'
  if (s.canPlay) return `第 ${Math.min(5, completedRounds.value + 1)}/5 回合`
  return '尚未開局'
})

const headline = computed(() => {
  const s = round.state
  if (s.blocked) return '其他玩具還有未結束，先處理那一款'
  if (s.settling || s.status === 'playing') return '出牌對戰中…'
  if (s.canPlay) return '選一張牌，出牌對戰'
  if (s.settled) return '五回合已打完，看看結果'
  return '出牌對戰，五回合定勝負'
})
const headlineTone = computed(() => {
  const s = round.state
  if (s.blocked) return 'is-neutral'
  if (s.settled) return 'is-accent'
  return ''
})

const click = {
  setMainTab: (tab: MainTab) => { ui.mainTab = tab }
}

onMounted(() => {
  void round.actions.load()
})
onBeforeUnmount(() => {
  round.stopReveal()
  if (resultDelayTimer) clearTimeout(resultDelayTimer)
})
</script>

<template>
  <main class="theme-taiwan-lottery pog">
    <!-- <ToyGameHeader :balance="round.state.balance" /> -->
    <section class="pog-body">
      <p v-if="round.state.catalogError" class="pog-error">{{ round.state.catalogError }}</p>
      <p v-else-if="round.state.error" class="pog-error">{{ round.state.error }}</p>
      <BlockedModal :visible="round.state.blocked" :item="blockedItem" />

      <div class="lucky-stats">
        <div class="stat-card is-dark">
          <div class="stat-label">目前比數</div>
          <div class="stat-value">你 {{ round.state.playerWins }} : {{ round.state.npcWins }} 對方</div>
        </div>
        <div class="stat-card is-accent">
          <div class="stat-label">回合進度</div>
          <div class="stat-value">{{ roundLabel }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">F 幣餘額</div>
          <div class="stat-value">{{ money(round.state.balance) }}</div>
        </div>
      </div>

      <div class="tab-bar pog-main-tabs">
        <button type="button" class="tab-btn" :class="{ 'is-active': ui.mainTab === 'game' }"
          @click="click.setMainTab('game')">遊戲</button>
        <button type="button" class="tab-btn" :class="{ 'is-active': ui.mainTab === 'rules' }"
          @click="click.setMainTab('rules')">規則</button>
      </div>

      <div v-if="ui.mainTab === 'game'" class="lucky-panel">
        <div v-if="!round.state.canPlay" class="bet-row">
          <BetPanel :chips="chips" :bet="round.state.bet" :custom-bet="round.state.customBet" :disabled="isLocked"
            @choose="round.actions.chooseChip" @update:custom-bet="round.state.customBet = $event"
            @apply-custom="round.actions.applyCustom" />
          <button v-if="!round.state.settled" type="button" class="deal"
            :disabled="isLocked || round.state.blocked" @click="round.actions.start">
            發牌
          </button>
        </div>

        <div class="frame-headline" :class="headlineTone">{{ headline }}</div>

        <div class="frame-border">
          <article class="trick" :class="{ 'is-open': round.state.revealed && round.state.last }">
            <span>你 {{ face(round.state.revealed ? round.state.last?.player : null) }}</span>
            <span>對方 {{ face(round.state.revealed ? round.state.last?.npc : null) }}</span>
          </article>

          <div class="hand">
            <button v-for="card in round.state.hand" :key="card.id" type="button"
              :disabled="!round.state.canPlay || isLocked"
              @click="round.actions.play(card.id)">
              {{ face(card) }}
            </button>
          </div>
        </div>

        <div class="frame-progress">
          <div class="progress-row">
            <span>回合進度</span>
            <span>已完成 {{ completedRounds }} / 5</span>
          </div>
          <div class="progress-track">
            <div class="progress-fill" :style="{ width: progressPercent }" />
          </div>
        </div>
      </div>

      <div v-else class="lucky-rules">
        <section class="rule-section">
          <h3>牌組</h3>
          <ul class="rule-list">
            <li>數字牌 1～8：比點數大小，較大的一方贏這回合。</li>
            <li>王：牌面最大（9 點），出牌基本必勝，除非對方出盾抵銷。</li>
            <li>盾：對方點數比自己大時可以抵銷，這回合算平手，不算輸。</li>
            <li>換：出牌前重抽一張，換成剩餘牌堆裡的牌再比大小。</li>
            <li>炸：出牌後，對方下一張數字牌要先扣 2 點才比大小。</li>
          </ul>
        </section>

        <section class="rule-section">
          <h3>結算</h3>
          <ul class="rule-list">
            <li>雙方各發 5 張，五回合打完比總勝場。</li>
            <li>贏的回合比較多 → 贏，用過王牌 ×3.8，沒用過 ×1.9。</li>
            <li>兩邊勝場一樣多 → 平手，注額原數退回。</li>
            <li>輸的回合比較多 → 輸，這局不加帳（×0）。</li>
          </ul>
        </section>

        <section class="rule-section">
          <h3>頭家的話</h3>
          <p class="side-note">未滿十八歲不得購買。理性投注，量力而為。</p>
        </section>
      </div>

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
  padding: 20px 16px 24px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.pog-error {
  margin: 0 0 4px;
  color: var(--color-accent-800, #643312);
}

.lucky-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 10px;
  margin-bottom: 6px;
}

.stat-card {
  background: var(--color-neutral-100, #f9f4ed);
  border: 1px solid var(--color-neutral-300, #dcd3c4);
  border-radius: var(--radius-md, 16px);
  padding: 9px 16px;

  .stat-label {
    font-size: 11px;
    letter-spacing: 0.1em;
    color: var(--color-neutral-600, #82796a);
  }

  .stat-value {
    margin-top: 2px;
    font-family: var(--font-heading, serif);
    font-weight: 900;
    font-size: 20px;
    color: var(--color-accent-800, #643312);
  }

  &.is-dark {
    background: var(--color-neutral-900, #2e2b25);
    border-color: var(--color-neutral-900, #2e2b25);

    .stat-label {
      color: var(--color-accent-300, #ffc6a5);
    }

    .stat-value {
      color: var(--color-bg, #f5ead8);
    }
  }

  &.is-accent {
    background: var(--color-accent-700, #8c491a);
    border-color: var(--color-accent-700, #8c491a);

    .stat-label {
      color: var(--color-accent-200, #ffe1d0);
    }

    .stat-value {
      color: var(--color-bg, #f5ead8);
    }
  }
}

.tab-bar {
  display: flex;
  gap: 6px;
}

.pog-main-tabs {
  margin-bottom: 10px;
  max-width: 320px;
}

.tab-btn {
  flex: 1;
  border: 1px solid var(--color-accent-2-400, #aebf92);
  border-radius: 999px;
  background: transparent;
  padding: 6px 8px;
  font: inherit;
  font-size: 12px;
  font-weight: 700;
  color: var(--color-accent-2-800, #3d472b);
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;

  &.is-active {
    background: var(--color-accent-2-700, #56633f);
    border-color: var(--color-accent-2-700, #56633f);
    color: var(--color-bg, #f5ead8);
  }

  &:not(.is-active):hover {
    background: var(--color-accent-2-100, #f0fae1);
  }
}

.lucky-panel {
  background: var(--color-neutral-100, #f9f4ed);
  border: 1px solid var(--color-neutral-300, #dcd3c4);
  border-radius: var(--radius-lg, 28px);
  padding: 18px;
  box-shadow: var(--shadow-md);
}

.bet-row {
  margin-bottom: 16px;
  padding-bottom: 16px;
  border-bottom: 1px dashed var(--color-neutral-400, #c0b6a5);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.frame-headline {
  background: var(--color-neutral-900, #2e2b25);
  color: var(--color-bg, #f5ead8);
  border-radius: 999px;
  padding: 9px 18px;
  text-align: center;
  font-family: var(--font-heading, serif);
  font-weight: 900;
  font-size: 14px;
  margin-bottom: 16px;

  &.is-accent {
    background: var(--color-accent-700, #8c491a);
  }

  &.is-neutral {
    background: var(--color-neutral-800, #474238);
  }
}

.frame-border {
  border: 6px solid var(--color-accent-600, #b2622d);
  border-radius: var(--radius-sm, 8px);
  padding: 14px;
  background: #544c4b;
  box-shadow: var(--shadow-md);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.trick,
.hand {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.trick span,
.hand button,
.deal {
  border-radius: var(--radius-md, 16px);
  min-width: 64px;
  padding: 14px;
  font-family: var(--font-heading, serif);
  font-size: 24px;
}

.trick span {
  background: var(--color-neutral-100, #f9f4ed);
  border: 2px solid var(--color-accent-400, #d99361);
}

.hand button,
.deal {
  border: 0;
  background: var(--color-accent, #b2622d);
  color: var(--color-bg, #f5ead8);
  cursor: pointer;

  &:disabled {
    opacity: 0.45;
    cursor: default;
  }
}

.deal {
  align-self: flex-start;
  font-size: 16px;
  padding: 10px 18px;
}

.frame-progress {
  margin-top: 4px;

  .progress-row {
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    letter-spacing: 0.08em;
    color: var(--color-neutral-600, #82796a);
    margin-bottom: 6px;
  }

  .progress-track {
    height: 9px;
    border-radius: 999px;
    background: var(--color-neutral-300, #dcd3c4);
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: var(--color-accent-600, #b2622d);
    transition: width 0.3s ease;
  }
}

.lucky-rules {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.rule-section {
  background: var(--color-neutral-100, #f9f4ed);
  border: 1px solid var(--color-neutral-300, #dcd3c4);
  border-radius: var(--radius-lg, 28px);
  padding: 10px 16px;

  h3 {
    margin: 0 0 6px;
    font-size: 16px;
    color: var(--color-accent-800, #643312);
  }
}

.rule-list {
  margin: 0;
  padding-left: 18px;
  display: flex;
  flex-direction: column;
  gap: 5px;
  font-size: 13px;
  line-height: 1.6;
  color: var(--color-neutral-800, #474238);
}

.side-note {
  margin: 0;
  font-size: 12px;
  line-height: 1.6;
  color: var(--color-neutral-700, #645c50);
}
</style>
