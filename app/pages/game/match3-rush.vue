<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useGameHistory } from '~/composables/useGameHistory'
import Match3RushCoreEngine, {
  calcMatch3RushLevel,
  calcMatch3RushTypeCount,
  type Match3RushPosition,
  type Match3RushSwapResult
} from '~/utils/match3RushEngine'

type Match3Status = 'ready' | 'playing' | 'pause' | 'gameover'

type Match3Task = {
  color: number
  target: number
  progress: number
  scoreBonus: number
  timeBonus: number
}

/**
 * 限時制的薄包裝：消除演算法交給 RUSH 專屬的 Match3RushCoreEngine（不跟 CLASSIC 共用，
 * 見 match3RushEngine.ts 檔頭說明），這裡處理「倒數計時」結束條件、「難度隨分數自動升級」
 * （比照 snake/racing/tetriminos 既有的 Lv 慣例），以及任務達成後的分數／秒數獎勵發放。
 */
class Match3RushEngine {
  private core: Match3RushCoreEngine
  private timeLeft: number
  private level = 1

  constructor(
    private readonly boardSize: number,
    private readonly typeCount: number,
    private readonly totalSeconds: number
  ) {
    this.core = new Match3RushCoreEngine(boardSize, typeCount)
    this.timeLeft = totalSeconds
  }

  reset() {
    this.core.reset()
    this.timeLeft = this.totalSeconds
    this.level = 1
  }

  trySwap(a: Match3RushPosition, b: Match3RushPosition): Match3RushSwapResult {
    const result = this.core.trySwap(a, b)
    this.updateLevel()
    return result
  }

  tick(): { gameOver: boolean } {
    this.timeLeft = Math.max(0, this.timeLeft - 1)
    return { gameOver: this.timeLeft <= 0 }
  }

  /** 任務達成獎勵：秒數刻意不設上限直接疊加（見 match3-rush-task-mode-plan.md 決策 1），
   *  場次長度改靠任務難度幾何遞增自然收斂，不靠這裡封頂。 */
  awardTaskBonus(scoreAmount: number, timeSeconds: number) {
    this.core.addScore(scoreAmount)
    this.timeLeft += timeSeconds
    this.updateLevel()
  }

  getSnapshot() {
    const snap = this.core.getSnapshot()
    return { grid: snap.grid, score: snap.score, level: this.level, timeLeft: this.timeLeft }
  }

  private updateLevel() {
    const nextLevel = calcMatch3RushLevel(this.core.getSnapshot().score)
    if (nextLevel !== this.level) {
      this.level = nextLevel
      this.core.setTypeCount(calcMatch3RushTypeCount(nextLevel))
    }
  }
}

const BOARD_SIZE = 8
const TYPE_COUNT = 6
const TOTAL_SECONDS = 60
const READY_START = 3
const GEM_EMOJI = ['🍇', '🍉', '🍋', '🍓', '🍑', '🥝', '🍒', '🍍']

/**
 * 任務難度／獎勵（見 openspec/reference/match3-rush-task-mode-plan.md 第 2.3／2.4 節）：
 * 完成數 < 15 次沿用 Lv 對照表線性遞增；達 15 次後改用幾何公式，目標數量倍數成長，
 * 但秒數獎勵鎖在 Lv5 的 +25 秒封頂不再往上加——難度與秒數回饋刻意脫鉤，
 * 是讓場次長度自然收斂的核心機制（timeLeft 本身不設上限，見決策 1）。
 */
const TASK_TARGET_BY_LEVEL = [3, 4, 5, 6, 7]
const TASK_TIME_BONUS_BY_LEVEL = [10, 14, 18, 22, 25]
const TASK_TIME_BONUS_CAP = 25
const TASK_GEOMETRIC_THRESHOLD = 15
const TASK_GEOMETRIC_BASE_TARGET = 7
const TASK_GEOMETRIC_GROWTH_RATE = 1.2

const router = useRouter()
const engine = new Match3RushEngine(BOARD_SIZE, TYPE_COUNT, TOTAL_SECONDS)

const state = reactive({
  grid: [] as number[][],
  score: 0,
  level: 1,
  timeLeft: TOTAL_SECONDS,
  status: 'ready' as Match3Status,
  selected: null as Match3RushPosition | null,
  shakeCells: [] as string[],
  message: '點「開始」遊玩，點擊相鄰寶石交換消除。',
  rewardMessage: '',
  comboText: '',
  completedTaskCount: 0,
  task: null as Match3Task | null,
  taskToastText: '',
  waitingOverlayVisible: true,
  readyOverlayVisible: false,
  readyCountdownValue: READY_START,
  resultOverlayVisible: false,
  rateDialogOpen: false,
  ruleDialogOpen: false
})

const MATCH3_RUSH_RULE = {
  description:
    '點擊兩個相鄰寶石交換，形成 3 消以上即可消除並觸發連鎖加分；60 秒倒數計時，時間到強制結算。' +
    '過程中會隨機出現任務（例如「消除 3 個🍓」），達成後獲得額外分數與秒數（每次最多 +25 秒），' +
    '任務難度會隨等級與累積完成次數提高。',
  scoreRule: '每輪消除分數 ＝ 消除格數 × 4 × 連鎖倍率（第 n 輪連鎖倍率為 1 ＋ (n－1) × 0.5）。',
  levels: [
    { level: 1, condition: '0–79 分' },
    { level: 2, condition: '80–199 分' },
    { level: 3, condition: '200–399 分' },
    { level: 4, condition: '400–799 分' },
    { level: 5, condition: '800 分以上' }
  ],
  note: '等級越高，寶石種類越多（6→7→8 種），越難湊出消除組合；任務也會跟著變難。'
}

let countdownTimer: ReturnType<typeof setInterval> | null = null
let readyTimer: ReturnType<typeof setInterval> | null = null
let comboTimer: ReturnType<typeof setTimeout> | null = null
let shakeTimer: ReturnType<typeof setTimeout> | null = null
let taskToastTimer: ReturnType<typeof setTimeout> | null = null

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

const cells = computed(() => {
  const list: Array<{ row: number; col: number; type: number }> = []
  state.grid.forEach((row, r) => {
    row.forEach((type, c) => {
      list.push({ row: r, col: c, type })
    })
  })
  return list
})

const gameHistory = useGameHistory()

/** 私有工具方法：計時器管理、格子鍵值、選取/震動狀態判斷、任務產生與進度判定 */
const _handlers = {
  cellKey: (row: number, col: number) => `${row},${col}`,
  isSelected: (row: number, col: number) => state.selected?.row === row && state.selected?.col === col,
  isShaking: (row: number, col: number) => state.shakeCells.includes(_handlers.cellKey(row, col)),
  syncState: () => {
    const snap = engine.getSnapshot()
    state.grid = snap.grid
    state.score = snap.score
    state.level = snap.level
    state.timeLeft = snap.timeLeft
  },
  stopCountdownTimer: () => {
    if (countdownTimer) {
      clearInterval(countdownTimer)
      countdownTimer = null
    }
  },
  stopReadyTimer: () => {
    if (readyTimer) {
      clearInterval(readyTimer)
      readyTimer = null
    }
  },
  stopComboTimer: () => {
    if (comboTimer) {
      clearTimeout(comboTimer)
      comboTimer = null
    }
  },
  stopShakeTimer: () => {
    if (shakeTimer) {
      clearTimeout(shakeTimer)
      shakeTimer = null
    }
  },
  stopTaskToastTimer: () => {
    if (taskToastTimer) {
      clearTimeout(taskToastTimer)
      taskToastTimer = null
    }
  },
  triggerShake: (a: Match3RushPosition, b: Match3RushPosition) => {
    _handlers.stopShakeTimer()
    state.shakeCells = [_handlers.cellKey(a.row, a.col), _handlers.cellKey(b.row, b.col)]
    shakeTimer = setTimeout(() => {
      state.shakeCells = []
      shakeTimer = null
    }, 220)
  },
  showCombo: (result: Match3RushSwapResult) => {
    _handlers.stopComboTimer()
    state.comboText = result.cascadeRounds > 1 ? `COMBO x${result.cascadeRounds}! +${result.gained}` : `+${result.gained}`
    comboTimer = setTimeout(() => {
      state.comboText = ''
      comboTimer = null
    }, 900)
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
  /** 目標數量與獎勵在「產生任務當下」就固定，達成時直接讀，不重新依當時等級/次數計算 */
  generateTask: () => {
    const isGeometric = state.completedTaskCount >= TASK_GEOMETRIC_THRESHOLD
    const target = isGeometric
      ? Math.round(
          TASK_GEOMETRIC_BASE_TARGET * TASK_GEOMETRIC_GROWTH_RATE ** (state.completedTaskCount - TASK_GEOMETRIC_THRESHOLD + 1)
        )
      : TASK_TARGET_BY_LEVEL[Math.min(state.level, TASK_TARGET_BY_LEVEL.length) - 1]!
    const timeBonus = isGeometric
      ? TASK_TIME_BONUS_CAP
      : TASK_TIME_BONUS_BY_LEVEL[Math.min(state.level, TASK_TIME_BONUS_BY_LEVEL.length) - 1]!
    const scoreBonus = Math.round(2.5 * target * (target - 1) + 5)
    const color = Math.floor(Math.random() * calcMatch3RushTypeCount(state.level))
    state.task = { color, target, progress: 0, scoreBonus, timeBonus }
  },
  showTaskToast: (task: Match3Task) => {
    _handlers.stopTaskToastTimer()
    state.taskToastText = `任務達成！${GEM_EMOJI[task.color]} +${task.scoreBonus}分 +${task.timeBonus}秒`
    taskToastTimer = setTimeout(() => {
      state.taskToastText = ''
      taskToastTimer = null
    }, 1200)
  },
  /** 消除任一顏色都檢查一次是否推進當前任務，達標就發獎勵、累加完成次數、立即產生下一個任務（連續銜接） */
  applyTaskProgress: (result: Match3RushSwapResult) => {
    if (!state.task) return
    const clearedOfTaskColor = result.clearedByColor[state.task.color] ?? 0
    if (clearedOfTaskColor <= 0) return
    state.task.progress = Math.min(state.task.progress + clearedOfTaskColor, state.task.target)
    if (state.task.progress < state.task.target) return

    const finishedTask = state.task
    engine.awardTaskBonus(finishedTask.scoreBonus, finishedTask.timeBonus)
    _handlers.syncState()
    state.completedTaskCount += 1
    _handlers.showTaskToast(finishedTask)
    _handlers.generateTask()
  }
}

const _actions = {
  /** 單局明確結束時寫入遊戲紀錄；已登入且有 coin 獎勵時附上提示文字 */
  recordHistory: async () => {
    state.rewardMessage = ''
    try {
      const result = await gameHistory.actions.record('match3rush', 'MATCH3 RUSH', {
        score: state.score,
        level: state.level
      })
      if (result.coinReward > 0) {
        state.rewardMessage = result.coinCapped ? `+${result.coinReward} coin（已達今日上限）` : `+${result.coinReward} coin`
      }
    } catch {
      // 紀錄寫入失敗不影響遊戲本身，靜默略過
    }
  },
  finishGame: (message: string) => {
    state.status = 'gameover'
    state.message = message
    state.resultOverlayVisible = true
    _handlers.stopCountdownTimer()
    _handlers.stopReadyTimer()
    _actions.recordHistory()
  },
  startCountdownLoop: () => {
    _handlers.stopCountdownTimer()
    countdownTimer = setInterval(() => {
      if (state.status !== 'playing') return
      const result = engine.tick()
      _handlers.syncState()
      if (result.gameOver) {
        _actions.finishGame('時間到，遊戲結束。')
      }
    }, 1000)
  },
  resetGame: () => {
    _handlers.stopCountdownTimer()
    _handlers.stopReadyTimer()
    _handlers.stopComboTimer()
    _handlers.stopShakeTimer()
    _handlers.stopTaskToastTimer()
    engine.reset()
    _handlers.syncState()
    state.status = 'ready'
    state.selected = null
    state.shakeCells = []
    state.waitingOverlayVisible = true
    state.resultOverlayVisible = false
    state.readyOverlayVisible = false
    state.rewardMessage = ''
    state.comboText = ''
    state.completedTaskCount = 0
    state.taskToastText = ''
    _handlers.generateTask()
    state.message = '點「開始」遊玩，點擊相鄰寶石交換消除。'
  },
  startGame: () => {
    if (state.status === 'playing' || state.readyOverlayVisible) return
    if (state.status === 'gameover') _actions.resetGame()
    state.waitingOverlayVisible = false
    state.resultOverlayVisible = false
    _handlers.runReadyCountdown(() => {
      state.status = 'playing'
      state.message = '遊戲進行中...'
      _actions.startCountdownLoop()
    })
  },
  pauseGame: () => {
    if (state.status !== 'playing') return
    state.status = 'pause'
    state.message = '已暫停'
    _handlers.stopCountdownTimer()
  },
  resumeGame: () => {
    if (!canResumeFromPause.value) return
    state.status = 'playing'
    state.message = '遊戲進行中...'
    _actions.startCountdownLoop()
  },
  playAgain: () => {
    _actions.resetGame()
    _actions.startGame()
  },
  endGameNow: () => {
    _handlers.stopCountdownTimer()
    _handlers.stopReadyTimer()
    state.waitingOverlayVisible = false
    state.readyOverlayVisible = false
    state.status = 'gameover'
    state.message = '本局已結束。'
    state.resultOverlayVisible = true
    _actions.recordHistory()
  },
  handleCellClick: (row: number, col: number) => {
    if (state.status !== 'playing') return
    const pos = { row, col }
    if (!state.selected) {
      state.selected = pos
      return
    }
    if (state.selected.row === row && state.selected.col === col) {
      state.selected = null
      return
    }
    const isAdjacent = Math.abs(state.selected.row - row) + Math.abs(state.selected.col - col) === 1
    if (!isAdjacent) {
      state.selected = pos
      return
    }
    const from = state.selected
    state.selected = null
    const result = engine.trySwap(from, pos)
    _handlers.syncState()
    if (result.matched) {
      _handlers.showCombo(result)
      _handlers.applyTaskProgress(result)
      if (result.reshuffled) {
        state.message = '沒有可消除的組合了，已自動重新排列。'
      }
    } else {
      _handlers.triggerShake(from, pos)
    }
  }
}

const click = {
  cell: (row: number, col: number) => _actions.handleCellClick(row, col),
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
  _actions.resetGame()
  state.waitingOverlayVisible = true
})

onBeforeUnmount(() => {
  _handlers.stopCountdownTimer()
  _handlers.stopReadyTimer()
  _handlers.stopComboTimer()
  _handlers.stopShakeTimer()
  _handlers.stopTaskToastTimer()
})
</script>

<template>
  <main class="m3-page" :class="`state-${state.status}`">
    <div class="m3-overlay" />
    <div v-if="state.waitingOverlayVisible" class="game-mask waiting-mask">
      <div class="mask-title">WELCOME</div>
      <p class="waiting-subtitle">MATCH3 RUSH · 60s</p>
      <button class="m3-btn waiting-btn waiting-start" type="button" @click="click.start">START</button>
      <button class="m3-btn link waiting-btn" type="button" @click="click.openRateDialog">CONVERT</button>
      <button class="m3-btn link waiting-btn" type="button" @click="click.openRuleDialog">RULE</button>
    </div>
    <div v-if="state.readyOverlayVisible" class="game-mask ready-mask">
      <div class="mask-title">READY</div>
      <div class="mask-count">{{ state.readyCountdownValue }}</div>
    </div>
    <div v-if="state.resultOverlayVisible" class="game-mask result-mask">
      <div class="mask-title">RESULT</div>
      <div class="result-list">
        <div class="result-item"><span>SCORE</span><b>{{ state.score }}</b></div>
        <div class="result-item"><span>LEVEL</span><b>{{ state.level }}</b></div>
        <div class="result-item"><span>TASKS</span><b>{{ state.completedTaskCount }}</b></div>
      </div>
      <p v-if="state.rewardMessage" class="result-reward">{{ state.rewardMessage }}</p>
      <div class="result-actions">
        <button class="m3-btn" type="button" @click="click.again">AGAIN</button>
        <button class="m3-btn danger" type="button" @click="click.exit">EXIT</button>
      </div>
    </div>

    <GameRateDialog :visible="state.rateDialogOpen" game-key="match3rush" game-name="MATCH3 RUSH"
      accent-color="#ff8a2b" @close="click.closeRateDialog" />
    <GameRuleDialog :visible="state.ruleDialogOpen" game-name="MATCH3 RUSH" accent-color="#ff8a2b"
      v-bind="MATCH3_RUSH_RULE" @close="click.closeRuleDialog" />

    <section class="m3-shell">
      <aside class="m3-side left">
        <button class="m3-btn" type="button" :disabled="!canResumeFromPause" @click="click.resume">START</button>
        <button class="m3-btn" type="button" :disabled="!canPauseWhilePlaying" @click="click.pause">PAUSE</button>
        <button class="m3-btn" type="button" @click="click.replay">REPLAY</button>
        <button class="m3-btn link" type="button" @click="click.end">END</button>
        <button class="m3-btn" type="button" @click="click.openRateDialog">CONVERT</button>
        <button class="m3-btn" type="button" @click="click.openRuleDialog">RULE</button>
      </aside>

      <section class="m3-center">
        <header class="m3-title-wrap">
          <h1 class="m3-title">MATCH3 RUSH</h1>
          <p class="m3-status" :class="statusClass">{{ statusText }}</p>
        </header>

        <p v-if="state.taskToastText" class="m3-task-toast">{{ state.taskToastText }}</p>

        <div class="m3-frame">
          <div class="m3-board">
            <button v-for="cell in cells" :key="`${cell.row}-${cell.col}`" type="button" class="m3-cell" :class="{
              selected: _handlers.isSelected(cell.row, cell.col),
              shake: _handlers.isShaking(cell.row, cell.col)
            }" :disabled="state.status !== 'playing'" @click="click.cell(cell.row, cell.col)">
              {{ GEM_EMOJI[cell.type] }}
            </button>
            <p v-if="state.comboText" class="m3-combo-popup">{{ state.comboText }}</p>
          </div>
          <div class="m3-panel">
            <span>SCORE: {{ state.score }}</span>
            <span>LEVEL: {{ state.level }}</span>
            <span class="time" :class="{ warn: state.timeLeft <= 10 }">TIME: {{ state.timeLeft }}</span>
          </div>
          <div v-if="state.task" class="m3-task-panel">
            <span class="task-label">TASK</span>
            <span class="task-goal">消除 {{ GEM_EMOJI[state.task.color] }} × {{ state.task.progress }}/{{ state.task.target }}</span>
          </div>
        </div>

        <p class="m3-message">{{ state.message }}</p>
      </section>

      <aside class="m3-side right">
        <div class="m3-help-panel">
          <p class="m3-help-title">HOW TO PLAY</p>
          <p class="m3-help-text">點擊兩個相鄰寶石交換，形成 3 消以上即可消除並連鎖加分；達成隨機任務可換取額外分數與秒數。</p>
        </div>
      </aside>
    </section>
  </main>
</template>

<style scoped lang="scss">
.m3-page {
  position: relative;
  min-height: 100vh;
  display: grid;
  place-items: center;
  background: radial-gradient(circle at top, #2a0f08, #0a0301 60%);
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
    background: radial-gradient(circle at 20% 20%, rgba(255, 120, 24, 0.2), transparent 45%),
      radial-gradient(circle at 80% 70%, rgba(255, 60, 60, 0.14), transparent 40%);
    filter: blur(40px);
    animation: ambient-drift 12s ease-in-out infinite alternate;
  }

  &::after {
    background: linear-gradient(115deg, rgba(255, 150, 50, 0.05), rgba(0, 0, 0, 0));
    animation: ambient-pulse 4.6s ease-in-out infinite;
  }

  .m3-overlay {
    position: absolute;
    inset: 0;
    background-image: linear-gradient(rgba(255, 130, 30, 0.05) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255, 130, 30, 0.05) 1px, transparent 1px);
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
      color: #ff8a2b;
      font-size: clamp(2rem, 8vw, 4rem);
      letter-spacing: 0.25rem;
      font-weight: 900;
    }

    .mask-count {
      color: #ff8a2b;
      font-size: clamp(3rem, 12vw, 7rem);
      font-weight: 900;
      line-height: 1;
    }

    &.waiting-mask {
      background: rgba(0, 0, 0, 0.88);

      .waiting-subtitle {
        margin: 0;
        color: #ffb877;
        letter-spacing: 0.3rem;
        font-size: 0.95rem;
      }

      .waiting-btn {
        width: 160px;
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
        border: 1px solid rgba(255, 138, 43, 0.4);
        background: rgba(50, 15, 0, 0.65);
        color: #ffcb9a;
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

  .m3-shell {
    position: relative;
    z-index: 1;
    width: min(1100px, 100%);
    padding: 24px;
    display: grid;
    grid-template-columns: 180px 1fr 180px;
    gap: 20px;
    align-items: center;
  }

  .m3-side {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .m3-btn {
    position: relative;
    overflow: hidden;
    border: 1px solid rgba(255, 138, 43, 0.4);
    border-radius: 6px;
    padding: 10px 12px;
    background: rgba(30, 8, 0, 0.75);
    color: #ff9a44;
    font-weight: 700;
    letter-spacing: 0.5px;
    transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;

    &::after {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(105deg, transparent 35%, rgba(255, 220, 190, 0.25) 50%, transparent 65%);
      transform: translateX(-150%);
      transition: transform 0.35s ease;
      pointer-events: none;
    }

    &:hover {
      border-color: #ff8a2b;
      box-shadow: 0 0 12px rgba(255, 138, 43, 0.35);
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

  .m3-center {
    text-align: center;

    .m3-title-wrap {
      margin-bottom: 8px;
    }

    .m3-title {
      margin: 0;
      color: #ff8a2b;
      font-size: clamp(1.7rem, 5vw, 3rem);
      letter-spacing: 0.14rem;
      font-weight: 900;
      text-shadow: 0 0 14px rgba(255, 138, 43, 0.42);
      animation: title-float 2.6s ease-in-out infinite;
    }

    .m3-status {
      margin: 2px 0 0;
      color: #ffcb9a;
      font-size: 0.9rem;
      letter-spacing: 0.2rem;

      &.is-playing {
        color: #ff9a44;
      }

      &.is-pause {
        color: #ffcc33;
      }

      &.is-gameover {
        color: #ff5e5e;
      }
    }

    .m3-task-toast {
      margin: 6px 0 0;
      color: #7cfc9a;
      font-weight: 900;
      font-size: 0.9rem;
      text-shadow: 0 0 10px rgba(124, 252, 154, 0.6);
      animation: task-toast-pop 1.2s ease-out both;
    }

    .m3-frame {
      width: 360px;
      margin: 12px auto 0;
      padding: 14px;
      background: #2a1006;
      border: 10px solid #5c2a10;
      border-radius: 18px;
      box-shadow: 0 0 0 1px rgba(255, 138, 43, 0.2), 0 0 24px rgba(255, 100, 20, 0.14);
      animation: frame-glow 5.4s ease-in-out infinite;
    }

    .m3-board {
      position: relative;
      display: grid;
      grid-template-columns: repeat(8, 1fr);
      gap: 4px;
      background: #1a0a03;
      border: 2px solid #000;
      border-radius: 8px;
      padding: 6px;
    }

    .m3-cell {
      aspect-ratio: 1 / 1;
      display: grid;
      place-items: center;
      font-size: 1.2rem;
      line-height: 1;
      background: rgba(255, 138, 43, 0.06);
      border: 1px solid rgba(255, 138, 43, 0.18);
      border-radius: 6px;
      cursor: pointer;
      transition: transform 0.12s ease, border-color 0.12s ease, background 0.12s ease;

      &:hover:not(:disabled) {
        border-color: rgba(255, 138, 43, 0.55);
        background: rgba(255, 138, 43, 0.14);
      }

      &.selected {
        border-color: #ffd166;
        background: rgba(255, 209, 102, 0.22);
        box-shadow: 0 0 10px rgba(255, 209, 102, 0.5);
        transform: scale(1.06);
      }

      &.shake {
        animation: cell-shake 220ms ease-out;
      }

      &:disabled {
        cursor: not-allowed;
      }
    }

    .m3-combo-popup {
      position: absolute;
      top: -6px;
      left: 50%;
      transform: translate(-50%, -100%);
      margin: 0;
      color: #ffe066;
      font-weight: 900;
      font-size: 0.95rem;
      text-shadow: 0 0 10px rgba(255, 224, 102, 0.7);
      animation: combo-pop 0.9s ease-out both;
      pointer-events: none;
      white-space: nowrap;
    }

    .m3-panel {
      margin-top: 10px;
      display: flex;
      justify-content: space-between;
      color: #ff9a44;
      font-weight: 800;
      text-shadow: 0 0 6px rgba(255, 138, 43, 0.45);

      .time.warn {
        color: #ff5e5e;
        animation: time-warn-pulse 0.8s ease-in-out infinite;
      }
    }

    .m3-task-panel {
      margin-top: 8px;
      display: flex;
      justify-content: center;
      gap: 6px;
      color: #ffd166;
      font-size: 0.78rem;
      font-weight: 700;
      letter-spacing: 0.03em;

      .task-label {
        opacity: 0.75;
      }
    }

    .m3-message {
      margin-top: 14px;
      color: #ffb877;
      font-size: 0.85rem;
      animation: subtle-fade 2.8s ease-in-out infinite;
    }
  }

  .m3-help-panel {
    border: 1px solid rgba(255, 138, 43, 0.3);
    border-radius: 8px;
    padding: 12px;
    background: rgba(30, 8, 0, 0.5);

    .m3-help-title {
      margin: 0 0 6px;
      color: #ff9a44;
      font-size: 0.75rem;
      letter-spacing: 0.14rem;
      font-weight: 800;
    }

    .m3-help-text {
      margin: 0;
      color: #ffcb9a;
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
    box-shadow: 0 0 0 1px rgba(255, 138, 43, 0.2), 0 0 24px rgba(255, 100, 20, 0.14);
  }

  50% {
    box-shadow: 0 0 0 1px rgba(255, 180, 100, 0.35), 0 0 40px rgba(255, 130, 40, 0.28);
  }
}

@keyframes cell-shake {
  0% {
    transform: translate3d(0, 0, 0);
  }

  25% {
    transform: translate3d(-3px, 1px, 0);
  }

  50% {
    transform: translate3d(3px, -1px, 0);
  }

  75% {
    transform: translate3d(-2px, 1px, 0);
  }

  100% {
    transform: translate3d(0, 0, 0);
  }
}

@keyframes combo-pop {
  0% {
    opacity: 0;
    transform: translate(-50%, -80%) scale(0.8);
  }

  20% {
    opacity: 1;
    transform: translate(-50%, -110%) scale(1.05);
  }

  100% {
    opacity: 0;
    transform: translate(-50%, -140%) scale(1);
  }
}

@keyframes task-toast-pop {
  0% {
    opacity: 0;
    transform: translateY(4px) scale(0.9);
  }

  15% {
    opacity: 1;
    transform: translateY(0) scale(1.05);
  }

  80% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }

  100% {
    opacity: 0;
    transform: translateY(-4px) scale(1);
  }
}

@keyframes time-warn-pulse {

  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0.4;
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
  .m3-page {
    .m3-shell {
      grid-template-columns: 1fr;
      padding: 16px;
    }

    .m3-side {
      flex-direction: row;
      flex-wrap: wrap;
      justify-content: center;
    }
  }
}
</style>
