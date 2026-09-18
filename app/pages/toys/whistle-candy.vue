<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, watch } from 'vue'
import BetPanel from '~/components/toys/BetPanel.vue'
import BlockedModal from '~/components/toys/BlockedModal.vue'
import ResultModal from '~/components/toys/ResultModal.vue'
import ToyGameHeader from '~/components/toys/ToyGameHeader.vue'
import { useToyWhistle } from '~/composables/useToyWhistle'
import type { ToyWhistleChoice } from '~/services/api'

/** 版面套用 lucky-draw.vue 的視覺骨架（統計列＋分頁＋frame 卡片），
 *  下注/開局/倒數等既有邏輯與行為完全不變，只調整 template 外殼與樣式。
 *  這款單注定輸贏，沒有彩池／連乘，所以沒有 frame-progress 進度條。 */
const round = useToyWhistle()

const choices: Array<{ id: ToyWhistleChoice; label: string }> = [
  { id: 'short', label: '短' },
  { id: 'mid', label: '中' },
  { id: 'long', label: '長' }
]
const labelOf = (id: ToyWhistleChoice | null) => choices.find((item) => item.id === id)?.label ?? '·'
const chips = computed(() => round.state.catalog?.betChips ?? [])
const blockedItem = computed(() =>
  round.state.catalog?.items.find((item) => item.slug === round.state.blockedGameKey) ?? null
)

const money = (value: number) => Math.floor(value).toLocaleString('zh-TW')

/** 未開牌前顯示 —，開牌後轉成中文結果 */
const outcomeLabel = computed(() => {
  if (!round.state.revealed || round.state.outcome == null) return '—'
  if (round.state.outcome === 'win') return '贏'
  if (round.state.outcome === 'tie') return '平手'
  return '輸'
})

type MainTab = 'game' | 'rules'
const ui = reactive({ mainTab: 'game' as MainTab, resultReady: false })

/** 比一輪結果先讓玩家看 1 秒，才解鎖操作／彈出結果視窗，避免翻面到彈窗之間的空檔被搶點 */
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

const headline = computed(() => {
  const s = round.state
  if (s.blocked) return '其他玩具還有未領金額，先處理那一款'
  if (isLocked.value) return '比賽中…'
  if (s.revealed) return '短勝長・長勝中・中勝短'
  return '選短中長，看誰壓過誰'
})
const headlineTone = computed(() => {
  const s = round.state
  if (s.blocked) return 'is-neutral'
  if (s.revealed && s.outcome === 'win') return 'is-accent'
  return ''
})

const modalVisible = computed(() => round.state.revealed && round.state.outcome != null && ui.resultReady)
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
  <main class="theme-taiwan-lottery candy">
    <!-- <ToyGameHeader :balance="round.state.balance" /> -->
    <section class="candy-body">
      <p v-if="round.state.catalogError" class="candy-error">{{ round.state.catalogError }}</p>
      <p v-else-if="round.state.error" class="candy-error">{{ round.state.error }}</p>
      <BlockedModal :visible="round.state.blocked" :item="blockedItem" />

      <div class="lucky-stats">
        <div class="stat-card is-dark">
          <div class="stat-label">F 幣餘額</div>
          <div class="stat-value">{{ money(round.state.balance) }}</div>
        </div>
        <div class="stat-card is-accent">
          <div class="stat-label">我方選擇</div>
          <div class="stat-value">{{ labelOf(round.state.choice) }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">本局結果</div>
          <div class="stat-value">{{ outcomeLabel }}</div>
        </div>
      </div>

      <div class="tab-bar lucky-main-tabs">
        <button type="button" class="tab-btn" :class="{ 'is-active': ui.mainTab === 'game' }"
          @click="click.setMainTab('game')">遊戲</button>
        <button type="button" class="tab-btn" :class="{ 'is-active': ui.mainTab === 'rules' }"
          @click="click.setMainTab('rules')">規則</button>
      </div>

      <div v-if="ui.mainTab === 'game'" class="lucky-panel">
        <div class="bet-row">
          <BetPanel :chips="chips" :bet="round.state.bet" :custom-bet="round.state.customBet" :disabled="isLocked"
            @choose="round.actions.chooseChip" @update:custom-bet="round.state.customBet = $event"
            @apply-custom="round.actions.applyCustom" />
        </div>

        <div class="frame-headline" :class="headlineTone">{{ headline }}</div>

        <div class="frame-border">
          <p class="count">{{ round.state.countdown ?? (round.state.revealed ? labelOf(round.state.npc) : '哨') }}</p>
          <p v-if="round.state.revealed" class="reveal-line">你 {{ labelOf(round.state.player) }} · 對方 {{ labelOf(round.state.npc) }}</p>
          <div class="history">
            <span v-for="(item, index) in round.state.history" :key="index">{{ labelOf(item) }}</span>
            <span v-if="round.state.history.length === 0">還沒比過</span>
          </div>
        </div>

        <div class="choices">
          <button v-for="item in choices" :key="item.id" type="button" :class="{ 'is-on': round.state.choice === item.id }"
            :disabled="isLocked" @click="round.actions.choose(item.id)">
            {{ item.label }}
          </button>
        </div>

        <button type="button" class="go" :disabled="isLocked || round.state.blocked" @click="round.actions.play">
          比一輪
        </button>
      </div>

      <div v-else class="lucky-rules">
        <section class="rule-section">
          <h3>誰壓過誰</h3>
          <ul class="rule-list">
            <li>短壓長、長壓中、中壓短，猜對就贏。</li>
            <li>雙方選一樣的長度算平手，退回原注（等同 ×1）。</li>
            <li>贏得這注 ×1.9；輸的話這注歸零（×0）。</li>
            <li>倒數 3、2、1 只是效果演出，結果在下注當下就決定好了。</li>
          </ul>
        </section>

        <section class="rule-section">
          <h3>頭家的話</h3>
          <p class="side-note">未滿十八歲不得購買。理性投注，量力而為。</p>
        </section>
      </div>

      <ResultModal :visible="modalVisible" :title="modalTitle" :detail="modalDetail" :can-claim="false"
        :can-continue="false" :can-replay="round.state.status !== 'playing'" :busy="round.state.settling"
        @claim="() => {}" @continue="() => {}" @replay="round.actions.playAgain" />
    </section>
  </main>
</template>

<style scoped lang="scss">
.candy-body {
  max-width: 720px;
  margin: 0 auto;
  padding: 20px 16px 24px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.candy-error {
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

.lucky-main-tabs {
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
  padding: 20px 16px;
  background: #544c4b;
  box-shadow: var(--shadow-md);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;

  .count {
    margin: 0;
    font-family: var(--font-heading, serif);
    font-weight: 900;
    font-size: 56px;
    line-height: 1;
    color: var(--color-bg, #f5ead8);
  }

  .reveal-line {
    margin: 0;
    font-size: 13px;
    color: var(--color-accent-200, #ffe1d0);
  }

  .history {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 6px;

    span {
      border-radius: 999px;
      padding: 4px 10px;
      font-size: 12px;
      font-weight: 700;
      background: var(--color-accent-2-200, #dcefc0);
      color: var(--color-accent-2-800, #3d472b);
    }
  }
}

.choices {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;

  button {
    border-radius: 999px;
    padding: 8px 18px;
    font-weight: 700;
    border: 0;
    background: var(--color-accent, #b2622d);
    color: var(--color-bg, #f5ead8);
    cursor: pointer;
    transition: filter 0.15s ease;

    &:hover:not(:disabled) {
      filter: brightness(1.06);
    }

    &:disabled {
      opacity: 0.45;
      cursor: default;
    }

    &.is-on {
      outline: 3px solid var(--color-accent-2-800, #3d472b);
    }
  }
}

.go {
  width: 100%;
  border: 0;
  border-radius: 999px;
  padding: 10px 14px;
  font-weight: 700;
  background: var(--color-accent-700, #8c491a);
  color: var(--color-bg, #f5ead8);
  cursor: pointer;

  &:disabled {
    opacity: 0.45;
    cursor: default;
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
