<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useGameHistory } from '~/composables/useGameHistory'

type MinesweeperStatus = 'ready' | 'playing' | 'pause' | 'gameover'
type Cell = { mine: boolean; revealed: boolean; flagged: boolean; adjacent: number }
type FlatCell = Cell & { r: number; c: number }
type LevelConfig = { size: number; mines: number; baseScore: number; perSecond: number; floorScore: number }
type RevealResult = { changed: boolean; hitMine: boolean; cleared: boolean }

const CELL_SIZE = 32
/** 過關「LEVEL CLEAR」過場停留時間；比照 pong finishRound 的短暫過場，但這裡不需要 READY 倒數（見 design.md Decision 1） */
const LEVEL_CLEAR_MS = 1500
const ACCENT = '#39d98a'
/**
 * 測試工具（顯示地雷、跳至關卡）目前預設關閉——功能本身完整保留，只是 UI 入口先藏起來，
 * 不對一般玩家開放。日後後台做出來後，這裡應該改成讀後台設定/API（例如管理員登入後才回傳
 * true），取代現在寫死的 false，不需要再動這兩個工具本身的邏輯或畫面。
 */
const TEST_TOOLS_ENABLED = false

/**
 * 5 關固定關卡制（見 design.md Decision 4／5）：棋盤 8×8→12×12、地雷 10→30 遞增；
 * 每關「基礎分 - 花費秒數 × 每秒扣分」（下限保底分），總分＝已過關卡加總。
 * 理論總分上限 = 100+150+220+300+400 = 1170（僅數學上限，非實際可達）。
 */
/**
 * 地雷密度重新設計為 9.4%→12.3%→16.0%→18.2%→20.8%，對齊 Windows 踩地雷的經典難度基準
 * （初級 9×9/10雷≈12.3%、中級≈15.6%、高級 30×16/99雷≈20.6%）：原本 Lv1 的 15.6% 密度
 * 已經落在 Windows「中級」區間，對「第一關」來說偏難、起手不夠簡單；重新設計後 Lv1 明顯低於
 * Windows 初級（真的簡單），Lv2 對齊 Windows 初級密度，Lv3 對齊中級，Lv5 對齊高級（真的困難），
 * 五關之間密度級距也更平滑（+2.9/+3.7/+2.2/+2.6 個百分點，原本是 +0.4/+2.0/+1.8/+1.0，
 * 前段落差太小、後段偏大）。棋盤尺寸（8→12）與計分公式維持不變，只調難度曲線本身。
 */
const LEVELS: LevelConfig[] = [
  { size: 8, mines: 6, baseScore: 100, perSecond: 2, floorScore: 20 },
  { size: 9, mines: 10, baseScore: 150, perSecond: 2, floorScore: 30 },
  { size: 10, mines: 16, baseScore: 220, perSecond: 2, floorScore: 50 },
  { size: 11, mines: 22, baseScore: 300, perSecond: 3, floorScore: 60 },
  { size: 12, mines: 30, baseScore: 400, perSecond: 3, floorScore: 80 }
]

const calcLevelScore = (config: LevelConfig, seconds: number): number =>
  Math.max(config.floorScore, config.baseScore - seconds * config.perSecond)

/**
 * 踩地雷回合制引擎：非 tick-driven（見 design.md Decision 2），格子狀態只在玩家點擊時改變，
 * 翻格／連鎖展開／插旗／勝負判定全部在 reveal()／toggleFlag() 裡同步完成。
 * 地雷延後到首次翻格才佈局，排除首格與其 8 鄰居（首格必安全，見 design.md Decision 3）。
 * 只有這一款遊戲用到，不抽到 app/utils/（比照 runner／pong 的既有做法）。
 */
class MinesweeperEngine {
  size = 0
  mineCount = 0
  board: Cell[][] = []
  private minesPlaced = false
  private revealedCount = 0
  flagCount = 0

  reset(config: LevelConfig) {
    this.size = config.size
    this.mineCount = config.mines
    this.minesPlaced = false
    this.revealedCount = 0
    this.flagCount = 0
    this.board = []
    for (let r = 0; r < this.size; r += 1) {
      const row: Cell[] = []
      for (let c = 0; c < this.size; c += 1) {
        row.push({ mine: false, revealed: false, flagged: false, adjacent: 0 })
      }
      this.board.push(row)
    }
  }

  private inBounds(r: number, c: number): boolean {
    return r >= 0 && r < this.size && c >= 0 && c < this.size
  }

  private neighbors(r: number, c: number): Array<[number, number]> {
    const list: Array<[number, number]> = []
    for (let dr = -1; dr <= 1; dr += 1) {
      for (let dc = -1; dc <= 1; dc += 1) {
        if (dr === 0 && dc === 0) continue
        const nr = r + dr
        const nc = c + dc
        if (this.inBounds(nr, nc)) list.push([nr, nc])
      }
    }
    return list
  }

  /** 首次翻格後才呼叫：排除首格與其 8 鄰居，於剩餘候選格中隨機佈雷，再算出每格週圍地雷數 */
  private placeMines(safeR: number, safeC: number) {
    const forbidden = new Set<string>()
    forbidden.add(`${safeR},${safeC}`)
    this.neighbors(safeR, safeC).forEach(([nr, nc]) => forbidden.add(`${nr},${nc}`))

    const candidates: Array<[number, number]> = []
    for (let r = 0; r < this.size; r += 1) {
      for (let c = 0; c < this.size; c += 1) {
        if (!forbidden.has(`${r},${c}`)) candidates.push([r, c])
      }
    }
    // Fisher–Yates 洗牌後取前 mineCount 個
    for (let i = candidates.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1))
      const tmp = candidates[i]!
      candidates[i] = candidates[j]!
      candidates[j] = tmp
    }
    const mineCells = candidates.slice(0, Math.min(this.mineCount, candidates.length))
    mineCells.forEach(([r, c]) => {
      this.board[r]![c]!.mine = true
    })
    for (let r = 0; r < this.size; r += 1) {
      for (let c = 0; c < this.size; c += 1) {
        const cell = this.board[r]![c]!
        if (cell.mine) continue
        cell.adjacent = this.neighbors(r, c).filter(([nr, nc]) => this.board[nr]![nc]!.mine).length
      }
    }
    this.minesPlaced = true
  }

  reveal(r: number, c: number): RevealResult {
    if (!this.inBounds(r, c)) return { changed: false, hitMine: false, cleared: false }
    const cell = this.board[r]![c]!
    if (cell.revealed || cell.flagged) return { changed: false, hitMine: false, cleared: false }

    if (!this.minesPlaced) this.placeMines(r, c)

    if (cell.mine) {
      cell.revealed = true
      return { changed: true, hitMine: true, cleared: false }
    }

    this.floodReveal(r, c)
    const cleared = this.revealedCount >= this.size * this.size - this.mineCount
    return { changed: true, hitMine: false, cleared }
  }

  /** 翻開起始格；若為 0 格（週圍無雷）則以堆疊連鎖展開相鄰的安全格 */
  private floodReveal(sr: number, sc: number) {
    const stack: Array<[number, number]> = [[sr, sc]]
    while (stack.length) {
      const [r, c] = stack.pop()!
      const cell = this.board[r]![c]!
      if (cell.revealed || cell.flagged || cell.mine) continue
      cell.revealed = true
      this.revealedCount += 1
      if (cell.adjacent === 0) {
        this.neighbors(r, c).forEach(([nr, nc]) => {
          const ncell = this.board[nr]![nc]!
          if (!ncell.revealed && !ncell.flagged && !ncell.mine) stack.push([nr, nc])
        })
      }
    }
  }

  toggleFlag(r: number, c: number): boolean {
    if (!this.inBounds(r, c)) return false
    const cell = this.board[r]![c]!
    if (cell.revealed) return false
    cell.flagged = !cell.flagged
    this.flagCount += cell.flagged ? 1 : -1
    return true
  }

  /** 踩雷結算時攤開全部地雷（比照 Windows 踩地雷輸掉時的呈現） */
  revealAllMines() {
    for (let r = 0; r < this.size; r += 1) {
      for (let c = 0; c < this.size; c += 1) {
        const cell = this.board[r]![c]!
        if (cell.mine) cell.revealed = true
      }
    }
  }

  getSnapshot() {
    return {
      size: this.size,
      board: this.board.map((row) => row.map((cell) => ({ ...cell }))),
      flagCount: this.flagCount,
      mineCount: this.mineCount
    }
  }
}

const router = useRouter()
const engine = new MinesweeperEngine()
const gameHistory = useGameHistory()

const state = reactive({
  status: 'ready' as MinesweeperStatus,
  board: [] as Cell[][],
  boardSize: LEVELS[0]!.size,
  currentLevelIndex: 0,
  elapsedSeconds: 0,
  totalScore: 0,
  clearedLevels: 0,
  flagCount: 0,
  mineCount: LEVELS[0]!.mines,
  flagMode: false,
  /** 測試用：顯示地雷位置，純前端 UI 疊圖，不動 engine 的 revealed/flagged 狀態，不影響計分與紀錄 */
  debugRevealMines: false,
  reachedLevel: 1,
  allCleared: false,
  lastLevelSeconds: 0,
  lastLevelGained: 0,
  message: '按「開始」後點擊格子翻開，右鍵或開啟插旗模式標記地雷。',
  rewardMessage: '',
  waitingOverlayVisible: true,
  levelClearOverlayVisible: false,
  resultOverlayVisible: false,
  rateDialogOpen: false,
  ruleDialogOpen: false
})

const MINESWEEPER_RULE = {
  description:
    '經典踩地雷：左鍵／點擊翻開格子，數字代表週圍 8 格的地雷數，翻到空白格會自動連鎖展開一片安全區；' +
    '右鍵可插旗標記疑似地雷（觸控裝置請先開啟「🚩 插旗模式」，之後點擊即為插旗）。每關第一次翻格保證安全，' +
    '翻開全部非地雷格即過關進入下一關，任一關踩到地雷則整場立即結束。',
  scoreRule:
    '每關分數 ＝ 基礎分 － 花費秒數 × 每秒扣分（不低於該關保底分），越快過關分數越高；' +
    '最終 SCORE ＝ 已過關卡的分數加總，五關全破為理論最高分（1170）。',
  levels: LEVELS.map((lv, idx) => ({
    level: idx + 1,
    condition: `${lv.size}×${lv.size}／${lv.mines} 雷／基礎 ${lv.baseScore} 分（保底 ${lv.floorScore}）`
  })),
  levelsTitle: '關卡數值',
  note: '難度隨關卡遞增（棋盤變大、地雷變多）；計時從每關第一次翻格開始，插旗不計入翻格。'
}

let tickTimer: ReturnType<typeof setInterval> | null = null
let levelClearTimer: ReturnType<typeof setTimeout> | null = null
/** 本關第一次翻格的時間戳；null 表示本關尚未開始計時 */
let levelStartAt: number | null = null
/** 暫停起點；resume 時把 levelStartAt 往後平移暫停時長，讓計時實際排除暫停時間 */
let pausedAt: number | null = null

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
    !state.levelClearOverlayVisible &&
    !state.resultOverlayVisible
)
const canPauseWhilePlaying = computed(() => state.status === 'playing')
const minesRemaining = computed(() => state.mineCount - state.flagCount)
const stageStyle = computed(() => `--cell: ${CELL_SIZE}px;`)
const boardStyle = computed(() => `grid-template-columns: repeat(${state.boardSize}, var(--cell));`)
const flatCells = computed<FlatCell[]>(() => {
  const out: FlatCell[] = []
  state.board.forEach((row, r) => {
    row.forEach((cell, c) => {
      out.push({ ...cell, r, c })
    })
  })
  return out
})
const nextLevelInfo = computed(() => {
  const next = LEVELS[state.currentLevelIndex + 1]
  return next ? `${next.size}×${next.size}／${next.mines} 雷` : ''
})

/** 私有工具方法：計時器管理、棋盤狀態同步、格子外觀 */
const _handlers = {
  syncBoard: () => {
    const snap = engine.getSnapshot()
    state.board = snap.board
    state.boardSize = snap.size
    state.flagCount = snap.flagCount
    state.mineCount = snap.mineCount
  },
  stopTickTimer: () => {
    if (tickTimer) {
      clearInterval(tickTimer)
      tickTimer = null
    }
  },
  /** 每秒只更新「已花費秒數」HUD 顯示，不驅動任何棋盤邏輯（見 design.md Decision 2） */
  startTickTimer: () => {
    _handlers.stopTickTimer()
    tickTimer = setInterval(() => {
      if (state.status !== 'playing') return
      if (levelStartAt === null) return
      state.elapsedSeconds = Math.floor((Date.now() - levelStartAt) / 1000)
    }, 1000)
  },
  stopLevelClearTimer: () => {
    if (levelClearTimer) {
      clearTimeout(levelClearTimer)
      levelClearTimer = null
    }
  },
  cellClass: (cell: FlatCell): string => {
    if (!cell.revealed) {
      if (cell.flagged) return 'is-covered is-flag'
      if (state.debugRevealMines && cell.mine) return 'is-covered is-debug-mine'
      return 'is-covered'
    }
    if (cell.mine) return 'is-revealed is-mine'
    if (cell.adjacent > 0) return `is-revealed n-${cell.adjacent}`
    return 'is-revealed is-empty'
  },
  cellChar: (cell: FlatCell): string => {
    if (!cell.revealed) {
      if (cell.flagged) return '🚩'
      if (state.debugRevealMines && cell.mine) return '💣'
      return ''
    }
    if (cell.mine) return '💣'
    return cell.adjacent > 0 ? String(cell.adjacent) : ''
  }
}

const _actions = {
  recordHistory: async () => {
    state.rewardMessage = ''
    try {
      const result = await gameHistory.actions.record('minesweeper', 'MINESWEEPER', {
        score: state.totalScore,
        level: state.reachedLevel,
        meta: {
          reachedLevel: state.reachedLevel,
          clearedLevels: state.clearedLevels,
          allCleared: state.allCleared
        }
      })
      if (result.coinReward > 0) {
        state.rewardMessage = result.coinCapped ? `+${result.coinReward} coin（已達今日上限）` : `+${result.coinReward} coin`
      }
    } catch {
      // 紀錄寫入失敗不影響遊戲本身，靜默略過
    }
  },
  /** 生成指定關卡的空白棋盤（不放雷，地雷延後到首次翻格才生成），並重置該關計時 */
  setupLevel: (index: number) => {
    engine.reset(LEVELS[index] ?? LEVELS[0]!)
    levelStartAt = null
    pausedAt = null
    state.elapsedSeconds = 0
    _handlers.syncBoard()
  },
  finishGame: (allCleared: boolean) => {
    _handlers.stopTickTimer()
    _handlers.stopLevelClearTimer()
    if (!allCleared) {
      engine.revealAllMines()
      _handlers.syncBoard()
    }
    state.allCleared = allCleared
    state.reachedLevel = state.currentLevelIndex + 1
    state.status = 'gameover'
    state.message = allCleared
      ? `恭喜全破 5 關！總分 ${state.totalScore}。`
      : `第 ${state.reachedLevel} 關踩到地雷，遊戲結束。`
    state.resultOverlayVisible = true
    _actions.recordHistory()
  },
  /** 過關：把本關分數計入總分，若非最後一關則短暫過場後生成下一關棋盤（不需 READY 倒數） */
  clearLevel: () => {
    const config = LEVELS[state.currentLevelIndex] ?? LEVELS[0]!
    const seconds = levelStartAt !== null ? Math.floor((Date.now() - levelStartAt) / 1000) : 0
    const gained = calcLevelScore(config, seconds)
    state.totalScore += gained
    state.clearedLevels += 1
    state.lastLevelSeconds = seconds
    state.lastLevelGained = gained

    if (state.currentLevelIndex >= LEVELS.length - 1) {
      _actions.finishGame(true)
      return
    }

    state.status = 'pause'
    state.levelClearOverlayVisible = true
    state.message = `第 ${state.currentLevelIndex + 1} 關完成！`
    _handlers.stopLevelClearTimer()
    levelClearTimer = setTimeout(() => {
      levelClearTimer = null
      state.levelClearOverlayVisible = false
      state.currentLevelIndex += 1
      _actions.setupLevel(state.currentLevelIndex)
      state.status = 'playing'
      state.message = '遊戲進行中...'
    }, LEVEL_CLEAR_MS)
  },
  resetGame: () => {
    _handlers.stopTickTimer()
    _handlers.stopLevelClearTimer()
    state.currentLevelIndex = 0
    state.totalScore = 0
    state.clearedLevels = 0
    state.reachedLevel = 1
    state.allCleared = false
    state.lastLevelSeconds = 0
    state.lastLevelGained = 0
    state.flagMode = false
    _actions.setupLevel(0)
    state.status = 'ready'
    state.waitingOverlayVisible = true
    state.levelClearOverlayVisible = false
    state.resultOverlayVisible = false
    state.rewardMessage = ''
    state.message = '按「開始」後點擊格子翻開，右鍵或開啟插旗模式標記地雷。'
  },
  startGame: () => {
    if (state.status === 'playing') return
    if (state.status === 'gameover') _actions.resetGame()
    state.waitingOverlayVisible = false
    state.resultOverlayVisible = false
    state.levelClearOverlayVisible = false
    state.currentLevelIndex = 0
    state.totalScore = 0
    state.clearedLevels = 0
    _actions.setupLevel(0)
    state.status = 'playing'
    state.message = '遊戲進行中...第一次翻格開始計時。'
    _handlers.startTickTimer()
  },
  pauseGame: () => {
    if (state.status !== 'playing') return
    state.status = 'pause'
    state.message = '已暫停（計時暫停）'
    pausedAt = Date.now()
  },
  resumeGame: () => {
    if (!canResumeFromPause.value) return
    if (levelStartAt !== null && pausedAt !== null) {
      levelStartAt += Date.now() - pausedAt
    }
    pausedAt = null
    state.status = 'playing'
    state.message = '遊戲進行中...'
  },
  playAgain: () => {
    _actions.resetGame()
    _actions.startGame()
  },
  /**
   * 測試用：直接跳到指定關卡開局，略過「必須依序過關」的正常流程（見 design.md Non-Goals
   * 明確排除玩家跳關，這裡是測試工具，不是正式玩法，UI 上刻意跟正常操作區隔）。
   * 跳關會重置總分／過關數，避免測試時的分數混進真正的紀錄裡。
   */
  testJumpToLevel: (index: number) => {
    const clamped = Math.max(0, Math.min(LEVELS.length - 1, index))
    _handlers.stopTickTimer()
    _handlers.stopLevelClearTimer()
    state.waitingOverlayVisible = false
    state.resultOverlayVisible = false
    state.levelClearOverlayVisible = false
    state.currentLevelIndex = clamped
    state.totalScore = 0
    state.clearedLevels = 0
    state.allCleared = false
    state.reachedLevel = clamped + 1
    _actions.setupLevel(clamped)
    state.status = 'playing'
    state.message = `【測試模式】直接跳至第 ${clamped + 1} 關，總分已歸零。`
    _handlers.startTickTimer()
  },
  endGameNow: () => {
    _handlers.stopTickTimer()
    _handlers.stopLevelClearTimer()
    state.waitingOverlayVisible = false
    state.levelClearOverlayVisible = false
    state.reachedLevel = state.currentLevelIndex + 1
    state.allCleared = false
    state.status = 'gameover'
    state.message = '本場已結束。'
    state.resultOverlayVisible = true
    _actions.recordHistory()
  },
  doReveal: (r: number, c: number) => {
    if (state.status !== 'playing') return
    if (levelStartAt === null) levelStartAt = Date.now()
    const result = engine.reveal(r, c)
    if (!result.changed) return
    _handlers.syncBoard()
    if (result.hitMine) {
      _actions.finishGame(false)
      return
    }
    if (result.cleared) _actions.clearLevel()
  },
  doFlag: (r: number, c: number) => {
    if (state.status !== 'playing') return
    if (engine.toggleFlag(r, c)) _handlers.syncBoard()
  }
}

const click = {
  cell: (r: number, c: number) => {
    if (state.flagMode) _actions.doFlag(r, c)
    else _actions.doReveal(r, c)
  },
  cellRight: (r: number, c: number) => _actions.doFlag(r, c),
  toggleFlagMode: () => {
    state.flagMode = !state.flagMode
  },
  toggleDebugMines: () => {
    state.debugRevealMines = !state.debugRevealMines
  },
  testLevel: (index: number) => _actions.testJumpToLevel(index),
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
  _actions.resetGame()
  state.waitingOverlayVisible = true
})

onBeforeUnmount(() => {
  _handlers.stopTickTimer()
  _handlers.stopLevelClearTimer()
})
</script>

<template>
  <main class="ms-page" :class="`state-${state.status}`">
    <div class="ms-overlay" />
    <div v-if="state.waitingOverlayVisible" class="game-mask waiting-mask">
      <div class="mask-title">WELCOME</div>
      <p class="waiting-subtitle">MINESWEEPER</p>
      <p class="waiting-hint">5 關關卡制 · 越快過關分數越高 · 觸控請用「🚩 插旗模式」</p>
      <button class="ms-btn waiting-btn waiting-start" type="button" @click="click.start">START</button>
      <button class="ms-btn link waiting-btn" type="button" @click="click.openRateDialog">CONVERT</button>
      <button class="ms-btn link waiting-btn" type="button" @click="click.openRuleDialog">RULE</button>
    </div>
    <div v-if="state.levelClearOverlayVisible" class="game-mask levelclear-mask">
      <div class="mask-title win">LEVEL CLEAR</div>
      <div class="result-list">
        <div class="result-item"><span>第 {{ state.currentLevelIndex + 1 }} 關耗時</span><b>{{ state.lastLevelSeconds }}s</b></div>
        <div class="result-item"><span>本關得分</span><b>+{{ state.lastLevelGained }}</b></div>
        <div class="result-item"><span>累計分數</span><b>{{ state.totalScore }}</b></div>
      </div>
      <p class="levelclear-next">進入第 {{ state.currentLevelIndex + 2 }} 關（{{ nextLevelInfo }}）</p>
    </div>
    <div v-if="state.resultOverlayVisible" class="game-mask result-mask">
      <div class="mask-title" :class="{ win: state.allCleared }">{{ state.allCleared ? 'ALL CLEAR' : 'RESULT' }}</div>
      <div class="result-list">
        <div class="result-item"><span>SCORE</span><b>{{ state.totalScore }}</b></div>
        <div class="result-item"><span>過關數</span><b>{{ state.clearedLevels }} / {{ LEVELS.length }}</b></div>
        <div class="result-item">
          <span>{{ state.allCleared ? '結果' : '止步於' }}</span>
          <b>{{ state.allCleared ? '全破' : `第 ${state.reachedLevel} 關` }}</b>
        </div>
      </div>
      <p v-if="state.rewardMessage" class="result-reward">{{ state.rewardMessage }}</p>
      <div class="result-actions">
        <button class="ms-btn" type="button" @click="click.again">AGAIN</button>
        <button class="ms-btn danger" type="button" @click="click.exit">EXIT</button>
      </div>
    </div>

    <GameRateDialog :visible="state.rateDialogOpen" game-key="minesweeper" game-name="MINESWEEPER" :accent-color="ACCENT"
      @close="click.closeRateDialog" />
    <GameRuleDialog :visible="state.ruleDialogOpen" game-name="MINESWEEPER" :accent-color="ACCENT" v-bind="MINESWEEPER_RULE"
      @close="click.closeRuleDialog" />

    <section class="ms-shell">
      <aside class="ms-side left">
        <button class="ms-btn" type="button" :disabled="!canResumeFromPause" @click="click.resume">START</button>
        <button class="ms-btn" type="button" :disabled="!canPauseWhilePlaying" @click="click.pause">PAUSE</button>
        <button class="ms-btn" type="button" @click="click.replay">REPLAY</button>
        <button class="ms-btn link" type="button" @click="click.end">END</button>
        <button class="ms-btn" type="button" @click="click.openRateDialog">CONVERT</button>
        <button class="ms-btn" type="button" @click="click.openRuleDialog">RULE</button>
      </aside>

      <section class="ms-center">
        <header class="ms-title-wrap">
          <h1 class="ms-title">MINESWEEPER</h1>
          <p class="ms-status" :class="statusClass">{{ statusText }}</p>
        </header>

        <div class="ms-frame">
          <div class="ms-stage" :style="stageStyle" @contextmenu.prevent>
            <div class="ms-board" :style="boardStyle">
              <button v-for="cell in flatCells" :key="`${cell.r}-${cell.c}`" type="button" class="ms-cell"
                :class="_handlers.cellClass(cell)" @click="click.cell(cell.r, cell.c)"
                @contextmenu.prevent="click.cellRight(cell.r, cell.c)">{{ _handlers.cellChar(cell) }}</button>
            </div>
            <div v-if="state.status === 'pause' && !state.levelClearOverlayVisible" class="ms-board-veil">PAUSED</div>
          </div>
          <div class="ms-panel">
            <span>LEVEL: {{ state.currentLevelIndex + 1 }}/{{ LEVELS.length }}</span>
            <span>TIME: {{ state.elapsedSeconds }}s</span>
            <span>MINE: {{ minesRemaining }}</span>
            <span>SCORE: {{ state.totalScore }}</span>
          </div>
        </div>

        <div class="ms-tools">
          <button type="button" class="ms-flag-toggle" :class="{ active: state.flagMode }" @click="click.toggleFlagMode">
            🚩 插旗模式：{{ state.flagMode ? 'ON' : 'OFF' }}
          </button>
          <button v-if="TEST_TOOLS_ENABLED" type="button" class="ms-flag-toggle is-debug"
            :class="{ active: state.debugRevealMines }" @click="click.toggleDebugMines">
            🔍 測試：顯示地雷 {{ state.debugRevealMines ? 'ON' : 'OFF' }}
          </button>
        </div>

        <div v-if="TEST_TOOLS_ENABLED" class="ms-tools ms-debug-levels">
          <span class="ms-debug-levels-label">🧪 測試：跳至關卡</span>
          <button v-for="(lv, idx) in LEVELS" :key="idx" type="button" class="ms-level-jump"
            :class="{ active: state.status === 'playing' && state.currentLevelIndex === idx }"
            :title="`${lv.size}×${lv.size}／${lv.mines} 雷`" @click="click.testLevel(idx)">
            {{ idx + 1 }}
          </button>
        </div>

        <p class="ms-message">{{ state.message }}</p>
      </section>

      <aside class="ms-side right">
        <div class="ms-help-panel">
          <p class="ms-help-title">HOW TO PLAY</p>
          <p class="ms-help-text">
            點擊翻開格子，數字為週圍地雷數，空白格自動連鎖展開；右鍵或開啟「插旗模式」後點擊插旗。
            翻開全部非地雷格即過關進下一關，踩到地雷整場結束。越快過關分數越高。
          </p>
        </div>
      </aside>
    </section>
  </main>
</template>

<style scoped lang="scss">
.ms-page {
  position: relative;
  min-height: 100vh;
  display: grid;
  place-items: center;
  background: radial-gradient(circle at top, #06170f, #010604 60%);
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
    background: radial-gradient(circle at 20% 20%, rgba(57, 217, 138, 0.16), transparent 45%),
      radial-gradient(circle at 80% 70%, rgba(120, 245, 190, 0.1), transparent 40%);
    filter: blur(40px);
    animation: ambient-drift 12s ease-in-out infinite alternate;
  }

  &::after {
    background: linear-gradient(115deg, rgba(57, 217, 138, 0.05), rgba(0, 0, 0, 0));
    animation: ambient-pulse 4.6s ease-in-out infinite;
  }

  .ms-overlay {
    position: absolute;
    inset: 0;
    background-image: linear-gradient(rgba(57, 217, 138, 0.05) 1px, transparent 1px),
      linear-gradient(90deg, rgba(57, 217, 138, 0.05) 1px, transparent 1px);
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
      color: #39d98a;
      font-size: clamp(2rem, 8vw, 4rem);
      letter-spacing: 0.25rem;
      font-weight: 900;

      &.win {
        color: #7bf0b8;
      }
    }

    &.waiting-mask {
      background: rgba(0, 0, 0, 0.88);

      .waiting-subtitle {
        margin: 0;
        color: #9ff5c6;
        letter-spacing: 0.3rem;
        font-size: 0.95rem;
      }

      .waiting-hint {
        margin: 0;
        color: #5fbd8f;
        font-size: 0.78rem;
        letter-spacing: 0.04em;
      }

      .waiting-btn {
        width: 180px;
      }
    }

    &.levelclear-mask {
      background: rgba(0, 0, 0, 0.72);

      .levelclear-next {
        margin: 4px 0 0;
        color: #9ff5c6;
        font-size: 0.85rem;
        letter-spacing: 0.1rem;
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
      border: 1px solid rgba(57, 217, 138, 0.4);
      background: rgba(6, 30, 20, 0.65);
      color: #d6ffe9;
      padding: 8px 10px;
    }

    .result-reward {
      margin: 8px 0 0;
      color: #b8ffd8;
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

  .ms-shell {
    position: relative;
    z-index: 1;
    width: min(1100px, 100%);
    padding: 24px;
    display: grid;
    grid-template-columns: 180px 1fr 180px;
    gap: 20px;
    align-items: center;
  }

  .ms-side {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .ms-btn {
    position: relative;
    overflow: hidden;
    border: 1px solid rgba(57, 217, 138, 0.4);
    border-radius: 6px;
    padding: 10px 12px;
    background: rgba(6, 24, 15, 0.75);
    color: #39d98a;
    font-weight: 700;
    letter-spacing: 0.5px;
    cursor: pointer;
    transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;

    &::after {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(105deg, transparent 35%, rgba(190, 255, 220, 0.25) 50%, transparent 65%);
      transform: translateX(-150%);
      transition: transform 0.35s ease;
      pointer-events: none;
    }

    &:hover {
      border-color: #39d98a;
      box-shadow: 0 0 12px rgba(57, 217, 138, 0.35);
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

  .ms-center {
    text-align: center;

    .ms-title-wrap {
      margin-bottom: 8px;
    }

    .ms-title {
      margin: 0;
      color: #39d98a;
      font-size: clamp(1.7rem, 5vw, 3rem);
      letter-spacing: 0.14rem;
      font-weight: 900;
      text-shadow: 0 0 14px rgba(57, 217, 138, 0.42);
      animation: title-float 2.6s ease-in-out infinite;
    }

    .ms-status {
      margin: 2px 0 0;
      color: #9ff5c6;
      font-size: 0.9rem;
      letter-spacing: 0.2rem;

      &.is-playing {
        color: #39d98a;
      }

      &.is-pause {
        color: #ffcc33;
      }

      &.is-gameover {
        color: #ff5e5e;
      }
    }

    .ms-frame {
      width: fit-content;
      margin: 12px auto 0;
      padding: 14px;
      background: #06170f;
      border: 10px solid #124a32;
      border-radius: 18px;
      box-shadow: 0 0 0 1px rgba(57, 217, 138, 0.2), 0 0 24px rgba(57, 217, 138, 0.14);
      animation: frame-glow 5.4s ease-in-out infinite;
    }

    .ms-stage {
      position: relative;
      box-sizing: content-box;
      width: fit-content;
      padding: 8px;
      background: #04100a;
      border: 2px solid #0a2417;
      border-radius: 8px;
    }

    .ms-board {
      display: grid;
      gap: 2px;
      width: fit-content;
    }

    .ms-cell {
      width: var(--cell);
      height: var(--cell);
      display: grid;
      place-items: center;
      padding: 0;
      font-weight: 800;
      font-size: 15px;
      line-height: 1;
      border: 1px solid #0a1f15;
      border-radius: 3px;
      cursor: pointer;
      user-select: none;
      -webkit-user-select: none;
      transition: background 0.1s ease;

      &.is-covered {
        background: linear-gradient(145deg, #123726, #0c2a1c);
        border-color: #1e5c3f;

        &:hover {
          background: linear-gradient(145deg, #1a4a34, #123726);
          border-color: #2a6b4a;
        }
      }

      &.is-flag {
        color: #ffd54a;
      }

      &.is-debug-mine {
        background: linear-gradient(145deg, #3a2a10, #2a1e0a);
        border: 1px dashed #ffb454;
        color: #ffb454;
        opacity: 0.85;
      }

      &.is-revealed {
        background: #06140d;
        border-color: #0f2c1e;
        cursor: default;
      }

      &.is-mine {
        background: #6e1414;
        border-color: #a51f1f;
      }

      &.n-1 {
        color: #4aa3ff;
      }

      &.n-2 {
        color: #39d98a;
      }

      &.n-3 {
        color: #ff5e5e;
      }

      &.n-4 {
        color: #b98cff;
      }

      &.n-5 {
        color: #ffb454;
      }

      &.n-6 {
        color: #2fd8d8;
      }

      &.n-7 {
        color: #ff8fd1;
      }

      &.n-8 {
        color: #cfe8ff;
      }
    }

    .ms-board-veil {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      background: rgba(2, 10, 6, 0.72);
      color: #9ff5c6;
      font-weight: 900;
      letter-spacing: 0.3rem;
      border-radius: 8px;
    }

    .ms-panel {
      margin-top: 10px;
      display: flex;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 8px 16px;
      color: #39d98a;
      font-weight: 800;
      text-shadow: 0 0 6px rgba(57, 217, 138, 0.45);
      /* 數字等寬，避免 TIME/SCORE/MINE 每次變動時字元寬度略有差異，
         連帶讓外層 .ms-frame（width: fit-content）跟著跳動 */
      font-variant-numeric: tabular-nums;
    }

    .ms-tools {
      margin-top: 12px;
      display: flex;
      justify-content: center;
      flex-wrap: wrap;
      gap: 10px;
    }

    .ms-flag-toggle {
      border: 1px solid rgba(57, 217, 138, 0.4);
      border-radius: 6px;
      padding: 8px 16px;
      background: rgba(6, 24, 15, 0.8);
      color: #9ff5c6;
      font-weight: 700;
      letter-spacing: 0.06em;
      cursor: pointer;
      transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;

      &:hover {
        border-color: #39d98a;
      }

      &.active {
        background: rgba(57, 217, 138, 0.22);
        border-color: #39d98a;
        color: #d6ffe9;
        box-shadow: 0 0 12px rgba(57, 217, 138, 0.4);
      }

      /* 測試用按鈕改用橘色系，跟正式操作的插旗模式（綠色系）明顯區隔 */
      &.is-debug {
        border-color: rgba(255, 180, 84, 0.4);
        color: #ffb454;

        &:hover {
          border-color: #ffb454;
        }

        &.active {
          background: rgba(255, 180, 84, 0.18);
          border-color: #ffb454;
          color: #ffdca6;
          box-shadow: 0 0 12px rgba(255, 180, 84, 0.4);
        }
      }
    }

    .ms-debug-levels {
      margin-top: 8px;
      align-items: center;
    }

    .ms-debug-levels-label {
      color: #ffb454;
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.05em;
      opacity: 0.85;
    }

    .ms-level-jump {
      width: 28px;
      height: 28px;
      border: 1px solid rgba(255, 180, 84, 0.4);
      border-radius: 6px;
      background: rgba(6, 24, 15, 0.8);
      color: #ffb454;
      font-weight: 800;
      font-size: 0.8rem;
      cursor: pointer;
      transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;

      &:hover {
        border-color: #ffb454;
      }

      &.active {
        background: rgba(255, 180, 84, 0.22);
        border-color: #ffb454;
        color: #ffdca6;
        box-shadow: 0 0 10px rgba(255, 180, 84, 0.4);
      }
    }

    .ms-message {
      margin-top: 14px;
      color: #9ff5c6;
      font-size: 0.85rem;
      animation: subtle-fade 2.8s ease-in-out infinite;
    }
  }

  .ms-help-panel {
    border: 1px solid rgba(57, 217, 138, 0.3);
    border-radius: 8px;
    padding: 12px;
    background: rgba(6, 24, 15, 0.5);

    .ms-help-title {
      margin: 0 0 6px;
      color: #39d98a;
      font-size: 0.75rem;
      letter-spacing: 0.14rem;
      font-weight: 800;
    }

    .ms-help-text {
      margin: 0;
      color: #9ff5c6;
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
    box-shadow: 0 0 0 1px rgba(57, 217, 138, 0.2), 0 0 24px rgba(57, 217, 138, 0.14);
  }

  50% {
    box-shadow: 0 0 0 1px rgba(120, 245, 190, 0.35), 0 0 40px rgba(57, 217, 138, 0.28);
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
  .ms-page {
    .ms-shell {
      grid-template-columns: 1fr;
      padding: 16px;
    }

    .ms-side {
      flex-direction: row;
      flex-wrap: wrap;
      justify-content: center;
    }
  }
}
</style>
