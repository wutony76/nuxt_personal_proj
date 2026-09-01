<script setup lang="ts">
/**
 * BG彩票後台（/admin/bg-lottery）：彩池補貼追蹤，含池底重骰事件與保底超付事件兩份記錄。
 * 見 design.md Decision 3。資料來自 Storage.lottery.poolAudit（in-memory，重啟歸零）。
 */
import { reactive, computed, onMounted } from 'vue'
import { api, type BgPoolReseedEvent, type BgFloorOverpayEvent, type BgPoolAuditSummary } from '~/services/api'

type AsyncStatus = 'idle' | 'loading' | 'success' | 'error'

const LOTTERY_KEYS = [
  { key: '', label: '全部彩種' },
  { key: 'LHC-OF', label: '六合彩' },
  { key: 'K3', label: '快3' },
  { key: 'PK10', label: 'PK10' },
  { key: 'SSC', label: '時時彩' },
  { key: 'X5', label: '11選5' },
  { key: 'EGGS', label: 'PC蛋蛋' },
  { key: 'KL10', label: '快樂十分' },
  { key: 'KL8', label: '快樂8' },
  { key: 'FC3D', label: '福彩3D' },
  { key: 'PL3', label: '排列3' },
]

const RANGE_OPTIONS = [
  { value: 'all', label: '全部時間' },
  { value: '7d', label: '近 7 日' },
  { value: '30d', label: '近 30 日' },
]

const state = reactive({
  status: 'idle' as AsyncStatus,
  error: '',
  reseed: [] as BgPoolReseedEvent[],
  overpay: [] as BgFloorOverpayEvent[],
  summary: [] as BgPoolAuditSummary[],
  stats: { reseedCount: 0, overpayCount: 0, totalOverpay: 0 },
  filterKey: '',
  filterRange: 'all' as 'all' | '7d' | '30d',
  activeTab: 'overpay' as 'overpay' | 'reseed' | 'summary',
})

const _actions = {
  fetch: async () => {
    if (state.status === 'loading') return
    state.status = 'loading'
    state.error = ''
    try {
      const res = await api.admin.bgLottery.poolAudit({
        lotteryKey: state.filterKey || undefined,
        range: state.filterRange,
      })
      state.reseed = res.reseed
      state.overpay = res.overpay
      state.summary = res.summary
      state.stats = res.stats
      state.status = 'success'
    } catch (e: unknown) {
      state.error = (e as { message?: string })?.message ?? '載入失敗'
      state.status = 'error'
    }
  }
}

const click = {
  applyFilter: () => _actions.fetch(),
  setTab: (tab: typeof state.activeTab) => { state.activeTab = tab },
}

/** 每個摘要列的「超付」百分比（相對全部超付總和，僅供視覺條棒） */
const maxSummaryOverpay = computed(() =>
  Math.max(1, ...state.summary.map((s) => s.totalOverpay))
)

const _fmt = {
  coin: (v: number) => v.toLocaleString('zh-TW', { minimumFractionDigits: 0, maximumFractionDigits: 2 }),
  ts: (s: string) => s,
}

onMounted(() => _actions.fetch())
</script>

<template>
  <AdminShell active="gamemgmt" kicker="BG Lottery" title="BG彩票" desc="彩池補貼追蹤：池底重骰事件與保底超付事件兩類記錄，數值為 in-memory，重啟後清空。見 design.md Decision 3。">
    <div class="abl-layout">
      <AdminGameNav active="bg" />
      <div class="abl-main">

        <!-- Filters -->
        <div class="abl-filters">
          <div class="admin-field">
            <label>彩種</label>
            <select v-model="state.filterKey" class="admin-input">
              <option v-for="opt in LOTTERY_KEYS" :key="opt.key" :value="opt.key">{{ opt.label }}</option>
            </select>
          </div>
          <div class="admin-field">
            <label>時間區間</label>
            <select v-model="state.filterRange" class="admin-input">
              <option v-for="opt in RANGE_OPTIONS" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
            </select>
          </div>
          <button type="button" class="admin-btn admin-btn-primary abl-filter-btn" @click="click.applyFilter()">
            {{ state.status === 'loading' ? '查詢中…' : '查詢' }}
          </button>
        </div>

        <!-- Status messages -->
        <div v-if="state.status === 'error'" class="admin-empty" style="color:#b91c1c">{{ state.error }}</div>
        <div v-else-if="state.status === 'loading'" class="admin-empty">載入中…</div>

        <template v-else-if="state.status === 'success'">
          <!-- Stats row -->
          <div class="abl-stats admin-grid1">
            <div class="abl-stat admin-panel">
              <div class="admin-en">Pool reseed count</div>
              <div class="abl-stat-num admin-num">{{ state.stats.reseedCount }}</div>
              <div class="abl-stat-label">池底重骰次數</div>
            </div>
            <div class="abl-stat admin-panel">
              <div class="admin-en">Overpay events</div>
              <div class="abl-stat-num admin-num">{{ state.stats.overpayCount }}</div>
              <div class="abl-stat-label">保底超付事件</div>
            </div>
            <div class="abl-stat admin-panel">
              <div class="admin-en">Total overpay (coin)</div>
              <div class="abl-stat-num admin-num">{{ _fmt.coin(state.stats.totalOverpay) }}</div>
              <div class="abl-stat-label">彩池補貼累計</div>
            </div>
          </div>

          <!-- Tab switcher -->
          <div class="abl-tabs">
            <button type="button" class="abl-tab" :class="{ active: state.activeTab === 'overpay' }" @click="click.setTab('overpay')">
              <span>保底超付事件</span>
              <span class="admin-num abl-tab-count">{{ state.overpay.length }}</span>
            </button>
            <button type="button" class="abl-tab" :class="{ active: state.activeTab === 'reseed' }" @click="click.setTab('reseed')">
              <span>池底重骰事件</span>
              <span class="admin-num abl-tab-count">{{ state.reseed.length }}</span>
            </button>
            <button type="button" class="abl-tab" :class="{ active: state.activeTab === 'summary' }" @click="click.setTab('summary')">
              <span>各彩種摘要</span>
              <span class="admin-num abl-tab-count">{{ state.summary.length }}</span>
            </button>
          </div>

          <!-- Tab: overpay events -->
          <template v-if="state.activeTab === 'overpay'">
            <div v-if="state.overpay.length === 0" class="admin-empty">
              目前無保底超付事件。只要彩池分層的「自然分配額」高於頭獎保底金額，就不會觸發。
            </div>
            <table v-else class="admin-table abl-table">
              <thead>
                <tr>
                  <th>時間</th>
                  <th>彩種</th>
                  <th>期號</th>
                  <th class="admin-num" style="text-align:right">超付金額（coin）</th>
                  <th>說明</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="e in state.overpay" :key="e.id">
                  <td class="admin-num abl-ts">{{ _fmt.ts(e.timeStr) }}</td>
                  <td>
                    <span class="abl-key-tag">{{ e.lotteryKey }}</span>
                    {{ e.lotteryName }}
                  </td>
                  <td class="admin-num">{{ e.issue }}</td>
                  <td class="admin-num abl-overpay-val">{{ _fmt.coin(e.overpay) }}</td>
                  <td class="abl-note">naturalPerUnit &lt; tier.minAmount，差額補足保底</td>
                </tr>
              </tbody>
            </table>
          </template>

          <!-- Tab: reseed events -->
          <template v-if="state.activeTab === 'reseed'">
            <div v-if="state.reseed.length === 0" class="admin-empty">
              目前無池底重骰事件。只要可發放金額維持在門檻以上，就不會觸發重骰。
            </div>
            <table v-else class="admin-table abl-table">
              <thead>
                <tr>
                  <th>時間</th>
                  <th>彩種</th>
                  <th>期號</th>
                  <th class="admin-num" style="text-align:right">重骰前（distributable）</th>
                  <th class="admin-num" style="text-align:right">重骰後（poolBase）</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="e in state.reseed" :key="e.id">
                  <td class="admin-num abl-ts">{{ _fmt.ts(e.timeStr) }}</td>
                  <td>
                    <span class="abl-key-tag">{{ e.lotteryKey }}</span>
                    {{ e.lotteryName }}
                  </td>
                  <td class="admin-num">{{ e.issue }}</td>
                  <td class="admin-num abl-muted">{{ _fmt.coin(e.before) }}</td>
                  <td class="admin-num">{{ _fmt.coin(e.after) }}</td>
                </tr>
              </tbody>
            </table>
          </template>

          <!-- Tab: summary by lottery -->
          <template v-if="state.activeTab === 'summary'">
            <div v-if="state.summary.length === 0" class="admin-empty">
              目前無任何事件紀錄。
            </div>
            <table v-else class="admin-table abl-table">
              <thead>
                <tr>
                  <th>彩種</th>
                  <th class="admin-num" style="text-align:right">池底重骰次數</th>
                  <th class="admin-num" style="text-align:right">彩池補貼累計（coin）</th>
                  <th style="min-width:180px">補貼佔比</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="s in state.summary" :key="s.key">
                  <td>
                    <span class="abl-key-tag">{{ s.key }}</span>
                    {{ s.name }}
                  </td>
                  <td class="admin-num" style="text-align:right">{{ s.reseedCount }}</td>
                  <td class="admin-num abl-overpay-val">{{ _fmt.coin(s.totalOverpay) }}</td>
                  <td>
                    <div class="abl-bar-wrap">
                      <div class="abl-bar" :style="{ width: `${(s.totalOverpay / maxSummaryOverpay) * 100}%` }"></div>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </template>

        </template>

      </div>
    </div>
  </AdminShell>
</template>

<style scoped lang="scss">
.abl-layout {
  display: flex;
  gap: 40px;
  align-items: flex-start;
}

.abl-main {
  flex: 1;
  min-width: 0;
}

.abl-filters {
  display: flex;
  align-items: flex-end;
  gap: 16px;
  margin-bottom: 28px;
  flex-wrap: wrap;
}

.abl-filter-btn {
  margin-top: auto;
}

.abl-stats {
  grid-template-columns: repeat(3, 1fr);
  margin-bottom: 32px;

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
}

.abl-stat {
  padding: 20px 18px 16px;
}

.abl-stat-num {
  font-size: 28px;
  font-weight: 700;
  margin: 8px 0 5px;
  letter-spacing: -0.03em;
}

.abl-stat-label {
  font-size: 12px;
  color: var(--muted);
}

.abl-tabs {
  display: flex;
  gap: 2px;
  border-bottom: 1px solid var(--line);
  margin-bottom: 20px;
}

.abl-tab {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 16px;
  height: 40px;
  font-size: 13px;
  font-family: inherit;
  border: 0;
  background: transparent;
  color: var(--muted);
  border-bottom: 2px solid transparent;
  cursor: pointer;
  margin-bottom: -1px;

  &:hover {
    color: var(--ink);
    background: var(--wash);
  }

  &.active {
    color: var(--ink);
    border-bottom-color: var(--ink);
  }
}

.abl-tab-count {
  font-size: 10.5px;
  background: var(--wash);
  border: 1px solid var(--line);
  padding: 1px 6px;
  border-radius: 2px;
}

.abl-table {
  margin-top: 4px;
}

.abl-ts {
  font-size: 12px;
  color: var(--muted);
  white-space: nowrap;
}

.abl-key-tag {
  display: inline-block;
  font-size: 9px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  background: var(--wash);
  border: 1px solid var(--line);
  padding: 1px 5px;
  margin-right: 5px;
  border-radius: 2px;
  font-family: monospace;
  color: var(--muted);
}

.abl-overpay-val {
  text-align: right;
  font-weight: 600;
}

.abl-muted {
  text-align: right;
  color: var(--muted);
}

.abl-note {
  font-size: 11.5px;
  color: var(--muted);
  font-family: monospace;
}

.abl-bar-wrap {
  height: 6px;
  background: var(--line-soft);
  border-radius: 2px;
  overflow: hidden;
  max-width: 240px;
}

.abl-bar {
  height: 100%;
  background: var(--ink);
  border-radius: 2px;
  min-width: 2px;
  transition: width 0.3s;
}
</style>
