<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useGameHistory } from '~/composables/useGameHistory'
import ArkanoidEngine, {
  ARKANOID_CONFIG,
  ARKANOID_LEVELS,
  AK_STAGE_WIDTH,
  AK_STAGE_HEIGHT,
  PADDLE_HEIGHT,
  PADDLE_Y,
  PADDLE_WIDE_MULTIPLIER,
  BALL_SIZE,
  POWER_UP_WIDTH,
  POWER_UP_HEIGHT,
  LIVES_START_AK,
  type ArkanoidSnapshot,
  type PowerUpType
} from '~/utils/arkanoidEngine'

type ArkanoidStatus = 'ready' | 'playing' | 'pause' | 'gameover'
type BallView = ArkanoidSnapshot['balls'][number]
type BrickView = ArkanoidSnapshot['bricks'][number]
type PowerUpView = ArkanoidSnapshot['powerUps'][number]

const TICK_MS = 16
const READY_START = 3
const RESULT_DELAY_MS = 500
const ACCENT = '#ef476f'
/** 測試用：跳關按鈕開關（比照 minesweeper.vue 慣例，預設關閉，非正式玩法，僅供除錯） */
const TEST_TOOLS_ENABLED = false

const router = useRouter()
const engine = new ArkanoidEngine()
const gameHistory = useGameHistory()

const state = reactive({
  status: 'ready' as ArkanoidStatus,
  paddleX: 0,
  paddleWidth: 0,
  balls: [] as BallView[],
  bricks: [] as BrickView[],
  powerUps: [] as PowerUpView[],
  score: 0,
  level: 1,
  lives: LIVES_START_AK,
  combo: 0,
  maxCombo: 0,
  comboMultiplier: 1,
  wideMsLeft: 0,
  slowMsLeft: 0,
  hasUnlaunched: true,
  hitFlashes: [] as Array<{ id: number; x: number; y: number }>,
  transientMessage: '',
  stageShake: false,
  message: '按「開始」後用 ←/→ 或 A/D 移動擋板，空白鍵發球。',
  rewardMessage: '',
  waitingOverlayVisible: true,
  readyOverlayVisible: false,
  readyCountdownValue: READY_START,
  resultOverlayVisible: false,
  rateDialogOpen: false,
  ruleDialogOpen: false,
  /** 測試用：生命無限開關（見 arkanoidEngine.ts infiniteLives，僅供除錯，預設關閉） */
  debugInfiniteLives: false
})

const ARKANOID_RULE = {
  description:
    'BREAKOUT 的進階版本：←/→ 或 A/D 移動擋板，空白鍵發球；球撞擊磚塊會使其消失並得分。' +
    '部分磚塊需要多次命中（Multi-Hit）才會摧毀，部分磚塊會左右移動（Moving Brick）。磚塊摧毀時有機率掉落道具膠囊，' +
    '擋板接住即生效：WIDE 讓擋板暫時變寬、SLOW 讓球暫時變慢、MULTI_BALL 立即分裂出更多球。' +
    '有多顆球同時在場時，只有全部球都掉出場地才會扣一命。清光整關磚塊即進入下一關。',
  scoreRule:
    'SCORE ＝ 每摧毀一顆磚塊的基礎分＋Multi-Hit 層數加成，並乘上目前 COMBO 倍率；連續命中磚塊會累積 COMBO，' +
    '碰到擋板或失去一命會重置 COMBO。開放式計分無上限。',
  levelsTitle: 'POWER-UP',
  levels: [
    { level: 'WIDE', condition: `擋板暫時變寬 ${PADDLE_WIDE_MULTIPLIER}× ，持續 ${ARKANOID_CONFIG.powerUpDurationMs / 1000} 秒` },
    { level: 'SLOW', condition: `球速暫時降為 ${ARKANOID_CONFIG.slowMultiplier}× ，持續 ${ARKANOID_CONFIG.powerUpDurationMs / 1000} 秒` },
    { level: 'MULTI_BALL', condition: `立即為每顆球分裂一顆新球，上限 ${ARKANOID_CONFIG.multiBallMax} 顆` }
  ],
  note: '本次僅實作 WIDE／SLOW／MULTI_BALL 三種道具，FIRE 與 Boss 關卡留待後續版本擴充。'
}

let tickTimer: ReturnType<typeof setInterval> | null = null
let readyTimer: ReturnType<typeof setInterval> | null = null
let shakeTimer: ReturnType<typeof setTimeout> | null = null
let transientMessageTimer: ReturnType<typeof setTimeout> | null = null
let resultDelayTimer: ReturnType<typeof setTimeout> | null = null
let flashIdSeq = 1
let leftHeld = false
let rightHeld = false

const statusText = computed(() => {
  if (state.status === 'playing') return 'PLAYING'
  if (state.status === 'pause') return 'PAUSE'
  if (state.status === 'gameover') return 'GAME OVER'
  return 'READY'
})
const statusClass = computed(() => {
  if (state.status === 'playing') return 'is-playing'
  if (state.status === 'pause') return 'is-pause'
  if (state.status === 'gameover') return 'is-gameover'
  return 'is-ready'
})
const canResumeFromPause = computed(
  () =>
    state.status === 'pause' &&
    !state.waitingOverlayVisible &&
    !state.readyOverlayVisible &&
    !state.resultOverlayVisible
)
const canPauseWhilePlaying = computed(() => state.status === 'playing')
const stageStyle = computed(() => `width:${AK_STAGE_WIDTH}px; height:${AK_STAGE_HEIGHT}px;`)

/** 私有工具方法：snapshot 同步、計時器管理、樣式字串 */
const _handlers = {
  syncState: () => {
    const snap = engine.getSnapshot()
    state.paddleX = snap.paddleX
    state.paddleWidth = snap.paddleWidth
    state.balls = snap.balls
    state.bricks = snap.bricks
    state.powerUps = snap.powerUps
    state.score = snap.score
    state.level = snap.level
    state.lives = snap.lives
    state.combo = snap.combo
    state.maxCombo = snap.maxCombo
    state.comboMultiplier = snap.comboMultiplier
    state.wideMsLeft = snap.wideMsLeft
    state.slowMsLeft = snap.slowMsLeft
    state.hasUnlaunched = snap.hasUnlaunched
  },
  stopTickTimer: () => {
    if (tickTimer) {
      clearInterval(tickTimer)
      tickTimer = null
    }
  },
  stopReadyTimer: () => {
    if (readyTimer) {
      clearInterval(readyTimer)
      readyTimer = null
    }
  },
  stopShakeTimer: () => {
    if (shakeTimer) {
      clearTimeout(shakeTimer)
      shakeTimer = null
    }
  },
  stopTransientMessageTimer: () => {
    if (transientMessageTimer) {
      clearTimeout(transientMessageTimer)
      transientMessageTimer = null
    }
  },
  stopResultDelayTimer: () => {
    if (resultDelayTimer) {
      clearTimeout(resultDelayTimer)
      resultDelayTimer = null
    }
  },
  triggerShake: () => {
    _handlers.stopShakeTimer()
    state.stageShake = true
    shakeTimer = setTimeout(() => {
      state.stageShake = false
      shakeTimer = null
    }, 300)
  },
  showTransientMessage: (text: string) => {
    _handlers.stopTransientMessageTimer()
    state.transientMessage = text
    transientMessageTimer = setTimeout(() => {
      state.transientMessage = ''
      transientMessageTimer = null
    }, 900)
  },
  spawnHitFlash: (x: number, y: number) => {
    const id = flashIdSeq++
    state.hitFlashes.push({ id, x, y })
    setTimeout(() => {
      state.hitFlashes = state.hitFlashes.filter((f) => f.id !== id)
    }, 260)
  },
  runReadyCountdown: (onDone: () => void) => {
    _handlers.stopReadyTimer()
    state.readyOverlayVisible = true
    state.readyCountdownValue = READY_START
    readyTimer = setInterval(() => {
      if (state.readyCountdownValue <= 1) {
        _handlers.stopReadyTimer()
        state.readyOverlayVisible = false
        onDone()
        return
      }
      state.readyCountdownValue -= 1
    }, 700)
  },
  ballStyle: (ball: BallView): string => `left:${ball.x}px; top:${ball.y}px; width:${BALL_SIZE}px; height:${BALL_SIZE}px;`,
  brickStyle: (brick: BrickView): string => `left:${brick.x}px; top:${brick.y}px; width:${brick.width}px; height:${brick.height}px;`,
  brickClass: (brick: BrickView): string[] => {
    const classes = [`tier-${Math.min(brick.hitPoints, 3)}`]
    if (brick.moving) classes.push('is-moving')
    return classes
  },
  powerUpStyle: (pu: PowerUpView): string => `left:${pu.x}px; top:${pu.y}px; width:${POWER_UP_WIDTH}px; height:${POWER_UP_HEIGHT}px;`,
  powerUpIcon: (type: PowerUpType): string => (type === 'WIDE' ? '↔' : type === 'SLOW' ? '🐢' : '✦'),
  paddleStyle: (): string => `left:${state.paddleX}px; top:${PADDLE_Y}px; width:${state.paddleWidth}px; height:${PADDLE_HEIGHT}px;`
}

const _actions = {
  recordHistory: async () => {
    state.rewardMessage = ''
    try {
      const result = await gameHistory.actions.record('arkanoid', 'ARKANOID', {
        score: state.score,
        level: state.level,
        meta: {
          maxCombo: state.maxCombo,
          levelReached: state.level
        }
      })
      if (result.coinReward > 0) {
        state.rewardMessage = result.coinCapped ? `+${result.coinReward} coin（已達今日上限）` : `+${result.coinReward} coin`
      }
    } catch {
      // 紀錄寫入失敗不影響遊戲本身，靜默略過
    }
  },
  startTickLoop: () => {
    _handlers.stopTickTimer()
    tickTimer = setInterval(() => {
      if (state.status !== 'playing') return
      const dir: -1 | 0 | 1 = leftHeld && !rightHeld ? -1 : rightHeld && !leftHeld ? 1 : 0
      const result = engine.step(dir)
      _handlers.syncState()
      for (const hit of result.brickHits) _handlers.spawnHitFlash(hit.x, hit.y)
      if (result.powerUpsCollected.length > 0) {
        state.message = `拾取道具：${result.powerUpsCollected.join(' / ')}`
      }
      if (result.levelCleared) {
        _handlers.showTransientMessage(`LEVEL ${state.level}`)
        state.message = `清光磚塊！進入第 ${state.level} 關。`
      } else if (result.lifeLost && !result.gameOver) {
        _handlers.showTransientMessage('MISS!')
        state.message = `失去一命，剩餘 ${state.lives} 命，空白鍵再次發球。`
      }
      if (result.gameOver) {
        _actions.finishGame()
      }
    }, TICK_MS)
  },
  resetGame: () => {
    _handlers.stopTickTimer()
    _handlers.stopReadyTimer()
    _handlers.stopShakeTimer()
    _handlers.stopTransientMessageTimer()
    _handlers.stopResultDelayTimer()
    leftHeld = false
    rightHeld = false
    engine.reset()
    _handlers.syncState()
    state.hitFlashes = []
    state.status = 'ready'
    state.transientMessage = ''
    state.stageShake = false
    state.waitingOverlayVisible = true
    state.resultOverlayVisible = false
    state.readyOverlayVisible = false
    state.rewardMessage = ''
    state.message = '按「開始」後用 ←/→ 或 A/D 移動擋板，空白鍵發球。'
  },
  startGame: () => {
    if (state.status === 'playing' || state.readyOverlayVisible) return
    if (state.status === 'gameover') _actions.resetGame()
    state.waitingOverlayVisible = false
    state.resultOverlayVisible = false
    _handlers.runReadyCountdown(() => {
      state.status = 'playing'
      state.message = '空白鍵發球，←/→ 或 A/D 移動擋板！'
      _actions.startTickLoop()
    })
  },
  launchBall: () => {
    if (state.status !== 'playing') return
    engine.launchBall()
    _handlers.syncState()
  },
  finishGame: () => {
    state.status = 'gameover'
    _handlers.stopTickTimer()
    state.message = '生命值歸零，遊戲結束！'
    _handlers.triggerShake()
    _handlers.showTransientMessage('GAME OVER')
    _actions.recordHistory()
    _handlers.stopResultDelayTimer()
    resultDelayTimer = setTimeout(() => {
      resultDelayTimer = null
      state.resultOverlayVisible = true
    }, RESULT_DELAY_MS)
  },
  pauseGame: () => {
    if (state.status !== 'playing') return
    state.status = 'pause'
    state.message = '已暫停'
    _handlers.stopTickTimer()
  },
  resumeGame: () => {
    if (!canResumeFromPause.value) return
    state.status = 'playing'
    state.message = '進行中...'
    _actions.startTickLoop()
  },
  playAgain: () => {
    _actions.resetGame()
    _actions.startGame()
  },
  endGameNow: () => {
    if (state.status === 'ready' || state.status === 'gameover') return
    _handlers.stopTickTimer()
    _handlers.stopReadyTimer()
    _handlers.stopResultDelayTimer()
    state.status = 'gameover'
    state.waitingOverlayVisible = false
    state.readyOverlayVisible = false
    state.resultOverlayVisible = true
    state.message = '本局已結束。'
    _actions.recordHistory()
  },
  /**
   * 測試用：直接跳到指定關卡開局，略過「必須依序清光磚塊過關」的正常流程（見
   * arkanoidEngine.ts jumpToLevel，這裡是測試工具、不是正式玩法，UI 上刻意跟正常操作區隔）。
   * 跳關會重置分數／生命／Combo，避免測試分數混進正式紀錄；直接進入 playing，略過 READY 倒數，
   * 方便連續測試多關。
   */
  testJumpToLevel: (level: number) => {
    _handlers.stopTickTimer()
    _handlers.stopReadyTimer()
    _handlers.stopShakeTimer()
    _handlers.stopTransientMessageTimer()
    _handlers.stopResultDelayTimer()
    leftHeld = false
    rightHeld = false
    engine.jumpToLevel(level)
    _handlers.syncState()
    state.hitFlashes = []
    state.transientMessage = ''
    state.stageShake = false
    state.waitingOverlayVisible = false
    state.readyOverlayVisible = false
    state.resultOverlayVisible = false
    state.rewardMessage = ''
    state.status = 'playing'
    state.message = `【測試模式】直接跳至第 ${level} 關，分數／生命已重置。`
    _actions.startTickLoop()
  }
}

const onArkanoidKeydown = (event: KeyboardEvent) => {
  const key = event.key.toLowerCase()
  if (key === 'escape' || key === 'p') {
    if (state.status === 'playing') _actions.pauseGame()
    else if (state.status === 'pause') _actions.resumeGame()
    event.preventDefault()
    return
  }
  if (key === 'arrowleft' || key === 'a') {
    leftHeld = true
    event.preventDefault()
    return
  }
  if (key === 'arrowright' || key === 'd') {
    rightHeld = true
    event.preventDefault()
    return
  }
  if (key === ' ' || key === 'spacebar') {
    if (!event.repeat) _actions.launchBall()
    event.preventDefault()
  }
}

const onArkanoidKeyup = (event: KeyboardEvent) => {
  const key = event.key.toLowerCase()
  if (key === 'arrowleft' || key === 'a') leftHeld = false
  if (key === 'arrowright' || key === 'd') rightHeld = false
}

const click = {
  start: () => _actions.startGame(),
  pause: () => _actions.pauseGame(),
  resume: () => _actions.resumeGame(),
  replay: () => _actions.resetGame(),
  restart: () => _actions.playAgain(),
  end: () => _actions.endGameNow(),
  again: () => _actions.playAgain(),
  exit: () => router.replace('/game-hall'),
  stageTap: () => _actions.launchBall(),
  testLevel: (level: number) => _actions.testJumpToLevel(level),
  /** 測試用：切換生命無限，直接反映到 engine（不觸碰對局狀態，見 arkanoidEngine.ts） */
  toggleInfiniteLives: () => {
    state.debugInfiniteLives = !state.debugInfiniteLives
    engine.infiniteLives = state.debugInfiniteLives
  },
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

onMounted(() => {
  gameHistory.ensureLoaded().catch(() => undefined)
  _actions.resetGame()
  state.waitingOverlayVisible = true
  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', onArkanoidKeydown)
    window.addEventListener('keyup', onArkanoidKeyup)
  }
})

onBeforeUnmount(() => {
  _handlers.stopTickTimer()
  _handlers.stopReadyTimer()
  _handlers.stopShakeTimer()
  _handlers.stopTransientMessageTimer()
  _handlers.stopResultDelayTimer()
  if (typeof window !== 'undefined') {
    window.removeEventListener('keydown', onArkanoidKeydown)
    window.removeEventListener('keyup', onArkanoidKeyup)
  }
})
</script>

<template>
  <main class="ak-page" :class="`state-${state.status}`">
    <div class="ak-overlay" />

    <div v-if="state.waitingOverlayVisible" class="game-mask waiting-mask">
      <div class="mask-title">WELCOME</div>
      <p class="waiting-subtitle">ARKANOID</p>
      <p class="waiting-hint">BREAKOUT 進階版 · Multi-Hit／Moving Brick／Power-Up</p>
      <button class="ak-btn waiting-btn waiting-start" type="button" @click="click.start">START</button>
      <button class="ak-btn link waiting-btn" type="button" @click="click.openRateDialog">CONVERT</button>
      <button class="ak-btn link waiting-btn" type="button" @click="click.openRuleDialog">RULE</button>
    </div>

    <div v-if="state.readyOverlayVisible" class="game-mask ready-mask">
      <div class="mask-title">READY</div>
      <div class="mask-count">{{ state.readyCountdownValue }}</div>
    </div>

    <div v-if="state.status === 'pause'" class="game-mask pause-mask">
      <div class="mask-title">PAUSED</div>
      <div class="result-actions">
        <button class="ak-btn" type="button" @click="click.resume">RESUME</button>
        <button class="ak-btn" type="button" @click="click.restart">RESTART</button>
        <button class="ak-btn danger" type="button" @click="click.exit">EXIT</button>
      </div>
    </div>

    <div v-if="state.resultOverlayVisible" class="game-mask result-mask">
      <div class="mask-title">GAME OVER</div>
      <div class="result-list">
        <div class="result-item"><span>SCORE</span><b>{{ state.score }}</b></div>
        <div class="result-item"><span>LEVEL</span><b>{{ state.level }}</b></div>
        <div class="result-item"><span>MAX COMBO</span><b>{{ state.maxCombo }}</b></div>
      </div>
      <p v-if="state.rewardMessage" class="result-reward">{{ state.rewardMessage }}</p>
      <div class="result-actions">
        <button class="ak-btn" type="button" @click="click.again">AGAIN</button>
        <button class="ak-btn danger" type="button" @click="click.exit">EXIT</button>
      </div>
    </div>

    <GameRateDialog :visible="state.rateDialogOpen" game-key="arkanoid" game-name="ARKANOID" :accent-color="ACCENT"
      @close="click.closeRateDialog" />
    <GameRuleDialog :visible="state.ruleDialogOpen" game-name="ARKANOID" :accent-color="ACCENT" v-bind="ARKANOID_RULE"
      @close="click.closeRuleDialog" />

    <section class="ak-shell">
      <aside class="ak-side left">
        <button class="ak-btn" type="button" :disabled="!canResumeFromPause" @click="click.resume">START</button>
        <button class="ak-btn" type="button" :disabled="!canPauseWhilePlaying" @click="click.pause">PAUSE</button>
        <button class="ak-btn" type="button" @click="click.replay">REPLAY</button>
        <button class="ak-btn link" type="button" @click="click.end">END</button>
        <button class="ak-btn" type="button" @click="click.openRateDialog">CONVERT</button>
        <button class="ak-btn" type="button" @click="click.openRuleDialog">RULE</button>
      </aside>

      <section class="ak-center">
        <header class="ak-title-wrap">
          <h1 class="ak-title">ARKANOID</h1>
          <p class="ak-status" :class="statusClass">{{ statusText }}</p>
        </header>

        <div class="ak-frame">
          <div class="ak-stage" :class="{ shake: state.stageShake }" :style="stageStyle"
            @pointerdown.prevent="click.stageTap">
            <div v-for="brick in state.bricks" :key="brick.id" class="ak-brick" :class="_handlers.brickClass(brick)"
              :style="_handlers.brickStyle(brick)" />
            <div v-for="pu in state.powerUps" :key="pu.id" class="ak-powerup" :class="`is-${pu.type.toLowerCase()}`"
              :style="_handlers.powerUpStyle(pu)">{{ _handlers.powerUpIcon(pu.type) }}</div>
            <div v-for="ball in state.balls" :key="ball.id" class="ak-ball" :style="_handlers.ballStyle(ball)" />
            <div class="ak-paddle" :class="{ 'is-wide': state.wideMsLeft > 0 }" :style="_handlers.paddleStyle()" />
            <div v-for="flash in state.hitFlashes" :key="flash.id" class="ak-flash"
              :style="`left:${flash.x}px; top:${flash.y}px;`" />

            <div v-if="state.transientMessage" class="ak-transient"
              :class="{ 'is-over': state.transientMessage === 'GAME OVER' }">
              {{ state.transientMessage }}
            </div>
          </div>

          <div class="ak-panel">
            <span>SCORE: {{ state.score }}</span>
            <span>LEVEL: {{ state.level }}</span>
            <span>LIVES: {{ state.debugInfiniteLives ? '∞' : state.lives }}</span>
            <span>COMBO: {{ state.combo }} (x{{ state.comboMultiplier.toFixed(2) }})</span>
          </div>
          <div class="ak-effects">
            <span class="ak-effect-tag" :class="{ 'is-hidden': state.wideMsLeft <= 0 }">WIDE {{ Math.ceil(state.wideMsLeft / 1000)
            }}s</span>
            <span class="ak-effect-tag" :class="{ 'is-hidden': state.slowMsLeft <= 0 }">SLOW {{ Math.ceil(state.slowMsLeft / 1000)
            }}s</span>
          </div>
        </div>

        <p class="ak-message">{{ state.message }}</p>

        <div v-if="TEST_TOOLS_ENABLED" class="ak-debug-toggle">
          <button type="button" class="ak-debug-toggle-btn" :class="{ active: state.debugInfiniteLives }"
            @click="click.toggleInfiniteLives">
            ❤️ 測試：生命無限 {{ state.debugInfiniteLives ? 'ON' : 'OFF' }}
          </button>
        </div>

        <div v-if="TEST_TOOLS_ENABLED" class="ak-debug-levels">
          <span class="ak-debug-levels-label">🧪 測試：跳至關卡</span>
          <button v-for="(lv, idx) in ARKANOID_LEVELS" :key="idx" type="button" class="ak-level-jump"
            :class="{ active: state.status === 'playing' && state.level === idx + 1 }"
            :title="`Ball Speed ×${lv.ballSpeedMul}`" @click="click.testLevel(idx + 1)">
            {{ idx + 1 }}
          </button>
        </div>
      </section>

      <aside class="ak-side right">
        <div class="ak-help-panel">
          <p class="ak-help-title">HOW TO PLAY</p>
          <p class="ak-help-text">
            ←/→ 或 A/D 移動擋板，空白鍵發球／點擊畫面發球。部分磚塊需多次命中才會摧毀，部分磚塊會左右移動。
            接住掉落的道具膠囊：WIDE 擋板變寬、SLOW 球變慢、MULTI_BALL 立即分裂新球。多顆球同時存在時，
            全部離開場地才會扣一命。ESC／P 可暫停。
          </p>
        </div>
      </aside>
    </section>
  </main>
</template>

<style scoped lang="scss">
.ak-page {
  --accent: #ef476f;
  position: relative;
  min-height: 100vh;
  display: grid;
  place-items: center;
  background: radial-gradient(circle at top, #26071a, #0c0207 60%);
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
    background: radial-gradient(circle at 20% 20%, rgba(239, 71, 105, 0.18), transparent 45%),
      radial-gradient(circle at 80% 70%, rgba(255, 148, 180, 0.1), transparent 40%);
    filter: blur(40px);
    animation: ambient-drift 12s ease-in-out infinite alternate;
  }

  &::after {
    background: linear-gradient(115deg, rgba(239, 71, 105, 0.05), rgba(0, 0, 0, 0));
    animation: ambient-pulse 4.6s ease-in-out infinite;
  }

  .ak-overlay {
    position: absolute;
    inset: 0;
    background-image: linear-gradient(rgba(239, 71, 105, 0.05) 1px, transparent 1px),
      linear-gradient(90deg, rgba(239, 71, 105, 0.05) 1px, transparent 1px);
    background-size: 28px 28px;
    pointer-events: none;
    z-index: 0;
    animation: grid-drift 14s linear infinite;
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
      text-shadow: 0 0 18px rgba(239, 71, 105, 0.5);
    }

    .mask-count {
      color: var(--accent);
      font-size: clamp(3rem, 12vw, 7rem);
      font-weight: 900;
      line-height: 1;
    }

    &.waiting-mask {
      background: rgba(0, 0, 0, 0.88);

      .waiting-subtitle {
        margin: 0;
        color: #ff9fb8;
        letter-spacing: 0.3rem;
        font-size: 1.05rem;
        font-weight: 800;
      }

      .waiting-hint {
        margin: 0;
        color: #d98ba0;
        font-size: 0.78rem;
        letter-spacing: 0.04em;
      }

      .waiting-btn {
        width: 200px;
      }
    }

    &.result-mask,
    &.pause-mask {
      .result-list {
        display: grid;
        gap: 8px;
        width: 280px;
      }

      .result-item {
        display: flex;
        justify-content: space-between;
        border: 1px solid rgba(239, 71, 105, 0.4);
        background: rgba(46, 8, 22, 0.65);
        color: #ffe1e9;
        padding: 8px 10px;
        font-variant-numeric: tabular-nums;
      }

      .result-reward {
        margin: 8px 0 0;
        color: #ffe066;
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
  }

  .ak-shell {
    position: relative;
    z-index: 1;
    width: min(1100px, 100%);
    padding: 24px;
    display: grid;
    grid-template-columns: 180px 1fr 200px;
    gap: 20px;
    align-items: center;
  }

  .ak-side {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .ak-btn {
    position: relative;
    overflow: hidden;
    border: 1px solid rgba(239, 71, 105, 0.45);
    border-radius: 6px;
    padding: 10px 12px;
    background: rgba(46, 8, 22, 0.75);
    color: #ff9fb8;
    font-weight: 700;
    letter-spacing: 0.5px;
    cursor: pointer;
    transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;

    &::after {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(105deg, transparent 35%, rgba(255, 210, 220, 0.25) 50%, transparent 65%);
      transform: translateX(-150%);
      transition: transform 0.35s ease;
      pointer-events: none;
    }

    &:hover {
      border-color: var(--accent);
      box-shadow: 0 0 12px rgba(239, 71, 105, 0.4);
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
      border-color: rgba(255, 120, 90, 0.5);
      color: #ff9d7d;
    }
  }

  .ak-center {
    text-align: center;

    .ak-title-wrap {
      margin-bottom: 8px;
    }

    .ak-title {
      margin: 0;
      color: var(--accent);
      font-size: clamp(1.6rem, 4.6vw, 2.6rem);
      letter-spacing: 0.12rem;
      font-weight: 900;
      text-shadow: 0 0 14px rgba(239, 71, 105, 0.55);
    }

    .ak-status {
      margin: 2px 0 0;
      color: #ffe1e9;
      font-size: 0.9rem;
      letter-spacing: 0.2rem;

      &.is-playing {
        color: #ff9fb8;
      }

      &.is-pause {
        color: #ffcc33;
      }

      &.is-gameover {
        color: #ff5e5e;
      }
    }

    .ak-frame {
      width: fit-content;
      margin: 12px auto 0;
      padding: 12px;
      background: #1a0510;
      border: 10px solid #470f26;
      border-radius: 18px;
      box-shadow: 0 0 0 1px rgba(239, 71, 105, 0.2), 0 0 24px rgba(239, 71, 105, 0.18);
    }

    .ak-stage {
      box-sizing: content-box;
      position: relative;
      background: linear-gradient(180deg, #0f0209 0%, #22081a 100%);
      border: 2px solid #000;
      border-radius: 8px;
      overflow: hidden;
      cursor: pointer;
      touch-action: none;
      user-select: none;
      -webkit-user-select: none;

      &.shake {
        animation: stage-shake 300ms ease-out;
      }

      .ak-brick {
        position: absolute;
        border-radius: 2px;
        background: #ef476f;
        box-shadow: 0 0 6px rgba(239, 71, 105, 0.55), inset 0 0 4px rgba(255, 255, 255, 0.2);

        &.tier-2 {
          background: #f78c6b;
        }

        &.tier-3 {
          background: #ffd166;
        }

        &.is-moving {
          box-shadow: 0 0 10px rgba(255, 209, 102, 0.8), inset 0 0 4px rgba(255, 255, 255, 0.3);
        }
      }

      .ak-ball {
        position: absolute;
        border-radius: 50%;
        background: radial-gradient(circle at 35% 35%, #fff, #ffd1dc 60%, #ff9fb8);
        box-shadow: 0 0 8px rgba(255, 159, 184, 0.85);
      }

      .ak-paddle {
        position: absolute;
        border-radius: 4px;
        background: linear-gradient(180deg, #ff9fb8, #ef476f);
        box-shadow: 0 0 10px rgba(239, 71, 105, 0.7);
        transition: width 0.2s ease;

        &.is-wide {
          box-shadow: 0 0 14px rgba(255, 209, 102, 0.85);
        }
      }

      .ak-powerup {
        position: absolute;
        display: grid;
        place-items: center;
        border-radius: 4px;
        font-size: 10px;
        color: #1a0510;
        background: #ffe066;
        box-shadow: 0 0 8px rgba(255, 224, 102, 0.75);

        &.is-slow {
          background: #67e8f9;
        }

        &.is-multi_ball {
          background: #c4b5fd;
        }
      }

      .ak-flash {
        position: absolute;
        width: 4px;
        height: 4px;
        border-radius: 50%;
        background: #fff;
        box-shadow: 0 0 12px 6px rgba(255, 224, 102, 0.8);
        pointer-events: none;
        animation: flash-pop 260ms ease-out both;
      }

      .ak-transient {
        position: absolute;
        top: 42%;
        left: 50%;
        transform: translate(-50%, -50%);
        font-family: 'Press Start 2P', monospace;
        font-size: 15px;
        color: #ffe066;
        text-shadow: 0 0 10px rgba(255, 224, 102, 0.85);
        letter-spacing: 0.08em;
        white-space: nowrap;
        pointer-events: none;
        animation: transient-pop 0.9s ease-out both;

        &.is-over {
          color: #ff6b6b;
          text-shadow: 0 0 12px rgba(255, 107, 107, 0.9);
        }
      }
    }

    .ak-panel {
      margin-top: 10px;
      display: flex;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 6px 14px;
      color: #ff9fb8;
      font-weight: 800;
      text-shadow: 0 0 6px rgba(239, 71, 105, 0.45);
      font-variant-numeric: tabular-nums;
    }

    .ak-effects {
      margin-top: 6px;
      display: flex;
      justify-content: center;
      gap: 8px;

      .ak-effect-tag {
        border: 1px solid rgba(255, 224, 102, 0.5);
        color: #ffe066;
        border-radius: 4px;
        padding: 2px 8px;
        font-size: 0.72rem;

        /* 一開始就佔位、只切換可見度，避免道具生效/失效時面板高度跳動閃爍 */
        &.is-hidden {
          visibility: hidden;
        }
      }
    }

    .ak-message {
      margin-top: 14px;
      color: #ffe1e9;
      font-size: 0.85rem;
    }

    /* 測試用按鈕改用橘色系，跟正式操作明顯區隔（比照 minesweeper.vue 的 is-debug 慣例） */
    .ak-debug-toggle {
      margin-top: 10px;
      display: flex;
      justify-content: center;
    }

    .ak-debug-toggle-btn {
      border: 1px solid rgba(255, 180, 84, 0.4);
      border-radius: 6px;
      padding: 8px 16px;
      background: rgba(26, 5, 16, 0.8);
      color: #ffb454;
      font-weight: 700;
      letter-spacing: 0.06em;
      cursor: pointer;
      transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;

      &:hover {
        border-color: #ffb454;
      }

      &.active {
        background: rgba(255, 180, 84, 0.22);
        border-color: #ffb454;
        color: #fff0d9;
        box-shadow: 0 0 12px rgba(255, 180, 84, 0.4);
      }
    }

    .ak-debug-levels {
      margin-top: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-wrap: wrap;
      gap: 6px;
    }

    .ak-debug-levels-label {
      color: #ffb454;
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.05em;
      opacity: 0.85;
    }

    .ak-level-jump {
      width: 28px;
      height: 28px;
      border: 1px solid rgba(255, 180, 84, 0.4);
      border-radius: 6px;
      background: rgba(26, 5, 16, 0.8);
      color: #ffb454;
      font-weight: 800;
      font-size: 0.8rem;
      cursor: pointer;
      transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;

      &:hover {
        border-color: #ffb454;
      }

      &.active {
        background: rgba(255, 180, 84, 0.22);
        border-color: #ffb454;
        color: #fff0d9;
        box-shadow: 0 0 10px rgba(255, 180, 84, 0.5);
      }
    }
  }

  .ak-help-panel {
    border: 1px solid rgba(239, 71, 105, 0.3);
    border-radius: 8px;
    padding: 12px;
    background: rgba(46, 8, 22, 0.5);

    .ak-help-title {
      margin: 0 0 6px;
      color: #ff9fb8;
      font-size: 0.75rem;
      letter-spacing: 0.14rem;
      font-weight: 800;
    }

    .ak-help-text {
      margin: 0;
      color: #ffe1e9;
      font-size: 0.78rem;
      line-height: 1.6;
    }
  }
}

@keyframes flash-pop {
  0% {
    opacity: 1;
    transform: scale(0.6);
  }

  100% {
    opacity: 0;
    transform: scale(2.4);
  }
}

@keyframes transient-pop {
  0% {
    opacity: 0;
    transform: translate(-50%, -35%) scale(0.7);
  }

  25% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1.1);
  }

  100% {
    opacity: 0;
    transform: translate(-50%, -60%) scale(1);
  }
}

@keyframes ambient-drift {
  0% {
    transform: translate(-1.5%, -1%) scale(1);
  }

  100% {
    transform: translate(1.5%, 1%) scale(1.06);
  }
}

@keyframes ambient-pulse {

  0%,
  100% {
    opacity: 0.35;
  }

  50% {
    opacity: 0.75;
  }
}

@keyframes grid-drift {
  0% {
    transform: translate(0, 0);
  }

  100% {
    transform: translate(14px, 14px);
  }
}

@keyframes stage-shake {
  0% {
    transform: translate3d(0, 0, 0);
  }

  25% {
    transform: translate3d(-5px, 2px, 0);
  }

  50% {
    transform: translate3d(5px, -2px, 0);
  }

  75% {
    transform: translate3d(-3px, 2px, 0);
  }

  100% {
    transform: translate3d(0, 0, 0);
  }
}

@media (max-width: 980px) {
  .ak-page {
    .ak-shell {
      grid-template-columns: 1fr;
      padding: 16px;
    }

    .ak-side {
      flex-direction: row;
      flex-wrap: wrap;
      justify-content: center;
    }
  }
}
</style>
