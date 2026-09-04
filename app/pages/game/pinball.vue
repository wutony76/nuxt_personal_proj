<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useGameHistory } from '~/composables/useGameHistory'
import PinballEngine, {
  PINBALL_WIDTH,
  PINBALL_HEIGHT,
  BALL_RADIUS,
  FLIPPER_RADIUS,
  FLIPPER_LENGTH,
  BUMPER_RADIUS,
  TARGET_WIDTH,
  TARGET_HEIGHT,
  HOLE_RADIUS,
  CENTER_POST_SIZE,
  LIVES_START_PB,
  type BallPb,
  type Flipper,
  type Bumper,
  type Target,
  type GoldenHole,
  type CenterPost,
  type Upgrade
} from '~/utils/pinballEngine'

type PinballStatusView = 'ready' | 'playing' | 'pause' | 'upgrade' | 'gameover'

const TICK_MS = 16
const BALL_LOST_DELAY_MS = 2000
const ACCENT = '#00f5d4'

const router = useRouter()
const engine = new PinballEngine()
const gameHistory = useGameHistory()
const stageWrapRef = ref<HTMLElement | null>(null)

const state = reactive({
  status: 'ready' as PinballStatusView,
  scale: 1,
  ball: { x: 0, y: 0, vx: 0, vy: 0, active: false } as BallPb,
  leftFlipper: null as Flipper | null,
  rightFlipper: null as Flipper | null,
  bumpers: [] as Bumper[],
  targets: [] as Target[],
  hole: null as GoldenHole | null,
  centerPost: null as CenterPost | null,
  score: 0,
  lives: LIVES_START_PB,
  ballIndex: 1,
  combo: 0,
  maxCombo: 0,
  comboMultiplier: 1,
  comboMsLeft: 0,
  feverActive: false,
  feverMsLeft: 0,
  coinsCollected: 0,
  coinBonusLivesGranted: 0,
  finalCoinBonusAmount: 0,
  finalLeftoverCoinCount: 0,
  pendingUpgradeChoices: [] as Upgrade[],
  hitFlashes: [] as Array<{ id: number; x: number; y: number; text: string }>,
  ballDocked: true,
  shakeToken: 0,
  isShaking: false,
  message: '按 START 開始，A／← 與 L 操作 Flipper，空白鍵發球。',
  rewardMessage: '',
  waitingOverlayVisible: true,
  ballLostOverlayVisible: false,
  upgradeOverlayVisible: false,
  resultOverlayVisible: false,
  rateDialogOpen: false,
  ruleDialogOpen: false
})

const PINBALL_RULE = {
  description:
    'A 控制左 Flipper，L 控制右 Flipper，空白鍵發球。球受重力持續下墜，撞到 Flipper 會依當下擺動角速度與撞擊點給予反彈與擊退，' +
    '把球往上打是核心操作。撞擊 Bumper／Target／Golden Hole 都會得分並累積 Combo，Combo 有時限，掉球會立即歸零。',
  scoreRule:
    'SCORE ＝ 基礎分 × Combo 倍率 × Fever 加成（Fever 期間 ×3）。Bumper +100、Target +200、Golden Hole +1000 並額外 +3 Combo。' +
    '四個 Target（A/B/C/D）全部命中會觸發 FEVER，持續 5 秒；Fever 結束後 Target 會重新開放挑戰。',
  levelsTitle: '目標物件',
  levels: [
    { level: 'BUMPER ×3', condition: '強力反彈，Score +100、Combo +1，有低機率掉落趣味幣' },
    { level: 'TARGET A/B/C/D', condition: '命中後亮起，Score +200、Combo +1，四個全亮觸發 FEVER' },
    { level: 'GOLDEN HOLE', condition: '位置偏刁鑽，命中 Score +1000、Combo +3、趣味幣 +5，球會重新發射回場上，不扣命' }
  ],
  note: '球掉出雙 Flipper 之間即扣一命；若還有剩餘生命會顯示 3 選 1 隨機 Upgrade，選擇後即可再次發球。3 顆球用完即 GAME OVER。' +
    '趣味幣每滿 3 枚自動兌換 1 顆球，整局最多兌換 3 次；結算時沒兌換完的趣味幣，每枚額外加 2000 分。'
}

let tickTimer: ReturnType<typeof setInterval> | null = null
let resizeObserver: ResizeObserver | null = null
let leftHeld = false
let rightHeld = false

// ---------------------------------------------------------------------------
// Sound Manager：不下載音效素材，改用 Web Audio API 產生簡單音效（開發計畫第二十節）
// ---------------------------------------------------------------------------
type SoundName = 'bumper' | 'flipper' | 'target' | 'fever' | 'hole' | 'gameover' | 'extraBall'
const SOUND_DEF: Record<SoundName, { freq: number; dur: number; type: OscillatorType }> = {
  bumper: { freq: 440, dur: 0.09, type: 'square' },
  flipper: { freq: 240, dur: 0.05, type: 'square' },
  target: { freq: 680, dur: 0.08, type: 'triangle' },
  fever: { freq: 880, dur: 0.35, type: 'sawtooth' },
  hole: { freq: 980, dur: 0.28, type: 'sine' },
  gameover: { freq: 160, dur: 0.45, type: 'sawtooth' },
  extraBall: { freq: 1200, dur: 0.3, type: 'triangle' }
}
let audioCtx: AudioContext | null = null
const playSound = (name: SoundName) => {
  if (typeof window === 'undefined') return
  try {
    if (!audioCtx) {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctor) return
      audioCtx = new Ctor()
    }
    const { freq, dur, type } = SOUND_DEF[name]
    const osc = audioCtx.createOscillator()
    const gain = audioCtx.createGain()
    osc.type = type
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0.16, audioCtx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur)
    osc.connect(gain).connect(audioCtx.destination)
    osc.start()
    osc.stop(audioCtx.currentTime + dur)
  } catch {
    // 部分瀏覽器/情境（例如尚未有使用者互動）可能丟出例外，靜默略過不影響遊戲
  }
}

const statusText = computed(() => {
  if (state.status === 'playing') return 'PLAYING'
  if (state.status === 'pause') return 'PAUSE'
  if (state.status === 'upgrade') return 'UPGRADE'
  if (state.status === 'gameover') return 'GAME OVER'
  return 'READY'
})
const statusClass = computed(() => `is-${state.status}`)
const canResumeFromPause = computed(
  () => state.status === 'pause' && !state.waitingOverlayVisible && !state.resultOverlayVisible
)
const canPauseWhilePlaying = computed(() => state.status === 'playing')
const bestScore = computed(() => Math.max(gameHistory.statsByGame.value['pinball']?.best ?? 0, state.score))
const baseScoreBeforeCoinBonus = computed(() => state.score - state.finalCoinBonusAmount)
const stageStyle = computed(() => `width:${PINBALL_WIDTH}px; height:${PINBALL_HEIGHT}px; transform: scale(${state.scale});`)

let prevBumperFlash: number[] = []
let prevTargetFlash: number[] = []
let prevHoleFlash = 0
let prevFeverActive = false
let prevCoinBonusLivesGranted = 0
let prevShakeToken = 0
let prevSnapStatus: PinballStatusView = 'ready'
let ballLostTimer: ReturnType<typeof setTimeout> | null = null
let shakeResetTimer: ReturnType<typeof setTimeout> | null = null

const _handlers = {
  syncState: () => {
    const snap = engine.getSnapshot()

    const bumperNewlyHit = snap.bumpers.some((b, i) => b.flashMsLeft > 0 && (prevBumperFlash[i] ?? 0) <= 0)
    const targetNewlyHit = snap.targets.some((t, i) => t.flashMsLeft > 0 && (prevTargetFlash[i] ?? 0) <= 0)
    const holeNewlyHit = snap.hole.flashMsLeft > 0 && prevHoleFlash <= 0
    const feverJustStarted = snap.feverActive && !prevFeverActive
    const extraBallJustGranted = snap.coinBonusLivesGranted > prevCoinBonusLivesGranted
    if (bumperNewlyHit) playSound('bumper')
    if (targetNewlyHit) playSound('target')
    if (holeNewlyHit) playSound('hole')
    if (feverJustStarted) playSound('fever')
    if (extraBallJustGranted) playSound('extraBall')
    prevBumperFlash = snap.bumpers.map((b) => b.flashMsLeft)
    prevTargetFlash = snap.targets.map((t) => t.flashMsLeft)
    prevHoleFlash = snap.hole.flashMsLeft
    prevFeverActive = snap.feverActive
    prevCoinBonusLivesGranted = snap.coinBonusLivesGranted

    if (prevSnapStatus === 'playing' && (snap.status === 'upgrade' || snap.status === 'gameover')) {
      _actions.onBallLost(snap.status)
    }
    prevSnapStatus = snap.status

    state.status = snap.status
    state.ball = snap.ball
    state.leftFlipper = snap.leftFlipper
    state.rightFlipper = snap.rightFlipper
    state.bumpers = snap.bumpers
    state.targets = snap.targets
    state.hole = snap.hole
    state.centerPost = snap.centerPost
    state.score = snap.score
    state.lives = snap.lives
    state.ballIndex = snap.ballIndex
    state.combo = snap.combo
    state.maxCombo = snap.maxCombo
    state.comboMultiplier = snap.comboMultiplier
    state.comboMsLeft = snap.comboMsLeft
    state.feverActive = snap.feverActive
    state.feverMsLeft = snap.feverMsLeft
    state.coinsCollected = snap.coinsCollected
    state.coinBonusLivesGranted = snap.coinBonusLivesGranted
    state.finalCoinBonusAmount = snap.finalCoinBonusAmount
    state.finalLeftoverCoinCount = snap.finalLeftoverCoinCount
    state.pendingUpgradeChoices = snap.pendingUpgradeChoices
    state.hitFlashes = snap.hitFlashes
    state.ballDocked = snap.ballDocked
    state.shakeToken = snap.shakeToken
    if (snap.shakeToken !== prevShakeToken) {
      prevShakeToken = snap.shakeToken
      state.isShaking = false
      if (shakeResetTimer) clearTimeout(shakeResetTimer)
      requestAnimationFrame(() => {
        state.isShaking = true
        shakeResetTimer = setTimeout(() => { state.isShaking = false }, 180)
      })
    }

    if (snap.status === 'upgrade' && state.upgradeOverlayVisible && !state.ballLostOverlayVisible) {
      state.message = '選一個 Upgrade，立即套用後按空白鍵發射下一顆球。'
    } else if (snap.status === 'playing' && snap.ballDocked) {
      state.message = '按空白鍵發球！'
    } else if (snap.status === 'playing') {
      state.message = 'A/← 與 L 操作 Flipper！'
    } else if (snap.status === 'gameover' && !state.ballLostOverlayVisible) {
      state.message = 'GAME OVER！按 RESTART 或 AGAIN 再來一次。'
    }
  },
  stopTickTimer: () => {
    if (tickTimer) {
      clearInterval(tickTimer)
      tickTimer = null
    }
  },
  flipperStyle: (flipper: Flipper | null) => {
    if (!flipper) return ''
    return `transform: translate3d(${flipper.pivotX}px, ${flipper.pivotY - FLIPPER_RADIUS}px, 0) rotate(${flipper.angle}rad);`
  },
  ballStyle: () => `transform: translate3d(${state.ball.x - BALL_RADIUS}px, ${state.ball.y - BALL_RADIUS}px, 0);`,
  bumperStyle: (b: Bumper) => `transform: translate3d(${b.x - b.radius}px, ${b.y - b.radius}px, 0) scale(${b.flashMsLeft > 0 ? 1.28 : 1}); width:${b.radius * 2}px; height:${b.radius * 2}px;`,
  targetStyle: (t: Target) => `transform: translate3d(${t.x - TARGET_WIDTH / 2}px, ${t.y - TARGET_HEIGHT / 2}px, 0) scale(${t.flashMsLeft > 0 ? 1.15 : 1});`,
  holeStyle: () => (state.hole ? `transform: translate3d(${state.hole.x - state.hole.radius}px, ${state.hole.y - state.hole.radius}px, 0) scale(${state.hole.flashMsLeft > 0 ? 1.4 : 1}); width:${state.hole.radius * 2}px; height:${state.hole.radius * 2}px;` : ''),
  postStyle: () => (state.centerPost ? `transform: translate3d(${state.centerPost.x - state.centerPost.size / 2}px, ${state.centerPost.y - state.centerPost.size / 2}px, 0) scale(${state.centerPost.flashMsLeft > 0 ? 1.12 : 1});` : ''),
  flashStyle: (f: { x: number; y: number }) => `transform: translate3d(${f.x}px, ${f.y}px, 0);`
}

const _actions = {
  recordHistory: async () => {
    state.rewardMessage = ''
    try {
      const result = await gameHistory.actions.record('pinball', 'PINBALL', {
        score: state.score,
        meta: { maxCombo: state.maxCombo, coinsCollected: state.coinsCollected }
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
      engine.setInput({ left: leftHeld, right: rightHeld })
      engine.tick(TICK_MS)
      _handlers.syncState()
    }, TICK_MS)
  },
  onBallLost: (nextStatus: 'upgrade' | 'gameover') => {
    if (state.ballLostOverlayVisible) return
    state.ballLostOverlayVisible = true
    state.upgradeOverlayVisible = false
    state.message = '球掉進縫隙了…'
    if (ballLostTimer) clearTimeout(ballLostTimer)
    ballLostTimer = setTimeout(() => {
      ballLostTimer = null
      state.ballLostOverlayVisible = false
      if (nextStatus === 'gameover') {
        _actions.finishGame()
      } else {
        state.upgradeOverlayVisible = true
        state.message = '選一個 Upgrade，立即套用後按空白鍵發射下一顆球。'
      }
    }, BALL_LOST_DELAY_MS)
  },
  finishGame: () => {
    state.resultOverlayVisible = true
    playSound('gameover')
    _actions.recordHistory()
  },
  resetGame: () => {
    _handlers.stopTickTimer()
    if (ballLostTimer) {
      clearTimeout(ballLostTimer)
      ballLostTimer = null
    }
    engine.reset()
    prevBumperFlash = []
    prevTargetFlash = []
    prevHoleFlash = 0
    prevFeverActive = false
    prevSnapStatus = 'ready'
    _handlers.syncState()
    state.waitingOverlayVisible = true
    state.ballLostOverlayVisible = false
    state.upgradeOverlayVisible = false
    state.resultOverlayVisible = false
    state.rewardMessage = ''
    state.message = '按 START 開始，A／← 與 L 操作 Flipper，空白鍵發球。'
  },
  startGame: () => {
    if (state.status === 'playing') return
    if (state.status === 'gameover') _actions.resetGame()
    state.waitingOverlayVisible = false
    state.ballLostOverlayVisible = false
    state.upgradeOverlayVisible = false
    state.resultOverlayVisible = false
    engine.start()
    _handlers.syncState()
    _actions.startTickLoop()
  },
  pauseGame: () => {
    if (state.status !== 'playing') return
    engine.togglePause()
    _handlers.syncState()
  },
  resumeGame: () => {
    if (!canResumeFromPause.value) return
    engine.togglePause()
    _handlers.syncState()
  },
  playAgain: () => {
    _actions.resetGame()
    _actions.startGame()
  },
  chooseUpgrade: (id: string) => {
    if (state.status !== 'upgrade' || !state.upgradeOverlayVisible || state.ballLostOverlayVisible) return
    engine.applyUpgrade(id)
    _handlers.syncState()
  },
  tryLaunch: () => {
    if (state.status !== 'playing' || !state.ballDocked) return
    engine.launchBall()
    _handlers.syncState()
  },
  setFlipper: (side: 'left' | 'right', held: boolean) => {
    if (side === 'left') leftHeld = held
    else rightHeld = held
    if (held && state.status === 'playing') playSound('flipper')
  }
}

const onPinballKeydown = (event: KeyboardEvent) => {
  const key = event.key.toLowerCase()
  if (key === 'escape' || key === 'p') {
    if (state.status === 'playing') _actions.pauseGame()
    else if (canResumeFromPause.value) _actions.resumeGame()
    return
  }
  if (key === 'a' || key === 'arrowleft') {
    event.preventDefault()
    _actions.setFlipper('left', true)
    return
  }
  if (key === 'l' || key === 'arrowright') {
    event.preventDefault()
    _actions.setFlipper('right', true)
    return
  }
  if (key === ' ') {
    event.preventDefault()
    if (state.status === 'ready' && state.waitingOverlayVisible) {
      _actions.startGame()
    } else {
      _actions.tryLaunch()
    }
  }
}

const onPinballKeyup = (event: KeyboardEvent) => {
  const key = event.key.toLowerCase()
  if (key === 'a' || key === 'arrowleft') _actions.setFlipper('left', false)
  if (key === 'l' || key === 'arrowright') _actions.setFlipper('right', false)
}

const click = {
  start: () => _actions.startGame(),
  pause: () => _actions.pauseGame(),
  resume: () => _actions.resumeGame(),
  replay: () => _actions.resetGame(),
  again: () => _actions.playAgain(),
  exit: () => router.replace('/game-hall'),
  chooseUpgrade: (id: string) => _actions.chooseUpgrade(id),
  openRateDialog: () => { state.rateDialogOpen = true },
  closeRateDialog: () => { state.rateDialogOpen = false },
  openRuleDialog: () => { state.ruleDialogOpen = true },
  closeRuleDialog: () => { state.ruleDialogOpen = false },
  leftDown: () => _actions.setFlipper('left', true),
  leftUp: () => _actions.setFlipper('left', false),
  rightDown: () => _actions.setFlipper('right', true),
  rightUp: () => _actions.setFlipper('right', false),
  launch: () => _actions.tryLaunch()
}

const updateScale = () => {
  const el = stageWrapRef.value
  if (!el) return
  state.scale = Math.max(0.1, el.clientWidth / PINBALL_WIDTH)
}

onMounted(() => {
  gameHistory.ensureLoaded().catch(() => undefined)
  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', onPinballKeydown)
    window.addEventListener('keyup', onPinballKeyup)
  }
  _actions.resetGame()
  state.waitingOverlayVisible = true
  if (stageWrapRef.value && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => updateScale())
    resizeObserver.observe(stageWrapRef.value)
  }
  updateScale()
})

onBeforeUnmount(() => {
  _handlers.stopTickTimer()
  if (typeof window !== 'undefined') {
    window.removeEventListener('keydown', onPinballKeydown)
    window.removeEventListener('keyup', onPinballKeyup)
  }
  if (shakeResetTimer) clearTimeout(shakeResetTimer)
  if (ballLostTimer) clearTimeout(ballLostTimer)
  resizeObserver?.disconnect()
})
</script>

<template>
  <main class="pb-page" :class="statusClass">
    <div class="pb-overlay" />

    <div v-if="state.waitingOverlayVisible" class="game-mask waiting-mask">
      <div class="mask-title">PINBALL</div>
      <p class="waiting-hint">
        A 與 L 操作左右 Flipper，空白鍵發球。撞擊 Bumper／Target 得分累積 Combo，
        點亮全部 Target 觸發 FEVER，挑戰高風險的 Golden Hole！
      </p>
      <button class="pb-btn waiting-btn waiting-start" type="button" @click="click.start">START</button>
      <button class="pb-btn link waiting-btn" type="button" @click="click.openRateDialog">CONVERT</button>
      <button class="pb-btn link waiting-btn" type="button" @click="click.openRuleDialog">RULE</button>
    </div>

    <div v-if="state.status === 'pause'" class="game-mask pause-mask">
      <div class="mask-title">PAUSED</div>
      <div class="result-actions">
        <button class="pb-btn" type="button" @click="click.resume">RESUME</button>
        <button class="pb-btn" type="button" @click="click.replay">RESTART</button>
        <button class="pb-btn danger" type="button" @click="click.exit">EXIT</button>
      </div>
    </div>

    <div v-if="state.ballLostOverlayVisible" class="game-mask ball-lost-mask">
      <div class="mask-title">BALL LOST</div>
      <p class="waiting-hint">球掉進縫隙了…</p>
    </div>

    <div v-if="state.status === 'upgrade' && state.upgradeOverlayVisible" class="game-mask upgrade-mask">
      <div class="mask-title">CHOOSE UPGRADE</div>
      <p class="waiting-hint">掉球了！選一個 Upgrade 立即套用，再按空白鍵發射下一顆球。</p>
      <div class="upgrade-list">
        <button v-for="u in state.pendingUpgradeChoices" :key="u.id" class="upgrade-card" type="button"
          @click="click.chooseUpgrade(u.id)">
          <span class="upgrade-name">{{ u.name }}</span>
          <span class="upgrade-desc">{{ u.description }}</span>
        </button>
      </div>
    </div>

    <div v-if="state.resultOverlayVisible" class="game-mask result-mask">
      <div class="mask-title">GAME OVER</div>
      <div class="result-list">
        <div class="result-item"><span>SCORE</span><b>{{ baseScoreBeforeCoinBonus }}</b></div>
        <div class="result-item">
          <span>COIN BONUS（剩 {{ state.finalLeftoverCoinCount }} 枚 × 2000）</span><b>+{{ state.finalCoinBonusAmount }}</b>
        </div>
        <div class="result-item"><span>TOTAL</span><b>{{ state.score }}</b></div>
        <div class="result-item"><span>BEST</span><b>{{ bestScore }}</b></div>
        <div class="result-item"><span>COINS</span><b>{{ state.coinsCollected }}</b></div>
      </div>
      <p v-if="state.rewardMessage" class="result-reward">{{ state.rewardMessage }}</p>
      <div class="result-actions">
        <button class="pb-btn" type="button" @click="click.again">RESTART</button>
        <button class="pb-btn danger" type="button" @click="click.exit">EXIT</button>
      </div>
    </div>

    <GameRateDialog :visible="state.rateDialogOpen" game-key="pinball" game-name="PINBALL" :accent-color="ACCENT"
      @close="click.closeRateDialog" />
    <GameRuleDialog :visible="state.ruleDialogOpen" game-name="PINBALL" :accent-color="ACCENT" v-bind="PINBALL_RULE"
      @close="click.closeRuleDialog" />

    <section class="pb-shell">
      <header class="pb-top">
        <div class="pb-title-wrap">
          <h1 class="pb-title">PINBALL</h1>
          <p class="pb-status" :class="statusClass">{{ statusText }}</p>
        </div>
      </header>

      <aside class="pb-side left">
        <button class="pb-btn" type="button" :disabled="!canResumeFromPause" @click="click.resume">RESUME</button>
        <button class="pb-btn" type="button" :disabled="!canPauseWhilePlaying" @click="click.pause">PAUSE</button>
        <button class="pb-btn" type="button" @click="click.replay">RESTART</button>
        <button class="pb-btn" type="button" @click="click.openRateDialog">CONVERT</button>
        <button class="pb-btn" type="button" @click="click.openRuleDialog">RULE</button>
      </aside>

      <section class="pb-center">
        <div class="pb-play-row">
          <div class="pb-frame" :class="{ 'is-fever': state.feverActive, shake: state.isShaking }">
            <div class="pb-stage-wrap" ref="stageWrapRef">
              <div class="pb-stage" :style="stageStyle">
                <div class="pb-launcher-lane" />

                <div v-for="t in state.targets" :key="`t-${t.id}`" class="pb-target"
                  :class="{ hit: t.hit, flash: t.flashMsLeft > 0 }" :style="_handlers.targetStyle(t)">
                  {{ t.label }}
                </div>

                <div v-for="b in state.bumpers" :key="`b-${b.id}`" class="pb-bumper"
                  :class="{ flash: b.flashMsLeft > 0 }" :style="_handlers.bumperStyle(b)" />

                <div class="pb-hole" :class="{ flash: state.hole && state.hole.flashMsLeft > 0 }"
                  :style="_handlers.holeStyle()" />

                <div class="pb-post" :class="{ flash: state.centerPost && state.centerPost.flashMsLeft > 0 }"
                  :style="_handlers.postStyle()">
                  <div class="pb-post-spin" />
                </div>

                <div class="pb-flipper left" :style="_handlers.flipperStyle(state.leftFlipper)" />
                <div class="pb-flipper right" :style="_handlers.flipperStyle(state.rightFlipper)" />

                <div class="pb-ball" :class="{ docked: state.ballDocked }" :style="_handlers.ballStyle()" />

                <div v-if="state.feverActive" class="pb-fever-banner">FEVER!</div>

                <div v-for="f in state.hitFlashes" :key="f.id" class="pb-flash" :style="_handlers.flashStyle(f)">
                  <span class="pb-flash-inner">{{ f.text }}</span>
                </div>
              </div>
            </div>
            <div class="pb-panel">
              <span>BALL {{ state.ballIndex }} / {{ LIVES_START_PB }}</span>
              <span>LIVES {{ state.lives }}</span>
            </div>
          </div>

          <div class="pb-hud">
            <div class="hud-block">
              <span class="hud-label">SCORE</span>
              <span class="hud-value">{{ state.score.toLocaleString() }}</span>
            </div>
            <div class="hud-block combo" :class="{ active: state.combo > 0 }">
              <span class="hud-label">COMBO</span>
              <span class="hud-value">x{{ state.combo }}</span>
            </div>
            <div class="hud-block">
              <span class="hud-label">COINS</span>
              <span class="hud-value">{{ state.coinsCollected }}</span>
            </div>
          </div>
        </div>

        <p class="pb-message">{{ state.message }}</p>

        <div class="pb-touch-controls">
          <button class="pb-flip-btn" type="button" @pointerdown="click.leftDown" @pointerup="click.leftUp"
            @pointerleave="click.leftUp">◀ LEFT</button>
          <button class="pb-flip-btn launch" type="button" @click="click.launch">LAUNCH</button>
          <button class="pb-flip-btn" type="button" @pointerdown="click.rightDown" @pointerup="click.rightUp"
            @pointerleave="click.rightUp">RIGHT ▶</button>
        </div>
      </section>

      <aside class="pb-side right">
        <div class="pb-help-panel">
          <p class="pb-help-title">HOW TO PLAY</p>
          <p class="pb-help-text">
            A／← 與 L 操作左右 Flipper，空白鍵發球。撞 Bumper／Target 得分並累積 Combo，
            四個 Target 全亮觸發 FEVER（Score ×3，持續 5 秒）。Golden Hole 位置偏刁鑽，命中大量加分且不扣命。
            球掉出雙 Flipper 之間扣一命，若還有剩餘生命可選 1 個 Upgrade 再戰。ESC／P 可暫停。
          </p>
        </div>
      </aside>
    </section>
  </main>
</template>

<style scoped lang="scss">
.pb-page {
  --accent: #00f5d4;
  position: relative;
  min-height: 100vh;
  display: grid;
  place-items: center;
  background: radial-gradient(circle at top, #041f1c, #020e0c 60%);
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
    background: radial-gradient(circle at 20% 20%, rgba(0, 245, 212, 0.16), transparent 45%),
      radial-gradient(circle at 80% 70%, rgba(0, 200, 245, 0.1), transparent 40%);
    filter: blur(40px);
    animation: ambient-drift 12s ease-in-out infinite alternate;
  }

  &::after {
    background: linear-gradient(115deg, rgba(0, 245, 212, 0.05), rgba(0, 0, 0, 0));
    animation: ambient-pulse 4.6s ease-in-out infinite;
  }

  .pb-overlay {
    position: absolute;
    inset: 0;
    background-image: linear-gradient(rgba(0, 245, 212, 0.05) 1px, transparent 1px),
      linear-gradient(90deg, rgba(0, 245, 212, 0.05) 1px, transparent 1px);
    background-size: 28px 28px;
    pointer-events: none;
    z-index: 0;
    animation: grid-drift 14s linear infinite;
  }

  .game-mask {
    position: absolute;
    inset: 0;
    z-index: 5;
    background: rgba(0, 0, 0, 0.82);
    display: grid;
    place-items: center;
    align-content: center;
    gap: 12px;
    padding: 16px;
    text-align: center;

    .mask-title {
      color: var(--accent);
      font-size: clamp(1.8rem, 7vw, 3.4rem);
      letter-spacing: 0.2rem;
      font-weight: 900;
      text-shadow: 0 0 18px rgba(0, 245, 212, 0.5);
    }

    .waiting-hint {
      max-width: 420px;
      margin: 0;
      color: #6bf2dd;
      font-size: 0.8rem;
      letter-spacing: 0.02em;
      line-height: 1.6;
    }

    .waiting-btn {
      width: 200px;
    }

    .result-list {
      display: grid;
      gap: 8px;
      width: 260px;
    }

    .result-item {
      display: flex;
      justify-content: space-between;
      border: 1px solid rgba(0, 245, 212, 0.4);
      background: rgba(3, 46, 40, 0.65);
      color: #b6f5ee;
      padding: 8px 10px;
      font-variant-numeric: tabular-nums;
    }

    .result-reward {
      margin: 4px 0 0;
      color: #8ff0dd;
      font-size: 0.85rem;
    }

    .result-actions {
      margin-top: 8px;
      display: flex;
      gap: 10px;
    }

    .upgrade-list {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      justify-content: center;
      max-width: 640px;
    }

    .upgrade-card {
      width: 180px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      border: 1px solid rgba(0, 245, 212, 0.45);
      background: rgba(3, 46, 40, 0.7);
      color: #d9fff8;
      padding: 12px;
      text-align: left;
      cursor: pointer;
      transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;

      .upgrade-name {
        color: var(--accent);
        font-weight: 800;
        font-size: 0.78rem;
        letter-spacing: 0.04em;
      }

      .upgrade-desc {
        font-size: 0.72rem;
        color: #9be9db;
        line-height: 1.5;
      }

      &:hover {
        border-color: var(--accent);
        box-shadow: 0 0 14px rgba(0, 245, 212, 0.35);
        transform: translateY(-2px);
      }
    }
  }

  .pb-shell {
    position: relative;
    z-index: 1;
    width: min(1100px, 100%);
    padding: 24px;
    display: grid;
    grid-template-columns: 180px 1fr 180px;
    grid-template-areas:
      'top top top'
      'left center right';
    gap: 20px;
    align-items: start;
  }

  .pb-top {
    grid-area: top;
    text-align: center;
  }

  .pb-side {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-top: 80px;

    &.left {
      grid-area: left;
    }

    &.right {
      grid-area: right;
    }
  }

  .pb-btn {
    position: relative;
    overflow: hidden;
    border: 1px solid rgba(0, 245, 212, 0.4);
    border-radius: 6px;
    padding: 10px 12px;
    background: rgba(3, 46, 40, 0.75);
    color: var(--accent);
    font-weight: 700;
    letter-spacing: 0.5px;
    cursor: pointer;
    transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;

    &:hover {
      border-color: var(--accent);
      box-shadow: 0 0 12px rgba(0, 245, 212, 0.35);
      transform: translateY(-1px);
    }

    &:disabled {
      opacity: 0.45;
      cursor: not-allowed;
      box-shadow: none;
    }

    &.link {
      text-align: center;
    }

    &.danger {
      border-color: rgba(255, 90, 90, 0.5);
      color: #ff8f8f;
    }
  }

  .pb-center {
    grid-area: center;
    text-align: center;
  }

  .pb-top {
    .pb-title-wrap {
      margin-bottom: 4px;
    }

    .pb-title {
      margin: 0;
      color: var(--accent);
      font-size: clamp(1.6rem, 5vw, 2.6rem);
      letter-spacing: 0.14rem;
      font-weight: 900;
      text-shadow: 0 0 14px rgba(0, 245, 212, 0.45);
    }

    .pb-status {
      margin: 2px 0 0;
      color: #7ff5ea;
      font-size: 0.85rem;
      letter-spacing: 0.2rem;

      &.is-playing {
        color: var(--accent);
      }

      &.is-pause {
        color: #ffcc33;
      }

      &.is-upgrade {
        color: #ffd166;
      }

      &.is-gameover {
        color: #ff5e5e;
      }
    }
  }

  .pb-play-row {
    display: flex;
    align-items: flex-start;
    justify-content: center;
    gap: 6px;
  }

  .pb-hud {
    position: absolute;
    right: 25%;
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-top: 10px;

    .hud-block {
      display: flex;
      flex-direction: column;
      min-width: 84px;
      border: 1px solid rgba(0, 245, 212, 0.35);
      background: rgba(3, 46, 40, 0.6);
      padding: 6px 10px;

      .hud-label {
        font-size: 0.62rem;
        letter-spacing: 0.12em;
        color: #6bf2dd;
      }

      .hud-value {
        font-size: 1.1rem;
        font-weight: 800;
        color: #eafffb;
        font-variant-numeric: tabular-nums;
      }

      &.combo.active {
        border-color: #ffd166;

        .hud-value {
          color: #ffd166;
          text-shadow: 0 0 8px rgba(255, 209, 102, 0.6);
        }
      }
    }
  }

  .pb-frame {
    width: fit-content;
    padding: 10px;
    background: #052622;
    border: 8px solid #0b4d43;
    border-radius: 14px;
    box-shadow: 0 0 0 1px rgba(0, 245, 212, 0.2), 0 0 24px rgba(0, 245, 212, 0.14);
    transition: box-shadow 0.2s ease;

    &.is-fever {
      border-color: #ffd166;
      box-shadow: 0 0 0 1px rgba(255, 209, 102, 0.4), 0 0 30px rgba(255, 209, 102, 0.35);
      animation: fever-pulse 0.6s ease-in-out infinite;
    }

    &.shake {
      animation: stage-shake 0.18s linear;
    }
  }

  .pb-stage-wrap {
    width: min(320px, 78vw);
    aspect-ratio: 320 / 440;
    max-height: 440px;
    margin: 0 auto;
    position: relative;
    overflow: hidden;
  }

  .pb-stage {
    position: relative;
    transform-origin: top left;
    background: linear-gradient(180deg, #031814 0%, #020c0a 100%);
    border: 2px solid #000;
    box-sizing: border-box;
    overflow: hidden;
  }

  .pb-launcher-lane {
    position: absolute;
    right: 18px;
    top: 130px;
    bottom: 30px;
    width: 1px;
    background: rgba(0, 245, 212, 0.18);
    pointer-events: none;
  }

  .pb-ball {
    position: absolute;
    left: 0;
    top: 0;
    width: v-bind('BALL_RADIUS * 2 + "px"');
    height: v-bind('BALL_RADIUS * 2 + "px"');
    border-radius: 50%;
    background: radial-gradient(circle at 35% 30%, #ffffff, #b7fff2 45%, #12d9b8 100%);
    box-shadow: 0 0 8px rgba(0, 245, 212, 0.7);
    will-change: transform;
    z-index: 3;

    &.docked {
      opacity: 0.85;
    }
  }

  .pb-flipper {
    position: absolute;
    left: 0;
    top: 0;
    width: v-bind('FLIPPER_LENGTH + FLIPPER_RADIUS + "px"');
    height: v-bind('FLIPPER_RADIUS * 2 + "px"');
    background: linear-gradient(180deg, #ffe680, #ffb703);
    border: 2px solid #7a4b00;
    border-radius: 999px;
    transform-origin: 0% 50%;
    will-change: transform;
    z-index: 2;
    box-shadow: 0 0 6px rgba(255, 183, 3, 0.5);
  }

  .pb-bumper {
    position: absolute;
    left: 0;
    top: 0;
    border-radius: 50%;
    background: radial-gradient(circle at 35% 30%, #ffe3f3, #ff2ea6 55%, #9c0060 100%);
    border: 2px solid #5a0038;
    box-shadow: 0 0 8px rgba(255, 46, 166, 0.5);
    transition: transform 0.12s ease;

    &.flash {
      filter: brightness(1.6);
    }
  }

  .pb-target {
    position: absolute;
    left: 0;
    top: 0;
    width: v-bind('TARGET_WIDTH + "px"');
    height: v-bind('TARGET_HEIGHT + "px"');
    display: grid;
    place-items: center;
    background: #23384f;
    border: 2px solid #4a6a8f;
    color: #8fb4d9;
    font-size: 0.6rem;
    font-weight: 800;
    transition: background 0.15s ease, color 0.15s ease, box-shadow 0.15s ease;

    &.hit {
      background: #ffd166;
      border-color: #ffb703;
      color: #3a2400;
      box-shadow: 0 0 10px rgba(255, 209, 102, 0.6);
    }
  }

  .pb-hole {
    position: absolute;
    left: 0;
    top: 0;
    border-radius: 50%;
    background: radial-gradient(circle, #000 40%, #3d0066 80%, #b100ff 100%);
    border: 2px solid #b100ff;
    box-shadow: 0 0 10px rgba(177, 0, 255, 0.55);
    transition: transform 0.15s ease;

    &.flash {
      filter: brightness(1.8);
    }
  }

  .pb-post {
    position: absolute;
    left: 0;
    top: 0;
    width: v-bind('CENTER_POST_SIZE + "px"');
    height: v-bind('CENTER_POST_SIZE + "px"');
    transition: transform 0.12s ease;

    &.flash {
      .pb-post-spin {
        filter: brightness(1.5);
      }
    }
  }

  .pb-post-spin {
    width: 100%;
    height: 100%;
    background: linear-gradient(180deg, #cfd8e3, #8a97a8);
    border: 2px solid #5a6474;
    box-shadow: 0 0 6px rgba(200, 210, 224, 0.5);
    animation: post-spin 6s linear infinite;
  }

  @keyframes post-spin {
    from {
      transform: rotate(0deg);
    }

    to {
      transform: rotate(360deg);
    }
  }

  .pb-fever-banner {
    position: absolute;
    top: 8px;
    left: 50%;
    transform: translateX(-50%);
    color: #ffd166;
    font-weight: 900;
    font-size: 1.1rem;
    letter-spacing: 0.1em;
    text-shadow: 0 0 12px rgba(255, 209, 102, 0.8);
    animation: fever-blink 0.5s steps(2) infinite;
    z-index: 4;
  }

  .pb-flash {
    position: absolute;
    left: 0;
    top: 0;
    pointer-events: none;
    z-index: 5;

    .pb-flash-inner {
      display: inline-block;
      color: #eafffb;
      font-weight: 800;
      font-size: 0.7rem;
      text-shadow: 0 0 6px rgba(0, 245, 212, 0.8);
      animation: flash-float 0.6s ease-out forwards;
    }
  }

  .pb-panel {
    margin-top: 8px;
    display: flex;
    justify-content: space-between;
    color: var(--accent);
    font-weight: 800;
    font-size: 0.75rem;
    text-shadow: 0 0 6px rgba(0, 245, 212, 0.45);
    font-variant-numeric: tabular-nums;
  }

  .pb-message {
    margin-top: 10px;
    color: #7ff5ea;
    font-size: 0.8rem;
  }

  .pb-touch-controls {
    margin-top: 12px;
    display: none;
    gap: 10px;
    justify-content: center;

    .pb-flip-btn {
      flex: 1;
      max-width: 140px;
      padding: 12px 8px;
      border: 1px solid rgba(0, 245, 212, 0.4);
      background: rgba(3, 46, 40, 0.75);
      color: var(--accent);
      font-weight: 800;
      border-radius: 8px;
      user-select: none;
      touch-action: none;

      &.launch {
        color: #ffd166;
        border-color: rgba(255, 209, 102, 0.5);
      }
    }
  }

  .pb-help-panel {
    border: 1px solid rgba(0, 245, 212, 0.3);
    border-radius: 8px;
    padding: 12px;
    background: rgba(3, 46, 40, 0.5);

    .pb-help-title {
      margin: 0 0 6px;
      color: var(--accent);
      font-size: 0.75rem;
      letter-spacing: 0.14rem;
      font-weight: 800;
    }

    .pb-help-text {
      margin: 0;
      color: #7ff5ea;
      font-size: 0.78rem;
      line-height: 1.6;
    }
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

@keyframes fever-pulse {

  0%,
  100% {
    filter: brightness(1);
  }

  50% {
    filter: brightness(1.25);
  }
}

@keyframes fever-blink {

  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0.4;
  }
}

@keyframes flash-float {
  0% {
    opacity: 1;
    transform: translate3d(0, 0, 0);
  }

  100% {
    opacity: 0;
    transform: translate3d(0, -28px, 0);
  }
}

@keyframes stage-shake {

  0%,
  100% {
    transform: translate3d(0, 0, 0);
  }

  25% {
    transform: translate3d(-3px, 2px, 0);
  }

  50% {
    transform: translate3d(3px, -2px, 0);
  }

  75% {
    transform: translate3d(-2px, -1px, 0);
  }
}

@media (max-width: 980px) {
  .pb-page {
    .pb-shell {
      grid-template-columns: 1fr;
      grid-template-areas:
        'top'
        'center'
        'left'
        'right';
      padding: 16px;
    }

    .pb-side {
      flex-direction: row;
      flex-wrap: wrap;
      justify-content: center;
    }

    .pb-play-row {
      flex-direction: column;
      align-items: center;
    }

    .pb-hud {
      flex-direction: row;
      margin-top: 0;
    }

    .pb-touch-controls {
      display: flex;
    }
  }
}
</style>
