<script setup>
import { ref, reactive, watch, onMounted } from 'vue'
import dayjs from 'dayjs'
import { api } from '~/services/api'

// ─── State ───
const month = ref(dayjs().format('YYYY-MM'))
const status = ref('idle')
const error = ref('')
const summary = ref(null)

// ─── 柑仔店櫥仔設定 State ───
const toyShop = reactive({
  status: 'idle',
  error: '',
  enabled: true,
  odds: [],
  togglePending: false,
  editingSlug: null,
  draftMultiplier: '',
  editError: '',
})

// ─── Formatters ───
const _fmt = {
  coin: (v) => Number(v).toLocaleString('zh-TW'),
}

// ─── Actions ───
const _actions = {
  fetch: async () => {
    if (status.value === 'loading') return
    status.value = 'loading'
    error.value = ''
    summary.value = null
    try {
      summary.value = await api.admin.reports.twLotteryPayout(month.value)
      status.value = 'success'
    } catch (e) {
      error.value = e?.message ?? '載入失敗'
      status.value = 'error'
    }
  },
  loadToyShop: async () => {
    toyShop.status = 'loading'
    toyShop.error = ''
    try {
      const result = await api.admin.toyShop.settings()
      toyShop.enabled = result.enabled
      toyShop.odds = result.odds
      toyShop.status = 'success'
    } catch (e) {
      toyShop.error = e?.message ?? '載入失敗'
      toyShop.status = 'error'
    }
  },
  toggleShop: async () => {
    if (toyShop.togglePending) return
    toyShop.togglePending = true
    const next = !toyShop.enabled
    try {
      const result = await api.admin.toyShop.setEnabled(next)
      toyShop.enabled = result.enabled
    } catch (e) {
      const data = e?.data
      toyShop.error = data?.message ?? '切換失敗，請稍後再試。'
    } finally {
      toyShop.togglePending = false
    }
  },
  saveOdds: async (row) => {
    const multiplier = Number(toyShop.draftMultiplier)
    if (!Number.isFinite(multiplier) || multiplier < 0) {
      toyShop.editError = '賠率必須是不小於 0 的數字。'
      return
    }
    try {
      const updated = await api.admin.toyShop.setOdds(row.slug, multiplier)
      toyShop.odds = toyShop.odds.map((o) => (o.slug === row.slug ? updated : o))
      toyShop.editingSlug = null
      toyShop.draftMultiplier = ''
      toyShop.editError = ''
    } catch (e) {
      const data = e?.data
      toyShop.editError = data?.message ?? '儲存失敗，請稍後再試。'
    }
  },
}

const click = {
  toggleShop: () => _actions.toggleShop(),
  startEditOdds: (row) => {
    toyShop.editingSlug = row.slug
    toyShop.draftMultiplier = String(row.multiplier)
    toyShop.editError = ''
  },
  cancelEditOdds: () => {
    toyShop.editingSlug = null
    toyShop.draftMultiplier = ''
    toyShop.editError = ''
  },
  saveOdds: (row) => _actions.saveOdds(row),
}

watch(month, () => _actions.fetch())
onMounted(() => {
  _actions.fetch()
  _actions.loadToyShop()
})
</script>

<template>
  <AdminShell active="gamemgmt" kicker="Taiwan Lottery" title="彩運來" desc="台彩鏡射玩法中獎派彩狀況，依玩法拆分金額與筆數。">
    <div class="atl-layout">
      <AdminGameNav active="taiwan" />
      <div class="atl-content">

        <!-- 柑仔店櫥仔設定 -->
        <div class="atl-section">
          <div class="admin-sechead">
            <h2>柑仔店櫥仔設定</h2>
          </div>

          <div v-if="toyShop.status === 'loading'" class="admin-empty">載入中…</div>
          <div v-else-if="toyShop.status === 'error'" class="admin-empty" style="color:#b91c1c">{{ toyShop.error }}</div>
          <template v-else-if="toyShop.status === 'success'">
            <div class="atl-toyshop-toggle">
              <span class="atl-toyshop-status" :class="{ on: toyShop.enabled }">
                {{ toyShop.enabled ? '開放中' : '暫停中' }}
              </span>
              <button type="button" class="admin-btn admin-btn-primary" :disabled="toyShop.togglePending"
                @click="click.toggleShop()">
                {{ toyShop.togglePending ? '處理中…' : (toyShop.enabled ? '關閉柑仔店櫥仔' : '開啟柑仔店櫥仔') }}
              </button>
            </div>

            <table class="admin-table atl-table atl-table--odds">
              <thead>
                <tr>
                  <th>玩法</th>
                  <th class="admin-num" style="text-align:right">賠率倍數</th>
                  <th style="width:26%;text-align:right">動作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in toyShop.odds" :key="row.slug">
                  <td>{{ row.name }}</td>
                  <td class="admin-num" style="text-align:right">
                    <input v-if="toyShop.editingSlug === row.slug" v-model="toyShop.draftMultiplier"
                      class="admin-input admin-num atl-edit-input">
                    <span v-else class="admin-num">{{ row.multiplier }}</span>
                  </td>
                  <td style="text-align:right">
                    <template v-if="toyShop.editingSlug === row.slug">
                      <button type="button" class="admin-btn admin-btn-primary" @click="click.saveOdds(row)">儲存</button>
                      <button type="button" class="admin-btn" @click="click.cancelEditOdds()">取消</button>
                    </template>
                    <button v-else type="button" class="admin-btn" @click="click.startEditOdds(row)">編輯</button>
                  </td>
                </tr>
              </tbody>
            </table>
            <div v-if="toyShop.editError" class="admin-empty" style="color:#b91c1c;padding:8px 0">{{ toyShop.editError }}</div>
          </template>
        </div>

        <!-- 月份篩選器 -->
        <div class="atl-toolbar">
          <AdminMonthPicker v-model="month" />
        </div>

        <!-- Loading -->
        <div v-if="status === 'loading'" class="admin-empty">載入中…</div>

        <!-- Error -->
        <div v-else-if="status === 'error'" class="admin-empty" style="color:#b91c1c">{{ error }}</div>

        <!-- Success -->
        <template v-else-if="status === 'success' && summary">

          <div v-if="!summary.totalPayout" class="admin-empty">
            目前月份無中獎派彩紀錄，請先進行台彩鏡射玩法下注。
          </div>

          <template v-else>

            <!-- KPI 卡片 -->
            <div class="atl-kpi-grid admin-grid1">
              <div class="atl-kpi admin-panel">
                <div class="admin-en">Prize Payout</div>
                <div class="atl-kpi-num admin-num">{{ _fmt.coin(summary.totalPayout) }}</div>
                <div class="atl-kpi-label">中獎金額</div>
              </div>
              <div class="atl-kpi admin-panel">
                <div class="admin-en">Winning Bets</div>
                <div class="atl-kpi-num admin-num">{{ summary.totalCount.toLocaleString('zh-TW') }}</div>
                <div class="atl-kpi-label">中獎筆數</div>
              </div>
            </div>

            <!-- 各玩法明細表格 -->
            <div class="atl-section">
              <div class="admin-sechead">
                <h2>玩法明細</h2>
                <span class="admin-meta">{{ summary.month }}</span>
              </div>
              <table class="admin-table atl-table">
                <thead>
                  <tr>
                    <th>玩法</th>
                    <th class="admin-num" style="text-align:right">中獎金額</th>
                    <th class="admin-num" style="text-align:right">中獎筆數</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="item in summary.perGame" :key="item.key">
                    <td>{{ item.name }}</td>
                    <td class="admin-num" style="text-align:right">{{ item.amount.toLocaleString('zh-TW') }}</td>
                    <td class="admin-num" style="text-align:right">{{ item.count.toLocaleString('zh-TW') }}</td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr class="atl-total-row">
                    <td><strong>合計</strong></td>
                    <td class="admin-num" style="text-align:right"><strong>{{ summary.totalPayout.toLocaleString('zh-TW')
                        }}</strong></td>
                    <td class="admin-num" style="text-align:right"><strong>{{ summary.totalCount.toLocaleString('zh-TW')
                        }}</strong></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <!-- 中獎明細（含期別） -->
            <div class="atl-section">
              <div class="admin-sechead">
                <h2>中獎明細</h2>
                <span class="admin-meta">{{ summary.month }}</span>
              </div>
              <table class="admin-table atl-table atl-table--records">
                <thead>
                  <tr>
                    <th>時間</th>
                    <th>玩法</th>
                    <th>期別</th>
                    <th class="admin-num" style="text-align:right">中獎金額</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in summary.records" :key="`${row.key}-${row.issue}-${row.time}`">
                    <td class="admin-num">{{ row.timeStr }}</td>
                    <td>{{ row.name }}</td>
                    <td class="admin-num">{{ row.issue }}</td>
                    <td class="admin-num" style="text-align:right">{{ row.amount.toLocaleString('zh-TW') }}</td>
                  </tr>
                </tbody>
              </table>
            </div>

          </template>
        </template>

      </div>
    </div>
  </AdminShell>
</template>

<style scoped lang="scss">
.atl-layout {
  display: flex;
  flex-direction: column;
}

.atl-content {
  flex: 1;
  min-width: 0;
}

.atl-toolbar {
  margin-bottom: 32px;
}

.atl-kpi-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  max-width: 480px;
  margin-bottom: 40px;
}

.atl-kpi {
  padding: 20px 18px 16px;
}

.atl-kpi-num {
  font-size: 24px;
  font-weight: 700;
  margin: 8px 0 5px;
  letter-spacing: -0.03em;
}

.atl-kpi-label {
  font-size: 12px;
  color: var(--muted);
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.atl-section {
  margin-bottom: 44px;
}

.atl-table {
  max-width: 680px;

  &--records {
    max-width: 780px;
  }

  &--odds {
    max-width: 560px;
  }
}

.atl-toyshop-toggle {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 20px;
}

.atl-toyshop-status {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--muted);

  &.on {
    color: var(--ink);
  }
}

.atl-edit-input {
  width: 90px;
  text-align: right;
}

.atl-total-row td {
  border-top: 1px solid var(--ink);
  padding-top: 9px;
  font-size: 13px;
}
</style>
