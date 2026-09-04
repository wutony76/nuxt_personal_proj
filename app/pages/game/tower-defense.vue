<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
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
  hoverTowerId: null as number | null,
  hoverTowerKind: null as TowerKind | null,
  rangeTowerId: null as number | null,
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

type FloatAnchor = { left: number; top: number; bottom: number; placement: 'above' | 'below' }
/** 塔資訊浮動卡片的錨點：跟隨 hover 的目標（建塔選單按鈕／塔），frame 內相對座標 */
const frameRef = ref<HTMLElement | null>(null)
const floatAnchor = ref<FloatAnchor | null>(null)
/** 「無法建造／Gold 不足」提示的浮動錨點，跟塔資訊卡片分開，兩者可能同時顯示 */
const placementFloatAnchor = ref<FloatAnchor | null>(null)

let tickTimer: ReturnType<typeof setInterval> | null = null
let resultDelayTimer: ReturnType<typeof setTimeout> | null = null
let placementMessageTimer: ReturnType<typeof setTimeout> | null = null
/** 離開 hover 目標後延遲一小段時間才關閉浮動卡片，讓滑鼠能移到卡片上點擊 UPGRADE */
let hoverCloseTimer: ReturnType<typeof setTimeout> | null = null

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
/** 塔／敵人視覺尺寸依格子大小等比縮放，避免格子縮放後圖示超出格子邊界（比例沿用 TD_CELL_SIZE=48 時的原始 32px／24px） */
const TD_TOWER_SIZE = Math.round((TD_CELL_SIZE * 2) / 3)
const TD_ENEMY_SIZE = Math.round(TD_CELL_SIZE / 2)
/** hover 一座已建好的塔時顯示其資訊，滑鼠離開即關閉 */
const hoveredTower = computed(() => state.towers.find((t) => t.id === state.hoverTowerId) ?? null)
const hoveredTowerNextCost = computed(() => {
  const t = hoveredTower.value
  if (!t || t.level >= TOWER_MAX_LEVEL) return null
  return TOWER_CONFIG[t.kind].levels[t.level]!.upgradeCost
})
/** hover 建塔選單按鈕時預覽該塔種 Lv1 數值，滑鼠離開即關閉 */
const hoveredBuildPreview = computed(() => {
  const kind = state.hoverTowerKind
  if (!kind) return null
  return { kind, ...TOWER_CONFIG[kind].levels[0]! }
})
const anchorToStyle = (anchor: FloatAnchor | null): string => {
  if (!anchor) return ''
  if (anchor.placement === 'above') return `left: ${anchor.left}px; bottom: ${anchor.bottom}px; top: auto;`
  return `left: ${anchor.left}px; top: ${anchor.top}px; bottom: auto;`
}
const floatPanelStyle = computed(() => anchorToStyle(floatAnchor.value))
const placementFloatStyle = computed(() => anchorToStyle(placementFloatAnchor.value))
/** 點擊已建好的塔，用一個置中的圓圈顯示其攻擊範圍；再點一次同一座塔取消 */
const rangeTower = computed(() => state.towers.find((t) => t.id === state.rangeTowerId) ?? null)
const rangeCircleStyle = computed(() => {
  const t = rangeTower.value
  if (!t) return ''
  const diameter = t.config.range * TD_CELL_SIZE * 2
  return `width:${diameter}px; height:${diameter}px; transform: translate(${t.x - diameter / 2}px, ${t.y - diameter / 2}px);`
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
  /** 共用：把一個 viewport 座標的 rect 換算成 frame 內的浮動錨點座標，寫入指定的 anchor ref */
  applyFloatAnchor: (
    anchorRef: typeof floatAnchor,
    targetRect: { left: number; top: number; bottom: number; width: number },
    placement: 'above' | 'below'
  ) => {
    if (!frameRef.value) return
    const frameRect = frameRef.value.getBoundingClientRect()
    // 絕對定位子元素的 (0,0) 是 frame 的 padding box 原點，需扣掉 frame 自己的 border 寬度才能對齊
    const frameStyle = getComputedStyle(frameRef.value)
    const borderLeft = parseFloat(frameStyle.borderLeftWidth) || 0
    const borderTop = parseFloat(frameStyle.borderTopWidth) || 0
    const borderBottom = parseFloat(frameStyle.borderBottomWidth) || 0
    const paddingBoxWidth = frameRect.width - borderLeft - (parseFloat(frameStyle.borderRightWidth) || 0)
    const paddingBoxHeight = frameRect.height - borderTop - borderBottom
    const halfPanelWidth = 115
    const rawLeft = targetRect.left - frameRect.left - borderLeft + targetRect.width / 2
    const left = Math.min(Math.max(rawLeft, halfPanelWidth), Math.max(paddingBoxWidth - halfPanelWidth, halfPanelWidth))
    const top = targetRect.bottom - frameRect.top - borderTop + 10
    const bottom = paddingBoxHeight - (targetRect.top - frameRect.top - borderTop) + 10
    anchorRef.value = { left, top, bottom, placement }
  },
  setFloatAnchor: (event: MouseEvent | undefined, placement: 'above' | 'below' = 'below') => {
    const target = event?.currentTarget as HTMLElement | undefined
    if (!target) return
    _handlers.applyFloatAnchor(floatAnchor, target.getBoundingClientRect(), placement)
  },
  /** 用格子座標（非 DOM 事件）算出錨點，供「無法建造」等非點擊觸發的提示定位用 */
  setPlacementAnchorAtCell: (row: number, col: number, placement: 'above' | 'below' = 'below') => {
    const stageEl = frameRef.value?.querySelector('.td-stage') as HTMLElement | null
    if (!stageEl) return
    const stageRect = stageEl.getBoundingClientRect()
    const x = stageRect.left + (col + 0.5) * TD_CELL_SIZE
    const y = stageRect.top + (row + 0.5) * TD_CELL_SIZE
    _handlers.applyFloatAnchor(placementFloatAnchor, { left: x, top: y, bottom: y, width: 0 }, placement)
  },
  cancelHoverClose: () => {
    if (hoverCloseTimer) {
      clearTimeout(hoverCloseTimer)
      hoverCloseTimer = null
    }
  },
  scheduleHoverClose: () => {
    _handlers.cancelHoverClose()
    hoverCloseTimer = setTimeout(() => {
      state.hoverTowerId = null
      state.hoverTowerKind = null
      hoverCloseTimer = null
    }, 150)
  },
  hoverTower: (tower: TowerView, event: MouseEvent) => {
    _handlers.cancelHoverClose()
    state.hoverTowerId = tower.id
    state.hoverTowerKind = null
    _handlers.setFloatAnchor(event, 'below')
  },
  hoverBuildKind: (kind: TowerKind, event: MouseEvent) => {
    _handlers.cancelHoverClose()
    state.hoverTowerKind = kind
    state.hoverTowerId = null
    _handlers.setFloatAnchor(event, 'above')
  },
  towerAt: (row: number, col: number): TowerView | undefined => state.towers.find((t) => t.row === row && t.col === col),
  cellClass: (row: number, col: number): string[] => {
    const classes = [isPathCell(row, col) ? 'is-path' : 'is-grass']
    if (!isPathCell(row, col) && state.selectedTowerKind && !_handlers.towerAt(row, col)) classes.push('is-buildable')
    return classes
  },
  towerStyle: (t: TowerView): string => `transform: translate(${t.x - TD_TOWER_SIZE / 2}px, ${t.y - TD_TOWER_SIZE / 2}px);`,
  enemyStyle: (e: EnemyView): string => `transform: translate(${e.x - TD_ENEMY_SIZE / 2}px, ${e.y - TD_ENEMY_SIZE / 2}px);`,
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
    state.hoverTowerId = null
    state.hoverTowerKind = null
    state.rangeTowerId = null
    _handlers.cancelHoverClose()
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
      state.selectedTowerKind = null
      state.rangeTowerId = state.rangeTowerId === existing.id ? null : existing.id
      return
    }
    state.rangeTowerId = null
    if (!state.selectedTowerKind) return
    if (isPathCell(row, col)) {
      _handlers.setPlacementAnchorAtCell(row, col, 'above')
      _handlers.showPlacementMessage('路徑格無法建造防禦塔')
      return
    }
    const ok = engine.placeTower(state.selectedTowerKind, row, col)
    if (!ok) {
      _handlers.setPlacementAnchorAtCell(row, col, 'above')
      _handlers.showPlacementMessage('Gold 不足，無法建造')
      return
    }
    _handlers.syncState()
  },
  upgradeHoveredTower: () => {
    const tower = hoveredTower.value
    if (!tower) return
    const ok = engine.upgradeTower(tower.id)
    if (!ok) {
      _handlers.setPlacementAnchorAtCell(tower.row, tower.col, 'below')
      _handlers.showPlacementMessage('Gold 不足或已達最高等級')
    }
    _handlers.syncState()
  },
  chooseUpgrade: (key: UpgradeOptionKey) => {
    engine.chooseWaveUpgrade(key)
    _handlers.syncState()
  },
  skipUpgrade: () => {
    engine.skipWaveUpgrade()
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
  end: () => _actions.endGameNow(),
  again: () => _actions.playAgain(),
  exit: () => router.replace('/game-hall'),
  cell: (row: number, col: number) => _actions.placeTowerAt(row, col),
  selectTowerKind: (kind: TowerKind) => {
    state.selectedTowerKind = state.selectedTowerKind === kind ? null : kind
  },
  upgrade: () => _actions.upgradeHoveredTower(),
  hoverTower: (tower: TowerView, event: MouseEvent) => _handlers.hoverTower(tower, event),
  hoverBuildKind: (kind: TowerKind, event: MouseEvent) => _handlers.hoverBuildKind(kind, event),
  hoverLeave: () => _handlers.scheduleHoverClose(),
  hoverPanelEnter: () => _handlers.cancelHoverClose(),
  hoverPanelLeave: () => _handlers.scheduleHoverClose(),
  chooseUpgrade: (key: UpgradeOptionKey) => _actions.chooseUpgrade(key),
  skipUpgrade: () => _actions.skipUpgrade(),
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
      <p class="upgrade-hint">選擇一項強化並花費 Gold 購買，效果會與先前已選的疊加；價格會在每次購買後上漲</p>
      <div class="upgrade-options">
        <button
          v-for="opt in state.pendingUpgradeOptions"
          :key="opt.key"
          class="upgrade-option"
          type="button"
          :disabled="state.gold < opt.cost"
          @click="click.chooseUpgrade(opt.key)"
        >
          <span class="upgrade-option-label">{{ opt.label }}</span>
          <span class="upgrade-option-desc">{{ opt.desc }}</span>
          <span class="upgrade-option-cost">{{ opt.cost }}g</span>
        </button>
        <button class="upgrade-option is-skip" type="button" @click="click.skipUpgrade">
          <span class="upgrade-option-label">不強化</span>
          <span class="upgrade-option-desc">直接進下一波，不花錢也不套用效果</span>
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

        <div class="td-frame" ref="frameRef">
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

            <div v-if="rangeTower" class="td-range-circle" :style="rangeCircleStyle" />

            <div v-for="tower in state.towers" :key="`t${tower.id}`" class="td-tower" :class="`is-${tower.kind}`" :style="_handlers.towerStyle(tower)"
              @click.stop="click.cell(tower.row, tower.col)" @mouseenter="click.hoverTower(tower, $event)" @mouseleave="click.hoverLeave">
              {{ _handlers.towerIcon(tower.kind) }}
              <span class="td-tower-level">L{{ tower.level }}</span>
            </div>

            <div v-for="enemy in state.enemies" :key="`e${enemy.id}`" class="td-enemy" :class="`is-${enemy.kind}`" :style="_handlers.enemyStyle(enemy)">
              <span class="td-enemy-icon">{{ enemy.icon }}</span>
              <span class="td-enemy-hp"><span class="td-enemy-hp-fill" :style="`width:${_handlers.enemyHpPercent(enemy)};`" /></span>
            </div>

            <div v-for="p in state.projectiles" :key="`p${p.id}`" class="td-projectile"
              :class="[`is-${p.kind}`, { 'is-paused': state.status === 'pause' }]" :style="_handlers.projectileStyle(p)" />
          </div>

          <div class="td-tower-menu">
            <button
              v-for="kind in TOWER_KINDS"
              :key="kind"
              type="button"
              class="td-tower-btn"
              :class="{ 'is-selected': state.selectedTowerKind === kind }"
              @click="click.selectTowerKind(kind)"
              @mouseenter="click.hoverBuildKind(kind, $event)"
              @mouseleave="click.hoverLeave"
            >
              <span class="icon">{{ _handlers.towerIcon(kind) }}</span>
              <span class="name">{{ _handlers.towerName(kind) }}</span>
              <span class="cost">{{ TOWER_CONFIG[kind].buildCost }}g</span>
            </button>
          </div>

          <div v-if="hoveredTower" class="td-tower-info" :style="floatPanelStyle" @mouseenter="click.hoverPanelEnter" @mouseleave="click.hoverPanelLeave">
            <p class="td-tower-info-title">{{ _handlers.towerName(hoveredTower.kind) }} · Lv{{ hoveredTower.level }}</p>
            <p>DAMAGE: {{ hoveredTower.config.damage.toFixed(1) }}</p>
            <p>ATK SPEED: {{ hoveredTower.config.atkSpeed.toFixed(2) }}/s</p>
            <p>RANGE: {{ hoveredTower.config.range.toFixed(1) }}</p>
            <div class="td-tower-info-actions">
              <button class="td-btn" type="button" :disabled="hoveredTowerNextCost === null" @click="click.upgrade">
                {{ hoveredTowerNextCost === null ? 'MAX LEVEL' : `UPGRADE (${hoveredTowerNextCost}g)` }}
              </button>
            </div>
          </div>

          <div v-else-if="hoveredBuildPreview" class="td-tower-info" :style="floatPanelStyle" @mouseenter="click.hoverPanelEnter" @mouseleave="click.hoverPanelLeave">
            <p class="td-tower-info-title">{{ _handlers.towerName(hoveredBuildPreview.kind) }} · 建造中</p>
            <p>COST: {{ TOWER_CONFIG[hoveredBuildPreview.kind].buildCost }}g</p>
            <p>DAMAGE: {{ hoveredBuildPreview.damage.toFixed(1) }}</p>
            <p>ATK SPEED: {{ hoveredBuildPreview.atkSpeed.toFixed(2) }}/s</p>
            <p>RANGE: {{ hoveredBuildPreview.range.toFixed(1) }}</p>
            <p v-if="hoveredBuildPreview.splashRadius">SPLASH: {{ hoveredBuildPreview.splashRadius.toFixed(1) }}</p>
            <p v-if="hoveredBuildPreview.slowFactor">SLOW: {{ (hoveredBuildPreview.slowFactor * 100).toFixed(0) }}% / {{ hoveredBuildPreview.slowDurationSec?.toFixed(1) }}s</p>
          </div>

          <p v-if="state.placementMessage" class="td-placement-message" :style="placementFloatStyle">{{ state.placementMessage }}</p>
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
  /** 亮綠：按鈕文字/hover 發光用，避免全頁只有單一 accent 色階 */
  --bright: #a7c957;
  position: relative;
  min-height: 100vh;
  display: grid;
  place-items: center;
  background: radial-gradient(circle at top, #0e1f0e, #030903 60%);
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
    background: radial-gradient(circle at 20% 20%, rgba(106, 153, 78, 0.18), transparent 45%),
      radial-gradient(circle at 80% 70%, rgba(167, 201, 87, 0.1), transparent 40%);
    filter: blur(40px);
    animation: ambient-drift 12s ease-in-out infinite alternate;
  }

  &::after {
    background: linear-gradient(115deg, rgba(106, 153, 78, 0.05), rgba(0, 0, 0, 0));
    animation: ambient-pulse 4.6s ease-in-out infinite;
  }

  .td-overlay {
    position: absolute;
    inset: 0;
    background-image: linear-gradient(rgba(106, 153, 78, 0.06) 1px, transparent 1px),
      linear-gradient(90deg, rgba(106, 153, 78, 0.06) 1px, transparent 1px);
    background-size: 28px 28px;
    pointer-events: none;
    z-index: 0;
    animation: grid-drift 14s linear infinite;
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
      color: var(--accent);
      font-size: clamp(2rem, 8vw, 4rem);
      letter-spacing: 0.25rem;
      font-weight: 900;
      text-shadow: 0 0 18px rgba(106, 153, 78, 0.5);
    }

    .waiting-subtitle {
      margin: 0;
      color: var(--bright);
      letter-spacing: 0.3rem;
      font-size: 1.05rem;
      font-weight: 800;
    }

    .waiting-hint {
      margin: 0;
      font-size: 12px;
      opacity: 0.65;
    }

    .waiting-btn {
      width: 200px;
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
      border: 1px solid rgba(106, 153, 78, 0.45);
      border-radius: 6px;
      background: rgba(14, 31, 14, 0.85);
      color: #eafbe2;
      cursor: pointer;
      transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;

      &:hover:not(:disabled) {
        border-color: var(--accent);
        box-shadow: 0 0 12px rgba(106, 153, 78, 0.4);
        transform: translateY(-1px);
      }

      &:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }

      .upgrade-option-label {
        font-weight: 700;
        color: var(--bright);
      }

      .upgrade-option-desc {
        font-size: 11px;
        opacity: 0.8;
      }

      .upgrade-option-cost {
        font-size: 11px;
        font-weight: 700;
        color: #ffd400;
      }

      &.is-skip {
        border-color: rgba(255, 157, 125, 0.45);

        &:hover {
          border-color: #ff9d7d;
          box-shadow: 0 0 12px rgba(255, 157, 125, 0.4);
        }

        .upgrade-option-label {
          color: #ff9d7d;
        }
      }
    }

    .result-list {
      display: grid;
      gap: 8px;
      width: 280px;

      .result-item {
        display: flex;
        justify-content: space-between;
        border: 1px solid rgba(106, 153, 78, 0.4);
        background: rgba(10, 24, 10, 0.65);
        color: #eafbe2;
        border-radius: 6px;
        padding: 8px 10px;
        font-variant-numeric: tabular-nums;
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
    width: min(1100px, 100%);
    display: grid;
    grid-template-columns: 180px auto 200px;
    gap: 16px;
    align-items: center;
    padding: 20px;
  }

  .td-side {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .td-help-panel {
    border: 1px solid rgba(106, 153, 78, 0.3);
    border-radius: 8px;
    padding: 10px;
    background: rgba(10, 24, 10, 0.5);

    .td-help-title {
      font-weight: 700;
      margin-bottom: 6px;
      color: var(--bright);
    }

    .td-help-text {
      font-size: 11px;
      color: #eafbe2;
      line-height: 1.6;
      opacity: 0.85;
    }
  }

  .td-btn {
    position: relative;
    overflow: hidden;
    padding: 8px 10px;
    border: 1px solid rgba(106, 153, 78, 0.45);
    border-radius: 6px;
    background: rgba(14, 31, 14, 0.75);
    color: var(--bright);
    font-weight: 700;
    letter-spacing: 0.5px;
    cursor: pointer;
    transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;

    &::after {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(105deg, transparent 35%, rgba(210, 240, 190, 0.25) 50%, transparent 65%);
      transform: translateX(-150%);
      transition: transform 0.35s ease;
      pointer-events: none;
    }

    &:hover:not(:disabled) {
      border-color: var(--accent);
      box-shadow: 0 0 12px rgba(106, 153, 78, 0.4);
      transform: translateY(-1px);

      &::after {
        transform: translateX(150%);
      }
    }

    &:disabled {
      opacity: 0.35;
      cursor: not-allowed;
      box-shadow: none;
    }

    &.link {
      text-align: center;
      text-decoration: none;
    }

    &.danger {
      border-color: rgba(239, 71, 111, 0.5);
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
      margin: 0;
      color: var(--accent);
      font-size: clamp(1.6rem, 4.6vw, 2.6rem);
      letter-spacing: 0.12rem;
      font-weight: 900;
      text-shadow: 0 0 14px rgba(106, 153, 78, 0.55);
      animation: title-float 2.6s ease-in-out infinite;
    }

    .td-status {
      font-size: 11px;
      letter-spacing: 1px;
      opacity: 0.75;
      color: #eafbe2;

      &.is-playing {
        color: var(--bright);
      }

      &.is-pause {
        color: #ffcc33;
      }

      &.is-gameover {
        color: #ff5e5e;
      }
    }
  }

  .td-hud {
    display: flex;
    gap: 16px;
    font-size: 12px;
    font-weight: 800;
    color: var(--bright);
    text-shadow: 0 0 6px rgba(106, 153, 78, 0.45);
    font-variant-numeric: tabular-nums;
  }

  .td-frame {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 14px;
    background: #081206;
    border: 10px solid #16260f;
    border-radius: 18px;
    box-shadow: 0 0 0 1px rgba(106, 153, 78, 0.2), 0 0 24px rgba(106, 153, 78, 0.18);
    animation: frame-glow 5.4s ease-in-out infinite;
  }

  .td-stage {
    position: relative;
    border: 2px solid var(--accent);
    border-radius: 8px;
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
          box-shadow: inset 0 0 8px rgba(167, 201, 87, 0.5);
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

    .td-range-circle {
      position: absolute;
      left: 0;
      top: 0;
      border-radius: 50%;
      background: rgba(106, 153, 78, 0.14);
      border: 1px solid rgba(167, 201, 87, 0.65);
      box-shadow: 0 0 12px rgba(106, 153, 78, 0.35), inset 0 0 12px rgba(106, 153, 78, 0.25);
      pointer-events: none;
      z-index: 2;
    }

    .td-tower {
      position: absolute;
      left: 0;
      top: 0;
      width: v-bind('`${TD_TOWER_SIZE}px`');
      height: v-bind('`${TD_TOWER_SIZE}px`');
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: v-bind('`${TD_TOWER_SIZE / 2}px`');
      background: #10200a;
      border: 2px solid #eafbe2;
      border-radius: 6px;
      box-shadow: 0 0 8px rgba(234, 251, 226, 0.35), inset 0 0 6px rgba(255, 255, 255, 0.12);
      cursor: pointer;
      z-index: 3;

      &.is-cannon {
        border-color: #ff8a2b;
        box-shadow: 0 0 8px rgba(255, 138, 43, 0.45), inset 0 0 6px rgba(255, 255, 255, 0.12);
      }

      &.is-ice {
        border-color: #7fd8ff;
        box-shadow: 0 0 8px rgba(127, 216, 255, 0.45), inset 0 0 6px rgba(255, 255, 255, 0.12);
      }

      .td-tower-level {
        position: absolute;
        bottom: -6px;
        right: -4px;
        font-size: 9px;
        background: var(--accent);
        color: #08130a;
        border-radius: 3px;
        padding: 0 3px;
        font-weight: 700;
      }
    }

    .td-enemy {
      position: absolute;
      left: 0;
      top: 0;
      width: v-bind('`${TD_ENEMY_SIZE}px`');
      height: v-bind('`${TD_ENEMY_SIZE}px`');
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      z-index: 4;

      .td-enemy-icon {
        font-size: v-bind('`${Math.round(TD_ENEMY_SIZE * 0.583)}px`');
        filter: drop-shadow(0 0 3px rgba(0, 0, 0, 0.6));
      }

      .td-enemy-hp {
        width: v-bind('`${Math.round(TD_ENEMY_SIZE * 0.833)}px`');
        height: 3px;
        background: #380000;
        border-radius: 2px;
        display: block;
        margin-top: 1px;
        overflow: hidden;

        .td-enemy-hp-fill {
          display: block;
          height: 100%;
          background: var(--accent);
          box-shadow: 0 0 4px rgba(106, 153, 78, 0.8);
        }
      }

      &.is-fast .td-enemy-hp-fill {
        background: #ffd400;
        box-shadow: 0 0 4px rgba(255, 212, 0, 0.8);
      }

      &.is-tank .td-enemy-hp-fill {
        background: #4d7fff;
        box-shadow: 0 0 4px rgba(77, 127, 255, 0.8);
      }

      &.is-boss {
        width: 34px;
        height: 34px;

        .td-enemy-icon {
          font-size: 22px;
        }

        .td-enemy-hp-fill {
          background: #ef476f;
          box-shadow: 0 0 4px rgba(239, 71, 111, 0.8);
        }
      }
    }

    .td-projectile {
      position: absolute;
      left: 0;
      top: 0;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: #ffd400;
      border: 1px solid #fff3b0;
      box-shadow: 0 0 10px 2px rgba(255, 212, 0, 0.9);
      z-index: 5;
      animation-name: td-projectile-fly;
      animation-timing-function: linear;
      animation-fill-mode: forwards;

      &.is-paused {
        animation-play-state: paused;
      }

      &.is-cannon {
        width: 13px;
        height: 13px;
        background: #ff8a2b;
        border-color: #ffd9ad;
        box-shadow: 0 0 12px 3px rgba(255, 138, 43, 0.95);
      }

      &.is-ice {
        background: #7fd8ff;
        border-color: #e3f7ff;
        box-shadow: 0 0 10px 2px rgba(127, 216, 255, 0.95);
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
    border: 1px solid rgba(106, 153, 78, 0.45);
    border-radius: 6px;
    background: rgba(14, 31, 14, 0.75);
    color: #eafbe2;
    cursor: pointer;
    font-size: 11px;
    transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;

    .icon {
      font-size: 18px;
    }

    &:hover {
      border-color: var(--accent);
      box-shadow: 0 0 10px rgba(106, 153, 78, 0.35);
      transform: translateY(-1px);
    }

    &.is-selected {
      border-color: var(--accent);
      background: var(--accent);
      color: #08130a;
      box-shadow: 0 0 12px rgba(106, 153, 78, 0.5);
    }
  }

  .td-tower-info {
    position: absolute;
    top: calc(100% + 10px);
    left: 50%;
    transform: translateX(-50%);
    z-index: 10;
    border: 1px solid rgba(106, 153, 78, 0.45);
    border-radius: 8px;
    background: rgba(10, 24, 10, 0.85);
    box-shadow: 0 0 16px rgba(106, 153, 78, 0.35);
    padding: 8px 12px;
    font-size: 11px;
    color: #eafbe2;
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 220px;

    .td-tower-info-title {
      font-weight: 700;
      color: var(--bright);
    }

    .td-tower-info-actions {
      display: flex;
      gap: 8px;
      margin-top: 4px;
    }
  }

  .td-placement-message {
    position: absolute;
    left: 50%;
    top: calc(100% + 10px);
    transform: translateX(-50%);
    z-index: 10;
    margin: 0;
    padding: 6px 10px;
    border: 1px solid rgba(239, 71, 111, 0.5);
    border-radius: 8px;
    background: rgba(24, 10, 10, 0.9);
    box-shadow: 0 0 16px rgba(239, 71, 111, 0.35);
    font-size: 11px;
    color: #ff9d7d;
    white-space: nowrap;
  }

  .td-message {
    font-size: 11px;
    color: #eafbe2;
    opacity: 0.75;
    min-height: 14px;
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
    box-shadow: 0 0 0 1px rgba(106, 153, 78, 0.2), 0 0 24px rgba(106, 153, 78, 0.18);
  }

  50% {
    box-shadow: 0 0 0 1px rgba(167, 201, 87, 0.35), 0 0 40px rgba(106, 153, 78, 0.3);
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

@keyframes td-projectile-fly {
  from {
    transform: translate(var(--from-x), var(--from-y)) translate(-50%, -50%);
  }
  to {
    transform: translate(var(--to-x), var(--to-y)) translate(-50%, -50%);
  }
}

@media (max-width: 980px) {
  .td-page {
    .td-shell {
      grid-template-columns: 1fr;
      padding: 16px;
    }

    .td-side {
      flex-direction: row;
      flex-wrap: wrap;
      justify-content: center;
    }
  }
}
</style>
