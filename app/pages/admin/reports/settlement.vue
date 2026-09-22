<script setup>
import { ref, watch, onMounted } from 'vue'
import dayjs from 'dayjs'
import { api } from '~/services/api'

// ─── State ───
const month = ref(dayjs().format('YYYY-MM'))
const status = ref('idle')
const error = ref('')
const summary = ref(null)

// ─── Formatters ───
const _fmt = {
  coin: (v) => `F${Number(v).toLocaleString('zh-TW')}`,
  orders: (v) => Number(v).toLocaleString('zh-TW'),
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
  <AdminShell active="reports" kicker="資料統計 / 月結算" title="結算 / 月" desc="依月份顯示 BG／台彩銷售收入、估算佣金與交易筆數摘要，並列比較。">
    <AdminReportsNav active="settlement" />

    <!-- 月份篩選器 -->
    <div class="ase-toolbar">
      <AdminMonthPicker v-model="month" />
    </div>

    <!-- Loading -->
    <div v-if="status === 'loading'" class="admin-empty">載入中…</div>

    <!-- Error -->
    <div v-else-if="status === 'error'" class="admin-empty" style="color:#b91c1c">{{ error }}</div>

    <!-- Success -->
    <template v-else-if="status === 'success' && summary">

      <!-- 月份標題 -->
      <div class="ase-month-title">
        <span class="admin-en">Settlement Period</span>
        <div class="ase-month-display admin-num">{{ summary.month.replace('-', ' / ') }} 結算</div>
      </div>

      <!-- 結算卡 並列：BG／台彩 -->
      <div class="ase-kpi-split">

        <!-- BG 結算卡 -->
        <div class="ase-kpi-block">
          <div class="ase-kpi-block-head">
            <span class="admin-en ase-source-tag">BG</span>
          </div>
          <div v-if="summary.totalSales === 0" class="admin-empty">本月無 BG 投注紀錄</div>
          <div v-else class="ase-cards admin-grid1">
            <div class="ase-card admin-panel">
              <div class="admin-en">Sales Revenue</div>
              <div class="ase-card-num admin-num">{{ _fmt.coin(summary.totalSales) }}</div>
              <div class="ase-card-label">銷售收入</div>
            </div>
            <div class="ase-card admin-panel">
              <div class="admin-en">Commission (est.)</div>
              <div class="ase-card-num admin-num">{{ _fmt.coin(summary.commission) }}</div>
              <div class="ase-card-label">
                估算佣金 (銷售額 × 7%，僅供參考)
                <!-- <span class="ase-card-note">銷售額 × 7%，僅供參考</span> -->
              </div>
            </div>
            <div class="ase-card admin-panel">
              <div class="admin-en">Transaction Count</div>
              <div class="ase-card-num admin-num">{{ _fmt.orders(summary.totalOrders) }}</div>
              <div class="ase-card-label">交易筆數</div>
            </div>
            <div class="ase-card admin-panel ase-card-info">
              <div class="admin-en">Prize Payout</div>
              <div class="ase-card-num ase-card-na">—</div>
              <div class="ase-card-label">
                兌獎支出
                <span class="ase-card-note">目前資料不支援月度兌獎彙整，詳見各彩票玩法頁的玩家紀錄</span>
              </div>
            </div>
            <div class="ase-card admin-panel">
              <div class="admin-en">NPC Sales Revenue</div>
              <div class="ase-card-num admin-num">{{ _fmt.coin(summary.npc.totalSales) }}</div>
              <div class="ase-card-label">其中 NPC 銷售收入</div>
            </div>
          </div>
        </div>

        <!-- 台彩結算卡 -->
        <div class="ase-kpi-block">
          <div class="ase-kpi-block-head">
            <span class="admin-en ase-source-tag">TW</span>
          </div>
          <div v-if="!summary.twTotal.totalSales" class="admin-empty">本月無台彩投注紀錄</div>
          <div v-else class="ase-cards admin-grid1">
            <div class="ase-card admin-panel">
              <div class="admin-en">Sales Revenue</div>
              <div class="ase-card-num admin-num">{{ _fmt.coin(summary.twTotal.totalSales) }}</div>
              <div class="ase-card-label">銷售收入</div>
            </div>
            <div class="ase-card admin-panel">
              <div class="admin-en">Transaction Count</div>
              <div class="ase-card-num admin-num">{{ _fmt.orders(summary.twTotal.totalOrders) }}</div>
              <div class="ase-card-label">交易筆數</div>
            </div>
            <div class="ase-card admin-panel ase-card-info">
              <div class="admin-en">Prize Payout</div>
              <div class="ase-card-num ase-card-na">—</div>
              <div class="ase-card-label">
                兌獎支出
                <span class="ase-card-note">目前資料不支援月度兌獎彙整，詳見各玩法頁的玩家紀錄</span>
              </div>
            </div>
          </div>
        </div>

      </div>

      <!-- dataNote -->
      <div class="ase-note admin-meta">
        ⓘ {{ summary.dataNote }}
      </div>

      <!-- 每日銷售明細 並列：BG／台彩 -->
      <div class="ase-detail-row">

        <div class="ase-detail-col">
          <div class="admin-sechead">
            <div class="admin-sechead-left">
              <h2>總投注額/日</h2>
              <span class="admin-meta admin-tag">BG</span>
            </div>
            <span class="admin-meta">{{ summary.month }}</span>
          </div>
          <div v-if="summary.totalSales === 0" class="admin-empty">本月無 BG 投注紀錄</div>
          <table v-else class="admin-table ase-table">
            <thead>
              <tr>
                <th>日期</th>
                <th class="admin-num" style="text-align:right">銷售額</th>
                <th class="admin-num" style="text-align:right">估算佣金</th>
              </tr>
            </thead>
            <tbody>
              <template v-for="item in summary.dailySales" :key="item.day">
                <tr v-if="item.sales > 0" class="ase-row-active">
                  <td class="admin-num">{{ item.day }}</td>
                  <td class="admin-num" style="text-align:right">{{ _fmt.coin(item.sales) }}</td>
                  <td class="admin-num ase-col-muted" style="text-align:right">{{ _fmt.coin(Math.round(item.sales *
                    0.07)) }}</td>
                </tr>
                <tr v-else class="ase-row-empty">
                  <td class="admin-num ase-col-muted">{{ item.day }}</td>
                  <td class="ase-col-muted" style="text-align:right">—</td>
                  <td class="ase-col-muted" style="text-align:right">—</td>
                </tr>
              </template>
            </tbody>
            <tfoot>
              <tr class="ase-total-row">
                <td><strong>合計</strong></td>
                <td class="admin-num" style="text-align:right"><strong>{{ _fmt.coin(summary.totalSales) }}</strong>
                </td>
                <td class="admin-num ase-col-muted" style="text-align:right">{{ _fmt.coin(summary.commission) }}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div class="ase-detail-col">
          <div class="admin-sechead">
            <div class="admin-sechead-left">
              <h2>總投注額/日</h2>
              <span class="admin-meta admin-tag">TW</span>
            </div>
            <span class="admin-meta">{{ summary.month }}</span>
          </div>
          <div v-if="!summary.twTotal.totalSales" class="admin-empty">本月無台彩投注紀錄</div>
          <table v-else class="admin-table ase-table">
            <thead>
              <tr>
                <th>日期</th>
                <th class="admin-num" style="text-align:right">下注額</th>
              </tr>
            </thead>
            <tbody>
              <template v-for="item in summary.twTotal.dailySales" :key="item.day">
                <tr v-if="item.sales > 0" class="ase-row-active">
                  <td class="admin-num">{{ item.day }}</td>
                  <td class="admin-num" style="text-align:right">{{ _fmt.coin(item.sales) }}</td>
                </tr>
                <tr v-else class="ase-row-empty">
                  <td class="admin-num ase-col-muted">{{ item.day }}</td>
                  <td class="ase-col-muted" style="text-align:right">—</td>
                </tr>
              </template>
            </tbody>
            <tfoot>
              <tr class="ase-total-row">
                <td><strong>合計</strong></td>
                <td class="admin-num" style="text-align:right"><strong>{{ _fmt.coin(summary.twTotal.totalSales)
                }}</strong>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

      </div>

      <!-- 彩種明細 並列：BG／台彩 -->
      <div class="ase-detail-row">

        <div class="ase-detail-col">
          <div class="admin-sechead">
            <div class="admin-sechead-left">
              <h2>明細</h2>
              <span class="admin-meta admin-tag">BG</span>
            </div>
            <span class="admin-meta">{{ summary.month }}</span>
          </div>
          <div v-if="!summary.gameRanking.length" class="admin-empty">目前月份沒有彩種銷售資料</div>
          <table v-else class="admin-table ase-table">
            <thead>
              <tr>
                <th>彩種</th>
                <th class="admin-num" style="text-align:right">銷售額</th>
                <th class="admin-num" style="text-align:right">注數</th>
                <th class="admin-num" style="text-align:right">佔比</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in summary.gameRanking" :key="item.key">
                <td>
                  <span class="ase-key-tag">{{ item.key }}</span>
                  {{ item.name }}
                </td>
                <td class="admin-num" style="text-align:right">{{ _fmt.coin(item.sales) }}</td>
                <td class="admin-num" style="text-align:right">{{ item.orders.toLocaleString('zh-TW') }}</td>
                <td class="admin-num ase-col-muted" style="text-align:right">{{ item.ratio }}%</td>
              </tr>
            </tbody>
            <tfoot>
              <tr class="ase-total-row">
                <td><strong>合計</strong></td>
                <td class="admin-num" style="text-align:right"><strong>{{ _fmt.coin(summary.totalSales) }}</strong>
                </td>
                <td class="admin-num" style="text-align:right">{{ _fmt.orders(summary.totalOrders) }}</td>
                <td class="admin-num ase-col-muted" style="text-align:right">100%</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div class="ase-detail-col">
          <div class="admin-sechead">
            <div class="admin-sechead-left">
              <h2>明細</h2>
              <span class="admin-meta admin-tag">TW</span>
            </div>
            <span class="admin-meta">{{ summary.month }}</span>
          </div>
          <div v-if="!summary.twTotal.totalSales" class="admin-empty">本月無台彩投注紀錄</div>
          <table v-else class="admin-table ase-table">
            <thead>
              <tr>
                <th>彩種</th>
                <th class="admin-num" style="text-align:right">銷售額</th>
                <th class="admin-num" style="text-align:right">注數</th>
                <th class="admin-num" style="text-align:right">佔比</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in summary.twTotal.gameRanking" :key="item.key">
                <td>
                  <span class="ase-key-tag">{{ item.key }}</span>
                  {{ item.name }}
                </td>
                <td class="admin-num" style="text-align:right">{{ _fmt.coin(item.sales) }}</td>
                <td class="admin-num" style="text-align:right">{{ item.orders.toLocaleString('zh-TW') }}</td>
                <td class="admin-num ase-col-muted" style="text-align:right">{{ item.ratio }}%</td>
              </tr>
            </tbody>
            <tfoot>
              <tr class="ase-total-row">
                <td><strong>合計</strong></td>
                <td class="admin-num" style="text-align:right"><strong>{{ _fmt.coin(summary.twTotal.totalSales)
                }}</strong>
                </td>
                <td class="admin-num" style="text-align:right">{{ _fmt.orders(summary.twTotal.totalOrders) }}</td>
                <td class="admin-num ase-col-muted" style="text-align:right">100%</td>
              </tr>
            </tfoot>
          </table>
        </div>

      </div>

    </template>
  </AdminShell>
</template>

<style scoped lang="scss">
.ase-toolbar {
  margin-bottom: 32px;
}

.ase-month-title {
  margin-bottom: 28px;
}

.ase-month-display {
  font-size: 28px;
  font-weight: 700;
  margin-top: 6px;
}

// ── 結算卡並列：BG／台彩 ──────────────────────────────────────────────
.ase-kpi-split {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0 1px;
  background: var(--line);
  border: 1px solid var(--line);
  margin-bottom: 24px;

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
    gap: 1px 0;
  }
}

.ase-kpi-block {
  background: var(--paper);
  padding: 20px 20px 16px;
  min-width: 0;
}

.ase-kpi-block-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
}

.ase-source-tag {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.1em;
  background: var(--ink);
  color: var(--paper);
  padding: 2px 6px;
  border-radius: 2px;
}

.ase-cards {
  grid-template-columns: repeat(2, 1fr);

  @media (max-width: 520px) {
    grid-template-columns: 1fr;
  }
}

.ase-card {
  padding: 20px 18px 16px;
}

.ase-card-info {
  background: var(--wash);
}

.ase-card-num {
  font-size: 28px;
  font-weight: 700;
  margin: 8px 0 6px;
  letter-spacing: -0.03em;
}

.ase-card-na {
  font-size: 28px;
  font-weight: 700;
  margin: 8px 0 6px;
  color: var(--muted);
}

.ase-card-label {
  font-size: 12px;
  color: var(--muted);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.ase-card-note {
  font-size: 10.5px;
  color: color-mix(in srgb, #1c1c22 38%, #ffffff);
  line-height: 1.5;
}

.ase-note {
  margin-top: 8px;
  font-size: 11.5px;
  padding: 12px 0 0;
  border-top: 1px solid var(--line-soft);
}

.ase-detail-row {
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

.ase-detail-col {
  background: var(--paper);
  padding: 24px 20px 20px;
  min-width: 0;
}

.ase-section {
  margin-top: 44px;
}

.ase-table {
  max-width: 700px;
}

.ase-col-muted {
  color: var(--muted);
}

.ase-row-empty {
  opacity: 0.4;
}

.ase-row-active td {
  font-weight: 500;
}

.ase-total-row {
  td {
    border-top: 1px solid var(--ink);
    padding-top: 9px;
    font-size: 13px;
  }
}

.ase-key-tag {
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
</style>
