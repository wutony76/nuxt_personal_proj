<script setup>
import { ref, reactive, watch, onMounted } from 'vue'
import dayjs from 'dayjs'
import { api } from '~/services/api'
import { useAdminAuth } from '~/composables/useAdminAuth'

const { isDemo } = useAdminAuth()

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
  gameTogglePending: {},
  editingSlug: null,
  draftMultiplier: '',
  draftDifficulty: '',
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
    const difficulty = Number(toyShop.draftDifficulty)
    if (!Number.isFinite(multiplier) || multiplier < 0) {
      toyShop.editError = '賠率必須是不小於 0 的數字。'
      return
    }
    if (!Number.isFinite(difficulty) || difficulty <= 0) {
      toyShop.editError = '難度必須是大於 0 的數字（預設 1）。'
      return
    }
    try {
      const updated = await api.admin.toyShop.setOdds(row.slug, { multiplier, difficulty })
      toyShop.odds = toyShop.odds.map((o) => (o.slug === row.slug ? updated : o))
      toyShop.editingSlug = null
      toyShop.draftMultiplier = ''
      toyShop.draftDifficulty = ''
      toyShop.editError = ''
    } catch (e) {
      const data = e?.data
      toyShop.editError = data?.message ?? '儲存失敗，請稍後再試。'
    }
  },
  toggleGame: async (row) => {
    if (toyShop.gameTogglePending[row.slug]) return
    toyShop.gameTogglePending[row.slug] = true
    try {
      const updated = await api.admin.toyShop.setGameEnabled(row.slug, !row.enabled)
      toyShop.odds = toyShop.odds.map((o) => (o.slug === row.slug ? updated : o))
    } catch (e) {
      const data = e?.data
      toyShop.error = data?.message ?? '切換失敗，請稍後再試。'
    } finally {
      toyShop.gameTogglePending[row.slug] = false
    }
  },
}

const click = {
  toggleShop: () => _actions.toggleShop(),
  startEditOdds: (row) => {
    toyShop.editingSlug = row.slug
    toyShop.draftMultiplier = String(row.multiplier)
    toyShop.draftDifficulty = String(row.difficulty)
    toyShop.editError = ''
  },
  cancelEditOdds: () => {
    toyShop.editingSlug = null
    toyShop.draftMultiplier = ''
    toyShop.draftDifficulty = ''
    toyShop.editError = ''
  },
  saveOdds: (row) => _actions.saveOdds(row),
  toggleGame: (row) => _actions.toggleGame(row),
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
          <div v-else-if="toyShop.status === 'error'" class="admin-empty" style="color:#b91c1c">{{ toyShop.error }}
          </div>
          <template v-else-if="toyShop.status === 'success'">
            <fieldset class="admin-fieldset-reset" :disabled="isDemo">
            <div class="atl-toyshop-toggle">
              <span class="atl-toyshop-status" :class="{ on: toyShop.enabled }">
                {{ toyShop.enabled ? '開放中' : '暫停中' }}
              </span>
              <button type="button" class="admin-btn admin-btn-primary" :disabled="toyShop.togglePending"
                @click="click.toggleShop()">
                {{ toyShop.togglePending ? '處理中…' : (toyShop.enabled ? '關閉柑仔店櫥仔' : '開啟柑仔店櫥仔') }}
              </button>
            </div>

            <div class="atl-odds-grid admin-grid1">
              <div v-for="row in toyShop.odds" :key="row.slug" class="atl-odds-card admin-panel"
                :class="{ 'atl-odds-card--on': row.enabled }">
                <div class="admin-en">{{ row.slug }}</div>
                <div class="atl-odds-name">{{ row.name }}</div>

                <div class="atl-odds-row">
                  <span class="admin-en atl-odds-label">狀態</span>
                  <span class="atl-odds-toggle-status" :class="{ on: row.enabled }">
                    {{ row.enabled ? '啟用中' : '已關閉' }}
                  </span>
                  <button type="button" class="admin-btn admin-btn-ghost atl-odds-toggle-btn"
                    :disabled="toyShop.gameTogglePending[row.slug]" @click="click.toggleGame(row)">
                    {{ row.enabled ? '點擊 [關閉]' : '點擊 [開啟]' }}
                  </button>
                </div>

                <div class="atl-odds-row">
                  <span class="admin-en atl-odds-label">賠率</span>
                  <div class="atl-odds-value">
                    <input v-if="toyShop.editingSlug === row.slug" v-model="toyShop.draftMultiplier"
                      class="admin-input admin-num atl-edit-input">
                    <span v-else class="admin-num atl-odds-num">{{ row.multiplier }}</span>
                    <span class="atl-odds-suffix">倍</span>
                  </div>
                </div>

                <div class="atl-odds-row">
                  <span class="admin-en atl-odds-label">難度</span>
                  <div class="atl-odds-value">
                    <input v-if="toyShop.editingSlug === row.slug" v-model="toyShop.draftDifficulty"
                      class="admin-input admin-num atl-edit-input">
                    <span v-else class="admin-num atl-odds-num">{{ row.difficulty }}</span>
                    <span class="atl-odds-suffix">倍（預設 1，越大越難贏）</span>
                  </div>
                </div>

                <div v-if="toyShop.editingSlug === row.slug && toyShop.editError" class="atl-odds-error">
                  {{ toyShop.editError }}
                </div>

                <div class="atl-odds-actions">
                  <template v-if="toyShop.editingSlug === row.slug">
                    <button type="button" class="admin-btn admin-btn-primary" @click="click.saveOdds(row)">儲存</button>
                    <button type="button" class="admin-btn admin-btn-ghost" @click="click.cancelEditOdds()">取消</button>
                  </template>
                  <button v-else type="button" class="admin-btn admin-btn-secondary"
                    @click="click.startEditOdds(row)">編輯</button>
                </div>
              </div>
            </div>
            </fieldset>
          </template>
        </div>
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

.atl-odds-grid {
  grid-template-columns: repeat(4, minmax(0, 1fr));
  width: 100%;
  gap: 10px;
  background: none;
  border: none;

  @media (max-width: 640px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.atl-odds-card {
  border: 1px solid var(--line);
  padding: 16px 16px 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  transition: border-color 0.15s;

  &--on {
    border-color: #16a34a;
  }
}

.atl-odds-name {
  font-size: 14px;
  font-weight: 600;
}

.atl-odds-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.atl-odds-label {
  flex: none;
  width: 62px;
}

.atl-odds-toggle-status {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  font-weight: 600;
  color: var(--muted);

  &::before {
    content: '';
    width: 6px;
    height: 6px;
    border-radius: 50%;
    border: 1px solid var(--muted);
    background: transparent;
  }

  &.on {
    color: #16a34a;

    &::before {
      border-color: #16a34a;
      background: #16a34a;
    }
  }
}

.atl-odds-toggle-btn {
  height: 24px;
  padding: 0 10px;
  font-size: 11px;
  margin-left: auto;
}

.atl-odds-value {
  display: flex;
  align-items: baseline;
  gap: 5px;
}

.atl-odds-num {
  font-size: 18px;
  font-weight: 700;
}

.atl-odds-suffix {
  font-size: 11px;
  color: var(--muted);
}

.atl-odds-error {
  font-size: 11px;
  color: #b91c1c;
}

.atl-odds-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.atl-edit-input {
  width: 70px;
  font-size: 18px;
  font-weight: 700;
}

.atl-total-row td {
  border-top: 1px solid var(--ink);
  padding-top: 9px;
  font-size: 13px;
}
</style>
