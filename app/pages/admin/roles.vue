<script setup lang="ts">
/**
 * 「管理員」區塊：單一表格顯示全部會員對應的角色（比照原「管理員白名單」表格樣式），
 * 角色欄改成可切換的下拉，不用像 AdminAccessPanel 那樣先選會員才看到詳情。
 */
import { computed, onMounted, reactive } from 'vue'
import { api, type AdminAccessUser, type UserRole } from '~/services/api'
import { useAdminAuth } from '~/composables/useAdminAuth'
import { useRoleDefs } from '~/composables/useRoleDefs'

type AsyncStatus = 'idle' | 'loading' | 'success' | 'error'

const AUTH_STEPS = [
  { no: '01', title: 'sessionController.require', desc: '先驗證有沒有登入，未登入拋 40001。' },
  { no: '02', title: 'ADMIN_USER_IDS', desc: '檢查登入身份的 id 是否在白名單常數內。' },
  { no: '03', title: 'throw 40003', desc: '不在白名單則比照既有 error code 慣例回 403。' },
  { no: '04', title: 'GET /api/admin/me', desc: '各子頁自行二次確認，不倚賴前端路由守衛。' }
]

const { user: me } = useAdminAuth()
const { roles: roleDefs, fetch: fetchRoleDefs } = useRoleDefs()

const state = reactive({
  status: 'idle' as AsyncStatus,
  error: '',
  users: [] as AdminAccessUser[],
  savingId: '' as string,
  saveError: '',
  filterRole: 'admin' as 'all' | UserRole
})

const adminCount = computed(() => state.users.filter((u) => u.role === 'admin').length)

const filteredUsers = computed(() => {
  if (state.filterRole === 'all') return state.users
  return state.users.filter((u) => u.role === state.filterRole)
})

const _handlers = {
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
      state.status = 'success'
    } catch (e: unknown) {
      state.error = (e as { message?: string })?.message ?? '載入失敗'
      state.status = 'error'
    }
  },
  setRole: async (row: AdminAccessUser, role: UserRole) => {
    if (state.savingId) return
    if (!_handlers.canSetRole(row, role)) {
      if (role !== 'admin' && row.id === me.value?.id) {
        state.saveError = '不可將自己降級，以免失去後台權限。'
      } else if (role !== 'admin' && adminCount.value <= 1) {
        state.saveError = '至少需保留一位 Admin。'
      } else {
        state.saveError = ''
      }
      return
    }
    state.savingId = row.id
    state.saveError = ''
    try {
      const res = await api.admin.setRole(row.id, role)
      const idx = state.users.findIndex((u) => u.id === res.user.id)
      if (idx >= 0) state.users[idx] = res.user
    } catch (e: unknown) {
      state.saveError = (e as { message?: string })?.message ?? '更新失敗'
    } finally {
      state.savingId = ''
    }
  }
}

const click = {
  setRole: (row: AdminAccessUser, event: Event) => {
    _actions.setRole(row, (event.target as HTMLSelectElement).value)
  },
  filterRole: (event: Event) => {
    state.filterRole = (event.target as HTMLSelectElement).value as 'all' | UserRole
  }
}

onMounted(() => {
  _actions.fetch()
})
</script>

<template>
  <AdminShell active="roles" kicker="Roles" title="角色權限"
    desc="會員角色可在 Admin／User／NPC 間切換，角色本身亦可自訂新增。白名單與角色清單皆存於伺服器記憶體，重啟後回復預設。">
    <template #page-aside>
      <AdminRolesPageNav />
    </template>

    <div class="ar-sections">
      <section id="ar-members">
        <div class="admin-sechead">
          <div class="admin-sechead-left"><span class="admin-en">List</span>
            <h2> 使用者列表</h2>
          </div>
          <div class="ar-members-actions">
            <span class="admin-meta">查詢 / 設定 會員對應的角色</span>
            <select class="admin-input ar-filter-select" :value="state.filterRole" @change="click.filterRole">
              <option value="all">全部</option>
              <option v-for="r in roleDefs" :key="r.id" :value="r.id">{{ r.name }}</option>
            </select>
          </div>
        </div>
        <div v-if="state.status === 'loading'" class="admin-empty">載入中...</div>
        <div v-else-if="state.status === 'error'" class="admin-empty">{{ state.error }}</div>
        <template v-else>
          <div class="ar-table-wrap">
            <table class="admin-table">
              <thead>
                <tr>
                  <th style="width:20%">User ID</th>
                  <th style="width:16%">名稱</th>
                  <th>Email</th>
                  <th style="width:160px; text-align:right">角色</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="!filteredUsers.length">
                  <td colspan="4" class="admin-empty">此角色目前沒有會員</td>
                </tr>
                <tr v-for="row in filteredUsers" :key="row.id">
                  <td class="admin-num">{{ row.id }}</td>
                  <td>{{ row.name }}</td>
                  <td style="color:color-mix(in srgb, #1c1c22 72%, #ffffff)">{{ row.email }}</td>
                  <td style="text-align:right">
                    <select class="admin-input ar-role-select" :value="row.role" :disabled="state.savingId === row.id"
                      @change="click.setRole(row, $event)">
                      <option v-for="r in roleDefs" :key="r.id" :value="r.id"
                        :disabled="r.id !== row.role && !_handlers.canSetRole(row, r.id)">
                        {{ r.name }}
                      </option>
                    </select>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p v-if="state.saveError" class="ar-error">{{ state.saveError }}</p>
        </template>
      </section>

      <section id="ar-roles">
        <div class="admin-sechead">
          <div class="admin-sechead-left"><span class="admin-en">Role types</span>
            <h2>角色列表</h2>
          </div>
          <span class="admin-meta">HFYY角色設定</span>
        </div>
        <AdminRoleList />
      </section>

    </div>
  </AdminShell>
</template>

<style scoped lang="scss">
.ar-sections {
  display: flex;
  flex-direction: column;
  gap: 46px;
}

.ar-members-actions {
  display: flex;
  align-items: center;
  gap: 12px;

  .admin-btn {
    display: inline-flex;
    align-items: center;
    text-decoration: none;

    &:hover {
      text-decoration: none;
    }
  }
}

.ar-table-wrap {
  height: 360px;
  overflow-y: auto;
  scrollbar-gutter: stable;
  border: 1px solid var(--line);
  border-radius: 2px;

  .admin-table {
    thead th {
      position: sticky;
      top: 0;
      background: var(--paper);
    }
  }
}

.ar-role-select {
  height: 28px;
  width: 140px;
  font-size: 12px;
}

.ar-filter-select {
  height: 28px;
  width: 120px;
  font-size: 12px;
}

.ar-error {
  margin: 10px 0 0;
  color: #b91c1c;
  font-size: 11px;
}

.ar-steps {
  grid-template-columns: repeat(4, 1fr);

  @media (max-width: 800px) {
    grid-template-columns: repeat(2, 1fr);
  }
}

.ar-step {
  padding: 20px;
}

.ar-step-no {
  font-size: 10px;
  letter-spacing: 0.16em;
  color: var(--muted);
  margin-bottom: 12px;
}

.ar-step-title {
  font-size: 12.5px;
  margin-bottom: 8px;
}

.ar-step-desc {
  font-size: 12px;
  line-height: 1.65;
  color: color-mix(in srgb, #1c1c22 72%, #ffffff);
}

.ar-redirect {
  grid-template-columns: 1fr 1fr;

  @media (max-width: 700px) {
    grid-template-columns: 1fr;
  }
}

.ar-redirect-cell {
  padding: 22px 24px;
  background: var(--paper);

  &.is-after {
    background: var(--wash);
  }
}

.ar-redirect-code {
  font-size: 13px;
  margin: 10px 0;
}

.ar-redirect-desc {
  font-size: 12.5px;
  line-height: 1.65;
  color: color-mix(in srgb, #1c1c22 72%, #ffffff);
}
</style>
