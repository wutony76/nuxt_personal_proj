<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useGameHistory } from '~/composables/useGameHistory'
import Game2048Engine, {
  BOARD_SIZE_2048,
  SWIPE_THRESHOLD,
  maxTileValue,
  type Board2048,
  type Direction
} from '~/utils/game2048Engine'

type Page2048Status = 'waiting' | 'playing' | 'pause' | 'gameover'
type FlatTile = { id: number; value: number; r: number; c: number }

const CELL_SIZE = 76
const CELL_GAP = 10
const ACCENT = '#f4a261'

const router = useRouter()
const engine = new Game2048Engine()
const gameHistory = useGameHistory()

/** 棋盤容器 ref，供 Touch Swipe 的 setPointerCapture 使用 */
const boardRef = ref<HTMLElement | null>(null)

const state = reactive({
  status: 'waiting' as Page2048Status,
  /** engine snapshot 的鏡像；頁面只讀，不直接改動棋盤 */
  board: [] as Board2048,
  score: 0,
  moves: 0,
  maxTile: 0,
  won: false,
  /** 首次達成 2048 的一次性勝利提示（見 design.md Decision 7），顯示期間停用輸入 */
  winBannerVisible: false,
  winBannerShown: false,
  waitingOverlayVisible: true,
  resultOverlayVisible: false,
  rewardMessage: '',
  message: '用方向鍵／WASD 或滑動棋盤移動方塊，相同數字相撞即合併。',
  rateDialogOpen: false,
  ruleDialogOpen: false
})

const G2048_RULE = {
  description:
    '經典 2048：用方向鍵／WASD，或在棋盤上滑動手勢移動所有方塊，兩個相同數字的方塊相撞時會合併成加倍的新方塊。' +
    '每次有效移動後，棋盤會在隨機空格出現一個新的 2 或 4。合成出 2048 方塊即獲勝，但你可以選擇繼續挑戰更高分。',
  scoreRule:
    '每次合併會把「合併後的新數值」加進分數（例如兩個 4 合成 8，就 +8 分）；' +
    'SCORE ＝ 本局所有合併數值的總和，能合成越大的方塊、分數越高。',
  levels: [
    { level: '合併', condition: '相同數字相撞 → 合併加倍，一次移動每格只合併一次（[2,2,2,2] → [4,4]）' },
    { level: '新方塊', condition: '有效移動後隨機空格出現：90% 為 2、10% 為 4' },
    { level: '勝利', condition: '出現 2048 方塊 → 顯示勝利提示，可繼續或重新開始' },
    { level: '結束', condition: '棋盤填滿且四方向皆無法移動或合併 → GAME OVER' }
  ],
  levelsTitle: '玩法規則',
  note: '達成 2048 後可繼續挑戰 4096、8192；暫停或離開頁面不會結算，唯有真正無法移動時才記錄分數。'
}

/** 起手方向鍵起點座標；null 表示尚未按下（Touch Swipe 用） */
let pointerStart: { x: number; y: number } | null = null

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
const canPause = computed(() => state.status === 'playing' && !state.winBannerVisible)
/** Best Score 直接重用 useGameHistory 的 statsByGame（見 design.md Decision 5），並與本局分數取大值即時反映 */
const bestScore = computed(() => Math.max(gameHistory.statsByGame.value['2048']?.best ?? 0, state.score))
const stageStyle = computed(() => `--cell: ${CELL_SIZE}px; --gap: ${CELL_GAP}px;`)
const boardStyle = computed(
  () => `grid-template-columns: repeat(${BOARD_SIZE_2048}, var(--cell)); grid-template-rows: repeat(${BOARD_SIZE_2048}, var(--cell));`
)
const slotCount = computed(() => BOARD_SIZE_2048 * BOARD_SIZE_2048)
/** 攤平棋盤成一維 Tile 清單（只含非空格），供 v-for 以 tile.id 為 key 渲染（見 design.md Decision 1） */
const flatCells = computed<FlatTile[]>(() => {
  const out: FlatTile[] = []
  state.board.forEach((row, r) => {
    row.forEach((tile, c) => {
      if (tile) out.push({ id: tile.id, value: tile.value, r, c })
    })
  })
  return out
})

/** 私有工具方法：snapshot 同步、Tile 外觀對照 */
const _handlers = {
  syncFromEngine: () => {
    const snap = engine.getSnapshot()
    state.board = snap.board
    state.score = snap.score
    state.won = snap.won
    state.maxTile = maxTileValue(snap.board)
    return snap
  },
  /** 依數值套用底色 class（2/4 淺色、8~1024 漸深、2048 主題色、超過再更亮）＋依位數縮放字級 */
  tileClass: (value: number): string => {
    const tone = value <= 2048 ? `tile-${value}` : 'tile-super'
    const digits = String(value).length
    const size = digits >= 4 ? 'is-d4' : digits === 3 ? 'is-d3' : 'is-d2'
    return `${tone} ${size}`
  },
  tileStyle: (tile: FlatTile): Record<string, string> => ({
    gridColumnStart: String(tile.c + 1),
    gridRowStart: String(tile.r + 1)
  })
}

const _actions = {
  recordHistory: async () => {
    state.rewardMessage = ''
    try {
      const result = await gameHistory.actions.record('2048', '2048', {
        score: state.score,
        meta: {
          maxTile: state.maxTile,
          moves: state.moves,
          won: state.won
        }
      })
      if (result.coinReward > 0) {
        state.rewardMessage = result.coinCapped ? `+${result.coinReward} coin（已達今日上限）` : `+${result.coinReward} coin`
      }
    } catch {
      // 紀錄寫入失敗不影響遊戲本身，靜默略過
    }
  },
  /** 開新局：重置 engine 與所有對局狀態，直接進入 playing（供 START／RESTART／AGAIN 共用，見 spec Restart 規格） */
  beginNewGame: () => {
    engine.reset()
    _handlers.syncFromEngine()
    state.score = 0
    state.moves = 0
    state.won = false
    state.winBannerShown = false
    state.winBannerVisible = false
    state.waitingOverlayVisible = false
    state.resultOverlayVisible = false
    state.rewardMessage = ''
    state.status = 'playing'
    state.message = '遊戲進行中...'
  },
  /** 回到初始等待畫面（onMounted 用），完整重置但停在 waiting */
  resetToWaiting: () => {
    engine.reset()
    _handlers.syncFromEngine()
    state.score = 0
    state.moves = 0
    state.won = false
    state.winBannerShown = false
    state.winBannerVisible = false
    state.status = 'waiting'
    state.waitingOverlayVisible = true
    state.resultOverlayVisible = false
    state.rewardMessage = ''
    state.message = '用方向鍵／WASD 或滑動棋盤移動方塊，相同數字相撞即合併。'
  },
  finishGame: () => {
    state.status = 'gameover'
    state.winBannerVisible = false
    state.resultOverlayVisible = true
    state.message = `無法再移動，遊戲結束（最大方塊 ${state.maxTile}）。`
    _actions.recordHistory()
  },
  pauseGame: () => {
    if (!canPause.value) return
    state.status = 'pause'
    state.message = '已暫停'
  },
  resumeGame: () => {
    if (state.status !== 'pause') return
    state.status = 'playing'
    state.message = '遊戲進行中...'
  },
  continueAfterWin: () => {
    state.winBannerVisible = false
    state.message = '繼續挑戰更高分！'
  },
  /** 三種輸入來源（Keyboard／Swipe）共用的移動入口，統一守衛與結算流程 */
  doMove: (direction: Direction) => {
    if (state.status !== 'playing' || state.winBannerVisible) return
    const moved = engine.applyMove(direction)
    if (!moved) {
      // 無效移動：不新增 Tile、不消耗回合（見 design.md Decision 3），給輕微提示即可
      state.message = '該方向沒有可移動或合併的方塊'
      return
    }
    const snap = _handlers.syncFromEngine()
    state.moves += 1
    state.message = '遊戲進行中...'
    if (snap.status === 'gameover') {
      _actions.finishGame()
      return
    }
    if (snap.won && !state.winBannerShown) {
      state.winBannerShown = true
      state.winBannerVisible = true
      state.message = '達成 2048！'
    }
  },
  onKeydown: (event: KeyboardEvent) => {
    const key = event.key.toLowerCase()
    // ESC／P：暫停 ↔ 繼續（見 tasks 6.10）
    if (key === 'escape' || key === 'p') {
      if (state.status === 'playing') _actions.pauseGame()
      else if (state.status === 'pause') _actions.resumeGame()
      return
    }
    if (state.status !== 'playing' || state.winBannerVisible) return
    let direction: Direction | null = null
    if (key === 'arrowup' || key === 'w') direction = 'up'
    else if (key === 'arrowdown' || key === 's') direction = 'down'
    else if (key === 'arrowleft' || key === 'a') direction = 'left'
    else if (key === 'arrowright' || key === 'd') direction = 'right'
    if (!direction) return
    event.preventDefault()
    _actions.doMove(direction)
  },
  /** Touch Swipe：pointerdown 記錄起點＋setPointerCapture（見 design.md Decision 4） */
  handlePointerDown: (event: PointerEvent) => {
    if (state.status !== 'playing' || state.winBannerVisible) return
    pointerStart = { x: event.clientX, y: event.clientY }
    boardRef.value?.setPointerCapture(event.pointerId)
  },
  /** pointerup 計算與起點的座標差量，取較大軸判斷方向，差量不足閾值視為點按不觸發 */
  handlePointerUp: (event: PointerEvent) => {
    if (!pointerStart) return
    const dx = event.clientX - pointerStart.x
    const dy = event.clientY - pointerStart.y
    pointerStart = null
    if (state.status !== 'playing' || state.winBannerVisible) return
    const absX = Math.abs(dx)
    const absY = Math.abs(dy)
    if (Math.max(absX, absY) < SWIPE_THRESHOLD) return
    const direction: Direction = absX > absY ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up'
    _actions.doMove(direction)
  }
}

const click = {
  start: () => _actions.beginNewGame(),
  restart: () => _actions.beginNewGame(),
  again: () => _actions.beginNewGame(),
  pause: () => _actions.pauseGame(),
  resume: () => _actions.resumeGame(),
  continueWin: () => _actions.continueAfterWin(),
  exit: () => router.replace('/game-hall'),
  pointerDown: (event: PointerEvent) => _actions.handlePointerDown(event),
  pointerUp: (event: PointerEvent) => _actions.handlePointerUp(event),
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
  // 載入歷史紀錄以取得 Best Score（statsByGame），失敗不影響遊戲
  gameHistory.ensureLoaded().catch(() => undefined)
  _actions.resetToWaiting()
  window.addEventListener('keydown', _actions.onKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', _actions.onKeydown)
})
</script>

<template>
  <main class="g2048-page" :class="`state-${state.status}`">
    <div class="g2048-overlay" />

    <div v-if="state.waitingOverlayVisible" class="game-mask waiting-mask">
      <div class="mask-title">WELCOME</div>
      <p class="waiting-subtitle">2048</p>
      <p class="waiting-hint">方向鍵／WASD 或滑動棋盤 · 相同數字合併加倍 · 合成 2048 獲勝</p>
      <button class="g2048-btn waiting-btn waiting-start" type="button" @click="click.start">START</button>
      <button class="g2048-btn link waiting-btn" type="button" @click="click.openRateDialog">CONVERT</button>
      <button class="g2048-btn link waiting-btn" type="button" @click="click.openRuleDialog">RULE</button>
    </div>

    <div v-if="state.winBannerVisible" class="game-mask win-mask">
      <div class="mask-title win">YOU WIN</div>
      <p class="win-subtitle">成功合成 2048！可以繼續挑戰更高分，或重新開始。</p>
      <div class="result-actions">
        <button class="g2048-btn" type="button" @click="click.continueWin">CONTINUE</button>
        <button class="g2048-btn" type="button" @click="click.restart">RESTART</button>
      </div>
    </div>

    <div v-if="state.status === 'pause'" class="game-mask pause-mask">
      <div class="mask-title">PAUSED</div>
      <div class="result-actions">
        <button class="g2048-btn" type="button" @click="click.resume">RESUME</button>
        <button class="g2048-btn" type="button" @click="click.restart">RESTART</button>
        <button class="g2048-btn danger" type="button" @click="click.exit">EXIT</button>
      </div>
    </div>

    <div v-if="state.resultOverlayVisible" class="game-mask result-mask">
      <div class="mask-title" :class="{ win: state.won }">{{ state.won ? 'GAME OVER · 2048!' : 'GAME OVER' }}</div>
      <div class="result-list">
        <div class="result-item"><span>SCORE</span><b>{{ state.score }}</b></div>
        <div class="result-item"><span>BEST</span><b>{{ bestScore }}</b></div>
        <div class="result-item"><span>MAX TILE</span><b>{{ state.maxTile }}</b></div>
        <div class="result-item"><span>MOVES</span><b>{{ state.moves }}</b></div>
      </div>
      <p v-if="state.rewardMessage" class="result-reward">{{ state.rewardMessage }}</p>
      <div class="result-actions">
        <button class="g2048-btn" type="button" @click="click.again">AGAIN</button>
        <button class="g2048-btn danger" type="button" @click="click.exit">EXIT</button>
      </div>
    </div>

    <GameRateDialog :visible="state.rateDialogOpen" game-key="2048" game-name="2048" :accent-color="ACCENT"
      @close="click.closeRateDialog" />
    <GameRuleDialog :visible="state.ruleDialogOpen" game-name="2048" :accent-color="ACCENT" v-bind="G2048_RULE"
      @close="click.closeRuleDialog" />

    <section class="g2048-shell">
      <aside class="g2048-side left">
        <button class="g2048-btn" type="button" :disabled="!canPause" @click="click.pause">PAUSE</button>
        <button class="g2048-btn" type="button" @click="click.restart">RESTART</button>
        <button class="g2048-btn" type="button" @click="click.openRateDialog">CONVERT</button>
        <button class="g2048-btn" type="button" @click="click.openRuleDialog">RULE</button>
      </aside>

      <section class="g2048-center">
        <header class="g2048-title-wrap">
          <h1 class="g2048-title">2048</h1>
          <p class="g2048-status" :class="statusClass">{{ statusText }}</p>
        </header>

        <div class="g2048-frame">
          <div class="g2048-stage" :style="stageStyle">
            <div ref="boardRef" class="g2048-board" :style="boardStyle" @pointerdown="click.pointerDown"
              @pointerup="click.pointerUp" @pointercancel="click.pointerUp">
              <div v-for="n in slotCount" :key="`slot-${n}`" class="g2048-slot" />
              <div v-for="tile in flatCells" :key="tile.id" class="g2048-tile" :class="_handlers.tileClass(tile.value)"
                :style="_handlers.tileStyle(tile)">
                {{ tile.value }}
              </div>
            </div>
            <div v-if="state.status === 'pause'" class="g2048-board-veil">PAUSED</div>
          </div>
          <div class="g2048-panel">
            <span>SCORE: {{ state.score }}</span>
            <span>BEST: {{ bestScore }}</span>
            <span>MAX: {{ state.maxTile }}</span>
            <span>MOVES: {{ state.moves }}</span>
          </div>
        </div>

        <p class="g2048-message">{{ state.message }}</p>
      </section>

      <aside class="g2048-side right">
        <div class="g2048-help-panel">
          <p class="g2048-help-title">HOW TO PLAY</p>
          <p class="g2048-help-text">
            方向鍵／WASD 或在棋盤上滑動來移動所有方塊，相同數字相撞即合併成加倍的新方塊，
            一次移動每格只合併一次。每次有效移動後隨機出現一個 2 或 4，合成 2048 即獲勝但可續玩，
            棋盤填滿且四方向皆無法移動時結束。ESC／P 可暫停。
          </p>
        </div>
      </aside>
    </section>
  </main>
</template>

<style scoped lang="scss">
.g2048-page {
  --accent: #f4a261;
  position: relative;
  min-height: 100vh;
  display: grid;
  place-items: center;
  background: radial-gradient(circle at top, #1a1206, #060402 60%);
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
    background: radial-gradient(circle at 20% 20%, rgba(244, 162, 97, 0.16), transparent 45%),
      radial-gradient(circle at 80% 70%, rgba(255, 209, 102, 0.1), transparent 40%);
    filter: blur(40px);
    animation: ambient-drift 12s ease-in-out infinite alternate;
  }

  &::after {
    background: linear-gradient(115deg, rgba(244, 162, 97, 0.05), rgba(0, 0, 0, 0));
    animation: ambient-pulse 4.6s ease-in-out infinite;
  }

  .g2048-overlay {
    position: absolute;
    inset: 0;
    background-image: linear-gradient(rgba(244, 162, 97, 0.05) 1px, transparent 1px),
      linear-gradient(90deg, rgba(244, 162, 97, 0.05) 1px, transparent 1px);
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
      text-shadow: 0 0 18px rgba(244, 162, 97, 0.5);

      &.win {
        color: #ffd166;
      }
    }

    &.waiting-mask {
      background: rgba(0, 0, 0, 0.88);

      .waiting-subtitle {
        margin: 0;
        color: #ffd8a8;
        letter-spacing: 0.3rem;
        font-size: 1.05rem;
        font-weight: 800;
      }

      .waiting-hint {
        margin: 0;
        color: #d6a066;
        font-size: 0.78rem;
        letter-spacing: 0.04em;
      }

      .waiting-btn {
        width: 200px;
      }
    }

    &.win-mask {
      background: rgba(0, 0, 0, 0.72);

      .win-subtitle {
        margin: 0;
        color: #ffe1b3;
        font-size: 0.85rem;
        letter-spacing: 0.04em;
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
      border: 1px solid rgba(244, 162, 97, 0.4);
      background: rgba(36, 24, 10, 0.65);
      color: #ffe6c9;
      padding: 8px 10px;
      font-variant-numeric: tabular-nums;
    }

    .result-reward {
      margin: 8px 0 0;
      color: #ffdca6;
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

  .g2048-shell {
    position: relative;
    z-index: 1;
    width: min(1100px, 100%);
    padding: 24px;
    display: grid;
    grid-template-columns: 180px 1fr 180px;
    gap: 20px;
    align-items: center;
  }

  .g2048-side {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .g2048-btn {
    position: relative;
    overflow: hidden;
    border: 1px solid rgba(244, 162, 97, 0.4);
    border-radius: 6px;
    padding: 10px 12px;
    background: rgba(36, 24, 10, 0.75);
    color: var(--accent);
    font-weight: 700;
    letter-spacing: 0.5px;
    cursor: pointer;
    transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;

    &::after {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(105deg, transparent 35%, rgba(255, 224, 178, 0.25) 50%, transparent 65%);
      transform: translateX(-150%);
      transition: transform 0.35s ease;
      pointer-events: none;
    }

    &:hover {
      border-color: var(--accent);
      box-shadow: 0 0 12px rgba(244, 162, 97, 0.35);
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

  .g2048-center {
    text-align: center;

    .g2048-title-wrap {
      margin-bottom: 8px;
    }

    .g2048-title {
      margin: 0;
      color: var(--accent);
      font-size: clamp(1.7rem, 5vw, 3rem);
      letter-spacing: 0.14rem;
      font-weight: 900;
      text-shadow: 0 0 14px rgba(244, 162, 97, 0.45);
      animation: title-float 2.6s ease-in-out infinite;
    }

    .g2048-status {
      margin: 2px 0 0;
      color: #ffd8a8;
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

    .g2048-frame {
      width: fit-content;
      margin: 12px auto 0;
      padding: 14px;
      background: #1a1206;
      border: 10px solid #5c3a12;
      border-radius: 18px;
      box-shadow: 0 0 0 1px rgba(244, 162, 97, 0.2), 0 0 24px rgba(244, 162, 97, 0.14);
      animation: frame-glow 5.4s ease-in-out infinite;
    }

    .g2048-stage {
      position: relative;
      box-sizing: content-box;
      width: fit-content;
      padding: 10px;
      background: #100a04;
      border: 2px solid #241708;
      border-radius: 10px;
    }

    .g2048-board {
      position: relative;
      display: grid;
      gap: var(--gap);
      width: fit-content;
      /* 觸控裝置上滑動棋盤時，阻止瀏覽器原生捲動搶走手勢（見 design.md Risks） */
      touch-action: none;
      user-select: none;
      -webkit-user-select: none;
    }

    .g2048-slot {
      width: var(--cell);
      height: var(--cell);
      border-radius: 8px;
      background: rgba(244, 162, 97, 0.08);
      border: 1px solid rgba(244, 162, 97, 0.12);
    }

    .g2048-tile {
      /* 疊在對應的背景 slot 上（同一個 grid，透過 grid-column/row-start 明確定位） */
      z-index: 1;
      align-self: stretch;
      justify-self: stretch;
      display: grid;
      place-items: center;
      border-radius: 8px;
      font-weight: 800;
      line-height: 1;
      color: #3a2408;
      font-variant-numeric: tabular-nums;
      box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.12);

      &.is-d2 {
        font-size: 30px;
      }

      &.is-d3 {
        font-size: 24px;
      }

      &.is-d4 {
        font-size: 19px;
      }

      &.tile-2 {
        background: #efe4d0;
        color: #6b5636;
      }

      &.tile-4 {
        background: #ecd8b0;
        color: #6b5636;
      }

      &.tile-8 {
        background: #f0b171;
        color: #3a2408;
      }

      &.tile-16 {
        background: #f0965a;
        color: #fff4e6;
      }

      &.tile-32 {
        background: #ef7d52;
        color: #fff4e6;
      }

      &.tile-64 {
        background: #ee5f3a;
        color: #fff4e6;
      }

      &.tile-128 {
        background: #edcf72;
        color: #4a3410;
        box-shadow: 0 0 14px rgba(237, 207, 114, 0.5);
      }

      &.tile-256 {
        background: #edcb5f;
        color: #4a3410;
        box-shadow: 0 0 16px rgba(237, 203, 95, 0.55);
      }

      &.tile-512 {
        background: #edc74c;
        color: #4a3410;
        box-shadow: 0 0 18px rgba(237, 199, 76, 0.6);
      }

      &.tile-1024 {
        background: #edc33a;
        color: #3a2a08;
        box-shadow: 0 0 20px rgba(237, 195, 58, 0.65);
      }

      &.tile-2048 {
        background: var(--accent);
        color: #2a1804;
        box-shadow: 0 0 26px rgba(244, 162, 97, 0.85);
      }

      &.tile-super {
        background: #ffd166;
        color: #2a1804;
        box-shadow: 0 0 30px rgba(255, 209, 102, 0.9);
      }
    }

    .g2048-board-veil {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      background: rgba(16, 10, 4, 0.72);
      color: #ffd8a8;
      font-weight: 900;
      letter-spacing: 0.3rem;
      border-radius: 10px;
      z-index: 2;
    }

    .g2048-panel {
      margin-top: 12px;
      display: flex;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 8px 16px;
      color: var(--accent);
      font-weight: 800;
      text-shadow: 0 0 6px rgba(244, 162, 97, 0.45);
      /* 數字等寬，避免變動時外層 fit-content 寬度跳動 */
      font-variant-numeric: tabular-nums;
    }

    .g2048-message {
      margin-top: 14px;
      color: #ffd8a8;
      font-size: 0.85rem;
      animation: subtle-fade 2.8s ease-in-out infinite;
    }
  }

  .g2048-help-panel {
    border: 1px solid rgba(244, 162, 97, 0.3);
    border-radius: 8px;
    padding: 12px;
    background: rgba(36, 24, 10, 0.5);

    .g2048-help-title {
      margin: 0 0 6px;
      color: var(--accent);
      font-size: 0.75rem;
      letter-spacing: 0.14rem;
      font-weight: 800;
    }

    .g2048-help-text {
      margin: 0;
      color: #ffd8a8;
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
    box-shadow: 0 0 0 1px rgba(244, 162, 97, 0.2), 0 0 24px rgba(244, 162, 97, 0.14);
  }

  50% {
    box-shadow: 0 0 0 1px rgba(255, 209, 102, 0.35), 0 0 40px rgba(244, 162, 97, 0.28);
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
  .g2048-page {
    .g2048-shell {
      grid-template-columns: 1fr;
      padding: 16px;
    }

    .g2048-side {
      flex-direction: row;
      flex-wrap: wrap;
      justify-content: center;
    }
  }
}
</style>
