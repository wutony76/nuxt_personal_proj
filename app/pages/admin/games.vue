<script setup lang="ts">
/**
 * 經典遊戲後台管理（/admin/games）：coin 兌換三常數編輯、PAC-MAN 固定樣板迷宮管理、
 * 玩家遊戲紀錄與 coin 兌換查詢。見 design.md Decision 5。
 */
import { onMounted, reactive } from 'vue'
import { api, type RetroGameKey, type RetroGameRateInfo, type MazeTemplate, type GameHistoryRecord } from '~/services/api'

type AsyncStatus = 'idle' | 'loading' | 'success' | 'error'
type EditDraft = { coinRate: string; coinCapPerRun: string; coinDailyCap: string }

const PLAY_PATHS: Record<RetroGameKey, string> = {
  snake: '/game/snake',
  racing: '/game/racing',
  tetriminos: '/game/tetriminos',
  match3rush: '/game/match3-rush',
  match3classic: '/game/match3-classic',
  pong: '/game/pong',
  runner: '/game/runner',
  spaceShooter: '/game/space-shooter',
  minesweeper: '/game/minesweeper',
  pacman: '/game/pac-man',
  spaceInvaders: '/game/space-invaders',
  solitaire: '/game/solitaire',
  typing: '/game/typing',
  breakout: '/game/breakout',
  orbMatch: '/game/orb-match',
  battleship: '/game/battleship',
  '2048': '/game/2048',
  flappy: '/game/flappy',
  frogger: '/game/frogger',
  connect4: '/game/connect4',
  whackAMole: '/game/whack-a-mole',
  lightsOut: '/game/lights-out',
  towerStack: '/game/tower-stack',
  arkanoid: '/game/arkanoid'
}

/** 起始草稿沿用已知合法的 classic-01 樣板，讓管理員從一份確定通過驗證的版面開始改，而不是空白或破損的骨架 */
const DEFAULT_MAZE_DRAFT = [
  '###################',
  '#.................#',
  '#...#.#...#...#.#.#',
  '#.................#',
  '#.....#.#.....#.#.#',
  '#.................#',
  '#.#.#...#...#.#...#',
  '#.................#',
  '#.#.#...#.#.#...#.#',
  '#.................#',
  '...................',
  '#.................#',
  '#.#.#.#.#...#...#.#',
  '#.................#',
  '#...#.#...........#',
  '#.................#',
  '#.#.#.#...#.#.#.#.#',
  '#.................#',
  '#.......#...#...#.#',
  '#.................#',
  '###################'
].join('\n')

const state = reactive({
  ratesStatus: 'idle' as AsyncStatus,
  rates: [] as RetroGameRateInfo[],
  editingKey: null as RetroGameKey | null,
  draft: null as EditDraft | null,
  editError: '',
  savedKey: null as RetroGameKey | null,

  mazeStatus: 'idle' as AsyncStatus,
  mazes: [] as MazeTemplate[],
  mazeDialogOpen: false,
  mazeName: '',
  mazeDraft: DEFAULT_MAZE_DRAFT,
  mazeError: '',
  mazeSaving: false,

  playerQuery: '',
  queriedUserId: '',
  historyStatus: 'idle' as AsyncStatus,
  historyRecords: [] as GameHistoryRecord[],
  historyCoin: [] as Array<{ id: string; gameKey: string; amount: number; note: string; createdAt: number }>
})

const _handlers = {
  formatDate: (iso: string) => {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    return `${d.getMonth() + 1}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }
}

const _actions = {
  loadRates: async () => {
    state.ratesStatus = 'loading'
    try {
      const result = await api.games.retro.rates()
      state.rates = result.rates
      state.ratesStatus = 'success'
    } catch {
      state.ratesStatus = 'error'
    }
  },
  loadMazes: async () => {
    state.mazeStatus = 'loading'
    try {
      const result = await api.games.retro.pacmanMazeTemplates()
      state.mazes = result.templates
      state.mazeStatus = 'success'
    } catch {
      state.mazeStatus = 'error'
    }
  },
  startEdit: (row: RetroGameRateInfo) => {
    state.editingKey = row.key
    state.editError = ''
    state.savedKey = null
    state.draft = {
      coinRate: String(row.coinRate),
      coinCapPerRun: String(row.coinCapPerRun),
      coinDailyCap: String(row.coinDailyCap)
    }
  },
  cancelEdit: () => {
    state.editingKey = null
    state.draft = null
    state.editError = ''
  },
  saveEdit: async (row: RetroGameRateInfo) => {
    if (!state.draft) return
    const coinRate = Number(state.draft.coinRate)
    const coinCapPerRun = Number(state.draft.coinCapPerRun)
    const coinDailyCap = Number(state.draft.coinDailyCap)
    if (![coinRate, coinCapPerRun, coinDailyCap].every((n) => Number.isFinite(n))) {
      state.editError = '三個欄位都必須是數字。'
      return
    }
    if ([coinRate, coinCapPerRun, coinDailyCap].some((n) => n <= 0)) {
      state.editError = '數值必須為正數，coinCapPerRun 不得為 0。'
      return
    }
    if (coinCapPerRun > coinDailyCap) {
      state.editError = '單局上限不得高於每日上限。'
      return
    }
    try {
      const updated = await api.admin.games.updateRetroRates(row.key, { coinRate, coinCapPerRun, coinDailyCap })
      state.rates = state.rates.map((r) => (r.key === row.key ? { ...r, ...updated } : r))
      state.editingKey = null
      state.draft = null
      state.editError = ''
      state.savedKey = row.key
    } catch (err) {
      const data = (err as { data?: { message?: string } })?.data
      state.editError = data?.message ?? '儲存失敗，請稍後再試。'
    }
  },
  openMazeDialog: () => {
    state.mazeDialogOpen = true
    state.mazeName = ''
    state.mazeDraft = DEFAULT_MAZE_DRAFT
    state.mazeError = ''
  },
  closeMazeDialog: () => {
    state.mazeDialogOpen = false
    state.mazeError = ''
  },
  saveMaze: async () => {
    if (!state.mazeName.trim()) {
      state.mazeError = '請輸入樣板名稱。'
      return
    }
    state.mazeSaving = true
    try {
      const result = await api.admin.games.addMazeTemplate({ name: state.mazeName.trim(), rows: state.mazeDraft.split('\n') })
      state.mazes = [...state.mazes, result.template]
      state.mazeDialogOpen = false
      state.mazeError = ''
    } catch (err) {
      const data = (err as { data?: { message?: string } })?.data
      state.mazeError = data?.message ?? '儲存失敗，請稍後再試。'
    } finally {
      state.mazeSaving = false
    }
  },
  removeMaze: async (id: string) => {
    try {
      await api.admin.games.removeMazeTemplate(id)
      state.mazes = state.mazes.filter((m) => m.id !== id)
    } catch {
      // 刪除失敗不影響列表顯示，靜默略過
    }
  },
  runPlayerQuery: async () => {
    const userId = state.playerQuery.trim()
    if (!userId) return
    state.historyStatus = 'loading'
    state.queriedUserId = userId
    try {
      const result = await api.admin.games.playerHistory(userId)
      state.historyRecords = result.records
      state.historyCoin = result.balanceChanges
      state.historyStatus = 'success'
    } catch {
      state.historyStatus = 'error'
    }
  }
}

const click = {
  edit: _actions.startEdit,
  cancel: _actions.cancelEdit,
  save: _actions.saveEdit,
  openMaze: _actions.openMazeDialog,
  closeMaze: _actions.closeMazeDialog,
  saveMaze: _actions.saveMaze,
  removeMaze: _actions.removeMaze,
  runQuery: _actions.runPlayerQuery
}

onMounted(() => {
  _actions.loadRates()
  _actions.loadMazes()
})
</script>

<template>
  <AdminShell active="gamemgmt" kicker="Retro Games" title="經典遊戲"
    desc="Coin 兌換三常數與 PAC-MAN 固定樣板迷宮從程式碼常數改為後台可讀寫。改完可直接點試玩連結驗證。">
    <div class="agm-layout">
      <AdminGameNav active="games" />
      <div class="agm-content">
        <section>
          <div class="admin-sechead">
            <div class="admin-sechead-left"><span class="admin-en">Coin rates</span><h2>Coin 兌換常數</h2></div>
            <span class="admin-meta">RETRO_GAME_BASE — editable</span>
          </div>
          <div v-if="state.ratesStatus === 'loading'" class="admin-empty">載入中...</div>
          <div v-else-if="state.ratesStatus === 'error'" class="admin-empty">載入失敗，請重新整理再試一次</div>
          <table v-else class="admin-table">
            <thead>
              <tr>
                <th style="width:22%">遊戲</th>
                <th style="text-align:right">coinRate</th>
                <th style="text-align:right">單局上限</th>
                <th style="text-align:right">每日上限</th>
                <th style="width:26%;text-align:right">動作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in state.rates" :key="row.key">
                <td>
                  <div style="font-size:13.5px">{{ row.name }}</div>
                  <div class="admin-num" style="font-size:10.5px;color:var(--muted)">{{ row.key }}</div>
                </td>
                <td style="text-align:right">
                  <input v-if="state.editingKey === row.key && state.draft" v-model="state.draft.coinRate" class="admin-input admin-num agm-edit-input">
                  <span v-else class="admin-num">{{ row.coinRate }}</span>
                </td>
                <td style="text-align:right">
                  <input v-if="state.editingKey === row.key && state.draft" v-model="state.draft.coinCapPerRun" class="admin-input admin-num agm-edit-input">
                  <span v-else class="admin-num">{{ row.coinCapPerRun }}</span>
                </td>
                <td style="text-align:right">
                  <input v-if="state.editingKey === row.key && state.draft" v-model="state.draft.coinDailyCap" class="admin-input admin-num agm-edit-input">
                  <span v-else class="admin-num">{{ row.coinDailyCap }}</span>
                </td>
                <td style="text-align:right">
                  <div class="agm-actions">
                    <template v-if="state.editingKey === row.key">
                      <button type="button" class="admin-btn admin-btn-primary" @click="click.save(row)">儲存</button>
                      <button type="button" class="admin-btn admin-btn-ghost" @click="click.cancel">取消</button>
                    </template>
                    <template v-else>
                      <button type="button" class="admin-btn admin-btn-secondary" @click="click.edit(row)">編輯</button>
                      <a class="admin-btn admin-btn-ghost" :href="PLAY_PATHS[row.key]" target="_blank" rel="noopener">試玩 ↗</a>
                    </template>
                  </div>
                  <div v-if="state.editingKey === row.key && state.editError" class="agm-msg">{{ state.editError }}</div>
                  <div v-else-if="state.savedKey === row.key" class="agm-msg">已更新</div>
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        <section>
          <div class="admin-sechead">
            <div class="admin-sechead-left"><span class="admin-en">Fixed mazes</span><h2>PAC-MAN 固定樣板迷宮</h2></div>
            <button type="button" class="admin-btn admin-btn-primary" @click="click.openMaze">新增樣板</button>
          </div>
          <div v-if="state.mazeStatus === 'loading'" class="admin-empty">載入中...</div>
          <div v-else-if="state.mazeStatus === 'error'" class="admin-empty">載入失敗，請重新整理再試一次</div>
          <template v-else>
            <div v-if="state.mazes.length === 0" class="admin-empty">目前沒有固定樣板，開局將全部使用隨機生成迷宮。</div>
            <div v-else class="admin-grid1 agm-mazes">
              <div v-for="m in state.mazes" :key="m.id" class="admin-panel agm-maze-card">
                <div class="agm-maze-top">
                  <div style="font-size:14px">{{ m.name }}</div>
                  <span class="admin-tag">Connected</span>
                </div>
                <pre class="admin-num agm-maze-grid">{{ m.rows.join('\n') }}</pre>
                <div class="agm-maze-bottom">
                  <span class="admin-num" style="font-size:11px;color:var(--muted)">{{ m.rows[0]?.length }} × {{ m.rows.length }}</span>
                  <button type="button" class="admin-btn admin-btn-ghost" @click="click.removeMaze(m.id)">刪除</button>
                </div>
              </div>
            </div>
          </template>
        </section>

        <section>
          <div class="admin-sechead">
            <div class="admin-sechead-left"><span class="admin-en">Player history</span><h2>玩家紀錄查詢</h2></div>
            <span class="admin-meta">GET /api/admin/games/history</span>
          </div>
          <div class="agm-query">
            <div class="admin-field" style="width:260px">
              <label>User ID</label>
              <input v-model="state.playerQuery" class="admin-input" placeholder="U0xA000001" @keyup.enter="click.runQuery">
            </div>
            <button type="button" class="admin-btn admin-btn-secondary" @click="click.runQuery">查詢</button>
          </div>
          <div v-if="state.historyStatus === 'loading'" class="admin-empty">查詢中...</div>
          <div v-else-if="state.historyStatus === 'error'" class="admin-empty">查詢失敗，請稍後再試</div>
          <template v-else-if="state.historyStatus === 'success'">
            <div v-if="state.historyRecords.length === 0" class="admin-empty">查無此 User ID 的遊戲紀錄。</div>
            <table v-else class="admin-table">
              <thead>
                <tr>
                  <th>時間</th>
                  <th>遊戲</th>
                  <th style="text-align:right">分數</th>
                  <th>等級</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="h in state.historyRecords" :key="h.id">
                  <td class="admin-num" style="color:color-mix(in srgb, #1c1c22 72%, #ffffff)">{{ _handlers.formatDate(h.playedAt) }}</td>
                  <td>{{ h.gameName }}</td>
                  <td class="admin-num" style="text-align:right">{{ h.score }}</td>
                  <td class="admin-num">{{ h.level ?? '—' }}</td>
                </tr>
              </tbody>
            </table>
            <div v-if="state.historyCoin.length" class="agm-coin-title admin-en">Coin 兌換明細</div>
            <table v-if="state.historyCoin.length" class="admin-table">
              <thead>
                <tr>
                  <th>時間</th>
                  <th style="text-align:right">兌換 coin</th>
                  <th>說明</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="c in state.historyCoin" :key="c.id">
                  <td class="admin-num" style="color:color-mix(in srgb, #1c1c22 72%, #ffffff)">{{ _handlers.formatDate(new Date(c.createdAt).toISOString()) }}</td>
                  <td class="admin-num" style="text-align:right">+{{ c.amount }}</td>
                  <td>{{ c.note }}</td>
                </tr>
              </tbody>
            </table>
          </template>
        </section>
      </div>
    </div>

    <div v-if="state.mazeDialogOpen" class="agm-dialog-backdrop" @click.self="click.closeMaze">
      <div class="agm-dialog admin-panel">
        <div class="agm-dialog-title">新增固定樣板迷宮</div>
        <div class="agm-dialog-body">
          <div class="admin-field" style="margin-bottom:14px">
            <label>樣板名稱</label>
            <input v-model="state.mazeName" class="admin-input" placeholder="經典雙迴廊">
          </div>
          <div class="admin-field">
            <label># 牆、. 通道（其餘字元亦視為通道）— 需 21 列、每列 19 字元，儲存前會在 server 端跑連通性驗證</label>
            <textarea v-model="state.mazeDraft" class="admin-input admin-num agm-dialog-textarea"></textarea>
          </div>
          <div v-if="state.mazeError" class="agm-dialog-error">{{ state.mazeError }}</div>
        </div>
        <div class="agm-dialog-actions">
          <button type="button" class="admin-btn admin-btn-secondary" @click="click.closeMaze">取消</button>
          <button type="button" class="admin-btn admin-btn-primary" :disabled="state.mazeSaving" @click="click.saveMaze">
            {{ state.mazeSaving ? '驗證中...' : '驗證並儲存' }}
          </button>
        </div>
      </div>
    </div>
  </AdminShell>
</template>

<style scoped lang="scss">
.agm-layout {
  display: flex;
  gap: 44px;
  align-items: flex-start;
}

.agm-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 46px;
}

.agm-edit-input {
  display: inline-block;
  width: auto;
  text-align: right;
  max-width: 92px;
}

.agm-actions {
  display: flex;
  gap: 6px;
  justify-content: flex-end;
  align-items: center;
}

.agm-msg {
  font-size: 11.5px;
  color: var(--ink);
  margin-top: 6px;
  text-align: right;
}

.agm-mazes {
  grid-template-columns: repeat(3, 1fr);

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
}

.agm-maze-card {
  padding: 22px;
  display: flex;
  flex-direction: column;
  gap: 13px;
}

.agm-maze-top {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}

.agm-maze-grid {
  margin: 0;
  font-size: 10px;
  line-height: 1.25;
  color: color-mix(in srgb, #1c1c22 72%, #ffffff);
  white-space: pre;
  overflow: auto;
}

.agm-maze-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: auto;
}

.agm-query {
  display: flex;
  gap: 10px;
  align-items: flex-end;
  margin-bottom: 20px;
}

.agm-coin-title {
  margin: 20px 0 10px;
}

.agm-dialog-backdrop {
  position: fixed;
  inset: 0;
  z-index: 50;
  background: rgba(28, 28, 34, 0.5);
  display: grid;
  place-items: center;
  padding: 20px;
}

.agm-dialog {
  width: min(560px, 100%);
  border-radius: 2px;
}

.agm-dialog-title {
  font-size: 15px;
  font-weight: 700;
  padding: 18px 22px;
  border-bottom: 1px solid var(--line);
}

.agm-dialog-body {
  padding: 20px 22px;
}

.agm-dialog-textarea {
  min-height: 150px;
  font-size: 11px;
  line-height: 1.3;
  padding: 10px;
  width: 100%;
  resize: vertical;
}

.agm-dialog-error {
  font-size: 12.5px;
  color: var(--ink);
  margin-top: 12px;
  border-left: 2px solid var(--ink);
  padding-left: 10px;
}

.agm-dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 16px 22px;
  border-top: 1px solid var(--line);
}
</style>
