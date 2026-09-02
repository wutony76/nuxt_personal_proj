<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useGameHistory } from '~/composables/useGameHistory'
import LightsOutEngine, { LEVELS, calcLevelScore, type Grid } from '~/utils/lightsOutEngine'

type LightsOutStatus = 'ready' | 'playing' | 'levelClear' | 'pause' | 'gameover'
type FlatCell = { r: number; c: number; on: boolean }

const CELL_SIZE = 46
/** 過關「LEVEL CLEAR」過場停留時間（比照 MINESWEEPER 的短暫過場，不需要 READY 倒數） */
const LEVEL_CLEAR_MS = 1200
const ACCENT = '#adb5bd'

const router = useRouter()
const engine = new LightsOutEngine()
const gameHistory = useGameHistory()

const state = reactive({
  status: 'ready' as LightsOutStatus,
  /** engine snapshot 的鏡像；頁面只讀，不直接改動棋盤 */
  grid: [] as Grid,
  size: LEVELS[0]!.size,
  level: 1,
  moves: 0,
  moveLimit: LEVELS[0]!.moveLimit,
  score: 0,
  /** 鍵盤游標高亮格（限制在棋盤範圍內） */
  cursorRow: 0,
  cursorCol: 0,
  /** Game Over 當下止步的關卡與本關步數（寫入紀錄 meta 用） */
  reachedLevel: 1,
  lastLevelGained: 0,
  message: '按「開始」後點擊格子，把全部燈熄滅即可過關。',
  rewardMessage: '',
  waitingOverlayVisible: true,
  levelClearOverlayVisible: false,
  resultOverlayVisible: false,
  rateDialogOpen: false,
  ruleDialogOpen: false
})

const LIGHTS_OUT_RULE = {
  description:
    '經典關燈益智：棋盤上每格只有「亮（ON）／暗（OFF）」兩種狀態，點擊任一格會同時切換「自己與上下左右四個鄰格」的亮暗' +
    '（超出棋盤的方向自動忽略，對角格不受影響）。目標是在該關步數上限內，把整個棋盤的燈全部熄滅（全部變 OFF）即過關。',
  scoreRule:
    '每過一關得分 ＝ 固定過關獎勵（50 + 關卡 × 10）＋ 效率分（棋盤格數² × 40 ÷ 本關步數，步數越少分越高）；' +
    'SCORE ＝ 各關得分跨關累加，撐到步數用完仍未熄燈則遊戲結束並結算累計分數。',
  levelsTitle: '關卡數值',
  levels: LEVELS.map((lv, idx) => ({
    level: idx + 1,
    condition: `${lv.size}×${lv.size} 棋盤／步數上限 ${lv.moveLimit}`
  })),
  note: '棋盤大小隨關卡遞增（3×3 起、封頂 7×7），步數上限在同尺寸內遞減；打完固定關卡後會依延伸公式持續生成關卡。本遊戲不提供 Undo。'
}

let levelClearTimer: ReturnType<typeof setTimeout> | null = null

const statusText = computed(() => {
  if (state.status === 'playing') return 'PLAYING'
  if (state.status === 'levelClear') return 'LEVEL CLEAR'
  if (state.status === 'pause') return 'PAUSE'
  if (state.status === 'gameover') return 'GAME OVER'
  return 'READY'
})
const statusClass = computed(() => {
  if (state.status === 'playing') return 'is-playing'
  if (state.status === 'levelClear') return 'is-clear'
  if (state.status === 'pause') return 'is-pause'
  if (state.status === 'gameover') return 'is-gameover'
  return 'is-ready'
})
const canPauseWhilePlaying = computed(() => state.status === 'playing')
const canResumeFromPause = computed(
  () =>
    state.status === 'pause' &&
    !state.waitingOverlayVisible &&
    !state.levelClearOverlayVisible &&
    !state.resultOverlayVisible
)
const litCount = computed(() => state.grid.reduce((sum, row) => sum + row.filter((cell) => cell).length, 0))
const stageStyle = computed(() => `--cell: ${CELL_SIZE}px;`)
const boardStyle = computed(() => `grid-template-columns: repeat(${state.size}, var(--cell));`)
/** 攤平棋盤成一維清單，供 v-for 以 r-c 為 key 渲染（比照 MINESWEEPER 慣例，見 tasks 6.2） */
const flatCells = computed<FlatCell[]>(() => {
  const out: FlatCell[] = []
  state.grid.forEach((row, r) => {
    row.forEach((on, c) => {
      out.push({ r, c, on })
    })
  })
  return out
})

/** 私有工具方法：snapshot 同步、計時器管理、格子外觀 */
const _handlers = {
  syncFromEngine: () => {
    const snap = engine.getSnapshot()
    state.grid = snap.grid
    state.size = snap.grid.length
    state.level = snap.level
    state.moves = snap.moves
    state.moveLimit = snap.moveLimit
    state.score = snap.score
    return snap
  },
  stopLevelClearTimer: () => {
    if (levelClearTimer) {
      clearTimeout(levelClearTimer)
      levelClearTimer = null
    }
  },
  /** 把鍵盤游標夾回目前棋盤範圍內（換關棋盤變大/變小時避免越界） */
  clampCursor: () => {
    state.cursorRow = Math.max(0, Math.min(state.size - 1, state.cursorRow))
    state.cursorCol = Math.max(0, Math.min(state.size - 1, state.cursorCol))
  },
  cellClass: (cell: FlatCell): string => {
    const cursor = cell.r === state.cursorRow && cell.c === state.cursorCol ? ' is-cursor' : ''
    return `${cell.on ? 'is-on' : 'is-off'}${cursor}`
  }
}

const _actions = {
  recordHistory: async () => {
    state.rewardMessage = ''
    try {
      const result = await gameHistory.actions.record('lightsOut', 'LIGHTS OUT', {
        score: state.score,
        level: state.reachedLevel,
        meta: {
          levelReached: state.reachedLevel,
          movesUsed: state.moves
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
    _handlers.stopLevelClearTimer()
    engine.reset()
    _handlers.syncFromEngine()
    state.cursorRow = 0
    state.cursorCol = 0
    state.reachedLevel = 1
    state.lastLevelGained = 0
    state.status = 'ready'
    state.waitingOverlayVisible = true
    state.levelClearOverlayVisible = false
    state.resultOverlayVisible = false
    state.rewardMessage = ''
    state.message = '按「開始」後點擊格子，把全部燈熄滅即可過關。'
  },
  startGame: () => {
    if (state.status === 'playing') return
    if (state.status === 'gameover') _actions.resetGame()
    engine.reset()
    _handlers.syncFromEngine()
    state.cursorRow = 0
    state.cursorCol = 0
    state.reachedLevel = 1
    state.waitingOverlayVisible = false
    state.levelClearOverlayVisible = false
    state.resultOverlayVisible = false
    state.status = 'playing'
    state.message = '點擊格子切換自己與上下左右，把全部燈熄滅。'
  },
  finishGame: () => {
    _handlers.stopLevelClearTimer()
    state.reachedLevel = state.level
    state.status = 'gameover'
    state.levelClearOverlayVisible = false
    state.resultOverlayVisible = true
    state.message = `步數用完仍未全部熄燈，止步於第 ${state.reachedLevel} 關。`
    _actions.recordHistory()
  },
  /** 過關：短暫顯示 LEVEL CLEAR，延遲後進入下一關（棋盤重建、moves 歸零，見 spec Next Level 規格） */
  handleLevelClear: () => {
    state.status = 'levelClear'
    state.levelClearOverlayVisible = true
    state.message = `第 ${state.level} 關完成！+${state.lastLevelGained} 分`
    _handlers.stopLevelClearTimer()
    levelClearTimer = setTimeout(() => {
      levelClearTimer = null
      engine.nextLevel()
      _handlers.syncFromEngine()
      _handlers.clampCursor()
      state.levelClearOverlayVisible = false
      state.status = 'playing'
      state.message = `進入第 ${state.level} 關（${state.size}×${state.size}／上限 ${state.moveLimit} 步）。`
    }, LEVEL_CLEAR_MS)
  },
  /** 三種輸入來源（滑鼠點擊／觸控 tap／鍵盤 Space·Enter）共用的切換入口 */
  doToggle: (row: number, col: number) => {
    if (state.status !== 'playing') return
    const before = state.score
    const result = engine.toggle(row, col)
    if (!result.moved) return
    _handlers.syncFromEngine()
    state.cursorRow = row
    state.cursorCol = col
    if (result.won) {
      state.lastLevelGained = state.score - before
      _actions.handleLevelClear()
      return
    }
    if (result.gameOver) {
      _actions.finishGame()
      return
    }
    state.message = `已用 ${state.moves} / ${state.moveLimit} 步，剩 ${litCount.value} 盞燈。`
  },
  pauseGame: () => {
    if (state.status !== 'playing') return
    state.status = 'pause'
    state.message = '已暫停'
  },
  resumeGame: () => {
    if (!canResumeFromPause.value) return
    state.status = 'playing'
    state.message = '遊戲進行中...'
  },
  playAgain: () => {
    _actions.resetGame()
    _actions.startGame()
  },
  endGameNow: () => {
    if (state.status === 'ready' || state.status === 'gameover') return
    _handlers.stopLevelClearTimer()
    state.reachedLevel = state.level
    state.status = 'gameover'
    state.waitingOverlayVisible = false
    state.levelClearOverlayVisible = false
    state.resultOverlayVisible = true
    state.message = '本局已結束。'
    _actions.recordHistory()
  },
  /** 鍵盤游標移動（限制在棋盤範圍內，見 tasks 6.9） */
  moveCursor: (dr: number, dc: number) => {
    if (state.status !== 'playing') return
    state.cursorRow = Math.max(0, Math.min(state.size - 1, state.cursorRow + dr))
    state.cursorCol = Math.max(0, Math.min(state.size - 1, state.cursorCol + dc))
  },
  onKeydown: (event: KeyboardEvent) => {
    const key = event.key.toLowerCase()
    // ESC／P：暫停 ↔ 繼續（見 tasks 6.8）
    if (key === 'escape' || key === 'p') {
      if (state.status === 'playing') _actions.pauseGame()
      else if (state.status === 'pause') _actions.resumeGame()
      return
    }
    if (state.status !== 'playing') return
    // 方向鍵／WASD 移動游標；Space／Enter 觸發該格切換（與滑鼠點擊共用 doToggle，見 tasks 6.9）
    if (key === 'arrowup' || key === 'w') {
      _actions.moveCursor(-1, 0)
      event.preventDefault()
    } else if (key === 'arrowdown' || key === 's') {
      _actions.moveCursor(1, 0)
      event.preventDefault()
    } else if (key === 'arrowleft' || key === 'a') {
      _actions.moveCursor(0, -1)
      event.preventDefault()
    } else if (key === 'arrowright' || key === 'd') {
      _actions.moveCursor(0, 1)
      event.preventDefault()
    } else if (key === ' ' || key === 'enter') {
      _actions.doToggle(state.cursorRow, state.cursorCol)
      event.preventDefault()
    }
  }
}

const click = {
  cell: (r: number, c: number) => _actions.doToggle(r, c),
  start: () => _actions.startGame(),
  pause: () => _actions.pauseGame(),
  resume: () => _actions.resumeGame(),
  replay: () => _actions.resetGame(),
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
  gameHistory.ensureLoaded().catch(() => undefined)
  _actions.resetGame()
  state.waitingOverlayVisible = true
  window.addEventListener('keydown', _actions.onKeydown)
})

onBeforeUnmount(() => {
  _handlers.stopLevelClearTimer()
  window.removeEventListener('keydown', _actions.onKeydown)
})
</script>

<template>
  <main class="lo-page" :class="`state-${state.status}`">
    <div class="lo-overlay" />

    <div v-if="state.waitingOverlayVisible" class="game-mask waiting-mask">
      <div class="mask-title">WELCOME</div>
      <p class="waiting-subtitle">LIGHTS OUT</p>
      <p class="waiting-hint">點一格連動翻轉上下左右 · 限定步數內全部關燈過關</p>
      <button class="lo-btn waiting-btn waiting-start" type="button" @click="click.start">START</button>
      <button class="lo-btn link waiting-btn" type="button" @click="click.openRateDialog">CONVERT</button>
      <button class="lo-btn link waiting-btn" type="button" @click="click.openRuleDialog">RULE</button>
    </div>

    <div v-if="state.levelClearOverlayVisible" class="game-mask levelclear-mask">
      <div class="mask-title win">LEVEL CLEAR</div>
      <div class="result-list">
        <div class="result-item"><span>第 {{ state.level }} 關步數</span><b>{{ state.moves }} / {{ state.moveLimit }}</b></div>
        <div class="result-item"><span>本關得分</span><b>+{{ state.lastLevelGained }}</b></div>
        <div class="result-item"><span>累計分數</span><b>{{ state.score }}</b></div>
      </div>
      <p class="levelclear-next">準備進入第 {{ state.level + 1 }} 關...</p>
    </div>

    <div v-if="state.resultOverlayVisible" class="game-mask result-mask">
      <div class="mask-title">GAME OVER</div>
      <div class="result-list">
        <div class="result-item"><span>SCORE</span><b>{{ state.score }}</b></div>
        <div class="result-item"><span>止步關卡</span><b>第 {{ state.reachedLevel }} 關</b></div>
        <div class="result-item"><span>本關步數</span><b>{{ state.moves }} / {{ state.moveLimit }}</b></div>
      </div>
      <p v-if="state.rewardMessage" class="result-reward">{{ state.rewardMessage }}</p>
      <div class="result-actions">
        <button class="lo-btn" type="button" @click="click.again">AGAIN</button>
        <button class="lo-btn danger" type="button" @click="click.exit">EXIT</button>
      </div>
    </div>

    <GameRateDialog :visible="state.rateDialogOpen" game-key="lightsOut" game-name="LIGHTS OUT" :accent-color="ACCENT"
      @close="click.closeRateDialog" />
    <GameRuleDialog :visible="state.ruleDialogOpen" game-name="LIGHTS OUT" :accent-color="ACCENT" v-bind="LIGHTS_OUT_RULE"
      @close="click.closeRuleDialog" />

    <section class="lo-shell">
      <aside class="lo-side left">
        <button class="lo-btn" type="button" :disabled="!canResumeFromPause" @click="click.resume">START</button>
        <button class="lo-btn" type="button" :disabled="!canPauseWhilePlaying" @click="click.pause">PAUSE</button>
        <button class="lo-btn" type="button" @click="click.replay">REPLAY</button>
        <button class="lo-btn link" type="button" @click="click.end">END</button>
        <button class="lo-btn" type="button" @click="click.openRateDialog">CONVERT</button>
        <button class="lo-btn" type="button" @click="click.openRuleDialog">RULE</button>
      </aside>

      <section class="lo-center">
        <header class="lo-title-wrap">
          <h1 class="lo-title">LIGHTS OUT</h1>
          <p class="lo-status" :class="statusClass">{{ statusText }}</p>
        </header>

        <div class="lo-frame">
          <div class="lo-stage" :style="stageStyle">
            <div class="lo-board" :style="boardStyle">
              <button v-for="cell in flatCells" :key="`${cell.r}-${cell.c}`" type="button" class="lo-cell"
                :class="_handlers.cellClass(cell)" :disabled="state.status !== 'playing'"
                @click="click.cell(cell.r, cell.c)" />
            </div>
            <div v-if="state.status === 'pause'" class="lo-board-veil">PAUSED</div>
          </div>
          <div class="lo-panel">
            <span>LEVEL: {{ state.level }}</span>
            <span>MOVES: {{ state.moves }} / {{ state.moveLimit }}</span>
            <span>LIT: {{ litCount }}</span>
            <span>SCORE: {{ state.score }}</span>
          </div>
        </div>

        <p class="lo-message">{{ state.message }}</p>
      </section>

      <aside class="lo-side right">
        <div class="lo-help-panel">
          <p class="lo-help-title">HOW TO PLAY</p>
          <p class="lo-help-text">
            點擊（或觸控）任一格會切換自己與上下左右 4 個鄰格的亮暗，超出棋盤的方向忽略、對角格不受影響。
            在步數上限內把全部燈熄滅即過關進下一關；方向鍵移動游標、Space／Enter 切換，ESC／P 可暫停。
          </p>
        </div>
      </aside>
    </section>
  </main>
</template>

<style scoped lang="scss">
.lo-page {
  --accent: #adb5bd;
  position: relative;
  min-height: 100vh;
  display: grid;
  place-items: center;
  background: radial-gradient(circle at top, #12151a, #04060a 60%);
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
    background: radial-gradient(circle at 20% 20%, rgba(173, 181, 189, 0.16), transparent 45%),
      radial-gradient(circle at 80% 70%, rgba(222, 226, 230, 0.1), transparent 40%);
    filter: blur(40px);
    animation: ambient-drift 12s ease-in-out infinite alternate;
  }

  &::after {
    background: linear-gradient(115deg, rgba(173, 181, 189, 0.05), rgba(0, 0, 0, 0));
    animation: ambient-pulse 4.6s ease-in-out infinite;
  }

  .lo-overlay {
    position: absolute;
    inset: 0;
    background-image: linear-gradient(rgba(173, 181, 189, 0.05) 1px, transparent 1px),
      linear-gradient(90deg, rgba(173, 181, 189, 0.05) 1px, transparent 1px);
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
      text-shadow: 0 0 18px rgba(173, 181, 189, 0.5);

      &.win {
        color: #f1f3f5;
      }
    }

    &.waiting-mask {
      background: rgba(0, 0, 0, 0.88);

      .waiting-subtitle {
        margin: 0;
        color: #e9ecef;
        letter-spacing: 0.3rem;
        font-size: 1.05rem;
        font-weight: 800;
      }

      .waiting-hint {
        margin: 0;
        color: #adb5bd;
        font-size: 0.78rem;
        letter-spacing: 0.04em;
      }

      .waiting-btn {
        width: 200px;
      }
    }

    &.levelclear-mask {
      background: rgba(0, 0, 0, 0.72);

      .levelclear-next {
        margin: 4px 0 0;
        color: #e9ecef;
        font-size: 0.85rem;
        letter-spacing: 0.1rem;
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
      border: 1px solid rgba(173, 181, 189, 0.4);
      background: rgba(28, 32, 38, 0.65);
      color: #e9ecef;
      padding: 8px 10px;
      font-variant-numeric: tabular-nums;
    }

    .result-reward {
      margin: 8px 0 0;
      color: #dee2e6;
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

  .lo-shell {
    position: relative;
    z-index: 1;
    width: min(1100px, 100%);
    padding: 24px;
    display: grid;
    grid-template-columns: 180px 1fr 180px;
    gap: 20px;
    align-items: center;
  }

  .lo-side {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .lo-btn {
    position: relative;
    overflow: hidden;
    border: 1px solid rgba(173, 181, 189, 0.4);
    border-radius: 6px;
    padding: 10px 12px;
    background: rgba(28, 32, 38, 0.75);
    color: var(--accent);
    font-weight: 700;
    letter-spacing: 0.5px;
    cursor: pointer;
    transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;

    &::after {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(105deg, transparent 35%, rgba(233, 236, 239, 0.25) 50%, transparent 65%);
      transform: translateX(-150%);
      transition: transform 0.35s ease;
      pointer-events: none;
    }

    &:hover {
      border-color: var(--accent);
      box-shadow: 0 0 12px rgba(173, 181, 189, 0.35);
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

  .lo-center {
    text-align: center;

    .lo-title-wrap {
      margin-bottom: 8px;
    }

    .lo-title {
      margin: 0;
      color: var(--accent);
      font-size: clamp(1.7rem, 5vw, 3rem);
      letter-spacing: 0.14rem;
      font-weight: 900;
      text-shadow: 0 0 14px rgba(173, 181, 189, 0.45);
      animation: title-float 2.6s ease-in-out infinite;
    }

    .lo-status {
      margin: 2px 0 0;
      color: #e9ecef;
      font-size: 0.9rem;
      letter-spacing: 0.2rem;

      &.is-playing {
        color: var(--accent);
      }

      &.is-clear {
        color: #f1f3f5;
      }

      &.is-pause {
        color: #ffcc33;
      }

      &.is-gameover {
        color: #ff5e5e;
      }
    }

    .lo-frame {
      width: fit-content;
      margin: 12px auto 0;
      padding: 14px;
      background: #12151a;
      border: 10px solid #343a40;
      border-radius: 18px;
      box-shadow: 0 0 0 1px rgba(173, 181, 189, 0.2), 0 0 24px rgba(173, 181, 189, 0.14);
      animation: frame-glow 5.4s ease-in-out infinite;
    }

    .lo-stage {
      position: relative;
      box-sizing: content-box;
      width: fit-content;
      padding: 10px;
      background: #0a0d11;
      border: 2px solid #1c2026;
      border-radius: 10px;
    }

    .lo-board {
      display: grid;
      gap: 6px;
      width: fit-content;
      touch-action: manipulation;
      user-select: none;
      -webkit-user-select: none;
    }

    .lo-cell {
      width: var(--cell);
      height: var(--cell);
      padding: 0;
      border-radius: 8px;
      cursor: pointer;
      transition: background 0.14s ease, box-shadow 0.14s ease, border-color 0.14s ease, transform 0.1s ease;

      /* OFF：暗格（目標狀態） */
      &.is-off {
        background: linear-gradient(145deg, #1c2026, #12151a);
        border: 1px solid #2b3138;

        &:hover:not(:disabled) {
          border-color: #495057;
          background: linear-gradient(145deg, #242a31, #171a1f);
        }
      }

      /* ON：亮格（需要被熄滅） */
      &.is-on {
        background: linear-gradient(145deg, #f8f9fa, #ced4da);
        border: 1px solid #f1f3f5;
        box-shadow: 0 0 12px rgba(222, 226, 230, 0.7), inset 0 0 6px rgba(255, 255, 255, 0.7);

        &:hover:not(:disabled) {
          box-shadow: 0 0 18px rgba(233, 236, 239, 0.9), inset 0 0 6px rgba(255, 255, 255, 0.8);
        }
      }

      /* 鍵盤游標高亮外框 */
      &.is-cursor {
        outline: 2px solid var(--accent);
        outline-offset: 2px;
      }

      &:active:not(:disabled) {
        transform: scale(0.94);
      }

      &:disabled {
        cursor: default;
      }
    }

    .lo-board-veil {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      background: rgba(4, 6, 10, 0.72);
      color: #e9ecef;
      font-weight: 900;
      letter-spacing: 0.3rem;
      border-radius: 10px;
      z-index: 2;
    }

    .lo-panel {
      margin-top: 12px;
      display: flex;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 8px 16px;
      color: var(--accent);
      font-weight: 800;
      text-shadow: 0 0 6px rgba(173, 181, 189, 0.45);
      font-variant-numeric: tabular-nums;
    }

    .lo-message {
      margin-top: 14px;
      color: #e9ecef;
      font-size: 0.85rem;
      animation: subtle-fade 2.8s ease-in-out infinite;
    }
  }

  .lo-help-panel {
    border: 1px solid rgba(173, 181, 189, 0.3);
    border-radius: 8px;
    padding: 12px;
    background: rgba(28, 32, 38, 0.5);

    .lo-help-title {
      margin: 0 0 6px;
      color: var(--accent);
      font-size: 0.75rem;
      letter-spacing: 0.14rem;
      font-weight: 800;
    }

    .lo-help-text {
      margin: 0;
      color: #e9ecef;
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
    box-shadow: 0 0 0 1px rgba(173, 181, 189, 0.2), 0 0 24px rgba(173, 181, 189, 0.14);
  }

  50% {
    box-shadow: 0 0 0 1px rgba(222, 226, 230, 0.35), 0 0 40px rgba(173, 181, 189, 0.28);
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
  .lo-page {
    .lo-shell {
      grid-template-columns: 1fr;
      padding: 16px;
    }

    .lo-side {
      flex-direction: row;
      flex-wrap: wrap;
      justify-content: center;
    }
  }
}
</style>
