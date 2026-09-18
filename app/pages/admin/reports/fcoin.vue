<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import dayjs from 'dayjs'
import { Bar } from 'vue-chartjs'
import { Chart, registerables } from 'chart.js'
import { api } from '~/services/api'

Chart.register(...registerables)

// ─── State ───
const month = ref(dayjs().format('YYYY-MM'))
const status = ref('idle')
const error = ref('')
const summary = ref(null)

// ─── Daily Flow Chart ───
const flowBarData = computed(() => {
  if (!summary.value?.dailyFlow?.length) return null
  const active = summary.value.dailyFlow.filter((d) => d.bet > 0 || d.reward > 0)
  if (!active.length) return null
  const labels = summary.value.dailyFlow.map((d) => {
    const [, , day] = d.day.split('-')
    return `${summary.value.month.slice(5)}/${day}`
  })
  return {
    labels,
    datasets: [
      {
        label: '換 F幣',
        data: summary.value.dailyFlow.map((d) => d.reward),
        backgroundColor: 'rgba(28,28,34,0.25)',
        borderColor: 'rgba(28,28,34,0.4)',
        borderWidth: 1,
        borderRadius: 2,
        stack: 'flow',
      },
    ],
  }
})

const flowBarOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: true,
      labels: { font: { size: 11 }, color: '#444', boxWidth: 12, boxHeight: 12 }
    },
    tooltip: {
      callbacks: {
        label: (ctx) => ` ${ctx.dataset.label}: ${Number(ctx.raw).toLocaleString('zh-TW')} F幣`,
      },
    },
  },
  scales: {
    x: {
      stacked: true,
      ticks: { font: { size: 10 }, color: '#888', maxTicksLimit: 15 },
      grid: { color: 'rgba(28,28,34,0.06)' },
    },
    y: {
      stacked: true,
      ticks: {
        font: { size: 10 },
        color: '#888',
        callback: (v) => Number(v).toLocaleString('zh-TW'),
      },
      grid: { color: 'rgba(28,28,34,0.06)' },
    },
  },
}

// ─── Formatters ───
const _fmt = {
  coin: (v) => `${Number(v).toLocaleString('zh-TW')} F幣`,
}

// ─── Actions ───
const _actions = {
  fetch: async () => {
    if (status.value === 'loading') return
    status.value = 'loading'
    error.value = ''
    summary.value = null
    try {
      summary.value = await api.admin.reports.fCoinSummary(month.value)
      status.value = 'success'
    } catch (e) {
      error.value = e?.message ?? '載入失敗'
      status.value = 'error'
    }
  },
}

watch(month, () => _actions.fetch())
onMounted(() => _actions.fetch())
</script>

<template>
  <AdminShell active="reports" kicker="資料統計 / 兌F幣" title="兌F幣" desc="遊戲計分兌F幣狀況，依照情況對特定遊戲進行設定.">
    <AdminReportsNav active="fcoin" />

    <!-- 月份篩選器 -->
    <div class="afc-toolbar">
      <AdminMonthPicker v-model="month" />
    </div>

    <!-- Loading -->
    <div v-if="status === 'loading'" class="admin-empty">載入中…</div>

    <!-- Error -->
    <div v-else-if="status === 'error'" class="admin-empty" style="color:#b91c1c">{{ error }}</div>

    <!-- Success -->
    <template v-else-if="status === 'success' && summary">

      <div v-if="!summary.totalBet && !summary.totalReward" class="admin-empty">
        目前月份無 F幣 兌換紀錄，請先進行 Game Center 遊戲。
      </div>

      <template v-else>

        <!-- KPI 卡片 -->
        <div class="afc-kpi-grid admin-grid1">
          <div class="afc-kpi admin-panel">
            <div class="admin-en">F Coin Exchanged</div>
            <div class="afc-kpi-num admin-num">{{ _fmt.coin(summary.totalReward) }}</div>
            <div class="afc-kpi-label">換 F幣</div>
          </div>
        </div>

        <!-- 每日流水 Chart -->
        <div class="afc-section">
          <div class="admin-sechead">
            <h2> 兑幣/月</h2>
            <span class="admin-meta">{{ summary.month }}</span>
          </div>
          <div class="afc-chart-wrap">
            <ClientOnly>
              <Bar v-if="flowBarData" :data="flowBarData" :options="flowBarOptions" />
              <template #fallback>
                <div class="admin-empty">圖表載入中…</div>
              </template>
            </ClientOnly>
          </div>
        </div>

        <!-- 遊戲明細表格 -->
        <div class="afc-section">
          <div class="admin-sechead">
            <h2>遊戲明細</h2>
            <span class="admin-meta">{{ summary.month }}</span>
          </div>
          <table class="admin-table afc-table">
            <thead>
              <tr>
                <th>遊戲</th>
                <th class="admin-num" style="text-align:right">換 F幣</th>
                <th class="admin-num" style="text-align:right">筆數</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in summary.perGame" :key="item.name">
                <td>{{ item.name }}</td>
                <td class="admin-num" style="text-align:right">{{ item.reward.toLocaleString('zh-TW') }}</td>
                <td class="admin-num" style="text-align:right">{{ item.count.toLocaleString('zh-TW') }}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr class="afc-total-row">
                <td><strong>合計</strong></td>
                <td class="admin-num" style="text-align:right"><strong>{{ summary.totalReward.toLocaleString('zh-TW')
                    }}</strong></td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>

      </template>
    </template>
  </AdminShell>
</template>

<style scoped lang="scss">
.afc-toolbar {
  margin-bottom: 32px;
}

.afc-kpi-grid {
  grid-template-columns: 1fr;
  max-width: 320px;
  margin-bottom: 40px;
}

.afc-kpi {
  padding: 20px 18px 16px;
}

.afc-kpi-num {
  font-size: 24px;
  font-weight: 700;
  margin: 8px 0 5px;
  letter-spacing: -0.03em;
}

.afc-kpi-label {
  font-size: 12px;
  color: var(--muted);
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.afc-section {
  margin-bottom: 44px;
}

.afc-chart-wrap {
  height: 240px;
  position: relative;
}

.afc-table {
  max-width: 680px;
}

.afc-total-row td {
  border-top: 1px solid var(--ink);
  padding-top: 9px;
  font-size: 13px;
}
</style>
