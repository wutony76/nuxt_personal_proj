<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useGameHistory } from '~/composables/useGameHistory'
import SolitaireCoreEngine, { type Card, type Suit, type TargetLocation } from '~/utils/solitaireEngine'

type SolitaireStatus = 'ready' | 'playing' | 'pause' | 'win' | 'gameover'

const SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades']
const SUIT_SYMBOL: Record<Suit, string> = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' }
const CARD_HEIGHT = 90
const CASCADE_OFFSET = 14
const READY_START = 3
const DEFAULT_MESSAGE = '按「開始」後可點擊操作紙牌，雙擊可自動上疊 Foundation。'

const pad2 = (value: number) => String(value).padStart(2, '0')
const formatTime = (totalSeconds: number) => {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${pad2(m)}:${pad2(s)}`
}

const router = useRouter()
const engine = new SolitaireCoreEngine()
const gameHistory = useGameHistory()

const state = reactive({
  status: 'ready' as SolitaireStatus,
  tableau: [] as Card[][],
  foundations: { hearts: [] as Card[], diamonds: [] as Card[], clubs: [] as Card[], spades: [] as Card[] },
  stock: [] as Card[],
  waste: [] as Card[],
  score: 0,
  moves: 0,
  elapsedSeconds: 0,
  selectedCardId: null as string | null,
  message: DEFAULT_MESSAGE,
  rewardMessage: '',
  waitingOverlayVisible: true,
  readyOverlayVisible: false,
  readyCountdownValue: READY_START,
  resultOverlayVisible: false,
  won: false,
  rateDialogOpen: false,
  ruleDialogOpen: false
})

const SOLITAIRE_RULE = {
  description:
    '點擊操作紙牌：第一次點擊選取一張牌（或合法的連續牌組），第二次點擊目標區嘗試移動；雙擊一張牌會嘗試自動移動到合法的 Foundation。' +
    'Tableau 只能交替顏色（紅/黑）且點數遞減疊放，合法的連續牌組可整組搬動；空欄只能放 K（或以 K 開頭的合法牌組）。Stock 採 Draw 1，抽完後可重新循環 Waste 繼續抽，次數不限。' +
    'Tableau 某欄最上面的正面牌被移走後，若下方還有反面牌會自動翻正面。',
  scoreRule:
    'SCORE ＝ 合法移動 +5、移到 Foundation +10 累加，完成牌局額外 +200；翻牌（自動翻牌／Stock 抽牌）本身不計分，只有實際把牌接上合法序列才算分。',
  levelsTitle: '操作方式',
  levels: [
    { level: '點擊', condition: '第一次點擊選取，第二次點擊目標區嘗試移動' },
    { level: '雙擊', condition: '自動嘗試移動到合法的 Foundation' }
  ],
  note: '4 個 Foundation 全部集滿（各花色 A 到 K）即完成牌局。'
}

let readyTimer: ReturnType<typeof setInterval> | null = null
let clockTimer: ReturnType<typeof setInterval> | null = null

const statusText = computed(() => {
  if (state.status === 'playing') return 'PLAYING'
  if (state.status === 'pause') return 'PAUSE'
  if (state.status === 'win') return 'WIN'
  if (state.status === 'gameover') return 'GAME OVER'
  return 'READY'
})
const statusClass = computed(() => {
  if (state.status === 'playing') return 'is-playing'
  if (state.status === 'pause') return 'is-pause'
  if (state.status === 'win') return 'is-win'
  if (state.status === 'gameover') return 'is-gameover'
  return 'is-ready'
})
const canResumeFromPause = computed(
  () => state.status === 'pause' && !state.waitingOverlayVisible && !state.readyOverlayVisible && !state.resultOverlayVisible
)
const canPauseWhilePlaying = computed(() => state.status === 'playing')

/** 私有工具方法：計時器管理、狀態同步 */
const _handlers = {
  syncState: () => {
    const snap = engine.getSnapshot()
    state.tableau = snap.tableau
    state.foundations = snap.foundations
    state.stock = snap.stock
    state.waste = snap.waste
    state.score = snap.score
    state.moves = snap.moves
  },
  stopReadyTimer: () => {
    if (readyTimer) {
      clearInterval(readyTimer)
      readyTimer = null
    }
  },
  startClock: () => {
    _handlers.stopClock()
    clockTimer = setInterval(() => {
      state.elapsedSeconds += 1
    }, 1000)
  },
  stopClock: () => {
    if (clockTimer) {
      clearInterval(clockTimer)
      clockTimer = null
    }
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
  locationOfRenderedCard: (cardId: string): TargetLocation | null => {
    for (let col = 0; col < state.tableau.length; col += 1) {
      if (state.tableau[col]!.some((c) => c.id === cardId)) return { zone: 'tableau', column: col }
    }
    for (const suit of SUITS) {
      if (state.foundations[suit].some((c) => c.id === cardId)) return { zone: 'foundation', suit }
    }
    return null
  }
}

const _actions = {
  recordHistory: async () => {
    state.rewardMessage = ''
    try {
      const result = await gameHistory.actions.record('solitaire', 'SOLITAIRE', {
        score: state.score,
        meta: { moves: state.moves, elapsedSeconds: state.elapsedSeconds }
      })
      if (result.coinReward > 0) {
        state.rewardMessage = result.coinCapped ? `+${result.coinReward} coin（已達今日上限）` : `+${result.coinReward} coin`
      }
    } catch {
      // 紀錄寫入失敗不影響遊戲本身，靜默略過
    }
  },
  finishGame: (won: boolean) => {
    state.status = won ? 'win' : 'gameover'
    state.won = won
    state.message = won ? '恭喜完成牌局！' : '本局已結束。'
    state.resultOverlayVisible = true
    _handlers.stopClock()
    _actions.recordHistory()
  },
  applyMoveResult: (result: { moved: boolean; won?: boolean }) => {
    if (!result.moved) return
    _handlers.syncState()
    if (result.won) _actions.finishGame(true)
  },
  handleCardClick: (cardId: string) => {
    if (state.status !== 'playing') return
    if (state.selectedCardId === cardId) {
      state.selectedCardId = null
      return
    }
    if (!state.selectedCardId) {
      if (engine.getGrabbableSequence(cardId)) state.selectedCardId = cardId
      return
    }
    const prevSelected = state.selectedCardId
    state.selectedCardId = null
    const target = _handlers.locationOfRenderedCard(cardId)
    if (target) {
      const result = engine.tryMove(prevSelected, target)
      if (result.moved) {
        _actions.applyMoveResult(result)
        return
      }
    }
    if (engine.getGrabbableSequence(cardId)) state.selectedCardId = cardId
  },
  handleZoneClick: (target: TargetLocation) => {
    if (state.status !== 'playing' || !state.selectedCardId) return
    const prevSelected = state.selectedCardId
    state.selectedCardId = null
    _actions.applyMoveResult(engine.tryMove(prevSelected, target))
  },
  resetGame: () => {
    _handlers.stopReadyTimer()
    _handlers.stopClock()
    engine.reset()
    _handlers.syncState()
    state.status = 'ready'
    state.elapsedSeconds = 0
    state.selectedCardId = null
    state.waitingOverlayVisible = true
    state.resultOverlayVisible = false
    state.readyOverlayVisible = false
    state.rewardMessage = ''
    state.message = DEFAULT_MESSAGE
  },
  startGame: () => {
    if (state.status === 'playing' || state.readyOverlayVisible) return
    if (state.status === 'win' || state.status === 'gameover') _actions.resetGame()
    state.waitingOverlayVisible = false
    state.resultOverlayVisible = false
    _handlers.runReadyCountdown(() => {
      state.status = 'playing'
      state.message = '牌局進行中...'
      _handlers.startClock()
    })
  },
  pauseGame: () => {
    if (state.status !== 'playing') return
    state.status = 'pause'
    state.message = '已暫停'
    _handlers.stopClock()
  },
  resumeGame: () => {
    if (!canResumeFromPause.value) return
    state.status = 'playing'
    state.message = '牌局進行中...'
    _handlers.startClock()
  },
  playAgain: () => {
    _actions.resetGame()
    _actions.startGame()
  },
  endGameNow: () => {
    _handlers.stopReadyTimer()
    state.waitingOverlayVisible = false
    state.readyOverlayVisible = false
    _actions.finishGame(false)
  }
}

const click = {
  start: () => _actions.startGame(),
  pause: () => _actions.pauseGame(),
  resume: () => _actions.resumeGame(),
  replay: () => _actions.resetGame(),
  end: () => _actions.endGameNow(),
  again: () => _actions.playAgain(),
  exit: () => router.replace('/game-hall'),
  stock: () => {
    if (state.status !== 'playing') return
    if (state.stock.length > 0) {
      engine.drawFromStock()
      _handlers.syncState()
    } else if (state.waste.length > 0) {
      engine.recycleWasteToStock()
      _handlers.syncState()
    }
  },
  zone: (target: TargetLocation) => _actions.handleZoneClick(target),
  card: (cardId: string) => _actions.handleCardClick(cardId),
  autoMove: (cardId: string) => {
    if (state.status !== 'playing') return
    state.selectedCardId = null
    _actions.applyMoveResult(engine.tryAutoMoveToFoundation(cardId))
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

onMounted(() => {
  _actions.resetGame()
  state.waitingOverlayVisible = true
})

onBeforeUnmount(() => {
  _handlers.stopReadyTimer()
  _handlers.stopClock()
})
</script>

<template>
  <main class="sol-page" :class="`state-${state.status}`">
    <div class="sol-overlay" />
    <div v-if="state.waitingOverlayVisible" class="game-mask waiting-mask">
      <div class="mask-title">WELCOME</div>
      <p class="waiting-subtitle">SOLITAIRE</p>
      <button class="sol-btn waiting-btn waiting-start" type="button" @click="click.start">START</button>
      <button class="sol-btn link waiting-btn" type="button" @click="click.openRateDialog">CONVERT</button>
      <button class="sol-btn link waiting-btn" type="button" @click="click.openRuleDialog">RULE</button>
    </div>
    <div v-if="state.readyOverlayVisible" class="game-mask ready-mask">
      <div class="mask-title">READY</div>
      <div class="mask-count">{{ state.readyCountdownValue }}</div>
    </div>
    <div v-if="state.resultOverlayVisible" class="game-mask result-mask">
      <div class="mask-title">{{ state.won ? 'WIN' : 'RESULT' }}</div>
      <div class="result-list">
        <div class="result-item"><span>SCORE</span><b>{{ state.score }}</b></div>
        <div class="result-item"><span>MOVES</span><b>{{ state.moves }}</b></div>
        <div class="result-item"><span>TIME</span><b>{{ formatTime(state.elapsedSeconds) }}</b></div>
      </div>
      <p v-if="state.rewardMessage" class="result-reward">{{ state.rewardMessage }}</p>
      <div class="result-actions">
        <button class="sol-btn" type="button" @click="click.again">AGAIN</button>
        <button class="sol-btn danger" type="button" @click="click.exit">EXIT</button>
      </div>
    </div>

    <GameRateDialog :visible="state.rateDialogOpen" game-key="solitaire" game-name="SOLITAIRE"
      accent-color="#2ecc71" @close="click.closeRateDialog" />
    <GameRuleDialog :visible="state.ruleDialogOpen" game-name="SOLITAIRE" accent-color="#2ecc71"
      v-bind="SOLITAIRE_RULE" @close="click.closeRuleDialog" />

    <section class="sol-shell">
      <aside class="sol-side left">
        <button class="sol-btn" type="button" :disabled="!canResumeFromPause" @click="click.resume">START</button>
        <button class="sol-btn" type="button" :disabled="!canPauseWhilePlaying" @click="click.pause">PAUSE</button>
        <button class="sol-btn" type="button" @click="click.replay">REPLAY</button>
        <button class="sol-btn link" type="button" @click="click.end">END</button>
        <button class="sol-btn" type="button" @click="click.openRateDialog">CONVERT</button>
        <button class="sol-btn" type="button" @click="click.openRuleDialog">RULE</button>
      </aside>

      <section class="sol-center">
        <header class="sol-title-wrap">
          <h1 class="sol-title">SOLITAIRE</h1>
          <p class="sol-status" :class="statusClass">{{ statusText }}</p>
        </header>

        <div class="sol-frame">
          <div class="sol-board">
            <div class="sol-toprow">
              <div class="sol-slot stock" @click="click.stock">
                <PlayingCard v-if="state.stock.length > 0" :suit="state.stock[state.stock.length - 1]!.suit"
                  :rank="state.stock[state.stock.length - 1]!.rank" :face-up="false" />
                <div v-else class="sol-empty-slot">{{ state.waste.length > 0 ? '↻' : '' }}</div>
              </div>
              <div class="sol-slot waste">
                <PlayingCard v-if="state.waste.length > 0" :suit="state.waste[state.waste.length - 1]!.suit"
                  :rank="state.waste[state.waste.length - 1]!.rank" :face-up="true"
                  :selected="state.selectedCardId === state.waste[state.waste.length - 1]!.id"
                  @click.stop="click.card(state.waste[state.waste.length - 1]!.id)"
                  @dblclick.stop="click.autoMove(state.waste[state.waste.length - 1]!.id)" />
                <div v-else class="sol-empty-slot" />
              </div>
              <div class="sol-toprow-gap" />
              <div v-for="suit in SUITS" :key="suit" class="sol-slot foundation" data-drop-zone="foundation"
                :data-suit="suit" @click="click.zone({ zone: 'foundation', suit })">
                <PlayingCard v-if="state.foundations[suit].length > 0"
                  :suit="state.foundations[suit][state.foundations[suit].length - 1]!.suit"
                  :rank="state.foundations[suit][state.foundations[suit].length - 1]!.rank" :face-up="true"
                  :selected="state.selectedCardId === state.foundations[suit][state.foundations[suit].length - 1]!.id"
                  @click.stop="click.card(state.foundations[suit][state.foundations[suit].length - 1]!.id)"
                  @dblclick.stop="click.autoMove(state.foundations[suit][state.foundations[suit].length - 1]!.id)" />
                <div v-else class="sol-empty-slot suit-hint" :class="suit">{{ SUIT_SYMBOL[suit] }}</div>
              </div>
            </div>

            <div class="sol-tableau">
              <div v-for="(col, colIndex) in state.tableau" :key="colIndex" class="sol-column" data-drop-zone="tableau"
                :data-column="colIndex" :style="`height:${Math.max(1, col.length - 1) * CASCADE_OFFSET + CARD_HEIGHT}px`"
                @click="click.zone({ zone: 'tableau', column: colIndex })">
                <PlayingCard v-for="(card, cardIndex) in col" :key="card.id" :suit="card.suit" :rank="card.rank"
                  :face-up="card.faceUp" :selected="state.selectedCardId === card.id"
                  class="sol-tableau-card" :style="`top:${cardIndex * CASCADE_OFFSET}px`"
                  @click.stop="click.card(card.id)" @dblclick.stop="click.autoMove(card.id)" />
              </div>
            </div>
          </div>

          <div class="sol-panel">
            <span>SCORE: {{ state.score }}</span>
            <span>MOVES: {{ state.moves }}</span>
            <span>TIME: {{ formatTime(state.elapsedSeconds) }}</span>
          </div>
        </div>

        <p class="sol-message">{{ state.message }}</p>
      </section>

      <aside class="sol-side right">
        <div class="sol-help-panel">
          <p class="sol-help-title">HOW TO PLAY</p>
          <p class="sol-help-text">點擊操作紙牌：第一次選取、第二次點目標區移動，雙擊自動上疊 Foundation；交替顏色遞減疊放，空欄限 K；Stock 用完可循環 Waste 繼續抽牌。</p>
        </div>
      </aside>
    </section>
  </main>
</template>

<style scoped lang="scss">
.sol-page {
  position: relative;
  min-height: 100vh;
  display: grid;
  place-items: center;
  background: radial-gradient(circle at top, #06210f, #010603 60%);
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
    background: radial-gradient(circle at 20% 20%, rgba(46, 204, 113, 0.16), transparent 45%),
      radial-gradient(circle at 80% 70%, rgba(120, 220, 160, 0.1), transparent 40%);
    filter: blur(40px);
    animation: ambient-drift 12s ease-in-out infinite alternate;
  }

  &::after {
    background: linear-gradient(115deg, rgba(46, 204, 113, 0.05), rgba(0, 0, 0, 0));
    animation: ambient-pulse 4.6s ease-in-out infinite;
  }

  .sol-overlay {
    position: absolute;
    inset: 0;
    background-image: linear-gradient(rgba(46, 204, 113, 0.05) 1px, transparent 1px),
      linear-gradient(90deg, rgba(46, 204, 113, 0.05) 1px, transparent 1px);
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
      color: #2ecc71;
      font-size: clamp(2rem, 8vw, 4rem);
      letter-spacing: 0.25rem;
      font-weight: 900;
    }

    .mask-count {
      color: #2ecc71;
      font-size: clamp(3rem, 12vw, 7rem);
      font-weight: 900;
      line-height: 1;
    }

    &.waiting-mask {
      background: rgba(0, 0, 0, 0.88);

      .waiting-subtitle {
        margin: 0;
        color: #a9ffcb;
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
        border: 1px solid rgba(46, 204, 113, 0.4);
        background: rgba(6, 33, 15, 0.65);
        color: #d3ffe4;
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

  .sol-shell {
    position: relative;
    z-index: 1;
    width: min(1180px, 100%);
    padding: 24px;
    display: grid;
    grid-template-columns: 180px 1fr 180px;
    gap: 20px;
    align-items: center;
  }

  .sol-side {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .sol-btn {
    position: relative;
    overflow: hidden;
    border: 1px solid rgba(46, 204, 113, 0.4);
    border-radius: 6px;
    padding: 10px 12px;
    background: rgba(6, 24, 14, 0.75);
    color: #2ecc71;
    font-weight: 700;
    letter-spacing: 0.5px;
    transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;

    &::after {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(105deg, transparent 35%, rgba(190, 255, 210, 0.25) 50%, transparent 65%);
      transform: translateX(-150%);
      transition: transform 0.35s ease;
      pointer-events: none;
    }

    &:hover {
      border-color: #2ecc71;
      box-shadow: 0 0 12px rgba(46, 204, 113, 0.35);
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
      border-color: rgba(255, 120, 60, 0.5);
      color: #ff9d7d;
    }
  }

  .sol-center {
    text-align: center;

    .sol-title-wrap {
      margin-bottom: 8px;
    }

    .sol-title {
      margin: 0;
      color: #2ecc71;
      font-size: clamp(1.5rem, 4.4vw, 2.6rem);
      letter-spacing: 0.1rem;
      font-weight: 900;
      text-shadow: 0 0 14px rgba(46, 204, 113, 0.5);
      animation: title-float 2.6s ease-in-out infinite;
    }

    .sol-status {
      margin: 2px 0 0;
      color: #d3ffe4;
      font-size: 0.9rem;
      letter-spacing: 0.2rem;

      &.is-playing {
        color: #2ecc71;
      }

      &.is-pause {
        color: #ffcc33;
      }

      &.is-win {
        color: #ffe066;
      }

      &.is-gameover {
        color: #ff5e5e;
      }
    }

    .sol-frame {
      width: fit-content;
      margin: 12px auto 0;
      padding: 14px;
      background: #051c0d;
      border: 10px solid #123a20;
      border-radius: 18px;
      box-shadow: 0 0 0 1px rgba(46, 204, 113, 0.2), 0 0 24px rgba(46, 204, 113, 0.16);
      animation: frame-glow 5.4s ease-in-out infinite;
    }

    .sol-board {
      position: relative;
      background: #0b2e18;
      border: 2px solid #000;
      border-radius: 8px;
      padding: 14px;
    }

    .sol-toprow {
      display: grid;
      grid-template-columns: repeat(2, 64px) 1fr repeat(4, 64px);
      gap: 12px;
      align-items: start;
      margin-bottom: 20px;
    }

    .sol-toprow-gap {
      min-width: 20px;
    }

    .sol-slot {
      width: 64px;
      height: 90px;
      cursor: pointer;
    }

    .sol-empty-slot {
      width: 64px;
      height: 90px;
      border: 2px dashed rgba(255, 255, 255, 0.2);
      border-radius: 4px;
      display: grid;
      place-items: center;
      color: rgba(255, 255, 255, 0.35);
      font-size: 26px;

      &.suit-hint.hearts,
      &.suit-hint.diamonds {
        color: rgba(255, 120, 120, 0.35);
      }
    }

    .sol-tableau {
      display: grid;
      grid-template-columns: repeat(7, 64px);
      gap: 12px;
    }

    .sol-column {
      position: relative;
      cursor: pointer;
    }

    .sol-tableau-card {
      position: absolute;
      left: 0;
    }

    .sol-panel {
      margin-top: 10px;
      display: flex;
      justify-content: space-between;
      color: #2ecc71;
      font-weight: 800;
      text-shadow: 0 0 6px rgba(46, 204, 113, 0.45);
    }

    .sol-message {
      margin-top: 14px;
      color: #d3ffe4;
      font-size: 0.85rem;
      animation: subtle-fade 2.8s ease-in-out infinite;
    }
  }

  .sol-help-panel {
    border: 1px solid rgba(46, 204, 113, 0.3);
    border-radius: 8px;
    padding: 12px;
    background: rgba(6, 24, 14, 0.5);

    .sol-help-title {
      margin: 0 0 6px;
      color: #2ecc71;
      font-size: 0.75rem;
      letter-spacing: 0.14rem;
      font-weight: 800;
    }

    .sol-help-text {
      margin: 0;
      color: #d3ffe4;
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
    box-shadow: 0 0 0 1px rgba(46, 204, 113, 0.2), 0 0 24px rgba(46, 204, 113, 0.16);
  }

  50% {
    box-shadow: 0 0 0 1px rgba(150, 255, 190, 0.35), 0 0 40px rgba(46, 204, 113, 0.3);
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

@media (max-width: 1100px) {
  .sol-page {
    .sol-shell {
      grid-template-columns: 1fr;
      padding: 16px;
    }

    .sol-side {
      flex-direction: row;
      flex-wrap: wrap;
      justify-content: center;
    }
  }
}
</style>
