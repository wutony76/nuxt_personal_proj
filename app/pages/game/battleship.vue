<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useGameHistory } from '~/composables/useGameHistory'
import {
  BattleshipEngine,
  BOARD_SIZE_BS,
  AI_DELAY_MIN_MS,
  AI_DELAY_MAX_MS,
  SHIP_CONFIG,
  CHAIN_WIN_MULTIPLIER,
  CHAIN_LOSE_MULTIPLIER,
  MAX_CHAIN_WINS,
  applyChainWin,
  applyChainLose,
  coordToLabel,
  type BoardBs,
  type CellBs,
  type Coord,
  type GamePhase,
  type Orientation,
  type ShipSummary,
  type Winner
} from '~/utils/battleshipEngine'

const CELL_SIZE = 30
const ACCENT = '#3a86ff'

/**
 * 「連勝加碼」每次過關（DOUBLE OR NOTHING 繼續下一場）重新佈署艦隊時，隨機換一組戰艦外觀配色，
 * 純視覺彩蛋、不影響任何判定；索引 0 為預設配色（新遊戲一律從這組開始）。
 * `hitBg`／`hitBorder`／`missBg`／`missBorder` 是 AI 在 YOUR WATERS 攻擊命中／落空時的格子顏色，
 * 跟著同一組配色一起換，讓「AI 選中的格子」視覺上也屬於當前這套戰艦造型（ENEMY WATERS 的命中／
 * 落空格不套用這組變數，維持原本紅色／藍灰色）。命中維持暖色系、落空維持冷色系，只是色相隨配色調整。
 */
const SHIP_SKINS = [
  { base: '#3a5a86', edge: '#24405f', border: '#5580b0', hitBg: '#6e1414', hitBorder: '#ff5e5e', missBg: '#0a1c33', missBorder: '#2f5580' }, // 預設：海軍藍
  { base: '#4a5a3a', edge: '#2f3d24', border: '#7a9a5a', hitBg: '#6e4a14', hitBorder: '#ffb84d', missBg: '#0a2f1c', missBorder: '#2f8055' }, // 迷彩綠
  { base: '#6b5a3a', edge: '#4a3d24', border: '#b09a5a', hitBg: '#6e3414', hitBorder: '#ff8a4d', missBg: '#1c2a33', missBorder: '#4a7a99' }, // 沙漠棕
  { base: '#5a3a5a', edge: '#3d243d', border: '#9a5a9a', hitBg: '#6e1450', hitBorder: '#ff5ec2', missBg: '#1c1c33', missBorder: '#4a4a80' }, // 深紫
  { base: '#5a5a5a', edge: '#3d3d3d', border: '#9a9a9a', hitBg: '#6e2020', hitBorder: '#ff7a7a', missBg: '#0a2033', missBorder: '#2f6080' } // 鋼鐵灰
]

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
  note:
    '允許戰艦彼此相鄰；已攻擊過的格子不能再次攻擊，也不會消耗回合。AI 回合會有短暫思考延遲。' +
    `贏了之後可選擇「結算」或「連勝加碼」：再戰贏了本局分數 x${CHAIN_WIN_MULTIPLIER} 累加進連勝分數，` +
    `再戰輸了連勝分數打 ${CHAIN_LOSE_MULTIPLIER * 10} 折並強制結算；最多可連續贏 ${MAX_CHAIN_WINS} 場，滿場自動結算。` +
    '每次「連勝加碼」重新佈署艦隊時，戰艦的外觀配色會隨機更換。'
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
  playerBoard: [] as BoardBs,
  enemyBoardView: [] as BoardBs,
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
  ruleDialogOpen: false,
  // ── 連勝加碼（Double or Nothing，比照 connect4.vue 的同名機制）──
  chainWins: 0,
  chainScore: 0,
  chainChoiceVisible: false,
  finalScore: 0,
  finalChainWins: 0,
  /** 目前戰艦外觀配色索引（見 SHIP_SKINS），只有「連勝加碼」過關重新佈署時才會隨機更換 */
  shipSkinIndex: 0
})

let aiTimer: ReturnType<typeof setTimeout> | null = null

const stageStyle = computed(() => `--cell: ${CELL_SIZE}px;`)
const boardStyle = computed(() => `grid-template-columns: repeat(${BOARD_SIZE_BS}, var(--cell));`)
/**
 * 只有 YOUR WATERS 需要戰艦配色變數：ENEMY WATERS 從不顯示 is-ship（見 getPlayerViewOfEnemyBoard），
 * 命中／落空格也一樣只在這裡帶入 --hit-*／--miss-*，讓 AI 攻擊的格子跟著換色。
 */
const shipSkinStyle = computed(() => {
  const skin = SHIP_SKINS[state.shipSkinIndex] ?? SHIP_SKINS[0]!
  return (
    `--ship-base: ${skin.base}; --ship-edge: ${skin.edge}; --ship-border: ${skin.border}; ` +
    `--hit-bg: ${skin.hitBg}; --hit-border: ${skin.hitBorder}; ` +
    `--miss-bg: ${skin.missBg}; --miss-border: ${skin.missBorder};`
  )
})
const playerStageStyle = computed(() => `${stageStyle.value} ${shipSkinStyle.value}`)
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
/** 比照 whack-a-mole.vue：PAUSE 不用遮罩，靠側欄 START／PAUSE 兩顆按鈕互斥 disabled 切換 */
const canResumeFromPause = computed(() => state.paused && !state.resultOverlayVisible)
const turnLabel = computed(() => {
  if (state.phase === 'PLACEMENT') return 'PLACEMENT'
  if (state.phase === 'GAME_OVER') return state.winner === 'PLAYER' ? 'YOU WIN' : 'YOU LOSE'
  if (state.paused) return 'PAUSED'
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
  playerCellClass: (cell: CellBs): string => {
    const classes: string[] = []
    if (cell.state === 'SHIP') classes.push('is-ship')
    else if (cell.state === 'HIT') classes.push('is-hit')
    else if (cell.state === 'MISS') classes.push('is-miss')
    if (state.phase === 'PLACEMENT' && previewSet.value.has(`${cell.x},${cell.y}`)) {
      classes.push(state.placement.previewValid ? 'is-preview-valid' : 'is-preview-invalid')
    }
    return classes.join(' ')
  },
  playerCellChar: (cell: CellBs): string => {
    if (cell.state === 'HIT') return 'X'
    if (cell.state === 'MISS') return '·'
    return ''
  },
  enemyCellClass: (cell: CellBs): string => {
    if (cell.state === 'HIT') return 'is-hit'
    if (cell.state === 'MISS') return 'is-miss'
    return 'is-unknown'
  },
  enemyCellChar: (cell: CellBs): string => {
    if (cell.state === 'HIT') return 'X'
    if (cell.state === 'MISS') return '·'
    return ''
  }
}

const _actions = {
  /** 送出「這次連勝加碼結算」的最終分數（state.finalScore），而非單局分數；送出後歸零連勝狀態 */
  recordFinalScore: async () => {
    state.rewardMessage = ''
    try {
      const result = await gameHistory.actions.record('battleship', 'BATTLESHIP', {
        score: state.finalScore,
        meta: {
          shots: state.stats.shots,
          hits: state.stats.hits,
          misses: state.stats.misses,
          accuracy: accuracy.value,
          rounds: state.round,
          winner: state.winner,
          chainWins: state.finalChainWins
        }
      })
      if (result.coinReward > 0) {
        state.rewardMessage = result.coinCapped ? `+${result.coinReward} coin（已達今日上限）` : `+${result.coinReward} coin`
      }
    } catch {
      // 紀錄寫入失敗不影響遊戲本身，靜默略過
    } finally {
      state.chainWins = 0
      state.chainScore = 0
    }
  },
  /** 隨機挑一組跟目前不同的戰艦配色（見 SHIP_SKINS），只在「連勝加碼」過關重新佈署時呼叫 */
  randomizeShipSkin: () => {
    if (SHIP_SKINS.length <= 1) return
    let next = Math.floor(Math.random() * SHIP_SKINS.length)
    if (next === state.shipSkinIndex) next = (next + 1) % SHIP_SKINS.length
    state.shipSkinIndex = next
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
    // 手動 RESTART／EXIT 前置視為放棄連勝，不結算、不送分；新局一律從預設配色開始
    state.chainWins = 0
    state.chainScore = 0
    state.chainChoiceVisible = false
    state.shipSkinIndex = 0
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
  /** 贏了之後把最終結算分數快照進 state.finalScore，開啟結果 overlay 並送出紀錄 */
  settleChain: () => {
    state.finalScore = state.chainScore
    state.finalChainWins = state.chainWins
    state.resultOverlayVisible = true
    _actions.recordFinalScore()
  },
  finishGame: () => {
    _handlers.clearAiTimer()

    if (state.winner === 'PLAYER') {
      state.chainWins += 1
      state.chainScore = state.chainWins === 1 ? state.score : applyChainWin(state.chainScore, state.score)
      if (state.chainWins >= MAX_CHAIN_WINS) {
        state.message = '連勝封頂，自動結算！'
        _actions.settleChain()
      } else {
        state.chainChoiceVisible = true
      }
      return
    }

    // 落敗：若曾經連勝過，累積分數打 8 折強制結算；否則就是這局分數直接結算（Battleship 沒有平手）
    state.chainScore = state.chainWins > 0 ? applyChainLose(state.chainScore) : state.score
    _actions.settleChain()
  },
  cashOut: () => {
    state.chainChoiceVisible = false
    _actions.settleChain()
  },
  /** 連勝加碼：重置棋盤與艦隊但保留 chainWins/chainScore，隨機換一組戰艦配色，重新進入佈署階段 */
  continueChain: () => {
    _handlers.clearAiTimer()
    state.chainChoiceVisible = false
    _actions.randomizeShipSkin()
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
    state.rewardMessage = ''
    state.message = `連勝加碼第 ${state.chainWins + 1} 戰，選擇戰艦、切換方向、點擊棋盤格放置。`
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
  cashOut: () => _actions.cashOut(),
  continueChain: () => _actions.continueChain(),
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

    <div v-if="state.chainChoiceVisible" class="game-mask result-mask chain-mask">
      <div class="mask-title win">YOU WIN</div>
      <div class="result-list">
        <div class="result-item"><span>本局得分</span><b>{{ state.score }}</b></div>
        <div class="result-item"><span>連勝次數</span><b>{{ state.chainWins }} / {{ MAX_CHAIN_WINS }}</b></div>
        <div class="result-item"><span>累積分數</span><b>{{ state.chainScore }}</b></div>
      </div>
      <p class="chain-hint">
        再戰贏了本局分數 x{{ CHAIN_WIN_MULTIPLIER }} 累加；再戰輸了累積分數打 {{ CHAIN_LOSE_MULTIPLIER * 10 }} 折並強制結算。
      </p>
      <div class="result-actions">
        <button class="bs-btn" type="button" @click="click.cashOut">CASH OUT（{{ state.chainScore }} 分）</button>
        <button class="bs-btn danger" type="button" @click="click.continueChain">DOUBLE OR NOTHING</button>
      </div>
    </div>

    <div v-if="state.resultOverlayVisible" class="game-mask result-mask">
      <div class="mask-title" :class="{ win: state.winner === 'PLAYER' }">
        {{ state.winner === 'PLAYER' ? 'YOU WIN' : 'YOU LOSE' }}
      </div>
      <div class="result-list">
        <div class="result-item"><span>SCORE</span><b>{{ state.finalScore }}</b></div>
        <div class="result-item"><span>SHOTS / HITS</span><b>{{ state.stats.shots }} / {{ state.stats.hits }}</b></div>
        <div class="result-item"><span>ACCURACY</span><b>{{ accuracy }}%</b></div>
        <div class="result-item"><span>ROUND</span><b>{{ state.round }}</b></div>
        <div v-if="state.finalChainWins > 0" class="result-item"><span>連勝加碼</span><b>{{ state.finalChainWins }} 場</b></div>
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
        <button class="bs-btn" type="button" :disabled="!canResumeFromPause" @click="click.resume">START</button>
        <button class="bs-btn" type="button" :disabled="!canPause" @click="click.pause">PAUSE</button>
        <button class="bs-btn" type="button" @click="click.restart">RESTART</button>
        <button class="bs-btn" type="button" @click="click.openRateDialog">CONVERT</button>
        <button class="bs-btn" type="button" @click="click.openRuleDialog">RULE</button>
      </aside>

      <section class="bs-center">
        <header class="bs-title-wrap">
          <h1 class="bs-title">BATTLESHIP</h1>
          <p class="bs-status" :class="{ 'is-ai-thinking': state.aiThinking }">{{ turnLabel }}</p>
        </header>

        <div class="bs-panel">
          <span>ROUND: {{ state.round }}</span>
          <span>SCORE: {{ state.score }}</span>
          <span>YOUR SHIPS: {{ playerShipsAlive }} / {{ state.playerShips.length }}</span>
          <span>ENEMY SHIPS: {{ enemyShipsAlive }} / {{ state.enemyShips.length }}</span>
          <span v-if="state.chainWins > 0">STREAK: {{ state.chainWins }}/{{ MAX_CHAIN_WINS }} · BANK: {{ state.chainScore }}</span>
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
              <div class="bs-stage" :style="playerStageStyle">
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

    .chain-hint {
      margin: 8px 0 0;
      width: 260px;
      color: #ffb3bb;
      font-size: 0.75rem;
      line-height: 1.5;
      text-align: center;
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
    /* 比其他遊戲頁寬（1100px）：ENEMY WATERS／YOUR WATERS 兩個 10x10 棋盤橫向並排需要更多中央欄寬度 */
    width: min(1300px, 100%);
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

      /* AI 猜測（思考延遲）期間換成警示色，跟平常藍色的回合狀態明顯區分 */
      &.is-ai-thinking {
        color: #ff9f1c;
        text-shadow: 0 0 10px rgba(255, 159, 28, 0.5);
      }
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
      flex-direction: row;
      flex-wrap: wrap;
      justify-content: center;
      align-items: flex-start;
      gap: 18px 28px;
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
        /* 隨連勝加碼過關隨機更換的戰艦配色（見 SHIP_SKINS／playerStageStyle），未設定變數時退回原本海軍藍 */
        background: linear-gradient(145deg, var(--ship-base, #3a5a86), var(--ship-edge, #24405f));
        border-color: var(--ship-border, #5580b0);
      }

      &.is-hit {
        /* 隨連勝加碼過關隨機更換的命中色（見 SHIP_SKINS／playerStageStyle），未設定變數時退回原本紅色 */
        background: var(--hit-bg, #6e1414);
        border-color: var(--hit-border, #ff5e5e);
        color: #ffd6d6;
      }

      &.is-miss {
        /* 隨連勝加碼過關隨機更換的落空色（見 SHIP_SKINS／playerStageStyle），未設定變數時退回原本藍灰色 */
        background: var(--miss-bg, #0a1c33);
        border-color: var(--miss-border, #2f5580);
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
