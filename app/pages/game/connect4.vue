<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useGameHistory } from '~/composables/useGameHistory'
import {
  Connect4Engine,
  BOARD_COLS,
  createConnect4Board,
  C4_AI_DELAY_MIN_MS,
  C4_AI_DELAY_MAX_MS,
  WIN_BASE,
  MAX_SCORE,
  DRAW_SCORE,
  getNextOpenRow,
  type Connect4Board,
  type Connect4Result,
  type Connect4Winner,
  type Coord2,
  type TurnPlayer
} from '~/utils/connect4Engine'

/**
 * CONNECT 4（四子棋，Player vs AI）— 全專案第二款回合制對戰遊戲。
 *
 * 沿用 BATTLESHIP 的既有精神：核心邏輯抽到 connect4Engine.ts（純 TS，見該檔說明），頁面只以
 * reactive() 鏡像 engine 的 getSnapshot()，Logic / Rendering 分離。AI 回合以 setTimeout 延遲，
 * callback 內檢查目前 phase 仍為預期值才續行（避免 Restart 後殘留 timeout 誤觸發）。
 *
 * 頁面自行維護 7 態 UI phase（見 design.md Decision 7）：
 *   PLAYER_TURN → PLAYER_DROP → PLAYER_RESULT → AI_TURN → AI_DROP → AI_RESULT →（循環）／GAME_OVER
 * engine 只維護權威回合（PLAYER/AI）與 over，DROP/RESULT 這些中間態純粹是掉落動畫與「AI THINKING…」
 * 的視覺編排，勝負判定在落子當下就同步算完（engine 內），不等待動畫（見 design.md Decision 4）。
 */

const CELL_SIZE = 46
const GAP = 8
const ACCENT = '#e63946'

/** 掉落動畫時長 */
const DROP_ANIM_MS = 360
/** 落子後短暫停留（讓玩家看清結果）再進下一態 */
const RESULT_MS = 260
/** 勝負底定後，先高亮連線再彈出結算 overlay 的停留時間 */
const WIN_REVEAL_MS = 900
/** 暫停後續玩時，被凍結的步驟延後多久再執行（避免瞬間跳完） */
const RESUME_DELAY_MS = 320

type Phase =
  | 'PLAYER_TURN'
  | 'PLAYER_DROP'
  | 'PLAYER_RESULT'
  | 'AI_TURN'
  | 'AI_DROP'
  | 'AI_RESULT'
  | 'GAME_OVER'

const CONNECT4_RULE = {
  description:
    '經典四子棋（Player vs AI）：玩家（紅）先手，與 AI（黃）輪流選擇欄位落子，棋子受重力落到該欄最底的空位。' +
    '搶先讓自己的棋子在水平、垂直或任一對角線方向連成 4 子即獲勝；棋盤 42 格全部落滿仍無人連線則為平手。',
  scoreRule:
    `獲勝分數 = 固定基礎分 ${WIN_BASE} + 落子效率加成（最速 4 手完成連線得滿分 ${MAX_SCORE}，之後每多用 1 手 -3 分，最低不低於 ${WIN_BASE} 分）；` +
    `平手固定 ${DRAW_SCORE} 分；落敗 0 分。用越少步數獲勝分數越高。`,
  levels: [
    { level: '最速獲勝', condition: `4 手連成 4 子 → ${MAX_SCORE} 分（滿分）` },
    { level: '獲勝', condition: `每多用 1 手 -3 分，最低 ${WIN_BASE} 分` },
    { level: '平手', condition: `棋盤填滿且無連線 → ${DRAW_SCORE} 分` },
    { level: '落敗', condition: 'AI 先連成 4 子 → 0 分' }
  ],
  levelsTitle: '計分級距',
  note: 'AI 決策順序為「優先獲勝 → 優先阻擋你 → 隨機合法欄」；已落滿 6 顆的欄位不能再選、也不消耗回合。AI 回合會有短暫思考延遲。'
}

const router = useRouter()
const engine = new Connect4Engine()
const gameHistory = useGameHistory()

const state = reactive({
  phase: 'PLAYER_TURN' as Phase,
  // 以空棋盤初始化（而非 []），讓 SSR 與 client hydration 的格數一致，避免 hydration mismatch
  board: createConnect4Board() as Connect4Board,
  turn: 'PLAYER' as TurnPlayer,
  winner: null as Connect4Winner,
  result: null as Connect4Result | null,
  score: 0,
  playerMoves: 0,
  aiMoves: 0,
  lastDrop: null as Coord2 | null,
  winningLine: null as Coord2[] | null,
  hoverCol: null as number | null,
  paused: false,
  message: '',
  rewardMessage: '',
  waitingOverlayVisible: true,
  resultOverlayVisible: false,
  rateDialogOpen: false,
  ruleDialogOpen: false
})

/** 單一循序計時器：整個回合流程嚴格線性，任何時刻只會有一個待執行步驟 */
let seqTimer: ReturnType<typeof setTimeout> | null = null
/** 暫停時被凍結、尚未執行的步驟；續玩時重新排程 */
let pendingStep: (() => void) | null = null

const stageStyle = computed(() => `--cell: ${CELL_SIZE}px; --gap: ${GAP}px; --pitch: ${CELL_SIZE + GAP}px;`)
const boardStyle = computed(() => `grid-template-columns: repeat(${BOARD_COLS}, var(--cell));`)
const columns = computed(() => Array.from({ length: BOARD_COLS }, (_, c) => c))
const flatCells = computed(() => {
  const out: Array<{ disc: Connect4Board[number][number]; r: number; c: number }> = []
  state.board.forEach((row, r) => {
    row.forEach((disc, c) => out.push({ disc, r, c }))
  })
  return out
})
const winSet = computed(() => new Set((state.winningLine ?? []).map((cell) => `${cell.row},${cell.col}`)))
const canDrop = computed(
  () => state.phase === 'PLAYER_TURN' && !state.paused && !state.resultOverlayVisible && !state.waitingOverlayVisible
)
const canPause = computed(
  () => !state.waitingOverlayVisible && !state.resultOverlayVisible && !state.paused && state.phase !== 'GAME_OVER'
)
/** 玩家 hover 中的欄位，其落點格顯示半透明預覽子（僅玩家可落子時） */
const previewCell = computed<Coord2 | null>(() => {
  if (!canDrop.value || state.hoverCol === null) return null
  const row = getNextOpenRow(state.board, state.hoverCol)
  return row === null ? null : { row, col: state.hoverCol }
})
const turnLabel = computed(() => {
  if (state.phase === 'GAME_OVER') {
    return state.result === 'WIN' ? 'YOU WIN' : state.result === 'LOSE' ? 'YOU LOSE' : 'DRAW'
  }
  if (state.phase === 'AI_TURN') return 'AI THINKING...'
  if (state.phase === 'AI_DROP' || state.phase === 'AI_RESULT') return 'AI MOVE'
  if (state.phase === 'PLAYER_DROP' || state.phase === 'PLAYER_RESULT') return 'YOUR MOVE'
  return 'YOUR TURN'
})

/** 私有工具方法：快照同步、計時器管理、格子外觀 */
const _handlers = {
  syncSnapshot: () => {
    const snap = engine.getSnapshot()
    state.board = snap.board
    state.turn = snap.turn
    state.winner = snap.winner
    state.result = snap.result
    state.score = snap.score
    state.playerMoves = snap.playerMoves
    state.aiMoves = snap.aiMoves
    state.lastDrop = snap.lastDrop
    state.winningLine = snap.winningLine
  },
  clearSeqTimer: () => {
    if (seqTimer) {
      clearTimeout(seqTimer)
      seqTimer = null
    }
  },
  turnMessage: (): string => {
    if (state.phase === 'AI_TURN') return 'AI THINKING...'
    if (state.phase === 'AI_DROP' || state.phase === 'AI_RESULT') return 'AI 落子中...'
    return '輪到你了，點欄位落子'
  },
  isColumnFull: (col: number): boolean => state.board[0]?.[col] !== 'EMPTY',
  cellClass: (cell: { disc: string; r: number; c: number }): string => {
    const classes: string[] = []
    if (cell.disc === 'PLAYER') classes.push('is-player')
    else if (cell.disc === 'AI') classes.push('is-ai')
    else classes.push('is-empty')
    if (winSet.value.has(`${cell.r},${cell.c}`)) classes.push('is-win')
    if (state.lastDrop && state.lastDrop.row === cell.r && state.lastDrop.col === cell.c) classes.push('is-dropping')
    const preview = previewCell.value
    if (cell.disc === 'EMPTY' && preview && preview.row === cell.r && preview.col === cell.c) classes.push('is-preview')
    if (state.hoverCol === cell.c && canDrop.value) classes.push('is-hover-col')
    return classes.join(' ')
  },
  /** 掉落動畫：從欄頂上方（row 0 更上面）滑到落點格，距離依落點 row 等比例計算 */
  cellStyle: (cell: { disc: string; r: number; c: number }): string => {
    if (state.lastDrop && state.lastDrop.row === cell.r && state.lastDrop.col === cell.c) {
      return `--drop-rows: ${cell.r + 1};`
    }
    return ''
  }
}

const _actions = {
  recordHistory: async () => {
    state.rewardMessage = ''
    try {
      const result = await gameHistory.actions.record('connect4', 'CONNECT 4', {
        score: state.score,
        meta: {
          result: state.result,
          winner: state.winner,
          playerMoves: state.playerMoves,
          aiMoves: state.aiMoves
        }
      })
      if (result.coinReward > 0) {
        state.rewardMessage = result.coinCapped ? `+${result.coinReward} coin（已達今日上限）` : `+${result.coinReward} coin`
      }
    } catch {
      // 紀錄寫入失敗不影響遊戲本身，靜默略過
    }
  },
  /** 循序排程：清掉舊 timer、記住待執行步驟；暫停中則凍結不排程（續玩時再跑） */
  runStep: (delay: number, fn: () => void) => {
    _handlers.clearSeqTimer()
    pendingStep = fn
    if (state.paused) return
    seqTimer = setTimeout(() => {
      seqTimer = null
      const step = pendingStep
      pendingStep = null
      if (step) step()
    }, delay)
  },
  resetGame: () => {
    _handlers.clearSeqTimer()
    pendingStep = null
    engine.reset()
    _handlers.syncSnapshot()
    state.phase = 'PLAYER_TURN'
    state.hoverCol = null
    state.paused = false
    state.resultOverlayVisible = false
    state.rewardMessage = ''
    state.waitingOverlayVisible = true
    state.message = '按「START」開始對局。'
  },
  startPlay: () => {
    state.waitingOverlayVisible = false
    state.message = '輪到你了，點欄位落子。'
  },
  dropColumn: (col: number) => {
    if (!canDrop.value) return
    const res = engine.playerDrop(col)
    if (!res) return // 欄滿或非玩家回合：不落子、不消耗回合
    _handlers.syncSnapshot()
    state.hoverCol = null
    state.phase = 'PLAYER_DROP'
    state.message = '你落子了'
    _actions.runStep(DROP_ANIM_MS, _actions.afterPlayerDrop)
  },
  afterPlayerDrop: () => {
    if (engine.isOver()) {
      state.phase = 'PLAYER_RESULT'
      _actions.runStep(WIN_REVEAL_MS, _actions.finishGame)
      return
    }
    state.phase = 'PLAYER_RESULT'
    _actions.runStep(RESULT_MS, _actions.toAiTurn)
  },
  toAiTurn: () => {
    state.phase = 'AI_TURN'
    state.message = 'AI THINKING...'
    const delay = C4_AI_DELAY_MIN_MS + Math.random() * (C4_AI_DELAY_MAX_MS - C4_AI_DELAY_MIN_MS)
    _actions.runStep(delay, _actions.aiMove)
  },
  aiMove: () => {
    const res = engine.aiDrop()
    if (!res) {
      // 理論上不會發生（AI_TURN 必有合法欄）；保底回到玩家回合避免卡死
      state.phase = 'PLAYER_TURN'
      state.message = _handlers.turnMessage()
      return
    }
    _handlers.syncSnapshot()
    state.phase = 'AI_DROP'
    state.message = `AI 落在第 ${res.col + 1} 欄`
    _actions.runStep(DROP_ANIM_MS, _actions.afterAiDrop)
  },
  afterAiDrop: () => {
    if (engine.isOver()) {
      state.phase = 'AI_RESULT'
      _actions.runStep(WIN_REVEAL_MS, _actions.finishGame)
      return
    }
    state.phase = 'AI_RESULT'
    _actions.runStep(RESULT_MS, _actions.toPlayerTurn)
  },
  toPlayerTurn: () => {
    state.phase = 'PLAYER_TURN'
    state.message = '輪到你了，點欄位落子。'
  },
  finishGame: () => {
    _handlers.clearSeqTimer()
    pendingStep = null
    state.phase = 'GAME_OVER'
    state.resultOverlayVisible = true
    state.message = turnLabel.value
    _actions.recordHistory()
  },
  playAgain: () => {
    _actions.resetGame()
    _actions.startPlay()
  },
  pause: () => {
    if (!canPause.value) return
    state.paused = true
    // 凍結：清掉正在跑的 timer，但保留 pendingStep，讓續玩時能接續
    _handlers.clearSeqTimer()
    state.message = '已暫停'
  },
  resume: () => {
    if (!state.paused) return
    state.paused = false
    state.message = _handlers.turnMessage()
    if (pendingStep) {
      const step = pendingStep
      pendingStep = null
      _actions.runStep(RESUME_DELAY_MS, step)
    }
  }
}

const click = {
  start: () => _actions.startPlay(),
  dropColumn: (col: number) => _actions.dropColumn(col),
  hoverColumn: (col: number) => {
    if (canDrop.value) state.hoverCol = col
  },
  clearHover: () => {
    state.hoverCol = null
  },
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
  if (state.waitingOverlayVisible || state.resultOverlayVisible) return
  if (state.paused) _actions.resume()
  else _actions.pause()
}

onMounted(() => {
  _actions.resetGame()
  window.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  _handlers.clearSeqTimer()
  pendingStep = null
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <main class="c4-page" :class="`phase-${state.phase.toLowerCase()}`">
    <div class="c4-overlay" />

    <div v-if="state.waitingOverlayVisible" class="game-mask waiting-mask">
      <div class="mask-title">WELCOME</div>
      <p class="waiting-subtitle">CONNECT 4</p>
      <p class="waiting-hint">Player vs AI · 7×6 棋盤 · 連成 4 子獲勝</p>
      <button class="c4-btn waiting-btn waiting-start" type="button" @click="click.start">START</button>
      <button class="c4-btn link waiting-btn" type="button" @click="click.openRateDialog">CONVERT</button>
      <button class="c4-btn link waiting-btn" type="button" @click="click.openRuleDialog">RULE</button>
    </div>

    <div v-if="state.paused && !state.resultOverlayVisible" class="game-mask pause-mask">
      <div class="mask-title">PAUSED</div>
      <div class="result-actions">
        <button class="c4-btn" type="button" @click="click.resume">RESUME</button>
        <button class="c4-btn" type="button" @click="click.restart">RESTART</button>
        <button class="c4-btn danger" type="button" @click="click.exit">EXIT</button>
      </div>
    </div>

    <div v-if="state.resultOverlayVisible" class="game-mask result-mask">
      <div class="mask-title" :class="{ win: state.result === 'WIN', draw: state.result === 'DRAW' }">
        {{ turnLabel }}
      </div>
      <div class="result-list">
        <div class="result-item"><span>SCORE</span><b>{{ state.score }}</b></div>
        <div class="result-item"><span>YOUR DISCS</span><b>{{ state.playerMoves }}</b></div>
        <div class="result-item"><span>AI DISCS</span><b>{{ state.aiMoves }}</b></div>
      </div>
      <p v-if="state.rewardMessage" class="result-reward">{{ state.rewardMessage }}</p>
      <div class="result-actions">
        <button class="c4-btn" type="button" @click="click.again">AGAIN</button>
        <button class="c4-btn danger" type="button" @click="click.exit">EXIT</button>
      </div>
    </div>

    <GameRateDialog :visible="state.rateDialogOpen" game-key="connect4" game-name="CONNECT 4" :accent-color="ACCENT"
      @close="click.closeRateDialog" />
    <GameRuleDialog :visible="state.ruleDialogOpen" game-name="CONNECT 4" :accent-color="ACCENT" v-bind="CONNECT4_RULE"
      @close="click.closeRuleDialog" />

    <section class="c4-shell">
      <aside class="c4-side left">
        <button class="c4-btn" type="button" :disabled="!canPause" @click="click.pause">PAUSE</button>
        <button class="c4-btn" type="button" @click="click.restart">RESTART</button>
        <button class="c4-btn" type="button" @click="click.openRateDialog">CONVERT</button>
        <button class="c4-btn" type="button" @click="click.openRuleDialog">RULE</button>
      </aside>

      <section class="c4-center">
        <header class="c4-title-wrap">
          <h1 class="c4-title">CONNECT 4</h1>
          <p class="c4-status">{{ turnLabel }}</p>
        </header>

        <div class="c4-panel">
          <span>YOU: {{ state.playerMoves }}</span>
          <span>AI: {{ state.aiMoves }}</span>
          <span>SCORE: {{ state.score }}</span>
        </div>

        <div class="c4-frame">
          <div class="c4-stage" :style="stageStyle" @mouseleave="click.clearHover">
            <div class="c4-selectors" :style="boardStyle">
              <button v-for="col in columns" :key="`sel-${col}`" type="button" class="c4-selector"
                :disabled="!canDrop || _handlers.isColumnFull(col)" @mouseenter="click.hoverColumn(col)"
                @click="click.dropColumn(col)">▼</button>
            </div>
            <div class="c4-board" :style="boardStyle">
              <button v-for="cell in flatCells" :key="`${cell.r}-${cell.c}`" type="button" class="c4-cell"
                :class="_handlers.cellClass(cell)" :style="_handlers.cellStyle(cell)"
                :disabled="!canDrop || _handlers.isColumnFull(cell.c)" @mouseenter="click.hoverColumn(cell.c)"
                @click="click.dropColumn(cell.c)">
                <span class="c4-disc" />
              </button>
            </div>
          </div>
        </div>

        <p class="c4-message">{{ state.message }}</p>
      </section>

      <aside class="c4-side right">
        <div class="c4-help-panel">
          <p class="c4-help-title">HOW TO PLAY</p>
          <p class="c4-help-text">
            玩家（紅）先手。點擊欄頂 ▼ 或欄內任一格即可在該欄落子，棋子受重力落到最底空位。
            水平、垂直或對角線任一方向連成 4 子即獲勝；棋盤填滿無連線則平手。
            AI（黃）會優先搶自己的連線、其次阻擋你的連線，否則隨機落子。ESC / P 可暫停。
          </p>
          <div class="c4-legend">
            <span class="c4-legend-item"><i class="dot p" />YOU</span>
            <span class="c4-legend-item"><i class="dot a" />AI</span>
          </div>
        </div>
      </aside>
    </section>
  </main>
</template>

<style scoped lang="scss">
.c4-page {
  position: relative;
  min-height: 100vh;
  display: grid;
  place-items: center;
  background: radial-gradient(circle at top, #2a0a12, #0a0406 62%);
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
    background: radial-gradient(circle at 22% 20%, rgba(230, 57, 70, 0.18), transparent 45%),
      radial-gradient(circle at 78% 72%, rgba(255, 210, 63, 0.1), transparent 42%);
    filter: blur(42px);
    animation: c4-ambient-drift 12s ease-in-out infinite alternate;
  }

  &::after {
    background: linear-gradient(115deg, rgba(230, 57, 70, 0.05), rgba(0, 0, 0, 0));
    animation: c4-ambient-pulse 4.6s ease-in-out infinite;
  }

  .c4-overlay {
    position: absolute;
    inset: 0;
    background-image: linear-gradient(rgba(230, 57, 70, 0.05) 1px, transparent 1px),
      linear-gradient(90deg, rgba(230, 57, 70, 0.05) 1px, transparent 1px);
    background-size: 28px 28px;
    pointer-events: none;
    z-index: 0;
    animation: c4-grid-drift 14s linear infinite;
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
      color: #e63946;
      font-size: clamp(2rem, 8vw, 4rem);
      letter-spacing: 0.25rem;
      font-weight: 900;
      text-shadow: 0 0 18px rgba(230, 57, 70, 0.5);

      &.win {
        color: #ff6b78;
      }

      &.draw {
        color: #ffd23f;
      }
    }

    &.waiting-mask {
      background: rgba(0, 0, 0, 0.88);

      .waiting-subtitle {
        margin: 0;
        color: #ff9aa4;
        letter-spacing: 0.3rem;
        font-size: 0.95rem;
      }

      .waiting-hint {
        margin: 0;
        color: #b06068;
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
      width: 260px;
    }

    .result-item {
      display: flex;
      justify-content: space-between;
      border: 1px solid rgba(230, 57, 70, 0.4);
      background: rgba(40, 8, 14, 0.65);
      color: #ffdfe2;
      padding: 8px 10px;
    }

    .result-reward {
      margin: 8px 0 0;
      color: #ffd0d4;
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

  .c4-shell {
    position: relative;
    z-index: 1;
    width: min(1100px, 100%);
    padding: 24px;
    display: grid;
    grid-template-columns: 180px 1fr 200px;
    gap: 20px;
    align-items: start;
  }

  .c4-side {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding-top: 60px;
  }

  .c4-btn {
    position: relative;
    overflow: hidden;
    border: 1px solid rgba(230, 57, 70, 0.42);
    border-radius: 6px;
    padding: 10px 12px;
    background: rgba(34, 8, 12, 0.75);
    color: #ff6b78;
    font-weight: 700;
    letter-spacing: 0.5px;
    cursor: pointer;
    transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;

    &::after {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(105deg, transparent 35%, rgba(255, 200, 205, 0.22) 50%, transparent 65%);
      transform: translateX(-150%);
      transition: transform 0.35s ease;
      pointer-events: none;
    }

    &:hover:not(:disabled) {
      border-color: #e63946;
      box-shadow: 0 0 12px rgba(230, 57, 70, 0.4);
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

  .c4-center {
    text-align: center;

    .c4-title-wrap {
      margin-bottom: 8px;
    }

    .c4-title {
      margin: 0;
      color: #e63946;
      font-size: clamp(1.7rem, 5vw, 3rem);
      letter-spacing: 0.14rem;
      font-weight: 900;
      text-shadow: 0 0 14px rgba(230, 57, 70, 0.45);
    }

    .c4-status {
      margin: 2px 0 0;
      color: #ff9aa4;
      font-size: 0.9rem;
      letter-spacing: 0.2rem;
    }

    .c4-panel {
      margin: 10px auto 0;
      display: flex;
      justify-content: center;
      flex-wrap: wrap;
      gap: 8px 16px;
      color: #ff6b78;
      font-weight: 800;
      font-size: 0.82rem;
      text-shadow: 0 0 6px rgba(230, 57, 70, 0.45);
      font-variant-numeric: tabular-nums;
    }

    .c4-frame {
      width: fit-content;
      margin: 16px auto 0;
      padding: 12px;
      background: #10173a;
      border: 8px solid #1d3f8f;
      border-radius: 16px;
      box-shadow: 0 0 0 1px rgba(230, 57, 70, 0.18), 0 0 26px rgba(29, 63, 143, 0.4);
    }

    .c4-stage {
      position: relative;
      box-sizing: content-box;
      width: fit-content;
      padding: 8px;
      background: #14235f;
      border: 2px solid #0d1740;
      border-radius: 10px;
    }

    .c4-selectors {
      display: grid;
      gap: var(--gap);
      width: fit-content;
      margin-bottom: 8px;
    }

    .c4-selector {
      width: var(--cell);
      height: 22px;
      display: grid;
      place-items: center;
      padding: 0;
      font-size: 14px;
      line-height: 1;
      color: #ff6b78;
      border: 1px solid transparent;
      border-radius: 4px;
      background: rgba(230, 57, 70, 0.12);
      cursor: pointer;
      transition: background 0.15s ease, color 0.15s ease, transform 0.15s ease;

      &:hover:not(:disabled) {
        background: rgba(230, 57, 70, 0.28);
        color: #fff;
        transform: translateY(2px);
      }

      &:disabled {
        opacity: 0.25;
        cursor: not-allowed;
      }
    }

    .c4-board {
      display: grid;
      gap: var(--gap);
      width: fit-content;
    }

    .c4-cell {
      position: relative;
      width: var(--cell);
      height: var(--cell);
      display: grid;
      place-items: center;
      padding: 0;
      border: none;
      border-radius: 50%;
      cursor: pointer;
      background: radial-gradient(circle at 50% 50%, #0a1024 0 58%, #16245e 60%);
      transition: box-shadow 0.15s ease;

      &:disabled {
        cursor: default;
      }

      &.is-hover-col {
        box-shadow: inset 0 0 0 2px rgba(255, 210, 63, 0.35);
      }

      .c4-disc {
        width: calc(var(--cell) - 10px);
        height: calc(var(--cell) - 10px);
        border-radius: 50%;
        transform: scale(0);
        transition: transform 0.12s ease;
      }

      &.is-player .c4-disc,
      &.is-ai .c4-disc,
      &.is-preview .c4-disc {
        transform: scale(1);
      }

      &.is-player .c4-disc {
        background: radial-gradient(circle at 35% 30%, #ff8a94, #e63946 60%, #a51726);
        box-shadow: 0 0 10px rgba(230, 57, 70, 0.55), inset 0 -3px 5px rgba(0, 0, 0, 0.35);
      }

      &.is-ai .c4-disc {
        background: radial-gradient(circle at 35% 30%, #ffe98a, #ffd23f 58%, #c79a1a);
        box-shadow: 0 0 10px rgba(255, 210, 63, 0.5), inset 0 -3px 5px rgba(0, 0, 0, 0.35);
      }

      &.is-preview .c4-disc {
        background: radial-gradient(circle at 35% 30%, rgba(255, 138, 148, 0.5), rgba(230, 57, 70, 0.32) 60%, transparent);
        box-shadow: none;
        transform: scale(0.9);
        opacity: 0.7;
      }

      &.is-dropping .c4-disc {
        animation: c4-drop 0.36s cubic-bezier(0.5, 0, 0.75, 0.4);
      }

      &.is-win .c4-disc {
        animation: c4-win-pulse 0.7s ease-in-out infinite alternate;
      }
    }
  }

  .c4-message {
    margin-top: 16px;
    color: #ff9aa4;
    font-size: 0.85rem;
    min-height: 1.2em;
  }

  .c4-help-panel {
    border: 1px solid rgba(230, 57, 70, 0.3);
    border-radius: 8px;
    padding: 12px;
    background: rgba(34, 8, 12, 0.5);

    .c4-help-title {
      margin: 0 0 6px;
      color: #e63946;
      font-size: 0.75rem;
      letter-spacing: 0.14rem;
      font-weight: 800;
    }

    .c4-help-text {
      margin: 0;
      color: #ff9aa4;
      font-size: 0.78rem;
      line-height: 1.6;
    }

    .c4-legend {
      margin-top: 10px;
      display: flex;
      gap: 16px;

      .c4-legend-item {
        display: flex;
        align-items: center;
        gap: 6px;
        color: #ffb3bb;
        font-size: 0.72rem;
        letter-spacing: 0.05em;
      }

      .dot {
        width: 14px;
        height: 14px;
        border-radius: 50%;

        &.p {
          background: radial-gradient(circle at 35% 30%, #ff8a94, #e63946 60%, #a51726);
        }

        &.a {
          background: radial-gradient(circle at 35% 30%, #ffe98a, #ffd23f 58%, #c79a1a);
        }
      }
    }
  }
}

@keyframes c4-drop {
  0% {
    transform: translateY(calc(var(--drop-rows, 6) * var(--pitch) * -1)) scale(1);
  }

  80% {
    transform: translateY(0) scale(1);
  }

  90% {
    transform: translateY(-6px) scale(1);
  }

  100% {
    transform: translateY(0) scale(1);
  }
}

@keyframes c4-win-pulse {
  0% {
    box-shadow: 0 0 10px rgba(255, 255, 255, 0.4), inset 0 -3px 5px rgba(0, 0, 0, 0.35);
    filter: brightness(1);
  }

  100% {
    box-shadow: 0 0 20px rgba(255, 255, 255, 0.85), inset 0 -3px 5px rgba(0, 0, 0, 0.35);
    filter: brightness(1.25);
  }
}

@keyframes c4-ambient-drift {
  0% {
    transform: translate(-1.5%, -1%) scale(1);
  }

  100% {
    transform: translate(1.5%, 1%) scale(1.06);
  }
}

@keyframes c4-ambient-pulse {

  0%,
  100% {
    opacity: 0.35;
  }

  50% {
    opacity: 0.75;
  }
}

@keyframes c4-grid-drift {
  0% {
    transform: translate(0, 0);
  }

  100% {
    transform: translate(14px, 14px);
  }
}

@media (max-width: 980px) {
  .c4-page {
    .c4-shell {
      grid-template-columns: 1fr;
      padding: 16px;
    }

    .c4-side {
      flex-direction: row;
      flex-wrap: wrap;
      justify-content: center;
      padding-top: 0;
    }
  }
}
</style>
