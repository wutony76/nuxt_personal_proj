<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import dayjs from 'dayjs'
import { Pie } from 'vue-chartjs'
import { Chart, registerables } from 'chart.js'
import { api } from '~/services/api'

Chart.register(...registerables)

// ─── 圓餅圖配色（黑白灰系列，比照玩法頁的 Donut）───
const PALETTE = [
  '#1c1c22', '#3d3d48', '#5e5e6e', '#7f7f94',
  '#a0a0ba', '#bdbdd0', '#d4d4e6', '#e8e8f2',
  '#c0c0d0', '#909098',
]

// ─── State ───
const month = ref(dayjs().format('YYYY-MM'))
const status = ref('idle')
const error = ref('')
const summary = ref(null)

// ─── 圓餅圖 data／options factory（BG／TW／GAME 三分類共用同一套）───
function makePieData(category) {
  return computed(() => {
    const ranking = summary.value?.[category]?.gameRanking
    if (!ranking?.length) return null
    const items = ranking.slice(0, 10)
    return {
      labels: items.map((p) => p.name),
      datasets: [
        {
          data: items.map((p) => p.players),
          backgroundColor: items.map((_, i) => PALETTE[i % PALETTE.length]),
          borderColor: '#ffffff',
          borderWidth: 2,
        },
      ],
    }
  })
}

function makePieOptions(category) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    // 圖例關掉：下方排行表本身就有色點對照，且三張圖項目數差很多（BG 15 款、TW 5 款、
    // GAME 最多 10 款），圖例會佔用不同高度導致圓餅本身大小不一致；關掉後三張圖
    // 都用同一個固定高度的容器，圓餅大小才會一致。
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const item = summary.value?.[category]?.gameRanking?.[ctx.dataIndex]
            return ` ${ctx.raw} 人 (${item?.ratio ?? 0}%)`
          },
        },
      },
    },
  }
}

const bgPieData = makePieData('bg')
const twPieData = makePieData('tw')
const gamePieData = makePieData('game')
const bgPieOptions = makePieOptions('bg')
const twPieOptions = makePieOptions('tw')
const gamePieOptions = makePieOptions('game')

// ─── Formatters ───
const _fmt = {
  players: (v) => `${Number(v).toLocaleString('zh-TW')} 人`,
}

// ─── Actions ───
const _actions = {
  fetch: async () => {
    if (status.value === 'loading') return
    status.value = 'loading'
    error.value = ''
    summary.value = null
    try {
      summary.value = await api.admin.reports.memberSummary(month.value)
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
  <AdminShell active="reports" kicker="資料統計 / 會員" title="會員"
    desc="BG／台彩／GAME 三分類，各玩法當月不重複人數佔比圓餅圖與排行。">
    <AdminReportsNav active="members" />

    <!-- 月份篩選器 -->
    <div class="amb-toolbar">
      <AdminMonthPicker v-model="month" />
    </div>

    <!-- Loading -->
    <div v-if="status === 'loading'" class="admin-empty">載入中…</div>

    <!-- Error -->
    <div v-else-if="status === 'error'" class="admin-empty" style="color:#b91c1c">{{ error }}</div>

    <!-- Success -->
    <template v-else-if="status === 'success' && summary">

      <!-- 三並列：BG／台彩／GAME -->
      <div class="amb-split">

        <!-- BG -->
        <div class="amb-col">
          <div class="admin-sechead">
            <div class="admin-sechead-left">
              <h2>最多人玩</h2>
              <span class="admin-meta admin-tag">BG</span>
            </div>
            <span class="admin-meta">{{ summary.month }}</span>
          </div>
          <div v-if="!summary.bg.gameRanking.length" class="admin-empty">本月無 BG 會員遊玩紀錄</div>
          <template v-else>
            <div class="amb-pie-wrap">
              <ClientOnly>
                <Pie :data="bgPieData" :options="bgPieOptions" />
                <template #fallback><div class="admin-empty">圖表載入中…</div></template>
              </ClientOnly>
            </div>
            <table class="admin-table amb-table">
              <thead>
                <tr>
                  <th>玩法</th>
                  <th class="admin-num" style="text-align:right">人數</th>
                  <th class="admin-num" style="text-align:right">佔比</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(item, i) in summary.bg.gameRanking" :key="item.key">
                  <td>
                    <span class="amb-color-dot" :style="{ background: PALETTE[i % PALETTE.length] }" />
                    {{ item.name }}
                  </td>
                  <td class="admin-num" style="text-align:right">{{ _fmt.players(item.players) }}</td>
                  <td class="admin-num" style="text-align:right">{{ item.ratio }}%</td>
                </tr>
              </tbody>
            </table>
          </template>
        </div>

        <!-- 台彩 -->
        <div class="amb-col">
          <div class="admin-sechead">
            <div class="admin-sechead-left">
              <h2>最多人玩</h2>
              <span class="admin-meta admin-tag">TW</span>
            </div>
            <span class="admin-meta">{{ summary.month }}</span>
          </div>
          <div v-if="!summary.tw.gameRanking.length" class="admin-empty">本月無台彩會員遊玩紀錄</div>
          <template v-else>
            <div class="amb-pie-wrap">
              <ClientOnly>
                <Pie :data="twPieData" :options="twPieOptions" />
                <template #fallback><div class="admin-empty">圖表載入中…</div></template>
              </ClientOnly>
            </div>
            <table class="admin-table amb-table">
              <thead>
                <tr>
                  <th>玩法</th>
                  <th class="admin-num" style="text-align:right">人數</th>
                  <th class="admin-num" style="text-align:right">佔比</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(item, i) in summary.tw.gameRanking" :key="item.key">
                  <td>
                    <span class="amb-color-dot" :style="{ background: PALETTE[i % PALETTE.length] }" />
                    {{ item.name }}
                  </td>
                  <td class="admin-num" style="text-align:right">{{ _fmt.players(item.players) }}</td>
                  <td class="admin-num" style="text-align:right">{{ item.ratio }}%</td>
                </tr>
              </tbody>
            </table>
          </template>
        </div>

        <!-- GAME -->
        <div class="amb-col">
          <div class="admin-sechead">
            <div class="admin-sechead-left">
              <h2>最多人玩</h2>
              <span class="admin-meta admin-tag">GAME</span>
            </div>
            <span class="admin-meta">{{ summary.month }}</span>
          </div>
          <div v-if="!summary.game.gameRanking.length" class="admin-empty">本月無小遊戲遊玩紀錄</div>
          <template v-else>
            <div class="amb-pie-wrap">
              <ClientOnly>
                <Pie :data="gamePieData" :options="gamePieOptions" />
                <template #fallback><div class="admin-empty">圖表載入中…</div></template>
              </ClientOnly>
            </div>
            <table class="admin-table amb-table">
              <thead>
                <tr>
                  <th>遊戲</th>
                  <th class="admin-num" style="text-align:right">人數</th>
                  <th class="admin-num" style="text-align:right">佔比</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(item, i) in summary.game.gameRanking" :key="item.key">
                  <td>
                    <span class="amb-color-dot" :style="{ background: PALETTE[i % PALETTE.length] }" />
                    {{ item.name }}
                  </td>
                  <td class="admin-num" style="text-align:right">{{ _fmt.players(item.players) }}</td>
                  <td class="admin-num" style="text-align:right">{{ item.ratio }}%</td>
                </tr>
              </tbody>
            </table>
          </template>
        </div>

      </div>

      <!-- dataNote -->
      <div class="amb-note admin-meta">
        ⓘ {{ summary.dataNote }}
      </div>

    </template>
  </AdminShell>
</template>

<style scoped lang="scss">
.amb-toolbar {
  margin-bottom: 32px;
}

.amb-split {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0 1px;
  background: var(--line);
  border: 1px solid var(--line);
  align-items: flex-start;

  @media (max-width: 1100px) {
    grid-template-columns: 1fr 1fr;
    gap: 1px;

    > :last-child {
      grid-column: 1 / -1;
    }
  }

  @media (max-width: 700px) {
    grid-template-columns: 1fr;

    > :last-child {
      grid-column: auto;
    }
  }
}

.amb-col {
  background: var(--paper);
  padding: 20px 18px 20px;
  min-width: 0;
}

.amb-pie-wrap {
  height: 260px;
  position: relative;
  margin-bottom: 16px;
}

.amb-table {
  width: 100%;
}

.amb-color-dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 2px;
  margin-right: 8px;
  vertical-align: middle;
  flex-shrink: 0;
}

.amb-note {
  margin-top: 24px;
  font-size: 11.5px;
  padding: 12px 0 0;
  border-top: 1px solid var(--line-soft);
}
</style>
