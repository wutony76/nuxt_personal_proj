<script setup>
import { computed } from 'vue'
import { Doughnut } from 'vue-chartjs'
import { Chart, registerables } from 'chart.js'
import { api } from '~/services/api'
import { useAdminReportData } from '~/composables/useAdminReportData'

Chart.register(...registerables)

// ─── 甜甜圈配色（黑白灰系列）───
const PALETTE = [
  '#1c1c22', '#3d3d48', '#5e5e6e', '#7f7f94',
  '#a0a0ba', '#bdbdd0', '#d4d4e6', '#e8e8f2',
  '#c0c0d0', '#909098',
]

// ─── State（改用 useAdminReportData：SSR + cookie 轉發，見 add-ssr-admin-reports-cookie-forward） ───
const { month, status, error, summary } = await useAdminReportData('admin-report-plays', api.admin.reports.bgSummary)

// ─── Donut Chart data（BG 彩種佔比，比照總覽頁的彩種排行，不是更細的玩法/playKey 分析）───
const donutData = computed(() => {
  if (!summary.value?.gameRanking?.length) return null
  const items = summary.value.gameRanking.slice(0, 10)
  return {
    labels: items.map((p) => p.name),
    datasets: [
      {
        data: items.map((p) => p.sales),
        backgroundColor: items.map((_, i) => PALETTE[i % PALETTE.length]),
        borderColor: '#ffffff',
        borderWidth: 2,
        hoverOffset: 6,
      },
    ],
  }
})

const donutOptions = {
  responsive: true,
  maintainAspectRatio: false,
  cutout: '62%',
  plugins: {
    legend: {
      position: 'right',
      labels: {
        font: { size: 12 },
        color: '#1c1c22',
        padding: 14,
        boxWidth: 12,
        boxHeight: 12,
      },
    },
    tooltip: {
      callbacks: {
        label: (ctx) => {
          const item = summary.value.gameRanking[ctx.dataIndex]
          return ` F${Number(ctx.raw).toLocaleString('zh-TW')} (${item?.ratio ?? 0}%)`
        },
      },
    },
  },
}

// ─── Formatters ───
const _fmt = {
  coin: (v) => `F${Number(v).toLocaleString('zh-TW')}`,
}

// ─── Donut Chart data（台彩彩種佔比，跟 BG 側同一種圖表）───
const twDonutData = computed(() => {
  if (!summary.value?.twTotal?.gameRanking?.length) return null
  const items = summary.value.twTotal.gameRanking.slice(0, 10)
  return {
    labels: items.map((p) => p.name),
    datasets: [
      {
        data: items.map((p) => p.sales),
        backgroundColor: items.map((_, i) => PALETTE[i % PALETTE.length]),
        borderColor: '#ffffff',
        borderWidth: 2,
        hoverOffset: 6,
      },
    ],
  }
})

const twDonutOptions = {
  responsive: true,
  maintainAspectRatio: false,
  cutout: '62%',
  plugins: {
    legend: {
      position: 'right',
      labels: {
        font: { size: 12 },
        color: '#1c1c22',
        padding: 14,
        boxWidth: 12,
        boxHeight: 12,
      },
    },
    tooltip: {
      callbacks: {
        label: (ctx) => {
          const item = summary.value.twTotal.gameRanking[ctx.dataIndex]
          return ` F${Number(ctx.raw).toLocaleString('zh-TW')} (${item?.ratio ?? 0}%)`
        },
      },
    },
  },
}

</script>

<template>
  <AdminShell active="reports" kicker="資料統計 / 玩法" title="玩法" desc="BG.TW 彩種熱門佔比，比照總覽頁的排行.">
    <AdminReportsNav active="plays" />

    <!-- 月份篩選器 -->
    <div class="arp-toolbar">
      <AdminMonthPicker v-model="month" />
    </div>

    <!-- Loading -->
    <div v-if="status === 'loading'" class="admin-empty">載入中…</div>

    <!-- Error -->
    <div v-else-if="status === 'error'" class="admin-empty" style="color:#b91c1c">{{ error }}</div>

    <!-- Success -->
    <template v-else-if="status === 'success' && summary">

      <!-- 分布圖：BG 玩法佔比／台彩每日走勢 並列 -->
      <div class="arp-chart-split">

        <div class="arp-chart-col">
          <div class="admin-sechead">
            <div class="admin-sechead-left">
              <h2>分布圖</h2>
              <span class="admin-meta admin-tag">BG · 彩種佔比</span>
            </div>
            <span class="admin-meta">{{ summary.month }}</span>
          </div>
          <div v-if="!summary.gameRanking.length" class="admin-empty">本月無 BG 彩種資料</div>
          <div v-else class="arp-donut-wrap">
            <ClientOnly>
              <Doughnut v-if="donutData" :data="donutData" :options="donutOptions" />
              <template #fallback>
                <div class="admin-empty">圖表載入中…</div>
              </template>
            </ClientOnly>
          </div>
        </div>

        <div class="arp-chart-col">
          <div class="admin-sechead">
            <div class="admin-sechead-left">
              <h2>分布圖</h2>
              <span class="admin-meta admin-tag">TW · 彩種佔比</span>
            </div>
            <span class="admin-meta">{{ summary.month }}</span>
          </div>
          <div v-if="!summary.twTotal.totalSales" class="admin-empty">本月無台彩投注紀錄</div>
          <div v-else class="arp-donut-wrap">
            <ClientOnly>
              <Doughnut v-if="twDonutData" :data="twDonutData" :options="twDonutOptions" />
              <template #fallback>
                <div class="admin-empty">圖表載入中…</div>
              </template>
            </ClientOnly>
          </div>
        </div>

      </div>

      <!-- 玩法佔比／統計（BG）／台彩彩種 並列 -->
      <div class="arp-detail-row">

        <!-- BG：彩種統計表（比照總覽頁的彩種排行） -->
        <div class="arp-detail-col">
          <div class="admin-sechead">
            <div class="admin-sechead-left">
              <h2>彩種排行</h2>
              <span class="admin-meta admin-tag">BG</span>
            </div>
            <span class="admin-meta">{{ summary.month }}（其中 NPC 銷售額 {{ _fmt.coin(summary.npc.totalSales) }}）</span>
          </div>

          <div v-if="!summary.gameRanking.length" class="admin-empty">
            目前月份沒有彩種銷售資料。
          </div>

          <template v-else>
            <table class="admin-table arp-table">
              <thead>
                <tr>
                  <th>彩種</th>
                  <th class="admin-num" style="text-align:right">銷售額</th>
                  <th class="admin-num" style="text-align:right">注數</th>
                  <th class="admin-num" style="text-align:right">佔比</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(item, i) in summary.gameRanking" :key="item.key">
                  <td>
                    <span class="arp-color-dot" :style="{ background: PALETTE[i % PALETTE.length] }" />
                    {{ item.name }}
                  </td>
                  <td class="admin-num" style="text-align:right">{{ _fmt.coin(item.sales) }}</td>
                  <td class="admin-num" style="text-align:right">{{ item.orders.toLocaleString('zh-TW') }}</td>
                  <td class="admin-num" style="text-align:right">{{ item.ratio }}%</td>
                </tr>
              </tbody>
            </table>
          </template>
        </div>

        <!-- 台彩彩種累計（不受月份篩選影響） -->
        <div class="arp-detail-col">
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
            <table class="admin-table arp-table">
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
                  <td>
                    <span class="arp-color-dot" style="background:#bdbdd0" />
                    {{ item.name }}
                  </td>
                  <td class="admin-num" style="text-align:right">{{ _fmt.coin(item.sales) }}</td>
                  <td class="admin-num" style="text-align:right">{{ item.orders.toLocaleString('zh-TW') }}</td>
                  <td class="admin-num" style="text-align:right">{{ item.ratio }}%</td>
                </tr>
              </tbody>
            </table>
          </template>
        </div>

      </div>
    </template>
  </AdminShell>
</template>

<style scoped lang="scss">
.arp-toolbar {
  margin-bottom: 32px;
}

.arp-chart-split {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0 1px;
  background: var(--line);
  border: 1px solid var(--line);
  margin-bottom: 44px;

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
    gap: 1px 0;
  }
}

.arp-chart-col {
  background: var(--paper);
  padding: 20px 20px 20px;
  min-width: 0;
}

.arp-detail-row {
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

.arp-detail-col {
  background: var(--paper);
  padding: 24px 20px 20px;
  min-width: 0;
}

.arp-donut-wrap {
  height: 300px;
  position: relative;
}

.arp-table {
  max-width: 580px;
}

.arp-color-dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 2px;
  margin-right: 8px;
  vertical-align: middle;
  flex-shrink: 0;
}
</style>
