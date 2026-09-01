<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useGameHistory } from '~/composables/useGameHistory'
import FlappyEngine, {
  STAGE_WIDTH,
  STAGE_HEIGHT,
  GROUND_HEIGHT,
  FLOOR_Y,
  PLAYER_X,
  PLAYER_WIDTH,
  PLAYER_HEIGHT,
  type Pipe
} from '~/utils/flappyEngine'

type FlappyStatus = 'ready' | 'playing' | 'pause' | 'gameover'

const TICK_MS = 16
const ACCENT = '#06d6a0'

const router = useRouter()
const engine = new FlappyEngine()
const gameHistory = useGameHistory()

const state = reactive({
  status: 'ready' as FlappyStatus,
  /** engine snapshot 的鏡像；頁面只讀，不直接改動 engine 內部欄位 */
  playerY: 0,
  velocityY: 0,
  pipes: [] as Pipe[],
  score: 0,
  scrollSpeed: 0,
  message: '按 START 或點擊畫面開始，空白鍵／點擊給角色向上衝力。',
  rewardMessage: '',
  waitingOverlayVisible: true,
  resultOverlayVisible: false,
  rateDialogOpen: false,
  ruleDialogOpen: false
})

const FLAPPY_RULE = {
  description:
    '點擊畫面、按空白鍵或 ↑ 鍵給角色一次性向上衝力，沒有操作時角色會持續受重力加速下墜。' +
    '穿越一組組上下管道之間的空隙即可得分；撞到管道任一段或掉到地面就結束，撞到畫面頂端不會死、只會被擋住。',
  scoreRule:
    'SCORE ＝ 通過的管道組數，每完整穿越一組 +1，沒有上限；分數越高捲動速度越快，到達速度上限後不再加速。',
  levels: [
    { level: '操作', condition: '點擊／空白鍵／↑ 給向上衝力，連續快點不會疊加速度（單次衝力固定）' },
    { level: '重力', condition: '沒有操作時持續加速下墜，越晚拉起下墜越快' },
    { level: '得分', condition: '角色完全通過一組管道空隙 → +1，同一組不會重複計分' },
    { level: '結束', condition: '撞到管道任一段或掉到地面 → GAME OVER（撞頂只夾住位置、不算輸）' }
  ],
  levelsTitle: '玩法規則',
  note: '難度隨分數提升：捲動速度逐步加快到上限。暫停或離開頁面不會結算，唯有撞毀才記錄分數。'
}

let tickTimer: ReturnType<typeof setInterval> | null = null

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
  () => state.status === 'pause' && !state.waitingOverlayVisible && !state.resultOverlayVisible
)
const canPauseWhilePlaying = computed(() => state.status === 'playing')
/** HIGH SCORE 直接重用 useGameHistory 的 statsByGame（見 design.md High Score），並與本局分數取大值即時反映 */
const bestScore = computed(() => Math.max(gameHistory.statsByGame.value['flappy']?.best ?? 0, state.score))
const stageStyle = computed(() => `width: ${STAGE_WIDTH}px; height: ${STAGE_HEIGHT}px;`)
const groundStyle = computed(() => `top: ${FLOOR_Y}px; height: ${GROUND_HEIGHT}px;`)

/** 私有工具方法：snapshot 同步、計時器管理、inline style 映射（比照 runner 的 obstacleStyle 模式） */
const _handlers = {
  syncState: () => {
    const snap = engine.getSnapshot()
    state.playerY = snap.playerY
    state.velocityY = snap.velocityY
    state.pipes = snap.pipes
    state.score = snap.score
    state.scrollSpeed = snap.scrollSpeed
  },
  stopTickTimer: () => {
    if (tickTimer) {
      clearInterval(tickTimer)
      tickTimer = null
    }
  },
  pipeTopStyle: (pipe: Pipe) => `left: ${pipe.x}px; top: 0px; width: ${pipe.width}px; height: ${pipe.gapTop}px;`,
  pipeBottomStyle: (pipe: Pipe) => {
    const bottomTop = pipe.gapTop + pipe.gapHeight
    return `left: ${pipe.x}px; top: ${bottomTop}px; width: ${pipe.width}px; height: ${FLOOR_Y - bottomTop}px;`
  },
  /** 角色隨垂直速度傾斜（上衝抬頭、下墜低頭），純視覺提示，不影響碰撞判定範圍 */
  playerStyle: () => {
    const rot = Math.max(-24, Math.min(70, state.velocityY * 4.5))
    return `left: ${PLAYER_X}px; top: ${state.playerY}px; width: ${PLAYER_WIDTH}px; height: ${PLAYER_HEIGHT}px; transform: rotate(${rot}deg);`
  }
}

const _actions = {
  recordHistory: async () => {
    state.rewardMessage = ''
    try {
      const result = await gameHistory.actions.record('flappy', 'FLAPPY', { score: state.score })
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
      const result = engine.step()
      _handlers.syncState()
      if (result.gameOver) _actions.finishGame()
    }, TICK_MS)
  },
  finishGame: () => {
    state.status = 'gameover'
    state.message = `撞上了！本局通過 ${state.score} 組管道。`
    state.resultOverlayVisible = true
    _handlers.stopTickTimer()
    _actions.recordHistory()
  },
  /** 完整重置 Player／Pipes／Score／ScrollSpeed／GameState（見 spec「Restart 完整重置」），停在 READY */
  resetGame: () => {
    _handlers.stopTickTimer()
    engine.reset()
    _handlers.syncState()
    state.status = 'ready'
    state.waitingOverlayVisible = true
    state.resultOverlayVisible = false
    state.rewardMessage = ''
    state.message = '按 START 或點擊畫面開始，空白鍵／點擊給角色向上衝力。'
  },
  startGame: () => {
    if (state.status === 'playing') return
    if (state.status === 'gameover') _actions.resetGame()
    state.waitingOverlayVisible = false
    state.resultOverlayVisible = false
    state.status = 'playing'
    state.message = '點擊／空白鍵給向上衝力，穿越管道空隙！'
    _actions.startTickLoop()
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
    state.message = '遊戲進行中...'
    _actions.startTickLoop()
  },
  playAgain: () => {
    _actions.resetGame()
    _actions.startGame()
  },
  endGameNow: () => {
    _handlers.stopTickTimer()
    state.waitingOverlayVisible = false
    state.status = 'gameover'
    state.message = '本局已結束。'
    state.resultOverlayVisible = true
    _actions.recordHistory()
  },
  /** 三種輸入來源（鍵盤／滑鼠／觸控）共用的主要輸入入口：依當前狀態轉為「開始／flap／重來」 */
  primaryInput: () => {
    if (state.rateDialogOpen || state.ruleDialogOpen) return
    if (state.status === 'ready') {
      _actions.startGame()
      return
    }
    if (state.status === 'playing') {
      engine.flap()
      return
    }
    if (state.status === 'gameover' && state.resultOverlayVisible) {
      _actions.playAgain()
    }
  }
}

const onFlappyKeydown = (event: KeyboardEvent) => {
  const key = event.key.toLowerCase()
  if (key === 'escape' || key === 'p') {
    if (state.status === 'playing') _actions.pauseGame()
    else if (canResumeFromPause.value) _actions.resumeGame()
    return
  }
  if (key === 'arrowup' || key === 'w' || key === ' ') {
    event.preventDefault()
    _actions.primaryInput()
  }
}

const click = {
  start: () => _actions.startGame(),
  pause: () => _actions.pauseGame(),
  resume: () => _actions.resumeGame(),
  replay: () => _actions.resetGame(),
  end: () => _actions.endGameNow(),
  again: () => _actions.playAgain(),
  exit: () => router.replace('/game-hall'),
  /** 遊戲畫面點擊／觸控（滑鼠與觸控由 pointerdown 一併涵蓋），統一走 primaryInput */
  stageTap: (event: PointerEvent) => {
    event.preventDefault()
    _actions.primaryInput()
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
  // 載入歷史紀錄以取得 HIGH SCORE（statsByGame），失敗不影響遊戲
  gameHistory.ensureLoaded().catch(() => undefined)
  if (typeof window !== 'undefined') window.addEventListener('keydown', onFlappyKeydown)
  _actions.resetGame()
  state.waitingOverlayVisible = true
})

onBeforeUnmount(() => {
  _handlers.stopTickTimer()
  if (typeof window !== 'undefined') window.removeEventListener('keydown', onFlappyKeydown)
})
</script>

<template>
  <main class="fp-page" :class="`state-${state.status}`">
    <div class="fp-overlay" />

    <div v-if="state.waitingOverlayVisible" class="game-mask waiting-mask">
      <div class="mask-title">WELCOME</div>
      <p class="waiting-subtitle">FLAPPY</p>
      <p class="waiting-hint">點擊／空白鍵給向上衝力 · 穿越管道空隙 · 撞到管道或地面即結束</p>
      <button class="fp-btn waiting-btn waiting-start" type="button" @click="click.start">START</button>
      <button class="fp-btn link waiting-btn" type="button" @click="click.openRateDialog">CONVERT</button>
      <button class="fp-btn link waiting-btn" type="button" @click="click.openRuleDialog">RULE</button>
    </div>

    <div v-if="state.status === 'pause'" class="game-mask pause-mask">
      <div class="mask-title">PAUSED</div>
      <div class="result-actions">
        <button class="fp-btn" type="button" @click="click.resume">RESUME</button>
        <button class="fp-btn" type="button" @click="click.replay">RESTART</button>
        <button class="fp-btn danger" type="button" @click="click.exit">EXIT</button>
      </div>
    </div>

    <div v-if="state.resultOverlayVisible" class="game-mask result-mask">
      <div class="mask-title">GAME OVER</div>
      <div class="result-list">
        <div class="result-item"><span>SCORE</span><b>{{ state.score }}</b></div>
        <div class="result-item"><span>HIGH SCORE</span><b>{{ bestScore }}</b></div>
      </div>
      <p v-if="state.rewardMessage" class="result-reward">{{ state.rewardMessage }}</p>
      <div class="result-actions">
        <button class="fp-btn" type="button" @click="click.again">AGAIN</button>
        <button class="fp-btn danger" type="button" @click="click.exit">EXIT</button>
      </div>
    </div>

    <GameRateDialog :visible="state.rateDialogOpen" game-key="flappy" game-name="FLAPPY" :accent-color="ACCENT"
      @close="click.closeRateDialog" />
    <GameRuleDialog :visible="state.ruleDialogOpen" game-name="FLAPPY" :accent-color="ACCENT" v-bind="FLAPPY_RULE"
      @close="click.closeRuleDialog" />

    <section class="fp-shell">
      <aside class="fp-side left">
        <button class="fp-btn" type="button" :disabled="!canResumeFromPause" @click="click.resume">START</button>
        <button class="fp-btn" type="button" :disabled="!canPauseWhilePlaying" @click="click.pause">PAUSE</button>
        <button class="fp-btn" type="button" @click="click.replay">REPLAY</button>
        <button class="fp-btn link" type="button" @click="click.end">END</button>
        <button class="fp-btn" type="button" @click="click.openRateDialog">CONVERT</button>
        <button class="fp-btn" type="button" @click="click.openRuleDialog">RULE</button>
      </aside>

      <section class="fp-center">
        <header class="fp-title-wrap">
          <h1 class="fp-title">FLAPPY</h1>
          <p class="fp-status" :class="statusClass">{{ statusText }}</p>
        </header>

        <div class="fp-frame">
          <div class="fp-stage" :style="stageStyle" @pointerdown="click.stageTap">
            <div v-for="pipe in state.pipes" :key="`t-${pipe.id}`" class="fp-pipe top" :style="_handlers.pipeTopStyle(pipe)" />
            <div v-for="pipe in state.pipes" :key="`b-${pipe.id}`" class="fp-pipe bottom" :style="_handlers.pipeBottomStyle(pipe)" />
            <div class="fp-ground" :style="groundStyle" />
            <div class="fp-player" :class="statusClass" :style="_handlers.playerStyle()" />
          </div>
          <div class="fp-panel">
            <span>SCORE: {{ state.score }}</span>
            <span>HIGH: {{ bestScore }}</span>
          </div>
        </div>

        <p class="fp-message">{{ state.message }}</p>
      </section>

      <aside class="fp-side right">
        <div class="fp-help-panel">
          <p class="fp-help-title">HOW TO PLAY</p>
          <p class="fp-help-text">
            點擊畫面／空白鍵／↑ 給角色一次性向上衝力，沒操作時持續受重力下墜。穿越上下管道之間的空隙即 +1 分，
            撞到管道或掉到地面就結束，撞到頂端只會被擋住不會死。ESC／P 可暫停。
          </p>
        </div>
      </aside>
    </section>
  </main>
</template>

<style scoped lang="scss">
.fp-page {
  --accent: #06d6a0;
  position: relative;
  min-height: 100vh;
  display: grid;
  place-items: center;
  background: radial-gradient(circle at top, #04231c, #02100c 60%);
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
    background: radial-gradient(circle at 20% 20%, rgba(6, 214, 160, 0.16), transparent 45%),
      radial-gradient(circle at 80% 70%, rgba(45, 226, 230, 0.1), transparent 40%);
    filter: blur(40px);
    animation: ambient-drift 12s ease-in-out infinite alternate;
  }

  &::after {
    background: linear-gradient(115deg, rgba(6, 214, 160, 0.05), rgba(0, 0, 0, 0));
    animation: ambient-pulse 4.6s ease-in-out infinite;
  }

  .fp-overlay {
    position: absolute;
    inset: 0;
    background-image: linear-gradient(rgba(6, 214, 160, 0.05) 1px, transparent 1px),
      linear-gradient(90deg, rgba(6, 214, 160, 0.05) 1px, transparent 1px);
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
      text-shadow: 0 0 18px rgba(6, 214, 160, 0.5);
    }

    &.waiting-mask {
      background: rgba(0, 0, 0, 0.88);

      .waiting-subtitle {
        margin: 0;
        color: #7ff5da;
        letter-spacing: 0.3rem;
        font-size: 1.05rem;
        font-weight: 800;
      }

      .waiting-hint {
        margin: 0;
        color: #4fbfa4;
        font-size: 0.78rem;
        letter-spacing: 0.04em;
      }

      .waiting-btn {
        width: 200px;
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
      border: 1px solid rgba(6, 214, 160, 0.4);
      background: rgba(6, 44, 36, 0.65);
      color: #b6f5e5;
      padding: 8px 10px;
      font-variant-numeric: tabular-nums;
    }

    .result-reward {
      margin: 8px 0 0;
      color: #8ff0d7;
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

  .fp-shell {
    position: relative;
    z-index: 1;
    width: min(1100px, 100%);
    padding: 24px;
    display: grid;
    grid-template-columns: 180px 1fr 180px;
    gap: 20px;
    align-items: center;
  }

  .fp-side {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .fp-btn {
    position: relative;
    overflow: hidden;
    border: 1px solid rgba(6, 214, 160, 0.4);
    border-radius: 6px;
    padding: 10px 12px;
    background: rgba(6, 44, 36, 0.75);
    color: var(--accent);
    font-weight: 700;
    letter-spacing: 0.5px;
    cursor: pointer;
    transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;

    &::after {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(105deg, transparent 35%, rgba(178, 245, 229, 0.25) 50%, transparent 65%);
      transform: translateX(-150%);
      transition: transform 0.35s ease;
      pointer-events: none;
    }

    &:hover {
      border-color: var(--accent);
      box-shadow: 0 0 12px rgba(6, 214, 160, 0.35);
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

  .fp-center {
    text-align: center;

    .fp-title-wrap {
      margin-bottom: 8px;
    }

    .fp-title {
      margin: 0;
      color: var(--accent);
      font-size: clamp(1.7rem, 5vw, 3rem);
      letter-spacing: 0.14rem;
      font-weight: 900;
      text-shadow: 0 0 14px rgba(6, 214, 160, 0.45);
      animation: title-float 2.6s ease-in-out infinite;
    }

    .fp-status {
      margin: 2px 0 0;
      color: #7ff5da;
      font-size: 0.9rem;
      letter-spacing: 0.2rem;

      &.is-playing {
        color: var(--accent);
      }

      &.is-pause {
        color: #ffcc33;
      }

      &.is-gameover {
        color: #ff5e5e;
      }
    }

    .fp-frame {
      width: fit-content;
      margin: 12px auto 0;
      padding: 14px;
      background: #06251e;
      border: 10px solid #0c473a;
      border-radius: 18px;
      box-shadow: 0 0 0 1px rgba(6, 214, 160, 0.2), 0 0 24px rgba(6, 214, 160, 0.14);
      animation: frame-glow 5.4s ease-in-out infinite;
    }

    .fp-stage {
      box-sizing: content-box;
      position: relative;
      background: linear-gradient(180deg, #041c17 0%, #02100c 100%);
      border: 2px solid #000;
      border-radius: 8px;
      overflow: hidden;
      /* 觸控裝置上點擊畫面 flap 時，阻止瀏覽器原生捲動／縮放搶走手勢 */
      touch-action: none;
      user-select: none;
      -webkit-user-select: none;
      cursor: pointer;
    }

    /* 原創「方正直角」像素柱狀障礙——刻意非圓頭、非 Flappy Bird 綠色水管造型（見 design.md Decision 6） */
    .fp-pipe {
      position: absolute;
      background: linear-gradient(90deg, #05a37c 0%, #06d6a0 45%, #3df0c0 55%, #05a37c 100%);
      border: 2px solid #023528;
      box-shadow: 0 0 10px rgba(6, 214, 160, 0.4), inset 0 0 8px rgba(3, 53, 40, 0.6);
      will-change: left;

      /* 方形直角的「柱帽」——用實心色帶而非圓頭，貼在朝向空隙的那一端 */
      &::after {
        content: '';
        position: absolute;
        left: -3px;
        right: -3px;
        height: 12px;
        background: #048a68;
        border: 2px solid #023528;
        box-shadow: 0 0 8px rgba(6, 214, 160, 0.35);
      }

      &.top::after {
        bottom: -2px;
      }

      &.bottom::after {
        top: -2px;
      }
    }

    /* 底部地面帶：頂緣即碰撞地板（FLOOR_Y），青綠亮線標示落地判定位置 */
    .fp-ground {
      position: absolute;
      left: 0;
      right: 0;
      background: repeating-linear-gradient(45deg, #063a2e 0, #063a2e 8px, #052f25 8px, #052f25 16px);
      border-top: 2px solid rgba(6, 214, 160, 0.7);
      box-shadow: 0 -4px 12px rgba(6, 214, 160, 0.18);
    }

    /* 原創「非鳥類、無鳥嘴」的方塊生物——圓角方形身體＋方形眼睛＋側鰭，配色刻意避開黃色鳥型 */
    .fp-player {
      position: absolute;
      background: linear-gradient(150deg, #ff9bbb 0%, #ff5d8f 55%, #d63d6f 100%);
      border: 2px solid #7a1f3c;
      border-radius: 8px 10px 10px 8px;
      box-shadow: 0 0 12px rgba(255, 93, 143, 0.55), inset 0 2px 4px rgba(255, 255, 255, 0.3);
      transition: transform 0.06s linear;
      will-change: top, transform;
      z-index: 2;

      /* 方形眼睛（白底黑瞳，用 box-shadow 疊出瞳孔），靠身體前上方 */
      &::before {
        content: '';
        position: absolute;
        top: 5px;
        right: 6px;
        width: 8px;
        height: 8px;
        background: #fff;
        border: 1.5px solid #3a0f1d;
        border-radius: 2px;
        box-shadow: inset -2px 0 0 0 #2a0a14;
      }

      /* 側鰭／腹紋，強化「方塊生物」而非鳥的輪廓 */
      &::after {
        content: '';
        position: absolute;
        left: 4px;
        bottom: 5px;
        width: 11px;
        height: 6px;
        background: rgba(122, 31, 60, 0.55);
        border-radius: 3px;
      }

      &.is-gameover {
        filter: grayscale(0.35) brightness(0.85);
      }
    }

    .fp-panel {
      margin-top: 12px;
      display: flex;
      justify-content: space-between;
      color: var(--accent);
      font-weight: 800;
      text-shadow: 0 0 6px rgba(6, 214, 160, 0.45);
      font-variant-numeric: tabular-nums;
    }

    .fp-message {
      margin-top: 14px;
      color: #7ff5da;
      font-size: 0.85rem;
      animation: subtle-fade 2.8s ease-in-out infinite;
    }
  }

  .fp-help-panel {
    border: 1px solid rgba(6, 214, 160, 0.3);
    border-radius: 8px;
    padding: 12px;
    background: rgba(6, 44, 36, 0.5);

    .fp-help-title {
      margin: 0 0 6px;
      color: var(--accent);
      font-size: 0.75rem;
      letter-spacing: 0.14rem;
      font-weight: 800;
    }

    .fp-help-text {
      margin: 0;
      color: #7ff5da;
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
    box-shadow: 0 0 0 1px rgba(6, 214, 160, 0.2), 0 0 24px rgba(6, 214, 160, 0.14);
  }

  50% {
    box-shadow: 0 0 0 1px rgba(61, 240, 192, 0.35), 0 0 40px rgba(6, 214, 160, 0.28);
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

@media (max-width: 980px) {
  .fp-page {
    .fp-shell {
      grid-template-columns: 1fr;
      padding: 16px;
    }

    .fp-side {
      flex-direction: row;
      flex-wrap: wrap;
      justify-content: center;
    }
  }
}
</style>
