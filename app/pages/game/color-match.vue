<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useGameHistory } from '~/composables/useGameHistory'
import ColorMatchEngine, {
  ROUND_DURATION_SEC,
  BASE_SCORE,
  COMBO_SCORE_STEP,
  MAX_COMBO_FOR_SCORE,
  WRONG_TIME_PENALTY_SEC,
  PHASE2_AT_SEC,
  PHASE3_AT_SEC,
  type ColorMatchStatus,
  type Question
} from '~/utils/colorMatchEngine'

/**
 * COLOR MATCH — 全專案第 27 款遊戲。
 *
 * 核心邏輯抽到 colorMatchEngine.ts（純 TS），頁面只以 reactive() 鏡像 engine 的 getSnapshot()，
 * Logic / Rendering 分離（比照 WHACK-A-MOLE／FROGGER 的既有寫法）。
 * 只有一種計時器：Game Timer（30 秒倒數），由本頁 setInterval 每秒呼叫 engine.tickTimer() 驅動，
 * 沒有 whack-a-mole 那種內部非同步 Spawn／Lifetime 計時器，engine 本身完全同步、不需要 onChange 回呼。
 */

const ACCENT = '#8b5cf6'
/** 答對/答錯的短暫視覺回饋停留時間 */
const FEEDBACK_MS = 420
/** 剩餘秒數進入警示色的門檻 */
const LOW_TIME_SEC = 8

const router = useRouter()
const engine = new ColorMatchEngine()
const gameHistory = useGameHistory()

const state = reactive({
  status: 'idle' as ColorMatchStatus,
  score: 0,
  combo: 0,
  maxCombo: 0,
  remainingSec: ROUND_DURATION_SEC,
  question: engine.getSnapshot().question as Question,
  correctCount: 0,
  wrongCount: 0,
  /** 答對/答錯的短暫回饋：correct 時記錄選中的 index 做縮放動畫，wrong 時整排選項 shake + WRONG 提示 */
  feedback: null as { kind: 'correct' | 'wrong'; index: number } | null,
  message: '按「START」開始遊戲。',
  rewardMessage: '',
  waitingOverlayVisible: true,
  resultOverlayVisible: false,
  rateDialogOpen: false,
  ruleDialogOpen: false
})

const COLOR_MATCH_RULE = {
  description:
    `限時 ${ROUND_DURATION_SEC} 秒的辨色反應遊戲：畫面上方顯示一個 TARGET 顏色，下方 4 個選項中選出跟 TARGET 相同的顏色即可得分。` +
    `隨時間推進題目會變難：0~${PHASE2_AT_SEC} 秒只有 4 種基本色；${PHASE2_AT_SEC}~${PHASE3_AT_SEC} 秒色盤擴充到 6 色；` +
    `${PHASE3_AT_SEC} 秒後有機率換成「相近色」題目（4 個選項同色系不同深淺，考驗仔細辨色），` +
    '同時開始有機率出現 Stroop 題——畫面顯示一個顏色名稱的文字，但文字本身的顯示顏色跟文字內容不同，這時答案要選「文字顯示的顏色」而不是文字內容本身。',
  scoreRule:
    `答對得 ${BASE_SCORE} 分起，連續答對（Combo）每多 1 次再 +${COMBO_SCORE_STEP} 分，Combo 達 ${MAX_COMBO_FOR_SCORE} 後不再繼續往上加；` +
    `答錯不會直接結束遊戲，但會扣 ${WRONG_TIME_PENALTY_SEC} 秒剩餘時間並讓 Combo 歸零。時間歸零立即結束並結算分數。`,
  levelsTitle: '難度階段',
  levels: [
    { level: `0~${PHASE2_AT_SEC}s`, condition: '4 種基本色，一般辨色題' },
    { level: `${PHASE2_AT_SEC}~${PHASE3_AT_SEC}s`, condition: '色盤擴充到 6 色' },
    { level: `${PHASE3_AT_SEC}~${ROUND_DURATION_SEC}s`, condition: '加入相近色題目，並逐漸提高 Stroop 題出現機率' }
  ],
  note: 'ESC / P 可暫停，暫停期間不消耗時間、也不會出新題目。'
}

/** Game Timer（30 秒倒數）：本頁持有的 setInterval，每秒推進 engine.tickTimer() */
let gameTimerId: ReturnType<typeof setInterval> | null = null
/** 答對/答錯回饋動畫的清除計時器 */
let feedbackTimer: ReturnType<typeof setTimeout> | null = null

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
const lowTime = computed(() => state.status === 'playing' && state.remainingSec <= LOW_TIME_SEC)

/** 私有工具方法：快照同步、計時器管理、選項外觀 */
const _handlers = {
  syncSnapshot: () => {
    const snap = engine.getSnapshot()
    state.status = snap.status
    state.score = snap.score
    state.combo = snap.combo
    state.maxCombo = snap.maxCombo
    state.remainingSec = snap.remainingSec
    state.question = snap.question
    state.correctCount = snap.correctCount
    state.wrongCount = snap.wrongCount
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
  showFeedback: (kind: 'correct' | 'wrong', index: number) => {
    _handlers.stopFeedbackTimer()
    state.feedback = { kind, index }
    feedbackTimer = setTimeout(() => {
      state.feedback = null
      feedbackTimer = null
    }, FEEDBACK_MS)
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
          correctCount: state.correctCount,
          wrongCount: state.wrongCount
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
    engine.reset()
    _handlers.syncSnapshot()
    state.feedback = null
    state.rewardMessage = ''
    state.waitingOverlayVisible = true
    state.resultOverlayVisible = false
    state.message = '按「START」開始遊戲。'
  },
  startPlay: () => {
    _handlers.stopFeedbackTimer()
    state.feedback = null
    engine.start()
    _handlers.syncSnapshot()
    state.waitingOverlayVisible = false
    state.resultOverlayVisible = false
    state.message = '選出跟 TARGET 相同的顏色！'
    _handlers.startGameTimer()
  },
  answer: (index: number) => {
    if (state.status !== 'playing') return
    const result = engine.answer(index)
    _handlers.syncSnapshot()
    if (result.correct) {
      _handlers.showFeedback('correct', index)
      state.message = `答對！+${result.scoreDelta} 分`
    } else {
      _handlers.showFeedback('wrong', index)
      state.message = `答錯了，扣 ${WRONG_TIME_PENALTY_SEC} 秒`
    }
    if (result.gameOver) _actions.finishGame()
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
    state.message = '選出跟 TARGET 相同的顏色！'
  },
  finishGame: () => {
    _handlers.stopGameTimer()
    _handlers.stopFeedbackTimer()
    state.feedback = null
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
    state.feedback = null
    state.waitingOverlayVisible = false
    state.status = 'gameover'
    state.message = '本局已結束。'
    state.resultOverlayVisible = true
    _actions.recordHistory()
  }
}

const click = {
  start: () => _actions.startPlay(),
  answer: (index: number) => _actions.answer(index),
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
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <main class="cm-page" :class="`state-${state.status}`">
    <div class="cm-overlay" />

    <div v-if="state.waitingOverlayVisible" class="game-mask waiting-mask">
      <div class="mask-title">WELCOME</div>
      <p class="waiting-subtitle">COLOR MATCH</p>
      <p class="waiting-hint">{{ ROUND_DURATION_SEC }} SECOND RUSH · 選出跟 TARGET 相同的顏色</p>
      <button class="cm-btn waiting-btn waiting-start" type="button" @click="click.start">START</button>
      <button class="cm-btn link waiting-btn" type="button" @click="click.openRateDialog">CONVERT</button>
      <button class="cm-btn link waiting-btn" type="button" @click="click.openRuleDialog">RULE</button>
    </div>

    <div v-if="state.resultOverlayVisible" class="game-mask result-mask">
      <div class="mask-title">GAME OVER</div>
      <div class="result-list">
        <div class="result-item"><span>SCORE</span><b>{{ state.score }}</b></div>
        <div class="result-item"><span>MAX COMBO</span><b>{{ state.maxCombo }}</b></div>
        <div class="result-item"><span>CORRECT / WRONG</span><b>{{ state.correctCount }} / {{ state.wrongCount }}</b></div>
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
          <span class="cm-time" :class="{ low: lowTime }">TIME: {{ state.remainingSec }}s</span>
        </div>

        <div class="cm-frame">
          <p class="cm-target-label">TARGET</p>
          <div class="cm-target-wrap">
            <div v-if="!state.question.isStroop" class="cm-target-swatch" :style="`background:${state.question.targetHex}`" />
            <div v-else class="cm-stroop-word" :style="`color:${state.question.targetHex}`">{{ state.question.stroopWordLabel }}</div>
          </div>

          <div class="cm-options" :class="{ shake: state.feedback?.kind === 'wrong' }">
            <button v-for="(opt, idx) in state.question.options" :key="opt.id" type="button" class="cm-option"
              :class="{ 'is-correct': state.feedback?.kind === 'correct' && state.feedback.index === idx }"
              :style="`background:${opt.hex}`" :disabled="state.status !== 'playing'" @click="click.answer(idx)" />
          </div>

          <p v-if="state.feedback?.kind === 'wrong'" class="cm-wrong-banner">WRONG</p>
        </div>

        <p class="cm-message">{{ state.message }}</p>
      </section>

      <aside class="cm-side right">
        <div class="cm-help-panel">
          <p class="cm-help-title">HOW TO PLAY</p>
          <p class="cm-help-text">
            看清楚上方 TARGET 顏色（或 Stroop 題的文字顯示顏色），點擊／觸控下方對應的色塊即可得分。
            連續答對會累積 Combo 提高單題分數，答錯扣一點時間並讓 Combo 歸零。{{ ROUND_DURATION_SEC }} 秒倒數結束立即結算。ESC / P 可暫停。
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

      .cm-time.low {
        color: #ff6b5b;
        text-shadow: 0 0 8px rgba(255, 107, 91, 0.6);
        animation: cm-time-flash 0.9s ease-in-out infinite;
      }
    }

    .cm-frame {
      width: fit-content;
      margin: 16px auto 0;
      padding: 24px 32px;
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

    .cm-target-wrap {
      display: grid;
      place-items: center;
      min-height: 88px;
    }

    .cm-target-swatch {
      width: 88px;
      height: 88px;
      border-radius: 10px;
      border: 3px solid rgba(255, 255, 255, 0.25);
      box-shadow: 0 0 22px currentColor;
    }

    .cm-stroop-word {
      font-family: 'Orbitron', sans-serif;
      font-size: 2rem;
      font-weight: 900;
      letter-spacing: 0.1rem;
      text-shadow: 0 0 16px currentColor;
    }

    .cm-options {
      display: grid;
      grid-template-columns: repeat(2, 96px);
      gap: 14px;

      &.shake {
        animation: cm-shake 0.32s ease-in-out;
      }
    }

    .cm-option {
      width: 96px;
      height: 96px;
      border-radius: 12px;
      border: 3px solid rgba(255, 255, 255, 0.2);
      cursor: pointer;
      box-shadow: 0 4px 10px rgba(0, 0, 0, 0.4);
      transition: transform 0.12s ease, box-shadow 0.12s ease;

      &:hover:not(:disabled) {
        transform: translateY(-2px) scale(1.03);
      }

      &:active:not(:disabled) {
        transform: scale(0.95);
      }

      &:disabled {
        cursor: not-allowed;
        opacity: 0.9;
      }

      &.is-correct {
        animation: cm-correct-pop 0.42s ease-out;
        box-shadow: 0 0 24px 4px rgba(255, 255, 255, 0.55);
      }
    }

    .cm-wrong-banner {
      margin: 0;
      color: #ff6b5b;
      font-weight: 900;
      font-size: 1.1rem;
      letter-spacing: 0.2rem;
      text-shadow: 0 0 10px rgba(255, 107, 91, 0.7);
      animation: cm-wrong-pop 0.42s ease-out both;
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

@keyframes cm-time-flash {

  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0.5;
  }
}

@keyframes cm-correct-pop {
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
