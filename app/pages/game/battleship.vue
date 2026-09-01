<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useGameHistory } from '~/composables/useGameHistory'
import {
  BattleshipEngine,
  BOARD_SIZE,
  AI_DELAY_MIN_MS,
  AI_DELAY_MAX_MS,
  SHIP_CONFIG,
  coordToLabel,
  type Board,
  type Cell,
  type Coord,
  type GamePhase,
  type Orientation,
  type ShipSummary,
  type Winner
} from '~/utils/battleshipEngine'

const CELL_SIZE = 30
const ACCENT = '#3a86ff'

const SHIP_LABEL: Record<string, string> = {
  CARRIER: 'CARRIER',
  BATTLESHIP: 'BATTLESHIP',
  CRUISER: 'CRUISER',
  SUBMARINE: 'SUBMARINE',
  DESTROYER: 'DESTROYER'
}

const BATTLESHIP_RULE = {
  description:
    '傳統戰艦對戰（Player vs AI）：先在自己的海域佈署 5 艘戰艦（選戰艦→切換方向→點格預覽→再次點擊確認，全程零拖曳），' +
    '完成後雙方輪流攻擊對方海域，攻擊會判定 HIT／MISS，戰艦所有格子都被命中即 SUNK，先擊沉對方全部戰艦獲勝。',
  scoreRule:
    'HIT +33、SUNK +167、WIN +333；由於命中格數固定為 17 格、5 艘船全部擊沉，任何一場勝利的最終分數恆為固定值 1729。' +
    '落敗局分數為當下已累積的 HIT/SUNK 加總。射擊數／命中率等統計不影響分數，只作為表現參考。',
  levels: SHIP_CONFIG.map((s) => ({ level: SHIP_LABEL[s.name] ?? s.name, condition: `長度 ${s.length} 格` })),
  levelsTitle: '戰艦清單',
  note: '允許戰艦彼此相鄰；已攻擊過的格子不能再次攻擊，也不會消耗回合。AI 回合會有短暫思考延遲。'
}

type PlacementUI = {
  activeShipId: string | null
  orientation: Orientation
  previewAnchor: Coord | null
  previewCells: Coord[]
  previewValid: boolean
}

const router = useRouter()
const engine = new BattleshipEngine()
const gameHistory = useGameHistory()

const state = reactive({
  phase: 'PLACEMENT' as GamePhase,
  round: 1,
  score: 0,
  stats: { shots: 0, hits: 0, misses: 0 },
  playerBoard: [] as Board,
  enemyBoardView: [] as Board,
  playerShips: [] as ShipSummary[],
  enemyShips: [] as ShipSummary[],
  winner: null as Winner,
  placement: {
    activeShipId: null,
    orientation: 'HORIZONTAL',
    previewAnchor: null,
    previewCells: [],
    previewValid: false
  } as PlacementUI,
  aiThinking: false,
  paused: false,
  message: '',
  rewardMessage: '',
  waitingOverlayVisible: true,
  resultOverlayVisible: false,
  rateDialogOpen: false,
  ruleDialogOpen: false
})

let aiTimer: ReturnType<typeof setTimeout> | null = null

const stageStyle = computed(() => `--cell: ${CELL_SIZE}px;`)
const boardStyle = computed(() => `grid-template-columns: repeat(${BOARD_SIZE}, var(--cell));`)
const flatPlayerCells = computed(() => state.playerBoard.flat())
const flatEnemyCells = computed(() => state.enemyBoardView.flat())
const previewSet = computed(() => new Set(state.placement.previewCells.map((c) => `${c.x},${c.y}`)))
const allShipsPlaced = computed(() => state.playerShips.length > 0 && state.playerShips.every((s) => s.position !== null))
const playerShipsAlive = computed(() => state.playerShips.filter((s) => !s.sunk).length)
const enemyShipsAlive = computed(() => state.enemyShips.filter((s) => !s.sunk).length)
const accuracy = computed(() => (state.stats.shots > 0 ? Math.round((state.stats.hits / state.stats.shots) * 100) : 0))
const canAttack = computed(
  () => state.phase === 'PLAYER_TURN' && !state.aiThinking && !state.paused && !state.resultOverlayVisible
)
const canPause = computed(
  () => (state.phase === 'PLAYER_TURN' || state.phase === 'AI_TURN') && !state.paused && !state.resultOverlayVisible
)
const turnLabel = computed(() => {
  if (state.phase === 'PLACEMENT') return 'PLACEMENT'
  if (state.phase === 'GAME_OVER') return state.winner === 'PLAYER' ? 'YOU WIN' : 'YOU LOSE'
  if (state.aiThinking) return 'AI THINKING...'
  return state.phase === 'AI_TURN' ? 'AI TURN' : 'YOUR TURN'
})

/** 私有工具方法：棋盤格外觀、快照同步 */
const _handlers = {
  /**
   * 讀出目前的 phase（回傳型別為 GamePhase）。刻意包成函式呼叫而非直接讀 state.phase：
   * TS 的 control-flow narrowing 會把先前 `if (state.phase !== 'AI_TURN') return` 的窄化
   * 一路帶到 engine.aiAttack()／syncSnapshot() 之後（這兩個呼叫其實已經改變了 phase），
   * 導致後面 `=== 'GAME_OVER'` 被誤判為型別不重疊；函式呼叫的回傳型別不會被窄化，藉此繞開。
   */
  phaseNow: (): GamePhase => state.phase,
  syncSnapshot: () => {
    const snap = engine.getSnapshot()
    state.phase = snap.phase
    state.round = snap.round
    state.score = snap.score
    state.stats = snap.stats
    state.playerBoard = snap.playerBoard
    state.enemyBoardView = snap.enemyBoardView
    state.playerShips = snap.playerShips
    state.enemyShips = snap.enemyShips
    state.winner = snap.winner
  },
  clearAiTimer: () => {
    if (aiTimer) {
      clearTimeout(aiTimer)
      aiTimer = null
    }
  },
  playerCellClass: (cell: Cell): string => {
    const classes: string[] = []
    if (cell.state === 'SHIP') classes.push('is-ship')
    else if (cell.state === 'HIT') classes.push('is-hit')
    else if (cell.state === 'MISS') classes.push('is-miss')
    if (state.phase === 'PLACEMENT' && previewSet.value.has(`${cell.x},${cell.y}`)) {
      classes.push(state.placement.previewValid ? 'is-preview-valid' : 'is-preview-invalid')
    }
    return classes.join(' ')
  },
  playerCellChar: (cell: Cell): string => {
    if (cell.state === 'HIT') return 'X'
    if (cell.state === 'MISS') return '·'
    return ''
  },
  enemyCellClass: (cell: Cell): string => {
    if (cell.state === 'HIT') return 'is-hit'
    if (cell.state === 'MISS') return 'is-miss'
    return 'is-unknown'
  },
  enemyCellChar: (cell: Cell): string => {
    if (cell.state === 'HIT') return 'X'
    if (cell.state === 'MISS') return '·'
    return ''
  }
}

const _actions = {
  recordHistory: async () => {
    state.rewardMessage = ''
    try {
      const result = await gameHistory.actions.record('battleship', 'BATTLESHIP', {
        score: state.score,
        meta: {
          shots: state.stats.shots,
          hits: state.stats.hits,
          misses: state.stats.misses,
          accuracy: accuracy.value,
          rounds: state.round,
          winner: state.winner
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
    _handlers.clearAiTimer()
    engine.reset()
    _handlers.syncSnapshot()
    const next = engine.getNextUnplacedShip()
    state.placement.activeShipId = next?.id ?? null
    state.placement.orientation = 'HORIZONTAL'
    state.placement.previewAnchor = null
    state.placement.previewCells = []
    state.placement.previewValid = false
    state.aiThinking = false
    state.paused = false
    state.resultOverlayVisible = false
    state.rewardMessage = ''
    state.waitingOverlayVisible = true
    state.message = '按「開始」佈署你的艦隊。'
  },
  startPlacement: () => {
    state.waitingOverlayVisible = false
    state.message = '選擇戰艦、切換方向、點擊棋盤格放置。'
  },
  selectShip: (shipId: string) => {
    const ship = state.playerShips.find((s) => s.id === shipId)
    if (!ship || ship.position !== null) return
    state.placement.activeShipId = shipId
    if (state.placement.previewAnchor) _actions.updatePreview(state.placement.previewAnchor.x, state.placement.previewAnchor.y)
  },
  rotate: () => {
    state.placement.orientation = state.placement.orientation === 'HORIZONTAL' ? 'VERTICAL' : 'HORIZONTAL'
    if (state.placement.previewAnchor) _actions.updatePreview(state.placement.previewAnchor.x, state.placement.previewAnchor.y)
  },
  updatePreview: (x: number, y: number) => {
    if (!state.placement.activeShipId) return
    const check = engine.previewPlacement(state.placement.activeShipId, { x, y }, state.placement.orientation)
    state.placement.previewAnchor = { x, y }
    state.placement.previewCells = check.cells
    state.placement.previewValid = check.valid
  },
  clearPreview: () => {
    state.placement.previewAnchor = null
    state.placement.previewCells = []
    state.placement.previewValid = false
  },
  handleBoardCellClick: (x: number, y: number) => {
    if (state.phase !== 'PLACEMENT' || !state.placement.activeShipId) return
    const anchor = state.placement.previewAnchor
    const sameCell = anchor && anchor.x === x && anchor.y === y
    if (sameCell && state.placement.previewValid) {
      const shipId = state.placement.activeShipId
      if (!engine.confirmPlacement(shipId, { x, y }, state.placement.orientation)) return
      _handlers.syncSnapshot()
      _actions.clearPreview()
      const next = engine.getNextUnplacedShip()
      state.placement.activeShipId = next?.id ?? null
      state.message = next ? `選擇下一艘戰艦：${SHIP_LABEL[next.name] ?? next.name}` : '全部佈署完成！點擊 READY 開始戰鬥。'
      return
    }
    _actions.updatePreview(x, y)
  },
  ready: () => {
    if (!allShipsPlaced.value) return
    if (!engine.startBattle()) return
    _handlers.syncSnapshot()
    state.message = 'YOUR TURN：點擊敵方海域發動攻擊。'
  },
  attack: (x: number, y: number) => {
    if (!canAttack.value) return
    const cell = state.enemyBoardView[y]?.[x]
    if (!cell || cell.state !== 'EMPTY') return
    const outcome = engine.playerAttack({ x, y })
    if (outcome.result === 'ALREADY_ATTACKED') return
    _handlers.syncSnapshot()
    state.message =
      outcome.result === 'SUNK'
        ? `${SHIP_LABEL[state.enemyShips.find((s) => s.id === outcome.shipId)?.name ?? ''] ?? ''} SUNK!`
        : outcome.result === 'HIT'
          ? '💥 HIT!'
          : 'MISS'
    if (state.phase === 'GAME_OVER') {
      _actions.finishGame()
      return
    }
    _actions.scheduleAiTurn()
  },
  scheduleAiTurn: () => {
    state.aiThinking = true
    _handlers.clearAiTimer()
    const delay = AI_DELAY_MIN_MS + Math.random() * (AI_DELAY_MAX_MS - AI_DELAY_MIN_MS)
    aiTimer = setTimeout(() => {
      aiTimer = null
      if (state.phase !== 'AI_TURN') return
      const outcome = engine.aiAttack()
      _handlers.syncSnapshot()
      const phaseAfterAttack = _handlers.phaseNow()
      state.aiThinking = false
      if (outcome.target) {
        const label = coordToLabel(outcome.target)
        state.message =
          outcome.result === 'SUNK'
            ? `AI 攻擊 ${label}：${SHIP_LABEL[state.playerShips.find((s) => s.id === outcome.shipId)?.name ?? ''] ?? ''} SUNK!`
            : outcome.result === 'HIT'
              ? `AI 攻擊 ${label}：HIT`
              : `AI 攻擊 ${label}：MISS`
      }
      if (phaseAfterAttack === 'GAME_OVER') {
        _actions.finishGame()
        return
      }
      state.message = 'YOUR TURN：點擊敵方海域發動攻擊。'
    }, delay)
  },
  finishGame: () => {
    _handlers.clearAiTimer()
    state.resultOverlayVisible = true
    _actions.recordHistory()
  },
  playAgain: () => {
    _actions.resetGame()
    _actions.startPlacement()
  },
  pause: () => {
    if (!canPause.value) return
    state.paused = true
    state.message = '已暫停'
  },
  resume: () => {
    if (!state.paused) return
    state.paused = false
    state.message = state.phase === 'AI_TURN' ? 'AI TURN' : 'YOUR TURN：點擊敵方海域發動攻擊。'
  }
}

const click = {
  start: () => _actions.startPlacement(),
  selectShip: (shipId: string) => _actions.selectShip(shipId),
  rotate: () => _actions.rotate(),
  playerCellEnter: (x: number, y: number) => {
    if (state.phase === 'PLACEMENT') _actions.updatePreview(x, y)
  },
  playerCellClick: (x: number, y: number) => _actions.handleBoardCellClick(x, y),
  enemyCellClick: (x: number, y: number) => _actions.attack(x, y),
  ready: () => _actions.ready(),
  pause: () => _actions.pause(),
  resume: () => _actions.resume(),
  restart: () => _actions.playAgain(),
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
  if (state.paused) _actions.resume()
  else _actions.pause()
}

onMounted(() => {
  _actions.resetGame()
  window.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  _handlers.clearAiTimer()
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <main class="bs-page" :class="`phase-${state.phase.toLowerCase()}`">
    <div class="bs-overlay" />

    <div v-if="state.waitingOverlayVisible" class="game-mask waiting-mask">
      <div class="mask-title">WELCOME</div>
      <p class="waiting-subtitle">BATTLESHIP</p>
      <p class="waiting-hint">Player vs AI · 10×10 雙棋盤 · 零拖曳點擊式佈局</p>
      <button class="bs-btn waiting-btn waiting-start" type="button" @click="click.start">START</button>
      <button class="bs-btn link waiting-btn" type="button" @click="click.openRateDialog">CONVERT</button>
      <button class="bs-btn link waiting-btn" type="button" @click="click.openRuleDialog">RULE</button>
    </div>

    <div v-if="state.paused && !state.resultOverlayVisible" class="game-mask pause-mask">
      <div class="mask-title">PAUSED</div>
      <div class="result-actions">
        <button class="bs-btn" type="button" @click="click.resume">RESUME</button>
        <button class="bs-btn" type="button" @click="click.restart">RESTART</button>
        <button class="bs-btn danger" type="button" @click="click.exit">EXIT</button>
      </div>
    </div>

    <div v-if="state.resultOverlayVisible" class="game-mask result-mask">
      <div class="mask-title" :class="{ win: state.winner === 'PLAYER' }">
        {{ state.winner === 'PLAYER' ? 'YOU WIN' : 'YOU LOSE' }}
      </div>
      <div class="result-list">
        <div class="result-item"><span>SCORE</span><b>{{ state.score }}</b></div>
        <div class="result-item"><span>SHOTS / HITS</span><b>{{ state.stats.shots }} / {{ state.stats.hits }}</b></div>
        <div class="result-item"><span>ACCURACY</span><b>{{ accuracy }}%</b></div>
        <div class="result-item"><span>ROUND</span><b>{{ state.round }}</b></div>
      </div>
      <p v-if="state.rewardMessage" class="result-reward">{{ state.rewardMessage }}</p>
      <div class="result-actions">
        <button class="bs-btn" type="button" @click="click.again">AGAIN</button>
        <button class="bs-btn danger" type="button" @click="click.exit">EXIT</button>
      </div>
    </div>

    <GameRateDialog :visible="state.rateDialogOpen" game-key="battleship" game-name="BATTLESHIP" :accent-color="ACCENT"
      @close="click.closeRateDialog" />
    <GameRuleDialog :visible="state.ruleDialogOpen" game-name="BATTLESHIP" :accent-color="ACCENT" v-bind="BATTLESHIP_RULE"
      @close="click.closeRuleDialog" />

    <section class="bs-shell">
      <aside class="bs-side left">
        <button class="bs-btn" type="button" :disabled="!canPause" @click="click.pause">PAUSE</button>
        <button class="bs-btn" type="button" @click="click.restart">RESTART</button>
        <button class="bs-btn" type="button" @click="click.openRateDialog">CONVERT</button>
        <button class="bs-btn" type="button" @click="click.openRuleDialog">RULE</button>
      </aside>

      <section class="bs-center">
        <header class="bs-title-wrap">
          <h1 class="bs-title">BATTLESHIP</h1>
          <p class="bs-status">{{ turnLabel }}</p>
        </header>

        <div class="bs-panel">
          <span>ROUND: {{ state.round }}</span>
          <span>SCORE: {{ state.score }}</span>
          <span>YOUR SHIPS: {{ playerShipsAlive }} / {{ state.playerShips.length }}</span>
          <span>ENEMY SHIPS: {{ enemyShipsAlive }} / {{ state.enemyShips.length }}</span>
        </div>

        <div class="bs-boards">
          <div class="bs-board-block">
            <h2 class="bs-board-title">ENEMY WATERS</h2>
            <div class="bs-frame">
              <div class="bs-stage" :style="stageStyle">
                <div class="bs-board" :style="boardStyle">
                  <button v-for="cell in flatEnemyCells" :key="`e-${cell.x}-${cell.y}`" type="button" class="bs-cell"
                    :class="_handlers.enemyCellClass(cell)" :disabled="!canAttack || cell.state !== 'EMPTY'"
                    @click="click.enemyCellClick(cell.x, cell.y)">{{ _handlers.enemyCellChar(cell) }}</button>
                </div>
              </div>
            </div>
          </div>

          <div class="bs-board-block">
            <h2 class="bs-board-title">YOUR WATERS</h2>
            <div class="bs-frame">
              <div class="bs-stage" :style="stageStyle">
                <div class="bs-board" :style="boardStyle">
                  <button v-for="cell in flatPlayerCells" :key="`p-${cell.x}-${cell.y}`" type="button" class="bs-cell"
                    :class="_handlers.playerCellClass(cell)" :disabled="state.phase !== 'PLACEMENT'"
                    @mouseenter="click.playerCellEnter(cell.x, cell.y)"
                    @click="click.playerCellClick(cell.x, cell.y)">{{ _handlers.playerCellChar(cell) }}</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div v-if="state.phase === 'PLACEMENT'" class="bs-placement-panel">
          <div class="bs-ship-list">
            <button v-for="ship in state.playerShips" :key="ship.id" type="button" class="bs-ship-chip"
              :class="{ active: state.placement.activeShipId === ship.id, placed: ship.position !== null }"
              :disabled="ship.position !== null" @click="click.selectShip(ship.id)">
              <span class="chip-name">{{ SHIP_LABEL[ship.name] ?? ship.name }}</span>
              <span class="chip-blocks">
                <i v-for="n in ship.length" :key="n" class="chip-block" />
              </span>
            </button>
          </div>
          <div class="bs-placement-actions">
            <button class="bs-btn" type="button" @click="click.rotate">
              ROTATE：{{ state.placement.orientation === 'HORIZONTAL' ? '橫向 →' : '縱向 ↓' }}
            </button>
            <button class="bs-btn ready" type="button" :disabled="!allShipsPlaced" @click="click.ready">READY</button>
          </div>
        </div>

        <div v-else class="bs-stats">
          <span>SHOTS: {{ state.stats.shots }}</span>
          <span>HITS: {{ state.stats.hits }}</span>
          <span>MISS: {{ state.stats.misses }}</span>
          <span>ACCURACY: {{ accuracy }}%</span>
        </div>

        <p class="bs-message">{{ state.message }}</p>
      </section>

      <aside class="bs-side right">
        <div class="bs-help-panel">
          <p class="bs-help-title">HOW TO PLAY</p>
          <p class="bs-help-text">
            佈署階段：點選戰艦、按 ROTATE 切換方向，滑鼠移到（或點按）棋盤格會顯示綠色（合法）或紅色（非法）預覽，
            再次點擊同一格即可確認放置。全部放完按 READY 進入戰鬥。戰鬥階段輪流攻擊敵方海域，HIT/MISS/SUNK 判定
            正確、已攻擊格不能再選。先擊沉敵方全部戰艦獲勝。
          </p>
        </div>
      </aside>
    </section>
  </main>
</template>

<style scoped lang="scss">
.bs-page {
  position: relative;
  min-height: 100vh;
  display: grid;
  place-items: center;
  background: radial-gradient(circle at top, #061428, #010409 60%);
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
    background: radial-gradient(circle at 20% 20%, rgba(58, 134, 255, 0.16), transparent 45%),
      radial-gradient(circle at 80% 70%, rgba(120, 180, 255, 0.1), transparent 40%);
    filter: blur(40px);
    animation: ambient-drift 12s ease-in-out infinite alternate;
  }

  &::after {
    background: linear-gradient(115deg, rgba(58, 134, 255, 0.05), rgba(0, 0, 0, 0));
    animation: ambient-pulse 4.6s ease-in-out infinite;
  }

  .bs-overlay {
    position: absolute;
    inset: 0;
    background-image: linear-gradient(rgba(58, 134, 255, 0.05) 1px, transparent 1px),
      linear-gradient(90deg, rgba(58, 134, 255, 0.05) 1px, transparent 1px);
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
      color: #3a86ff;
      font-size: clamp(2rem, 8vw, 4rem);
      letter-spacing: 0.25rem;
      font-weight: 900;

      &.win {
        color: #8fc0ff;
      }
    }

    &.waiting-mask {
      background: rgba(0, 0, 0, 0.88);

      .waiting-subtitle {
        margin: 0;
        color: #9fc8ff;
        letter-spacing: 0.3rem;
        font-size: 0.95rem;
      }

      .waiting-hint {
        margin: 0;
        color: #5f8fbd;
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
      border: 1px solid rgba(58, 134, 255, 0.4);
      background: rgba(6, 20, 40, 0.65);
      color: #d6e8ff;
      padding: 8px 10px;
    }

    .result-reward {
      margin: 8px 0 0;
      color: #b8d8ff;
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

  .bs-shell {
    position: relative;
    z-index: 1;
    width: min(1100px, 100%);
    padding: 24px;
    display: grid;
    grid-template-columns: 180px 1fr 180px;
    gap: 20px;
    align-items: start;
  }

  .bs-side {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding-top: 60px;
  }

  .bs-btn {
    position: relative;
    overflow: hidden;
    border: 1px solid rgba(58, 134, 255, 0.4);
    border-radius: 6px;
    padding: 10px 12px;
    background: rgba(6, 18, 34, 0.75);
    color: #3a86ff;
    font-weight: 700;
    letter-spacing: 0.5px;
    cursor: pointer;
    transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;

    &::after {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(105deg, transparent 35%, rgba(190, 220, 255, 0.25) 50%, transparent 65%);
      transform: translateX(-150%);
      transition: transform 0.35s ease;
      pointer-events: none;
    }

    &:hover:not(:disabled) {
      border-color: #3a86ff;
      box-shadow: 0 0 12px rgba(58, 134, 255, 0.35);
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

    &.ready:not(:disabled) {
      border-color: #4ade80;
      color: #4ade80;
    }
  }

  .bs-center {
    text-align: center;

    .bs-title-wrap {
      margin-bottom: 8px;
    }

    .bs-title {
      margin: 0;
      color: #3a86ff;
      font-size: clamp(1.7rem, 5vw, 3rem);
      letter-spacing: 0.14rem;
      font-weight: 900;
      text-shadow: 0 0 14px rgba(58, 134, 255, 0.42);
    }

    .bs-status {
      margin: 2px 0 0;
      color: #9fc8ff;
      font-size: 0.9rem;
      letter-spacing: 0.2rem;
    }

    .bs-panel {
      margin: 10px auto 0;
      display: flex;
      justify-content: center;
      flex-wrap: wrap;
      gap: 8px 16px;
      color: #3a86ff;
      font-weight: 800;
      font-size: 0.8rem;
      text-shadow: 0 0 6px rgba(58, 134, 255, 0.45);
      font-variant-numeric: tabular-nums;
    }

    .bs-boards {
      margin-top: 14px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 18px;
    }

    .bs-board-block {
      width: fit-content;
    }

    .bs-board-title {
      margin: 0 0 6px;
      color: #9fc8ff;
      font-size: 0.75rem;
      letter-spacing: 0.2rem;
      font-weight: 800;
    }

    .bs-frame {
      width: fit-content;
      margin: 0 auto;
      padding: 12px;
      background: #061428;
      border: 8px solid #12305a;
      border-radius: 16px;
      box-shadow: 0 0 0 1px rgba(58, 134, 255, 0.2), 0 0 24px rgba(58, 134, 255, 0.14);
    }

    .bs-stage {
      position: relative;
      box-sizing: content-box;
      width: fit-content;
      padding: 6px;
      background: #040d1a;
      border: 2px solid #0a1f3a;
      border-radius: 8px;
    }

    .bs-board {
      display: grid;
      gap: 2px;
      width: fit-content;
    }

    .bs-cell {
      width: var(--cell);
      height: var(--cell);
      display: grid;
      place-items: center;
      padding: 0;
      font-weight: 800;
      font-size: 13px;
      line-height: 1;
      border: 1px solid #0a1f35;
      border-radius: 3px;
      cursor: pointer;
      user-select: none;
      -webkit-user-select: none;
      background: linear-gradient(145deg, #0f2846, #0a1c33);
      color: #cfe4ff;
      transition: background 0.1s ease;

      &:disabled {
        cursor: default;
      }

      &:not(:disabled):hover {
        background: linear-gradient(145deg, #17365e, #102544);
      }

      &.is-unknown {
        background: linear-gradient(145deg, #0f2846, #0a1c33);
      }

      &.is-ship {
        background: linear-gradient(145deg, #3a5a86, #24405f);
        border-color: #5580b0;
      }

      &.is-hit {
        background: #6e1414;
        border-color: #ff5e5e;
        color: #ffd6d6;
      }

      &.is-miss {
        background: #0a1c33;
        border-color: #2f5580;
        color: #7fb0e8;
      }

      &.is-preview-valid {
        background: rgba(74, 222, 128, 0.35) !important;
        border-color: #4ade80 !important;
      }

      &.is-preview-invalid {
        background: rgba(255, 94, 94, 0.35) !important;
        border-color: #ff5e5e !important;
      }
    }

    .bs-placement-panel {
      margin-top: 16px;
      display: grid;
      gap: 12px;
      justify-items: center;
    }

    .bs-ship-list {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 8px;
    }

    .bs-ship-chip {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      border: 1px solid rgba(58, 134, 255, 0.4);
      border-radius: 6px;
      padding: 6px 10px;
      background: rgba(6, 18, 34, 0.75);
      color: #9fc8ff;
      cursor: pointer;
      font-size: 0.7rem;
      letter-spacing: 0.05em;
      transition: border-color 0.2s ease, box-shadow 0.2s ease;

      &:hover:not(:disabled) {
        border-color: #3a86ff;
      }

      &.active {
        border-color: #4ade80;
        box-shadow: 0 0 10px rgba(74, 222, 128, 0.4);
        color: #d6ffe9;
      }

      &.placed {
        opacity: 0.4;
        cursor: not-allowed;
      }

      .chip-blocks {
        display: flex;
        gap: 2px;
      }

      .chip-block {
        width: 12px;
        height: 8px;
        background: #3a86ff;
        border-radius: 1px;
      }
    }

    .bs-placement-actions {
      display: flex;
      gap: 10px;
    }

    .bs-stats {
      margin-top: 14px;
      display: flex;
      justify-content: center;
      flex-wrap: wrap;
      gap: 8px 16px;
      color: #9fc8ff;
      font-size: 0.78rem;
      letter-spacing: 0.04em;
    }

    .bs-message {
      margin-top: 14px;
      color: #9fc8ff;
      font-size: 0.85rem;
    }
  }

  .bs-help-panel {
    border: 1px solid rgba(58, 134, 255, 0.3);
    border-radius: 8px;
    padding: 12px;
    background: rgba(6, 18, 34, 0.5);

    .bs-help-title {
      margin: 0 0 6px;
      color: #3a86ff;
      font-size: 0.75rem;
      letter-spacing: 0.14rem;
      font-weight: 800;
    }

    .bs-help-text {
      margin: 0;
      color: #9fc8ff;
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

@media (max-width: 980px) {
  .bs-page {
    .bs-shell {
      grid-template-columns: 1fr;
      padding: 16px;
    }

    .bs-side {
      flex-direction: row;
      flex-wrap: wrap;
      justify-content: center;
      padding-top: 0;
    }
  }
}
</style>
