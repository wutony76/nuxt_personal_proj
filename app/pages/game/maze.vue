<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useGameHistory } from '~/composables/useGameHistory'
import MazeEngine, {
  TIME_ATTACK_DURATION_SEC,
  MAX_CLASSIC_LEVEL,
  MAZE_BASE_SCORE,
  MAZE_LEVEL_BONUS_PER_LEVEL,
  MAZE_STEP_PENALTY_PER_EXTRA_STEP,
  MAZE_TIME_PENALTY_PER_SEC,
  type MazeStatus,
  type MazeMode,
  type CellType,
  type MazeMoveDirection
} from '~/utils/mazeEngine'

/**
 * MAZE — 全專案第 28 款遊戲。
 *
 * 核心邏輯抽到 mazeEngine.ts（純 TS，Recursive Backtracking 生成保證可達的完美迷宮），頁面只以
 * reactive() 鏡像 engine 的 getSnapshot()，Logic / Rendering 分離（比照 FROGGER 的既有寫法）。
 * 迷宮格用絕對定位（left/top px）渲染，比照 space-invaders／battleship 既有的 DOM 動畫慣例。
 */

const CELL = 24
const ACCENT = '#2dd4bf'

const router = useRouter()
const engine = new MazeEngine()
const gameHistory = useGameHistory()

const state = reactive({
  status: 'idle' as MazeStatus,
  mode: 'CLASSIC' as MazeMode,
  selectedMode: 'CLASSIC' as MazeMode,
  grid: engine.getSnapshot().grid as CellType[][],
  playerRow: 1,
  playerCol: 1,
  exitRow: 1,
  exitCol: 1,
  level: 1,
  steps: 0,
  elapsedSec: 0,
  remainingSec: TIME_ATTACK_DURATION_SEC,
  score: 0,
  totalStepsAllLevels: 0,
  /** 過關瞬移到新迷宮起點時關掉補間動畫，避免玩家看到「滑過整個畫面」的違和感（比照 frogger 的 playerNoAnim） */
  playerNoAnim: false,
  message: '按「START」開始遊戲。',
  rewardMessage: '',
  waitingOverlayVisible: true,
  resultOverlayVisible: false,
  rateDialogOpen: false,
  ruleDialogOpen: false
})

const MAZE_RULE = {
  description:
    '從 START 找到 EXIT：迷宮由 Recursive Backtracking 演算法即時生成，保證每一關都恰好有路可通往終點。' +
    '方向鍵／WASD 或右側方向鍵一次移動一格，不能穿牆。走到出口即過關，自動生成下一關（尺寸隨關卡數增加）。' +
    '有兩種模式：CLASSIC 沒有時間限制、可以一路過關到第 50 關；TIME ATTACK 限時 ' +
    `${TIME_ATTACK_DURATION_SEC} 秒，時間歸零立即結束。`,
  scoreRule:
    `每關得分 ＝ 基礎分 ${MAZE_BASE_SCORE} ＋ 關卡加成（每關 +${MAZE_LEVEL_BONUS_PER_LEVEL} 分，封頂）－效率懲罰` +
    `（多走的步數每步 -${MAZE_STEP_PENALTY_PER_EXTRA_STEP} 分、花費秒數每秒 -${MAZE_TIME_PENALTY_PER_SEC} 分），分數跨關累計。` +
    '走越少步、花越少時間，單關分數越高。',
  levelsTitle: '模式',
  levels: [
    { level: 'CLASSIC', condition: `沒有時間限制，最多可連續挑戰到第 ${MAX_CLASSIC_LEVEL} 關自動結算` },
    { level: 'TIME ATTACK', condition: `共用 ${TIME_ATTACK_DURATION_SEC} 秒倒數，時間歸零立即結束` }
  ],
  note: 'ESC / P 可暫停，暫停期間不消耗時間。'
}

/** Game Timer：本頁持有的 setInterval，每秒推進 engine.tickTimer()（CLASSIC 模式下 engine 內部直接無視） */
let gameTimerId: ReturnType<typeof setInterval> | null = null

const renderCols = computed(() => (state.grid[0]?.length ?? 1))
const renderRows = computed(() => state.grid.length)
const boardStyle = computed(() => `--cell: ${CELL}px; width:${renderCols.value * CELL}px; height:${renderRows.value * CELL}px;`)
const flatCells = computed(() => {
  const out: Array<{ key: string; row: number; col: number; type: CellType }> = []
  state.grid.forEach((row, r) => {
    row.forEach((type, c) => {
      out.push({ key: `${r}-${c}`, row: r, col: c, type })
    })
  })
  return out
})
const playerStyle = computed(() => `left:${state.playerCol * CELL}px; top:${state.playerRow * CELL}px;`)
const exitStyle = computed(() => `left:${state.exitCol * CELL}px; top:${state.exitRow * CELL}px;`)

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
const lowTime = computed(() => state.mode === 'TIME_ATTACK' && state.status === 'playing' && state.remainingSec <= 15)
const timeLabel = computed(() => (state.mode === 'TIME_ATTACK' ? `${state.remainingSec}s` : `${state.elapsedSec}s`))

/** 私有工具方法：快照同步、計時器管理 */
const _handlers = {
  syncSnapshot: () => {
    const snap = engine.getSnapshot()
    const prevLevel = state.level
    state.status = snap.status
    state.mode = snap.mode
    state.grid = snap.grid
    state.playerRow = snap.playerRow
    state.playerCol = snap.playerCol
    state.exitRow = snap.exitRow
    state.exitCol = snap.exitCol
    state.level = snap.level
    state.steps = snap.steps
    state.elapsedSec = snap.elapsedSec
    state.remainingSec = snap.remainingSec
    state.score = snap.score
    state.totalStepsAllLevels = snap.totalStepsAllLevels
    // 換關（迷宮重建、玩家瞬移回新起點）時關掉補間動畫，避免玩家看到滑過整個畫面
    state.playerNoAnim = snap.level !== prevLevel
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
  }
}

const _actions = {
  recordHistory: async () => {
    state.rewardMessage = ''
    try {
      const result = await gameHistory.actions.record('maze', 'MAZE', {
        score: state.score,
        level: state.level,
        meta: {
          mode: state.mode,
          totalStepsAllLevels: state.totalStepsAllLevels
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
    engine.reset(state.selectedMode)
    state.playerNoAnim = true
    _handlers.syncSnapshot()
    state.rewardMessage = ''
    state.waitingOverlayVisible = true
    state.resultOverlayVisible = false
    state.message = '按「START」開始遊戲。'
  },
  startPlay: () => {
    engine.start(state.selectedMode)
    state.playerNoAnim = true
    _handlers.syncSnapshot()
    state.waitingOverlayVisible = false
    state.resultOverlayVisible = false
    state.message = '找到 EXIT 就能過關！'
    _handlers.startGameTimer()
  },
  move: (direction: MazeMoveDirection) => {
    if (state.status !== 'playing') return
    const result = engine.move(direction)
    _handlers.syncSnapshot()
    if (result.reachedExit) {
      state.message = result.gameOver ? `已達第 ${MAX_CLASSIC_LEVEL} 關上限，自動結算！` : `過關！+${result.levelScore} 分，進入第 ${state.level} 關`
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
    state.message = '找到 EXIT 就能過關！'
  },
  finishGame: () => {
    _handlers.stopGameTimer()
    _handlers.syncSnapshot()
    state.resultOverlayVisible = true
    state.message = '遊戲結束。'
    _actions.recordHistory()
  },
  playAgain: () => {
    _actions.resetGame()
    _actions.startPlay()
  },
  endGameNow: () => {
    _handlers.stopGameTimer()
    engine.pause()
    state.status = 'gameover'
    state.waitingOverlayVisible = false
    state.message = '本局已結束。'
    state.resultOverlayVisible = true
    _actions.recordHistory()
  },
  selectMode: (mode: MazeMode) => {
    if (state.status === 'playing' || state.status === 'paused') return
    state.selectedMode = mode
  }
}

const click = {
  start: () => _actions.startPlay(),
  dir: (direction: MazeMoveDirection) => _actions.move(direction),
  pause: () => _actions.pause(),
  resume: () => _actions.resume(),
  restart: () => _actions.playAgain(),
  end: () => _actions.endGameNow(),
  again: () => _actions.playAgain(),
  exit: () => router.replace('/game-hall'),
  selectClassic: () => _actions.selectMode('CLASSIC'),
  selectTimeAttack: () => _actions.selectMode('TIME_ATTACK'),
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
  const key = event.key.toLowerCase()
  if (key === 'escape' || key === 'p') {
    if (state.waitingOverlayVisible || state.resultOverlayVisible) return
    if (state.status === 'paused') _actions.resume()
    else if (state.status === 'playing') _actions.pause()
    return
  }
  let direction: MazeMoveDirection | null = null
  if (key === 'arrowup' || key === 'w') direction = 'up'
  else if (key === 'arrowdown' || key === 's') direction = 'down'
  else if (key === 'arrowleft' || key === 'a') direction = 'left'
  else if (key === 'arrowright' || key === 'd') direction = 'right'
  if (!direction) return
  event.preventDefault()
  if (state.status !== 'playing') return
  _actions.move(direction)
}

onMounted(() => {
  _actions.resetGame()
  window.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  _handlers.stopGameTimer()
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <main class="mz-page" :class="`state-${state.status}`">
    <div class="mz-overlay" />

    <div v-if="state.waitingOverlayVisible" class="game-mask waiting-mask">
      <div class="mask-title">WELCOME</div>
      <p class="waiting-subtitle">MAZE</p>
      <p class="waiting-hint">從 START 找到 EXIT · 每過一關迷宮會變大</p>
      <div class="mode-picker">
        <button class="mz-btn" type="button" :class="{ active: state.selectedMode === 'CLASSIC' }" @click="click.selectClassic">CLASSIC</button>
        <button class="mz-btn" type="button" :class="{ active: state.selectedMode === 'TIME_ATTACK' }" @click="click.selectTimeAttack">TIME ATTACK</button>
      </div>
      <button class="mz-btn waiting-btn waiting-start" type="button" @click="click.start">START</button>
      <button class="mz-btn link waiting-btn" type="button" @click="click.openRateDialog">CONVERT</button>
      <button class="mz-btn link waiting-btn" type="button" @click="click.openRuleDialog">RULE</button>
    </div>

    <div v-if="state.resultOverlayVisible" class="game-mask result-mask">
      <div class="mask-title">GAME OVER</div>
      <div class="result-list">
        <div class="result-item"><span>SCORE</span><b>{{ state.score }}</b></div>
        <div class="result-item"><span>LEVEL REACHED</span><b>{{ state.level }}</b></div>
        <div class="result-item"><span>TOTAL STEPS</span><b>{{ state.totalStepsAllLevels }}</b></div>
      </div>
      <p v-if="state.rewardMessage" class="result-reward">{{ state.rewardMessage }}</p>
      <div class="result-actions">
        <button class="mz-btn" type="button" @click="click.again">PLAY AGAIN</button>
        <button class="mz-btn danger" type="button" @click="click.exit">EXIT</button>
      </div>
    </div>

    <GameRateDialog :visible="state.rateDialogOpen" game-key="maze" game-name="MAZE" :accent-color="ACCENT"
      @close="click.closeRateDialog" />
    <GameRuleDialog :visible="state.ruleDialogOpen" game-name="MAZE" :accent-color="ACCENT" v-bind="MAZE_RULE"
      @close="click.closeRuleDialog" />

    <section class="mz-shell">
      <aside class="mz-side left">
        <button class="mz-btn" type="button" :disabled="!canResumeFromPause" @click="click.resume">START</button>
        <button class="mz-btn" type="button" :disabled="!canPauseWhilePlaying" @click="click.pause">PAUSE</button>
        <button class="mz-btn" type="button" @click="click.restart">RESTART</button>
        <button class="mz-btn link" type="button" @click="click.end">END</button>
        <button class="mz-btn" type="button" @click="click.openRateDialog">CONVERT</button>
        <button class="mz-btn" type="button" @click="click.openRuleDialog">RULE</button>
      </aside>

      <section class="mz-center">
        <header class="mz-title-wrap">
          <h1 class="mz-title">MAZE</h1>
          <p class="mz-status">{{ statusText }}</p>
        </header>

        <div class="mz-panel">
          <span>SCORE: {{ state.score }}</span>
          <span>LEVEL: {{ state.level }}</span>
          <span>STEPS: {{ state.steps }}</span>
          <span class="mz-time" :class="{ low: lowTime }">TIME: {{ timeLabel }}</span>
        </div>

        <div class="mz-frame">
          <div class="mz-board" :style="boardStyle">
            <div v-for="cell in flatCells" :key="cell.key" class="mz-cell" :class="cell.type.toLowerCase()"
              :style="`left:${cell.col * CELL}px; top:${cell.row * CELL}px;`" />
            <div class="mz-exit" :style="exitStyle" />
            <div class="mz-player" :class="{ 'no-anim': state.playerNoAnim }" :style="playerStyle" />
          </div>
        </div>

        <p class="mz-message">{{ state.message }}</p>
      </section>

      <aside class="mz-side right">
        <div class="mz-keypad">
          <button class="mz-btn key up" type="button" @click="click.dir('up')">↑</button>
          <button class="mz-btn key left" type="button" @click="click.dir('left')">←</button>
          <button class="mz-btn key down" type="button" @click="click.dir('down')">↓</button>
          <button class="mz-btn key right" type="button" @click="click.dir('right')">→</button>
        </div>
        <div class="mz-help">W A S D / Arrow Keys</div>
        <div class="mz-help-panel">
          <p class="mz-help-title">HOW TO PLAY</p>
          <p class="mz-help-text">
            方向鍵／WASD 或右側方向鍵一次移動一格，找到 EXIT 就能過關，下一關迷宮會變大。
            CLASSIC 沒有時間限制；TIME ATTACK 限時倒數，歸零立即結束。ESC / P 可暫停。
          </p>
        </div>
      </aside>
    </section>
  </main>
</template>

<style scoped lang="scss">
.mz-page {
  --accent: #2dd4bf;
  position: relative;
  min-height: 100vh;
  display: grid;
  place-items: center;
  background: radial-gradient(circle at top, #062120, #030a0a 60%);
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
    background: radial-gradient(circle at 20% 20%, rgba(45, 212, 191, 0.18), transparent 45%),
      radial-gradient(circle at 80% 70%, rgba(45, 212, 191, 0.1), transparent 40%);
    filter: blur(40px);
    animation: mz-ambient-drift 12s ease-in-out infinite alternate;
  }

  &::after {
    background: linear-gradient(115deg, rgba(45, 212, 191, 0.06), rgba(0, 0, 0, 0));
    animation: mz-ambient-pulse 4.6s ease-in-out infinite;
  }

  .mz-overlay {
    position: absolute;
    inset: 0;
    background-image: linear-gradient(rgba(45, 212, 191, 0.05) 1px, transparent 1px),
      linear-gradient(90deg, rgba(45, 212, 191, 0.05) 1px, transparent 1px);
    background-size: 28px 28px;
    pointer-events: none;
    z-index: 0;
    animation: mz-grid-drift 14s linear infinite;
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
      text-shadow: 0 0 18px rgba(45, 212, 191, 0.5);
    }

    &.waiting-mask {
      background: rgba(0, 0, 0, 0.88);

      .waiting-subtitle {
        margin: 0;
        color: #7ef4e4;
        letter-spacing: 0.3rem;
        font-size: 1.05rem;
        font-weight: 800;
      }

      .waiting-hint {
        margin: 0;
        max-width: 340px;
        text-align: center;
        color: #4fa89c;
        font-size: 0.78rem;
        letter-spacing: 0.04em;
      }

      .mode-picker {
        display: flex;
        gap: 10px;
        margin: 4px 0;
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
      border: 1px solid rgba(45, 212, 191, 0.4);
      background: rgba(6, 33, 32, 0.65);
      color: #d3fff8;
      padding: 8px 10px;
      font-variant-numeric: tabular-nums;
    }

    .result-reward {
      margin: 8px 0 0;
      color: #7ef4e4;
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

  .mz-shell {
    position: relative;
    z-index: 1;
    width: min(1100px, 100%);
    padding: 24px;
    display: grid;
    grid-template-columns: 180px 1fr 180px;
    gap: 20px;
    align-items: start;
  }

  .mz-side {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding-top: 160px;
  }

  .mz-btn {
    position: relative;
    overflow: hidden;
    border: 1px solid rgba(45, 212, 191, 0.4);
    border-radius: 6px;
    padding: 10px 12px;
    background: rgba(6, 33, 32, 0.75);
    color: #5eead4;
    font-weight: 700;
    letter-spacing: 0.5px;
    cursor: pointer;
    transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;

    &::after {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(105deg, transparent 35%, rgba(180, 250, 240, 0.22) 50%, transparent 65%);
      transform: translateX(-150%);
      transition: transform 0.35s ease;
      pointer-events: none;
    }

    &:hover:not(:disabled) {
      border-color: var(--accent);
      box-shadow: 0 0 12px rgba(45, 212, 191, 0.4);
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

    &.active {
      border-color: var(--accent);
      color: #d3fff8;
      box-shadow: 0 0 10px rgba(45, 212, 191, 0.5);
    }
  }

  .mz-center {
    text-align: center;

    .mz-title-wrap {
      margin-bottom: 8px;
    }

    .mz-title {
      margin: 0;
      color: var(--accent);
      font-size: clamp(1.7rem, 5vw, 3rem);
      letter-spacing: 0.14rem;
      font-weight: 900;
      text-shadow: 0 0 14px rgba(45, 212, 191, 0.45);
    }

    .mz-status {
      margin: 2px 0 0;
      color: #7ef4e4;
      font-size: 0.9rem;
      letter-spacing: 0.2rem;
    }

    .mz-panel {
      margin: 10px auto 0;
      display: flex;
      justify-content: center;
      flex-wrap: wrap;
      gap: 8px 16px;
      color: #5eead4;
      font-weight: 800;
      font-size: 0.8rem;
      text-shadow: 0 0 6px rgba(45, 212, 191, 0.45);
      font-variant-numeric: tabular-nums;

      .mz-time.low {
        color: #ff6b5b;
        text-shadow: 0 0 8px rgba(255, 107, 91, 0.6);
        animation: mz-time-flash 0.9s ease-in-out infinite;
      }
    }

    .mz-frame {
      width: fit-content;
      margin: 16px auto 0;
      padding: 14px;
      background: #041615;
      border: 8px solid #0d3c38;
      border-radius: 16px;
      box-shadow: 0 0 0 1px rgba(45, 212, 191, 0.18), 0 0 26px rgba(20, 90, 82, 0.4);
    }

    .mz-board {
      position: relative;
    }

    .mz-cell {
      position: absolute;
      width: var(--cell);
      height: var(--cell);

      &.wall {
        background: #0a2d2a;
        box-shadow: inset 0 0 0 1px rgba(45, 212, 191, 0.08);
      }

      &.path {
        background: #052220;
      }
    }

    .mz-exit {
      position: absolute;
      width: var(--cell);
      height: var(--cell);
      display: grid;
      place-items: center;
      z-index: 2;

      &::before {
        content: '';
        width: 68%;
        height: 68%;
        border-radius: 4px;
        background: radial-gradient(circle at 50% 40%, #baffef, #34e5c9 70%);
        box-shadow: 0 0 14px rgba(52, 229, 201, 0.85);
      }
    }

    .mz-player {
      position: absolute;
      width: var(--cell);
      height: var(--cell);
      z-index: 3;
      transition: left 0.09s ease-out, top 0.09s ease-out;

      &.no-anim {
        transition: none;
      }

      &::before {
        content: '';
        position: absolute;
        inset: 18%;
        border-radius: 50%;
        background: radial-gradient(circle at 40% 32%, #fff4c2, #ffb020 70%);
        box-shadow: 0 0 10px rgba(255, 176, 32, 0.8);
      }
    }
  }

  .mz-message {
    margin-top: 14px;
    color: #7ef4e4;
    font-size: 0.85rem;
    min-height: 1.2em;
  }

  .mz-keypad {
    display: grid;
    grid-template-columns: repeat(3, 46px);
    grid-template-rows: repeat(2, 46px);
    gap: 6px;
    justify-content: center;

    .key {
      padding: 0;
      font-size: 1.1rem;

      &.up {
        grid-column: 2;
        grid-row: 1;
      }

      &.left {
        grid-column: 1;
        grid-row: 2;
      }

      &.down {
        grid-column: 2;
        grid-row: 2;
      }

      &.right {
        grid-column: 3;
        grid-row: 2;
      }
    }
  }

  .mz-help {
    margin-top: 4px;
    font-size: 0.62rem;
    color: #4fa89c;
    letter-spacing: 0.04em;
    text-align: center;
  }

  .mz-help-panel {
    margin-top: 6px;
    border: 1px solid rgba(45, 212, 191, 0.3);
    border-radius: 8px;
    padding: 12px;
    background: rgba(6, 33, 32, 0.5);

    .mz-help-title {
      margin: 0 0 6px;
      color: var(--accent);
      font-size: 0.72rem;
      letter-spacing: 0.14rem;
      font-weight: 800;
    }

    .mz-help-text {
      margin: 0;
      color: #7ef4e4;
      font-size: 0.72rem;
      line-height: 1.6;
    }
  }
}

@keyframes mz-ambient-drift {
  0% {
    transform: translate(-1.5%, -1%) scale(1);
  }

  100% {
    transform: translate(1.5%, 1%) scale(1.06);
  }
}

@keyframes mz-ambient-pulse {

  0%,
  100% {
    opacity: 0.35;
  }

  50% {
    opacity: 0.75;
  }
}

@keyframes mz-grid-drift {
  0% {
    transform: translate(0, 0);
  }

  100% {
    transform: translate(14px, 14px);
  }
}

@keyframes mz-time-flash {

  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0.5;
  }
}

@media (max-width: 980px) {
  .mz-page {
    .mz-shell {
      grid-template-columns: 1fr;
      padding: 16px;
    }

    .mz-side {
      flex-direction: row;
      flex-wrap: wrap;
      justify-content: center;
      padding-top: 0;
    }
  }
}
</style>
