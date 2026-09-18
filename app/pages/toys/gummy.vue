<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, watch } from 'vue'
import BetPanel from '~/components/toys/BetPanel.vue'
import BlockedModal from '~/components/toys/BlockedModal.vue'
import ResultModal from '~/components/toys/ResultModal.vue'
import { useToyGummy } from '~/composables/useToyGummy'
import type { ToyGummyColor } from '~/services/api'

/** 版面比照 app/pages/toys/lucky-draw.vue 的統一視覺骨架（統計卡／頂層分頁／深色票框／連勝進度條），
 *  下注與猜色機制維持 useToyGummy／ResultModal 既有行為不變。 */
const round = useToyGummy()

const colors: Array<{ id: ToyGummyColor; label: string }> = [
  { id: 'red', label: '紅' },
  { id: 'yellow', label: '黃' },
  { id: 'blue', label: '藍' },
  { id: 'green', label: '綠' }
]
const labelOf = (id: ToyGummyColor) => colors.find((item) => item.id === id)?.label ?? id

const chips = computed(() => round.state.catalog?.betChips ?? [])
const blockedItem = computed(() =>
  round.state.catalog?.items.find((item) => item.slug === round.state.blockedGameKey) ?? null
)

type MainTab = 'game' | 'rules'
const ui = reactive({ mainTab: 'game' as MainTab, resultReady: false })

/** 猜色結果先讓玩家看 1 秒，才解鎖操作／彈出結果視窗，避免翻面到彈窗之間的空檔被搶點 */
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

const recent = computed(() => {
  const slots: Array<ToyGummyColor | null> = [null, null, null, null]
  round.state.history.slice(-4).forEach((color, index) => {
    slots[index] = color
  })
  return slots
})

/** 連勝倍率表，對應後端 server/services/game/toys/cards.ts 的 CARD_STREAK（gummy 與 cards 共用同一份常數，
 *  這裡只是顯示用的複製值，不影響實際結算邏輯） */
const STREAK_MULTIPLIERS = [1.8, 3, 5, 8, 15] as const
const MAX_STREAK = STREAK_MULTIPLIERS.length

const money = (value: number) => Math.floor(value).toLocaleString('zh-TW')
const multLabel = (value: number) => {
  const rounded = Math.round(value * 100) / 100
  return `×${Number.isInteger(rounded) ? rounded : rounded.toFixed(2).replace(/0$/, '')}`
}

type Tone = { bg: string; fg: string; bd: string }
/** 沿用 lucky-draw TIER_TONE 的 small/mid/big/special/super 五階配色語彙，對應連勝第 1~5 次 */
const STREAK_TONES: Tone[] = [
  { bg: 'var(--color-accent-2-200)', fg: 'var(--color-accent-2-800)', bd: 'var(--color-accent-2-400)' },
  { bg: 'var(--color-accent-2-400)', fg: 'var(--color-accent-2-800)', bd: 'var(--color-accent-2-600, var(--color-accent-2-400))' },
  { bg: 'var(--color-accent-300)', fg: 'var(--color-accent-800)', bd: 'var(--color-accent-500)' },
  { bg: 'var(--color-accent-500)', fg: 'var(--color-neutral-900)', bd: 'var(--color-accent-700)' },
  { bg: 'var(--color-accent-700)', fg: 'var(--color-bg)', bd: 'var(--color-accent-900, var(--color-accent-700))' }
]

const streakLabel = computed(() => (round.state.streak > 0 ? `第 ${round.state.streak} 勝　${multLabel(round.state.multiplier)}` : '—'))
const progress = computed(() => `${Math.min(100, (round.state.streak / MAX_STREAK) * 100)}%`)

const headline = computed(() => {
  const s = round.state
  if (s.blockedGameKey) return '其他玩具還有未領金額，先處理那一款'
  if (s.claimed && s.revealed) return '已經領取，可以再開一局'
  if (s.settling || s.status === 'playing') return '猜色中…'
  if (s.canGuess) return '猜對顏色，連勝加倍'
  if (s.revealed && s.correct != null) {
    if (s.correct === false) return '猜錯了，這注歸零'
    return '連勝已到頂，快去收下'
  }
  if (s.pot > 0) return '還有未領彩池，先處理這一注'
  return '押注後按開始，猜猜下一顆是什麼顏色'
})
const headlineTone = computed(() => {
  const s = round.state
  if (s.blockedGameKey) return 'is-neutral'
  if (s.revealed && s.correct === false) return 'is-neutral'
  if (s.revealed && s.correct === true && !s.canGuess && s.pot > 0) return 'is-accent'
  return ''
})

/** 猜對且還能繼續猜（canGuess）時不彈窗，讓玩家直接點下一個顏色；只有猜錯或連勝到頂
 *  （被迫收下）才彈出結果視窗，比照 lucky-draw 的「顯示 1 秒才彈出」節奏。
 *  correct 在「重新整理/切換玩具後回來繼續」時，後端 snapshot 一律回傳 null，只看
 *  correct!=null 會讓已經有未領彩池、可以領取的畫面永遠彈不出來，要用 canClaim 一起判斷。 */
const modalVisible = computed(() =>
  round.state.revealed && round.state.status !== 'playing' && !round.state.canGuess && ui.resultReady
  && (round.state.correct != null || round.state.canClaim)
)
const modalTitle = computed(() => {
  if (round.state.claimed) return '已領取'
  if (round.state.correct === false) return '猜錯了'
  return `連勝 ${round.state.streak}`
})
const modalDetail = computed(() => {
  if (round.state.blockedGameKey) return '其他玩具還有未領金額，先回那一款處理。'
  if (round.state.claimed) return `已寫入 F 幣 ${round.state.reward.toLocaleString('zh-TW')}`
  if (round.state.correct === false) return '本輪結束，未領金額已歸零。'
  return `這一顆是${round.state.color ? labelOf(round.state.color) : ''}，倍率 ×${round.state.multiplier}`
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
  <main class="theme-taiwan-lottery gummy">
    <!-- <ToyGameHeader :balance="round.state.balance" /> -->
    <section class="gummy-body">
      <p v-if="round.state.catalogError" class="gummy-error">{{ round.state.catalogError }}</p>
      <p v-else-if="round.state.error" class="gummy-error">{{ round.state.error }}</p>
      <BlockedModal :visible="!!round.state.blockedGameKey" :item="blockedItem" />

      <div class="lucky-stats">
        <div class="stat-card is-dark">
          <div class="stat-label">未領彩池</div>
          <div class="stat-value">F 幣 {{ money(round.state.pot) }}</div>
        </div>
        <div class="stat-card is-accent">
          <div class="stat-label">目前連勝</div>
          <div class="stat-value">{{ streakLabel }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">F 幣餘額</div>
          <div class="stat-value">{{ money(round.state.balance) }}</div>
        </div>
      </div>

      <div class="tab-bar gummy-main-tabs">
        <button type="button" class="tab-btn" :class="{ 'is-active': ui.mainTab === 'game' }"
          @click="click.setMainTab('game')">遊戲</button>
        <button type="button" class="tab-btn" :class="{ 'is-active': ui.mainTab === 'rules' }"
          @click="click.setMainTab('rules')">規則</button>
      </div>

      <div v-if="ui.mainTab === 'game'" class="lucky-panel">
        <div class="bet-row">
          <BetPanel :chips="chips" :bet="round.state.bet" :custom-bet="round.state.customBet"
            :disabled="isLocked || round.state.canGuess || round.state.pot > 0"
            @choose="round.actions.chooseChip" @update:custom-bet="round.state.customBet = $event"
            @apply-custom="round.actions.applyCustom" />
        </div>

        <div class="frame-headline" :class="headlineTone">{{ headline }}</div>

        <div class="frame-border">
          <div class="trail">
            <span v-for="(color, index) in recent" :key="index" class="candy" :class="color ? `is-${color}` : 'is-empty'">
              {{ color ? labelOf(color) : '·' }}
            </span>
          </div>
          <p v-if="round.state.status === 'playing'" class="gummy-hint">
            下一顆是 {{ round.state.color ? labelOf(round.state.color) : '…' }}
          </p>

          <div class="choices">
            <button v-for="item in colors" :key="item.id" type="button" class="choice" :class="`is-${item.id}`"
              :disabled="isLocked || !round.state.canGuess" @click="round.actions.guess(item.id)">
              {{ item.label }}
            </button>
          </div>

          <button v-if="!round.state.canGuess && round.state.pot <= 0" type="button" class="deal"
            :disabled="isLocked || round.state.blockedGameKey != null" @click="round.actions.start">
            開始
          </button>
        </div>

        <div class="frame-progress">
          <div class="progress-row">
            <span>連勝進度</span>
            <span>上限 {{ MAX_STREAK }} 勝（每猜對一次倍率升級）</span>
          </div>
          <div class="progress-track">
            <div class="progress-fill" :style="{ width: progress }" />
          </div>
        </div>
      </div>

      <div v-else class="lucky-rules">
        <section class="rule-section">
          <h3>連勝倍率表</h3>
          <ul class="tier-list">
            <li v-for="(mult, index) in STREAK_MULTIPLIERS" :key="index">
              <span class="tier-badge"
                :style="{ background: STREAK_TONES[index]?.bg, color: STREAK_TONES[index]?.fg, borderColor: STREAK_TONES[index]?.bd }">
                {{ index + 1 }}
              </span>
              <span class="tier-mult">第 {{ index + 1 }} 勝　{{ multLabel(mult) }}</span>
              <span v-if="index === STREAK_MULTIPLIERS.length - 1" class="tier-odds">強制收下</span>
            </li>
          </ul>
        </section>

        <section class="rule-section">
          <h3>規則</h3>
          <ul class="rule-list">
            <li>四色機率相同，各約 25%。</li>
            <li>猜對顏色，連勝倍率往上一階，最高第 5 次 ×15。</li>
            <li>連勝滿 {{ MAX_STREAK }} 次強制收下，不能再猜。</li>
            <li>猜錯本注歸零，見好就收才是本事。</li>
          </ul>
        </section>

        <section class="rule-section">
          <h3>頭家的話</h3>
          <p class="side-note">未滿十八歲不得購買。理性投注，量力而為。</p>
        </section>
      </div>

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
  padding: 20px 16px 24px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.gummy-error {
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

.gummy-main-tabs {
  margin-bottom: 10px;
  max-width: 320px;
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
  gap: 14px;

  .trail,
  .choices {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    justify-content: center;
  }

  .candy,
  .choice,
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
    background: rgba(245, 234, 216, 0.14);
    color: var(--color-bg, #f5ead8);
  }

  .gummy-hint {
    margin: 0;
    font-size: 12px;
    color: var(--color-bg, #f5ead8);
    opacity: 0.85;
  }

  .is-red { background: #c4503a; color: #f5ead8; }
  .is-yellow { background: #d6a03a; color: #2e2b25; }
  .is-blue { background: #3d6f8f; color: #f5ead8; }
  .is-green { background: #5d7a45; color: #f5ead8; }
  .is-empty { color: var(--color-accent-300, #ffc6a5); }

  .choice,
  .deal {
    cursor: pointer;

    &:disabled {
      opacity: 0.45;
      cursor: default;
    }
  }

  .deal {
    background: var(--color-accent-500, #e08a4a);
    color: var(--color-neutral-900, #2e2b25);
  }
}

.frame-progress {
  margin-top: 16px;

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

.tab-bar {
  display: flex;
  gap: 6px;
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
  border: 2px solid;
  font-family: var(--font-heading, serif);
  font-weight: 900;
  font-size: 12px;
}

.tier-mult {
  flex: 1;
  font-weight: 700;
}

.tier-odds {
  font-size: 11px;
  color: var(--color-neutral-600, #82796a);
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
