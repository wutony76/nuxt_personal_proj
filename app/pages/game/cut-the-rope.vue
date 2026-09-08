<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useGameHistory } from '~/composables/useGameHistory'
import CutTheRopeEngine, {
  CTR_STAGE_WIDTH,
  CTR_STAGE_HEIGHT,
  TOTAL_LEVELS,
  CANDY_RADIUS,
  STAR_RADIUS,
  GOAL_RADIUS,
  SPIKE_RADIUS,
  ROPE_HIT_RADIUS,
  SCORE_PER_STAR,
  LEVEL_CLEAR_BASE_SCORE,
  type CutTheRopeStatus,
  type CandyState,
  type RopeState,
  type StarState,
  type Vec2
} from '~/utils/cutTheRopeEngine'

/**
 * CUT THE ROPE — 全專案第 30 款遊戲。
 *
 * 核心邏輯抽到 cutTheRopeEngine.ts（純 TS，簡化數值物理：重力 + 距離約束模擬繩子擺盪，明確不用
 * 任何物理引擎）。頁面只以 reactive() 鏡像 engine 的 getSnapshot()，Logic / Rendering 分離。
 * 繩子用 SVG line 畫（比照 GameHallInvasionLane.vue 已經在用的 SVG-in-DOM 手法，不是 Canvas），
 * 視覺細線疊在一條透明粗線上做點擊熱區，避免玩家「線太細點不到」。
 */

const ACCENT = '#fbbf24'
const TICK_MS = 16
/** 過關／失敗後的短暫凍結時間（比照 frogger 的 _pauseThen 手法），凍結期間不 tick，只顯示提示文字 */
const FREEZE_MS = 700

const router = useRouter()
const engine = new CutTheRopeEngine()
const gameHistory = useGameHistory()

const state = reactive({
  status: 'idle' as CutTheRopeStatus,
  levelIndex: 1,
  candy: engine.getSnapshot().candy as CandyState,
  ropes: engine.getSnapshot().ropes as RopeState[],
  stars: engine.getSnapshot().stars as StarState[],
  goal: engine.getSnapshot().goal as Vec2,
  spikes: engine.getSnapshot().spikes as Vec2[],
  starsThisAttempt: 0,
  totalScore: 0,
  totalStars: 0,
  /** 過關／失敗時短暫凍結畫面顯示提示，之後自動繼續（CLEARED／FAILED／null） */
  freezeMessage: null as 'CLEARED' | 'FAILED' | null,
  message: '點擊繩子剪斷，讓糖果送進終點！',
  rewardMessage: '',
  waitingOverlayVisible: true,
  resultOverlayVisible: false,
  rateDialogOpen: false,
  ruleDialogOpen: false
})

const CUT_THE_ROPE_RULE = {
  description:
    `割繩子解謎：點擊／觸控繩子即可剪斷，糖果會受重力與繩子擺盪影響移動，送進終點即過關，共 ${TOTAL_LEVELS} 關。` +
    '沿路收集星星額外加分，部分關卡有多條繩子（剪的順序會影響結果）或尖刺（碰到即失敗，重來目前這一關，' +
    '不影響已經過關的分數）。有些關卡需要先讓糖果擺盪借力，抓對時機再剪，直線下墜不一定能到終點。',
  scoreRule:
    `每過一關得 ${LEVEL_CLEAR_BASE_SCORE} 分，收集到的每顆星星再 +${SCORE_PER_STAR} 分，分數跨關累計。` +
    '失敗只會重來當前這關，不會扣分、也不會遺失已經過關拿到的分數。',
  levelsTitle: '關卡進度',
  levels: [{ level: `LEVEL 1 ~ ${TOTAL_LEVELS}`, condition: '難度依序漸增：單繩直剪 → 加星星 → 需要擺盪借力 → 多繩決定剪的順序 → 加入尖刺' }],
  note: 'ESC / P 可暫停，暫停期間不會計算物理。'
}

let tickTimer: ReturnType<typeof setInterval> | null = null
let freezeTimer: ReturnType<typeof setTimeout> | null = null

const stageStyle = computed(() => `width:${CTR_STAGE_WIDTH}px; height:${CTR_STAGE_HEIGHT}px;`)
const candyStyle = computed(
  () => `left:${state.candy.x - CANDY_RADIUS}px; top:${state.candy.y - CANDY_RADIUS}px; width:${CANDY_RADIUS * 2}px; height:${CANDY_RADIUS * 2}px;`
)
const goalStyle = computed(
  () => `left:${state.goal.x - GOAL_RADIUS}px; top:${state.goal.y - GOAL_RADIUS}px; width:${GOAL_RADIUS * 2}px; height:${GOAL_RADIUS * 2}px;`
)

const statusText = computed(() => {
  if (state.status === 'playing') return 'PLAYING'
  if (state.status === 'paused') return 'PAUSED'
  if (state.status === 'gameover') return 'ALL CLEAR!'
  return 'READY'
})
const canPauseWhilePlaying = computed(() => state.status === 'playing' && !state.freezeMessage)
const canResumeFromPause = computed(
  () => state.status === 'paused' && !state.waitingOverlayVisible && !state.resultOverlayVisible
)

/** 私有工具方法：快照同步、計時器管理、格子外觀 */
const _handlers = {
  syncSnapshot: () => {
    const snap = engine.getSnapshot()
    state.status = snap.status
    state.levelIndex = snap.levelIndex
    state.candy = snap.candy
    state.ropes = snap.ropes
    state.stars = snap.stars
    state.goal = snap.goal
    state.spikes = snap.spikes
    state.starsThisAttempt = snap.starsThisAttempt
    state.totalScore = snap.totalScore
    state.totalStars = snap.totalStars
  },
  stopTickTimer: () => {
    if (tickTimer) {
      clearInterval(tickTimer)
      tickTimer = null
    }
  },
  startTickTimer: () => {
    _handlers.stopTickTimer()
    tickTimer = setInterval(() => {
      if (state.status !== 'playing' || state.freezeMessage) return
      const result = engine.tick(TICK_MS)
      _handlers.syncSnapshot()
      if (result.levelCleared) {
        state.message = `過關！+${result.levelScoreGained} 分`
        _actions.freezeThen('CLEARED', result.allCleared)
      } else if (result.failed) {
        state.message = '失敗了，重新挑戰這一關！'
        _actions.freezeThen('FAILED', false)
      }
    }, TICK_MS)
  },
  stopFreezeTimer: () => {
    if (freezeTimer) {
      clearTimeout(freezeTimer)
      freezeTimer = null
    }
  }
}

const _actions = {
  recordHistory: async () => {
    state.rewardMessage = ''
    try {
      const result = await gameHistory.actions.record('cutTheRope', 'CUT THE ROPE', {
        score: state.totalScore,
        level: state.levelIndex,
        meta: {
          totalStars: state.totalStars
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
    _handlers.stopTickTimer()
    _handlers.stopFreezeTimer()
    engine.reset()
    _handlers.syncSnapshot()
    state.freezeMessage = null
    state.rewardMessage = ''
    state.waitingOverlayVisible = true
    state.resultOverlayVisible = false
    state.message = '點擊繩子剪斷，讓糖果送進終點！'
  },
  startPlay: () => {
    engine.start()
    _handlers.syncSnapshot()
    state.waitingOverlayVisible = false
    state.resultOverlayVisible = false
    state.message = '點擊繩子剪斷，讓糖果送進終點！'
    _handlers.startTickTimer()
  },
  cutRope: (ropeId: string) => {
    if (state.status !== 'playing' || state.freezeMessage) return
    engine.cutRope(ropeId)
    _handlers.syncSnapshot()
  },
  /** 過關／失敗後短暫凍結畫面（停止 tick，只顯示提示），時間到自動繼續（比照 frogger 的 _pauseThen） */
  freezeThen: (kind: 'CLEARED' | 'FAILED', allCleared: boolean) => {
    if (allCleared) {
      _actions.finishGame()
      return
    }
    _handlers.stopFreezeTimer()
    state.freezeMessage = kind
    freezeTimer = setTimeout(() => {
      state.freezeMessage = null
      freezeTimer = null
      state.message = '點擊繩子剪斷，讓糖果送進終點！'
    }, FREEZE_MS)
  },
  pause: () => {
    if (state.status !== 'playing' || state.freezeMessage) return
    engine.pause()
    _handlers.stopTickTimer()
    _handlers.syncSnapshot()
    state.message = '已暫停'
  },
  resume: () => {
    if (state.status !== 'paused') return
    engine.resume()
    _handlers.startTickTimer()
    _handlers.syncSnapshot()
    state.message = '點擊繩子剪斷，讓糖果送進終點！'
  },
  finishGame: () => {
    _handlers.stopTickTimer()
    _handlers.stopFreezeTimer()
    _handlers.syncSnapshot()
    state.resultOverlayVisible = true
    state.message = `全部 ${TOTAL_LEVELS} 關通過！`
    _actions.recordHistory()
  },
  playAgain: () => {
    _actions.resetGame()
    _actions.startPlay()
  },
  endGameNow: () => {
    _handlers.stopTickTimer()
    _handlers.stopFreezeTimer()
    state.status = 'gameover'
    state.waitingOverlayVisible = false
    state.message = '本局已結束。'
    state.resultOverlayVisible = true
    _actions.recordHistory()
  }
}

const click = {
  start: () => _actions.startPlay(),
  rope: (id: string) => _actions.cutRope(id),
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
  _handlers.stopTickTimer()
  _handlers.stopFreezeTimer()
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <main class="ctr-page" :class="`state-${state.status}`">
    <div class="ctr-overlay" />

    <div v-if="state.waitingOverlayVisible" class="game-mask waiting-mask">
      <div class="mask-title">WELCOME</div>
      <p class="waiting-subtitle">CUT THE ROPE</p>
      <p class="waiting-hint">點擊繩子剪斷，把糖果送進終點，共 {{ TOTAL_LEVELS }} 關</p>
      <button class="ctr-btn waiting-btn waiting-start" type="button" @click="click.start">START</button>
      <button class="ctr-btn link waiting-btn" type="button" @click="click.openRateDialog">CONVERT</button>
      <button class="ctr-btn link waiting-btn" type="button" @click="click.openRuleDialog">RULE</button>
    </div>

    <div v-if="state.resultOverlayVisible" class="game-mask result-mask">
      <div class="mask-title">{{ state.levelIndex >= TOTAL_LEVELS && state.status === 'gameover' ? 'ALL CLEAR!' : 'GAME OVER' }}</div>
      <div class="result-list">
        <div class="result-item"><span>SCORE</span><b>{{ state.totalScore }}</b></div>
        <div class="result-item"><span>LEVEL REACHED</span><b>{{ state.levelIndex }} / {{ TOTAL_LEVELS }}</b></div>
        <div class="result-item"><span>TOTAL STARS</span><b>{{ state.totalStars }}</b></div>
      </div>
      <p v-if="state.rewardMessage" class="result-reward">{{ state.rewardMessage }}</p>
      <div class="result-actions">
        <button class="ctr-btn" type="button" @click="click.again">PLAY AGAIN</button>
        <button class="ctr-btn danger" type="button" @click="click.exit">EXIT</button>
      </div>
    </div>

    <GameRateDialog :visible="state.rateDialogOpen" game-key="cutTheRope" game-name="CUT THE ROPE" :accent-color="ACCENT"
      @close="click.closeRateDialog" />
    <GameRuleDialog :visible="state.ruleDialogOpen" game-name="CUT THE ROPE" :accent-color="ACCENT" v-bind="CUT_THE_ROPE_RULE"
      @close="click.closeRuleDialog" />

    <section class="ctr-shell">
      <aside class="ctr-side left">
        <button class="ctr-btn" type="button" :disabled="!canResumeFromPause" @click="click.resume">START</button>
        <button class="ctr-btn" type="button" :disabled="!canPauseWhilePlaying" @click="click.pause">PAUSE</button>
        <button class="ctr-btn" type="button" @click="click.restart">RESTART</button>
        <button class="ctr-btn link" type="button" @click="click.end">END</button>
        <button class="ctr-btn" type="button" @click="click.openRateDialog">CONVERT</button>
        <button class="ctr-btn" type="button" @click="click.openRuleDialog">RULE</button>
      </aside>

      <section class="ctr-center">
        <header class="ctr-title-wrap">
          <h1 class="ctr-title">CUT THE ROPE</h1>
          <p class="ctr-status">{{ statusText }}</p>
        </header>

        <div class="ctr-panel">
          <span>SCORE: {{ state.totalScore }}</span>
          <span>LEVEL: {{ state.levelIndex }} / {{ TOTAL_LEVELS }}</span>
          <span>STARS: {{ state.totalStars }}</span>
        </div>

        <div class="ctr-frame">
          <div class="ctr-stage" :style="stageStyle">
            <svg class="ctr-ropes" :width="CTR_STAGE_WIDTH" :height="CTR_STAGE_HEIGHT">
              <template v-for="rope in state.ropes" :key="rope.id">
                <line v-if="rope.attached" class="rope-hit" :x1="rope.anchor.x" :y1="rope.anchor.y" :x2="state.candy.x" :y2="state.candy.y"
                  :stroke-width="ROPE_HIT_RADIUS * 2" @click="click.rope(rope.id)" />
                <line v-if="rope.attached" class="rope-line" :x1="rope.anchor.x" :y1="rope.anchor.y" :x2="state.candy.x" :y2="state.candy.y" />
                <circle v-if="rope.attached" class="rope-anchor" :cx="rope.anchor.x" :cy="rope.anchor.y" r="6" />
              </template>
            </svg>

            <div v-for="spike in state.spikes" :key="`${spike.x}-${spike.y}`" class="ctr-spike"
              :style="`left:${spike.x - SPIKE_RADIUS}px; top:${spike.y - SPIKE_RADIUS}px; width:${SPIKE_RADIUS * 2}px; height:${SPIKE_RADIUS * 2}px;`" />

            <div v-for="star in state.stars" :key="star.id" v-show="!star.collected" class="ctr-star"
              :style="`left:${star.pos.x - STAR_RADIUS}px; top:${star.pos.y - STAR_RADIUS}px; width:${STAR_RADIUS * 2}px; height:${STAR_RADIUS * 2}px;`">⭐</div>

            <div class="ctr-goal" :style="goalStyle" />

            <div class="ctr-candy" :style="candyStyle" />

            <div v-if="state.freezeMessage" class="ctr-freeze-banner" :class="state.freezeMessage.toLowerCase()">
              {{ state.freezeMessage === 'CLEARED' ? 'LEVEL CLEAR!' : 'OOPS!' }}
            </div>
          </div>
        </div>

        <p class="ctr-message">{{ state.message }}</p>
      </section>

      <aside class="ctr-side right">
        <div class="ctr-help-panel">
          <p class="ctr-help-title">HOW TO PLAY</p>
          <p class="ctr-help-text">
            點擊／觸控繩子即可剪斷，糖果會受重力與擺盪影響移動，碰到終點即過關。沿路收集星星額外加分，
            碰到尖刺會失敗、重來這一關（不影響已過關的分數）。有些關卡要先讓糖果擺盪借力再剪，直接剪不一定能到終點。ESC / P 可暫停。
          </p>
        </div>
      </aside>
    </section>
  </main>
</template>

<style scoped lang="scss">
.ctr-page {
  --accent: #fbbf24;
  position: relative;
  min-height: 100vh;
  display: grid;
  place-items: center;
  background: radial-gradient(circle at top, #241a05, #080502 60%);
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
    background: radial-gradient(circle at 20% 20%, rgba(251, 191, 36, 0.18), transparent 45%),
      radial-gradient(circle at 80% 70%, rgba(251, 191, 36, 0.1), transparent 40%);
    filter: blur(40px);
    animation: ctr-ambient-drift 12s ease-in-out infinite alternate;
  }

  &::after {
    background: linear-gradient(115deg, rgba(251, 191, 36, 0.06), rgba(0, 0, 0, 0));
    animation: ctr-ambient-pulse 4.6s ease-in-out infinite;
  }

  .ctr-overlay {
    position: absolute;
    inset: 0;
    background-image: linear-gradient(rgba(251, 191, 36, 0.05) 1px, transparent 1px),
      linear-gradient(90deg, rgba(251, 191, 36, 0.05) 1px, transparent 1px);
    background-size: 28px 28px;
    pointer-events: none;
    z-index: 0;
    animation: ctr-grid-drift 14s linear infinite;
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
      letter-spacing: 0.2rem;
      font-weight: 900;
      text-shadow: 0 0 18px rgba(251, 191, 36, 0.5);
    }

    &.waiting-mask {
      background: rgba(0, 0, 0, 0.88);

      .waiting-subtitle {
        margin: 0;
        color: #ffe4a3;
        letter-spacing: 0.3rem;
        font-size: 1.05rem;
        font-weight: 800;
      }

      .waiting-hint {
        margin: 0;
        max-width: 340px;
        text-align: center;
        color: #d6a94f;
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
      border: 1px solid rgba(251, 191, 36, 0.4);
      background: rgba(40, 28, 6, 0.65);
      color: #ffe9bd;
      padding: 8px 10px;
      font-variant-numeric: tabular-nums;
    }

    .result-reward {
      margin: 8px 0 0;
      color: #ffe4a3;
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

  .ctr-shell {
    position: relative;
    z-index: 1;
    width: min(1100px, 100%);
    padding: 24px;
    display: grid;
    grid-template-columns: 180px 1fr 180px;
    gap: 20px;
    align-items: start;
  }

  .ctr-side {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding-top: 160px;
  }

  .ctr-btn {
    position: relative;
    overflow: hidden;
    border: 1px solid rgba(251, 191, 36, 0.4);
    border-radius: 6px;
    padding: 10px 12px;
    background: rgba(40, 28, 6, 0.75);
    color: #f4c968;
    font-weight: 700;
    letter-spacing: 0.5px;
    cursor: pointer;
    transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;

    &::after {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(105deg, transparent 35%, rgba(255, 230, 180, 0.22) 50%, transparent 65%);
      transform: translateX(-150%);
      transition: transform 0.35s ease;
      pointer-events: none;
    }

    &:hover:not(:disabled) {
      border-color: var(--accent);
      box-shadow: 0 0 12px rgba(251, 191, 36, 0.4);
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

  .ctr-center {
    text-align: center;

    .ctr-title-wrap {
      margin-bottom: 8px;
    }

    .ctr-title {
      margin: 0;
      color: var(--accent);
      font-size: clamp(1.5rem, 4.6vw, 2.7rem);
      letter-spacing: 0.08rem;
      font-weight: 900;
      text-shadow: 0 0 14px rgba(251, 191, 36, 0.45);
    }

    .ctr-status {
      margin: 2px 0 0;
      color: #ffe4a3;
      font-size: 0.9rem;
      letter-spacing: 0.2rem;
    }

    .ctr-panel {
      margin: 10px auto 0;
      display: flex;
      justify-content: center;
      flex-wrap: wrap;
      gap: 8px 16px;
      color: #f4c968;
      font-weight: 800;
      font-size: 0.8rem;
      text-shadow: 0 0 6px rgba(251, 191, 36, 0.45);
      font-variant-numeric: tabular-nums;
    }

    .ctr-frame {
      width: fit-content;
      margin: 16px auto 0;
      padding: 10px;
      background: #1c1404;
      border: 8px solid #3a2b0a;
      border-radius: 16px;
      box-shadow: 0 0 0 1px rgba(251, 191, 36, 0.18), 0 0 26px rgba(120, 90, 20, 0.35);
    }

    .ctr-stage {
      position: relative;
      background: linear-gradient(180deg, #120c02 0%, #1c1404 100%);
      border-radius: 8px;
      overflow: hidden;
      touch-action: none;
      user-select: none;
      -webkit-user-select: none;
    }

    .ctr-ropes {
      position: absolute;
      inset: 0;
      z-index: 2;

      .rope-hit {
        stroke: transparent;
        pointer-events: stroke;
        cursor: pointer;
      }

      .rope-line {
        stroke: #e8d8b0;
        stroke-width: 3;
        pointer-events: none;
      }

      .rope-anchor {
        fill: #6b5a2a;
        pointer-events: none;
      }
    }

    .ctr-spike {
      position: absolute;
      z-index: 1;
      background: linear-gradient(180deg, #ff5e5e 0%, #b21f1f 100%);
      clip-path: polygon(50% 0%, 90% 100%, 10% 100%, 50% 30%, 90% 100%, 50% 0%, 10% 100%);
      filter: drop-shadow(0 0 6px rgba(255, 90, 90, 0.6));
    }

    .ctr-star {
      position: absolute;
      z-index: 3;
      display: grid;
      place-items: center;
      font-size: 22px;
      filter: drop-shadow(0 0 6px rgba(255, 225, 130, 0.8));
      animation: ctr-star-bob 1.6s ease-in-out infinite;
    }

    .ctr-goal {
      position: absolute;
      z-index: 1;
      border-radius: 50%;
      border: 3px dashed rgba(251, 191, 36, 0.7);
      background: radial-gradient(circle at 50% 50%, rgba(251, 191, 36, 0.18), transparent 70%);
      animation: ctr-goal-pulse 1.8s ease-in-out infinite;
    }

    .ctr-candy {
      position: absolute;
      z-index: 3;
      border-radius: 50%;
      background: radial-gradient(circle at 35% 30%, #ff8fb3, #e0457e 65%);
      border: 2px solid #8a1f4a;
      box-shadow: 0 0 10px rgba(224, 69, 126, 0.7);
    }

    .ctr-freeze-banner {
      position: absolute;
      left: 50%;
      top: 40%;
      transform: translate(-50%, -50%);
      z-index: 5;
      padding: 8px 20px;
      border-radius: 8px;
      background: rgba(0, 0, 0, 0.7);
      font-weight: 900;
      font-size: 1.3rem;
      letter-spacing: 0.15rem;
      color: #ffe4a3;
      text-shadow: 0 0 12px rgba(251, 191, 36, 0.8);

      &.failed {
        color: #ff8f8f;
        text-shadow: 0 0 12px rgba(255, 94, 94, 0.8);
      }
    }
  }

  .ctr-message {
    margin-top: 14px;
    color: #ffe4a3;
    font-size: 0.85rem;
    min-height: 1.2em;
  }

  .ctr-help-panel {
    border: 1px solid rgba(251, 191, 36, 0.3);
    border-radius: 8px;
    padding: 12px;
    background: rgba(40, 28, 6, 0.5);

    .ctr-help-title {
      margin: 0 0 6px;
      color: var(--accent);
      font-size: 0.72rem;
      letter-spacing: 0.14rem;
      font-weight: 800;
    }

    .ctr-help-text {
      margin: 0;
      color: #ffe4a3;
      font-size: 0.72rem;
      line-height: 1.6;
    }
  }
}

@keyframes ctr-ambient-drift {
  0% {
    transform: translate(-1.5%, -1%) scale(1);
  }

  100% {
    transform: translate(1.5%, 1%) scale(1.06);
  }
}

@keyframes ctr-ambient-pulse {

  0%,
  100% {
    opacity: 0.35;
  }

  50% {
    opacity: 0.75;
  }
}

@keyframes ctr-grid-drift {
  0% {
    transform: translate(0, 0);
  }

  100% {
    transform: translate(14px, 14px);
  }
}

@keyframes ctr-star-bob {

  0%,
  100% {
    transform: translateY(0);
  }

  50% {
    transform: translateY(-4px);
  }
}

@keyframes ctr-goal-pulse {

  0%,
  100% {
    opacity: 0.7;
    transform: scale(1);
  }

  50% {
    opacity: 1;
    transform: scale(1.06);
  }
}

@media (max-width: 980px) {
  .ctr-page {
    .ctr-shell {
      grid-template-columns: 1fr;
      padding: 16px;
    }

    .ctr-side {
      flex-direction: row;
      flex-wrap: wrap;
      justify-content: center;
      padding-top: 0;
    }
  }
}
</style>
