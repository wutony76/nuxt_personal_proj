<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useGameHistory } from '~/composables/useGameHistory'
import OrbMatchCoreEngine, { type OrbMatchResolveResult, type OrbPosition } from '~/utils/orbMatchEngine'

type OrbMatchStatus = 'ready' | 'playing' | 'pause' | 'gameover'

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/**
 * 轉珠限時制的薄包裝：消除演算法交給 OrbMatchCoreEngine（見 orbMatchEngine.ts），這裡處理
 * 「整場倒數」「單次拖曳倒數」兩層計時，以及拖曳路徑折算成連續交換（見 add-orb-match-game
 * design.md Decision 6：拖曳中不檢查消除，只在放開手指或拖曳倒數歸零時統一結算一次）。
 */
class OrbMatchEngine {
  private core: OrbMatchCoreEngine
  sessionTimeLeft: number
  dragTimeLeft = 0
  dragging = false
  heldPos: OrbPosition | null = null
  private sessionAccumMs = 0

  constructor(
    rows: number,
    cols: number,
    typeCount: number,
    private readonly sessionSeconds: number,
    private readonly dragSeconds: number
  ) {
    this.core = new OrbMatchCoreEngine(rows, cols, typeCount)
    this.sessionTimeLeft = sessionSeconds
  }

  reset() {
    this.core.reset()
    this.sessionTimeLeft = this.sessionSeconds
    this.dragTimeLeft = 0
    this.dragging = false
    this.heldPos = null
    this.sessionAccumMs = 0
  }

  /** 玩家按住珠子：拿起該格，開始單次拖曳倒數 */
  startDrag(pos: OrbPosition): boolean {
    if (this.dragging) return false
    this.dragging = true
    this.heldPos = pos
    this.dragTimeLeft = this.dragSeconds
    return true
  }

  /** 拖曳路徑推進：從目前手上位置逐格走向目標格（模擬手指劃過中間格子），每步都是一次合法交換 */
  dragTo(target: OrbPosition) {
    if (!this.dragging || !this.heldPos) return
    while (this.heldPos && (this.heldPos.row !== target.row || this.heldPos.col !== target.col)) {
      const next: OrbPosition = { ...this.heldPos }
      if (this.heldPos.row !== target.row) next.row += target.row > this.heldPos.row ? 1 : -1
      else next.col += target.col > this.heldPos.col ? 1 : -1
      if (!this.core.moveHeldOrb(this.heldPos, next)) break
      this.heldPos = next
    }
  }

  /** 放開手指：停止拖曳，統一掃描結算一次（見 Decision 6） */
  endDrag(): OrbMatchResolveResult {
    this.dragging = false
    this.heldPos = null
    this.dragTimeLeft = 0
    return this.core.resolve()
  }

  /** 每 tick 呼叫：整場倒數累積滿 1 秒才 -1，拖曳倒數歸零時自動放開手指並結算 */
  tick(deltaMs: number): { sessionOver: boolean; dragResolved: OrbMatchResolveResult | null } {
    this.sessionAccumMs += deltaMs
    while (this.sessionAccumMs >= 1000) {
      this.sessionAccumMs -= 1000
      this.sessionTimeLeft = Math.max(0, this.sessionTimeLeft - 1)
    }

    let dragResolved: OrbMatchResolveResult | null = null
    if (this.dragging) {
      this.dragTimeLeft = Math.max(0, this.dragTimeLeft - deltaMs / 1000)
      if (this.dragTimeLeft <= 0) dragResolved = this.endDrag()
    }

    return { sessionOver: this.sessionTimeLeft <= 0, dragResolved }
  }

  getSnapshot() {
    const snap = this.core.getSnapshot()
    return {
      grid: snap.grid,
      score: snap.score,
      sessionTimeLeft: this.sessionTimeLeft,
      dragTimeLeft: this.dragTimeLeft,
      dragging: this.dragging,
      heldPos: this.heldPos
    }
  }
}

const BOARD_ROWS = 8
const BOARD_COLS = 8
const TYPE_COUNT = 6
const SESSION_SECONDS = 90
const DRAG_SECONDS = 5
const TICK_MS = 100
const READY_START = 3
const ORB_EMOJI = ['🔥', '💧', '🌿', '⚡', '🌑', '✨']

const router = useRouter()
const engine = new OrbMatchEngine(BOARD_ROWS, BOARD_COLS, TYPE_COUNT, SESSION_SECONDS, DRAG_SECONDS)
const gameHistory = useGameHistory()
const boardRef = ref<HTMLElement | null>(null)

const state = reactive({
  grid: [] as number[][],
  score: 0,
  sessionTimeLeft: SESSION_SECONDS,
  status: 'ready' as OrbMatchStatus,
  dragging: false,
  dragTimeLeft: 0,
  heldPos: null as OrbPosition | null,
  ghost: { visible: false, type: 0, x: 0, y: 0 },
  fallingCells: new Set<string>(),
  comboText: '',
  message: '按「開始」後按住珠子拖曳，可連續跨格滑動，放開手指即結算消除。',
  rewardMessage: '',
  waitingOverlayVisible: true,
  readyOverlayVisible: false,
  readyCountdownValue: READY_START,
  resultOverlayVisible: false,
  rateDialogOpen: false,
  ruleDialogOpen: false
})

const ORB_MATCH_RULE = {
  description:
    '按住任一顆珠子後可連續跨格拖曳滑動，沿路交換位置；單次拖曳最長 5 秒，放開手指或時間到會統一結算一次——' +
    '排出 3 個以上同色珠子連線即可消除並觸發連鎖加分。整場遊戲限時 90 秒，時間到強制結算。',
  scoreRule:
    '每輪消除分數 ＝ 消除格數 × 4 × 連鎖倍率（第 n 輪連鎖倍率為 1 ＋ (n－1) × 0.5）；' +
    '若同時排出橫線與直線並共用一格形成 L 形／T 形連線，該組額外再乘上 1.5 倍加成。',
  levels: [{ level: 1, condition: '8 欄 × 8 列棋盤，6 種屬性珠，難度固定不隨分數變化' }],
  note: '拖曳過程中即使暫時排出連線也不會馬上消除，放開手指才會結算——這是轉珠遊戲的招牌手感。'
}

const FALL_DURATION_MS = 420
/** 下落動畫最多回溯幾格高度——超過這個格數統一封頂，避免最下排格子飛出棋盤框太多顯得突兀 */
const FALL_MAX_ROWS = 3

let countdownTimer: ReturnType<typeof setInterval> | null = null
let readyTimer: ReturnType<typeof setInterval> | null = null
let comboTimer: ReturnType<typeof setTimeout> | null = null
let fallTimer: ReturnType<typeof setTimeout> | null = null

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

/** 私有工具方法：計時器管理、座標換算、held 格判斷、combo 提示 */
const _handlers = {
  isHeld: (row: number, col: number) => state.heldPos?.row === row && state.heldPos?.col === col,
  syncState: () => {
    const snap = engine.getSnapshot()
    state.grid = snap.grid
    state.score = snap.score
    state.sessionTimeLeft = snap.sessionTimeLeft
    state.dragTimeLeft = snap.dragTimeLeft
    state.dragging = snap.dragging
    state.heldPos = snap.heldPos
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
  stopFallTimer: () => {
    if (fallTimer) {
      clearTimeout(fallTimer)
      fallTimer = null
    }
  },
  isFalling: (row: number, col: number) => state.fallingCells.has(`${row},${col}`),
  /** 下落距離：以「從棋盤上方掉落到第 row 列」的概念估算（越下面的格子視覺上掉得越遠），並封頂避免太誇張 */
  dropRows: (row: number) => Math.min(row + 1, FALL_MAX_ROWS),
  /** 結算後比對消除前/後的盤面，值改變的格子（新補上或因清除而位移）一律觸發「從上方掉落」動畫 */
  triggerFall: (beforeGrid: number[][]) => {
    _handlers.stopFallTimer()
    const cells = new Set<string>()
    state.grid.forEach((row, r) => {
      row.forEach((value, c) => {
        if (beforeGrid[r]?.[c] !== value) cells.add(`${r},${c}`)
      })
    })
    state.fallingCells = cells
    fallTimer = setTimeout(() => {
      state.fallingCells = new Set()
      fallTimer = null
    }, FALL_DURATION_MS)
  },
  showCombo: (result: OrbMatchResolveResult) => {
    _handlers.stopComboTimer()
    const prefix = result.hadCorner ? 'L/T CONNECT! ' : ''
    state.comboText = prefix + (result.cascadeRounds > 1 ? `COMBO x${result.cascadeRounds}! +${result.gained}` : `+${result.gained}`)
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
  /** 放開手指（含拖曳倒數自動歸零）後的共用收尾：隱藏拖曳中的珠子疊層、顯示 combo、觸發下落動畫、重洗提示 */
  finishDrag: (result: OrbMatchResolveResult, beforeGrid: number[][]) => {
    state.ghost.visible = false
    if (result.matched) {
      _handlers.showCombo(result)
      _handlers.triggerFall(beforeGrid)
      if (result.reshuffled) state.message = '沒有可消除的組合了，已自動重新排列。'
    }
  },
  /** 依指標座標換算成棋盤 row/col 與相對於棋盤容器的像素座標（供拖曳疊層跟隨） */
  posFromEvent: (event: PointerEvent): { row: number; col: number; x: number; y: number } | null => {
    const el = boardRef.value
    if (!el) return null
    const rect = el.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return null
    const relX = clamp(event.clientX - rect.left, 0, rect.width - 0.01)
    const relY = clamp(event.clientY - rect.top, 0, rect.height - 0.01)
    const col = clamp(Math.floor((relX / rect.width) * BOARD_COLS), 0, BOARD_COLS - 1)
    const row = clamp(Math.floor((relY / rect.height) * BOARD_ROWS), 0, BOARD_ROWS - 1)
    return { row, col, x: relX, y: relY }
  }
}

const _actions = {
  /** 單局明確結束時寫入遊戲紀錄；已登入且有 coin 獎勵時附上提示文字 */
  recordHistory: async () => {
    state.rewardMessage = ''
    try {
      const result = await gameHistory.actions.record('orbMatch', 'ORB MATCH', { score: state.score })
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
      const beforeGrid = state.grid.map((row) => [...row])
      const result = engine.tick(TICK_MS)
      _handlers.syncState()
      if (result.dragResolved) _handlers.finishDrag(result.dragResolved, beforeGrid)
      if (result.sessionOver) _actions.finishGame('時間到，遊戲結束。')
    }, TICK_MS)
  },
  resetGame: () => {
    _handlers.stopCountdownTimer()
    _handlers.stopReadyTimer()
    _handlers.stopComboTimer()
    _handlers.stopFallTimer()
    engine.reset()
    _handlers.syncState()
    state.status = 'ready'
    state.ghost.visible = false
    state.fallingCells = new Set()
    state.waitingOverlayVisible = true
    state.resultOverlayVisible = false
    state.readyOverlayVisible = false
    state.rewardMessage = ''
    state.comboText = ''
    state.message = '按「開始」後按住珠子拖曳，可連續跨格滑動，放開手指即結算消除。'
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
    if (state.dragging) {
      const beforeGrid = state.grid.map((row) => [...row])
      const result = engine.endDrag()
      _handlers.syncState()
      _handlers.finishDrag(result, beforeGrid)
    }
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
  handlePointerDown: (event: PointerEvent) => {
    if (state.status !== 'playing' || state.dragging) return
    const pos = _handlers.posFromEvent(event)
    if (!pos) return
    if (!engine.startDrag({ row: pos.row, col: pos.col })) return
    // 拖曳過程中滑鼠劃過棋盤容易被瀏覽器誤判成「選取文字/元素」，蓋掉視覺上的珠子疊層，
    // 需要阻擋預設行為（CSS user-select 只能防文字選取，防不了少數瀏覽器的拖放手勢）
    event.preventDefault()
    boardRef.value?.setPointerCapture(event.pointerId)
    _handlers.syncState()
    state.ghost.visible = true
    state.ghost.type = state.grid[pos.row]![pos.col]!
    state.ghost.x = pos.x
    state.ghost.y = pos.y
  },
  handlePointerMove: (event: PointerEvent) => {
    if (!state.dragging) return
    const pos = _handlers.posFromEvent(event)
    if (!pos) return
    state.ghost.x = pos.x
    state.ghost.y = pos.y
    engine.dragTo({ row: pos.row, col: pos.col })
    _handlers.syncState()
  },
  handlePointerUp: () => {
    if (!state.dragging) return
    const beforeGrid = state.grid.map((row) => [...row])
    const result = engine.endDrag()
    _handlers.syncState()
    _handlers.finishDrag(result, beforeGrid)
  }
}

const click = {
  pointerDown: (event: PointerEvent) => _actions.handlePointerDown(event),
  pointerMove: (event: PointerEvent) => _actions.handlePointerMove(event),
  pointerUp: () => _actions.handlePointerUp(),
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
})
</script>

<template>
  <main class="om-page" :class="`state-${state.status}`">
    <div class="om-overlay" />
    <div v-if="state.waitingOverlayVisible" class="game-mask waiting-mask">
      <div class="mask-title">WELCOME</div>
      <p class="waiting-subtitle">ORB MATCH · 90s</p>
      <button class="om-btn waiting-btn waiting-start" type="button" @click="click.start">START</button>
      <button class="om-btn link waiting-btn" type="button" @click="click.openRateDialog">CONVERT</button>
      <button class="om-btn link waiting-btn" type="button" @click="click.openRuleDialog">RULE</button>
    </div>
    <div v-if="state.readyOverlayVisible" class="game-mask ready-mask">
      <div class="mask-title">READY</div>
      <div class="mask-count">{{ state.readyCountdownValue }}</div>
    </div>
    <div v-if="state.resultOverlayVisible" class="game-mask result-mask">
      <div class="mask-title">RESULT</div>
      <div class="result-list">
        <div class="result-item"><span>SCORE</span><b>{{ state.score }}</b></div>
      </div>
      <p v-if="state.rewardMessage" class="result-reward">{{ state.rewardMessage }}</p>
      <div class="result-actions">
        <button class="om-btn" type="button" @click="click.again">AGAIN</button>
        <button class="om-btn danger" type="button" @click="click.exit">EXIT</button>
      </div>
    </div>

    <GameRateDialog :visible="state.rateDialogOpen" game-key="orbMatch" game-name="ORB MATCH" accent-color="#9d4edd"
      @close="click.closeRateDialog" />
    <GameRuleDialog :visible="state.ruleDialogOpen" game-name="ORB MATCH" accent-color="#9d4edd"
      v-bind="ORB_MATCH_RULE" @close="click.closeRuleDialog" />

    <section class="om-shell">
      <aside class="om-side left">
        <button class="om-btn" type="button" :disabled="!canResumeFromPause" @click="click.resume">START</button>
        <button class="om-btn" type="button" :disabled="!canPauseWhilePlaying" @click="click.pause">PAUSE</button>
        <button class="om-btn" type="button" @click="click.replay">REPLAY</button>
        <button class="om-btn link" type="button" @click="click.end">END</button>
        <button class="om-btn" type="button" @click="click.openRateDialog">CONVERT</button>
        <button class="om-btn" type="button" @click="click.openRuleDialog">RULE</button>
      </aside>

      <section class="om-center">
        <header class="om-title-wrap">
          <h1 class="om-title">ORB MATCH</h1>
          <p class="om-status" :class="statusClass">{{ statusText }}</p>
        </header>

        <div class="om-frame">
          <div ref="boardRef" class="om-board" :class="{ 'no-input': state.status !== 'playing' }"
            @pointerdown="click.pointerDown" @pointermove="click.pointerMove" @pointerup="click.pointerUp"
            @pointercancel="click.pointerUp">
            <div v-for="cell in cells" :key="`${cell.row}-${cell.col}`" class="om-cell"
              :class="{ held: _handlers.isHeld(cell.row, cell.col), falling: _handlers.isFalling(cell.row, cell.col) }"
              :style="_handlers.isFalling(cell.row, cell.col) ? `--drop-rows: ${_handlers.dropRows(cell.row)}` : ''">
              <span v-if="!_handlers.isHeld(cell.row, cell.col)">{{ ORB_EMOJI[cell.type] }}</span>
            </div>
            <div v-if="state.ghost.visible" class="om-ghost" :style="`left:${state.ghost.x}px; top:${state.ghost.y}px;`">
              {{ ORB_EMOJI[state.ghost.type] }}
            </div>
            <p v-if="state.comboText" class="om-combo-popup">{{ state.comboText }}</p>
          </div>
          <div class="om-panel">
            <span>SCORE: {{ state.score }}</span>
            <span class="time" :class="{ warn: state.sessionTimeLeft <= 15 }">TIME: {{ state.sessionTimeLeft }}</span>
          </div>
          <div v-if="state.dragging" class="om-drag-panel">
            <span class="drag-label">DRAG</span>
            <span class="drag-value">{{ state.dragTimeLeft.toFixed(1) }}s</span>
          </div>
        </div>

        <p class="om-message">{{ state.message }}</p>
      </section>

      <aside class="om-side right">
        <div class="om-help-panel">
          <p class="om-help-title">HOW TO PLAY</p>
          <p class="om-help-text">按住珠子後可連續跨格拖曳，放開手指即結算消除；拖曳過程中即使暫時排出連線也不會馬上消除，這是轉珠遊戲的招牌手感。</p>
        </div>
      </aside>
    </section>
  </main>
</template>

<style scoped lang="scss">
.om-page {
  position: relative;
  min-height: 100vh;
  display: grid;
  place-items: center;
  background: radial-gradient(circle at top, #1c0a2e, #05010a 60%);
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
    background: radial-gradient(circle at 20% 20%, rgba(157, 78, 221, 0.22), transparent 45%),
      radial-gradient(circle at 80% 70%, rgba(90, 60, 220, 0.16), transparent 40%);
    filter: blur(40px);
    animation: ambient-drift 12s ease-in-out infinite alternate;
  }

  &::after {
    background: linear-gradient(115deg, rgba(157, 78, 221, 0.05), rgba(0, 0, 0, 0));
    animation: ambient-pulse 4.6s ease-in-out infinite;
  }

  .om-overlay {
    position: absolute;
    inset: 0;
    background-image: linear-gradient(rgba(157, 78, 221, 0.06) 1px, transparent 1px),
      linear-gradient(90deg, rgba(157, 78, 221, 0.06) 1px, transparent 1px);
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
      color: #9d4edd;
      font-size: clamp(2rem, 8vw, 4rem);
      letter-spacing: 0.25rem;
      font-weight: 900;
    }

    .mask-count {
      color: #9d4edd;
      font-size: clamp(3rem, 12vw, 7rem);
      font-weight: 900;
      line-height: 1;
    }

    &.waiting-mask {
      background: rgba(0, 0, 0, 0.88);

      .waiting-subtitle {
        margin: 0;
        color: #c792ff;
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
        border: 1px solid rgba(157, 78, 221, 0.4);
        background: rgba(30, 10, 50, 0.65);
        color: #d9b8ff;
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

  .om-shell {
    position: relative;
    z-index: 1;
    width: min(1100px, 100%);
    padding: 24px;
    display: grid;
    grid-template-columns: 180px 1fr 180px;
    gap: 20px;
    align-items: center;
  }

  .om-side {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .om-btn {
    position: relative;
    overflow: hidden;
    border: 1px solid rgba(157, 78, 221, 0.4);
    border-radius: 6px;
    padding: 10px 12px;
    background: rgba(20, 6, 35, 0.75);
    color: #c792ff;
    font-weight: 700;
    letter-spacing: 0.5px;
    transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;

    &::after {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(105deg, transparent 35%, rgba(230, 200, 255, 0.25) 50%, transparent 65%);
      transform: translateX(-150%);
      transition: transform 0.35s ease;
      pointer-events: none;
    }

    &:hover {
      border-color: #9d4edd;
      box-shadow: 0 0 12px rgba(157, 78, 221, 0.35);
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

  .om-center {
    text-align: center;

    .om-title-wrap {
      margin-bottom: 8px;
    }

    .om-title {
      margin: 0;
      color: #9d4edd;
      font-size: clamp(1.7rem, 5vw, 3rem);
      letter-spacing: 0.14rem;
      font-weight: 900;
      text-shadow: 0 0 14px rgba(157, 78, 221, 0.42);
      animation: title-float 2.6s ease-in-out infinite;
    }

    .om-status {
      margin: 2px 0 0;
      color: #d9b8ff;
      font-size: 0.9rem;
      letter-spacing: 0.2rem;

      &.is-playing {
        color: #c792ff;
      }

      &.is-pause {
        color: #ffcc33;
      }

      &.is-gameover {
        color: #ff5e5e;
      }
    }

    .om-frame {
      width: 330px;
      margin: 12px auto 0;
      padding: 14px;
      background: #180a28;
      border: 10px solid #3a1a5c;
      border-radius: 18px;
      box-shadow: 0 0 0 1px rgba(157, 78, 221, 0.2), 0 0 24px rgba(120, 60, 220, 0.14);
      animation: frame-glow 5.4s ease-in-out infinite;
    }

    .om-board {
      position: relative;
      display: grid;
      grid-template-columns: repeat(8, 1fr);
      grid-template-rows: repeat(8, 1fr);
      gap: 4px;
      aspect-ratio: 1 / 1;
      background: #100320;
      border: 2px solid #000;
      border-radius: 8px;
      padding: 6px;
      touch-action: none;
      cursor: grab;
      user-select: none;
      -webkit-user-select: none;

      &.no-input {
        pointer-events: none;
      }
    }

    .om-cell {
      display: grid;
      place-items: center;
      font-size: 1rem;
      line-height: 1;
      background: rgba(157, 78, 221, 0.06);
      border: 1px solid rgba(157, 78, 221, 0.18);
      border-radius: 6px;

      &.held {
        background: rgba(157, 78, 221, 0.02);
        border-style: dashed;
      }

      &.falling {
        animation: cell-fall-in 420ms cubic-bezier(0.34, 1.56, 0.64, 1) both;
      }
    }

    .om-ghost {
      position: absolute;
      width: calc(100% / 8);
      height: calc(100% / 8);
      display: grid;
      place-items: center;
      font-size: 1.15rem;
      transform: translate(-50%, -50%) scale(1.15);
      pointer-events: none;
      filter: drop-shadow(0 0 8px rgba(230, 200, 255, 0.8));
      z-index: 2;
    }

    .om-combo-popup {
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
      z-index: 3;
    }

    .om-panel {
      margin-top: 10px;
      display: flex;
      justify-content: space-between;
      color: #c792ff;
      font-weight: 800;
      text-shadow: 0 0 6px rgba(157, 78, 221, 0.45);

      .time.warn {
        color: #ff5e5e;
        animation: time-warn-pulse 0.8s ease-in-out infinite;
      }
    }

    .om-drag-panel {
      margin-top: 8px;
      display: flex;
      justify-content: center;
      gap: 6px;
      color: #ffe066;
      font-size: 0.85rem;
      font-weight: 800;
      letter-spacing: 0.03em;

      .drag-label {
        opacity: 0.75;
      }
    }

    .om-message {
      margin-top: 14px;
      color: #c792ff;
      font-size: 0.85rem;
      animation: subtle-fade 2.8s ease-in-out infinite;
    }
  }

  .om-help-panel {
    border: 1px solid rgba(157, 78, 221, 0.3);
    border-radius: 8px;
    padding: 12px;
    background: rgba(20, 6, 35, 0.5);

    .om-help-title {
      margin: 0 0 6px;
      color: #c792ff;
      font-size: 0.75rem;
      letter-spacing: 0.14rem;
      font-weight: 800;
    }

    .om-help-text {
      margin: 0;
      color: #d9b8ff;
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
    box-shadow: 0 0 0 1px rgba(157, 78, 221, 0.2), 0 0 24px rgba(120, 60, 220, 0.14);
  }

  50% {
    box-shadow: 0 0 0 1px rgba(200, 150, 255, 0.35), 0 0 40px rgba(150, 90, 230, 0.28);
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

@keyframes cell-fall-in {
  0% {
    transform: translateY(calc(var(--drop-rows, 1) * -100%));
    opacity: 0.5;
  }

  60% {
    opacity: 1;
  }

  100% {
    transform: translateY(0);
    opacity: 1;
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
  .om-page {
    .om-shell {
      grid-template-columns: 1fr;
      padding: 16px;
    }

    .om-side {
      flex-direction: row;
      flex-wrap: wrap;
      justify-content: center;
    }
  }
}
</style>
