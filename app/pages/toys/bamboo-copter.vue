<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, watch } from 'vue'
import BetPanel from '~/components/toys/BetPanel.vue'
import BlockedModal from '~/components/toys/BlockedModal.vue'
import ResultModal from '~/components/toys/ResultModal.vue'
import ToyGameHeader from '~/components/toys/ToyGameHeader.vue'
import { useToyBamboo } from '~/composables/useToyBamboo'
import type { ToyBambooTarget } from '~/services/api'

/** 版面套用抽抽樂 (lucky-draw.vue) 的視覺骨架（統計列＋分頁＋票框卡片），
 *  選門檻/轉出去/結算行為維持 useToyBamboo 既有邏輯不變，這款單注定輸贏，沒有連乘機制。 */
const round = useToyBamboo()
const targets: Array<{ id: ToyBambooTarget; label: string; odds: string }> = [
  { id: 'm10', label: '大於10米', odds: '×1.1' },
  { id: 'm20', label: '大於20米', odds: '×1.4' },
  { id: 'm30', label: '大於30米', odds: '×2' },
  { id: 'm40', label: '大於40米', odds: '×4' },
  { id: 'm50', label: '大於50米', odds: '×15' }
]
/** 高度分布區段權重，對應後端 BAMBOO_BANDS（server/services/game/toys/catalog.ts），純顯示用 */
const heightBands: Array<{ range: string; weight: number }> = [
  { range: '0–9m', weight: 1000 },
  { range: '10–19m', weight: 2000 },
  { range: '20–29m', weight: 2500 },
  { range: '30–39m', weight: 2500 },
  { range: '40–49m', weight: 1500 },
  { range: '50–69m', weight: 500 }
]
const heightBandTotal = heightBands.reduce((sum, band) => sum + band.weight, 0)

const chips = computed(() => round.state.catalog?.betChips ?? [])
const blockedItem = computed(() =>
  round.state.catalog?.items.find((item) => item.slug === round.state.blockedGameKey) ?? null
)
/** .sky 從原本 220px 縮到 140px（配合彈窗不捲動），位移比例跟著等比縮小，飛行動畫視覺不變 */
const lift = computed(() => `${Math.round((round.state.shownHeight / 69) * 115)}px`)
type MainTab = 'game' | 'rules'
const ui = reactive({ mainTab: 'game' as MainTab, resultReady: false, spinning: false })

/** 點「開始轉」後讓 copter 播 3 秒左右飛的旋轉動畫，純視覺效果，跟後端 flipMs 的實際結算時間無關 */
let spinTimer: ReturnType<typeof setTimeout> | null = null

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

const isLocked = computed(() =>
  round.state.settling || round.state.status === 'playing' || (round.state.revealed && !ui.resultReady)
)
const money = (value: number) => Math.floor(value).toLocaleString('zh-TW')
const targetLabel = computed(() => targets.find(item => item.id === round.state.target)?.label ?? '—')
/** 未開牌前顯示 —，開牌後才顯示本局實際高度（跟動畫用的 shownHeight 分開，不要混用） */
const heightLabel = computed(() => (round.state.height != null ? `${round.state.height}m` : '—'))

const modalVisible = computed(() => round.state.revealed && round.state.height != null && ui.resultReady)
const modalTitle = computed(() => (round.state.hit ? `飛到 ${round.state.height}m` : `只到 ${round.state.height}m`))
const modalDetail = computed(() => {
  if (round.state.hit) return `已寫入 F 幣 ${round.state.reward.toLocaleString('zh-TW')}（×${round.state.multiplier}）`
  return '沒達標，F 幣不加帳。'
})

/** 這款沒有連乘／彩池，frame-headline 只顯示目前狀態文字，不放 frame-progress 進度條 */
const headline = computed(() => {
  const s = round.state
  if (s.blocked) return '其他玩具還有未領金額，先處理那一款'
  if (s.settling || s.status === 'playing') return '起飛中…'
  if (s.revealed && s.height != null) return s.hit ? `飛到 ${s.height}m，達標拿賠率` : '沒達標，達標門檻才有賠率'
  return '選門檻，看能飛多高'
})
const headlineTone = computed(() => {
  const s = round.state
  if (s.blocked) return 'is-neutral'
  if (s.revealed && s.height != null) return s.hit ? 'is-accent' : 'is-neutral'
  return ''
})

const click = {
  setMainTab: (tab: MainTab) => { ui.mainTab = tab },
  launch: () => {
    ui.spinning = true
    if (spinTimer) clearTimeout(spinTimer)
    spinTimer = setTimeout(() => {
      ui.spinning = false
      spinTimer = null
    }, 3000)
    round.actions.launch()
  }
}

onMounted(() => {
  void round.actions.load()
})
onBeforeUnmount(() => {
  round.stopReveal()
  if (resultDelayTimer) clearTimeout(resultDelayTimer)
  if (spinTimer) clearTimeout(spinTimer)
})
</script>

<template>
  <main class="theme-taiwan-lottery bamboo">
    <!-- <ToyGameHeader :balance="round.state.balance" /> -->
    <section class="bamboo-body">
      <p v-if="round.state.catalogError" class="bamboo-error">{{ round.state.catalogError }}</p>
      <p v-else-if="round.state.error" class="bamboo-error">{{ round.state.error }}</p>
      <BlockedModal :visible="round.state.blocked" :item="blockedItem" />

      <div class="lucky-stats">
        <div class="stat-card is-dark">
          <div class="stat-label">F 幣餘額</div>
          <div class="stat-value">{{ money(round.state.balance) }}</div>
        </div>
        <div class="stat-card is-accent">
          <div class="stat-label">我方門檻</div>
          <div class="stat-value">{{ targetLabel }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">本局高度</div>
          <div class="stat-value">{{ heightLabel }}</div>
        </div>
      </div>

      <div class="tab-bar bamboo-main-tabs">
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
          <div class="sky">
            <span class="copter-wrap" :style="{ transform: `translateY(-${lift})` }">
              <img class="copter" :class="{ 'is-spinning': ui.spinning }"
                :src="ui.spinning ? '/images/toys/firefly/firefly_fly.png' : '/images/toys/firefly/firefly.png'"
                alt="竹蜻蜓">
            </span>
            <strong v-if="round.state.shownHeight > 0">{{ round.state.shownHeight }}m</strong>
          </div>
        </div>

        <div class="targets">
          <button v-for="item in targets" :key="item.id" type="button"
            :class="{ 'is-on': round.state.target === item.id }"
            :disabled="round.state.status === 'playing' || round.state.settling"
            @click="round.actions.chooseTarget(item.id)">
            {{ item.label }} | {{ item.odds }}
          </button>
        </div>

        <div class="launch-row">
          <button type="button" class="launch" :disabled="isLocked || round.state.blocked" @click="click.launch">
            開始轉
          </button>
          <button v-if="round.state.status === 'result'" type="button" class="launch is-replay"
            :disabled="isLocked || round.state.blocked" @click="round.actions.playAgain">
            再玩一次
          </button>
        </div>
      </div>

      <div v-else class="lucky-rules">
        <section class="rule-section">
          <h3>高度分布機率</h3>
          <ul class="band-list">
            <li v-for="band in heightBands" :key="band.range">
              <span class="band-range">{{ band.range }}</span>
              <span class="band-bar"><span class="band-bar-fill"
                  :style="{ width: `${(band.weight / heightBandTotal) * 100}%` }" /></span>
              <span class="band-pct">{{ Math.round((band.weight / heightBandTotal) * 100) }}%</span>
            </li>
          </ul>
        </section>

        <section class="rule-section">
          <h3>門檻倍率</h3>
          <ul class="tier-list">
            <li v-for="item in targets" :key="item.id">
              <span class="tier-badge">{{ item.id.replace('m', '') }}</span>
              <span class="tier-mult">{{ item.label }} 達標</span>
              <span class="tier-odds">{{ item.odds }}</span>
            </li>
          </ul>
        </section>

        <section class="rule-section">
          <h3>頭家的話</h3>
          <p class="side-note">未滿十八歲不得購買。理性投注，量力而為。</p>
        </section>
      </div>

      <ResultModal :visible="modalVisible" :title="modalTitle" :detail="modalDetail" :can-claim="false"
        :can-continue="false" :can-replay="round.state.status !== 'playing'" :busy="round.state.settling"
        @claim="() => { }" @continue="() => { }" @replay="round.actions.playAgain" />
    </section>
  </main>
</template>

<style scoped lang="scss">
.bamboo-body {
  max-width: 720px;
  margin: 0 auto;
  padding: 20px 16px 24px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.bamboo-error {
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

.bamboo-main-tabs {
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

.sky {
  height: 140px;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: 12px;
  border-radius: var(--radius-md);
  background: var(--color-neutral-100);

  strong {
    font-family: var(--font-heading, serif);
    font-weight: 900;
    color: var(--color-accent-800, #643312);
  }
}

.copter-wrap {
  display: inline-block;
  transition: transform 0.6s ease;
}

.copter {
  height: 48px;
  object-fit: contain;

  &.is-spinning {
    animation: copterSpin 3s ease-in-out;
  }
}

@keyframes copterSpin {
  0% {
    transform: translateX(0);
  }

  20% {
    transform: translateX(-18px);
  }

  40% {
    transform: translateX(16px);
  }

  60% {
    transform: translateX(-14px);
  }

  80% {
    transform: translateX(12px);
  }

  100% {
    transform: translateX(0);
  }
}

.targets {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
  margin-top: 16px;

  button {
    border: 2px solid var(--color-accent-400);
    border-radius: 999px;
    padding: 8px 12px;
    background: transparent;
    font: inherit;
    cursor: pointer;

    &.is-on {
      background: var(--color-accent);
      color: var(--color-bg);
    }

    &:disabled {
      cursor: not-allowed;
      opacity: 0.6;
    }
  }
}

.launch-row {
  display: flex;
  justify-content: center;
  width: 100%;
  gap: 10px;
  margin-top: 16px;
}

.launch {
  border: 0;
  border-radius: 999px;
  padding: 10px 18px;
  background: var(--color-accent);
  color: var(--color-bg);
  font-weight: 700;
  cursor: pointer;

  &.is-replay {
    background: var(--color-accent-2-700, #56633f);
  }

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

.band-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;

  li {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 13px;
  }
}

.band-range {
  flex: none;
  width: 64px;
  font-weight: 700;
  color: var(--color-neutral-800, #474238);
}

.band-bar {
  flex: 1;
  height: 9px;
  border-radius: 999px;
  background: var(--color-neutral-300, #dcd3c4);
  overflow: hidden;
}

.band-bar-fill {
  display: block;
  height: 100%;
  background: var(--color-accent-600, #b2622d);
}

.band-pct {
  flex: none;
  width: 40px;
  text-align: right;
  font-weight: 700;
  color: var(--color-accent-800, #643312);
}

.tier-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 5px;

  li {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 13px;
  }
}

.tier-badge {
  flex: none;
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  border-radius: 999px;
  border: 2px solid var(--color-accent-400, #d99a63);
  background: var(--color-accent-200, #ffe1d0);
  color: var(--color-accent-800, #643312);
  font-family: var(--font-heading, serif);
  font-weight: 900;
  font-size: 11px;
}

.tier-mult {
  flex: 1;
  font-weight: 700;
}

.tier-odds {
  font-size: 12px;
  font-weight: 700;
  color: var(--color-accent-700, #8c491a);
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
