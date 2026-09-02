<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useGameHistory } from '~/composables/useGameHistory'
import WhackAMoleEngine, {
  GAME_DURATION_SEC,
  HIT_BASE_SCORE,
  COMBO_THRESHOLDS,
  type WhackStatus,
  type HoleSnapshot
} from '~/utils/whackAMoleEngine'

/**
 * WHACK-A-MOLE（打地鼠）— 全專案第 21 款遊戲。
 *
 * 核心邏輯抽到 whackAMoleEngine.ts（純 TS，見該檔說明），頁面只以 reactive() 鏡像 engine 的
 * getSnapshot()，Logic / Rendering 分離（比照 2048／FROGGER／CONNECT 4 的既有寫法）。
 *
 * 三種計時器分工（見 design.md Decision 2）：
 *   - Game Timer（60 秒倒數）由「本頁面」的 setInterval 每秒呼叫 engine.tickGameTimer() 驅動；
 *   - Spawn Timer（下一隻地鼠何時出現）與 Lifetime Timer（當前地鼠何時消失）是「engine 內部」兩個
 *     互不耦合的獨立 setTimeout，非同步變更透過 engine 的 onChange 回呼通知本頁重新同步 snapshot。
 * Pause／離開頁面時，本頁清掉 Game Timer、engine 自行清掉兩個內部計時器，避免殘留誤觸發。
 */

const ACCENT = '#a0522d'
const CELL_SIZE = 96
const GAP = 14
/** 命中後浮字停留時間 */
const HIT_POP_MS = 520
/** 剩餘秒數進入警示色的門檻 */
const LOW_TIME_SEC = 10

const router = useRouter()
const engine = new WhackAMoleEngine()
const gameHistory = useGameHistory()

const state = reactive({
  status: 'idle' as WhackStatus,
  // 以 engine 初始快照（9 個空洞穴）初始化，讓 SSR 與 client hydration 的格數一致，避免 hydration mismatch
  holes: engine.getSnapshot().holes as HoleSnapshot[],
  score: 0,
  combo: 0,
  multiplier: 1,
  remainingSec: GAME_DURATION_SEC,
  hits: 0,
  spawns: 0,
  /** 命中回饋：該格短暫顯示 bonk 效果與 +分數浮字；null 表示目前無 */
  hitPop: null as { index: number; gained: number } | null,
  message: '按「START」開始打地鼠。',
  rewardMessage: '',
  waitingOverlayVisible: true,
  resultOverlayVisible: false,
  rateDialogOpen: false,
  ruleDialogOpen: false
})

const WHACK_RULE = {
  description:
    '限時 60 秒的打地鼠反應遊戲：地鼠隨機從 3×3 共 9 個洞穴中冒出，同一時間最多只有一隻。' +
    '在地鼠縮回前點擊／觸控牠所在的洞穴即可擊中得分；點到沒有地鼠的洞穴不加分，但會中斷連擊。' +
    '隨遊戲進行，地鼠的存活時間與出現間隔會逐漸縮短，越到後段越快。',
  scoreRule:
    `每擊中一隻地鼠得 ${HIT_BASE_SCORE} 分 × 當下連擊倍率（x1～x4）；連續命中累積 Combo 提高倍率，` +
    '一次 miss（點空洞穴或已消失的格子）會讓 Combo 歸零、倍率回到 x1，但分數不會被扣。',
  levelsTitle: 'COMBO 倍率',
  levels: [
    { level: 'x1', condition: `Combo ${COMBO_THRESHOLDS[0]}～${COMBO_THRESHOLDS[1]! - 1}` },
    { level: 'x2', condition: `Combo ${COMBO_THRESHOLDS[1]}～${COMBO_THRESHOLDS[2]! - 1}` },
    { level: 'x3', condition: `Combo ${COMBO_THRESHOLDS[2]}～${COMBO_THRESHOLDS[3]! - 1}` },
    { level: 'x4', condition: `Combo ${COMBO_THRESHOLDS[3]} 以上` }
  ],
  note: '時間到立即結束並結算分數。ESC / P 可暫停，暫停期間不消耗時間、地鼠也不會冒出或消失。'
}

/** Game Timer（60 秒倒數）：本頁持有的 setInterval，每秒推進 engine.tickGameTimer() */
let gameTimerId: ReturnType<typeof setInterval> | null = null
/** 命中浮字的清除計時器 */
let hitPopTimer: ReturnType<typeof setTimeout> | null = null

const stageStyle = computed(() => `--cell: ${CELL_SIZE}px; --gap: ${GAP}px;`)
const statusText = computed(() => {
  if (state.status === 'playing') return 'PLAYING'
  if (state.status === 'paused') return 'PAUSED'
  if (state.status === 'gameover') return 'GAME OVER'
  return 'READY'
})
const canPause = computed(() => state.status === 'playing')
const lowTime = computed(() => state.status === 'playing' && state.remainingSec <= LOW_TIME_SEC)
const accuracy = computed(() => {
  const attempts = state.hits + (state.spawns - state.hits)
  if (state.spawns === 0) return 0
  return Math.round((state.hits / state.spawns) * 100)
})

/** 私有工具方法：快照同步、計時器管理、格子外觀 */
const _handlers = {
  syncSnapshot: () => {
    const snap = engine.getSnapshot()
    state.holes = snap.holes
    state.score = snap.score
    state.combo = snap.combo
    state.multiplier = snap.multiplier
    state.remainingSec = snap.remainingSec
    state.status = snap.status
    state.hits = snap.hits
    state.spawns = snap.spawns
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
      const over = engine.tickGameTimer()
      _handlers.syncSnapshot()
      if (over) _actions.finishGame()
    }, 1000)
  },
  stopHitPopTimer: () => {
    if (hitPopTimer) {
      clearTimeout(hitPopTimer)
      hitPopTimer = null
    }
  },
  showHitPop: (index: number, gained: number) => {
    _handlers.stopHitPopTimer()
    state.hitPop = { index, gained }
    hitPopTimer = setTimeout(() => {
      state.hitPop = null
      hitPopTimer = null
    }, HIT_POP_MS)
  },
  holeClass: (hole: HoleSnapshot): string => {
    const classes: string[] = []
    if (hole.moleActive) classes.push('is-up')
    if (state.hitPop && state.hitPop.index === hole.index) classes.push('is-bonk')
    return classes.join(' ')
  }
}

const _actions = {
  recordHistory: async () => {
    state.rewardMessage = ''
    try {
      const result = await gameHistory.actions.record('whackAMole', 'WHACK-A-MOLE', {
        score: state.score,
        meta: {
          hits: state.hits,
          spawns: state.spawns,
          maxCombo: state.combo
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
    _handlers.stopHitPopTimer()
    engine.reset()
    _handlers.syncSnapshot()
    state.hitPop = null
    state.rewardMessage = ''
    state.waitingOverlayVisible = true
    state.resultOverlayVisible = false
    state.message = '按「START」開始打地鼠。'
  },
  startPlay: () => {
    _handlers.stopHitPopTimer()
    state.hitPop = null
    engine.start()
    _handlers.syncSnapshot()
    state.waitingOverlayVisible = false
    state.resultOverlayVisible = false
    state.message = '地鼠冒出來就打牠！'
    _handlers.startGameTimer()
  },
  clickHole: (index: number) => {
    if (state.status !== 'playing') return
    const result = engine.clickHole(index)
    _handlers.syncSnapshot()
    if (result.outcome === 'HIT') {
      _handlers.showHitPop(index, result.gained)
    }
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
    state.message = '地鼠冒出來就打牠！'
  },
  finishGame: () => {
    _handlers.stopGameTimer()
    _handlers.stopHitPopTimer()
    state.hitPop = null
    _handlers.syncSnapshot()
    state.resultOverlayVisible = true
    state.message = '時間到，遊戲結束。'
    _actions.recordHistory()
  },
  playAgain: () => {
    _actions.resetGame()
    _actions.startPlay()
  }
}

const click = {
  start: () => _actions.startPlay(),
  hole: (index: number) => _actions.clickHole(index),
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
  if (state.status === 'paused') _actions.resume()
  else if (state.status === 'playing') _actions.pause()
}

onMounted(() => {
  // engine 內部 Spawn／Lifetime 計時器觸發後透過此回呼通知本頁重新同步（見 engine 說明）
  engine.setOnChange(() => _handlers.syncSnapshot())
  _actions.resetGame()
  window.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  _handlers.stopGameTimer()
  _handlers.stopHitPopTimer()
  // 清掉 engine 內部兩個計時器，避免離開頁面後殘留 setTimeout 誤觸發
  engine.reset()
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <main class="wam-page" :class="`state-${state.status}`">
    <div class="wam-overlay" />

    <div v-if="state.waitingOverlayVisible" class="game-mask waiting-mask">
      <div class="mask-title">WELCOME</div>
      <p class="waiting-subtitle">WHACK-A-MOLE</p>
      <p class="waiting-hint">3×3 洞穴 · 限時 60 秒 · 快手擊中連擊加倍</p>
      <button class="wam-btn waiting-btn waiting-start" type="button" @click="click.start">START</button>
      <button class="wam-btn link waiting-btn" type="button" @click="click.openRateDialog">CONVERT</button>
      <button class="wam-btn link waiting-btn" type="button" @click="click.openRuleDialog">RULE</button>
    </div>

    <div v-if="state.status === 'paused'" class="game-mask pause-mask">
      <div class="mask-title">PAUSED</div>
      <div class="result-actions">
        <button class="wam-btn" type="button" @click="click.resume">RESUME</button>
        <button class="wam-btn" type="button" @click="click.restart">RESTART</button>
        <button class="wam-btn danger" type="button" @click="click.exit">EXIT</button>
      </div>
    </div>

    <div v-if="state.resultOverlayVisible" class="game-mask result-mask">
      <div class="mask-title">TIME UP</div>
      <div class="result-list">
        <div class="result-item"><span>SCORE</span><b>{{ state.score }}</b></div>
        <div class="result-item"><span>HITS</span><b>{{ state.hits }}</b></div>
        <div class="result-item"><span>SPAWNS</span><b>{{ state.spawns }}</b></div>
        <div class="result-item"><span>ACCURACY</span><b>{{ accuracy }}%</b></div>
      </div>
      <p v-if="state.rewardMessage" class="result-reward">{{ state.rewardMessage }}</p>
      <div class="result-actions">
        <button class="wam-btn" type="button" @click="click.again">AGAIN</button>
        <button class="wam-btn danger" type="button" @click="click.exit">EXIT</button>
      </div>
    </div>

    <GameRateDialog :visible="state.rateDialogOpen" game-key="whackAMole" game-name="WHACK-A-MOLE" :accent-color="ACCENT"
      @close="click.closeRateDialog" />
    <GameRuleDialog :visible="state.ruleDialogOpen" game-name="WHACK-A-MOLE" :accent-color="ACCENT" v-bind="WHACK_RULE"
      @close="click.closeRuleDialog" />

    <section class="wam-shell">
      <aside class="wam-side left">
        <button class="wam-btn" type="button" :disabled="!canPause" @click="click.pause">PAUSE</button>
        <button class="wam-btn" type="button" @click="click.restart">RESTART</button>
        <button class="wam-btn" type="button" @click="click.openRateDialog">CONVERT</button>
        <button class="wam-btn" type="button" @click="click.openRuleDialog">RULE</button>
      </aside>

      <section class="wam-center">
        <header class="wam-title-wrap">
          <h1 class="wam-title">WHACK-A-MOLE</h1>
          <p class="wam-status">{{ statusText }}</p>
        </header>

        <div class="wam-panel">
          <span>SCORE: {{ state.score }}</span>
          <span>COMBO x{{ state.multiplier }} ({{ state.combo }})</span>
          <span class="wam-time" :class="{ low: lowTime }">TIME: {{ state.remainingSec }}s</span>
        </div>

        <div class="wam-frame">
          <div class="wam-board" :style="stageStyle">
            <button v-for="hole in state.holes" :key="hole.index" type="button" class="wam-hole"
              :class="_handlers.holeClass(hole)" :disabled="state.status !== 'playing'" @click="click.hole(hole.index)">
              <span class="wam-hole-back" />
              <span class="wam-mole">
                <span class="wam-mole-body">
                  <span class="wam-eye left" />
                  <span class="wam-eye right" />
                  <span class="wam-nose" />
                </span>
              </span>
              <span class="wam-hole-front" />
              <span v-if="state.hitPop && state.hitPop.index === hole.index" class="wam-pop">+{{ state.hitPop.gained }}</span>
            </button>
          </div>
        </div>

        <p class="wam-message">{{ state.message }}</p>
      </section>

      <aside class="wam-side right">
        <div class="wam-help-panel">
          <p class="wam-help-title">HOW TO PLAY</p>
          <p class="wam-help-text">
            地鼠會從 9 個洞穴隨機冒出，同一時間最多一隻。趁牠縮回前點擊／觸控牠所在的洞穴即可擊中得分，
            連續命中會提高連擊倍率；點到空洞穴不加分但連擊歸零。越到後段地鼠越快，把握 60 秒衝高分。ESC / P 可暫停。
          </p>
          <div class="wam-legend">
            <span class="wam-legend-item"><i class="dot mole" />地鼠</span>
            <span class="wam-legend-item"><i class="dot hole" />空洞穴</span>
          </div>
        </div>
      </aside>
    </section>
  </main>
</template>

<style scoped lang="scss">
.wam-page {
  position: relative;
  min-height: 100vh;
  display: grid;
  place-items: center;
  background: radial-gradient(circle at top, #2a1a0c, #0a0603 62%);
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
    background: radial-gradient(circle at 22% 20%, rgba(160, 82, 45, 0.22), transparent 45%),
      radial-gradient(circle at 78% 72%, rgba(210, 140, 70, 0.12), transparent 42%);
    filter: blur(42px);
    animation: wam-ambient-drift 12s ease-in-out infinite alternate;
  }

  &::after {
    background: linear-gradient(115deg, rgba(160, 82, 45, 0.06), rgba(0, 0, 0, 0));
    animation: wam-ambient-pulse 4.6s ease-in-out infinite;
  }

  .wam-overlay {
    position: absolute;
    inset: 0;
    background-image: linear-gradient(rgba(160, 82, 45, 0.05) 1px, transparent 1px),
      linear-gradient(90deg, rgba(160, 82, 45, 0.05) 1px, transparent 1px);
    background-size: 28px 28px;
    pointer-events: none;
    z-index: 0;
    animation: wam-grid-drift 14s linear infinite;
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
      color: #c9803f;
      font-size: clamp(2rem, 8vw, 4rem);
      letter-spacing: 0.25rem;
      font-weight: 900;
      text-shadow: 0 0 18px rgba(160, 82, 45, 0.5);
    }

    &.waiting-mask {
      background: rgba(0, 0, 0, 0.88);

      .waiting-subtitle {
        margin: 0;
        color: #e0a56a;
        letter-spacing: 0.3rem;
        font-size: 0.95rem;
      }

      .waiting-hint {
        margin: 0;
        color: #a9743f;
        font-size: 0.78rem;
        letter-spacing: 0.04em;
      }

      .waiting-btn {
        width: 220px;
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
      border: 1px solid rgba(160, 82, 45, 0.4);
      background: rgba(40, 24, 10, 0.65);
      color: #f0d8bd;
      padding: 8px 10px;
    }

    .result-reward {
      margin: 8px 0 0;
      color: #ffd9a8;
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

  .wam-shell {
    position: relative;
    z-index: 1;
    width: min(1100px, 100%);
    padding: 24px;
    display: grid;
    grid-template-columns: 180px 1fr 200px;
    gap: 20px;
    align-items: start;
  }

  .wam-side {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding-top: 60px;
  }

  .wam-btn {
    position: relative;
    overflow: hidden;
    border: 1px solid rgba(160, 82, 45, 0.45);
    border-radius: 6px;
    padding: 10px 12px;
    background: rgba(34, 20, 8, 0.75);
    color: #d79355;
    font-weight: 700;
    letter-spacing: 0.5px;
    cursor: pointer;
    transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;

    &::after {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(105deg, transparent 35%, rgba(255, 210, 170, 0.22) 50%, transparent 65%);
      transform: translateX(-150%);
      transition: transform 0.35s ease;
      pointer-events: none;
    }

    &:hover:not(:disabled) {
      border-color: #a0522d;
      box-shadow: 0 0 12px rgba(160, 82, 45, 0.4);
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
      border-color: rgba(200, 80, 60, 0.5);
      color: #e08a72;
    }
  }

  .wam-center {
    text-align: center;

    .wam-title-wrap {
      margin-bottom: 8px;
    }

    .wam-title {
      margin: 0;
      color: #c9803f;
      font-size: clamp(1.5rem, 4.6vw, 2.7rem);
      letter-spacing: 0.12rem;
      font-weight: 900;
      text-shadow: 0 0 14px rgba(160, 82, 45, 0.45);
    }

    .wam-status {
      margin: 2px 0 0;
      color: #e0a56a;
      font-size: 0.9rem;
      letter-spacing: 0.2rem;
    }

    .wam-panel {
      margin: 10px auto 0;
      display: flex;
      justify-content: center;
      flex-wrap: wrap;
      gap: 8px 16px;
      color: #d79355;
      font-weight: 800;
      font-size: 0.82rem;
      text-shadow: 0 0 6px rgba(160, 82, 45, 0.45);
      font-variant-numeric: tabular-nums;

      .wam-time.low {
        color: #ff6b5b;
        text-shadow: 0 0 8px rgba(255, 107, 91, 0.6);
        animation: wam-time-flash 0.9s ease-in-out infinite;
      }
    }

    .wam-frame {
      width: fit-content;
      margin: 16px auto 0;
      padding: 16px;
      background: #23150a;
      border: 8px solid #3a2412;
      border-radius: 16px;
      box-shadow: 0 0 0 1px rgba(160, 82, 45, 0.18), 0 0 26px rgba(90, 55, 25, 0.4);
    }

    .wam-board {
      display: grid;
      grid-template-columns: repeat(3, var(--cell));
      gap: var(--gap);
      width: fit-content;
    }

    .wam-hole {
      position: relative;
      width: var(--cell);
      height: var(--cell);
      padding: 0;
      border: none;
      background: transparent;
      cursor: pointer;
      overflow: hidden;
      border-radius: 14px;

      &:disabled {
        cursor: default;
      }

      // 洞穴底（後緣，地鼠從這後面冒出來）
      .wam-hole-back {
        position: absolute;
        left: 8%;
        right: 8%;
        bottom: 12%;
        height: 46%;
        border-radius: 50%;
        background: radial-gradient(ellipse at 50% 35%, #1c0f05 0 60%, #2c1a0b 100%);
        box-shadow: inset 0 6px 10px rgba(0, 0, 0, 0.65);
      }

      // 洞穴前緣（土堆，蓋住地鼠下半身，做出「從洞裡冒出」的層次）
      .wam-hole-front {
        position: absolute;
        left: 2%;
        right: 2%;
        bottom: 6%;
        height: 34%;
        border-radius: 50%;
        background: linear-gradient(180deg, #6b4423 0%, #4a2e15 100%);
        box-shadow: inset 0 3px 4px rgba(255, 200, 150, 0.15), 0 4px 6px rgba(0, 0, 0, 0.4);
        z-index: 3;
      }

      // 地鼠：預設縮在洞裡（下移＋縮小），is-up 時彈出
      .wam-mole {
        position: absolute;
        left: 50%;
        bottom: 16%;
        width: 62%;
        height: 62%;
        transform: translate(-50%, 68%) scale(0.7);
        opacity: 0;
        transition: transform 0.14s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.12s ease;
        z-index: 2;
      }

      .wam-mole-body {
        position: absolute;
        inset: 0;
        border-radius: 50% 50% 45% 45%;
        background: radial-gradient(circle at 50% 32%, #b9713f 0 55%, #8a4f28 100%);
        box-shadow: inset 0 -6px 8px rgba(0, 0, 0, 0.28), 0 3px 6px rgba(0, 0, 0, 0.35);

        // 淺色口鼻區
        &::after {
          content: '';
          position: absolute;
          left: 50%;
          bottom: 16%;
          width: 52%;
          height: 40%;
          transform: translateX(-50%);
          border-radius: 50%;
          background: radial-gradient(circle at 50% 40%, #e8c39a 0 60%, #d3a878 100%);
        }
      }

      .wam-eye {
        position: absolute;
        top: 30%;
        width: 13%;
        height: 15%;
        border-radius: 50%;
        background: #241206;
        z-index: 2;

        &.left {
          left: 28%;
        }

        &.right {
          right: 28%;
        }
      }

      .wam-nose {
        position: absolute;
        left: 50%;
        top: 50%;
        width: 15%;
        height: 12%;
        transform: translateX(-50%);
        border-radius: 50%;
        background: #6b2f1c;
        z-index: 3;
      }

      &.is-up .wam-mole {
        transform: translate(-50%, 0) scale(1);
        opacity: 1;
      }

      // 命中回饋：地鼠被打時的短暫彈壓效果
      &.is-bonk .wam-mole {
        animation: wam-bonk 0.24s ease-out;
      }

      .wam-pop {
        position: absolute;
        left: 50%;
        top: 18%;
        transform: translateX(-50%);
        color: #ffe0b0;
        font-weight: 900;
        font-size: 1.05rem;
        text-shadow: 0 0 8px rgba(255, 180, 120, 0.8);
        pointer-events: none;
        z-index: 5;
        animation: wam-pop-float 0.52s ease-out both;
      }

      &:hover:not(:disabled) .wam-hole-front {
        filter: brightness(1.08);
      }
    }
  }

  .wam-message {
    margin-top: 16px;
    color: #e0a56a;
    font-size: 0.85rem;
    min-height: 1.2em;
  }

  .wam-help-panel {
    border: 1px solid rgba(160, 82, 45, 0.3);
    border-radius: 8px;
    padding: 12px;
    background: rgba(34, 20, 8, 0.5);

    .wam-help-title {
      margin: 0 0 6px;
      color: #c9803f;
      font-size: 0.75rem;
      letter-spacing: 0.14rem;
      font-weight: 800;
    }

    .wam-help-text {
      margin: 0;
      color: #e0a56a;
      font-size: 0.78rem;
      line-height: 1.6;
    }

    .wam-legend {
      margin-top: 10px;
      display: flex;
      gap: 16px;

      .wam-legend-item {
        display: flex;
        align-items: center;
        gap: 6px;
        color: #e8b980;
        font-size: 0.72rem;
        letter-spacing: 0.05em;
      }

      .dot {
        width: 14px;
        height: 14px;
        border-radius: 50%;

        &.mole {
          background: radial-gradient(circle at 40% 32%, #b9713f, #8a4f28 70%);
        }

        &.hole {
          background: radial-gradient(circle at 50% 35%, #1c0f05, #2c1a0b);
        }
      }
    }
  }
}

@keyframes wam-bonk {
  0% {
    transform: translate(-50%, 0) scale(1);
  }

  50% {
    transform: translate(-50%, 12%) scale(1.12, 0.8);
  }

  100% {
    transform: translate(-50%, 0) scale(1);
  }
}

@keyframes wam-pop-float {
  0% {
    opacity: 0;
    transform: translate(-50%, 0) scale(0.8);
  }

  30% {
    opacity: 1;
    transform: translate(-50%, -20%) scale(1.1);
  }

  100% {
    opacity: 0;
    transform: translate(-50%, -80%) scale(1);
  }
}

@keyframes wam-time-flash {

  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0.5;
  }
}

@keyframes wam-ambient-drift {
  0% {
    transform: translate(-1.5%, -1%) scale(1);
  }

  100% {
    transform: translate(1.5%, 1%) scale(1.06);
  }
}

@keyframes wam-ambient-pulse {

  0%,
  100% {
    opacity: 0.35;
  }

  50% {
    opacity: 0.75;
  }
}

@keyframes wam-grid-drift {
  0% {
    transform: translate(0, 0);
  }

  100% {
    transform: translate(14px, 14px);
  }
}

@media (max-width: 980px) {
  .wam-page {
    .wam-shell {
      grid-template-columns: 1fr;
      padding: 16px;
    }

    .wam-side {
      flex-direction: row;
      flex-wrap: wrap;
      justify-content: center;
      padding-top: 0;
    }
  }
}
</style>
