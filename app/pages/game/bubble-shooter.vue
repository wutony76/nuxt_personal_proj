<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useGameHistory } from '~/composables/useGameHistory'
import BubbleShooterEngine, {
  ROWS,
  COLS,
  ROW_HEIGHT_RATIO,
  BUBBLE_DIAMETER,
  MATCH_MIN,
  MATCH3_SCORE,
  MATCH4_SCORE,
  MATCH5_SCORE,
  DROP_SCORE_PER_BUBBLE,
  SHOTS_PER_NEW_ROW,
  cellCenterX,
  cellCenterY,
  type BubbleShooterStatus,
  type BubbleColor,
  type GridCell,
  type FlyingBubble
} from '~/utils/bubbleShooterEngine'

/**
 * BUBBLE SHOOTER — 全專案第 29 款遊戲。
 *
 * 核心邏輯抽到 bubbleShooterEngine.ts（純 TS，交錯偏移 Grid + flood-fill 消除/掉落），頁面只以
 * reactive() 鏡像 engine 的 getSnapshot()，Logic / Rendering 分離。DOM 動畫比照 space-invaders／
 * breakout 既有慣例：setInterval 固定 tick + reactive 陣列/物件 + `left/top` px 逐格更新，不用 Canvas。
 */

/** 格子間距（同時也是泡泡直徑，兩者維持 1:1 貼齊）；碰撞/黏附判定在 engine 內的抽象「格數」
 * 座標系裡運作，不受這個純渲染用的常數影響，改這個值只會讓整個棋盤跟著等比縮放 */
const CELL = 30
const ACCENT = '#f43f5e'
const TICK_MS = 16

const COLOR_HEX: Record<BubbleColor, string> = {
  RED: '#ff4d4d',
  BLUE: '#4d7dff',
  GREEN: '#4dff88',
  YELLOW: '#ffe14d'
}

const router = useRouter()
const engine = new BubbleShooterEngine()
const gameHistory = useGameHistory()
const stageRef = ref<HTMLElement | null>(null)

const state = reactive({
  status: 'idle' as BubbleShooterStatus,
  grid: engine.getSnapshot().grid as GridCell[][],
  flying: null as FlyingBubble | null,
  current: 'RED' as BubbleColor,
  next: 'BLUE' as BubbleColor,
  aimAngle: 0,
  score: 0,
  combo: 0,
  maxCombo: 0,
  shotsFired: 0,
  warning: false,
  /** 最近一次消除/掉落的短暫提示（DROP xN） */
  popup: null as { text: string; ttl: number } | null,
  message: '瞄準後點擊發射！',
  rewardMessage: '',
  waitingOverlayVisible: true,
  resultOverlayVisible: false,
  rateDialogOpen: false,
  ruleDialogOpen: false
})

const BUBBLE_RULE = {
  description:
    `經典泡泡龍：移動滑鼠／觸控拖曳瞄準，點擊／放開發射泡泡。發射後碰到既有泡泡群或最頂列就會黏附，` +
    `跟至少 ${MATCH_MIN} 顆同色泡泡連成一片即消除。消除後，任何跟最頂列失去連接的泡泡群會整群掉落，` +
    `一發打出大量掉落是最爽的得分方式。每發射 ${SHOTS_PER_NEW_ROW} 次，頂端會插入新的一列增加壓力，` +
    '泡泡堆到底線即 GAME OVER。',
  scoreRule:
    `消除 3 顆 +${MATCH3_SCORE}、4 顆 +${MATCH4_SCORE}、5 顆 +${MATCH5_SCORE}，超過每多 1 顆再加分；` +
    `掉落每顆額外 +${DROP_SCORE_PER_BUBBLE}；連續兩次以上發射都造成消除會累積 Combo 額外加分。` +
    '不消耗到 3 顆以上的普通黏附不加分、也會讓 Combo 歸零。',
  levelsTitle: '顏色',
  levels: [
    { level: 'RED / BLUE / GREEN / YELLOW', condition: '第一版固定 4 種顏色，不含特殊泡泡／道具' }
  ],
  note: 'ESC / P 可暫停，暫停期間不會發射也不會插入新列。'
}

let tickTimer: ReturnType<typeof setInterval> | null = null
let popupTimer: ReturnType<typeof setTimeout> | null = null

const stageWidth = computed(() => COLS * CELL)
const stageHeight = computed(() => Math.ceil(ROWS * ROW_HEIGHT_RATIO * CELL + CELL * 1.6))
const launcherX = computed(() => (COLS / 2) * CELL)
const launcherY = computed(() => ROWS * ROW_HEIGHT_RATIO * CELL)
const bubbleSize = computed(() => BUBBLE_DIAMETER * CELL)

const flatBubbles = computed(() => {
  const out: Array<{ key: string; left: number; top: number; color: BubbleColor }> = []
  state.grid.forEach((row, r) => {
    row.forEach((cell, c) => {
      if (!cell) return
      out.push({
        key: `${r}-${c}`,
        left: cellCenterX(r, c) * CELL - bubbleSize.value / 2,
        top: cellCenterY(r) * CELL - bubbleSize.value / 2,
        color: cell.color
      })
    })
  })
  return out
})
const flyingStyle = computed(() => {
  if (!state.flying) return ''
  const left = state.flying.x * CELL - bubbleSize.value / 2
  const top = state.flying.y * CELL - bubbleSize.value / 2
  return `left:${left}px; top:${top}px; width:${bubbleSize.value}px; height:${bubbleSize.value}px; background:${COLOR_HEX[state.flying.color]};`
})
/**
 * 瞄準線：從發射器往瞄準方向畫一條固定長度的細線（純 CSS transform，不是 Canvas）。
 * 線段的「底部」固定錨在發射器座標（top 往上位移 length，搭配 CSS transform-origin: bottom center），
 * 這樣 aimAngle=0（正上方，見 engine 的 shoot() 速度公式）時線段預設就是往上畫，旋轉軸心也不會位移；
 * 先前用 top:launcherY + transform-origin:top center 會讓線段預設往「下」畫，方向整個反過來。
 */
const aimLineStyle = computed(() => {
  const length = CELL * 3.4
  const deg = (state.aimAngle * 180) / Math.PI
  return `left:${launcherX.value}px; top:${launcherY.value - length}px; height:${length}px; transform: translateX(-50%) rotate(${deg}deg);`
})

const statusText = computed(() => {
  if (state.status === 'playing') return 'PLAYING'
  if (state.status === 'paused') return 'PAUSED'
  if (state.status === 'gameover') return 'GAME OVER'
  return 'READY'
})
const canPauseWhilePlaying = computed(() => state.status === 'playing')
const canResumeFromPause = computed(
  () => state.status === 'paused' && !state.waitingOverlayVisible && !state.resultOverlayVisible
)

/** 私有工具方法：快照同步、計時器管理、彈出提示 */
const _handlers = {
  syncSnapshot: () => {
    const snap = engine.getSnapshot()
    state.status = snap.status
    state.grid = snap.grid
    state.flying = snap.flying
    state.current = snap.current
    state.next = snap.next
    state.aimAngle = snap.aimAngle
    state.score = snap.score
    state.combo = snap.combo
    state.maxCombo = snap.maxCombo
    state.shotsFired = snap.shotsFired
    state.warning = snap.warning
  },
  stopTickTimer: () => {
    if (tickTimer) {
      clearInterval(tickTimer)
      tickTimer = null
    }
  },
  startTickTimer: () => {
    _handlers.stopTickTimer()
    tickTimer = setInterval(() => {
      if (state.status !== 'playing') return
      const result = engine.tick(TICK_MS)
      _handlers.syncSnapshot()
      if (result.snapped) _actions.handleSnapResult(result)
    }, TICK_MS)
  },
  stopPopupTimer: () => {
    if (popupTimer) {
      clearTimeout(popupTimer)
      popupTimer = null
    }
  },
  showPopup: (text: string) => {
    _handlers.stopPopupTimer()
    state.popup = { text, ttl: 1 }
    popupTimer = setTimeout(() => {
      state.popup = null
      popupTimer = null
    }, 700)
  }
}

const _actions = {
  recordHistory: async () => {
    state.rewardMessage = ''
    try {
      const result = await gameHistory.actions.record('bubbleShooter', 'BUBBLE SHOOTER', {
        score: state.score,
        meta: {
          maxCombo: state.maxCombo,
          shotsFired: state.shotsFired
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
    _handlers.stopTickTimer()
    _handlers.stopPopupTimer()
    engine.reset()
    _handlers.syncSnapshot()
    state.popup = null
    state.rewardMessage = ''
    state.waitingOverlayVisible = true
    state.resultOverlayVisible = false
    state.message = '瞄準後點擊發射！'
  },
  startPlay: () => {
    engine.start()
    _handlers.syncSnapshot()
    state.waitingOverlayVisible = false
    state.resultOverlayVisible = false
    state.message = '瞄準後點擊發射！'
    _handlers.startTickTimer()
  },
  handleSnapResult: (result: { matchedCount: number; droppedCount: number; scoreGained: number; gameOver: boolean }) => {
    if (result.matchedCount > 0) {
      const parts = [`MATCH x${result.matchedCount}`]
      if (result.droppedCount > 0) parts.push(`DROP x${result.droppedCount}`)
      _handlers.showPopup(parts.join(' + '))
      state.message = `+${result.scoreGained} 分！`
    } else {
      state.message = '沒有消除，繼續瞄準！'
    }
    if (result.gameOver) _actions.finishGame()
  },
  updateAim: (clientX: number, clientY: number) => {
    if (state.status !== 'playing' || !stageRef.value) return
    const rect = stageRef.value.getBoundingClientRect()
    const x = clientX - rect.left
    const y = clientY - rect.top
    const angle = Math.atan2(x - launcherX.value, launcherY.value - y)
    engine.aim(angle)
    _handlers.syncSnapshot()
  },
  shoot: () => {
    if (state.status !== 'playing') return
    engine.shoot()
    _handlers.syncSnapshot()
  },
  pause: () => {
    if (state.status !== 'playing') return
    engine.pause()
    _handlers.stopTickTimer()
    _handlers.syncSnapshot()
    state.message = '已暫停'
  },
  resume: () => {
    if (state.status !== 'paused') return
    engine.resume()
    _handlers.startTickTimer()
    _handlers.syncSnapshot()
    state.message = '瞄準後點擊發射！'
  },
  finishGame: () => {
    _handlers.stopTickTimer()
    _handlers.stopPopupTimer()
    _handlers.syncSnapshot()
    state.resultOverlayVisible = true
    state.message = '泡泡堆到底線，遊戲結束。'
    _actions.recordHistory()
  },
  playAgain: () => {
    _actions.resetGame()
    _actions.startPlay()
  },
  endGameNow: () => {
    _handlers.stopTickTimer()
    _handlers.stopPopupTimer()
    state.status = 'gameover'
    state.waitingOverlayVisible = false
    state.message = '本局已結束。'
    state.resultOverlayVisible = true
    _actions.recordHistory()
  }
}

const click = {
  start: () => _actions.startPlay(),
  pause: () => _actions.pause(),
  resume: () => _actions.resume(),
  restart: () => _actions.playAgain(),
  end: () => _actions.endGameNow(),
  again: () => _actions.playAgain(),
  exit: () => router.replace('/game-hall'),
  stagePointerMove: (event: PointerEvent) => _actions.updateAim(event.clientX, event.clientY),
  stageClick: (event: PointerEvent) => {
    _actions.updateAim(event.clientX, event.clientY)
    _actions.shoot()
  },
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
  _actions.resetGame()
  window.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  _handlers.stopTickTimer()
  _handlers.stopPopupTimer()
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <main class="bub-page" :class="`state-${state.status}`">
    <div class="bub-overlay" />

    <div v-if="state.waitingOverlayVisible" class="game-mask waiting-mask">
      <div class="mask-title">WELCOME</div>
      <p class="waiting-subtitle">BUBBLE SHOOTER</p>
      <p class="waiting-hint">瞄準發射，{{ MATCH_MIN }} 顆同色泡泡連成一片即消除</p>
      <button class="bub-btn waiting-btn waiting-start" type="button" @click="click.start">START</button>
      <button class="bub-btn link waiting-btn" type="button" @click="click.openRateDialog">CONVERT</button>
      <button class="bub-btn link waiting-btn" type="button" @click="click.openRuleDialog">RULE</button>
    </div>

    <div v-if="state.resultOverlayVisible" class="game-mask result-mask">
      <div class="mask-title">GAME OVER</div>
      <div class="result-list">
        <div class="result-item"><span>SCORE</span><b>{{ state.score }}</b></div>
        <div class="result-item"><span>MAX COMBO</span><b>{{ state.maxCombo }}</b></div>
        <div class="result-item"><span>SHOTS FIRED</span><b>{{ state.shotsFired }}</b></div>
      </div>
      <p v-if="state.rewardMessage" class="result-reward">{{ state.rewardMessage }}</p>
      <div class="result-actions">
        <button class="bub-btn" type="button" @click="click.again">PLAY AGAIN</button>
        <button class="bub-btn danger" type="button" @click="click.exit">EXIT</button>
      </div>
    </div>

    <GameRateDialog :visible="state.rateDialogOpen" game-key="bubbleShooter" game-name="BUBBLE SHOOTER" :accent-color="ACCENT"
      @close="click.closeRateDialog" />
    <GameRuleDialog :visible="state.ruleDialogOpen" game-name="BUBBLE SHOOTER" :accent-color="ACCENT" v-bind="BUBBLE_RULE"
      @close="click.closeRuleDialog" />

    <section class="bub-shell">
      <aside class="bub-side left">
        <button class="bub-btn" type="button" :disabled="!canResumeFromPause" @click="click.resume">START</button>
        <button class="bub-btn" type="button" :disabled="!canPauseWhilePlaying" @click="click.pause">PAUSE</button>
        <button class="bub-btn" type="button" @click="click.restart">RESTART</button>
        <button class="bub-btn link" type="button" @click="click.end">END</button>
        <button class="bub-btn" type="button" @click="click.openRateDialog">CONVERT</button>
        <button class="bub-btn" type="button" @click="click.openRuleDialog">RULE</button>
      </aside>

      <section class="bub-center">
        <header class="bub-title-wrap">
          <h1 class="bub-title">BUBBLE SHOOTER</h1>
          <p class="bub-status" :class="{ 'is-warning': state.warning && state.status === 'playing' }">
            {{ state.warning && state.status === 'playing' ? 'WARNING' : statusText }}
          </p>
        </header>

        <div class="bub-panel">
          <span>SCORE: {{ state.score }}</span>
          <span>COMBO x{{ state.combo }}</span>
          <span>SHOTS: {{ state.shotsFired }}</span>
        </div>

        <div class="bub-frame">
          <div ref="stageRef" class="bub-stage" :style="`width:${stageWidth}px; height:${stageHeight}px;`"
            @pointermove="click.stagePointerMove" @click="click.stageClick">
            <div v-for="b in flatBubbles" :key="b.key" class="bub-bubble"
              :style="`left:${b.left}px; top:${b.top}px; width:${bubbleSize}px; height:${bubbleSize}px; background:${COLOR_HEX[b.color]};`" />

            <div v-if="state.status === 'playing'" class="bub-aimline" :style="aimLineStyle" />

            <div class="bub-launcher" :style="`left:${launcherX}px; top:${launcherY}px;`">
              <div class="bub-current" :style="`background:${COLOR_HEX[state.current]};`" />
            </div>

            <div v-if="state.flying" class="bub-bubble is-flying" :style="flyingStyle" />

            <div v-if="state.popup" class="bub-popup">{{ state.popup.text }}</div>
          </div>

          <div class="bub-next-wrap">
            <span class="bub-next-label">NEXT</span>
            <div class="bub-next-swatch" :style="`background:${COLOR_HEX[state.next]};`" />
          </div>
        </div>

        <p class="bub-message">{{ state.message }}</p>
      </section>

      <aside class="bub-side right">
        <div class="bub-help-panel">
          <p class="bub-help-title">HOW TO PLAY</p>
          <p class="bub-help-text">
            移動滑鼠／觸控拖曳瞄準，點擊／放開發射泡泡。碰到既有泡泡群或最頂列會黏附，
            {{ MATCH_MIN }} 顆以上同色連成一片即消除，跟頂列失去連接的泡泡群會整群掉落額外加分。
            每 {{ SHOTS_PER_NEW_ROW }} 次發射會插入新的一列，泡泡堆到底線即 GAME OVER。ESC / P 可暫停。
          </p>
        </div>
      </aside>
    </section>
  </main>
</template>

<style scoped lang="scss">
.bub-page {
  --accent: #f43f5e;
  position: relative;
  min-height: 100vh;
  display: grid;
  place-items: center;
  background: radial-gradient(circle at top, #240a12, #080204 60%);
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
    background: radial-gradient(circle at 20% 20%, rgba(244, 63, 94, 0.18), transparent 45%),
      radial-gradient(circle at 80% 70%, rgba(244, 63, 94, 0.1), transparent 40%);
    filter: blur(40px);
    animation: bub-ambient-drift 12s ease-in-out infinite alternate;
  }

  &::after {
    background: linear-gradient(115deg, rgba(244, 63, 94, 0.06), rgba(0, 0, 0, 0));
    animation: bub-ambient-pulse 4.6s ease-in-out infinite;
  }

  .bub-overlay {
    position: absolute;
    inset: 0;
    background-image: linear-gradient(rgba(244, 63, 94, 0.05) 1px, transparent 1px),
      linear-gradient(90deg, rgba(244, 63, 94, 0.05) 1px, transparent 1px);
    background-size: 28px 28px;
    pointer-events: none;
    z-index: 0;
    animation: bub-grid-drift 14s linear infinite;
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
      text-shadow: 0 0 18px rgba(244, 63, 94, 0.5);
    }

    &.waiting-mask {
      background: rgba(0, 0, 0, 0.88);

      .waiting-subtitle {
        margin: 0;
        color: #ffb3c1;
        letter-spacing: 0.3rem;
        font-size: 1.05rem;
        font-weight: 800;
      }

      .waiting-hint {
        margin: 0;
        max-width: 340px;
        text-align: center;
        color: #d67a8a;
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
      width: 280px;
    }

    .result-item {
      display: flex;
      justify-content: space-between;
      border: 1px solid rgba(244, 63, 94, 0.4);
      background: rgba(40, 10, 18, 0.65);
      color: #ffdbe2;
      padding: 8px 10px;
      font-variant-numeric: tabular-nums;
    }

    .result-reward {
      margin: 8px 0 0;
      color: #ffb3c1;
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

  .bub-shell {
    position: relative;
    z-index: 1;
    width: min(1100px, 100%);
    padding: 24px;
    display: grid;
    grid-template-columns: 180px 1fr 180px;
    gap: 20px;
    align-items: start;
  }

  .bub-side {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding-top: 160px;
  }

  .bub-btn {
    position: relative;
    overflow: hidden;
    border: 1px solid rgba(244, 63, 94, 0.4);
    border-radius: 6px;
    padding: 10px 12px;
    background: rgba(40, 10, 18, 0.75);
    color: #ff8fa3;
    font-weight: 700;
    letter-spacing: 0.5px;
    cursor: pointer;
    transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;

    &::after {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(105deg, transparent 35%, rgba(255, 200, 210, 0.22) 50%, transparent 65%);
      transform: translateX(-150%);
      transition: transform 0.35s ease;
      pointer-events: none;
    }

    &:hover:not(:disabled) {
      border-color: var(--accent);
      box-shadow: 0 0 12px rgba(244, 63, 94, 0.4);
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

  .bub-center {
    text-align: center;

    .bub-title-wrap {
      margin-bottom: 8px;
    }

    .bub-title {
      margin: 0;
      color: var(--accent);
      font-size: clamp(1.5rem, 4.6vw, 2.7rem);
      letter-spacing: 0.1rem;
      font-weight: 900;
      text-shadow: 0 0 14px rgba(244, 63, 94, 0.45);
    }

    .bub-status {
      margin: 2px 0 0;
      color: #ffb3c1;
      font-size: 0.9rem;
      letter-spacing: 0.2rem;

      &.is-warning {
        color: #ffcc33;
        animation: bub-warning-flash 0.6s ease-in-out infinite;
      }
    }

    .bub-panel {
      margin: 10px auto 0;
      display: flex;
      justify-content: center;
      flex-wrap: wrap;
      gap: 8px 16px;
      color: #ff8fa3;
      font-weight: 800;
      font-size: 0.85rem;
      text-shadow: 0 0 6px rgba(244, 63, 94, 0.45);
      font-variant-numeric: tabular-nums;
    }

    .bub-frame {
      width: fit-content;
      margin: 16px auto 0;
      padding: 14px;
      background: #1a0509;
      border: 8px solid #3a0d17;
      border-radius: 16px;
      box-shadow: 0 0 0 1px rgba(244, 63, 94, 0.18), 0 0 26px rgba(90, 20, 35, 0.4);
    }

    .bub-stage {
      position: relative;
      background: #0d0306;
      border-radius: 8px;
      overflow: hidden;
      touch-action: none;
      user-select: none;
      -webkit-user-select: none;
      cursor: crosshair;
    }

    .bub-bubble {
      position: absolute;
      border-radius: 50%;
      box-shadow: inset 0 -4px 6px rgba(0, 0, 0, 0.35), inset 0 3px 4px rgba(255, 255, 255, 0.35), 0 0 6px rgba(0, 0, 0, 0.4);
      border: 1px solid rgba(0, 0, 0, 0.25);

      &.is-flying {
        z-index: 5;
      }
    }

    .bub-aimline {
      position: absolute;
      width: 2px;
      background: repeating-linear-gradient(180deg, rgba(255, 200, 210, 0.7) 0 4px, transparent 4px 9px);
      transform-origin: bottom center;
      pointer-events: none;
      z-index: 2;
    }

    .bub-launcher {
      position: absolute;
      width: 26px;
      height: 26px;
      margin: -13px 0 0 -13px;
      border-radius: 50%;
      background: #3a0d17;
      border: 2px solid var(--accent);
      display: grid;
      place-items: center;
      z-index: 3;
      box-shadow: 0 0 10px rgba(244, 63, 94, 0.6);

      .bub-current {
        width: 16px;
        height: 16px;
        border-radius: 50%;
        box-shadow: inset 0 -2px 3px rgba(0, 0, 0, 0.35);
      }
    }

    .bub-popup {
      position: absolute;
      left: 50%;
      top: 42%;
      transform: translate(-50%, -50%);
      color: #ffe14d;
      font-weight: 900;
      font-size: 1rem;
      letter-spacing: 0.08rem;
      text-shadow: 0 0 10px rgba(255, 225, 77, 0.8);
      pointer-events: none;
      z-index: 6;
      animation: bub-popup-float 0.7s ease-out both;
      white-space: nowrap;
    }

    .bub-next-wrap {
      margin-top: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;

      .bub-next-label {
        color: #d67a8a;
        font-size: 0.7rem;
        letter-spacing: 0.16em;
      }

      .bub-next-swatch {
        width: 20px;
        height: 20px;
        border-radius: 50%;
        border: 1px solid rgba(0, 0, 0, 0.3);
        box-shadow: inset 0 -2px 3px rgba(0, 0, 0, 0.35);
      }
    }
  }

  .bub-message {
    margin-top: 14px;
    color: #ffb3c1;
    font-size: 0.85rem;
    min-height: 1.2em;
  }

  .bub-help-panel {
    border: 1px solid rgba(244, 63, 94, 0.3);
    border-radius: 8px;
    padding: 12px;
    background: rgba(40, 10, 18, 0.5);

    .bub-help-title {
      margin: 0 0 6px;
      color: var(--accent);
      font-size: 0.72rem;
      letter-spacing: 0.14rem;
      font-weight: 800;
    }

    .bub-help-text {
      margin: 0;
      color: #ffb3c1;
      font-size: 0.72rem;
      line-height: 1.6;
    }
  }
}

@keyframes bub-ambient-drift {
  0% {
    transform: translate(-1.5%, -1%) scale(1);
  }

  100% {
    transform: translate(1.5%, 1%) scale(1.06);
  }
}

@keyframes bub-ambient-pulse {

  0%,
  100% {
    opacity: 0.35;
  }

  50% {
    opacity: 0.75;
  }
}

@keyframes bub-grid-drift {
  0% {
    transform: translate(0, 0);
  }

  100% {
    transform: translate(14px, 14px);
  }
}

@keyframes bub-warning-flash {

  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0.4;
  }
}

@keyframes bub-popup-float {
  0% {
    opacity: 0;
    transform: translate(-50%, -30%) scale(0.85);
  }

  30% {
    opacity: 1;
    transform: translate(-50%, -60%) scale(1.05);
  }

  100% {
    opacity: 0;
    transform: translate(-50%, -100%) scale(1);
  }
}

@media (max-width: 980px) {
  .bub-page {
    .bub-shell {
      grid-template-columns: 1fr;
      padding: 16px;
    }

    .bub-side {
      flex-direction: row;
      flex-wrap: wrap;
      justify-content: center;
      padding-top: 0;
    }
  }
}
</style>
