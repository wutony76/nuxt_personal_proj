<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useGameHistory } from '~/composables/useGameHistory'

type PongStatus = 'ready' | 'playing' | 'pause' | 'gameover'
type Side = 'player' | 'cpu'
type StepResult = { scored: Side | null; roundOver: boolean; roundWinner: Side | null }

const STAGE_WIDTH = 400
const STAGE_HEIGHT = 280
const PADDLE_WIDTH = 10
const PADDLE_HEIGHT = 56
const BALL_SIZE = 10
const PADDLE_SPEED = 5
const BALL_BASE_SPEED = 2.6
const BALL_SERVE_VY_MAX = 1.6
const BALL_MAX_BOUNCE_VY = 3.2
const BALL_SPEED_STEP = 1.05
const BALL_MAX_SPEED_MUL = 1.8
const CPU_MAX_SPEED = 3.6
const CPU_DEAD_ZONE = 6
const ROUND_POINT_TARGET = 5
const ROUND_OPTIONS = [3, 5, 10] as const
const TICK_MS = 16
const READY_START = 3
/** 得分後球會立即重置到中線重發球，若沒有停頓會讓「球出界」跟「球瞬間回到原位」同一畫面發生，
 *  視覺上像瞬移；得分後短暫停格顯示「得分」提示，再恢復發球，比照正式 Pong 的serve delay 慣例 */
const SERVE_PAUSE_MS = 700

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/**
 * 單局（一局打到 ROUND_POINT_TARGET 分）的球拍／球physics + CPU 追蹤 AI。
 * PONG 只有這一款遊戲用到這套物理邏輯，不像 match3 兩款共用一份 core engine，
 * 因此直接寫在頁面內，不抽到 app/utils/（見 openspec/changes/add-pong-game/design.md Decision 1 附近說明）。
 */
class PongEngine {
  playerY = (STAGE_HEIGHT - PADDLE_HEIGHT) / 2
  cpuY = (STAGE_HEIGHT - PADDLE_HEIGHT) / 2
  ballX = STAGE_WIDTH / 2 - BALL_SIZE / 2
  ballY = STAGE_HEIGHT / 2 - BALL_SIZE / 2
  ballVX = 0
  ballVY = 0
  playerScore = 0
  cpuScore = 0
  private ballSpeedMul = 1

  constructor() {
    this.serve()
  }

  resetRound() {
    this.playerScore = 0
    this.cpuScore = 0
    this.playerY = (STAGE_HEIGHT - PADDLE_HEIGHT) / 2
    this.cpuY = (STAGE_HEIGHT - PADDLE_HEIGHT) / 2
    this.serve()
  }

  private serve() {
    this.ballX = STAGE_WIDTH / 2 - BALL_SIZE / 2
    this.ballY = STAGE_HEIGHT / 2 - BALL_SIZE / 2
    const dir = Math.random() < 0.5 ? -1 : 1
    this.ballVX = dir * BALL_BASE_SPEED
    this.ballVY = (Math.random() - 0.5) * 2 * BALL_SERVE_VY_MAX
    this.ballSpeedMul = 1
  }

  private overlapsY(paddleY: number): boolean {
    return this.ballY + BALL_SIZE >= paddleY && this.ballY <= paddleY + PADDLE_HEIGHT
  }

  private bounceOffPaddle(paddleY: number, dir: 1 | -1) {
    const relative = (this.ballY + BALL_SIZE / 2 - (paddleY + PADDLE_HEIGHT / 2)) / (PADDLE_HEIGHT / 2)
    this.ballVX = dir * BALL_BASE_SPEED
    this.ballVY = clamp(relative, -1, 1) * BALL_MAX_BOUNCE_VY
    this.ballSpeedMul = Math.min(this.ballSpeedMul * BALL_SPEED_STEP, BALL_MAX_SPEED_MUL)
    this.ballX = dir === 1 ? PADDLE_WIDTH : STAGE_WIDTH - PADDLE_WIDTH - BALL_SIZE
  }

  step(playerDir: -1 | 0 | 1): StepResult {
    this.playerY = clamp(this.playerY + playerDir * PADDLE_SPEED, 0, STAGE_HEIGHT - PADDLE_HEIGHT)

    const cpuCenter = this.cpuY + PADDLE_HEIGHT / 2
    const target = this.ballY + BALL_SIZE / 2
    const diff = target - cpuCenter
    if (Math.abs(diff) > CPU_DEAD_ZONE) {
      const cpuMove = Math.sign(diff) * Math.min(Math.abs(diff), CPU_MAX_SPEED)
      this.cpuY = clamp(this.cpuY + cpuMove, 0, STAGE_HEIGHT - PADDLE_HEIGHT)
    }

    this.ballX += this.ballVX * this.ballSpeedMul
    this.ballY += this.ballVY * this.ballSpeedMul

    if (this.ballY <= 0) {
      this.ballY = 0
      this.ballVY *= -1
    } else if (this.ballY + BALL_SIZE >= STAGE_HEIGHT) {
      this.ballY = STAGE_HEIGHT - BALL_SIZE
      this.ballVY *= -1
    }

    if (this.ballVX < 0 && this.ballX <= PADDLE_WIDTH && this.overlapsY(this.cpuY)) {
      this.bounceOffPaddle(this.cpuY, 1)
    }
    const playerEdgeX = STAGE_WIDTH - PADDLE_WIDTH - BALL_SIZE
    if (this.ballVX > 0 && this.ballX >= playerEdgeX && this.overlapsY(this.playerY)) {
      this.bounceOffPaddle(this.playerY, -1)
    }

    let scored: Side | null = null
    if (this.ballX + BALL_SIZE < 0) {
      this.playerScore += 1
      scored = 'player'
    } else if (this.ballX > STAGE_WIDTH) {
      this.cpuScore += 1
      scored = 'cpu'
    }
    if (scored) this.serve()

    const roundOver = this.playerScore >= ROUND_POINT_TARGET || this.cpuScore >= ROUND_POINT_TARGET
    const roundWinner: Side | null = roundOver ? (this.playerScore > this.cpuScore ? 'player' : 'cpu') : null

    return { scored, roundOver, roundWinner }
  }

  getSnapshot() {
    return {
      playerY: this.playerY,
      cpuY: this.cpuY,
      ballX: this.ballX,
      ballY: this.ballY,
      playerScore: this.playerScore,
      cpuScore: this.cpuScore
    }
  }
}

const router = useRouter()
const engine = new PongEngine()
const gameHistory = useGameHistory()

const state = reactive({
  status: 'ready' as PongStatus,
  playerY: engine.playerY,
  cpuY: engine.cpuY,
  ballX: engine.ballX,
  ballY: engine.ballY,
  rallyPlayerScore: 0,
  rallyCpuScore: 0,
  totalRounds: 5 as (typeof ROUND_OPTIONS)[number],
  currentRound: 1,
  roundsWon: 0,
  roundsLost: 0,
  message: '選擇局數後按「開始」，使用 ↑/↓ 或 W/S 控制球拍。',
  rewardMessage: '',
  serveMessage: '',
  waitingOverlayVisible: true,
  readyOverlayVisible: false,
  readyCountdownValue: READY_START,
  roundResultOverlayVisible: false,
  roundResultWinner: null as Side | null,
  resultOverlayVisible: false,
  rateDialogOpen: false,
  ruleDialogOpen: false
})

const PONG_RULE = {
  description:
    '對戰 CPU，使用 ↑/↓ 或 W/S 控制右側球拍；球越過對方球拍即得 1 分，任一方先取得目標分數即贏得該局。' +
    '開局可選擇本場局數（3／5／10 局），局數打滿才會結束，最終分數依「玩家獲勝的局數」計算，不是來回比分。',
  scoreRule: `每局先取得 ${ROUND_POINT_TARGET} 分者獲勝；最終 SCORE ＝ 整場比賽玩家獲勝的局數。`,
  levels: [
    { level: '3 局制', condition: '快速對戰，適合想很快分出高下' },
    { level: '5 局制', condition: '標準場次，兼顧長度與節奏' },
    { level: '10 局制', condition: '長場考驗，更能反映真實實力' }
  ],
  levelsTitle: '局數選項',
  note: '球拍連續擊球會讓球速小幅加快，每次得分後重新發球會恢復初始球速。'
}

let tickTimer: ReturnType<typeof setInterval> | null = null
let readyTimer: ReturnType<typeof setInterval> | null = null
let roundResultTimer: ReturnType<typeof setTimeout> | null = null
let servePauseTimer: ReturnType<typeof setTimeout> | null = null
let upHeld = false
let downHeld = false

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
    !state.roundResultOverlayVisible &&
    !state.resultOverlayVisible
)
const canPauseWhilePlaying = computed(() => state.status === 'playing')

/** 私有工具方法：計時器管理、狀態同步、球拍座標樣式 */
const _handlers = {
  syncState: () => {
    const snap = engine.getSnapshot()
    state.playerY = snap.playerY
    state.cpuY = snap.cpuY
    state.ballX = snap.ballX
    state.ballY = snap.ballY
    state.rallyPlayerScore = snap.playerScore
    state.rallyCpuScore = snap.cpuScore
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
  stopRoundResultTimer: () => {
    if (roundResultTimer) {
      clearTimeout(roundResultTimer)
      roundResultTimer = null
    }
  },
  stopServePauseTimer: () => {
    if (servePauseTimer) {
      clearTimeout(servePauseTimer)
      servePauseTimer = null
    }
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
  currentInputDir: (): -1 | 0 | 1 => {
    if (upHeld && !downHeld) return -1
    if (downHeld && !upHeld) return 1
    return 0
  }
}

const _actions = {
  recordHistory: async () => {
    state.rewardMessage = ''
    try {
      const result = await gameHistory.actions.record('pong', 'PONG', {
        score: state.roundsWon,
        meta: {
          totalRounds: state.totalRounds,
          roundsWon: state.roundsWon,
          roundsLost: state.roundsLost
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
      const result = engine.step(_handlers.currentInputDir())
      _handlers.syncState()
      if (result.roundOver) {
        _actions.finishRound(result.roundWinner as Side)
        return
      }
      if (result.scored) {
        _actions.pauseForServe(result.scored)
      }
    }, TICK_MS)
  },
  /** 得分但該局尚未結束：球已重置到中線，短暫停格顯示得分方，避免「出界」跟「瞬間回到原位」同框發生 */
  pauseForServe: (scorer: Side) => {
    _handlers.stopTickTimer()
    state.serveMessage = scorer === 'player' ? '你得分！' : 'CPU 得分！'
    _handlers.stopServePauseTimer()
    servePauseTimer = setTimeout(() => {
      state.serveMessage = ''
      servePauseTimer = null
      // 停格期間玩家可能按了 PAUSE，此時 status 已變成 'pause'，不應自動恢復 tick
      if (state.status === 'playing') _actions.startTickLoop()
    }, SERVE_PAUSE_MS)
  },
  finishRound: (winner: Side) => {
    _handlers.stopTickTimer()
    if (winner === 'player') {
      state.roundsWon += 1
    } else {
      state.roundsLost += 1
    }
    state.status = 'pause'
    state.roundResultWinner = winner
    state.roundResultOverlayVisible = true
    _handlers.stopRoundResultTimer()
    roundResultTimer = setTimeout(() => {
      state.roundResultOverlayVisible = false
      if (state.currentRound >= state.totalRounds) {
        _actions.finishMatch()
        return
      }
      state.currentRound += 1
      engine.resetRound()
      _handlers.syncState()
      _handlers.runReadyCountdown(() => {
        state.status = 'playing'
        state.message = '遊戲進行中...'
        _actions.startTickLoop()
      })
    }, 1400)
  },
  finishMatch: () => {
    state.status = 'gameover'
    state.message = state.roundsWon > state.roundsLost ? '恭喜，你贏得這場比賽！' : '這場比賽敗給了 CPU。'
    state.resultOverlayVisible = true
    _actions.recordHistory()
  },
  resetMatch: () => {
    _handlers.stopTickTimer()
    _handlers.stopReadyTimer()
    _handlers.stopRoundResultTimer()
    _handlers.stopServePauseTimer()
    engine.resetRound()
    _handlers.syncState()
    state.status = 'ready'
    state.currentRound = 1
    state.roundsWon = 0
    state.roundsLost = 0
    state.waitingOverlayVisible = true
    state.roundResultOverlayVisible = false
    state.resultOverlayVisible = false
    state.readyOverlayVisible = false
    state.rewardMessage = ''
    state.serveMessage = ''
    state.message = '選擇局數後按「開始」，使用 ↑/↓ 或 W/S 控制球拍。'
  },
  selectRounds: (rounds: (typeof ROUND_OPTIONS)[number]) => {
    if (state.status === 'playing') return
    state.totalRounds = rounds
  },
  startMatch: () => {
    if (state.status === 'playing' || state.readyOverlayVisible) return
    if (state.status === 'gameover') _actions.resetMatch()
    state.waitingOverlayVisible = false
    state.resultOverlayVisible = false
    _handlers.runReadyCountdown(() => {
      state.status = 'playing'
      state.message = '遊戲進行中...'
      _actions.startTickLoop()
    })
  },
  pauseMatch: () => {
    if (state.status !== 'playing') return
    state.status = 'pause'
    state.message = '已暫停'
    _handlers.stopTickTimer()
  },
  resumeMatch: () => {
    if (!canResumeFromPause.value) return
    state.status = 'playing'
    state.message = '遊戲進行中...'
    _actions.startTickLoop()
  },
  playAgain: () => {
    _actions.resetMatch()
    _actions.startMatch()
  },
  endGameNow: () => {
    _handlers.stopTickTimer()
    _handlers.stopReadyTimer()
    _handlers.stopRoundResultTimer()
    _handlers.stopServePauseTimer()
    state.waitingOverlayVisible = false
    state.readyOverlayVisible = false
    state.roundResultOverlayVisible = false
    state.serveMessage = ''
    state.status = 'gameover'
    state.message = '本場已結束。'
    state.resultOverlayVisible = true
    _actions.recordHistory()
  }
}

const onPongKeydown = (event: KeyboardEvent) => {
  const key = event.key.toLowerCase()
  if (key === 'arrowup' || key === 'w') {
    upHeld = true
    event.preventDefault()
  }
  if (key === 'arrowdown' || key === 's') {
    downHeld = true
    event.preventDefault()
  }
}
const onPongKeyup = (event: KeyboardEvent) => {
  const key = event.key.toLowerCase()
  if (key === 'arrowup' || key === 'w') upHeld = false
  if (key === 'arrowdown' || key === 's') downHeld = false
}

const click = {
  selectRounds: (rounds: (typeof ROUND_OPTIONS)[number]) => _actions.selectRounds(rounds),
  start: () => _actions.startMatch(),
  pause: () => _actions.pauseMatch(),
  resume: () => _actions.resumeMatch(),
  replay: () => _actions.resetMatch(),
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

onMounted(() => {
  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', onPongKeydown)
    window.addEventListener('keyup', onPongKeyup)
  }
  _actions.resetMatch()
  state.waitingOverlayVisible = true
})

onBeforeUnmount(() => {
  _handlers.stopTickTimer()
  _handlers.stopReadyTimer()
  _handlers.stopRoundResultTimer()
  _handlers.stopServePauseTimer()
  if (typeof window !== 'undefined') {
    window.removeEventListener('keydown', onPongKeydown)
    window.removeEventListener('keyup', onPongKeyup)
  }
})
</script>

<template>
  <main class="pg-page" :class="`state-${state.status}`">
    <div class="pg-overlay" />
    <div v-if="state.waitingOverlayVisible" class="game-mask waiting-mask">
      <div class="mask-title">WELCOME</div>
      <p class="waiting-subtitle">PONG</p>
      <div class="rounds-picker">
        <button v-for="opt in ROUND_OPTIONS" :key="opt" type="button" class="pg-btn rounds-btn"
          :class="{ active: state.totalRounds === opt }" @click="click.selectRounds(opt)">
          {{ opt }} 局
        </button>
      </div>
      <button class="pg-btn waiting-btn waiting-start" type="button" @click="click.start">START</button>
      <button class="pg-btn link waiting-btn" type="button" @click="click.openRateDialog">CONVERT</button>
      <button class="pg-btn link waiting-btn" type="button" @click="click.openRuleDialog">RULE</button>
    </div>
    <div v-if="state.readyOverlayVisible" class="game-mask ready-mask">
      <div class="mask-title">READY</div>
      <div class="mask-count">{{ state.readyCountdownValue }}</div>
      <p class="ready-round">第 {{ state.currentRound }} / {{ state.totalRounds }} 局</p>
    </div>
    <div v-if="state.roundResultOverlayVisible" class="game-mask round-mask">
      <div class="mask-title" :class="state.roundResultWinner === 'player' ? 'win' : 'lose'">
        {{ state.roundResultWinner === 'player' ? 'ROUND WIN' : 'ROUND LOSE' }}
      </div>
      <p class="round-tally">目前戰績 {{ state.roundsWon }} 勝 － {{ state.roundsLost }} 敗</p>
    </div>
    <div v-if="state.resultOverlayVisible" class="game-mask result-mask">
      <div class="mask-title">RESULT</div>
      <div class="result-list">
        <div class="result-item"><span>SCORE</span><b>{{ state.roundsWon }}</b></div>
        <div class="result-item"><span>WIN</span><b>{{ state.roundsWon }}</b></div>
        <div class="result-item"><span>LOSE</span><b>{{ state.roundsLost }}</b></div>
      </div>
      <p v-if="state.rewardMessage" class="result-reward">{{ state.rewardMessage }}</p>
      <div class="result-actions">
        <button class="pg-btn" type="button" @click="click.again">AGAIN</button>
        <button class="pg-btn danger" type="button" @click="click.exit">EXIT</button>
      </div>
    </div>

    <GameRateDialog :visible="state.rateDialogOpen" game-key="pong" game-name="PONG" accent-color="#ff2ea6"
      @close="click.closeRateDialog" />
    <GameRuleDialog :visible="state.ruleDialogOpen" game-name="PONG" accent-color="#ff2ea6" v-bind="PONG_RULE"
      @close="click.closeRuleDialog" />

    <section class="pg-shell">
      <aside class="pg-side left">
        <button class="pg-btn" type="button" :disabled="!canResumeFromPause" @click="click.resume">START</button>
        <button class="pg-btn" type="button" :disabled="!canPauseWhilePlaying" @click="click.pause">PAUSE</button>
        <button class="pg-btn" type="button" @click="click.replay">REPLAY</button>
        <button class="pg-btn link" type="button" @click="click.end">END</button>
        <button class="pg-btn" type="button" @click="click.openRateDialog">CONVERT</button>
        <button class="pg-btn" type="button" @click="click.openRuleDialog">RULE</button>
      </aside>

      <section class="pg-center">
        <header class="pg-title-wrap">
          <h1 class="pg-title">PONG</h1>
          <p class="pg-status" :class="statusClass">{{ statusText }}</p>
        </header>

        <div class="pg-frame">
          <div class="pg-stage">
            <i class="pg-net" />
            <div class="pg-paddle cpu" :style="`transform: translateY(${state.cpuY}px)`" />
            <div class="pg-paddle player" :style="`transform: translateY(${state.playerY}px)`" />
            <div class="pg-ball" :style="`transform: translate(${state.ballX}px, ${state.ballY}px)`" />
            <p v-if="state.serveMessage" class="pg-serve-flash">{{ state.serveMessage }}</p>
          </div>
          <div class="pg-panel">
            <span>CPU: {{ state.rallyCpuScore }}</span>
            <span>局數: {{ state.currentRound }}/{{ state.totalRounds }}</span>
            <span>YOU: {{ state.rallyPlayerScore }}</span>
          </div>
        </div>

        <p class="pg-message">{{ state.message }}</p>
      </section>

      <aside class="pg-side right">
        <div class="pg-help-panel">
          <p class="pg-help-title">HOW TO PLAY</p>
          <p class="pg-help-text">↑/↓ 或 W/S 控制右側球拍，球越過對方即得分；每局先到 {{ ROUND_POINT_TARGET }} 分獲勝，局數打滿後依勝場數計分。</p>
        </div>
      </aside>
    </section>
  </main>
</template>

<style scoped lang="scss">
.pg-page {
  position: relative;
  min-height: 100vh;
  display: grid;
  place-items: center;
  background: radial-gradient(circle at top, #1a0212, #050106 60%);
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
    background: radial-gradient(circle at 20% 20%, rgba(255, 46, 166, 0.16), transparent 45%),
      radial-gradient(circle at 80% 70%, rgba(255, 140, 210, 0.1), transparent 40%);
    filter: blur(40px);
    animation: ambient-drift 12s ease-in-out infinite alternate;
  }

  &::after {
    background: linear-gradient(115deg, rgba(255, 46, 166, 0.05), rgba(0, 0, 0, 0));
    animation: ambient-pulse 4.6s ease-in-out infinite;
  }

  .pg-overlay {
    position: absolute;
    inset: 0;
    background-image: linear-gradient(rgba(255, 46, 166, 0.05) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255, 46, 166, 0.05) 1px, transparent 1px);
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
      color: #ff2ea6;
      font-size: clamp(2rem, 8vw, 4rem);
      letter-spacing: 0.25rem;
      font-weight: 900;

      &.win {
        color: #5cff8a;
      }

      &.lose {
        color: #ff5e5e;
      }
    }

    .mask-count {
      color: #ff2ea6;
      font-size: clamp(3rem, 12vw, 7rem);
      font-weight: 900;
      line-height: 1;
    }

    &.waiting-mask {
      background: rgba(0, 0, 0, 0.88);

      .waiting-subtitle {
        margin: 0;
        color: #ff8fd1;
        letter-spacing: 0.3rem;
        font-size: 0.95rem;
      }

      .rounds-picker {
        display: flex;
        gap: 10px;
        margin-top: 4px;
      }

      .rounds-btn {
        width: 72px;

        &.active {
          border-color: #ff2ea6;
          background: rgba(255, 46, 166, 0.22);
          color: #ffd6ef;
          box-shadow: 0 0 12px rgba(255, 46, 166, 0.4);
        }
      }

      .waiting-btn {
        width: 160px;
      }
    }

    &.ready-mask {
      .ready-round {
        margin: 0;
        color: #ff8fd1;
        font-size: 0.85rem;
        letter-spacing: 0.15rem;
      }
    }

    &.round-mask {
      .round-tally {
        margin: 0;
        color: #ff8fd1;
        font-size: 0.85rem;
        letter-spacing: 0.1rem;
      }
    }

    &.result-mask {
      .result-list {
        display: grid;
        gap: 8px;
        width: 260px;
      }

      .result-item {
        display: flex;
        justify-content: space-between;
        border: 1px solid rgba(255, 46, 166, 0.4);
        background: rgba(40, 4, 26, 0.65);
        color: #ffd6ef;
        padding: 8px 10px;
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

  .pg-shell {
    position: relative;
    z-index: 1;
    width: min(1100px, 100%);
    padding: 24px;
    display: grid;
    grid-template-columns: 180px 1fr 180px;
    gap: 20px;
    align-items: center;
  }

  .pg-side {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .pg-btn {
    position: relative;
    overflow: hidden;
    border: 1px solid rgba(255, 46, 166, 0.4);
    border-radius: 6px;
    padding: 10px 12px;
    background: rgba(26, 2, 18, 0.75);
    color: #ff2ea6;
    font-weight: 700;
    letter-spacing: 0.5px;
    transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;

    &::after {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(105deg, transparent 35%, rgba(255, 214, 239, 0.25) 50%, transparent 65%);
      transform: translateX(-150%);
      transition: transform 0.35s ease;
      pointer-events: none;
    }

    &:hover {
      border-color: #ff2ea6;
      box-shadow: 0 0 12px rgba(255, 46, 166, 0.35);
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
      border-color: rgba(255, 60, 60, 0.5);
      color: #ff7d7d;
    }
  }

  .pg-center {
    text-align: center;

    .pg-title-wrap {
      margin-bottom: 8px;
    }

    .pg-title {
      margin: 0;
      color: #ff2ea6;
      font-size: clamp(1.7rem, 5vw, 3rem);
      letter-spacing: 0.14rem;
      font-weight: 900;
      text-shadow: 0 0 14px rgba(255, 46, 166, 0.42);
      animation: title-float 2.6s ease-in-out infinite;
    }

    .pg-status {
      margin: 2px 0 0;
      color: #ffd6ef;
      font-size: 0.9rem;
      letter-spacing: 0.2rem;

      &.is-playing {
        color: #ff2ea6;
      }

      &.is-pause {
        color: #ffcc33;
      }

      &.is-gameover {
        color: #ff5e5e;
      }
    }

    .pg-frame {
      /* 不能跟 .pg-stage 共用同一個 400px 常數：frame 還有自己的 padding／border，
         若也卡在 400px，內層 stage 會被擠壓變窄，導致球拍／球座標跟 STAGE_WIDTH 常數對不齊 */
      width: fit-content;
      margin: 12px auto 0;
      padding: 14px;
      background: #1a0212;
      border: 10px solid #4a123a;
      border-radius: 18px;
      box-shadow: 0 0 0 1px rgba(255, 46, 166, 0.2), 0 0 24px rgba(255, 46, 166, 0.14);
      animation: frame-glow 5.4s ease-in-out infinite;
    }

    .pg-stage {
      /* 明確用 content-box：球拍／球座標常數（STAGE_WIDTH/HEIGHT）假設 400×280 是純內容區，
         不含這裡的 2px border，避免全站 box-sizing:border-box reset 讓邊框吃掉座標空間 */
      position: relative;
      box-sizing: content-box;
      width: 400px;
      height: 280px;
      background: #0a0208;
      border: 2px solid #000;
      border-radius: 8px;
      overflow: hidden;

      .pg-net {
        position: absolute;
        inset: 0 0 0 50%;
        width: 2px;
        margin-left: -1px;
        background-image: repeating-linear-gradient(to bottom, rgba(255, 46, 166, 0.35) 0, rgba(255, 46, 166, 0.35) 10px, transparent 10px, transparent 20px);
        pointer-events: none;
      }

      .pg-paddle {
        position: absolute;
        top: 0;
        left: 0;
        width: 10px;
        height: 56px;
        background: #ff2ea6;
        box-shadow: 0 0 8px rgba(255, 46, 166, 0.6);
        will-change: transform;

        &.cpu {
          left: 0;
        }

        &.player {
          left: 390px;
        }
      }

      .pg-ball {
        position: absolute;
        top: 0;
        left: 0;
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: #fff0fa;
        box-shadow: 0 0 8px rgba(255, 240, 250, 0.8);
        will-change: transform;
      }

      .pg-serve-flash {
        position: absolute;
        inset: 0;
        margin: 0;
        display: grid;
        place-items: center;
        color: #ff2ea6;
        font-weight: 900;
        font-size: 1.1rem;
        letter-spacing: 0.1rem;
        text-shadow: 0 0 10px rgba(255, 46, 166, 0.6);
        pointer-events: none;
        animation: serve-flash-pop 0.7s ease-out both;
      }
    }

    .pg-panel {
      margin-top: 10px;
      display: flex;
      justify-content: space-between;
      color: #ff2ea6;
      font-weight: 800;
      text-shadow: 0 0 6px rgba(255, 46, 166, 0.45);
    }

    .pg-message {
      margin-top: 14px;
      color: #ffd6ef;
      font-size: 0.85rem;
      animation: subtle-fade 2.8s ease-in-out infinite;
    }
  }

  .pg-help-panel {
    border: 1px solid rgba(255, 46, 166, 0.3);
    border-radius: 8px;
    padding: 12px;
    background: rgba(26, 2, 18, 0.5);

    .pg-help-title {
      margin: 0 0 6px;
      color: #ff2ea6;
      font-size: 0.75rem;
      letter-spacing: 0.14rem;
      font-weight: 800;
    }

    .pg-help-text {
      margin: 0;
      color: #ffd6ef;
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

@keyframes title-float {

  0%,
  100% {
    transform: translateY(0);
  }

  50% {
    transform: translateY(-2px);
  }
}

@keyframes frame-glow {

  0%,
  100% {
    box-shadow: 0 0 0 1px rgba(255, 46, 166, 0.2), 0 0 24px rgba(255, 46, 166, 0.14);
  }

  50% {
    box-shadow: 0 0 0 1px rgba(255, 130, 220, 0.35), 0 0 40px rgba(255, 46, 166, 0.28);
  }
}

@keyframes subtle-fade {

  0%,
  100% {
    opacity: 0.7;
  }

  50% {
    opacity: 1;
  }
}

@keyframes serve-flash-pop {
  0% {
    opacity: 0;
    transform: scale(0.85);
  }

  20% {
    opacity: 1;
    transform: scale(1.05);
  }

  75% {
    opacity: 1;
    transform: scale(1);
  }

  100% {
    opacity: 0;
    transform: scale(1);
  }
}

@media (max-width: 980px) {
  .pg-page {
    .pg-shell {
      grid-template-columns: 1fr;
      padding: 16px;
    }

    .pg-side {
      flex-direction: row;
      flex-wrap: wrap;
      justify-content: center;
    }
  }
}
</style>
