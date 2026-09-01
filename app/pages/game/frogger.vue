<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useGameHistory } from '~/composables/useGameHistory'
import FroggerEngine, {
  GRID_COLS,
  GRID_ROWS,
  GOAL_SLOT_COLS,
  TICK_MS,
  rowType,
  type LaneSnapshot,
  type LaneType,
  type MoveDirection,
  type FroggerEvent
} from '~/utils/froggerEngine'

type FroggerStatus = 'ready' | 'playing' | 'pause' | 'gameover'
type ToastKind = 'good' | 'danger'
type EntityRender = {
  key: string
  left: number
  top: number
  width: number
  row: number
  type: 'ROAD' | 'RIVER'
}

const CELL = 40
const ACCENT = '#52b788'

/** 每條 ROAD 車道的車輛主色（依 row 對照，讓 5 條車道視覺可區分；RIVER 一律用浮木棕色） */
const CAR_COLORS: Record<number, string> = {
  11: '#ffd166',
  10: '#ff7b7b',
  9: '#8ec9ff',
  8: '#c79bff',
  7: '#ff9f5a'
}

/** 13 列地形（靜態，只依 row 決定型別），供背景色帶一次性渲染 */
const TERRAIN_ROWS: Array<{ row: number; type: LaneType }> = Array.from({ length: GRID_ROWS }, (_, row) => ({
  row,
  type: rowType(row)
}))

const router = useRouter()
const engine = new FroggerEngine()
const gameHistory = useGameHistory()

const state = reactive({
  status: 'ready' as FroggerStatus,
  /** engine snapshot 的鏡像；頁面只讀，不直接改動 engine 內部欄位 */
  player: { row: GRID_ROWS - 1, col: Math.floor(GRID_COLS / 2), raftCol: Math.floor(GRID_COLS / 2) },
  /** 玩家這次同步是否為「大跳躍」（重生/被沖出後歸位）→ 關閉補間動畫直接瞬移 */
  playerNoAnim: false,
  lanes: [] as LaneSnapshot[],
  goalSlots: GOAL_SLOT_COLS.map(() => false),
  lives: 3,
  score: 0,
  level: 1,
  roundsCleared: 0,
  goalsFilled: 0,
  message: '按 START 開始，用方向鍵／WASD 或下方按鈕讓青蛙一次跳一格。',
  rewardMessage: '',
  toast: '',
  toastVisible: false,
  toastKind: 'good' as ToastKind,
  waitingOverlayVisible: true,
  resultOverlayVisible: false,
  rateDialogOpen: false,
  ruleDialogOpen: false
})

const FROGGER_RULE = {
  description:
    '用方向鍵／WASD 或下方四方向按鈕，讓青蛙一次跳一格：沒有按鍵時青蛙完全靜止不會自己移動。' +
    '先由下往上穿越 5 條車道（撞到車輛即失去 1 命），越過中間安全島後再橫渡 5 條河道——河面上沒有立足點，' +
    '必須跳上漂浮的浮木並隨它漂流，掉進水裡或被浮木沖出畫面外都會失去 1 命。最上方終點列只有 5 個蓮花座是安全落點。',
  scoreRule:
    '每往終點方向推進一格 +10（HOP）；成功跳進一個尚未佔用的蓮花座 +200（GOAL）；' +
    '把 5 個蓮花座全部填滿完成一輪再額外 +500（LEVEL CLEAR）。分數跨命累計，撞車／落水不會扣分只扣命。',
  levels: [
    { level: '車道', condition: '5 條 ROAD 車輛連續橫向行駛、方向與速度各異，撞到任一車輛失去 1 命' },
    { level: '安全島', condition: '車道與河道之間的中線恆為安全區，可停留喘息' },
    { level: '河道', condition: '5 條 RIVER 只有浮木可站，站上去會隨浮木漂移，落水或被沖出邊界失去 1 命' },
    { level: '終點', condition: '終點列僅 5 個蓮花座安全，跳到非蓮花座或已佔用的蓮花座視為落水' },
    { level: '難度', condition: '每填滿 5 個蓮花座完成一輪，Level +1，車道／河道整體加速、間距縮小' }
  ],
  levelsTitle: '玩法規則',
  note: '共 3 條命，命數歸零即結束。暫停或離開頁面不會結算，唯有命數歸零才記錄分數。'
}

let tickTimer: ReturnType<typeof setInterval> | null = null
let toastTimer: ReturnType<typeof setTimeout> | null = null
/** 上一次同步時的玩家渲染座標（px），用來偵測大跳躍以切換 no-anim（非響應式，純比對用） */
let prevPlayerLeft = 0
let prevPlayerTop = 0

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
const canPauseWhilePlaying = computed(() => state.status === 'playing')
const canResumeFromPause = computed(
  () => state.status === 'pause' && !state.waitingOverlayVisible && !state.resultOverlayVisible
)
/** HIGH SCORE 直接重用 useGameHistory 的 statsByGame，並與本局分數取大值即時反映 */
const bestScore = computed(() => Math.max(gameHistory.statsByGame.value['frogger']?.best ?? 0, state.score))
const stageStyle = computed(() => `width: ${GRID_COLS * CELL}px; height: ${GRID_ROWS * CELL}px;`)

/** 玩家渲染欄位：站在浮木上（RIVER 列）時用浮點 raftCol 反映漂移，其餘用整數 col（見 design.md Decision 4） */
const playerRenderCol = computed(() =>
  rowType(state.player.row) === 'RIVER' ? state.player.raftCol : state.player.col
)
const playerStyle = computed(
  () => `left: ${playerRenderCol.value * CELL}px; top: ${state.player.row * CELL}px; width: ${CELL}px; height: ${CELL}px;`
)

/** 終點列 5 個蓮花座（含佔用狀態） */
const goalPads = computed(() =>
  GOAL_SLOT_COLS.map((col, index) => ({ col, index, filled: state.goalSlots[index] === true }))
)

/**
 * 攤平所有車道實體成一維渲染清單（Decision 3）：每個實體渲染「本體」與「向左 wrap 的分身」兩份，
 * 靠 stage 的 overflow:hidden 裁切，讓實體跨越環形軌道接縫時從另一側無縫滑入／滑出。
 */
const flatEntities = computed<EntityRender[]>(() => {
  const out: EntityRender[] = []
  for (const lane of state.lanes) {
    const top = lane.row * CELL
    for (const entity of lane.entities) {
      const w = entity.length * CELL
      out.push({ key: `${entity.id}-r`, left: entity.floatCol * CELL, top, width: w, row: lane.row, type: lane.type })
      out.push({ key: `${entity.id}-g`, left: (entity.floatCol - entity.trackLength) * CELL, top, width: w, row: lane.row, type: lane.type })
    }
  }
  return out
})

/** 私有工具方法：snapshot 同步、計時器管理、提示、樣式映射 */
const _handlers = {
  syncState: () => {
    const snap = engine.getSnapshot()
    // 先算出玩家新渲染座標，與上一次比對；跳躍量 > 1.5 格視為瞬移（重生/被沖出）→ 關動畫
    const renderCol = rowType(snap.player.row) === 'RIVER' ? snap.player.raftCol : snap.player.col
    const left = renderCol * CELL
    const top = snap.player.row * CELL
    state.playerNoAnim = Math.abs(left - prevPlayerLeft) > CELL * 1.5 || Math.abs(top - prevPlayerTop) > CELL * 1.5
    prevPlayerLeft = left
    prevPlayerTop = top

    state.player = snap.player
    state.lanes = snap.lanes
    state.goalSlots = snap.goalSlots
    state.lives = snap.lives
    state.score = snap.score
    state.level = snap.level
    state.roundsCleared = snap.roundsCleared
    state.goalsFilled = snap.goalsFilled
  },
  stopTickTimer: () => {
    if (tickTimer) {
      clearInterval(tickTimer)
      tickTimer = null
    }
  },
  flashToast: (text: string, kind: ToastKind, durationMs = 900) => {
    if (toastTimer) clearTimeout(toastTimer)
    state.toast = text
    state.toastKind = kind
    state.toastVisible = true
    toastTimer = setTimeout(() => {
      state.toastVisible = false
      toastTimer = null
    }, durationMs)
  },
  terrainStyle: (row: number) => `top: ${row * CELL}px; height: ${CELL}px;`,
  entityStyle: (item: EntityRender) => {
    const color = item.type === 'ROAD' ? CAR_COLORS[item.row] ?? '#ffd166' : '#8a5a2b'
    return `left: ${item.left}px; top: ${item.top}px; width: ${item.width}px; height: ${CELL}px; --veh: ${color};`
  },
  padStyle: (col: number) => `left: ${col * CELL}px; top: 0px; width: ${CELL}px; height: ${CELL}px;`
}

const _actions = {
  recordHistory: async () => {
    state.rewardMessage = ''
    try {
      const result = await gameHistory.actions.record('frogger', 'FROGGER', {
        score: state.score,
        level: state.level,
        meta: { roundsCleared: state.roundsCleared, goalsFilled: state.goalsFilled }
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
    // Pause 期間 interval 持續運作但提前 return（不清除/重建，見 design.md Risks）
    tickTimer = setInterval(() => {
      if (state.status !== 'playing') return
      const event = engine.tick(TICK_MS)
      _handlers.syncState()
      _actions.handleEvent(event)
    }, TICK_MS)
  },
  /** 依 engine 事件顯示提示並在命數歸零時結算（撞車/落水/進終點的統一出口） */
  handleEvent: (event: FroggerEvent) => {
    if (event.hazard?.type === 'COLLISION') _handlers.flashToast('SQUISHED!', 'danger')
    else if (event.hazard?.type === 'FALL_IN_WATER') _handlers.flashToast('SPLASH!', 'danger')
    else if (event.hazard?.type === 'GOAL_FILLED') {
      _handlers.flashToast(event.roundCleared ? `ROUND ${state.roundsCleared} CLEAR!` : 'HOME!', 'good', event.roundCleared ? 1400 : 900)
    }
    if (event.gameOver) _actions.finishGame()
  },
  /** 三種輸入來源（鍵盤／觸控按鈕）共用的離散移動入口，統一守衛與結算流程 */
  doMove: (direction: MoveDirection) => {
    if (state.status !== 'playing') return
    const event = engine.move(direction)
    _handlers.syncState()
    _actions.handleEvent(event)
  },
  finishGame: () => {
    _handlers.stopTickTimer()
    state.status = 'gameover'
    state.message = `命數用盡，本局止步於第 ${state.level} 輪、送達 ${state.goalsFilled} 隻青蛙。`
    state.resultOverlayVisible = true
    _actions.recordHistory()
  },
  /** 完整重置 Grid／車道實體／玩家／蓮花座／Life／Score／Level（見 spec「Restart 完整重置」），停在 READY */
  resetGame: () => {
    _handlers.stopTickTimer()
    if (toastTimer) {
      clearTimeout(toastTimer)
      toastTimer = null
    }
    engine.reset()
    state.playerNoAnim = true
    prevPlayerLeft = -999
    prevPlayerTop = -999
    _handlers.syncState()
    state.status = 'ready'
    state.waitingOverlayVisible = true
    state.resultOverlayVisible = false
    state.toastVisible = false
    state.rewardMessage = ''
    state.message = '按 START 開始，用方向鍵／WASD 或下方按鈕讓青蛙一次跳一格。'
  },
  startGame: () => {
    if (state.status === 'playing') return
    if (state.status === 'gameover') _actions.resetGame()
    state.waitingOverlayVisible = false
    state.resultOverlayVisible = false
    state.status = 'playing'
    state.message = '往上跳過車道與河流，把青蛙送進蓮花座！'
    _actions.startTickLoop()
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
    _handlers.stopTickTimer()
    state.waitingOverlayVisible = false
    state.status = 'gameover'
    state.message = '本局已結束。'
    state.resultOverlayVisible = true
    _actions.recordHistory()
  }
}

const click = {
  /** 鍵盤與觸控四方向按鈕共用同一支移動入口（見 tasks 6.4/6.5，不重複寫兩份移動邏輯） */
  dir: (direction: MoveDirection) => _actions.doMove(direction),
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

const onFroggerKeydown = (event: KeyboardEvent) => {
  const key = event.key.toLowerCase()
  if (key === 'escape' || key === 'p') {
    if (state.status === 'playing') _actions.pauseGame()
    else if (canResumeFromPause.value) _actions.resumeGame()
    return
  }
  let direction: MoveDirection | null = null
  if (key === 'arrowup' || key === 'w') direction = 'up'
  else if (key === 'arrowdown' || key === 's') direction = 'down'
  else if (key === 'arrowleft' || key === 'a') direction = 'left'
  else if (key === 'arrowright' || key === 'd') direction = 'right'
  if (!direction) return
  event.preventDefault()
  if (state.status !== 'playing') return
  click.dir(direction)
}

onMounted(() => {
  // 載入歷史紀錄以取得 HIGH SCORE（statsByGame），失敗不影響遊戲
  gameHistory.ensureLoaded().catch(() => undefined)
  if (typeof window !== 'undefined') window.addEventListener('keydown', onFroggerKeydown)
  _actions.resetGame()
  state.waitingOverlayVisible = true
})

onBeforeUnmount(() => {
  _handlers.stopTickTimer()
  if (toastTimer) clearTimeout(toastTimer)
  if (typeof window !== 'undefined') window.removeEventListener('keydown', onFroggerKeydown)
})
</script>

<template>
  <main class="fg-page" :class="`state-${state.status}`">
    <div class="fg-overlay" />

    <div v-if="state.waitingOverlayVisible" class="game-mask waiting-mask">
      <div class="mask-title">WELCOME</div>
      <p class="waiting-subtitle">FROGGER</p>
      <p class="waiting-hint">方向鍵／WASD 跳格 · 閃避車流 · 踩浮木橫渡河道 · 送進 5 個蓮花座</p>
      <button class="fg-btn waiting-btn waiting-start" type="button" @click="click.start">START</button>
      <button class="fg-btn link waiting-btn" type="button" @click="click.openRateDialog">CONVERT</button>
      <button class="fg-btn link waiting-btn" type="button" @click="click.openRuleDialog">RULE</button>
    </div>

    <div v-if="state.status === 'pause'" class="game-mask pause-mask">
      <div class="mask-title">PAUSED</div>
      <div class="result-actions">
        <button class="fg-btn" type="button" @click="click.resume">RESUME</button>
        <button class="fg-btn" type="button" @click="click.replay">RESTART</button>
        <button class="fg-btn danger" type="button" @click="click.exit">EXIT</button>
      </div>
    </div>

    <div v-if="state.resultOverlayVisible" class="game-mask result-mask">
      <div class="mask-title">GAME OVER</div>
      <div class="result-list">
        <div class="result-item"><span>SCORE</span><b>{{ state.score }}</b></div>
        <div class="result-item"><span>HIGH SCORE</span><b>{{ bestScore }}</b></div>
        <div class="result-item"><span>ROUNDS</span><b>{{ state.roundsCleared }}</b></div>
        <div class="result-item"><span>FROGS HOME</span><b>{{ state.goalsFilled }}</b></div>
      </div>
      <p v-if="state.rewardMessage" class="result-reward">{{ state.rewardMessage }}</p>
      <div class="result-actions">
        <button class="fg-btn" type="button" @click="click.again">AGAIN</button>
        <button class="fg-btn danger" type="button" @click="click.exit">EXIT</button>
      </div>
    </div>

    <GameRateDialog :visible="state.rateDialogOpen" game-key="frogger" game-name="FROGGER" :accent-color="ACCENT"
      @close="click.closeRateDialog" />
    <GameRuleDialog :visible="state.ruleDialogOpen" game-name="FROGGER" :accent-color="ACCENT" v-bind="FROGGER_RULE"
      @close="click.closeRuleDialog" />

    <section class="fg-shell">
      <aside class="fg-side left">
        <button class="fg-btn" type="button" :disabled="!canResumeFromPause" @click="click.resume">START</button>
        <button class="fg-btn" type="button" :disabled="!canPauseWhilePlaying" @click="click.pause">PAUSE</button>
        <button class="fg-btn" type="button" @click="click.replay">REPLAY</button>
        <button class="fg-btn link" type="button" @click="click.end">END</button>
        <button class="fg-btn" type="button" @click="click.openRateDialog">CONVERT</button>
        <button class="fg-btn" type="button" @click="click.openRuleDialog">RULE</button>
      </aside>

      <section class="fg-center">
        <header class="fg-title-wrap">
          <h1 class="fg-title">FROGGER</h1>
          <p class="fg-status" :class="statusClass">{{ statusText }}</p>
        </header>

        <div class="fg-frame">
          <div class="fg-stage" :style="stageStyle">
            <!-- 地形色帶（HOME/ROAD/MEDIAN/RIVER/GOAL） -->
            <div v-for="band in TERRAIN_ROWS" :key="`terrain-${band.row}`" class="fg-terrain"
              :class="`is-${band.type.toLowerCase()}`" :style="_handlers.terrainStyle(band.row)" />

            <!-- 終點列蓮花座 -->
            <div v-for="pad in goalPads" :key="`pad-${pad.index}`" class="fg-pad" :class="{ 'is-filled': pad.filled }"
              :style="_handlers.padStyle(pad.col)">
              <span v-if="pad.filled" class="fg-pad-frog" />
            </div>

            <!-- 車輛 / 浮木（本體 + 向左 wrap 分身，靠 overflow:hidden 裁切） -->
            <div v-for="item in flatEntities" :key="item.key" class="fg-veh"
              :class="item.type === 'ROAD' ? 'is-car' : 'is-log'" :style="_handlers.entityStyle(item)" />

            <!-- 青蛙 -->
            <div class="fg-frog" :class="[statusClass, { 'no-anim': state.playerNoAnim }]" :style="playerStyle" />

            <!-- 短暫通知（SPLASH!／SQUISHED!／HOME!／ROUND CLEAR） -->
            <div v-if="state.toastVisible" class="fg-toast" :class="`is-${state.toastKind}`">{{ state.toast }}</div>
          </div>

          <div class="fg-panel">
            <span>SCORE: {{ state.score }}</span>
            <span>LIVES: {{ state.lives }}</span>
            <span>LEVEL: {{ state.level }}</span>
          </div>
          <!-- 蓮花座佔用狀態 HUD -->
          <div class="fg-lotus-hud">
            <span class="fg-lotus-label">HOME</span>
            <span v-for="pad in goalPads" :key="`hud-${pad.index}`" class="fg-lotus-dot" :class="{ 'is-filled': pad.filled }" />
          </div>
        </div>

        <p class="fg-message">{{ state.message }}</p>
      </section>

      <aside class="fg-side right">
        <div class="fg-keypad">
          <button class="fg-btn key up" type="button" @click="click.dir('up')">↑</button>
          <button class="fg-btn key left" type="button" @click="click.dir('left')">←</button>
          <button class="fg-btn key down" type="button" @click="click.dir('down')">↓</button>
          <button class="fg-btn key right" type="button" @click="click.dir('right')">→</button>
        </div>
        <div class="fg-help">W A S D / Arrow Keys</div>
        <div class="fg-help-panel">
          <p class="fg-help-title">HOW TO PLAY</p>
          <p class="fg-help-text">
            一次跳一格往上前進，閃避車道上的車輛，踩上河道的浮木隨它漂流，把青蛙送進最上方 5 個蓮花座。
            落水、撞車或被浮木沖出畫面都會失去 1 命，命數歸零結束。ESC／P 可暫停。
          </p>
        </div>
      </aside>
    </section>
  </main>
</template>

<style scoped lang="scss">
.fg-page {
  --accent: #52b788;
  position: relative;
  min-height: 100vh;
  display: grid;
  place-items: center;
  background: radial-gradient(circle at top, #071c12, #030b07 60%);
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
    background: radial-gradient(circle at 20% 20%, rgba(82, 183, 136, 0.16), transparent 45%),
      radial-gradient(circle at 80% 70%, rgba(45, 226, 200, 0.1), transparent 40%);
    filter: blur(40px);
    animation: ambient-drift 12s ease-in-out infinite alternate;
  }

  &::after {
    background: linear-gradient(115deg, rgba(82, 183, 136, 0.05), rgba(0, 0, 0, 0));
    animation: ambient-pulse 4.6s ease-in-out infinite;
  }

  .fg-overlay {
    position: absolute;
    inset: 0;
    background-image: linear-gradient(rgba(82, 183, 136, 0.05) 1px, transparent 1px),
      linear-gradient(90deg, rgba(82, 183, 136, 0.05) 1px, transparent 1px);
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
      text-shadow: 0 0 18px rgba(82, 183, 136, 0.5);
    }

    &.waiting-mask {
      background: rgba(0, 0, 0, 0.88);

      .waiting-subtitle {
        margin: 0;
        color: #8ff0cb;
        letter-spacing: 0.3rem;
        font-size: 1.05rem;
        font-weight: 800;
      }

      .waiting-hint {
        margin: 0;
        max-width: 340px;
        text-align: center;
        color: #57bb95;
        font-size: 0.78rem;
        letter-spacing: 0.04em;
        line-height: 1.6;
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
      border: 1px solid rgba(82, 183, 136, 0.4);
      background: rgba(10, 44, 32, 0.65);
      color: #bdf5e0;
      padding: 8px 10px;
      font-variant-numeric: tabular-nums;
    }

    .result-reward {
      margin: 8px 0 0;
      color: #8ff0cb;
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

  .fg-shell {
    position: relative;
    z-index: 1;
    width: min(1100px, 100%);
    padding: 24px;
    display: grid;
    grid-template-columns: 180px 1fr 180px;
    gap: 20px;
    align-items: center;
  }

  .fg-side {
    display: flex;
    flex-direction: column;
    gap: 12px;

    &.right {
      align-items: center;
    }
  }

  .fg-btn {
    position: relative;
    overflow: hidden;
    border: 1px solid rgba(82, 183, 136, 0.4);
    border-radius: 6px;
    padding: 10px 12px;
    background: rgba(10, 44, 32, 0.75);
    color: var(--accent);
    font-weight: 700;
    letter-spacing: 0.5px;
    cursor: pointer;
    transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;

    &::after {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(105deg, transparent 35%, rgba(180, 245, 224, 0.25) 50%, transparent 65%);
      transform: translateX(-150%);
      transition: transform 0.35s ease;
      pointer-events: none;
    }

    &:hover {
      border-color: var(--accent);
      box-shadow: 0 0 12px rgba(82, 183, 136, 0.35);
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

  .fg-center {
    text-align: center;

    .fg-title-wrap {
      margin-bottom: 8px;
    }

    .fg-title {
      margin: 0;
      color: var(--accent);
      font-size: clamp(1.7rem, 5vw, 3rem);
      letter-spacing: 0.14rem;
      font-weight: 900;
      text-shadow: 0 0 14px rgba(82, 183, 136, 0.45);
      animation: title-float 2.6s ease-in-out infinite;
    }

    .fg-status {
      margin: 2px 0 0;
      color: #8ff0cb;
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

    .fg-frame {
      width: fit-content;
      margin: 12px auto 0;
      padding: 14px;
      background: #072116;
      border: 10px solid #124a32;
      border-radius: 18px;
      box-shadow: 0 0 0 1px rgba(82, 183, 136, 0.2), 0 0 24px rgba(82, 183, 136, 0.14);
      animation: frame-glow 5.4s ease-in-out infinite;
    }

    .fg-stage {
      box-sizing: content-box;
      position: relative;
      background: #05130d;
      border: 2px solid #000;
      border-radius: 8px;
      overflow: hidden;
      /* 觸控裝置上點擊方向鍵時，阻止瀏覽器原生捲動搶走手勢 */
      touch-action: none;
      user-select: none;
      -webkit-user-select: none;
    }
  }

  /* 地形色帶（全寬，依 row 疊在最底層） */
  .fg-terrain {
    position: absolute;
    left: 0;
    right: 0;

    &.is-home,
    &.is-median {
      background: repeating-linear-gradient(90deg, #1f6f43 0, #1f6f43 18px, #1c6540 18px, #1c6540 36px);
      box-shadow: inset 0 0 0 1px rgba(82, 183, 136, 0.18);
    }

    &.is-road {
      background: #191d24;
      box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.04);
      background-image: repeating-linear-gradient(90deg, rgba(255, 209, 102, 0.35) 0, rgba(255, 209, 102, 0.35) 14px, transparent 14px, transparent 34px);
      background-position: 0 center;
      background-size: 100% 3px;
      background-repeat: no-repeat;
    }

    &.is-river {
      background: linear-gradient(180deg, #10476e 0%, #0d3a5c 100%);
      box-shadow: inset 0 0 0 1px rgba(90, 170, 230, 0.12);
    }

    &.is-goal {
      background: linear-gradient(180deg, #0a2f4c 0%, #082641 100%);
      box-shadow: inset 0 -2px 0 0 rgba(82, 183, 136, 0.4);
    }
  }

  /* 蓮花座：終點列的安全落點；未佔用為深色圈，佔用後亮起並顯示青蛙 */
  .fg-pad {
    position: absolute;
    display: grid;
    place-items: center;
    z-index: 1;

    &::before {
      content: '';
      width: 74%;
      height: 74%;
      border-radius: 50%;
      background: radial-gradient(circle at 50% 40%, #12694a, #0c4a34 70%);
      border: 2px solid #2f7d55;
      box-shadow: inset 0 0 6px rgba(0, 0, 0, 0.5);
    }

    &.is-filled::before {
      background: radial-gradient(circle at 50% 40%, #7ff0bf, #34c98a 70%);
      border-color: #a9ffd9;
      box-shadow: 0 0 12px rgba(82, 240, 180, 0.7);
    }

    .fg-pad-frog {
      position: absolute;
      width: 42%;
      height: 42%;
      border-radius: 50% 50% 45% 45%;
      background: radial-gradient(circle at 50% 40%, #78e08f, #3fa35a 70%);
      border: 1.5px solid #1c5a30;
    }
  }

  /* 車輛與浮木：以整數格寬度的方塊呈現，原創造型（非 Frogger 官方美術） */
  .fg-veh {
    position: absolute;
    z-index: 2;
    border-radius: 7px;

    &.is-car {
      background: linear-gradient(180deg, color-mix(in srgb, var(--veh) 82%, #fff) 0%, var(--veh) 45%, color-mix(in srgb, var(--veh) 70%, #000) 100%);
      border: 2px solid rgba(0, 0, 0, 0.55);
      box-shadow: 0 0 8px color-mix(in srgb, var(--veh) 55%, transparent), inset 0 0 6px rgba(0, 0, 0, 0.25);

      /* 車窗亮帶 */
      &::before {
        content: '';
        position: absolute;
        top: 22%;
        left: 8%;
        right: 8%;
        height: 30%;
        border-radius: 3px;
        background: rgba(230, 250, 255, 0.7);
      }
    }

    &.is-log {
      background: repeating-linear-gradient(90deg, #8a5a2b 0, #8a5a2b 10px, #7a4d24 10px, #7a4d24 20px);
      border: 2px solid #4f3016;
      border-radius: 9px;
      box-shadow: inset 0 2px 4px rgba(255, 255, 255, 0.12), inset 0 -3px 6px rgba(0, 0, 0, 0.4);

      /* 木紋端點 */
      &::before,
      &::after {
        content: '';
        position: absolute;
        top: 50%;
        width: 8px;
        height: 8px;
        border-radius: 50%;
        border: 2px solid #4f3016;
        background: #6b4320;
        transform: translateY(-50%);
      }

      &::before {
        left: 4px;
      }

      &::after {
        right: 4px;
      }
    }
  }

  /* 青蛙：原創綠色像素造型（圓身＋雙眼），刻意非 Frogger 官方角色 */
  .fg-frog {
    position: absolute;
    z-index: 3;
    box-sizing: border-box;
    /* 內縮一點，讓角色略小於格子、看得出所在格 */
    padding: 3px;
    transition: left 0.09s ease-out, top 0.09s ease-out;
    will-change: left, top;

    &.no-anim {
      transition: none;
    }

    /* 身體 */
    &::before {
      content: '';
      position: absolute;
      inset: 4px;
      border-radius: 46% 46% 42% 42%;
      background: radial-gradient(circle at 50% 38%, #86ee9c 0%, #46ac60 62%, #2f7d45 100%);
      border: 2px solid #164a28;
      box-shadow: inset 0 -3px 5px rgba(0, 0, 0, 0.3), 0 0 8px rgba(82, 183, 136, 0.5);
    }

    /* 雙眼（用單一 after 疊兩顆眼睛：box-shadow 複製到右側） */
    &::after {
      content: '';
      position: absolute;
      top: 7px;
      left: 12px;
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #f4fff6;
      border: 1.5px solid #164a28;
      box-shadow: 14px 0 0 -0.5px #f4fff6, 14px 0 0 1px #164a28;
    }

    &.is-gameover::before {
      filter: grayscale(0.4) brightness(0.8);
    }
  }

  .fg-toast {
    position: absolute;
    top: 10px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 5;
    padding: 5px 14px;
    border-radius: 4px;
    font-weight: 900;
    font-size: 0.9rem;
    letter-spacing: 0.16rem;
    background: rgba(0, 0, 0, 0.78);
    animation: toast-pop 0.18s ease-out both;

    &.is-good {
      color: #8ff0cb;
      border: 1px solid var(--accent);
      text-shadow: 0 0 10px rgba(82, 183, 136, 0.6);
    }

    &.is-danger {
      color: #ff9a9a;
      border: 1px solid #ff5e5e;
      text-shadow: 0 0 10px rgba(255, 94, 94, 0.6);
    }
  }

  .fg-panel {
    margin-top: 12px;
    display: flex;
    justify-content: space-between;
    color: var(--accent);
    font-weight: 800;
    text-shadow: 0 0 6px rgba(82, 183, 136, 0.45);
    font-variant-numeric: tabular-nums;
  }

  .fg-lotus-hud {
    margin-top: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;

    .fg-lotus-label {
      color: #57bb95;
      font-size: 0.72rem;
      letter-spacing: 0.16em;
    }

    .fg-lotus-dot {
      width: 14px;
      height: 14px;
      border-radius: 50%;
      border: 2px solid #2f7d55;
      background: #0c4a34;

      &.is-filled {
        background: radial-gradient(circle at 50% 40%, #7ff0bf, #34c98a 70%);
        border-color: #a9ffd9;
        box-shadow: 0 0 8px rgba(82, 240, 180, 0.7);
      }
    }
  }

  .fg-message {
    margin-top: 14px;
    color: #8ff0cb;
    font-size: 0.85rem;
    animation: subtle-fade 2.8s ease-in-out infinite;
  }

  .fg-keypad {
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

  .fg-help {
    margin-top: 4px;
    font-size: 0.62rem;
    color: #57bb95;
    letter-spacing: 0.04em;
    text-align: center;
  }

  .fg-help-panel {
    margin-top: 6px;
    border: 1px solid rgba(82, 183, 136, 0.3);
    border-radius: 8px;
    padding: 12px;
    background: rgba(10, 44, 32, 0.5);

    .fg-help-title {
      margin: 0 0 6px;
      color: var(--accent);
      font-size: 0.72rem;
      letter-spacing: 0.14rem;
      font-weight: 800;
    }

    .fg-help-text {
      margin: 0;
      color: #8ff0cb;
      font-size: 0.72rem;
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
    box-shadow: 0 0 0 1px rgba(82, 183, 136, 0.2), 0 0 24px rgba(82, 183, 136, 0.14);
  }

  50% {
    box-shadow: 0 0 0 1px rgba(120, 224, 175, 0.35), 0 0 40px rgba(82, 183, 136, 0.28);
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

@keyframes toast-pop {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(-6px) scale(0.9);
  }

  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0) scale(1);
  }
}

@media (max-width: 980px) {
  .fg-page {
    .fg-shell {
      grid-template-columns: 1fr;
      padding: 16px;
    }

    .fg-side {
      flex-direction: row;
      flex-wrap: wrap;
      justify-content: center;
    }
  }
}
</style>
