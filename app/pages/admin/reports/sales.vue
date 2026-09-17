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

// ─── 月銷售趨勢 Bar Chart（全部有資料的月份）───
// 從所有月份取得當前月份的資料，但若要顯示年度趨勢需要多月份資料
// 初版：只顯示當月每日銷售的 Bar Chart（比月度趨勢更具體）
const dailyBarData = computed(() => {
  if (!summary.value?.dailySales?.length) return null
  const labels = summary.value.dailySales.map((d) => {
    const [, , day] = d.day.split('-')
    return `${summary.value.month.slice(5)}/${day}`
  })
  return {
    labels,
    datasets: [
      {
        label: '下注額',
        data: summary.value.dailySales.map((d) => d.sales),
        backgroundColor: 'rgba(28,28,34,0.75)',
        borderColor: '#1c1c22',
        borderWidth: 1,
        borderRadius: 2,
      },
    ],
  }
})

// ─── TW Bar Chart ───
const twDailyBarData = computed(() => {
  if (!summary.value?.twTotal?.dailySales?.length) return null
  const labels = summary.value.twTotal.dailySales.map((d) => {
    const [, , day] = d.day.split('-')
    return `${summary.value.month.slice(5)}/${day}`
  })
  return {
    labels,
    datasets: [
      {
        label: '下注額',
        data: summary.value.twTotal.dailySales.map((d) => d.sales),
        backgroundColor: 'rgba(94,94,110,0.6)',
        borderColor: '#5e5e6e',
        borderWidth: 1,
        borderRadius: 2,
      },
    ],
  }
})

const barOptions = {
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
      ticks: { font: { size: 10 }, color: '#888', maxTicksLimit: 15 },
      grid: { display: false },
    },
    y: {
      ticks: {
        font: { size: 10 },
        color: '#888',
        callback: (v) => `F${Number(v).toLocaleString('zh-TW')}`,
      },
      grid: { color: 'rgba(28,28,34,0.06)' },
    },
  },
}

const twBarOptions = {
  ...barOptions,
  scales: {
    x: {
      ticks: { font: { size: 10 }, color: '#888', maxTicksLimit: 15 },
      grid: { display: false },
    },
    y: {
      ticks: {
        font: { size: 10 },
        color: '#888',
        callback: (v) => `F${Number(v).toLocaleString('zh-TW')}`,
      },
      grid: { color: 'rgba(94,94,110,0.06)' },
    },
  },
}

// ─── 玩法排行 Horizontal Bar ───
const playBarData = computed(() => {
  if (!summary.value?.playRanking?.length) return null
  const items = summary.value.playRanking.slice(0, 12)
  return {
    labels: items.map((p) => p.name),
    datasets: [
      {
        label: '銷售額',
        data: items.map((p) => p.sales),
        backgroundColor: items.map((_, i) =>
          i === 0 ? 'rgba(28,28,34,0.85)' : `rgba(28,28,34,${0.55 - i * 0.04})`
        ),
        borderWidth: 0,
        borderRadius: 2,
      },
    ],
  }
})

const hBarOptions = {
  indexAxis: 'y',
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
      ticks: {
        font: { size: 10 },
        color: '#888',
        callback: (v) => `F${Number(v).toLocaleString('zh-TW')}`,
      },
      grid: { color: 'rgba(28,28,34,0.06)' },
    },
    y: {
      ticks: { font: { size: 11 }, color: '#444' },
      grid: { display: false },
    },
  },
}

const playBarHeight = computed(() => {
  const count = summary.value?.playRanking?.length ?? 0
  return Math.max(200, Math.min(count, 12) * 36 + 40)
})

// ─── Formatters ───
const _fmt = {
  coin: (v) => `F${Number(v).toLocaleString('zh-TW')}`,
}

// ─── Actions ───
const _actions = {
  fetch: async () => {
    if (status.value === 'loading') return
    status.value = 'loading'
    error.value = ''
    summary.value = null
    try {
      summary.value = await api.admin.reports.bgSummary(month.value)
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
  <AdminShell active="reports" kicker="資料統計 / 銷售" title="銷售" desc="月份銷售 Bar Chart 與玩法排行。玩法排行僅統計含玩法識別碼的訂單。">
    <AdminReportsNav active="sales" />

    <!-- 月份篩選器 -->
    <div class="ars-toolbar">
      <AdminMonthPicker v-model="month" />
    </div>

    <!-- Loading -->
    <div v-if="status === 'loading'" class="admin-empty">載入中…</div>

    <!-- Error -->
    <div v-else-if="status === 'error'" class="admin-empty" style="color:#b91c1c">{{ error }}</div>

    <!-- Success -->
    <template v-else-if="status === 'success' && summary">

      <!-- BG 走勢圖 -->
      <div class="ars-section">
        <div class="admin-sechead">
          <h2>走勢圖 / 月</h2>
          <span class="admin-meta admin-tag">BG · {{ summary.month }} · 每日</span>
        </div>
        <div v-if="summary.totalSales === 0" class="admin-empty">
          目前月份沒有可用的 BG 銷售資料，請先進行 BG 彩票投注操作。
        </div>
        <div v-else class="ars-chart-wrap">
          <ClientOnly>
            <Bar v-if="dailyBarData" :data="dailyBarData" :options="barOptions" />
            <template #fallback><div class="admin-empty">圖表載入中…</div></template>
          </ClientOnly>
        </div>
      </div>

      <!-- TW 走勢圖 -->
      <div class="ars-section">
        <div class="admin-sechead">
          <h2>走勢圖 / 月</h2>
          <span class="admin-meta admin-tag">TW · {{ summary.month }} · 每日</span>
        </div>
        <div v-if="!summary.twTotal.totalSales" class="admin-empty">
          本月無台彩投注紀錄。
        </div>
        <div v-else class="ars-chart-wrap">
          <ClientOnly>
            <Bar v-if="twDailyBarData" :data="twDailyBarData" :options="twBarOptions" />
            <template #fallback><div class="admin-empty">圖表載入中…</div></template>
          </ClientOnly>
        </div>
      </div>

      <!-- 玩法排行（BG）／台彩彩種累計 並列 -->
      <div class="ars-detail-row">

        <!-- 玩法排行 -->
        <div class="ars-detail-col">
          <div class="admin-sechead">
            <div class="admin-sechead-left">
              <h2>排行</h2>
              <span class="admin-meta admin-tag">BG · 僅含玩法識別碼的訂單</span>
            </div>
            <span class="admin-meta">{{ summary.month }}</span>
          </div>

          <div v-if="!summary.playRanking.length" class="admin-empty">
            目前月份沒有含玩法識別碼的訂單。玩法識別碼由各玩法下注時自動帶入。
          </div>

          <template v-else>
            <div class="ars-chart-wrap" :style="{ height: `${playBarHeight}px` }">
              <ClientOnly>
                <Bar v-if="playBarData" :data="playBarData" :options="hBarOptions" />
                <template #fallback><div class="admin-empty">圖表載入中…</div></template>
              </ClientOnly>
            </div>

            <!-- 玩法排行表格 -->
            <table class="admin-table ars-table">
              <thead>
                <tr>
                  <th>玩法</th>
                  <th class="admin-num" style="text-align:right">銷售額</th>
                  <th class="admin-num" style="text-align:right">注數</th>
                  <th class="admin-num" style="text-align:right">佔比</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in summary.playRanking" :key="item.key">
                  <td>{{ item.name }}</td>
                  <td class="admin-num" style="text-align:right">{{ _fmt.coin(item.sales) }}</td>
                  <td class="admin-num" style="text-align:right">{{ item.orders.toLocaleString('zh-TW') }}</td>
                  <td class="admin-num" style="text-align:right">{{ item.ratio }}%</td>
                </tr>
              </tbody>
            </table>
          </template>
        </div>

        <!-- 台彩彩種累計（不受月份篩選影響） -->
        <div class="ars-detail-col">
          <div class="admin-sechead">
            <div class="admin-sechead-left">
              <h2>台彩排行</h2>
              <span class="admin-meta admin-tag">TW · {{ summary.month }}</span>
            </div>
          </div>
          <div v-if="!summary.twTotal.totalSales" class="admin-empty">
            本月無台彩投注紀錄。
          </div>
          <template v-else>
            <table class="admin-table ars-table">
              <thead>
                <tr>
                  <th>彩種</th>
                  <th class="admin-num" style="text-align:right">累計銷售額</th>
                  <th class="admin-num" style="text-align:right">累計注數</th>
                  <th class="admin-num" style="text-align:right">佔比</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in summary.twTotal.gameRanking" :key="item.key">
                  <td>{{ item.name }}</td>
                  <td class="admin-num" style="text-align:right">{{ _fmt.coin(item.sales) }}</td>
                  <td class="admin-num" style="text-align:right">{{ item.orders.toLocaleString('zh-TW') }}</td>
                  <td class="admin-num" style="text-align:right">{{ item.ratio }}%</td>
                </tr>
              </tbody>
              <tfoot>
                <tr class="ars-total-row">
                  <td><strong>合計</strong></td>
                  <td class="admin-num" style="text-align:right"><strong>{{ _fmt.coin(summary.twTotal.totalSales) }}</strong></td>
                  <td class="admin-num" style="text-align:right">{{ summary.twTotal.totalOrders.toLocaleString('zh-TW') }}</td>
                  <td class="admin-num" style="text-align:right">100%</td>
                </tr>
              </tfoot>
            </table>
          </template>
        </div>

      </div>
    </template>
  </AdminShell>
</template>

<style scoped lang="scss">
.ars-toolbar {
  margin-bottom: 32px;
}

.ars-section {
  margin-bottom: 44px;
}

.ars-chart-wrap {
  height: 240px;
  position: relative;
}

.ars-table {
  margin-top: 20px;
  max-width: 600px;
}

.ars-detail-row {
  margin-top: 44px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0 1px;
  background: var(--line);
  border: 1px solid var(--line);
  align-items: flex-start;

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
    gap: 1px 0;
  }
}

.ars-detail-col {
  background: var(--paper);
  padding: 24px 20px 20px;
  min-width: 0;
}

.ars-total-row td {
  border-top: 1px solid var(--ink);
  padding-top: 9px;
  font-size: 13px;
}
</style>
