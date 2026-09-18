<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, watch } from 'vue'
import BetPanel from '~/components/toys/BetPanel.vue'
import BlockedModal from '~/components/toys/BlockedModal.vue'
import ResultModal from '~/components/toys/ResultModal.vue'
import ToyGameHeader from '~/components/toys/ToyGameHeader.vue'
import { useToyBigPig } from '~/composables/useToyBigPig'

/** 版面套用抽抽樂 (lucky-draw.vue) 的視覺骨架（統計列＋分頁＋票框卡片），
 *  下注/擲骰/結算行為維持 useToyBigPig 既有邏輯不變，這款單注定輸贏，沒有連乘機制。 */
const round = useToyBigPig()
const chips = computed(() => round.state.catalog?.betChips ?? [])
const blockedItem = computed(() =>
  round.state.catalog?.items.find((item) => item.slug === round.state.blockedGameKey) ?? null
)
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
type MainTab = 'game' | 'rules'
const ui = reactive({ mainTab: 'game' as MainTab, resultReady: false })

/** 開牌結果先讓玩家看 1 秒，才彈出結果視窗；這段期間鎖住操作 */
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

const modalVisible = computed(() => round.state.revealed && round.state.kind != null && ui.resultReady)
const modalTitle = computed(() => titles[round.state.kind ?? ''] ?? '結果')
const modalDetail = computed(() => {
  if (round.state.kind === 'tie') return `注額 ${round.state.reward.toLocaleString('zh-TW')} 已退回。`
  if (round.state.reward > 0) return `已寫入 F 幣 ${round.state.reward.toLocaleString('zh-TW')}（×${round.state.multiplier}）`
  return '這局不加帳，注額也不退。'
})

const isLocked = computed(() =>
  round.state.settling || round.state.status === 'playing' || (round.state.revealed && !ui.resultReady)
)
const money = (value: number) => Math.floor(value).toLocaleString('zh-TW')
/** 未開牌前顯示 —，開牌後顯示中文牌型（沒有 reward id，不套 tier-badge） */
const resultLabel = computed(() => (round.state.revealed && round.state.kind ? titles[round.state.kind] ?? '—' : '—'))

/** 這款沒有連乘／彩池，frame-headline 只顯示目前狀態文字，不放 frame-progress 進度條 */
const headline = computed(() => {
  const s = round.state
  if (s.blocked) return '其他玩具還沒結束，這一款先不能開'
  if (s.settling || s.status === 'playing') return '擲骰中…'
  if (s.revealed && s.kind) return '單局定輸贏，再擲骰重新開始'
  return '比點數，看誰大'
})
const headlineTone = computed(() => {
  const s = round.state
  if (s.blocked) return 'is-neutral'
  if (s.revealed && (s.kind === 'lose' || s.kind === 'tiny')) return 'is-neutral'
  if (s.revealed && (s.kind === 'gold' || s.kind === 'pair' || s.kind === 'win')) return 'is-accent'
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
  <main class="theme-taiwan-lottery pig">
    <!-- <ToyGameHeader :balance="round.state.balance" /> -->
    <section class="pig-body">
      <p v-if="round.state.catalogError" class="pig-error">{{ round.state.catalogError }}</p>
      <p v-else-if="round.state.error" class="pig-error">{{ round.state.error }}</p>
      <BlockedModal :visible="round.state.blocked" :item="blockedItem" />

      <div class="lucky-stats">
        <div class="stat-card is-dark">
          <div class="stat-label">F 幣餘額</div>
          <div class="stat-value">{{ money(round.state.balance) }}</div>
        </div>
        <div class="stat-card is-accent">
          <div class="stat-label">本局點數</div>
          <div class="stat-value">{{ faces ? sum(round.state.player) : '—' }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">本局結果</div>
          <div class="stat-value">{{ resultLabel }}</div>
        </div>
      </div>

      <div class="tab-bar pig-main-tabs">
        <button type="button" class="tab-btn" :class="{ 'is-active': ui.mainTab === 'game' }"
          @click="click.setMainTab('game')">遊戲</button>
        <button type="button" class="tab-btn" :class="{ 'is-active': ui.mainTab === 'rules' }"
          @click="click.setMainTab('rules')">規則</button>
      </div>

      <div v-if="ui.mainTab === 'game'" class="lucky-panel">
        <div class="bet-row">
          <BetPanel :chips="chips" :bet="round.state.bet" :custom-bet="round.state.customBet"
            :disabled="isLocked" @choose="round.actions.chooseChip" @update:custom-bet="round.state.customBet = $event"
            @apply-custom="round.actions.applyCustom" />
        </div>

        <div class="frame-headline" :class="headlineTone">{{ headline }}</div>

        <div class="frame-border">
          <div class="table" :class="{ 'is-locked': isLocked }">
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
        </div>

        <button type="button" class="roll" :disabled="isLocked || round.state.blocked" @click="round.actions.roll">
          擲骰
        </button>
      </div>

      <div v-else class="lucky-rules">
        <section class="rule-section">
          <h3>牌型與倍率</h3>
          <ul class="rule-list">
            <li>點數和打平 → 和局，退回原注（等同 ×1）</li>
            <li>擲出 6+6（金豬）且贏 → ×5</li>
            <li>擲出對子（非 6+6）且贏 → ×2.5</li>
            <li>點數和較大（非對子）→ ×1.9</li>
            <li>擲出 1+1（小豬）且輸 → 沒收注額（×0）</li>
            <li>點數和輸給對方 → 沒收注額（×0）</li>
          </ul>
        </section>

        <section class="rule-section">
          <h3>頭家的話</h3>
          <p class="side-note">未滿十八歲不得購買。理性投注，量力而為。</p>
        </section>
      </div>

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
  padding: 20px 16px 24px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.pig-error {
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

.pig-main-tabs {
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
  padding: 14px;
  background: #544c4b;
  box-shadow: var(--shadow-md);
}

.table {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;

  &.is-locked {
    opacity: 0.75;
    pointer-events: none;
  }

  article {
    background: var(--color-neutral-100, #f9f4ed);
    border-radius: var(--radius-md, 16px);
    padding: 12px;
    text-align: center;
  }

  h2 {
    margin: 0 0 8px;
    font-size: 16px;
    font-family: var(--font-heading, serif);
    color: var(--color-accent-800, #643312);
  }
}

.dice {
  display: flex;
  justify-content: center;
  gap: 8px;

  span {
    width: 56px;
    height: 56px;
    display: grid;
    place-items: center;
    border-radius: var(--radius-md);
    border: 2px solid var(--color-accent-400);
    background: var(--color-bg, #f5ead8);
    font-size: 26px;
    font-family: var(--font-heading);
  }

  &.is-rolling span {
    animation: shake 0.6s ease;
  }
}

.roll {
  margin-top: 16px;
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
