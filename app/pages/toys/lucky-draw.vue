<script setup lang="ts">
import { computed, inject, onBeforeUnmount, onMounted, reactive, watchEffect } from 'vue'
import BetPanel from '~/components/toys/BetPanel.vue'
import ResultModal from '~/components/toys/ResultModal.vue'
import ToyGameHeader from '~/components/toys/ToyGameHeader.vue'
import { useToyRound } from '~/composables/useToyRound'

/** 版面套用 SAMPLE/抽抽樂 (單一檔案).html 的視覺（票框開獎格＋連乘進度條＋側欄獎格倍率／規則），
 *  結果彈窗與下注/返回機制維持 ResultModal／ToyGameHeader 既有行為不變。 */
const round = useToyRound()

const cells = computed(() => round.state.catalog?.luckyDraw.cells ?? 12)
const chips = computed(() => round.state.catalog?.betChips ?? [])
const rewards = computed(() => round.state.catalog?.luckyDraw.rewards ?? [])
const maxPotMultiplier = computed(() => round.state.catalog?.maxPotMultiplier ?? 0)

/** 「選格只翻面・連乘上限 ×N」提示改放到 ToyPlayDialog 的標題列，見該元件的 setToyDialogSubtitle inject */
const setDialogSubtitle = inject<((text: string) => void) | null>('setToyDialogSubtitle', null)
watchEffect(() => {
  setDialogSubtitle?.(`選格只翻面・連乘上限 ×${maxPotMultiplier.value}`)
})

const isLocked = computed(() => round.state.settling || round.state.status === 'playing')
/** 連乘倍率＝目前彩池 ÷ 這注原始注額（注額在同一注內固定不變，見 useToyRound chooseChip 的 pot>0 鎖定） */
const multiplier = computed(() => (round.state.pot > 0 && round.state.bet > 0 ? round.state.pot / round.state.bet : 0))
const capAmount = computed(() => round.state.bet * maxPotMultiplier.value)
const progress = computed(() => `${Math.min(100, (multiplier.value / (maxPotMultiplier.value || 1)) * 100)}%`)

const money = (value: number) => Math.floor(value).toLocaleString('zh-TW')
const multLabel = (value: number) => {
  const rounded = Math.round(value * 100) / 100
  return `×${Number.isInteger(rounded) ? rounded : rounded.toFixed(2).replace(/0$/, '')}`
}

type Tone = { bg: string; fg: string; bd: string }
/** 對應後端 LUCKY_DRAW_REWARDS 的固定 id，比照 SAMPLE 的 TIERS 配色語彙 */
const TIER_TONE: Record<string, Tone> = {
  empty: { bg: 'var(--color-neutral-300)', fg: 'var(--color-neutral-700)', bd: 'var(--color-neutral-400)' },
  small: { bg: 'var(--color-accent-2-200)', fg: 'var(--color-accent-2-800)', bd: 'var(--color-accent-2-400)' },
  mid: { bg: 'var(--color-accent-2-400)', fg: 'var(--color-accent-2-800)', bd: 'var(--color-accent-2-600, var(--color-accent-2-400))' },
  big: { bg: 'var(--color-accent-300)', fg: 'var(--color-accent-800)', bd: 'var(--color-accent-500)' },
  special: { bg: 'var(--color-accent-500)', fg: 'var(--color-neutral-900)', bd: 'var(--color-accent-700)' },
  super: { bg: 'var(--color-accent-700)', fg: 'var(--color-bg)', bd: 'var(--color-accent-900, var(--color-accent-700))' }
}
const DEFAULT_TONE: Tone = { bg: 'var(--color-neutral-200)', fg: 'var(--color-neutral-800)', bd: 'var(--color-neutral-400)' }

/** 未翻開時的格子封面圖，共 25 張，public/images/toys/lucky-draw/tile_r0{1-5}_c0{1-5}.png */
const COVER_IMAGES = Array.from({ length: 5 }, (_, r) =>
  Array.from({ length: 5 }, (_, c) => `/images/toys/lucky-draw/tile_r0${r + 1}_c0${c + 1}.png`)
).flat()

function _shuffled<T>(list: T[]): T[] {
  const pool = list.slice()
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j] as T, pool[i] as T]
  }
  return pool
}

/** 每格固定配一張封面圖（進頁面時洗一次牌，翻牌前後都不換），純裝飾、跟實際獎項無關 */
const cellCovers = reactive<string[]>(_shuffled(COVER_IMAGES).slice(0, cells.value))

const _handlers = {
  toneOf: (rewardId: string): Tone => TIER_TONE[rewardId] ?? DEFAULT_TONE,
  cellFace: (index: number) => {
    const result = round.state.result
    if (round.state.revealed && result?.cellIndex === index) return result.label
    return String(index + 1)
  },
  cellSub: (index: number) => {
    const result = round.state.result
    if (round.state.revealed && result?.cellIndex === index) return result.multiplier === 0 ? '×0' : multLabel(result.multiplier)
    return '抽'
  },
  cellTone: (index: number): Tone | null => {
    const result = round.state.result
    if (round.state.revealed && result?.cellIndex === index) return _handlers.toneOf(result.rewardId)
    return null
  },
  cellCover: (index: number): string | undefined => cellCovers[index % cellCovers.length],
  cellStyle: (index: number): Record<string, string> => {
    const tone = _handlers.cellTone(index)
    if (tone) return { background: tone.bg, color: tone.fg }
    const cover = _handlers.cellCover(index)
    return cover ? { backgroundImage: `url(${cover})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}
  }
}

const headline = computed(() => {
  const s = round.state
  if (s.blockedGameKey) return '其他玩具還有未領金額，先處理那一款'
  if (s.settling || s.status === 'playing') return '翻牌中…'
  if (s.picking) return '選一格，繼續連乘'
  if (s.revealed && s.result) {
    if (s.result.multiplier === 0) return '抽到空獎，這注歸零'
    if (s.pot > 0 && !s.canContinue) return '已經頂到上限，趕緊收落來'
    return `翻到「${s.result.label}」，要繼續連乘嗎？`
  }
  if (s.pot > 0) return '還有未領彩池，先處理這一注'
  return '選一格，看是啥物'
})
const headlineTone = computed(() => {
  const s = round.state
  if (s.blockedGameKey) return 'is-neutral'
  if (s.revealed && s.result?.multiplier === 0) return 'is-neutral'
  if (s.pot > 0 && s.revealed && !s.canContinue) return 'is-accent'
  return ''
})

const modalVisible = computed(() => round.state.status === 'result' && round.state.revealed && !round.state.picking)
const modalTitle = computed(() => {
  if (round.state.claimed) return '已領取'
  if (round.state.result?.multiplier === 0) return '這格是空的'
  if (round.state.result) return round.state.result.label
  return '結果'
})
const modalDetail = computed(() => {
  if (round.state.blockedGameKey) return '其他玩具還有未領金額，先回那一款處理。'
  if (round.state.claimed) return `已寫入 F 幣 ${round.state.reward.toLocaleString('zh-TW')}`
  if (round.state.result?.multiplier === 0) return '本輪結束，未領金額已歸零。'
  if (round.state.result) return `倍率 ×${round.state.result.multiplier}`
  return ''
})

type MainTab = 'game' | 'rules'
const ui = reactive({ mainTab: 'game' as MainTab })

const click = {
  pick: (index: number) => {
    if (round.state.settling || round.state.status === 'playing') return
    if (round.state.picking) {
      void round.actions.continueDraw(index)
      return
    }
    if (round.state.pot > 0) return
    void round.actions.start(index)
  },
  setMainTab: (tab: MainTab) => { ui.mainTab = tab }
}

onMounted(() => {
  void round.actions.load()
})
onBeforeUnmount(() => {
  round.stopReveal()
})
</script>

<template>
  <main class="theme-taiwan-lottery lucky">
    <!-- <ToyGameHeader :balance="round.state.balance" /> -->
    <section class="lucky-body">
      <p v-if="round.state.catalogError" class="lucky-error">{{ round.state.catalogError }}</p>
      <p v-else-if="round.state.error" class="lucky-error">{{ round.state.error }}</p>
      <p v-if="round.state.blockedGameKey" class="lucky-error">其他玩具還有未領金額，這一款先不能開。</p>

      <div class="lucky-stats">
        <div class="stat-card is-dark">
          <div class="stat-label">未領彩池</div>
          <div class="stat-value">F 幣 {{ money(round.state.pot) }}</div>
        </div>
        <div class="stat-card is-accent">
          <div class="stat-label">目前連乘</div>
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
          <div class="grid" :class="{ 'is-locked': isLocked }">
            <button v-for="index in cells" :key="index - 1" type="button" class="cell"
              :class="{ 'is-open': round.state.revealed && round.state.result?.cellIndex === index - 1 }"
              :style="_handlers.cellStyle(index - 1)"
              :disabled="isLocked || (round.state.pot > 0 && !round.state.picking)"
              @click="click.pick(index - 1)">
              <template v-if="_handlers.cellTone(index - 1)">
                <span class="cell-face">{{ _handlers.cellFace(index - 1) }}</span>
                <span class="cell-sub">{{ _handlers.cellSub(index - 1) }}</span>
              </template>
            </button>
          </div>
        </div>

        <div class="frame-progress">
          <div class="progress-row">
            <span>連乘進度</span>
            <span>上限 ×{{ maxPotMultiplier }}（{{ money(capAmount) }} 元）</span>
          </div>
          <div class="progress-track">
            <div class="progress-fill" :style="{ width: progress }" />
          </div>
        </div>
      </div>

      <div v-else class="lucky-rules">
        <section class="rule-section">
          <h3>獎格倍率</h3>
          <ul class="tier-list">
            <li v-for="r in rewards" :key="r.id">
              <span class="tier-badge"
                :style="{ background: _handlers.toneOf(r.id).bg, color: _handlers.toneOf(r.id).fg, borderColor: _handlers.toneOf(r.id).bd }">
                {{ r.label.slice(0, 1) }}
              </span>
              <span class="tier-mult">{{ r.multiplier === 0 ? '×0 歸零' : multLabel(r.multiplier) }}</span>
              <span class="tier-odds">約 {{ Math.round(r.weight / 100) }}%</span>
            </li>
          </ul>
        </section>

        <section class="rule-section">
          <h3>規則</h3>
          <ul class="rule-list">
            <li>選格只翻面，不需要押在哪一格。</li>
            <li>每翻一格，倍率跟現有倍率連乘。</li>
            <li>抽到空獎本注歸零，重新選注再開始。</li>
            <li>連乘上限為注額 {{ maxPotMultiplier }} 倍。</li>
          </ul>
        </section>

        <section class="rule-section">
          <h3>頭家的話</h3>
          <p class="side-note">未滿十八歲不得購買。理性投注，量力而為。</p>
        </section>
      </div>

      <ResultModal :visible="modalVisible" :title="modalTitle" :detail="modalDetail" :can-claim="round.state.canClaim"
        :can-continue="round.state.canContinue" :can-replay="round.state.pot <= 0 && !round.state.canClaim"
        :busy="round.state.settling" @claim="round.actions.claim" @continue="round.actions.armContinue"
        @replay="round.actions.playAgain" />
    </section>
  </main>
</template>

<style scoped lang="scss">
.lucky-body {
  max-width: 1080px;
  margin: 0 auto;
  padding: 20px 16px 24px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.lucky-head {
  display: flex;
  align-items: flex-end;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 2px;

  h1 {
    margin: 0;
    font-size: clamp(28px, 5vw, 40px);
    color: var(--color-accent-800, #643312);
  }
}

.lucky-desc {
  margin: 0 0 12px;
  max-width: 52ch;
  font-size: 14px;
  line-height: 1.7;
  color: var(--color-neutral-800, #474238);
}

.lucky-error {
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

  .grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(56px, 70px));
    justify-content: center;
    gap: 4px;

    &.is-locked {
      opacity: 0.75;
      pointer-events: none;
    }
  }

  .cell {
    aspect-ratio: 1;
    border: none;
    border-radius: 2px;
    background: var(--color-neutral-200, #eee7db);
    color: var(--color-neutral-800, #474238);
    outline: 2px dashed rgba(245, 234, 216, 0.75);
    outline-offset: -4px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    cursor: pointer;
    transition: filter 0.15s ease;

    .cell-face {
      font-family: var(--font-heading, serif);
      font-weight: 900;
      font-size: 16px;
      line-height: 1;
    }

    .cell-sub {
      font-size: 10px;
      font-weight: 700;
      opacity: 0.8;
    }

    &:hover:not(:disabled) {
      filter: brightness(1.06);
    }

    &:disabled {
      cursor: not-allowed;
    }
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
