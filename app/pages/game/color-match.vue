<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useGameHistory } from '~/composables/useGameHistory'
import ColorMatchEngine, {
  INITIAL_TIME_SEC,
  TIME_BONUS_NORMAL_SEC,
  TIME_BONUS_MILESTONE_SEC,
  MILESTONE_COMBO_STEP,
  WRONG_TIME_PENALTY_SEC,
  WRONG_SCORE_PENALTY_MULTIPLIER,
  SCORE_PENALTY_THRESHOLD,
  SEQUENCE_TIER_SIZE,
  GRID_TIER_SIZE,
  SCORE_PER_SEQUENCE_STEP,
  MAX_SEQUENCE_LENGTH,
  MAX_GRID_DIM,
  type ColorMatchStatus,
  type ColorOption
} from '~/utils/colorMatchEngine'

/**
 * COLOR MATCH — 全專案第 27 款遊戲。
 *
 * 玩法（依序點色生存模式）：畫面上方顯示一組目標顏色序列，玩家依序點擊下方調色盤網格中對應顏色
 * 的格子（同色格子點任一個都算數）。序列點完＝完成 1 次 match：每 10 次序列變長、每 20 次網格
 * 變大，點錯只扣 combo（游標退回序列開頭，網格與序列不變），時間只會因為連續答對累積而增加，
 * 歸零才結束（生存模式）。核心邏輯抽到 colorMatchEngine.ts（純 TS），頁面只以 reactive() 鏡像
 * engine 的 getSnapshot()，Logic / Rendering 分離（比照 WHACK-A-MOLE／FROGGER 的既有寫法）。
 */

const ACCENT = '#8b5cf6'
/** 點擊格子後的短暫視覺回饋停留時間 */
const FEEDBACK_MS = 420
/** 完成整組序列（含 milestone）的訊息 Banner 停留時間 */
const COMPLETE_BANNER_MS = 900

const router = useRouter()
const engine = new ColorMatchEngine()
const gameHistory = useGameHistory()

const initialSnap = engine.getSnapshot()

const state = reactive({
  status: 'idle' as ColorMatchStatus,
  score: 0,
  combo: 0,
  maxCombo: 0,
  remainingSec: INITIAL_TIME_SEC,
  totalMatches: 0,
  gridDim: initialSnap.gridDim,
  gridCells: initialSnap.gridCells as ColorOption[],
  targetSequence: initialSnap.targetSequence as ColorOption[],
  sequenceProgress: 0,
  /** 點擊格子的短暫回饋：記錄被點的格子 index 與結果種類，驅動動畫 */
  feedback: null as { kind: 'step' | 'complete' | 'wrong'; index: number } | null,
  /** 完成序列時的浮動訊息（一般 +分數／milestone 雙倍+加時） */
  completeBanner: null as { text: string; milestone: boolean } | null,
  message: '按「START」開始遊戲。',
  rewardMessage: '',
  waitingOverlayVisible: true,
  resultOverlayVisible: false,
  rateDialogOpen: false,
  ruleDialogOpen: false
})

const COLOR_MATCH_RULE = {
  description:
    '依序點色生存模式：畫面上方會顯示一組「目標顏色序列」，依序點擊下方調色盤網格中對應顏色的格子' +
    '（同一種顏色若網格裡有好幾格，點任何一格都算數）。序列全部依序點完即完成 1 次配對。' +
    `每完成 ${SEQUENCE_TIER_SIZE} 次配對，下一組序列長度 +1（上限 ${MAX_SEQUENCE_LENGTH} 個顏色）；` +
    `每完成 ${GRID_TIER_SIZE} 次配對，調色盤網格邊長 +1（2x2 → 3x3 → 4x4…，上限 ${MAX_GRID_DIM}x${MAX_GRID_DIM}）。` +
    '序列點到一半點錯顏色：COMBO 歸零、游標退回序列開頭重新點，但網格與序列內容不會改變。',
  scoreRule:
    `每完成 1 次配對得 ${SCORE_PER_SEQUENCE_STEP} 分 × 序列長度，時間 +${TIME_BONUS_NORMAL_SEC} 秒；` +
    `若完成當下 COMBO 剛好是 ${MILESTONE_COMBO_STEP} 的倍數，該次分數 double、時間改加 ${TIME_BONUS_MILESTONE_SEC} 秒。` +
    `這是生存模式：點錯扣 ${WRONG_TIME_PENALTY_SEC} 秒並讓 COMBO 歸零，時間歸零才結束遊戲。` +
    `分數達 ${SCORE_PENALTY_THRESHOLD} 分後，點錯還會額外扣分＝序列長度 × 累計配對次數 × 即將歸零的 COMBO × ${WRONG_SCORE_PENALTY_MULTIPLIER}，` +
    `COMBO／配對次數越高，一次失誤扣得越重，請衡量風險再衝高 COMBO。初始時間 ${INITIAL_TIME_SEC} 秒。`,
  levelsTitle: '難度成長',
  levels: [
    { level: `每 ${SEQUENCE_TIER_SIZE} 次配對`, condition: `目標序列長度 +1（上限 ${MAX_SEQUENCE_LENGTH} 色）` },
    { level: `每 ${GRID_TIER_SIZE} 次配對`, condition: `調色盤網格邊長 +1（上限 ${MAX_GRID_DIM}x${MAX_GRID_DIM}）` }
  ],
  note: 'ESC / P 可暫停，暫停期間不消耗時間、也不會出新題目。'
}

/** Game Timer（生存模式：只會因為配對成功累加，歸零才結束）：本頁持有的 setInterval，每秒推進 engine.tickTimer() */
let gameTimerId: ReturnType<typeof setInterval> | null = null
/** 點擊格子回饋動畫的清除計時器 */
let feedbackTimer: ReturnType<typeof setTimeout> | null = null
/** 完成序列浮動訊息的清除計時器 */
let completeBannerTimer: ReturnType<typeof setTimeout> | null = null

const statusText = computed(() => {
  if (state.status === 'playing') return 'PLAYING'
  if (state.status === 'paused') return 'PAUSED'
  if (state.status === 'gameover') return 'GAME OVER'
  return 'READY'
})
const canPauseWhilePlaying = computed(() => state.status === 'playing')
const canResumeFromPause = computed(
  () => state.status === 'paused' && !state.waitingOverlayVisible && !state.resultOverlayVisible
)
const gridStyle = computed(() => `grid-template-columns: repeat(${state.gridDim}, 1fr); grid-template-rows: repeat(${state.gridDim}, 1fr);`)

/** 私有工具方法：快照同步、計時器管理、回饋動畫 */
const _handlers = {
  syncSnapshot: () => {
    const snap = engine.getSnapshot()
    state.status = snap.status
    state.score = snap.score
    state.combo = snap.combo
    state.maxCombo = snap.maxCombo
    state.remainingSec = snap.remainingSec
    state.totalMatches = snap.totalMatches
    state.gridDim = snap.gridDim
    state.gridCells = snap.gridCells
    state.targetSequence = snap.targetSequence
    state.sequenceProgress = snap.sequenceProgress
  },
  stopGameTimer: () => {
    if (gameTimerId) {
      clearInterval(gameTimerId)
      gameTimerId = null
    }
  },
  startGameTimer: () => {
    _handlers.stopGameTimer()
    gameTimerId = setInterval(() => {
      if (state.status !== 'playing') return
      const over = engine.tickTimer()
      _handlers.syncSnapshot()
      if (over) _actions.finishGame()
    }, 1000)
  },
  stopFeedbackTimer: () => {
    if (feedbackTimer) {
      clearTimeout(feedbackTimer)
      feedbackTimer = null
    }
  },
  showFeedback: (kind: 'step' | 'complete' | 'wrong', index: number) => {
    _handlers.stopFeedbackTimer()
    state.feedback = { kind, index }
    feedbackTimer = setTimeout(() => {
      state.feedback = null
      feedbackTimer = null
    }, FEEDBACK_MS)
  },
  stopCompleteBannerTimer: () => {
    if (completeBannerTimer) {
      clearTimeout(completeBannerTimer)
      completeBannerTimer = null
    }
  },
  showCompleteBanner: (text: string, milestone: boolean) => {
    _handlers.stopCompleteBannerTimer()
    state.completeBanner = { text, milestone }
    completeBannerTimer = setTimeout(() => {
      state.completeBanner = null
      completeBannerTimer = null
    }, COMPLETE_BANNER_MS)
  }
}

const _actions = {
  recordHistory: async () => {
    state.rewardMessage = ''
    try {
      const result = await gameHistory.actions.record('colorMatch', 'COLOR MATCH', {
        score: state.score,
        meta: {
          maxCombo: state.maxCombo,
          totalMatches: state.totalMatches
        }
      })
      if (result.coinReward > 0) {
        state.rewardMessage = result.coinCapped ? `+${result.coinReward} coin（已達今日上限）` : `+${result.coinReward} coin`
      }
    } catch {
      // 紀錄寫入失敗不影響遊戲本身，靜默略過
    }
  },
  resetGame: () => {
    _handlers.stopGameTimer()
    _handlers.stopFeedbackTimer()
    _handlers.stopCompleteBannerTimer()
    engine.reset()
    _handlers.syncSnapshot()
    state.feedback = null
    state.completeBanner = null
    state.rewardMessage = ''
    state.waitingOverlayVisible = true
    state.resultOverlayVisible = false
    state.message = '按「START」開始遊戲。'
  },
  startPlay: () => {
    _handlers.stopFeedbackTimer()
    _handlers.stopCompleteBannerTimer()
    state.feedback = null
    state.completeBanner = null
    engine.start()
    _handlers.syncSnapshot()
    state.waitingOverlayVisible = false
    state.resultOverlayVisible = false
    state.message = '依序點擊跟上方目標顏色序列相同的格子！'
    _handlers.startGameTimer()
  },
  clickCell: (index: number) => {
    if (state.status !== 'playing') return
    const cell = state.gridCells[index]
    if (!cell) return
    const result = engine.answer(cell.hex)
    _handlers.syncSnapshot()
    if (!result.correct) {
      _handlers.showFeedback('wrong', index)
      const penaltyText = result.scoreDelta < 0 ? `，扣 ${-result.scoreDelta} 分` : ''
      state.message = `點錯了！扣 ${WRONG_TIME_PENALTY_SEC} 秒${penaltyText}，COMBO 歸零，從序列開頭重新點。`
      if (result.gameOver) _actions.finishGame()
      return
    }
    if (result.sequenceComplete) {
      _handlers.showFeedback('complete', index)
      const text = result.isMilestone
        ? `MILESTONE! +${result.scoreDelta} 分（DOUBLE） +${result.secondsGained} 秒`
        : `完成！+${result.scoreDelta} 分 +${result.secondsGained} 秒`
      _handlers.showCompleteBanner(text, result.isMilestone)
      state.message = text
      return
    }
    _handlers.showFeedback('step', index)
    state.message = '繼續！點下一個顏色。'
  },
  pause: () => {
    if (state.status !== 'playing') return
    engine.pause()
    _handlers.stopGameTimer()
    _handlers.syncSnapshot()
    state.message = '已暫停'
  },
  resume: () => {
    if (state.status !== 'paused') return
    engine.resume()
    _handlers.startGameTimer()
    _handlers.syncSnapshot()
    state.message = '依序點擊跟上方目標顏色序列相同的格子！'
  },
  finishGame: () => {
    _handlers.stopGameTimer()
    _handlers.stopFeedbackTimer()
    _handlers.stopCompleteBannerTimer()
    state.feedback = null
    state.completeBanner = null
    _handlers.syncSnapshot()
    state.resultOverlayVisible = true
    state.message = '時間到，遊戲結束。'
    _actions.recordHistory()
  },
  playAgain: () => {
    _actions.resetGame()
    _actions.startPlay()
  },
  endGameNow: () => {
    _handlers.stopGameTimer()
    _handlers.stopFeedbackTimer()
    _handlers.stopCompleteBannerTimer()
    state.feedback = null
    state.completeBanner = null
    state.waitingOverlayVisible = false
    state.status = 'gameover'
    state.message = '本局已結束。'
    state.resultOverlayVisible = true
    _actions.recordHistory()
  }
}

const click = {
  start: () => _actions.startPlay(),
  cell: (index: number) => _actions.clickCell(index),
  pause: () => _actions.pause(),
  resume: () => _actions.resume(),
  restart: () => _actions.playAgain(),
  end: () => _actions.endGameNow(),
  again: () => _actions.playAgain(),
  exit: () => router.replace('/game-hall'),
  openRateDialog: () => {
    state.rateDialogOpen = true
  },
  closeRateDialog: () => {
    state.rateDialogOpen = false
  },
  openRuleDialog: () => {
    state.ruleDialogOpen = true
  },
  closeRuleDialog: () => {
    state.ruleDialogOpen = false
  }
}

const onKeydown = (event: KeyboardEvent) => {
  if (event.key !== 'Escape' && event.key !== 'p' && event.key !== 'P') return
  if (state.waitingOverlayVisible || state.resultOverlayVisible) return
  if (state.status === 'paused') _actions.resume()
  else if (state.status === 'playing') _actions.pause()
}

onMounted(() => {
  _actions.resetGame()
  window.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  _handlers.stopGameTimer()
  _handlers.stopFeedbackTimer()
  _handlers.stopCompleteBannerTimer()
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <main class="cm-page" :class="`state-${state.status}`">
    <div class="cm-overlay" />

    <div v-if="state.waitingOverlayVisible" class="game-mask waiting-mask">
      <div class="mask-title">WELCOME</div>
      <p class="waiting-subtitle">COLOR MATCH</p>
      <p class="waiting-hint">依序點色生存模式 · 序列越長、網格越大，時間靠連續答對累積</p>
      <button class="cm-btn waiting-btn waiting-start" type="button" @click="click.start">START</button>
      <button class="cm-btn link waiting-btn" type="button" @click="click.openRateDialog">CONVERT</button>
      <button class="cm-btn link waiting-btn" type="button" @click="click.openRuleDialog">RULE</button>
    </div>

    <div v-if="state.resultOverlayVisible" class="game-mask result-mask">
      <div class="mask-title">GAME OVER</div>
      <div class="result-list">
        <div class="result-item"><span>SCORE</span><b>{{ state.score }}</b></div>
        <div class="result-item"><span>MAX COMBO</span><b>{{ state.maxCombo }}</b></div>
        <div class="result-item"><span>MATCHES</span><b>{{ state.totalMatches }}</b></div>
      </div>
      <p v-if="state.rewardMessage" class="result-reward">{{ state.rewardMessage }}</p>
      <div class="result-actions">
        <button class="cm-btn" type="button" @click="click.again">PLAY AGAIN</button>
        <button class="cm-btn danger" type="button" @click="click.exit">EXIT</button>
      </div>
    </div>

    <GameRateDialog :visible="state.rateDialogOpen" game-key="colorMatch" game-name="COLOR MATCH" :accent-color="ACCENT"
      @close="click.closeRateDialog" />
    <GameRuleDialog :visible="state.ruleDialogOpen" game-name="COLOR MATCH" :accent-color="ACCENT" v-bind="COLOR_MATCH_RULE"
      @close="click.closeRuleDialog" />

    <section class="cm-shell">
      <aside class="cm-side left">
        <button class="cm-btn" type="button" :disabled="!canResumeFromPause" @click="click.resume">START</button>
        <button class="cm-btn" type="button" :disabled="!canPauseWhilePlaying" @click="click.pause">PAUSE</button>
        <button class="cm-btn" type="button" @click="click.restart">RESTART</button>
        <button class="cm-btn link" type="button" @click="click.end">END</button>
        <button class="cm-btn" type="button" @click="click.openRateDialog">CONVERT</button>
        <button class="cm-btn" type="button" @click="click.openRuleDialog">RULE</button>
      </aside>

      <section class="cm-center">
        <header class="cm-title-wrap">
          <h1 class="cm-title">COLOR MATCH</h1>
          <p class="cm-status">{{ statusText }}</p>
        </header>

        <div class="cm-panel">
          <span>SCORE: {{ state.score }}</span>
          <span>COMBO x{{ state.combo }}</span>
          <span>MATCHES: {{ state.totalMatches }}</span>
          <span class="cm-time">TIME: {{ state.remainingSec }}s</span>
        </div>

        <div class="cm-frame">
          <p class="cm-target-label">TARGET SEQUENCE</p>
          <div class="cm-sequence">
            <div v-for="(color, idx) in state.targetSequence" :key="`${color.id}-${idx}`" class="cm-seq-swatch"
              :class="{ done: idx < state.sequenceProgress, current: idx === state.sequenceProgress }"
              :style="`background:${color.hex}`">
              <span v-if="idx < state.sequenceProgress" class="cm-seq-check">✓</span>
            </div>
          </div>

          <div class="cm-grid" :class="{ shake: state.feedback?.kind === 'wrong' }" :style="gridStyle">
            <button v-for="(cell, idx) in state.gridCells" :key="idx" type="button" class="cm-cell"
              :class="{
                'is-step': state.feedback?.kind === 'step' && state.feedback.index === idx,
                'is-complete': state.feedback?.kind === 'complete' && state.feedback.index === idx,
                'is-wrong': state.feedback?.kind === 'wrong' && state.feedback.index === idx
              }"
              :style="`background:${cell.hex}`" :disabled="state.status !== 'playing'" @click="click.cell(idx)" />
          </div>

          <p v-if="state.completeBanner" class="cm-complete-banner" :class="{ milestone: state.completeBanner.milestone }">
            {{ state.completeBanner.text }}
          </p>
        </div>

        <p class="cm-message">{{ state.message }}</p>
      </section>

      <aside class="cm-side right">
        <div class="cm-help-panel">
          <p class="cm-help-title">HOW TO PLAY</p>
          <p class="cm-help-text">
            依序點擊跟上方「目標顏色序列」相同的格子（網格內同色格子點任一個都算數）。點錯會扣 {{ WRONG_TIME_PENALTY_SEC }} 秒、
            COMBO 歸零、從序列開頭重新點；分數達 {{ SCORE_PENALTY_THRESHOLD }} 分後點錯還會額外扣分，COMBO 越高扣得越重。
            順利點完一整組序列即完成 1 次配對，時間會累加。每 {{ SEQUENCE_TIER_SIZE }} 次配對序列變長、
            每 {{ GRID_TIER_SIZE }} 次配對網格變大。ESC / P 可暫停。
          </p>
        </div>
      </aside>
    </section>
  </main>
</template>

<style scoped lang="scss">
.cm-page {
  --accent: #8b5cf6;
  position: relative;
  min-height: 100vh;
  display: grid;
  place-items: center;
  background: radial-gradient(circle at top, #1c0f2e, #06040a 60%);
  overflow: hidden;
  isolation: isolate;

  &::before,
  &::after {
    content: '';
    position: absolute;
    inset: -20%;
    pointer-events: none;
    z-index: 0;
  }

  &::before {
    background: radial-gradient(circle at 20% 20%, rgba(139, 92, 246, 0.18), transparent 45%),
      radial-gradient(circle at 80% 70%, rgba(236, 72, 153, 0.12), transparent 40%);
    filter: blur(40px);
    animation: cm-ambient-drift 12s ease-in-out infinite alternate;
  }

  &::after {
    background: linear-gradient(115deg, rgba(139, 92, 246, 0.06), rgba(0, 0, 0, 0));
    animation: cm-ambient-pulse 4.6s ease-in-out infinite;
  }

  .cm-overlay {
    position: absolute;
    inset: 0;
    background-image: linear-gradient(rgba(139, 92, 246, 0.05) 1px, transparent 1px),
      linear-gradient(90deg, rgba(139, 92, 246, 0.05) 1px, transparent 1px);
    background-size: 28px 28px;
    pointer-events: none;
    z-index: 0;
    animation: cm-grid-drift 14s linear infinite;
  }

  .game-mask {
    position: absolute;
    inset: 0;
    z-index: 4;
    background: rgba(0, 0, 0, 0.78);
    display: grid;
    place-items: center;
    align-content: center;
    gap: 12px;

    .mask-title {
      color: var(--accent);
      font-size: clamp(2rem, 8vw, 4rem);
      letter-spacing: 0.25rem;
      font-weight: 900;
      text-shadow: 0 0 18px rgba(139, 92, 246, 0.5);
    }

    &.waiting-mask {
      background: rgba(0, 0, 0, 0.88);

      .waiting-subtitle {
        margin: 0;
        color: #cbb6ff;
        letter-spacing: 0.3rem;
        font-size: 1.05rem;
        font-weight: 800;
      }

      .waiting-hint {
        margin: 0;
        max-width: 340px;
        text-align: center;
        color: #9c7ee0;
        font-size: 0.78rem;
        letter-spacing: 0.04em;
      }

      .waiting-btn {
        width: 220px;
      }
    }

    .result-list {
      display: grid;
      gap: 8px;
      width: 280px;
    }

    .result-item {
      display: flex;
      justify-content: space-between;
      border: 1px solid rgba(139, 92, 246, 0.4);
      background: rgba(30, 16, 48, 0.65);
      color: #e6d9ff;
      padding: 8px 10px;
      font-variant-numeric: tabular-nums;
    }

    .result-reward {
      margin: 8px 0 0;
      color: #cbb6ff;
      font-size: 0.85rem;
      text-align: center;
      letter-spacing: 0.05em;
    }

    .result-actions {
      margin-top: 8px;
      display: flex;
      gap: 10px;
    }
  }

  .cm-shell {
    position: relative;
    z-index: 1;
    width: min(1100px, 100%);
    padding: 24px;
    display: grid;
    grid-template-columns: 180px 1fr 200px;
    gap: 20px;
    align-items: start;
  }

  .cm-side {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding-top: 160px;
  }

  .cm-btn {
    position: relative;
    overflow: hidden;
    border: 1px solid rgba(139, 92, 246, 0.4);
    border-radius: 6px;
    padding: 10px 12px;
    background: rgba(30, 16, 48, 0.75);
    color: #b794f6;
    font-weight: 700;
    letter-spacing: 0.5px;
    cursor: pointer;
    transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;

    &::after {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(105deg, transparent 35%, rgba(214, 188, 255, 0.25) 50%, transparent 65%);
      transform: translateX(-150%);
      transition: transform 0.35s ease;
      pointer-events: none;
    }

    &:hover:not(:disabled) {
      border-color: var(--accent);
      box-shadow: 0 0 12px rgba(139, 92, 246, 0.4);
      transform: translateY(-1px);

      &::after {
        transform: translateX(150%);
      }
    }

    &:disabled {
      opacity: 0.45;
      cursor: not-allowed;
      box-shadow: none;
    }

    &.link {
      text-align: center;
      text-decoration: none;
    }

    &.danger {
      border-color: rgba(255, 90, 90, 0.5);
      color: #ff8f8f;
    }
  }

  .cm-center {
    text-align: center;

    .cm-title-wrap {
      margin-bottom: 8px;
    }

    .cm-title {
      margin: 0;
      color: var(--accent);
      font-size: clamp(1.7rem, 5vw, 3rem);
      letter-spacing: 0.14rem;
      font-weight: 900;
      text-shadow: 0 0 14px rgba(139, 92, 246, 0.45);
    }

    .cm-status {
      margin: 2px 0 0;
      color: #cbb6ff;
      font-size: 0.9rem;
      letter-spacing: 0.2rem;
    }

    .cm-panel {
      margin: 10px auto 0;
      display: flex;
      justify-content: center;
      flex-wrap: wrap;
      gap: 8px 16px;
      color: #b794f6;
      font-weight: 800;
      font-size: 0.85rem;
      text-shadow: 0 0 6px rgba(139, 92, 246, 0.45);
      font-variant-numeric: tabular-nums;
    }

    .cm-frame {
      width: fit-content;
      margin: 16px auto 0;
      padding: 20px 24px;
      background: #140a20;
      border: 8px solid #2c1a4a;
      border-radius: 16px;
      box-shadow: 0 0 0 1px rgba(139, 92, 246, 0.2), 0 0 26px rgba(90, 55, 150, 0.35);
      display: grid;
      justify-items: center;
      gap: 14px;
    }

    .cm-target-label {
      margin: 0;
      color: #9c7ee0;
      font-size: 0.75rem;
      letter-spacing: 0.3rem;
      font-weight: 800;
    }

    .cm-sequence {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 8px;
      max-width: 320px;
    }

    .cm-seq-swatch {
      position: relative;
      width: 36px;
      height: 36px;
      border-radius: 8px;
      border: 2px solid rgba(255, 255, 255, 0.25);
      box-shadow: 0 0 10px currentColor;
      display: grid;
      place-items: center;
      opacity: 0.5;

      &.done {
        opacity: 0.85;
      }

      &.current {
        opacity: 1;
        border-color: #fff;
        animation: cm-seq-pulse 1s ease-in-out infinite;
      }

      .cm-seq-check {
        color: #fff;
        font-weight: 900;
        text-shadow: 0 0 4px rgba(0, 0, 0, 0.6);
        font-size: 0.9rem;
      }
    }

    .cm-grid {
      display: grid;
      gap: 8px;
      width: min(340px, 78vw);
      height: min(340px, 78vw);

      &.shake {
        animation: cm-shake 0.32s ease-in-out;
      }
    }

    .cm-cell {
      border-radius: 8px;
      border: 2px solid rgba(255, 255, 255, 0.2);
      cursor: pointer;
      box-shadow: 0 3px 8px rgba(0, 0, 0, 0.4);
      transition: transform 0.12s ease, box-shadow 0.12s ease;

      &:hover:not(:disabled) {
        transform: scale(1.04);
      }

      &:active:not(:disabled) {
        transform: scale(0.94);
      }

      &:disabled {
        cursor: not-allowed;
        opacity: 0.9;
      }

      &.is-step {
        animation: cm-step-pop 0.32s ease-out;
        box-shadow: 0 0 16px 2px rgba(255, 255, 255, 0.5);
      }

      &.is-complete {
        animation: cm-complete-pop 0.42s ease-out;
        box-shadow: 0 0 24px 4px rgba(255, 255, 255, 0.7);
      }

      &.is-wrong {
        box-shadow: 0 0 16px 2px rgba(255, 90, 90, 0.8);
      }
    }

    .cm-complete-banner {
      margin: 0;
      color: #cbb6ff;
      font-weight: 900;
      font-size: 1rem;
      letter-spacing: 0.1rem;
      text-shadow: 0 0 10px rgba(139, 92, 246, 0.7);
      animation: cm-wrong-pop 0.3s ease-out both;

      &.milestone {
        color: #ffd24d;
        text-shadow: 0 0 12px rgba(255, 210, 77, 0.8);
        font-size: 1.15rem;
      }
    }
  }

  .cm-message {
    margin-top: 16px;
    color: #cbb6ff;
    font-size: 0.85rem;
    min-height: 1.2em;
  }

  .cm-help-panel {
    border: 1px solid rgba(139, 92, 246, 0.3);
    border-radius: 8px;
    padding: 12px;
    background: rgba(30, 16, 48, 0.5);

    .cm-help-title {
      margin: 0 0 6px;
      color: var(--accent);
      font-size: 0.72rem;
      letter-spacing: 0.14rem;
      font-weight: 800;
    }

    .cm-help-text {
      margin: 0;
      color: #cbb6ff;
      font-size: 0.72rem;
      line-height: 1.6;
    }
  }
}

@keyframes cm-ambient-drift {
  0% {
    transform: translate(-1.5%, -1%) scale(1);
  }

  100% {
    transform: translate(1.5%, 1%) scale(1.06);
  }
}

@keyframes cm-ambient-pulse {

  0%,
  100% {
    opacity: 0.35;
  }

  50% {
    opacity: 0.75;
  }
}

@keyframes cm-grid-drift {
  0% {
    transform: translate(0, 0);
  }

  100% {
    transform: translate(14px, 14px);
  }
}

@keyframes cm-seq-pulse {

  0%,
  100% {
    transform: scale(1);
  }

  50% {
    transform: scale(1.12);
  }
}

@keyframes cm-step-pop {
  0% {
    transform: scale(1);
  }

  40% {
    transform: scale(0.88);
  }

  100% {
    transform: scale(1);
  }
}

@keyframes cm-complete-pop {
  0% {
    transform: scale(1);
  }

  40% {
    transform: scale(1.16);
  }

  100% {
    transform: scale(1);
  }
}

@keyframes cm-shake {

  0%,
  100% {
    transform: translateX(0);
  }

  20% {
    transform: translateX(-8px);
  }

  40% {
    transform: translateX(8px);
  }

  60% {
    transform: translateX(-6px);
  }

  80% {
    transform: translateX(6px);
  }
}

@keyframes cm-wrong-pop {
  0% {
    opacity: 0;
    transform: translateY(-4px) scale(0.9);
  }

  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@media (max-width: 980px) {
  .cm-page {
    .cm-shell {
      grid-template-columns: 1fr;
      padding: 16px;
    }

    .cm-side {
      flex-direction: row;
      flex-wrap: wrap;
      justify-content: center;
      padding-top: 0;
    }
  }
}
</style>
