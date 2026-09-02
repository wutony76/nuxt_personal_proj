<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useGameHistory } from '~/composables/useGameHistory'
import TowerDefenseEngine, {
  TD_CELL_SIZE,
  TD_GRID_COLS,
  TD_GRID_ROWS,
  TD_STAGE_WIDTH,
  TD_STAGE_HEIGHT,
  isPathCell,
  TOWER_CONFIG,
  TOWER_MAX_LEVEL,
  type TowerKind,
  type TowerDefenseSnapshot,
  type UpgradeOptionKey
} from '~/utils/towerDefenseEngine'

type TdStatus = 'ready' | 'playing' | 'pause' | 'gameover'
type TowerView = TowerDefenseSnapshot['towers'][number]
type EnemyView = TowerDefenseSnapshot['enemies'][number]
type ProjectileView = TowerDefenseSnapshot['projectiles'][number]

const TICK_MS = 100
const TICK_DT = TICK_MS / 1000
const RESULT_DELAY_MS = 500
const ACCENT = '#6a994e'
const TOWER_KINDS: TowerKind[] = ['archer', 'cannon', 'ice']

const router = useRouter()
const engine = new TowerDefenseEngine()
const gameHistory = useGameHistory()

const state = reactive({
  status: 'ready' as TdStatus,
  gold: 0,
  hp: 0,
  wave: 1,
  score: 0,
  enemiesRemainingInWave: 0,
  towers: [] as TowerView[],
  enemies: [] as EnemyView[],
  projectiles: [] as ProjectileView[],
  pendingUpgradeOptions: null as TowerDefenseSnapshot['pendingUpgradeOptions'],
  upgradeMultipliers: { damage: 1, atkSpeed: 1, gold: 1, range: 1, slow: 1 },
  maxWaveReached: 1,
  selectedTowerKind: null as TowerKind | null,
  selectedTowerId: null as number | null,
  placementMessage: '',
  message: '選擇下方防禦塔後點擊草地格建造，抵禦沿路徑而來的敵人。',
  rewardMessage: '',
  waitingOverlayVisible: true,
  resultOverlayVisible: false,
  rateDialogOpen: false,
  ruleDialogOpen: false
})

const TOWER_DEFENSE_RULE = {
  description:
    '在固定地圖上放置防禦塔抵禦沿路徑前進的敵人：弓箭塔單體高攻速、炮塔範圍傷害、冰塔可減速敵人。' +
    '擊殺敵人取得 Gold，用於建造新塔或升級既有塔（每種塔最高 Lv3）。每波清完可從 3 個隨機強化中選 1，' +
    '效果會疊加。波次為無限模式，沒有破關終點，Boss 每 10 波固定出現一次，只有 HP 歸零才會結束遊戲。',
  scoreRule: 'SCORE ＝ 擊殺獎勵累積 ＋ 每過一波的通過獎勵，開放式計分無上限，撐到越高波次分數越高。',
  levelsTitle: '防禦塔',
  levels: [
    { level: '🏹 弓箭塔', condition: '單體攻擊、高攻速、中距離，適合快速集火' },
    { level: '💣 炮塔', condition: '範圍傷害、低攻速、高傷害，適合處理大量敵人' },
    { level: '❄️ 冰塔', condition: '傷害低，可降低敵人移動速度，用來控制敵人' }
  ],
  note: 'Boss 每 10 波固定重複出現（HP 隨波次成長），波次無上限，重點在挑戰「能撐到第幾波」。'
}

let tickTimer: ReturnType<typeof setInterval> | null = null
let resultDelayTimer: ReturnType<typeof setTimeout> | null = null
let placementMessageTimer: ReturnType<typeof setTimeout> | null = null

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
const canResumeFromPause = computed(() => state.status === 'pause' && !state.waitingOverlayVisible && !state.resultOverlayVisible)
const canPauseWhilePlaying = computed(() => state.status === 'playing')
const stageStyle = computed(() => `width:${TD_STAGE_WIDTH}px; height:${TD_STAGE_HEIGHT}px;`)
const gridStyle = computed(() => `grid-template-columns: repeat(${TD_GRID_COLS}, ${TD_CELL_SIZE}px); grid-template-rows: repeat(${TD_GRID_ROWS}, ${TD_CELL_SIZE}px);`)
const selectedTower = computed(() => state.towers.find((t) => t.id === state.selectedTowerId) ?? null)
const selectedTowerNextCost = computed(() => {
  const t = selectedTower.value
  if (!t || t.level >= TOWER_MAX_LEVEL) return null
  return TOWER_CONFIG[t.kind].levels[t.level]!.upgradeCost
})

const cellRows = Array.from({ length: TD_GRID_ROWS }, (_, r) => r)
const cellCols = Array.from({ length: TD_GRID_COLS }, (_, c) => c)

/** 私有工具方法：snapshot 同步、計時器管理、渲染用樣式字串 */
const _handlers = {
  syncState: () => {
    const snap = engine.getSnapshot()
    state.gold = snap.gold
    state.hp = snap.hp
    state.wave = snap.wave
    state.score = snap.score
    state.enemiesRemainingInWave = snap.enemiesRemainingInWave
    state.towers = snap.towers
    state.enemies = snap.enemies
    state.projectiles = snap.projectiles
    state.pendingUpgradeOptions = snap.pendingUpgradeOptions
    state.upgradeMultipliers = snap.upgradeMultipliers
    state.maxWaveReached = snap.maxWaveReached
  },
  stopTickTimer: () => {
    if (tickTimer) {
      clearInterval(tickTimer)
      tickTimer = null
    }
  },
  stopResultDelayTimer: () => {
    if (resultDelayTimer) {
      clearTimeout(resultDelayTimer)
      resultDelayTimer = null
    }
  },
  stopPlacementMessageTimer: () => {
    if (placementMessageTimer) {
      clearTimeout(placementMessageTimer)
      placementMessageTimer = null
    }
  },
  showPlacementMessage: (text: string) => {
    _handlers.stopPlacementMessageTimer()
    state.placementMessage = text
    placementMessageTimer = setTimeout(() => {
      state.placementMessage = ''
      placementMessageTimer = null
    }, 1400)
  },
  towerAt: (row: number, col: number): TowerView | undefined => state.towers.find((t) => t.row === row && t.col === col),
  cellClass: (row: number, col: number): string[] => {
    const classes = [isPathCell(row, col) ? 'is-path' : 'is-grass']
    if (!isPathCell(row, col) && state.selectedTowerKind && !_handlers.towerAt(row, col)) classes.push('is-buildable')
    return classes
  },
  towerStyle: (t: TowerView): string => `transform: translate(${t.x - 16}px, ${t.y - 16}px);`,
  enemyStyle: (e: EnemyView): string => `transform: translate(${e.x - 12}px, ${e.y - 12}px);`,
  enemyHpPercent: (e: EnemyView): string => `${Math.max(0, (e.hp / e.maxHp) * 100)}%`,
  projectileStyle: (p: ProjectileView): string =>
    `--from-x:${p.fromX}px; --from-y:${p.fromY}px; --to-x:${p.toX}px; --to-y:${p.toY}px; animation-duration:${p.totalTtlSec}s;`,
  towerIcon: (kind: TowerKind): string => TOWER_CONFIG[kind].icon,
  towerName: (kind: TowerKind): string => TOWER_CONFIG[kind].name
}

const _actions = {
  recordHistory: async () => {
    state.rewardMessage = ''
    try {
      const result = await gameHistory.actions.record('towerDefense', 'TOWER DEFENSE', {
        score: state.score,
        level: state.maxWaveReached,
        meta: { waveReached: state.maxWaveReached, towersBuilt: state.towers.length }
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
      if (state.status !== 'playing') return
      engine.step(TICK_DT)
      _handlers.syncState()
      if (state.hp <= 0) _actions.finishGame()
    }, TICK_MS)
  },
  resetGame: () => {
    _handlers.stopTickTimer()
    _handlers.stopResultDelayTimer()
    _handlers.stopPlacementMessageTimer()
    engine.reset()
    _handlers.syncState()
    state.status = 'ready'
    state.selectedTowerKind = null
    state.selectedTowerId = null
    state.placementMessage = ''
    state.waitingOverlayVisible = true
    state.resultOverlayVisible = false
    state.rewardMessage = ''
    state.message = '選擇下方防禦塔後點擊草地格建造，抵禦沿路徑而來的敵人。'
  },
  startGame: () => {
    if (state.status === 'playing') return
    if (state.status === 'gameover') _actions.resetGame()
    state.waitingOverlayVisible = false
    state.resultOverlayVisible = false
    engine.start()
    state.status = 'playing'
    state.message = '點擊防禦塔可查看資訊與升級，每波清完請選擇一項強化。'
    _actions.startTickLoop()
  },
  placeTowerAt: (row: number, col: number) => {
    if (state.status !== 'playing') return
    const existing = _handlers.towerAt(row, col)
    if (existing) {
      state.selectedTowerId = existing.id
      state.selectedTowerKind = null
      return
    }
    if (!state.selectedTowerKind) return
    if (isPathCell(row, col)) {
      _handlers.showPlacementMessage('路徑格無法建造防禦塔')
      return
    }
    const ok = engine.placeTower(state.selectedTowerKind, row, col)
    if (!ok) {
      _handlers.showPlacementMessage('Gold 不足，無法建造')
      return
    }
    _handlers.syncState()
  },
  upgradeSelectedTower: () => {
    if (!state.selectedTowerId) return
    const ok = engine.upgradeTower(state.selectedTowerId)
    if (!ok) _handlers.showPlacementMessage('Gold 不足或已達最高等級')
    _handlers.syncState()
  },
  chooseUpgrade: (key: UpgradeOptionKey) => {
    engine.chooseWaveUpgrade(key)
    _handlers.syncState()
  },
  finishGame: () => {
    state.status = 'gameover'
    _handlers.stopTickTimer()
    state.message = 'HP 歸零，遊戲結束！'
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
    _handlers.stopResultDelayTimer()
    state.status = 'gameover'
    state.waitingOverlayVisible = false
    state.resultOverlayVisible = true
    state.message = '本局已結束。'
    _actions.recordHistory()
  }
}

const onTdKeydown = (event: KeyboardEvent) => {
  const key = event.key.toLowerCase()
  if (key === 'escape' || key === 'p') {
    if (state.status === 'playing') _actions.pauseGame()
    else if (state.status === 'pause') _actions.resumeGame()
    event.preventDefault()
  }
}

const click = {
  start: () => _actions.startGame(),
  pause: () => _actions.pauseGame(),
  resume: () => _actions.resumeGame(),
  replay: () => _actions.resetGame(),
  restart: () => _actions.playAgain(),
  end: () => _actions.endGameNow(),
  again: () => _actions.playAgain(),
  exit: () => router.replace('/game-hall'),
  cell: (row: number, col: number) => _actions.placeTowerAt(row, col),
  selectTowerKind: (kind: TowerKind) => {
    state.selectedTowerId = null
    state.selectedTowerKind = state.selectedTowerKind === kind ? null : kind
  },
  upgrade: () => _actions.upgradeSelectedTower(),
  closeTowerInfo: () => {
    state.selectedTowerId = null
  },
  chooseUpgrade: (key: UpgradeOptionKey) => _actions.chooseUpgrade(key),
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
  if (typeof window !== 'undefined') window.addEventListener('keydown', onTdKeydown)
})

onBeforeUnmount(() => {
  _handlers.stopTickTimer()
  _handlers.stopResultDelayTimer()
  _handlers.stopPlacementMessageTimer()
  if (typeof window !== 'undefined') window.removeEventListener('keydown', onTdKeydown)
})
</script>

<template>
  <main class="td-page" :class="`state-${state.status}`">
    <div class="td-overlay" />

    <div v-if="state.waitingOverlayVisible" class="game-mask waiting-mask">
      <div class="mask-title">WELCOME</div>
      <p class="waiting-subtitle">TOWER DEFENSE</p>
      <p class="waiting-hint">放置防禦塔，抵禦無限波敵人</p>
      <button class="td-btn waiting-btn waiting-start" type="button" @click="click.start">START</button>
      <button class="td-btn link waiting-btn" type="button" @click="click.openRateDialog">CONVERT</button>
      <button class="td-btn link waiting-btn" type="button" @click="click.openRuleDialog">RULE</button>
    </div>

    <div v-if="state.status === 'pause'" class="game-mask pause-mask">
      <div class="mask-title">PAUSED</div>
      <div class="result-actions">
        <button class="td-btn" type="button" @click="click.resume">RESUME</button>
        <button class="td-btn" type="button" @click="click.restart">RESTART</button>
        <button class="td-btn danger" type="button" @click="click.exit">EXIT</button>
      </div>
    </div>

    <div v-if="state.resultOverlayVisible" class="game-mask result-mask">
      <div class="mask-title">GAME OVER</div>
      <div class="result-list">
        <div class="result-item"><span>SCORE</span><b>{{ state.score }}</b></div>
        <div class="result-item"><span>WAVE REACHED</span><b>{{ state.maxWaveReached }}</b></div>
        <div class="result-item"><span>TOWERS BUILT</span><b>{{ state.towers.length }}</b></div>
      </div>
      <p v-if="state.rewardMessage" class="result-reward">{{ state.rewardMessage }}</p>
      <div class="result-actions">
        <button class="td-btn" type="button" @click="click.again">AGAIN</button>
        <button class="td-btn danger" type="button" @click="click.exit">EXIT</button>
      </div>
    </div>

    <div v-if="state.pendingUpgradeOptions" class="game-mask upgrade-mask">
      <div class="mask-title">WAVE {{ state.wave }} CLEAR</div>
      <p class="upgrade-hint">選擇一項強化，效果會與先前已選的疊加</p>
      <div class="upgrade-options">
        <button
          v-for="opt in state.pendingUpgradeOptions"
          :key="opt.key"
          class="upgrade-option"
          type="button"
          @click="click.chooseUpgrade(opt.key)"
        >
          <span class="upgrade-option-label">{{ opt.label }}</span>
          <span class="upgrade-option-desc">{{ opt.desc }}</span>
        </button>
      </div>
    </div>

    <GameRateDialog :visible="state.rateDialogOpen" game-key="towerDefense" game-name="TOWER DEFENSE" :accent-color="ACCENT"
      @close="click.closeRateDialog" />
    <GameRuleDialog :visible="state.ruleDialogOpen" game-name="TOWER DEFENSE" :accent-color="ACCENT" v-bind="TOWER_DEFENSE_RULE"
      @close="click.closeRuleDialog" />

    <section class="td-shell">
      <aside class="td-side left">
        <button class="td-btn" type="button" :disabled="!canResumeFromPause" @click="click.resume">START</button>
        <button class="td-btn" type="button" :disabled="!canPauseWhilePlaying" @click="click.pause">PAUSE</button>
        <button class="td-btn" type="button" @click="click.replay">REPLAY</button>
        <button class="td-btn link" type="button" @click="click.end">END</button>
        <button class="td-btn" type="button" @click="click.openRateDialog">CONVERT</button>
        <button class="td-btn" type="button" @click="click.openRuleDialog">RULE</button>
      </aside>

      <section class="td-center">
        <header class="td-title-wrap">
          <h1 class="td-title">TOWER DEFENSE</h1>
          <p class="td-status" :class="statusClass">{{ statusText }}</p>
        </header>

        <div class="td-hud">
          <span>GOLD: {{ state.gold }}</span>
          <span>HP: {{ state.hp }}</span>
          <span>WAVE: {{ state.wave }}</span>
          <span>ENEMIES: {{ state.enemiesRemainingInWave }}</span>
          <span>SCORE: {{ state.score }}</span>
        </div>

        <div class="td-frame">
          <div class="td-stage" :style="stageStyle">
            <div class="td-grid" :style="gridStyle">
              <template v-for="row in cellRows" :key="`r${row}`">
                <div
                  v-for="col in cellCols"
                  :key="`c${row}-${col}`"
                  class="td-cell"
                  :class="_handlers.cellClass(row, col)"
                  @click="click.cell(row, col)"
                />
              </template>
            </div>

            <div class="td-start-flag">🏁</div>
            <div class="td-end-flag">🏰</div>

            <div v-for="tower in state.towers" :key="`t${tower.id}`" class="td-tower" :class="`is-${tower.kind}`" :style="_handlers.towerStyle(tower)"
              @click.stop="click.cell(tower.row, tower.col)">
              {{ _handlers.towerIcon(tower.kind) }}
              <span class="td-tower-level">L{{ tower.level }}</span>
            </div>

            <div v-for="enemy in state.enemies" :key="`e${enemy.id}`" class="td-enemy" :class="`is-${enemy.kind}`" :style="_handlers.enemyStyle(enemy)">
              <span class="td-enemy-icon">{{ enemy.icon }}</span>
              <span class="td-enemy-hp"><span class="td-enemy-hp-fill" :style="`width:${_handlers.enemyHpPercent(enemy)};`" /></span>
            </div>

            <div v-for="p in state.projectiles" :key="`p${p.id}`" class="td-projectile" :class="`is-${p.kind}`" :style="_handlers.projectileStyle(p)" />
          </div>

          <div class="td-tower-menu">
            <button
              v-for="kind in TOWER_KINDS"
              :key="kind"
              type="button"
              class="td-tower-btn"
              :class="{ 'is-selected': state.selectedTowerKind === kind }"
              @click="click.selectTowerKind(kind)"
            >
              <span class="icon">{{ _handlers.towerIcon(kind) }}</span>
              <span class="name">{{ _handlers.towerName(kind) }}</span>
              <span class="cost">{{ TOWER_CONFIG[kind].buildCost }}g</span>
            </button>
          </div>

          <div v-if="selectedTower" class="td-tower-info">
            <p class="td-tower-info-title">{{ _handlers.towerName(selectedTower.kind) }} · Lv{{ selectedTower.level }}</p>
            <p>DAMAGE: {{ selectedTower.config.damage.toFixed(1) }}</p>
            <p>ATK SPEED: {{ selectedTower.config.atkSpeed.toFixed(2) }}/s</p>
            <p>RANGE: {{ selectedTower.config.range.toFixed(1) }}</p>
            <div class="td-tower-info-actions">
              <button class="td-btn" type="button" :disabled="selectedTowerNextCost === null" @click="click.upgrade">
                {{ selectedTowerNextCost === null ? 'MAX LEVEL' : `UPGRADE (${selectedTowerNextCost}g)` }}
              </button>
              <button class="td-btn link" type="button" @click="click.closeTowerInfo">CLOSE</button>
            </div>
          </div>

          <p v-if="state.placementMessage" class="td-placement-message">{{ state.placementMessage }}</p>
        </div>

        <p class="td-message">{{ state.message }}</p>
      </section>

      <aside class="td-side right">
        <div class="td-help-panel">
          <p class="td-help-title">HOW TO PLAY</p>
          <p class="td-help-text">
            點選下方防禦塔後點擊草地格建造，路徑格無法建塔。點擊已建造的塔可查看資訊並升級（最高 Lv3）。
            每波清完可從 3 個隨機強化中選 1，效果會疊加。Boss 每 10 波固定出現一次，波次無限延伸，
            只有 HP 歸零才會結束遊戲。ESC／P 可暫停。
          </p>
        </div>
      </aside>
    </section>
  </main>
</template>

<style scoped lang="scss">
.td-page {
  --accent: #6a994e;
  position: relative;
  min-height: 100vh;
  display: grid;
  place-items: center;
  background: radial-gradient(circle at top, #0e1f0e, #030903 60%);
  overflow: hidden;
  isolation: isolate;

  .td-overlay {
    position: absolute;
    inset: 0;
    background-image: linear-gradient(rgba(106, 153, 78, 0.06) 1px, transparent 1px),
      linear-gradient(90deg, rgba(106, 153, 78, 0.06) 1px, transparent 1px);
    background-size: 28px 28px;
    pointer-events: none;
    z-index: 0;
  }

  .game-mask {
    position: absolute;
    inset: 0;
    z-index: 20;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    background: rgba(3, 9, 3, 0.86);
    text-align: center;
    color: #eafbe2;

    .mask-title {
      font-family: 'Press Start 2P', monospace;
      font-size: 22px;
      font-weight: 800;
      letter-spacing: 2px;
      color: var(--accent);
      text-shadow: 0 0 12px rgba(106, 153, 78, 0.6);
    }

    .waiting-subtitle {
      font-size: 15px;
      letter-spacing: 1px;
      opacity: 0.85;
    }

    .waiting-hint {
      font-size: 12px;
      opacity: 0.6;
    }

    .waiting-btn {
      min-width: 160px;
    }

    .upgrade-hint {
      font-size: 12px;
      opacity: 0.75;
    }

    .upgrade-options {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      justify-content: center;
      max-width: 560px;
    }

    .upgrade-option {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 150px;
      padding: 12px 14px;
      border: 2px solid var(--accent);
      background: #0e1f0e;
      color: #eafbe2;
      cursor: pointer;

      &:hover {
        background: var(--accent);
        color: #08130a;
      }

      .upgrade-option-label {
        font-weight: 700;
      }

      .upgrade-option-desc {
        font-size: 11px;
        opacity: 0.8;
      }
    }

    .result-list {
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: 13px;

      .result-item {
        display: flex;
        justify-content: space-between;
        gap: 24px;
        min-width: 220px;
      }
    }

    .result-reward {
      color: #ffd400;
      font-size: 12px;
    }

    .result-actions {
      display: flex;
      gap: 10px;
    }
  }

  .td-shell {
    position: relative;
    z-index: 1;
    display: grid;
    grid-template-columns: 140px auto 200px;
    gap: 16px;
    align-items: start;
    padding: 20px;
  }

  .td-side {
    display: flex;
    flex-direction: column;
    gap: 8px;

    &.right {
      .td-help-panel {
        border: 2px solid var(--accent);
        padding: 10px;
        background: rgba(10, 24, 10, 0.6);

        .td-help-title {
          font-weight: 700;
          margin-bottom: 6px;
          color: var(--accent);
        }

        .td-help-text {
          font-size: 11px;
          line-height: 1.6;
          opacity: 0.85;
        }
      }
    }
  }

  .td-btn {
    padding: 8px 10px;
    border: 2px solid var(--accent);
    background: #0e1f0e;
    color: #eafbe2;
    font-weight: 700;
    letter-spacing: 0.5px;
    cursor: pointer;

    &:hover:not(:disabled) {
      background: var(--accent);
      color: #08130a;
    }

    &:disabled {
      opacity: 0.35;
      cursor: not-allowed;
    }

    &.link {
      border-color: transparent;
      background: transparent;
      text-decoration: underline;
    }

    &.danger {
      border-color: #ef476f;
      color: #ef476f;
    }
  }

  .td-center {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
  }

  .td-title-wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;

    .td-title {
      font-family: 'Press Start 2P', monospace;
      font-size: 18px;
      font-weight: 800;
      letter-spacing: 2px;
      color: var(--accent);
    }

    .td-status {
      font-size: 11px;
      letter-spacing: 1px;
      opacity: 0.7;

      &.is-playing {
        color: #6a994e;
      }

      &.is-gameover {
        color: #ef476f;
      }
    }
  }

  .td-hud {
    display: flex;
    gap: 16px;
    font-size: 12px;
    font-weight: 700;
    color: #eafbe2;
  }

  .td-frame {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }

  .td-stage {
    position: relative;
    border: 2px solid var(--accent);
    background: #16260f;
    overflow: hidden;

    .td-grid {
      position: absolute;
      inset: 0;
      display: grid;
    }

    .td-cell {
      border: 1px solid rgba(0, 0, 0, 0.35);
      box-sizing: border-box;

      &.is-grass {
        background: #2d4a1f;
      }

      &.is-path {
        background: #6b4a2b;
        cursor: default;
      }

      &.is-buildable {
        cursor: pointer;

        &:hover {
          background: #3f6a2a;
        }
      }
    }

    .td-start-flag,
    .td-end-flag {
      position: absolute;
      font-size: 18px;
      pointer-events: none;
      z-index: 2;
      transform: translate(-9px, -9px);
    }

    .td-start-flag {
      left: v-bind('`${TD_CELL_SIZE / 2}px`');
      top: v-bind('`${TD_CELL_SIZE / 2}px`');
    }

    .td-end-flag {
      left: v-bind('`${TD_STAGE_WIDTH - TD_CELL_SIZE / 2}px`');
      top: v-bind('`${TD_STAGE_HEIGHT - TD_CELL_SIZE / 2}px`');
    }

    .td-tower {
      position: absolute;
      left: 0;
      top: 0;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      background: #10200a;
      border: 2px solid #eafbe2;
      cursor: pointer;
      z-index: 3;

      &.is-cannon {
        border-color: #ff8a2b;
      }

      &.is-ice {
        border-color: #7fd8ff;
      }

      .td-tower-level {
        position: absolute;
        bottom: -6px;
        right: -4px;
        font-size: 9px;
        background: var(--accent);
        color: #08130a;
        padding: 0 2px;
        font-weight: 700;
      }
    }

    .td-enemy {
      position: absolute;
      left: 0;
      top: 0;
      width: 24px;
      height: 24px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      z-index: 4;

      .td-enemy-icon {
        font-size: 14px;
      }

      .td-enemy-hp {
        width: 20px;
        height: 3px;
        background: #380000;
        display: block;
        margin-top: 1px;

        .td-enemy-hp-fill {
          display: block;
          height: 100%;
          background: #6a994e;
        }
      }

      &.is-fast .td-enemy-hp-fill {
        background: #ffd400;
      }

      &.is-tank .td-enemy-hp-fill {
        background: #4d7fff;
      }

      &.is-boss {
        width: 34px;
        height: 34px;

        .td-enemy-icon {
          font-size: 22px;
        }

        .td-enemy-hp-fill {
          background: #ef476f;
        }
      }
    }

    .td-projectile {
      position: absolute;
      left: 0;
      top: 0;
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #ffd400;
      z-index: 5;
      animation-name: td-projectile-fly;
      animation-timing-function: linear;
      animation-fill-mode: forwards;

      &.is-cannon {
        width: 8px;
        height: 8px;
        background: #ff8a2b;
      }

      &.is-ice {
        background: #7fd8ff;
      }
    }
  }

  .td-tower-menu {
    display: flex;
    gap: 8px;
  }

  .td-tower-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 6px 10px;
    border: 2px solid var(--accent);
    background: #0e1f0e;
    color: #eafbe2;
    cursor: pointer;
    font-size: 11px;

    .icon {
      font-size: 18px;
    }

    &.is-selected {
      background: var(--accent);
      color: #08130a;
    }
  }

  .td-tower-info {
    border: 2px solid var(--accent);
    background: rgba(10, 24, 10, 0.85);
    padding: 8px 12px;
    font-size: 11px;
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 220px;

    .td-tower-info-title {
      font-weight: 700;
      color: var(--accent);
    }

    .td-tower-info-actions {
      display: flex;
      gap: 8px;
      margin-top: 4px;
    }
  }

  .td-placement-message {
    font-size: 11px;
    color: #ef476f;
  }

  .td-message {
    font-size: 11px;
    opacity: 0.75;
    min-height: 14px;
  }
}

@keyframes td-projectile-fly {
  from {
    transform: translate(var(--from-x), var(--from-y));
  }
  to {
    transform: translate(var(--to-x), var(--to-y));
  }
}
</style>
