<script setup lang="ts">
/**
 * 6hc-cd 跨分頁單期總上限設定：全站預設值 + 逐會員覆寫列表，見
 * openspec/changes/add-6hccd-quota-admin-ui/design.md 第 2 節。
 */
import { computed, onMounted, reactive } from 'vue'
import { api, type AdminAccessUser, type SixhccdQuotaMemberOverride } from '~/services/api'

type AsyncStatus = 'idle' | 'loading' | 'success' | 'error'

defineProps<{
  isDemo: boolean
}>()

const state = reactive({
  status: 'idle' as AsyncStatus,
  error: '',
  globalMax: 0,
  globalDraft: '0',
  globalSaveStatus: 'idle' as AsyncStatus,
  globalSaveError: '',
  overrides: [] as SixhccdQuotaMemberOverride[],
  members: [] as AdminAccessUser[],
  searchQuery: '',
  /** 正在編輯覆寫值的會員 id -> 輸入框草稿 */
  overrideDrafts: {} as Record<string, string>,
  /** 正在送出覆寫（設定或清除）的會員 id，避免重複點擊 */
  savingMemberId: '',
  memberError: ''
})

const overrideOf = computed(() => {
  const map = new Map<string, number>()
  for (const row of state.overrides) map.set(row.userId, row.crossTabIssueMax)
  return map
})

const filteredMembers = computed(() => {
  const query = state.searchQuery.trim().toLowerCase()
  if (!query) return state.members
  return state.members.filter((m) =>
    m.name.toLowerCase().includes(query)
    || m.email.toLowerCase().includes(query)
    || m.id.toLowerCase().includes(query)
  )
})

const _handlers = {
  effectiveMaxOf: (userId: string): number => overrideOf.value.get(userId) ?? state.globalMax,
  draftOf: (userId: string): string => state.overrideDrafts[userId] ?? String(_handlers.effectiveMaxOf(userId))
}

const _actions = {
  fetch: async () => {
    if (state.status === 'loading') return
    state.status = 'loading'
    state.error = ''
    try {
      const [quota, roles] = await Promise.all([api.admin.bgLottery.sixhccdQuota(), api.admin.roles()])
      state.globalMax = quota.globalCrossTabIssueMax
      state.globalDraft = String(quota.globalCrossTabIssueMax)
      state.overrides = quota.memberOverrides
      state.members = roles.users
      state.status = 'success'
    } catch (e: unknown) {
      state.error = (e as { message?: string })?.message ?? '載入失敗'
      state.status = 'error'
    }
  },
  saveGlobal: async () => {
    if (state.globalSaveStatus === 'loading') return
    const value = Number(state.globalDraft)
    if (!Number.isFinite(value) || value < 0) {
      state.globalSaveError = '上限必須是不小於 0 的數字（0 = 不限）。'
      state.globalSaveStatus = 'error'
      return
    }
    state.globalSaveStatus = 'loading'
    state.globalSaveError = ''
    try {
      const res = await api.admin.bgLottery.setSixhccdQuota(value)
      state.globalMax = res.crossTabIssueMax
      state.globalDraft = String(res.crossTabIssueMax)
      state.globalSaveStatus = 'success'
    } catch (e: unknown) {
      state.globalSaveError = (e as { data?: { message?: string }; message?: string })?.data?.message
        ?? (e as { message?: string })?.message
        ?? '儲存失敗'
      state.globalSaveStatus = 'error'
    }
  },
  applyMemberOverride: async (userId: string) => {
    if (state.savingMemberId) return
    const value = Number(_handlers.draftOf(userId))
    if (!Number.isFinite(value) || value < 0) {
      state.memberError = '上限必須是不小於 0 的數字（0 = 不限）。'
      return
    }
    state.savingMemberId = userId
    state.memberError = ''
    try {
      await api.admin.bgLottery.setSixhccdMemberQuota(userId, value)
      const idx = state.overrides.findIndex((o) => o.userId === userId)
      if (idx >= 0) state.overrides[idx] = { userId, crossTabIssueMax: value }
      else state.overrides.push({ userId, crossTabIssueMax: value })
      delete state.overrideDrafts[userId]
    } catch (e: unknown) {
      state.memberError = (e as { data?: { message?: string }; message?: string })?.data?.message
        ?? (e as { message?: string })?.message
        ?? '設定失敗'
    } finally {
      state.savingMemberId = ''
    }
  },
  clearMemberOverride: async (userId: string) => {
    if (state.savingMemberId) return
    state.savingMemberId = userId
    state.memberError = ''
    try {
      await api.admin.bgLottery.setSixhccdMemberQuota(userId, null)
      state.overrides = state.overrides.filter((o) => o.userId !== userId)
      delete state.overrideDrafts[userId]
    } catch (e: unknown) {
      state.memberError = (e as { data?: { message?: string }; message?: string })?.data?.message
        ?? (e as { message?: string })?.message
        ?? '清除失敗'
    } finally {
      state.savingMemberId = ''
    }
  }
}

const click = {
  saveGlobal: () => _actions.saveGlobal(),
  draftInput: (userId: string, value: string) => { state.overrideDrafts[userId] = value },
  applyOverride: (userId: string) => _actions.applyMemberOverride(userId),
  clearOverride: (userId: string) => _actions.clearMemberOverride(userId)
}

onMounted(() => _actions.fetch())
</script>

<template>
  <div class="sqp">
    <div v-if="state.status === 'error'" class="admin-empty" style="color:#b91c1c">{{ state.error }}</div>
    <div v-else-if="state.status === 'loading'" class="admin-empty">載入中…</div>

    <template v-else-if="state.status === 'success'">
      <section class="sqp-global admin-panel">
        <div class="sqp-global-head">
          <div class="admin-en">Cross-tab issue max</div>
          <h3>全站預設：跨分頁單期總上限</h3>
        </div>
        <p class="sqp-hint">同一玩家在同一期內，所有分頁合計下注額超過此上限即拒單。設為 0 代表不限。</p>
        <fieldset class="admin-fieldset-reset" :disabled="isDemo" :title="isDemo ? '唯讀模式，只有查看權限' : undefined">
          <div class="sqp-global-row">
            <input v-model="state.globalDraft" type="number" min="0" step="1" class="admin-input sqp-global-input">
            <button type="button" class="admin-btn admin-btn-primary" :disabled="state.globalSaveStatus === 'loading'"
              @click="click.saveGlobal">
              {{ state.globalSaveStatus === 'loading' ? '儲存中…' : '儲存' }}
            </button>
          </div>
        </fieldset>
        <p v-if="state.globalSaveStatus === 'error' && state.globalSaveError" class="sqp-error">{{ state.globalSaveError }}</p>
        <p v-else-if="state.globalSaveStatus === 'success'" class="sqp-ok">已更新，目前全站預設為 {{ state.globalMax }}</p>
      </section>

      <section class="sqp-members">
        <div class="sqp-members-head">
          <div class="admin-en">Member overrides</div>
          <h3>玩家個別覆寫</h3>
          <span class="admin-meta">共 {{ state.overrides.length }} 位有覆寫</span>
        </div>
        <input v-model="state.searchQuery" type="text" class="admin-input sqp-search" placeholder="搜尋姓名／Email／ID"
          autocomplete="off">
        <p v-if="state.memberError" class="sqp-error">{{ state.memberError }}</p>

        <div v-if="filteredMembers.length === 0" class="admin-empty">查無符合條件的會員</div>
        <table v-else class="admin-table sqp-table">
          <thead>
            <tr>
              <th>會員</th>
              <th>角色</th>
              <th class="admin-num" style="text-align:right">目前生效上限</th>
              <th style="min-width:220px">設定覆寫值</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="m in filteredMembers" :key="m.id">
              <td>
                <div class="sqp-member-name">{{ m.name }}</div>
                <div class="admin-num sqp-member-id">{{ m.id }}</div>
              </td>
              <td>
                <span class="admin-tag" :class="{ 'is-user': m.role !== 'admin' }">{{ m.role }}</span>
              </td>
              <td class="admin-num" style="text-align:right">
                {{ overrideOf.has(m.id) ? overrideOf.get(m.id) : `${state.globalMax}（預設）` }}
              </td>
              <td>
                <fieldset class="admin-fieldset-reset" :disabled="isDemo"
                  :title="isDemo ? '唯讀模式，只有查看權限' : undefined">
                  <div class="sqp-override-row">
                    <input type="number" min="0" step="1" class="admin-input sqp-override-input"
                      :value="_handlers.draftOf(m.id)" @input="click.draftInput(m.id, ($event.target as HTMLInputElement).value)">
                    <button type="button" class="admin-btn" :disabled="state.savingMemberId === m.id"
                      @click="click.applyOverride(m.id)">
                      {{ state.savingMemberId === m.id ? '處理中…' : '套用覆寫' }}
                    </button>
                    <button v-if="overrideOf.has(m.id)" type="button" class="admin-btn admin-btn-ghost"
                      :disabled="state.savingMemberId === m.id" @click="click.clearOverride(m.id)">
                      清除覆寫
                    </button>
                  </div>
                </fieldset>
              </td>
            </tr>
          </tbody>
        </table>
      </section>
    </template>
  </div>
</template>

<style scoped lang="scss">
.sqp {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.sqp-global {
  padding: 18px 20px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sqp-global-head h3 {
  margin: 4px 0 0;
  font-size: 16px;
}

.sqp-hint {
  margin: 0;
  font-size: 12px;
  color: var(--muted);
  line-height: 1.55;
}

.sqp-global-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 4px;
}

.sqp-global-input {
  width: 160px;
}

.sqp-members-head {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 10px;

  h3 {
    margin: 0;
    font-size: 16px;
  }
}

.sqp-search {
  width: 100%;
  max-width: 320px;
  margin-bottom: 12px;
}

.sqp-table {
  width: 100%;
}

.sqp-member-name {
  font-weight: 700;
}

.sqp-member-id {
  font-size: 11px;
  color: var(--muted);
}

.sqp-override-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.sqp-override-input {
  width: 110px;
}

.sqp-error {
  margin: 0;
  color: #b91c1c;
  font-size: 11px;
}

.sqp-ok {
  margin: 0;
  color: #15803d;
  font-size: 11px;
}
</style>
