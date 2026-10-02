<script setup>
import { computed } from 'vue'
import { Line } from 'vue-chartjs'
import { Chart, registerables } from 'chart.js'
import { api } from '~/services/api'
import { useAdminReportData } from '~/composables/useAdminReportData'

Chart.register(...registerables)

// ─── State（改用 useAdminReportData：SSR + cookie 轉發，見 add-ssr-admin-reports-cookie-forward） ───
const { month, status, error, summary } = await useAdminReportData('admin-report-index', api.admin.reports.bgSummary)

// ─── 共用 chart options factory ───
// xTicksLimit／yTicksLimit 越小，軸上標籤跨度越大（標籤數越少、間距越開）
function makeLineOptions({ xTicksLimit = 8, yTicksLimit } = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => ` F${Number(ctx.raw).toLocaleString('zh-TW')}`,
        },
      },
    },
    scales: {
      x: {
        ticks: { font: { size: 10 }, color: '#888', maxTicksLimit: xTicksLimit },
        grid: { color: 'rgba(28,28,34,0.06)' },
      },
      y: {
        ticks: {
          font: { size: 10 },
          color: '#888',
          ...(yTicksLimit ? { maxTicksLimit: yTicksLimit } : {}),
          callback: (v) => `F${Number(v).toLocaleString('zh-TW')}`,
        },
        grid: { color: 'rgba(28,28,34,0.06)' },
      },
    },
  }
}

// ─── BG 走勢圖 ───
const lineChartData = computed(() => {
  if (!summary.value) return null
  const labels = summary.value.dailySales.map((d) => {
    const [, , day] = d.day.split('-')
    return `${summary.value.month.slice(5)}/${day}`
  })
  return {
    labels,
    datasets: [{
      label: '下注額',
      data: summary.value.dailySales.map((d) => d.sales),
      borderColor: '#1c1c22',
      backgroundColor: 'rgba(28,28,34,0.06)',
      borderWidth: 1.5,
      pointRadius: 2,
      pointHoverRadius: 4,
      tension: 0.3,
      fill: true,
    }],
  }
})

// ─── TW 走勢圖 ───
const twLineChartData = computed(() => {
  if (!summary.value?.twTotal?.dailySales) return null
  const labels = summary.value.twTotal.dailySales.map((d) => {
    const [, , day] = d.day.split('-')
    return `${summary.value.month.slice(5)}/${day}`
  })
  return {
    labels,
    datasets: [{
      label: '下注額',
      data: summary.value.twTotal.dailySales.map((d) => d.sales),
      borderColor: '#5e5e6e',
      backgroundColor: 'rgba(94,94,110,0.06)',
      borderWidth: 1.5,
      pointRadius: 2,
      pointHoverRadius: 4,
      tension: 0.3,
      fill: true,
    }],
  }
})

const lineChartOptions = makeLineOptions({ xTicksLimit: 8 })
const twLineChartOptions = makeLineOptions({ xTicksLimit: 8, yTicksLimit: 6 })

// ─── 最大銷售用於 ranking bar 寬度 ───
const maxGameSales = computed(() => {
  if (!summary.value?.gameRanking?.length) return 1
  return Math.max(1, ...summary.value.gameRanking.map((g) => g.sales))
})

// ─── Formatters ───
const _fmt = {
  coin: (v) => `F${Number(v).toLocaleString('zh-TW')}`,
  orders: (v) => Number(v).toLocaleString('zh-TW'),
}

</script>

<template>
  <AdminShell active="reports" kicker="資料統計" title="總覽" desc="依月份顯示 BG.TW 彩票KPI、趨勢與排行.">
    <AdminReportsNav active="dashboard" />

    <!-- 月份篩選器 -->
    <div class="ard-toolbar">
      <AdminMonthPicker v-model="month" />
    </div>

    <!-- Loading -->
    <div v-if="status === 'loading'" class="admin-empty">載入中…</div>

    <!-- Error -->
    <div v-else-if="status === 'error'" class="admin-empty" style="color:#b91c1c">{{ error }}</div>

    <!-- Success -->
    <template v-else-if="status === 'success' && summary">

      <!-- KPI 並列：BG 月度 ／ 台彩累計 -->
      <div class="ard-kpi-split">

        <!-- BG 月度 KPI -->
        <div class="ard-kpi-block">
          <div class="ard-kpi-block-head">
            <span class="admin-en ard-source-tag">BG</span>
            <span class="ard-block-label">本月</span>
            <span class="admin-meta">{{ summary.month }}</span>
          </div>
          <div v-if="summary.totalSales === 0" class="admin-empty ard-block-empty">本月無 BG 投注紀錄</div>
          <div v-else class="ard-kpi-grid admin-grid1">
            <div class="ard-kpi admin-panel">
              <div class="admin-en">Monthly Bets</div>
              <div class="ard-kpi-num admin-num">{{ _fmt.coin(summary.totalSales) }}</div>
              <div class="ard-kpi-label">下注額 / 月</div>
            </div>
            <div class="ard-kpi admin-panel">
              <div class="admin-en">Commission (est.)</div>
              <div class="ard-kpi-num admin-num">{{ _fmt.coin(summary.commission) }}</div>
              <div class="ard-kpi-label">抽成 / 月 <span class="ard-kpi-note">× 7%</span></div>
            </div>
            <div class="ard-kpi admin-panel">
              <div class="admin-en">Transactions</div>
              <div class="ard-kpi-num admin-num">{{ _fmt.orders(summary.totalOrders) }}</div>
              <div class="ard-kpi-label">注數</div>
            </div>
          </div>
        </div>

        <!-- 台彩累計 KPI -->
        <div class="ard-kpi-block">
          <div class="ard-kpi-block-head">
            <span class="admin-en ard-source-tag">TW</span>
            <span class="ard-block-label">本月</span>
            <span class="admin-meta">{{ summary.month }}</span>
          </div>
          <div v-if="!summary.twTotal.totalSales" class="admin-empty ard-block-empty">本月無台彩投注紀錄</div>
          <div v-else class="ard-kpi-grid admin-grid1 ard-tw-kpi-grid">
            <div class="ard-kpi admin-panel">
              <div class="admin-en">Monthly Bets</div>
              <div class="ard-kpi-num admin-num">{{ _fmt.coin(summary.twTotal.totalSales) }}</div>
              <div class="ard-kpi-label">下注額 / 月</div>
            </div>
            <div class="ard-kpi admin-panel">
              <div class="admin-en">Transactions</div>
              <div class="ard-kpi-num admin-num">{{ _fmt.orders(summary.twTotal.totalOrders) }}</div>
              <div class="ard-kpi-label">注數</div>
            </div>
          </div>
        </div>

      </div>

      <!-- 走勢圖：BG／台彩 並列 -->
      <div class="ard-chart-split">

        <!-- BG 走勢圖 -->
        <div class="ard-chart-col">
          <div class="admin-sechead">
            <div class="admin-sechead-left">
              <h2>走勢圖 / 月</h2>
              <span class="admin-meta admin-tag">BG</span>
            </div>
            <span class="admin-meta">{{ summary.month }}</span>
          </div>
          <div v-if="summary.totalSales === 0" class="admin-empty">本月無 BG 投注紀錄</div>
          <div v-else class="ard-chart-wrap">
            <ClientOnly>
              <Line v-if="lineChartData" :data="lineChartData" :options="lineChartOptions" />
              <template #fallback>
                <div class="admin-empty">圖表載入中…</div>
              </template>
            </ClientOnly>
          </div>
        </div>

        <!-- 台彩走勢圖 -->
        <div class="ard-chart-col">
          <div class="admin-sechead">
            <div class="admin-sechead-left">
              <h2>走勢圖 / 月</h2>
              <span class="admin-meta admin-tag">TW</span>
            </div>
            <span class="admin-meta">{{ summary.month }}</span>
          </div>
          <div v-if="!summary.twTotal.totalSales" class="admin-empty">本月無台彩投注紀錄</div>
          <div v-else class="ard-chart-wrap">
            <ClientOnly>
              <Line v-if="twLineChartData" :data="twLineChartData" :options="twLineChartOptions" />
              <template #fallback>
                <div class="admin-empty">圖表載入中…</div>
              </template>
            </ClientOnly>
          </div>
        </div>

      </div>

      <!-- 彩種排行：BG ／ 台彩 並列 -->
      <div class="ard-rank-split">

        <!-- BG 彩種排行 -->
        <div class="ard-rank-col">
          <div class="admin-sechead">
            <div class="admin-sechead-left">
              <h2>排行</h2>
              <span class="admin-meta admin-tag">BG</span>
            </div>
            <span class="admin-meta">{{ summary.month }}</span>
          </div>
          <div v-if="!summary.gameRanking.length" class="admin-empty">本月無 BG 彩種資料</div>
          <div v-else class="ard-ranking">
            <div v-for="item in summary.gameRanking" :key="item.key" class="ard-rank-row">
              <div class="ard-rank-name">{{ item.name }}</div>
              <div class="ard-rank-bar-wrap">
                <div class="ard-rank-bar" :style="{ width: `${(item.sales / maxGameSales) * 100}%` }" />
              </div>
              <div class="ard-rank-val admin-num">{{ _fmt.coin(item.sales) }}</div>
              <div class="ard-rank-ratio admin-num">{{ item.ratio }}%</div>
            </div>
          </div>
        </div>

        <!-- 台彩彩種排行 -->
        <div class="ard-rank-col">
          <div class="admin-sechead">
            <div class="admin-sechead-left">
              <h2>排行</h2>
              <span class="admin-meta admin-tag">TW</span>
            </div>
            <span class="admin-meta">{{ summary.month }}</span>
          </div>
          <div v-if="!summary.twTotal.gameRanking.length" class="admin-empty">本月無台彩資料</div>
          <div v-else class="ard-ranking">
            <div v-for="item in summary.twTotal.gameRanking" :key="item.key" class="ard-rank-row">
              <div class="ard-rank-name">{{ item.name }}</div>
              <div class="ard-rank-bar-wrap">
                <div class="ard-rank-bar ard-rank-bar--tw" :style="{ width: `${item.ratio}%` }" />
              </div>
              <div class="ard-rank-val admin-num">{{ _fmt.coin(item.sales) }}</div>
              <div class="ard-rank-ratio admin-num">{{ item.ratio }}%</div>
            </div>
          </div>
        </div>

      </div>

    </template>
  </AdminShell>
</template>

<style scoped lang="scss">
.ard-toolbar {
  margin-bottom: 32px;
}

// ── KPI 並列：BG ／ 台彩 ──────────────────────────────────────────────
.ard-kpi-split {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0 1px;
  background: var(--line);
  border: 1px solid var(--line);
  margin-bottom: 40px;

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
    gap: 1px 0;
  }
}

.ard-kpi-block {
  background: var(--paper);
  padding: 20px 20px 16px;
  min-width: 0;
}

.ard-kpi-block-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
}

.ard-source-tag {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.1em;
  background: var(--ink);
  color: var(--paper);
  padding: 2px 6px;
  border-radius: 2px;
}

.ard-block-label {
  font-size: 12px;
  font-weight: 600;
}

.ard-block-empty {
  padding: 16px 0;
}

// ── KPI 卡片 ────────────────────────────────────────────────────────────
.ard-kpi-grid {
  grid-template-columns: repeat(3, 1fr);

  @media (max-width: 700px) {
    grid-template-columns: 1fr 1fr;
  }
}

.ard-tw-kpi-grid {
  grid-template-columns: repeat(2, 1fr);
}

.ard-kpi {
  padding: 16px 14px 13px;
}

.ard-kpi-num {
  font-size: 22px;
  font-weight: 700;
  margin: 6px 0 4px;
  letter-spacing: -0.03em;
}

.ard-kpi-label {
  font-size: 11.5px;
  color: var(--muted);
  display: flex;
  align-items: center;
  gap: 5px;
  flex-wrap: wrap;
}

.ard-kpi-note {
  font-size: 10px;
  color: color-mix(in srgb, #1c1c22 40%, #ffffff);
}

// ── 趨勢圖並列：BG ／ 台彩 ────────────────────────────────────────────
.ard-chart-split {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0 1px;
  background: var(--line);
  border: 1px solid var(--line);
  margin-bottom: 40px;

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
    gap: 1px 0;
  }
}

.ard-chart-col {
  background: var(--paper);
  padding: 20px 20px 20px;
  min-width: 0;
}

.ard-chart-wrap {
  height: 220px;
  position: relative;
}

// ── 彩種排行並列 ──────────────────────────────────────────────────────
.ard-rank-split {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0 1px;
  background: var(--line);
  border: 1px solid var(--line);

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
    gap: 1px 0;
  }
}

.ard-rank-col {
  background: var(--paper);
  padding: 20px 20px 20px;
  min-width: 0;
}

.ard-ranking {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 4px;
}

.ard-rank-row {
  display: grid;
  grid-template-columns: 100px 1fr 90px 48px;
  align-items: center;
  gap: 10px;

  @media (max-width: 600px) {
    grid-template-columns: 80px 1fr 70px;

    .ard-rank-ratio {
      display: none;
    }
  }
}

.ard-rank-name {
  font-size: 12.5px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ard-rank-bar-wrap {
  height: 6px;
  background: var(--line-soft);
  border-radius: 2px;
  overflow: hidden;
}

.ard-rank-bar {
  height: 100%;
  background: var(--ink);
  border-radius: 2px;
  min-width: 2px;
  transition: width 0.4s;

  &--tw {
    background: var(--muted);
  }
}

.ard-rank-val {
  text-align: right;
  font-size: 12px;
}

.ard-rank-ratio {
  text-align: right;
  font-size: 11px;
  color: var(--muted);
}
</style>
