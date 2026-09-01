<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useGameHistory } from '~/composables/useGameHistory'

type TypingStatus = 'ready' | 'playing' | 'pause' | 'gameover'
type WordState = 'waiting' | 'typing'
type WordObject = { id: number; text: string; x: number; y: number; progress: number; state: WordState }
type Completion = { id: number; x: number; y: number; text: string; gained: number }

const STAGE_WIDTH = 400
const STAGE_HEIGHT = 460
const SPAWN_Y = STAGE_HEIGHT - 40
const WORD_RISE_SPEED = 0.4
const WORD_CHAR_WIDTH = 13
const WORD_HEIGHT = 26

const TICK_MS = 16
const READY_START = 3
const LIVES_START = 3

/** 依長度分層的固定單字池，不外接 API／不使用圖片，見 add-typing-game design.md Decision 6 */
const WORD_TIERS: string[][] = [
  ['CAT', 'DOG', 'SUN', 'SKY', 'RUN', 'HOP', 'FOX', 'ICE', 'KEY', 'MAP', 'BUG', 'BEE', 'JAM', 'OWL', 'PIG', 'RAT', 'SEA', 'TOY', 'WIN', 'ZIP', 'GAME', 'CODE', 'JUMP', 'FAST', 'WORD', 'TYPE', 'PLAY', 'GLOW', 'ROCK', 'STAR'],
  ['RETRO', 'ARCADE', 'LASER', 'ROBOT', 'PLANET', 'GALAXY', 'ROCKET', 'WIZARD', 'DRAGON', 'CASTLE', 'KNIGHT', 'PIRATE', 'RAINBOW', 'CRYSTAL', 'PHANTOM', 'THUNDER', 'MYSTERY'],
  ['ADVENTURE', 'CHALLENGE', 'KEYBOARD', 'CHAMPION', 'ELECTRIC', 'FANTASTIC', 'MOUNTAIN', 'DISCOVERY', 'JOURNEYS', 'STARLIGHT']
]
/** 各等級抽到「單字池分層」的權重，等級越高越常抽到長字（見 Decision 6） */
const TIER_WEIGHTS_BY_LEVEL: number[][] = [
  [1, 0, 0],
  [0.7, 0.3, 0],
  [0.4, 0.4, 0.2],
  [0.2, 0.4, 0.4],
  [0.1, 0.3, 0.6]
]

const LEVEL_SCORE_THRESHOLDS = [0, 100, 250, 500, 900]
const BASE_SPAWN_TICKS = 150
const SPAWN_TICKS_PER_LEVEL = 15
const MIN_SPAWN_TICKS = 50

const COMBO_THRESHOLDS = [0, 5, 12, 24]
const COMBO_MULTIPLIERS = [1, 2, 3, 4]

const calcLevel = (score: number) => {
  let level = 1
  for (let i = LEVEL_SCORE_THRESHOLDS.length - 1; i >= 0; i -= 1) {
    if (score >= LEVEL_SCORE_THRESHOLDS[i]!) {
      level = i + 1
      break
    }
  }
  return level
}

const calcMultiplier = (combo: number) => {
  let multiplier = COMBO_MULTIPLIERS[0]!
  for (let i = COMBO_THRESHOLDS.length - 1; i >= 0; i -= 1) {
    if (combo >= COMBO_THRESHOLDS[i]!) {
      multiplier = COMBO_MULTIPLIERS[i]!
      break
    }
  }
  return multiplier
}

/**
 * 打字反應遊戲核心邏輯：持續生成單字、逐字元驗證（不分大小寫）、鎖定機制、
 * tick-driven 位置更新與 MISS 判定。比照 SpaceShooterEngine 組織方式 inline 在頁面內，
 * 只有這一款遊戲用到，不抽到 app/utils/（見 add-typing-game design.md）。
 */
class TypingEngine {
  words: WordObject[] = []
  score = 0
  level = 1
  combo = 0
  multiplier = 1
  lives = LIVES_START
  lockedId: number | null = null
  private spawnCountdown = BASE_SPAWN_TICKS
  private nextId = 1

  reset() {
    this.words = []
    this.score = 0
    this.level = 1
    this.combo = 0
    this.multiplier = 1
    this.lives = LIVES_START
    this.lockedId = null
    this.spawnCountdown = BASE_SPAWN_TICKS
  }

  private pickWord(): string {
    const weights = TIER_WEIGHTS_BY_LEVEL[Math.min(this.level, TIER_WEIGHTS_BY_LEVEL.length) - 1]!
    const roll = Math.random()
    let acc = 0
    let tierIndex = 0
    for (let i = 0; i < weights.length; i += 1) {
      acc += weights[i]!
      if (roll <= acc) {
        tierIndex = i
        break
      }
    }
    const tier = WORD_TIERS[tierIndex]!
    return tier[Math.floor(Math.random() * tier.length)]!
  }

  private spawnWord() {
    const text = this.pickWord()
    const estWidth = text.length * WORD_CHAR_WIDTH
    const x = Math.max(6, Math.min(STAGE_WIDTH - estWidth - 6, Math.random() * (STAGE_WIDTH - estWidth)))
    this.words.push({ id: this.nextId++, text, x, y: SPAWN_Y, progress: 0, state: 'waiting' })
  }

  private completeWord(word: WordObject): Completion {
    this.lockedId = null
    this.combo += 1
    this.multiplier = calcMultiplier(this.combo)
    const gained = word.text.length * 10 * this.multiplier
    this.score += gained
    this.words = this.words.filter((w) => w.id !== word.id)
    return { id: word.id, x: word.x, y: word.y, text: word.text, gained }
  }

  /** 逐字元驗證，不分大小寫；回傳 completed（完成該字）或 wrong（輸入了不符的字元） */
  handleChar(char: string): { completed?: Completion; wrong?: boolean } {
    const c = char.toLowerCase()
    if (this.lockedId === null) {
      const candidates = this.words.filter((w) => w.state === 'waiting' && w.text[0]!.toLowerCase() === c)
      if (candidates.length === 0) return { wrong: true }
      candidates.sort((a, b) => a.y - b.y)
      const target = candidates[0]!
      target.state = 'typing'
      target.progress = 1
      this.lockedId = target.id
      if (target.progress === target.text.length) return { completed: this.completeWord(target) }
      return {}
    }
    const word = this.words.find((w) => w.id === this.lockedId)
    if (!word) {
      this.lockedId = null
      return {}
    }
    const nextChar = word.text[word.progress]!.toLowerCase()
    if (nextChar !== c) return { wrong: true }
    word.progress += 1
    if (word.progress === word.text.length) return { completed: this.completeWord(word) }
    return {}
  }

  step(): { gameOver: boolean; missed: boolean } {
    this.spawnCountdown -= 1
    if (this.spawnCountdown <= 0) {
      this.spawnWord()
      const interval = Math.max(MIN_SPAWN_TICKS, BASE_SPAWN_TICKS - (this.level - 1) * SPAWN_TICKS_PER_LEVEL)
      this.spawnCountdown = interval
    }

    this.words.forEach((w) => {
      w.y -= WORD_RISE_SPEED
    })

    const missedWords = this.words.filter((w) => w.y < -WORD_HEIGHT)
    let missed = false
    if (missedWords.length > 0) {
      missed = true
      this.lives -= missedWords.length
      this.combo = 0
      this.multiplier = 1
      if (missedWords.some((w) => w.id === this.lockedId)) this.lockedId = null
      const missedIds = new Set(missedWords.map((w) => w.id))
      this.words = this.words.filter((w) => !missedIds.has(w.id))
    }

    this.level = calcLevel(this.score)

    return { gameOver: this.lives <= 0, missed }
  }

  getSnapshot() {
    return {
      words: this.words.map((w) => ({ ...w })),
      score: this.score,
      level: this.level,
      combo: this.combo,
      multiplier: this.multiplier,
      lives: this.lives,
      lockedId: this.lockedId
    }
  }
}

const router = useRouter()
const engine = new TypingEngine()
const gameHistory = useGameHistory()

const state = reactive({
  status: 'ready' as TypingStatus,
  words: [] as WordObject[],
  completions: [] as Completion[],
  score: 0,
  level: 1,
  combo: 0,
  multiplier: 1,
  lives: LIVES_START,
  lockedId: null as number | null,
  wrongFlash: false,
  stageShake: false,
  message: '按「開始」後直接用鍵盤輸入畫面上的單字（不分大小寫）。',
  rewardMessage: '',
  waitingOverlayVisible: true,
  readyOverlayVisible: false,
  readyCountdownValue: READY_START,
  resultOverlayVisible: false,
  rateDialogOpen: false,
  ruleDialogOpen: false
})

const TYPING_RULE = {
  description:
    '不需要點擊，直接用鍵盤輸入畫面上出現的單字（不分大小寫）。同時有多個單字時，輸入第一個字元會自動鎖定「第一個字元相符、且最接近畫面頂端」的單字，鎖定後接下來的輸入只跟這個字比對，' +
    '打完整個字即完成、往上飄走並得分；輸入錯誤的字元不會被採用，可以直接繼續輸入正確的字元。單字若飄出畫面頂端仍未完成，算 MISS，扣 1 條命。',
  scoreRule: 'SCORE ＝ 完成單字的字長 × 10 × 當下連擊倍率（x1～x4）累加，開放式無上限；連續完成不中斷會提升倍率，MISS 時歸零。',
  levelsTitle: '難度節奏',
  levels: LEVEL_SCORE_THRESHOLDS.map((threshold, idx) => ({
    level: idx + 1,
    condition: idx + 1 < LEVEL_SCORE_THRESHOLDS.length ? `${threshold}–${LEVEL_SCORE_THRESHOLDS[idx + 1]! - 1} 分` : `${threshold} 分以上`
  })),
  note: '等級越高，單字生成間隔越短、抽到長單字的機率越高。共有 3 條命，單字飄出畫面頂端未完成扣 1 命。'
}

let tickTimer: ReturnType<typeof setInterval> | null = null
let readyTimer: ReturnType<typeof setInterval> | null = null
let shakeTimer: ReturnType<typeof setTimeout> | null = null
let wrongFlashTimer: ReturnType<typeof setTimeout> | null = null
let completionCleanupId = 1

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
  () => state.status === 'pause' && !state.waitingOverlayVisible && !state.readyOverlayVisible && !state.resultOverlayVisible
)
const canPauseWhilePlaying = computed(() => state.status === 'playing')
const lockedWord = computed(() => state.words.find((w) => w.id === state.lockedId) ?? null)

/** 私有工具方法：計時器管理、狀態同步 */
const _handlers = {
  syncState: () => {
    const snap = engine.getSnapshot()
    state.words = snap.words
    state.score = snap.score
    state.level = snap.level
    state.combo = snap.combo
    state.multiplier = snap.multiplier
    state.lives = snap.lives
    state.lockedId = snap.lockedId
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
  stopWrongFlashTimer: () => {
    if (wrongFlashTimer) {
      clearTimeout(wrongFlashTimer)
      wrongFlashTimer = null
    }
  },
  triggerShake: () => {
    _handlers.stopShakeTimer()
    state.stageShake = true
    shakeTimer = setTimeout(() => {
      state.stageShake = false
      shakeTimer = null
    }, 260)
  },
  triggerWrongFlash: () => {
    _handlers.stopWrongFlashTimer()
    state.wrongFlash = true
    wrongFlashTimer = setTimeout(() => {
      state.wrongFlash = false
      wrongFlashTimer = null
    }, 180)
  },
  pushCompletion: (completion: Completion) => {
    const id = completionCleanupId++
    state.completions.push({ ...completion, id })
    setTimeout(() => {
      state.completions = state.completions.filter((c) => c.id !== id)
    }, 500)
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
  }
}

const _actions = {
  recordHistory: async () => {
    state.rewardMessage = ''
    try {
      const result = await gameHistory.actions.record('typing', 'TYPING', {
        score: state.score,
        level: state.level
      })
      if (result.coinReward > 0) {
        state.rewardMessage = result.coinCapped ? `+${result.coinReward} coin（已達今日上限）` : `+${result.coinReward} coin`
      }
    } catch {
      // 紀錄寫入失敗不影響遊戲本身，靜默略過
    }
  },
  finishGame: () => {
    state.status = 'gameover'
    state.message = '生命值歸零，遊戲結束。'
    state.resultOverlayVisible = true
    _handlers.stopTickTimer()
    _actions.recordHistory()
  },
  startTickLoop: () => {
    _handlers.stopTickTimer()
    tickTimer = setInterval(() => {
      if (state.status !== 'playing') return
      const result = engine.step()
      _handlers.syncState()
      if (result.missed) _handlers.triggerShake()
      if (result.gameOver) _actions.finishGame()
    }, TICK_MS)
  },
  resetGame: () => {
    _handlers.stopTickTimer()
    _handlers.stopReadyTimer()
    _handlers.stopShakeTimer()
    _handlers.stopWrongFlashTimer()
    engine.reset()
    _handlers.syncState()
    state.status = 'ready'
    state.completions = []
    state.stageShake = false
    state.wrongFlash = false
    state.waitingOverlayVisible = true
    state.resultOverlayVisible = false
    state.readyOverlayVisible = false
    state.rewardMessage = ''
    state.message = '按「開始」後直接用鍵盤輸入畫面上的單字（不分大小寫）。'
  },
  startGame: () => {
    if (state.status === 'playing' || state.readyOverlayVisible) return
    if (state.status === 'gameover') _actions.resetGame()
    state.waitingOverlayVisible = false
    state.resultOverlayVisible = false
    _handlers.runReadyCountdown(() => {
      state.status = 'playing'
      state.message = '輸入中...'
      _actions.startTickLoop()
    })
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
    state.message = '輸入中...'
    _actions.startTickLoop()
  },
  playAgain: () => {
    _actions.resetGame()
    _actions.startGame()
  },
  endGameNow: () => {
    _handlers.stopTickTimer()
    _handlers.stopReadyTimer()
    state.waitingOverlayVisible = false
    state.readyOverlayVisible = false
    state.status = 'gameover'
    state.message = '本局已結束。'
    state.resultOverlayVisible = true
    _actions.recordHistory()
  },
  handleTypedChar: (char: string) => {
    if (state.status !== 'playing') return
    const result = engine.handleChar(char)
    if (result.completed) {
      _handlers.syncState()
      _handlers.pushCompletion(result.completed)
    } else if (result.wrong) {
      _handlers.triggerWrongFlash()
    } else {
      _handlers.syncState()
    }
  }
}

const onTypingKeydown = (event: KeyboardEvent) => {
  if (event.key.length !== 1) return
  if (event.ctrlKey || event.metaKey || event.altKey) return
  _actions.handleTypedChar(event.key)
  event.preventDefault()
}

const click = {
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
  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', onTypingKeydown)
  }
  _actions.resetGame()
  state.waitingOverlayVisible = true
})

onBeforeUnmount(() => {
  _handlers.stopTickTimer()
  _handlers.stopReadyTimer()
  _handlers.stopShakeTimer()
  _handlers.stopWrongFlashTimer()
  if (typeof window !== 'undefined') {
    window.removeEventListener('keydown', onTypingKeydown)
  }
})
</script>

<template>
  <main class="typ-page" :class="`state-${state.status}`">
    <div class="typ-overlay" />
    <div v-if="state.waitingOverlayVisible" class="game-mask waiting-mask">
      <div class="mask-title">WELCOME</div>
      <p class="waiting-subtitle">TYPING</p>
      <button class="typ-btn waiting-btn waiting-start" type="button" @click="click.start">START</button>
      <button class="typ-btn link waiting-btn" type="button" @click="click.openRateDialog">CONVERT</button>
      <button class="typ-btn link waiting-btn" type="button" @click="click.openRuleDialog">RULE</button>
    </div>
    <div v-if="state.readyOverlayVisible" class="game-mask ready-mask">
      <div class="mask-title">READY</div>
      <div class="mask-count">{{ state.readyCountdownValue }}</div>
    </div>
    <div v-if="state.resultOverlayVisible" class="game-mask result-mask">
      <div class="mask-title">RESULT</div>
      <div class="result-list">
        <div class="result-item"><span>SCORE</span><b>{{ state.score }}</b></div>
        <div class="result-item"><span>LEVEL</span><b>{{ state.level }}</b></div>
      </div>
      <p v-if="state.rewardMessage" class="result-reward">{{ state.rewardMessage }}</p>
      <div class="result-actions">
        <button class="typ-btn" type="button" @click="click.again">AGAIN</button>
        <button class="typ-btn danger" type="button" @click="click.exit">EXIT</button>
      </div>
    </div>

    <GameRateDialog :visible="state.rateDialogOpen" game-key="typing" game-name="TYPING"
      accent-color="#ffb627" @close="click.closeRateDialog" />
    <GameRuleDialog :visible="state.ruleDialogOpen" game-name="TYPING" accent-color="#ffb627"
      v-bind="TYPING_RULE" @close="click.closeRuleDialog" />

    <section class="typ-shell">
      <aside class="typ-side left">
        <button class="typ-btn" type="button" :disabled="!canResumeFromPause" @click="click.resume">START</button>
        <button class="typ-btn" type="button" :disabled="!canPauseWhilePlaying" @click="click.pause">PAUSE</button>
        <button class="typ-btn" type="button" @click="click.replay">REPLAY</button>
        <button class="typ-btn link" type="button" @click="click.end">END</button>
        <button class="typ-btn" type="button" @click="click.openRateDialog">CONVERT</button>
        <button class="typ-btn" type="button" @click="click.openRuleDialog">RULE</button>
      </aside>

      <section class="typ-center">
        <header class="typ-title-wrap">
          <h1 class="typ-title">TYPING</h1>
          <p class="typ-status" :class="statusClass">{{ statusText }}</p>
        </header>

        <div class="typ-frame">
          <div class="typ-stage" :class="{ shake: state.stageShake, 'wrong-flash': state.wrongFlash }">
            <div v-for="w in state.words" :key="w.id" class="typ-word" :class="{ locked: w.id === state.lockedId }"
              :style="`left:${w.x}px; top:${w.y}px;`">
              <span class="done">{{ w.text.slice(0, w.progress) }}</span><span class="rest">{{ w.text.slice(w.progress) }}</span>
            </div>

            <div v-for="c in state.completions" :key="c.id" class="typ-completion" :style="`left:${c.x}px; top:${c.y}px;`">
              +{{ c.gained }}
            </div>
          </div>
          <div class="typ-panel">
            <span>SCORE: {{ state.score }}</span>
            <span>LV: {{ state.level }}</span>
            <span>LIVES: {{ '❤'.repeat(Math.max(0, state.lives)) }}</span>
          </div>
          <div class="typ-panel sub">
            <span>COMBO x{{ state.multiplier }} ({{ state.combo }})</span>
          </div>
          <div class="typ-target-panel">
            <div class="row"><span class="label">TARGET</span><span class="value">{{ lockedWord ? lockedWord.text : '—' }}</span></div>
            <div class="row"><span class="label">INPUT</span><span class="value">{{ lockedWord ? lockedWord.text.slice(0, lockedWord.progress) : '—' }}</span></div>
          </div>
        </div>

        <p class="typ-message">{{ state.message }}</p>
      </section>

      <aside class="typ-side right">
        <div class="typ-help-panel">
          <p class="typ-help-title">HOW TO PLAY</p>
          <p class="typ-help-text">直接用鍵盤輸入畫面上的單字，不分大小寫；打完一個字得分並往上飄走，飄出畫面頂端未完成算 MISS 扣命；連續完成提升連擊倍率。</p>
        </div>
      </aside>
    </section>
  </main>
</template>

<style scoped lang="scss">
.typ-page {
  position: relative;
  min-height: 100vh;
  display: grid;
  place-items: center;
  background: radial-gradient(circle at top, #241505, #060301 60%);
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
    background: radial-gradient(circle at 20% 20%, rgba(255, 182, 39, 0.16), transparent 45%),
      radial-gradient(circle at 80% 70%, rgba(255, 210, 140, 0.1), transparent 40%);
    filter: blur(40px);
    animation: ambient-drift 12s ease-in-out infinite alternate;
  }

  &::after {
    background: linear-gradient(115deg, rgba(255, 182, 39, 0.05), rgba(0, 0, 0, 0));
    animation: ambient-pulse 4.6s ease-in-out infinite;
  }

  .typ-overlay {
    position: absolute;
    inset: 0;
    background-image: linear-gradient(rgba(255, 182, 39, 0.05) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255, 182, 39, 0.05) 1px, transparent 1px);
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
      color: #ffb627;
      font-size: clamp(2rem, 8vw, 4rem);
      letter-spacing: 0.25rem;
      font-weight: 900;
    }

    .mask-count {
      color: #ffb627;
      font-size: clamp(3rem, 12vw, 7rem);
      font-weight: 900;
      line-height: 1;
    }

    &.waiting-mask {
      background: rgba(0, 0, 0, 0.88);

      .waiting-subtitle {
        margin: 0;
        color: #ffe0a3;
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
        border: 1px solid rgba(255, 182, 39, 0.4);
        background: rgba(40, 24, 6, 0.65);
        color: #ffe6bd;
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

  .typ-shell {
    position: relative;
    z-index: 1;
    width: min(1100px, 100%);
    padding: 24px;
    display: grid;
    grid-template-columns: 180px 1fr 180px;
    gap: 20px;
    align-items: center;
  }

  .typ-side {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .typ-btn {
    position: relative;
    overflow: hidden;
    border: 1px solid rgba(255, 182, 39, 0.4);
    border-radius: 6px;
    padding: 10px 12px;
    background: rgba(40, 24, 6, 0.75);
    color: #ffb627;
    font-weight: 700;
    letter-spacing: 0.5px;
    transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;

    &::after {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(105deg, transparent 35%, rgba(255, 224, 179, 0.25) 50%, transparent 65%);
      transform: translateX(-150%);
      transition: transform 0.35s ease;
      pointer-events: none;
    }

    &:hover {
      border-color: #ffb627;
      box-shadow: 0 0 12px rgba(255, 182, 39, 0.35);
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

  .typ-center {
    text-align: center;

    .typ-title-wrap {
      margin-bottom: 8px;
    }

    .typ-title {
      margin: 0;
      color: #ffb627;
      font-size: clamp(1.5rem, 4.4vw, 2.6rem);
      letter-spacing: 0.1rem;
      font-weight: 900;
      text-shadow: 0 0 14px rgba(255, 182, 39, 0.5);
      animation: title-float 2.6s ease-in-out infinite;
    }

    .typ-status {
      margin: 2px 0 0;
      color: #ffe6bd;
      font-size: 0.9rem;
      letter-spacing: 0.2rem;

      &.is-playing {
        color: #ffb627;
      }

      &.is-pause {
        color: #ffcc33;
      }

      &.is-gameover {
        color: #ff5e5e;
      }
    }

    .typ-frame {
      width: fit-content;
      margin: 12px auto 0;
      padding: 12px;
      background: #1a0f03;
      border: 10px solid #402c0f;
      border-radius: 18px;
      box-shadow: 0 0 0 1px rgba(255, 182, 39, 0.2), 0 0 24px rgba(255, 182, 39, 0.16);
      animation: frame-glow 5.4s ease-in-out infinite;
    }

    .typ-stage {
      box-sizing: content-box;
      position: relative;
      width: 400px;
      height: 460px;
      background: #0a0602;
      border: 2px solid #000;
      border-radius: 8px;
      overflow: hidden;

      &.shake {
        animation: stage-shake 260ms ease-out;
      }

      &.wrong-flash {
        box-shadow: inset 0 0 0 3px rgba(255, 60, 60, 0.7);
      }

      .typ-word {
        position: absolute;
        font-family: 'Share Tech Mono', monospace;
        font-weight: 700;
        font-size: 20px;
        letter-spacing: 0.05em;
        white-space: nowrap;
        color: #5a4a2e;
        text-shadow: 0 0 4px rgba(0, 0, 0, 0.6);

        .done {
          color: #ffb627;
          text-shadow: 0 0 8px rgba(255, 182, 39, 0.8);
        }

        &.locked .rest {
          color: #ffe6bd;
        }
      }

      .typ-completion {
        position: absolute;
        font-family: 'Press Start 2P', monospace;
        font-size: 12px;
        color: #ffe066;
        text-shadow: 0 0 8px rgba(255, 224, 102, 0.8);
        pointer-events: none;
        animation: completion-float 0.5s ease-out both;
      }
    }

    .typ-panel {
      margin-top: 10px;
      display: flex;
      justify-content: space-between;
      color: #ffb627;
      font-weight: 800;
      text-shadow: 0 0 6px rgba(255, 182, 39, 0.45);

      &.sub {
        margin-top: 4px;
        font-size: 0.78rem;
        color: #ffe6bd;
        text-shadow: none;
        font-weight: 700;
        justify-content: center;
      }
    }

    .typ-target-panel {
      margin-top: 10px;
      border: 1px solid rgba(255, 182, 39, 0.3);
      border-radius: 6px;
      padding: 8px 10px;
      background: rgba(40, 24, 6, 0.5);
      text-align: left;
      font-family: 'Share Tech Mono', monospace;
      font-size: 0.8rem;

      .row {
        display: flex;
        gap: 10px;

        & + .row {
          margin-top: 4px;
        }
      }

      .label {
        color: #ffb627;
        font-weight: 800;
        width: 60px;
        flex-shrink: 0;
      }

      .value {
        color: #ffe6bd;
        letter-spacing: 0.08em;
      }
    }

    .typ-message {
      margin-top: 14px;
      color: #ffe6bd;
      font-size: 0.85rem;
      animation: subtle-fade 2.8s ease-in-out infinite;
    }
  }

  .typ-help-panel {
    border: 1px solid rgba(255, 182, 39, 0.3);
    border-radius: 8px;
    padding: 12px;
    background: rgba(40, 24, 6, 0.5);

    .typ-help-title {
      margin: 0 0 6px;
      color: #ffb627;
      font-size: 0.75rem;
      letter-spacing: 0.14rem;
      font-weight: 800;
    }

    .typ-help-text {
      margin: 0;
      color: #ffe6bd;
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
    box-shadow: 0 0 0 1px rgba(255, 182, 39, 0.2), 0 0 24px rgba(255, 182, 39, 0.16);
  }

  50% {
    box-shadow: 0 0 0 1px rgba(255, 220, 160, 0.35), 0 0 40px rgba(255, 182, 39, 0.3);
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
    transform: translate3d(-4px, 2px, 0);
  }

  50% {
    transform: translate3d(4px, -2px, 0);
  }

  75% {
    transform: translate3d(-3px, 2px, 0);
  }

  100% {
    transform: translate3d(0, 0, 0);
  }
}

@keyframes completion-float {
  0% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }

  100% {
    opacity: 0;
    transform: translateY(-40px) scale(1.15);
  }
}

@media (max-width: 980px) {
  .typ-page {
    .typ-shell {
      grid-template-columns: 1fr;
      padding: 16px;
    }

    .typ-side {
      flex-direction: row;
      flex-wrap: wrap;
      justify-content: center;
    }
  }
}
</style>
