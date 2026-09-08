<script setup lang="ts">
/**
 * 權限設定：左方帳號列表、右方可將選中帳號設為 Admin／User。
 * 角色存於伺服器 in-memory 白名單，重啟回復種子預設。
 */
import { computed, onMounted, reactive, watch } from 'vue'
import { api, type AdminAccessUser, type UserRole } from '~/services/api'
import { useAdminAuth } from '~/composables/useAdminAuth'
import { useRoleDefs } from '~/composables/useRoleDefs'

type AsyncStatus = 'idle' | 'loading' | 'success' | 'error'

const props = defineProps<{
  /** 父層在新增會員後遞增，觸發重新載入列表 */
  reloadToken?: number
}>()

const { user: me } = useAdminAuth()
const { roles: roleDefs, fetch: fetchRoleDefs } = useRoleDefs()

const state = reactive({
  status: 'idle' as AsyncStatus,
  error: '',
  users: [] as AdminAccessUser[],
  selectedId: '' as string,
  saveStatus: 'idle' as AsyncStatus,
  saveError: '',
  searchQuery: '',
  filterRole: 'all' as 'all' | UserRole
})

const selected = computed(() => state.users.find((u) => u.id === state.selectedId) ?? null)
const adminCount = computed(() => state.users.filter((u) => u.role === 'admin').length)

const filteredUsers = computed(() => {
  const query = state.searchQuery.trim().toLowerCase()
  return state.users.filter((u) => {
    if (state.filterRole !== 'all' && u.role !== state.filterRole) return false
    if (!query) return true
    return u.name.toLowerCase().includes(query)
      || u.email.toLowerCase().includes(query)
      || u.id.toLowerCase().includes(query)
  })
})

const _handlers = {
  roleLabel: (role: UserRole) => roleDefs.value.find((r) => r.id === role)?.name ?? role,
  canSetRole: (row: AdminAccessUser, next: UserRole) => {
    if (row.role === next) return false
    if (next !== 'admin' && row.id === me.value?.id) return false
    if (next !== 'admin' && row.role === 'admin' && adminCount.value <= 1) return false
    return true
  }
}

const _actions = {
  fetch: async () => {
    if (state.status === 'loading') return
    state.status = 'loading'
    state.error = ''
    try {
      const [res] = await Promise.all([api.admin.roles(), fetchRoleDefs()])
      state.users = res.users
      if (!state.selectedId || !state.users.some((u) => u.id === state.selectedId)) {
        state.selectedId = state.users[0]?.id ?? ''
      }
      state.status = 'success'
    } catch (e: unknown) {
      state.error = (e as { message?: string })?.message ?? '載入失敗'
      state.status = 'error'
    }
  },
  setRole: async (role: UserRole) => {
    const row = selected.value
    if (!row || state.saveStatus === 'loading') return
    if (!_handlers.canSetRole(row, role)) {
      if (role !== 'admin' && row.id === me.value?.id) {
        state.saveError = '不可將自己降級，以免失去後台權限。'
      } else if (role !== 'admin' && adminCount.value <= 1) {
        state.saveError = '至少需保留一位 Admin。'
      } else {
        state.saveError = ''
      }
      state.saveStatus = 'error'
      return
    }
    state.saveStatus = 'loading'
    state.saveError = ''
    try {
      const res = await api.admin.setRole(row.id, role)
      const idx = state.users.findIndex((u) => u.id === res.user.id)
      if (idx >= 0) state.users[idx] = res.user
      state.saveStatus = 'success'
    } catch (e: unknown) {
      state.saveError = (e as { message?: string })?.message ?? '更新失敗'
      state.saveStatus = 'error'
    }
  }
}

const click = {
  select: (id: string) => {
    state.selectedId = id
    state.saveError = ''
    state.saveStatus = 'idle'
  },
  setRole: (role: UserRole) => _actions.setRole(role)
}

onMounted(() => {
  _actions.fetch()
})

watch(
  () => props.reloadToken,
  (token, prev) => {
    if (token !== undefined && token !== prev) _actions.fetch()
  }
)
</script>

<template>
  <div class="aap">
    <div v-if="state.status === 'loading'" class="admin-empty aap-empty">載入中...</div>
    <div v-else-if="state.status === 'error'" class="aap-error aap-empty">{{ state.error }}</div>
    <div v-else class="aap-grid">
      <div class="aap-list-wrap">
        <div class="aap-col-label admin-en">Accounts</div>
        <div class="aap-filters">
          <input v-model="state.searchQuery" type="text" class="admin-input aap-search" placeholder="搜尋姓名／Email／ID"
            autocomplete="off">
          <select v-model="state.filterRole" class="admin-input aap-role-filter">
            <option value="all">全部</option>
            <option v-for="r in roleDefs" :key="r.id" :value="r.id">{{ r.name }}</option>
          </select>
        </div>
        <ul v-if="filteredUsers.length" class="aap-list">
          <li
            v-for="row in filteredUsers"
            :key="row.id"
            class="aap-item"
            :class="{ 'is-active': row.id === state.selectedId }"
          >
            <button type="button" class="aap-item-btn" @click="click.select(row.id)">
              <span class="aap-item-name">{{ row.name }}</span>
              <span class="aap-item-meta">
                <span class="admin-num aap-item-id">{{ row.id }}</span>
                <span class="admin-tag" :class="{ 'is-user': row.role !== 'admin' }">
                  {{ _handlers.roleLabel(row.role) }}
                </span>
              </span>
            </button>
          </li>
        </ul>
        <div v-else class="admin-empty aap-list-empty">查無符合條件的會員</div>
      </div>

      <div class="aap-detail">
        <div class="aap-col-label admin-en">Role</div>
        <template v-if="selected">
          <div class="aap-detail-card">
            <div class="aap-detail-name">{{ selected.name }}</div>
            <div class="aap-detail-row">
              <span class="aap-detail-k">User ID</span>
              <span class="admin-num">{{ selected.id }}</span>
            </div>
            <div class="aap-detail-row">
              <span class="aap-detail-k">Email</span>
              <span>{{ selected.email }}</span>
            </div>
            <div class="aap-detail-row">
              <span class="aap-detail-k">目前</span>
              <span class="admin-tag" :class="{ 'is-user': selected.role !== 'admin' }">
                {{ _handlers.roleLabel(selected.role) }}
              </span>
            </div>

            <div class="aap-actions">
              <select
                class="admin-input aap-role-select"
                :value="selected.role"
                :disabled="state.saveStatus === 'loading'"
                @change="click.setRole(($event.target as HTMLSelectElement).value)"
              >
                <option
                  v-for="r in roleDefs"
                  :key="r.id"
                  :value="r.id"
                  :disabled="r.id !== selected.role && !_handlers.canSetRole(selected, r.id)"
                >
                  {{ r.name }}
                </option>
              </select>
            </div>
            <p v-if="state.saveError" class="aap-error">{{ state.saveError }}</p>
            <p v-else-if="state.saveStatus === 'success'" class="aap-ok">已更新</p>
            <p class="aap-hint">
              不可自我降權；至少保留一位 Admin。變更僅在伺服器運行期間有效，重啟後回復預設。
            </p>
          </div>
        </template>
        <div v-else class="admin-empty aap-empty">請從左側選擇帳號</div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.aap {
  height: 360px;
  min-height: 0;
  max-height: 360px;
  border: 1px solid var(--line);
  border-radius: 2px;
  background: var(--paper);
  overflow: hidden;
}

.aap-grid {
  display: grid;
  grid-template-columns: minmax(220px, 1fr) minmax(260px, 1fr);
  height: 100%;
  min-height: 0;

  @media (max-width: 800px) {
    grid-template-columns: 1fr;
  }
}

.aap-col-label {
  padding: 8px 12px 0;
  color: var(--muted);
}

.aap-list-wrap {
  border-right: 1px solid var(--line);
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  background: var(--wash);

  @media (max-width: 800px) {
    border-right: 0;
    border-bottom: 1px solid var(--line);
    max-height: 200px;
  }
}

.aap-filters {
  display: flex;
  flex-direction: row;
  gap: 6px;
  padding: 8px 8px 0;
  flex-shrink: 0;
}

.aap-search,
.aap-role-filter {
  height: 28px;
  font-size: 12px;
}

.aap-search {
  flex: 1;
  min-width: 0;
}

.aap-role-filter {
  flex-shrink: 0;
  width: 92px;
}

.aap-list {
  list-style: none;
  margin: 0;
  padding: 8px;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  scrollbar-gutter: stable;
}

.aap-list-empty {
  padding: 24px 12px;
}

.aap-item-btn {
  width: 100%;
  text-align: left;
  border: 1px solid transparent;
  background: transparent;
  padding: 10px 12px;
  border-radius: 2px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 6px;
  color: inherit;
  font-family: inherit;

  &:hover {
    background: var(--paper);
  }
}

.aap-item.is-active .aap-item-btn {
  background: var(--paper);
  border-color: var(--ink);
}

.aap-item-name {
  font-size: 13px;
  font-weight: 700;
}

.aap-item-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.aap-item-id {
  font-size: 11px;
  color: var(--muted);
}

.admin-tag.is-user {
  background: color-mix(in srgb, #1c1c22 8%, var(--paper));
  color: var(--muted);
}

.aap-detail {
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow-y: auto;
}

.aap-detail-card {
  padding: 12px 16px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex: 1;
  min-height: 0;
}

.aap-detail-name {
  font-size: 18px;
  font-weight: 700;
}

.aap-detail-row {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 12px;
}

.aap-detail-k {
  width: 64px;
  flex-shrink: 0;
  color: var(--muted);
}

.aap-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.aap-role-select {
  max-width: 200px;
}

.aap-error {
  margin: 0;
  color: #b91c1c;
  font-size: 11px;
}

.aap-ok {
  margin: 0;
  color: #15803d;
  font-size: 11px;
}

.aap-hint {
  margin: 4px 0 0;
  margin-top: auto;
  font-size: 11px;
  line-height: 1.55;
  color: color-mix(in srgb, #1c1c22 62%, #ffffff);
}

.aap-empty {
  padding: 32px 16px;
}
</style>
