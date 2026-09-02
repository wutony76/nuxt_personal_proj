<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useGameHistory } from '~/composables/useGameHistory'
import TowerStackEngine, {
  TOWER_STACK_CONFIG,
  TS_STAGE_WIDTH,
  TS_STAGE_HEIGHT,
  BLOCK_HEIGHT,
  INITIAL_BLOCK_WIDTH,
  type TowerStackSnapshot
} from '~/utils/towerStackEngine'

type TowerStackStatus = 'ready' | 'playing' | 'pause' | 'gameover'
type LayerView = TowerStackSnapshot['layers'][number]
type MovingBlockView = NonNullable<TowerStackSnapshot['movingBlock']>
type FallingPieceView = TowerStackSnapshot['fallingPieces'][number]

const TICK_MS = 16
const READY_START = 3
/** Game Over 後先讓最後一顆方塊落一小段再顯示結算 overlay（見 6.8） */
const RESULT_DELAY_MS = 800
/** Drop 冷卻：去除觸控/滑鼠/鍵盤同一瞬間重複觸發，數值遠低於實際操作間隔、不影響手感 */
const DROP_COOLDOWN_MS = 90
const ACCENT = '#118ab2'
/** 塔身各層依高度循環的冷色系配色，讓塔越疊越有層次感 */
const LAYER_COLORS = ['#118ab2', '#1f9fc9', '#2ec4b6', '#3d8bde', '#5a7de0', '#7a6ae0']

const router = useRouter()
const engine = new TowerStackEngine()
const gameHistory = useGameHistory()

const state = reactive({
  status: 'ready' as TowerStackStatus,
  /** 以下皆為 engine snapshot 的鏡像；頁面只讀，不直接改動塔身 */
  layers: [] as LayerView[],
  movingBlock: null as MovingBlockView | null,
  fallingPieces: [] as FallingPieceView[],
  score: 0,
  combo: 0,
  maxCombo: 0,
  perfectCount: 0,
  height: 1,
  topWidth: INITIAL_BLOCK_WIDTH,
  blockSpeed: TOWER_STACK_CONFIG.blockSpeed as number,
  cameraY: 0,
  transientMessage: '',
  stageShake: false,
  message: '按「開始」後，抓時機讓方塊落在塔頂堆疊。',
  rewardMessage: '',
  waitingOverlayVisible: true,
  readyOverlayVisible: false,
  readyCountdownValue: READY_START,
  resultOverlayVisible: false,
  rateDialogOpen: false,
  ruleDialogOpen: false
})

const TOWER_STACK_RULE = {
  description:
    '疊塔玩法：畫面上方有一顆左右來回移動的方塊，點擊畫面（或按空白鍵、觸控）讓它落在塔頂。' +
    '方塊與塔頂重疊的部分才會留下、成為新的一層，沒有重疊的部分會化為碎片掉落——因此每疊偏一次塔就變窄一點，' +
    '偏得越多容錯空間越小。當落下的方塊與塔頂完全沒有重疊時，塔倒下、遊戲結束。',
  scoreRule:
    'SCORE ＝ 每成功疊放一層固定基礎分，另加每次 PERFECT 的額外分與 COMBO 連段加成；' +
    '偏移量在判定閾值內即為 PERFECT（維持原寬不縮減、Combo 累積加分），任何非 PERFECT 的疊放會中斷 Combo。開放式計分無上限。',
  levelsTitle: '參數 / 機制',
  levels: [
    { level: '移動速度', condition: `初始 ${TOWER_STACK_CONFIG.blockSpeed}，每疊一層 +${TOWER_STACK_CONFIG.speedIncrease}，上限 ${TOWER_STACK_CONFIG.maxSpeed}（px/tick）` },
    { level: 'PERFECT', condition: `偏移 ≤ ${TOWER_STACK_CONFIG.perfectThreshold}px 判定完美，維持塔頂原寬、不產生碎片` },
    { level: '基礎分', condition: `每成功疊放一層 +${TOWER_STACK_CONFIG.baseScorePerLayer} 分` },
    { level: 'COMBO', condition: `每次 PERFECT 額外 +${TOWER_STACK_CONFIG.perfectBonus}，再加 Combo×${TOWER_STACK_CONFIG.comboBonusStep}（Combo 加成上限 ${TOWER_STACK_CONFIG.comboBonusCap}）` }
  ],
  note: '重疊越少塔越窄、下一次容錯空間越小；速度會隨塔高持續遞增到上限。三種輸入（點擊／空白鍵／觸控）行為完全一致，全程零拖曳。'
}

let tickTimer: ReturnType<typeof setInterval> | null = null
let readyTimer: ReturnType<typeof setInterval> | null = null
let shakeTimer: ReturnType<typeof setTimeout> | null = null
let transientMessageTimer: ReturnType<typeof setTimeout> | null = null
let resultDelayTimer: ReturnType<typeof setTimeout> | null = null
let lastDropAt = 0

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
const stageStyle = computed(() => `width:${TS_STAGE_WIDTH}px; height:${TS_STAGE_HEIGHT}px;`)
/** 難度提示：依目前 blockSpeed 在 [初始, 上限] 區間的位置分級 */
const difficultyLabel = computed(() => {
  const min = TOWER_STACK_CONFIG.blockSpeed
  const max = TOWER_STACK_CONFIG.maxSpeed
  const ratio = max > min ? (state.blockSpeed - min) / (max - min) : 0
  if (ratio < 0.2) return 'SLOW'
  if (ratio < 0.45) return 'NORMAL'
  if (ratio < 0.7) return 'FAST'
  if (ratio < 0.95) return 'VERY FAST'
  return 'MAX'
})

/** 私有工具方法：snapshot 同步、計時器管理、樣式字串 */
const _handlers = {
  syncState: () => {
    const snap = engine.getSnapshot()
    state.layers = snap.layers
    state.movingBlock = snap.movingBlock
    state.fallingPieces = snap.fallingPieces
    state.score = snap.score
    state.combo = snap.combo
    state.maxCombo = snap.maxCombo
    state.perfectCount = snap.perfectCount
    state.height = snap.height
    state.topWidth = snap.topWidth
    state.blockSpeed = snap.blockSpeed
    state.cameraY = snap.cameraY
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
  stopShakeTimer: () => {
    if (shakeTimer) {
      clearTimeout(shakeTimer)
      shakeTimer = null
    }
  },
  stopTransientMessageTimer: () => {
    if (transientMessageTimer) {
      clearTimeout(transientMessageTimer)
      transientMessageTimer = null
    }
  },
  stopResultDelayTimer: () => {
    if (resultDelayTimer) {
      clearTimeout(resultDelayTimer)
      resultDelayTimer = null
    }
  },
  triggerShake: () => {
    _handlers.stopShakeTimer()
    state.stageShake = true
    shakeTimer = setTimeout(() => {
      state.stageShake = false
      shakeTimer = null
    }, 300)
  },
  showTransientMessage: (text: string) => {
    _handlers.stopTransientMessageTimer()
    state.transientMessage = text
    transientMessageTimer = setTimeout(() => {
      state.transientMessage = ''
      transientMessageTimer = null
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
  layerStyle: (layer: LayerView, index: number): string => {
    const color = LAYER_COLORS[index % LAYER_COLORS.length]
    return `left:${layer.x}px; top:${layer.y}px; width:${layer.width}px; height:${BLOCK_HEIGHT}px; background:${color}; box-shadow:0 0 8px ${color}88, inset 0 0 6px rgba(255,255,255,0.15);`
  },
  blockStyle: (block: MovingBlockView): string =>
    `left:${block.x}px; top:${block.y}px; width:${block.width}px; height:${BLOCK_HEIGHT}px;`,
  pieceStyle: (piece: FallingPieceView): string =>
    `left:${piece.x}px; top:${piece.y}px; width:${piece.width}px; height:${piece.height}px;`
}

const _actions = {
  recordHistory: async () => {
    state.rewardMessage = ''
    try {
      const finalWidthRatio = Number((state.topWidth / INITIAL_BLOCK_WIDTH).toFixed(3))
      const result = await gameHistory.actions.record('towerStack', 'TOWER STACK', {
        score: state.score,
        level: state.height,
        meta: {
          maxCombo: state.maxCombo,
          perfectCount: state.perfectCount,
          finalWidthRatio
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
      if (state.status === 'playing') {
        engine.step()
        _handlers.syncState()
      } else if (state.status === 'gameover') {
        // Game Over 後讓殘留碎片落完再自行停下 tick（見 design.md Decision 3）
        if (state.fallingPieces.length > 0) {
          engine.step()
          _handlers.syncState()
        } else {
          _handlers.stopTickTimer()
        }
      }
    }, TICK_MS)
  },
  resetGame: () => {
    _handlers.stopTickTimer()
    _handlers.stopReadyTimer()
    _handlers.stopShakeTimer()
    _handlers.stopTransientMessageTimer()
    _handlers.stopResultDelayTimer()
    engine.reset()
    _handlers.syncState()
    state.status = 'ready'
    state.transientMessage = ''
    state.stageShake = false
    state.waitingOverlayVisible = true
    state.resultOverlayVisible = false
    state.readyOverlayVisible = false
    state.rewardMessage = ''
    state.message = '按「開始」後，抓時機讓方塊落在塔頂堆疊。'
  },
  startGame: () => {
    if (state.status === 'playing' || state.readyOverlayVisible) return
    if (state.status === 'gameover') _actions.resetGame()
    state.waitingOverlayVisible = false
    state.resultOverlayVisible = false
    _handlers.runReadyCountdown(() => {
      state.status = 'playing'
      state.message = '抓準時機，讓方塊落在塔頂正上方！'
      _actions.startTickLoop()
    })
  },
  /** 三種輸入來源（點擊／空白鍵／觸控）共用的落下入口 */
  dropBlock: () => {
    if (state.status !== 'playing') return
    const now = Date.now()
    if (now - lastDropAt < DROP_COOLDOWN_MS) return
    lastDropAt = now
    const outcome = engine.dropBlock()
    if (!outcome) return
    _handlers.syncState()
    if (outcome.gameOver) {
      _actions.finishGame()
      return
    }
    if (outcome.perfect) {
      _handlers.showTransientMessage(outcome.combo >= 2 ? `PERFECT!  COMBO x${outcome.combo}` : 'PERFECT!')
      state.message = outcome.combo >= 2 ? `連續完美 ×${outcome.combo}！` : '完美對齊！塔頂維持原寬。'
    } else {
      state.message = `疊上第 ${state.height} 層，塔頂寬 ${Math.round(state.topWidth)}px。`
    }
  },
  finishGame: () => {
    state.status = 'gameover'
    state.message = '完全沒有重疊，塔倒了！'
    _handlers.triggerShake()
    _handlers.showTransientMessage('GAME OVER')
    _actions.recordHistory()
    _handlers.stopResultDelayTimer()
    resultDelayTimer = setTimeout(() => {
      resultDelayTimer = null
      state.resultOverlayVisible = true
    }, RESULT_DELAY_MS)
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
    state.message = '進行中...'
    _actions.startTickLoop()
  },
  playAgain: () => {
    _actions.resetGame()
    _actions.startGame()
  },
  endGameNow: () => {
    if (state.status === 'ready' || state.status === 'gameover') return
    _handlers.stopTickTimer()
    _handlers.stopReadyTimer()
    _handlers.stopResultDelayTimer()
    state.status = 'gameover'
    state.waitingOverlayVisible = false
    state.readyOverlayVisible = false
    state.resultOverlayVisible = true
    state.message = '本局已結束。'
    _actions.recordHistory()
  }
}

const onTowerStackKeydown = (event: KeyboardEvent) => {
  const key = event.key.toLowerCase()
  if (key === 'escape' || key === 'p') {
    if (state.status === 'playing') _actions.pauseGame()
    else if (state.status === 'pause') _actions.resumeGame()
    event.preventDefault()
    return
  }
  if (key === ' ' || key === 'spacebar') {
    if (!event.repeat) _actions.dropBlock()
    event.preventDefault()
  }
}

const click = {
  start: () => _actions.startGame(),
  drop: () => _actions.dropBlock(),
  pause: () => _actions.pauseGame(),
  resume: () => _actions.resumeGame(),
  replay: () => _actions.resetGame(),
  restart: () => _actions.playAgain(),
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
  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', onTowerStackKeydown)
  }
})

onBeforeUnmount(() => {
  _handlers.stopTickTimer()
  _handlers.stopReadyTimer()
  _handlers.stopShakeTimer()
  _handlers.stopTransientMessageTimer()
  _handlers.stopResultDelayTimer()
  if (typeof window !== 'undefined') {
    window.removeEventListener('keydown', onTowerStackKeydown)
  }
})
</script>

<template>
  <main class="ts-page" :class="`state-${state.status}`">
    <div class="ts-overlay" />

    <div v-if="state.waitingOverlayVisible" class="game-mask waiting-mask">
      <div class="mask-title">WELCOME</div>
      <p class="waiting-subtitle">TOWER STACK</p>
      <p class="waiting-hint">抓時機讓移動方塊落在塔頂 · 重疊越少塔越窄 · 完美對齊觸發 Combo</p>
      <button class="ts-btn waiting-btn waiting-start" type="button" @click="click.start">START</button>
      <button class="ts-btn link waiting-btn" type="button" @click="click.openRateDialog">CONVERT</button>
      <button class="ts-btn link waiting-btn" type="button" @click="click.openRuleDialog">RULE</button>
    </div>

    <div v-if="state.readyOverlayVisible" class="game-mask ready-mask">
      <div class="mask-title">READY</div>
      <div class="mask-count">{{ state.readyCountdownValue }}</div>
    </div>

    <div v-if="state.status === 'pause'" class="game-mask pause-mask">
      <div class="mask-title">PAUSED</div>
      <div class="result-actions">
        <button class="ts-btn" type="button" @click="click.resume">RESUME</button>
        <button class="ts-btn" type="button" @click="click.restart">RESTART</button>
        <button class="ts-btn danger" type="button" @click="click.exit">EXIT</button>
      </div>
    </div>

    <div v-if="state.resultOverlayVisible" class="game-mask result-mask">
      <div class="mask-title">GAME OVER</div>
      <div class="result-list">
        <div class="result-item"><span>SCORE</span><b>{{ state.score }}</b></div>
        <div class="result-item"><span>HEIGHT</span><b>{{ state.height }}</b></div>
        <div class="result-item"><span>MAX COMBO</span><b>{{ state.maxCombo }}</b></div>
        <div class="result-item"><span>PERFECT</span><b>{{ state.perfectCount }}</b></div>
      </div>
      <p v-if="state.rewardMessage" class="result-reward">{{ state.rewardMessage }}</p>
      <div class="result-actions">
        <button class="ts-btn" type="button" @click="click.again">AGAIN</button>
        <button class="ts-btn danger" type="button" @click="click.exit">EXIT</button>
      </div>
    </div>

    <GameRateDialog :visible="state.rateDialogOpen" game-key="towerStack" game-name="TOWER STACK" :accent-color="ACCENT"
      @close="click.closeRateDialog" />
    <GameRuleDialog :visible="state.ruleDialogOpen" game-name="TOWER STACK" :accent-color="ACCENT" v-bind="TOWER_STACK_RULE"
      @close="click.closeRuleDialog" />

    <section class="ts-shell">
      <aside class="ts-side left">
        <button class="ts-btn" type="button" :disabled="!canResumeFromPause" @click="click.resume">START</button>
        <button class="ts-btn" type="button" :disabled="!canPauseWhilePlaying" @click="click.pause">PAUSE</button>
        <button class="ts-btn" type="button" @click="click.replay">REPLAY</button>
        <button class="ts-btn link" type="button" @click="click.end">END</button>
        <button class="ts-btn" type="button" @click="click.openRateDialog">CONVERT</button>
        <button class="ts-btn" type="button" @click="click.openRuleDialog">RULE</button>
      </aside>

      <section class="ts-center">
        <header class="ts-title-wrap">
          <h1 class="ts-title">TOWER STACK</h1>
          <p class="ts-status" :class="statusClass">{{ statusText }}</p>
        </header>

        <div class="ts-frame">
          <div class="ts-stage" :class="{ shake: state.stageShake }" :style="stageStyle"
            @pointerdown.prevent="click.drop">
            <div class="ts-world" :style="`transform: translateY(${state.cameraY}px);`">
              <div v-for="(layer, i) in state.layers" :key="layer.id" class="ts-layer"
                :style="_handlers.layerStyle(layer, i)" />
              <div v-for="p in state.fallingPieces" :key="p.id" class="ts-piece" :style="_handlers.pieceStyle(p)" />
              <div v-if="state.movingBlock" class="ts-moving" :style="_handlers.blockStyle(state.movingBlock)" />
            </div>

            <div v-if="state.transientMessage" class="ts-transient"
              :class="{ 'is-over': state.transientMessage === 'GAME OVER' }">{{ state.transientMessage }}</div>
          </div>

          <div class="ts-panel">
            <span>SCORE: {{ state.score }}</span>
            <span>HEIGHT: {{ state.height }}</span>
            <span>COMBO: {{ state.combo }}</span>
            <span>SPEED: {{ difficultyLabel }}</span>
          </div>
        </div>

        <p class="ts-message">{{ state.message }}</p>
      </section>

      <aside class="ts-side right">
        <div class="ts-help-panel">
          <p class="ts-help-title">HOW TO PLAY</p>
          <p class="ts-help-text">
            上方方塊左右來回移動，點擊畫面／按空白鍵／觸控讓它落在塔頂。只有重疊的部分會留下成為新的一層，
            沒重疊的部分化為碎片掉落，塔因此越疊越窄；偏移在閾值內判定 PERFECT（維持原寬並累積 COMBO）。
            完全沒有重疊時塔倒下、遊戲結束。ESC／P 可暫停。
          </p>
        </div>
      </aside>
    </section>
  </main>
</template>

<style scoped lang="scss">
.ts-page {
  --accent: #118ab2;
  position: relative;
  min-height: 100vh;
  display: grid;
  place-items: center;
  background: radial-gradient(circle at top, #071b26, #02070c 60%);
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
    background: radial-gradient(circle at 20% 20%, rgba(17, 138, 178, 0.18), transparent 45%),
      radial-gradient(circle at 80% 70%, rgba(103, 232, 249, 0.1), transparent 40%);
    filter: blur(40px);
    animation: ambient-drift 12s ease-in-out infinite alternate;
  }

  &::after {
    background: linear-gradient(115deg, rgba(17, 138, 178, 0.05), rgba(0, 0, 0, 0));
    animation: ambient-pulse 4.6s ease-in-out infinite;
  }

  .ts-overlay {
    position: absolute;
    inset: 0;
    background-image: linear-gradient(rgba(17, 138, 178, 0.05) 1px, transparent 1px),
      linear-gradient(90deg, rgba(17, 138, 178, 0.05) 1px, transparent 1px);
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
      text-shadow: 0 0 18px rgba(17, 138, 178, 0.5);
    }

    .mask-count {
      color: var(--accent);
      font-size: clamp(3rem, 12vw, 7rem);
      font-weight: 900;
      line-height: 1;
    }

    &.waiting-mask {
      background: rgba(0, 0, 0, 0.88);

      .waiting-subtitle {
        margin: 0;
        color: #8fe3ff;
        letter-spacing: 0.3rem;
        font-size: 1.05rem;
        font-weight: 800;
      }

      .waiting-hint {
        margin: 0;
        color: #6fb7cf;
        font-size: 0.78rem;
        letter-spacing: 0.04em;
      }

      .waiting-btn {
        width: 200px;
      }
    }

    &.result-mask,
    &.pause-mask {
      .result-list {
        display: grid;
        gap: 8px;
        width: 280px;
      }

      .result-item {
        display: flex;
        justify-content: space-between;
        border: 1px solid rgba(17, 138, 178, 0.4);
        background: rgba(8, 34, 46, 0.65);
        color: #d3f4ff;
        padding: 8px 10px;
        font-variant-numeric: tabular-nums;
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

  .ts-shell {
    position: relative;
    z-index: 1;
    width: min(1100px, 100%);
    padding: 24px;
    display: grid;
    grid-template-columns: 180px 1fr 180px;
    gap: 20px;
    align-items: center;
  }

  .ts-side {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .ts-btn {
    position: relative;
    overflow: hidden;
    border: 1px solid rgba(17, 138, 178, 0.45);
    border-radius: 6px;
    padding: 10px 12px;
    background: rgba(8, 30, 40, 0.75);
    color: #67e8f9;
    font-weight: 700;
    letter-spacing: 0.5px;
    cursor: pointer;
    transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;

    &::after {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(105deg, transparent 35%, rgba(190, 240, 255, 0.25) 50%, transparent 65%);
      transform: translateX(-150%);
      transition: transform 0.35s ease;
      pointer-events: none;
    }

    &:hover {
      border-color: var(--accent);
      box-shadow: 0 0 12px rgba(17, 138, 178, 0.4);
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
      border-color: rgba(255, 120, 90, 0.5);
      color: #ff9d7d;
    }
  }

  .ts-center {
    text-align: center;

    .ts-title-wrap {
      margin-bottom: 8px;
    }

    .ts-title {
      margin: 0;
      color: var(--accent);
      font-size: clamp(1.6rem, 4.6vw, 2.6rem);
      letter-spacing: 0.12rem;
      font-weight: 900;
      text-shadow: 0 0 14px rgba(17, 138, 178, 0.55);
      animation: title-float 2.6s ease-in-out infinite;
    }

    .ts-status {
      margin: 2px 0 0;
      color: #d3f4ff;
      font-size: 0.9rem;
      letter-spacing: 0.2rem;

      &.is-playing {
        color: #67e8f9;
      }

      &.is-pause {
        color: #ffcc33;
      }

      &.is-gameover {
        color: #ff5e5e;
      }
    }

    .ts-frame {
      width: fit-content;
      margin: 12px auto 0;
      padding: 12px;
      background: #061722;
      border: 10px solid #0f3547;
      border-radius: 18px;
      box-shadow: 0 0 0 1px rgba(17, 138, 178, 0.2), 0 0 24px rgba(17, 138, 178, 0.18);
      animation: frame-glow 5.4s ease-in-out infinite;
    }

    .ts-stage {
      box-sizing: content-box;
      position: relative;
      background: linear-gradient(180deg, #041019 0%, #071c28 100%);
      border: 2px solid #000;
      border-radius: 8px;
      overflow: hidden;
      cursor: pointer;
      touch-action: none;
      user-select: none;
      -webkit-user-select: none;

      &.shake {
        animation: stage-shake 300ms ease-out;
      }

      .ts-world {
        position: absolute;
        inset: 0;
        transition: transform 0.25s ease-out;
      }

      .ts-layer {
        position: absolute;
        border-radius: 3px;
      }

      .ts-moving {
        position: absolute;
        border-radius: 3px;
        background: linear-gradient(180deg, #8ff4ff, #22c3e6);
        box-shadow: 0 0 14px rgba(103, 232, 249, 0.75), inset 0 0 8px rgba(255, 255, 255, 0.4);
        animation: moving-pulse 1s ease-in-out infinite;
      }

      .ts-piece {
        position: absolute;
        border-radius: 2px;
        background: rgba(120, 200, 230, 0.55);
        box-shadow: 0 0 6px rgba(103, 232, 249, 0.4);
        pointer-events: none;
      }

      .ts-transient {
        position: absolute;
        top: 42%;
        left: 50%;
        transform: translate(-50%, -50%);
        font-family: 'Press Start 2P', monospace;
        font-size: 15px;
        color: #ffe066;
        text-shadow: 0 0 10px rgba(255, 224, 102, 0.85);
        letter-spacing: 0.08em;
        white-space: nowrap;
        pointer-events: none;
        animation: transient-pop 0.9s ease-out both;

        &.is-over {
          color: #ff6b6b;
          text-shadow: 0 0 12px rgba(255, 107, 107, 0.9);
        }
      }
    }

    .ts-panel {
      margin-top: 10px;
      display: flex;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 6px 14px;
      color: #67e8f9;
      font-weight: 800;
      text-shadow: 0 0 6px rgba(17, 138, 178, 0.45);
      font-variant-numeric: tabular-nums;
    }

    .ts-message {
      margin-top: 14px;
      color: #d3f4ff;
      font-size: 0.85rem;
      animation: subtle-fade 2.8s ease-in-out infinite;
    }
  }

  .ts-help-panel {
    border: 1px solid rgba(17, 138, 178, 0.3);
    border-radius: 8px;
    padding: 12px;
    background: rgba(8, 30, 40, 0.5);

    .ts-help-title {
      margin: 0 0 6px;
      color: #67e8f9;
      font-size: 0.75rem;
      letter-spacing: 0.14rem;
      font-weight: 800;
    }

    .ts-help-text {
      margin: 0;
      color: #d3f4ff;
      font-size: 0.78rem;
      line-height: 1.6;
    }
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
    box-shadow: 0 0 0 1px rgba(17, 138, 178, 0.2), 0 0 24px rgba(17, 138, 178, 0.18);
  }

  50% {
    box-shadow: 0 0 0 1px rgba(103, 232, 249, 0.35), 0 0 40px rgba(17, 138, 178, 0.3);
  }
}

@keyframes moving-pulse {

  0%,
  100% {
    box-shadow: 0 0 14px rgba(103, 232, 249, 0.75), inset 0 0 8px rgba(255, 255, 255, 0.4);
  }

  50% {
    box-shadow: 0 0 22px rgba(103, 232, 249, 0.95), inset 0 0 10px rgba(255, 255, 255, 0.55);
  }
}

@keyframes transient-pop {
  0% {
    opacity: 0;
    transform: translate(-50%, -35%) scale(0.7);
  }

  25% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1.1);
  }

  100% {
    opacity: 0;
    transform: translate(-50%, -60%) scale(1);
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

@keyframes stage-shake {
  0% {
    transform: translate3d(0, 0, 0);
  }

  25% {
    transform: translate3d(-5px, 2px, 0);
  }

  50% {
    transform: translate3d(5px, -2px, 0);
  }

  75% {
    transform: translate3d(-3px, 2px, 0);
  }

  100% {
    transform: translate3d(0, 0, 0);
  }
}

@media (max-width: 980px) {
  .ts-page {
    .ts-shell {
      grid-template-columns: 1fr;
      padding: 16px;
    }

    .ts-side {
      flex-direction: row;
      flex-wrap: wrap;
      justify-content: center;
    }
  }
}
</style>
