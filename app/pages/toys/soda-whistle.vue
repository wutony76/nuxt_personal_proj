<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, watch } from 'vue'
import BetPanel from '~/components/toys/BetPanel.vue'
import BlockedModal from '~/components/toys/BlockedModal.vue'
import ResultModal from '~/components/toys/ResultModal.vue'
import ToyGameHeader from '~/components/toys/ToyGameHeader.vue'
import { useToySoda } from '~/composables/useToySoda'

/** 版面套用抽抽樂 lucky-draw.vue 同一套骨架（統計卡／分頁／票框／進度條），
 *  下注、開局、繼續吹、領取等行為維持 useToySoda／ResultModal 既有機制不變。 */
const round = useToySoda()

/** 對齊 server/services/game/toys/catalog.ts 的 SODA_PRIZES／SODA_BUST_RATES。
 *  前端頁面不 import server 目錄的檔案，這裡複製一份純顯示用常數（規則不可更動、不可憑空編造）。 */
const SODA_PRIZES = [100, 150, 250, 400, 700, 1200] as const
const SODA_BUST_RATES = [0.02, 0.04, 0.07, 0.12, 0.2, 0.3] as const
const STAGE_COUNT = SODA_PRIZES.length

const chips = computed(() => round.state.catalog?.betChips ?? [])
const blockedItem = computed(() =>
  round.state.catalog?.items.find((item) => item.slug === round.state.blockedGameKey) ?? null
)
const height = computed(() => `${Math.min(100, 18 + round.state.step * 14)}%`)

type MainTab = 'game' | 'rules'
const ui = reactive({ mainTab: 'game' as MainTab, resultReady: false })

/** 吹氣結果先讓玩家看 1 秒，才彈出結果視窗；這段期間鎖住操作 */
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
/** 目前倍率＝未領彩池 ÷ 這注原始注額，跟 lucky-draw 的連乘倍率算法一致 */
const multiplier = computed(() => (round.state.pot > 0 && round.state.bet > 0 ? round.state.pot / round.state.bet : 0))

const money = (value: number) => Math.floor(value).toLocaleString('zh-TW')
const multLabel = (value: number) => {
  const rounded = Math.round(value * 100) / 100
  return `×${Number.isInteger(rounded) ? rounded : rounded.toFixed(2).replace(/0$/, '')}`
}

const _handlers = {
  /** @param step 即將吹的次數，從 0 起算 @returns 該次爆掉機率的百分比整數，超過最高階回傳 null */
  bustPercent: (step: number): number | null => {
    const rate = SODA_BUST_RATES[step]
    return rate == null ? null : Math.round(rate * 100)
  },
  /** @param step 第幾次成功，從 0 起算 @returns 該階倍率文案 */
  stageMultLabel: (step: number): string => multLabel((SODA_PRIZES[step] ?? 0) / 100)
}

/** 階梯進度＝(目前已成功階數 + 1) ÷ 總階數，跟 lucky-draw 的連乘進度條同一套視覺 */
const stageProgress = computed(() => `${Math.min(100, ((round.state.step + 1) / STAGE_COUNT) * 100)}%`)
const stageProgressLabel = computed(() => {
  const step = round.state.step
  if (step >= STAGE_COUNT) return `目前第 ${STAGE_COUNT}/${STAGE_COUNT} 階　已達最高階，自動封頂`
  const percent = _handlers.bustPercent(step)
  return `目前第 ${step + 1}/${STAGE_COUNT} 階　下一階爆掉機率 ${percent}%`
})

const headline = computed(() => {
  const s = round.state
  if (s.blockedGameKey) return '其他玩具還有未領金額，先處理那一款'
  if (s.settling || s.status === 'playing') return '吹氣中…'
  if (s.revealed && s.busted) return '吹破了，這注歸零'
  if (s.revealed && s.busted === false) {
    if (!s.canContinue) return '已經吹到最高階，趕緊收落來'
    return `吹到第 ${s.step} 階，要繼續吹嗎？`
  }
  return '越吹越危險，見好就收'
})
const headlineTone = computed(() => {
  const s = round.state
  if (s.blockedGameKey) return 'is-neutral'
  if (s.revealed && s.busted) return 'is-neutral'
  if (s.revealed && s.busted === false && !s.canContinue) return 'is-accent'
  return ''
})

const modalVisible = computed(() =>
  round.state.revealed && round.state.busted != null && round.state.status !== 'playing' && ui.resultReady
)
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
  <main class="theme-taiwan-lottery soda">
    <!-- <ToyGameHeader :balance="round.state.balance" /> -->
    <section class="soda-body">
      <p v-if="round.state.catalogError" class="soda-error">{{ round.state.catalogError }}</p>
      <p v-else-if="round.state.error" class="soda-error">{{ round.state.error }}</p>
      <BlockedModal :visible="!!round.state.blockedGameKey" :item="blockedItem" />

      <div class="lucky-stats">
        <div class="stat-card is-dark">
          <div class="stat-label">未領彩池</div>
          <div class="stat-value">F 幣 {{ money(round.state.pot) }}</div>
        </div>
        <div class="stat-card is-accent">
          <div class="stat-label">目前倍率</div>
          <div class="stat-value">{{ multiplier > 0 ? multLabel(multiplier) : '—' }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">F 幣餘額</div>
          <div class="stat-value">{{ money(round.state.balance) }}</div>
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
          <BetPanel :chips="chips" :bet="round.state.bet" :custom-bet="round.state.customBet"
            :disabled="isLocked || round.state.pot > 0" @choose="round.actions.chooseChip"
            @update:custom-bet="round.state.customBet = $event" @apply-custom="round.actions.applyCustom" />
        </div>

        <div class="frame-headline" :class="headlineTone">{{ headline }}</div>

        <div class="frame-border">
          <div class="whistle-wrap" :class="{ 'is-locked': isLocked }">
            <div class="whistle" :class="{ 'is-blowing': round.state.status === 'playing', 'is-burst': round.state.revealed && round.state.busted }">
              <span class="foam" :style="{ height }" />
            </div>
            <button v-if="round.state.pot <= 0 && !round.state.canClaim" type="button" class="blow"
              :disabled="isLocked || round.state.blockedGameKey != null"
              @click="round.actions.start">
              吹
            </button>
          </div>
        </div>

        <div class="frame-progress">
          <div class="progress-row">
            <span>階梯進度</span>
            <span>{{ stageProgressLabel }}</span>
          </div>
          <div class="progress-track">
            <div class="progress-fill" :style="{ width: stageProgress }" />
          </div>
        </div>
      </div>

      <div v-else class="lucky-rules">
        <section class="rule-section">
          <h3>逐階倍率／爆掉機率</h3>
          <ul class="tier-list">
            <li v-for="n in STAGE_COUNT" :key="n">
              <span class="tier-badge">第{{ n }}階</span>
              <span class="tier-mult">{{ _handlers.stageMultLabel(n - 1) }}</span>
              <span class="tier-odds">下一階爆掉 {{ _handlers.bustPercent(n - 1) }}%</span>
            </li>
          </ul>
        </section>

        <section class="rule-section">
          <h3>規則</h3>
          <ul class="rule-list">
            <li>每吹一階，獎金依倍率提升，但下一階爆掉機率也跟著提高。</li>
            <li>爆掉這注歸零，重新選注再開始。</li>
            <li>吹到第 {{ STAGE_COUNT }} 階為最高階，達最高階自動封頂。</li>
          </ul>
        </section>

        <section class="rule-section">
          <h3>頭家的話</h3>
          <p class="side-note">未滿十八歲不得購買。理性投注，量力而為。</p>
        </section>
      </div>

      <ResultModal :visible="modalVisible" :title="modalTitle" :detail="modalDetail"
        continue-label="繼續吹" :can-claim="round.state.canClaim" :can-continue="round.state.canContinue"
        :can-replay="round.state.finished && !round.state.canClaim" :busy="round.state.settling"
        @claim="round.actions.claim" @continue="round.actions.blow" @replay="round.actions.playAgain" />
    </section>
  </main>
</template>

<style scoped lang="scss">
.soda-body {
  max-width: 1080px;
  margin: 0 auto;
  padding: 20px 16px 24px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.soda-error {
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

.lucky-main-tabs {
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
  padding: 4px;
  background: #544c4b;
  box-shadow: var(--shadow-md);
}

.whistle-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 10px 0;

  &.is-locked {
    opacity: 0.75;
    pointer-events: none;
  }
}

.whistle {
  width: 70px;
  height: 130px;
  border-radius: 40px 40px 18px 18px;
  border: 3px solid var(--color-accent-400, #d68b5e);
  background: var(--color-neutral-100, #f9f4ed);
  position: relative;
  overflow: hidden;

  &.is-blowing {
    animation: shake 0.6s ease;
  }

  &.is-burst {
    border-color: var(--color-accent-800, #643312);
  }
}

.foam {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--color-accent-2-200, #dcecc0);
  transition: height 0.6s ease;
}

.blow {
  border: 0;
  border-radius: 999px;
  padding: 10px 18px;
  background: var(--color-accent, #d68b5e);
  color: var(--color-bg, #f5ead8);
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
  min-width: 46px;
  height: 28px;
  display: grid;
  place-items: center;
  border-radius: 999px;
  border: 2px solid var(--color-neutral-400, #c0b6a5);
  background: var(--color-neutral-200, #eee7db);
  color: var(--color-neutral-800, #474238);
  font-family: var(--font-heading, serif);
  font-weight: 900;
  font-size: 11px;
  padding: 0 6px;
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
