<script setup lang="ts">
/**
 * 會員管理：左方會員列表、右方分頁（資訊／新增）。
 */
import { computed, onMounted, reactive, watch } from 'vue'
import { api, type AdminAccessUser, type AdminMemberBalanceChange, type UserRole } from '~/services/api'
import { balanceChangeTypeLabel } from '~/utils/balanceChangeLabel'

type AsyncStatus = 'idle' | 'loading' | 'success' | 'error'
type DetailTab = 'info' | 'create'

const DEFAULT_MEMBER_PASSWORD = '222222'

const props = defineProps<{
  /** 父層在新增會員後遞增，觸發重新載入列表 */
  reloadToken?: number
}>()

const emit = defineEmits<{
  created: []
}>()

const state = reactive({
  listStatus: 'idle' as AsyncStatus,
  listError: '',
  users: [] as AdminAccessUser[],
  selectedId: '' as string,
  name: '',
  email: '',
  password: DEFAULT_MEMBER_PASSWORD,
  role: 'user' as UserRole,
  submitStatus: 'idle' as AsyncStatus,
  submitError: '',
  successId: '',
  tab: 'create' as DetailTab,
  emailEditing: false,
  emailDraft: '',
  emailSaveStatus: 'idle' as AsyncStatus,
  emailSaveError: '',
  passwordEditing: false,
  passwordDraft: '',
  passwordSaveStatus: 'idle' as AsyncStatus,
  passwordSaveError: '',
  coinEditing: false,
  coinDraft: '',
  coinSaveStatus: 'idle' as AsyncStatus,
  coinSaveError: '',
  balanceStatus: 'idle' as AsyncStatus,
  balanceError: '',
  balanceRows: [] as AdminMemberBalanceChange[]
})

const selected = computed(() => state.users.find((u) => u.id === state.selectedId) ?? null)

const _handlers = {
  roleLabel: (role: UserRole) => (role === 'admin' ? 'Admin' : 'User'),
  formatCoin: (value: number) =>
    Number(value ?? 0).toLocaleString('zh-TW', { minimumFractionDigits: 0, maximumFractionDigits: 0 }),
  formatMoney: (value: number) =>
    Number(value ?? 0).toLocaleString('zh-TW', { minimumFractionDigits: 0, maximumFractionDigits: 2 }),
  formatTime: (ms: number) => {
    const t = Number(ms)
    if (!t) return '—'
    return new Date(t).toLocaleString('zh-TW')
  }
}

const _actions = {
  fetch: async () => {
    if (state.listStatus === 'loading') return
    state.listStatus = 'loading'
    state.listError = ''
    try {
      const res = await api.admin.roles()
      state.users = res.users
      if (state.successId && state.users.some((u) => u.id === state.successId)) {
        state.selectedId = state.successId
      } else if (state.tab === 'info') {
        if (!state.selectedId || !state.users.some((u) => u.id === state.selectedId)) {
          state.selectedId = state.users[0]?.id ?? ''
        }
      } else if (state.selectedId && !state.users.some((u) => u.id === state.selectedId)) {
        state.selectedId = ''
      }
      state.listStatus = 'success'
    } catch (e: unknown) {
      state.listError = (e as { message?: string })?.message ?? '載入失敗'
      state.listStatus = 'error'
    }
  },
  create: async () => {
    if (state.submitStatus === 'loading') return
    const name = state.name.trim()
    const email = state.email.trim()
    const password = state.password
    if (!name) {
      state.submitError = '請輸入名稱。'
      state.submitStatus = 'error'
      return
    }
    if (!email) {
      state.submitError = '請輸入 Email。'
      state.submitStatus = 'error'
      return
    }
    if (password.length < 6) {
      state.submitError = '密碼至少 6 字元。'
      state.submitStatus = 'error'
      return
    }
    state.submitStatus = 'loading'
    state.submitError = ''
    state.successId = ''
    try {
      const res = await api.admin.createMember({
        name,
        email,
        password,
        role: state.role
      })
      state.name = ''
      state.email = ''
      state.password = DEFAULT_MEMBER_PASSWORD
      state.role = 'user'
      state.successId = res.user.id
      state.selectedId = res.user.id
      state.tab = 'info'
      state.submitStatus = 'success'
      await _actions.fetch()
      emit('created')
    } catch (e: unknown) {
      state.submitError = (e as { message?: string; data?: { message?: string } })?.data?.message
        ?? (e as { message?: string })?.message
        ?? '新增失敗'
      state.submitStatus = 'error'
    }
  },
  resetInfoEdit: () => {
    state.emailEditing = false
    state.emailDraft = ''
    state.emailSaveStatus = 'idle'
    state.emailSaveError = ''
    state.passwordEditing = false
    state.passwordDraft = ''
    state.passwordSaveStatus = 'idle'
    state.passwordSaveError = ''
    state.coinEditing = false
    state.coinDraft = ''
    state.coinSaveStatus = 'idle'
    state.coinSaveError = ''
  },
  saveEmail: async () => {
    const row = selected.value
    if (!row || state.emailSaveStatus === 'loading') return
    const email = state.emailDraft.trim()
    if (!email) {
      state.emailSaveError = '請輸入 Email。'
      state.emailSaveStatus = 'error'
      return
    }
    state.emailSaveStatus = 'loading'
    state.emailSaveError = ''
    try {
      const res = await api.admin.setMemberEmail(row.id, email)
      const idx = state.users.findIndex((u) => u.id === res.user.id)
      if (idx >= 0) state.users[idx] = res.user
      state.emailEditing = false
      state.emailDraft = ''
      state.emailSaveError = ''
      state.emailSaveStatus = 'success'
    } catch (e: unknown) {
      state.emailSaveError = (e as { message?: string; data?: { message?: string } })?.data?.message
        ?? (e as { message?: string })?.message
        ?? 'Email 更新失敗'
      state.emailSaveStatus = 'error'
    }
  },
  savePassword: async () => {
    const row = selected.value
    if (!row || state.passwordSaveStatus === 'loading') return
    const password = state.passwordDraft
    if (password.length < 6) {
      state.passwordSaveError = '密碼至少 6 字元。'
      state.passwordSaveStatus = 'error'
      return
    }
    state.passwordSaveStatus = 'loading'
    state.passwordSaveError = ''
    try {
      const res = await api.admin.setMemberPassword(row.id, password)
      const idx = state.users.findIndex((u) => u.id === res.user.id)
      if (idx >= 0) state.users[idx] = res.user
      state.passwordEditing = false
      state.passwordDraft = ''
      state.passwordSaveError = ''
      state.passwordSaveStatus = 'success'
    } catch (e: unknown) {
      state.passwordSaveError = (e as { message?: string; data?: { message?: string } })?.data?.message
        ?? (e as { message?: string })?.message
        ?? '密碼更新失敗'
      state.passwordSaveStatus = 'error'
    }
  },
  saveCoin: async () => {
    const row = selected.value
    if (!row || state.coinSaveStatus === 'loading') return
    const delta = Math.trunc(Number(state.coinDraft))
    if (!Number.isFinite(delta) || delta === 0) {
      state.coinSaveError = '請輸入非 0 整數（正數充值、負數扣款）。'
      state.coinSaveStatus = 'error'
      return
    }
    state.coinSaveStatus = 'loading'
    state.coinSaveError = ''
    try {
      const res = await api.admin.adjustMemberCoin(row.id, delta)
      const idx = state.users.findIndex((u) => u.id === res.user.id)
      if (idx >= 0) state.users[idx] = res.user
      state.coinEditing = false
      state.coinDraft = ''
      state.coinSaveError = ''
      state.coinSaveStatus = 'success'
      await _actions.fetchBalanceHistory(row.id)
    } catch (e: unknown) {
      state.coinSaveError = (e as { message?: string; data?: { message?: string } })?.data?.message
        ?? (e as { message?: string })?.message
        ?? 'F幣調整失敗'
      state.coinSaveStatus = 'error'
    }
  },
  fetchBalanceHistory: async (userId?: string) => {
    const id = userId ?? selected.value?.id
    if (!id) {
      state.balanceRows = []
      state.balanceStatus = 'idle'
      state.balanceError = ''
      return
    }
    state.balanceStatus = 'loading'
    state.balanceError = ''
    try {
      const res = await api.admin.memberBalanceChanges(id)
      state.balanceRows = res.changes
      state.balanceStatus = 'success'
    } catch (e: unknown) {
      state.balanceError = (e as { message?: string })?.message ?? '載入變動紀錄失敗'
      state.balanceStatus = 'error'
    }
  }
}

const click = {
  select: (id: string) => {
    state.selectedId = id
    state.tab = 'info'
    _actions.resetInfoEdit()
  },
  setTab: (tab: DetailTab) => {
    state.tab = tab
    if (tab === 'info') {
      const first = state.users[0]
      if (!state.selectedId && first) {
        state.selectedId = first.id
      }
    }
    _actions.resetInfoEdit()
  },
  submit: () => _actions.create(),
  startEmailEdit: () => {
    _actions.resetInfoEdit()
    state.emailEditing = true
    state.emailDraft = selected.value?.email ?? ''
  },
  cancelEmailEdit: () => _actions.resetInfoEdit(),
  saveEmail: () => _actions.saveEmail(),
  startPasswordEdit: () => {
    _actions.resetInfoEdit()
    state.passwordEditing = true
    state.passwordDraft = ''
  },
  cancelPasswordEdit: () => _actions.resetInfoEdit(),
  savePassword: () => _actions.savePassword(),
  startCoinEdit: () => {
    _actions.resetInfoEdit()
    state.coinEditing = true
    state.coinDraft = ''
  },
  cancelCoinEdit: () => _actions.resetInfoEdit(),
  saveCoin: () => _actions.saveCoin()
}

onMounted(() => {
  _actions.fetch()
})

watch(
  () => [state.selectedId, state.tab] as const,
  ([id, tab]) => {
    if (tab === 'info' && id) {
      _actions.fetchBalanceHistory(id)
      return
    }
    state.balanceRows = []
    state.balanceStatus = 'idle'
    state.balanceError = ''
  }
)

watch(
  () => props.reloadToken,
  (token, prev) => {
    if (token !== undefined && token !== prev) _actions.fetch()
  }
)
</script>

<template>
  <div class="acm">
    <div v-if="state.listStatus === 'loading'" class="admin-empty acm-empty">載入中...</div>
    <div v-else-if="state.listStatus === 'error'" class="acm-error acm-empty">{{ state.listError }}</div>
    <div v-else class="acm-grid">
      <div class="acm-list-wrap">
        <div class="acm-col-label admin-en">Members</div>
        <ul v-if="state.users.length > 0" class="acm-list">
          <li v-for="row in state.users" :key="row.id" class="acm-item"
            :class="{ 'is-active': row.id === state.selectedId }">
            <button type="button" class="acm-item-btn" @click="click.select(row.id)">
              <span class="acm-item-name">{{ row.name }}</span>
              <span class="acm-item-meta">
                <span class="admin-num acm-item-id">{{ row.id }}</span>
                <span class="admin-tag" :class="{ 'is-user': row.role === 'user' }">
                  {{ _handlers.roleLabel(row.role) }}
                </span>
              </span>
            </button>
          </li>
        </ul>
        <div v-else class="admin-empty acm-list-empty">尚無會員</div>
      </div>

      <div class="acm-detail">
        <nav class="acm-tabs" aria-label="會員功能分頁">
          <button type="button" class="acm-tab" :class="{ 'is-active': state.tab === 'info' }"
            @click="click.setTab('info')">
            <span class="acm-tab-label">資訊</span>
            <span class="admin-en acm-tab-en">Info</span>
          </button>
          <button type="button" class="acm-tab" :class="{ 'is-active': state.tab === 'create' }"
            @click="click.setTab('create')">
            <span class="acm-tab-label">新增</span>
            <span class="admin-en acm-tab-en">New</span>
          </button>
        </nav>

        <div v-if="state.tab === 'info'" class="acm-info">
          <template v-if="selected">
            <div class="acm-info-card">
              <div class="acm-info-name">{{ selected.name }}</div>
              <div class="acm-info-row">
                <span class="acm-info-k">User ID</span>
                <span class="admin-num">{{ selected.id }}</span>
              </div>
              <div class="acm-info-row">
                <span class="acm-info-k">帳號</span>
                <span>{{ selected.name }}</span>
              </div>
              <div class="acm-info-row acm-info-row-editable">
                <span class="acm-info-k">Email</span>
                <template v-if="!state.emailEditing">
                  <span class="acm-info-v">{{ selected.email }}</span>
                  <div class="acm-info-action-wrap">
                    <span class="admin-en acm-info-action-k">email</span>
                    <button type="button" class="acm-info-link" @click="click.startEmailEdit">修改</button>
                  </div>
                  <p v-if="state.emailSaveStatus === 'success'" class="acm-ok acm-info-feedback">Email 已更新</p>
                </template>
                <div v-else class="acm-info-edit">
                  <input v-model="state.emailDraft" type="email" class="admin-input acm-info-edit-input" maxlength="120"
                    placeholder="login@example.com" autocomplete="off">
                  <div class="acm-info-edit-actions">
                    <button type="button" class="admin-btn admin-btn-primary"
                      :disabled="state.emailSaveStatus === 'loading'" @click="click.saveEmail">
                      {{ state.emailSaveStatus === 'loading' ? '儲存中…' : '儲存' }}
                    </button>
                    <button type="button" class="admin-btn" @click="click.cancelEmailEdit">取消</button>
                  </div>
                  <p v-if="state.emailSaveError" class="acm-error">{{ state.emailSaveError }}</p>
                </div>
              </div>
              <div class="acm-info-row acm-info-row-editable">
                <span class="acm-info-k">密碼</span>
                <template v-if="!state.passwordEditing">
                  <span class="acm-info-v acm-info-mask">xxxxxx</span>
                  <div class="acm-info-action-wrap">
                    <span class="admin-en acm-info-action-k">pwd</span>
                    <button type="button" class="acm-info-link" @click="click.startPasswordEdit">修改</button>
                  </div>
                  <p v-if="state.passwordSaveStatus === 'success'" class="acm-ok acm-info-feedback">密碼已更新</p>
                </template>
                <div v-else class="acm-info-edit">
                  <input v-model="state.passwordDraft" type="text" class="admin-input acm-info-edit-input" minlength="6"
                    maxlength="72" placeholder="新密碼（至少 6 字元）" autocomplete="off">
                  <div class="acm-info-edit-actions">
                    <button type="button" class="admin-btn admin-btn-primary"
                      :disabled="state.passwordSaveStatus === 'loading'" @click="click.savePassword">
                      {{ state.passwordSaveStatus === 'loading' ? '儲存中…' : '儲存' }}
                    </button>
                    <button type="button" class="admin-btn" @click="click.cancelPasswordEdit">取消</button>
                  </div>
                  <p v-if="state.passwordSaveError" class="acm-error">{{ state.passwordSaveError }}</p>
                </div>
              </div>
              <div class="acm-info-row">
                <span class="acm-info-k">角色</span>
                <span class="admin-tag" :class="{ 'is-user': selected.role === 'user' }">
                  {{ _handlers.roleLabel(selected.role) }}
                </span>
              </div>
              <div class="acm-info-row acm-info-row-editable">
                <span class="acm-info-k">F幣</span>
                <template v-if="!state.coinEditing">
                  <span class="acm-info-v acm-info-coin">{{ _handlers.formatCoin(selected.coin) }}</span>
                  <div class="acm-info-action-wrap">
                    <span class="admin-en acm-info-action-k">coin</span>
                    <button type="button" class="acm-info-link" @click="click.startCoinEdit">充值</button>
                  </div>
                  <p v-if="state.coinSaveStatus === 'success'" class="acm-ok acm-info-feedback">F幣已更新</p>
                </template>
                <div v-else class="acm-info-edit">
                  <input v-model="state.coinDraft" type="number" class="admin-input acm-info-edit-input" step="1"
                    placeholder="調整金額（正數充值、負數扣款）" autocomplete="off">
                  <div class="acm-info-edit-actions">
                    <button type="button" class="admin-btn admin-btn-primary"
                      :disabled="state.coinSaveStatus === 'loading'" @click="click.saveCoin">
                      {{ state.coinSaveStatus === 'loading' ? '處理中…' : '確認' }}
                    </button>
                    <button type="button" class="admin-btn" @click="click.cancelCoinEdit">取消</button>
                  </div>
                  <p v-if="state.coinSaveError" class="acm-error">{{ state.coinSaveError }}</p>
                </div>
              </div>
            </div>

            <section class="acm-ledger">
              <div class="acm-ledger-head">
                <span class="admin-en acm-ledger-en">Ledger</span>
                <h3 class="acm-ledger-title">F幣 變動紀錄</h3>
              </div>
              <div v-if="state.balanceStatus === 'loading'" class="admin-empty acm-ledger-empty">載入中…</div>
              <div v-else-if="state.balanceStatus === 'error'" class="acm-error acm-ledger-empty">{{ state.balanceError
                }}</div>
              <div v-else-if="state.balanceRows.length === 0" class="admin-empty acm-ledger-empty">尚無變動紀錄</div>
              <div v-else class="acm-ledger-table-wrap">
                <table class="acm-ledger-table">
                  <thead>
                    <tr>
                      <th>時間</th>
                      <th>來源</th>
                      <th>類型</th>
                      <th>期數</th>
                      <th>備註</th>
                      <th class="is-num">變動</th>
                      <th class="is-num">餘額</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="row in state.balanceRows" :key="row.id">
                      <td class="acm-ledger-time">{{ _handlers.formatTime(row.createdAt) }}</td>
                      <td>{{ row.sourceLabel }}</td>
                      <td>{{ balanceChangeTypeLabel(row.type) }}</td>
                      <td>{{ row.issue || '—' }}</td>
                      <td class="acm-ledger-note">{{ row.note || '—' }}</td>
                      <td class="is-num" :class="row.amount < 0 ? 'acm-ledger-minus' : 'acm-ledger-plus'">
                        {{ _handlers.formatMoney(row.amount) }}
                      </td>
                      <td class="is-num">{{ _handlers.formatMoney(row.after) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          </template>
          <div v-else class="admin-empty acm-info-empty">請從左側選擇會員</div>
        </div>

        <form v-else class="acm-form" @submit.prevent="click.submit">
          <div class="acm-fields">
            <div class="admin-field">
              <label>帳號</label>
              <input v-model="state.name" type="text" class="admin-input" maxlength="40" placeholder="請輸入帳號"
                autocomplete="off">
            </div>
            <div class="admin-field">
              <label>Email</label>
              <input v-model="state.email" type="email" class="admin-input" placeholder="login@example.com"
                autocomplete="off">
            </div>
            <div class="admin-field">
              <label>密碼</label>
              <input v-model="state.password" type="text" class="admin-input" minlength="6" maxlength="72"
                placeholder="至少 6 字元" autocomplete="off">
            </div>
            <div class="admin-field">
              <label>角色</label>
              <select v-model="state.role" class="admin-input">
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>

          <div class="acm-footer">
            <div class="acm-footer-actions">
              <button type="submit" class="admin-btn admin-btn-primary" :disabled="state.submitStatus === 'loading'">
                {{ state.submitStatus === 'loading' ? '新增中…' : '新增' }}
              </button>
              <p v-if="state.submitError" class="acm-error">{{ state.submitError }}</p>
              <p v-else-if="state.submitStatus === 'success'" class="acm-ok">
                已建立 <span class="admin-num">{{ state.successId }}</span>（in-memory，重啟後消失）
              </p>
            </div>
          </div>
          <p class="acm-hint">
            Email 為登入的帳號，不可重複。預設密碼
            <span class="admin-num">{{ DEFAULT_MEMBER_PASSWORD }}</span>。
          </p>
        </form>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.acm {
  height: 560px;
  min-height: 0;
  max-height: 560px;
  border: 1px solid var(--line);
  border-radius: 2px;
  background: var(--paper);
  overflow: hidden;
}

.acm-grid {
  display: grid;
  grid-template-columns: minmax(220px, 1fr) minmax(260px, 1fr);
  height: 100%;
  min-height: 0;

  @media (max-width: 800px) {
    grid-template-columns: 1fr;
  }
}

.acm-col-label {
  padding: 8px 12px 0;
  color: var(--muted);
}

.acm-list-wrap {
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

.acm-list {
  list-style: none;
  margin: 0;
  padding: 8px;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  scrollbar-gutter: stable;
}

.acm-list-empty {
  padding: 24px 12px;
}

.acm-item-btn {
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

.acm-item.is-active .acm-item-btn {
  background: var(--paper);
  border-color: var(--ink);
}

.acm-item-name {
  font-size: 13px;
  font-weight: 700;
}

.acm-item-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.acm-item-id {
  font-size: 11px;
  color: var(--muted);
}

.admin-tag.is-user {
  background: color-mix(in srgb, #1c1c22 8%, var(--paper));
  color: var(--muted);
}

.acm-detail {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.acm-tabs {
  display: flex;
  gap: 2px;
  padding: 0 12px;
  border-bottom: 1px solid var(--line);
  flex-shrink: 0;
}

.acm-tab {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 2px;
  min-width: 72px;
  height: 46px;
  padding: 0 12px;
  border: 0;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  background: transparent;
  color: var(--muted);
  font-family: inherit;
  cursor: pointer;
  text-align: left;

  &:hover {
    color: var(--ink);
  }

  &.is-active {
    color: var(--ink);
    border-bottom-color: var(--ink);
  }
}

.acm-tab-label {
  font-size: 13px;
  font-weight: 700;
  line-height: 1.1;
}

.acm-tab-en {
  font-size: 7px;
  letter-spacing: 0.16em;
  line-height: 1;
}

.acm-info {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.acm-info-card {
  padding: 14px 16px 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex-shrink: 0;
}

.acm-info-name {
  font-size: 18px;
  font-weight: 700;
}

.acm-info-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  font-size: 12px;
}

.acm-info-row-editable {
  flex-wrap: wrap;
  align-items: center;
}

.acm-info-v {
  flex: 1;
  min-width: 0;
  word-break: break-all;
}

.acm-info-action-wrap {
  flex: none;
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 6px;
}

.acm-info-action-k {
  font-size: 7px;
  letter-spacing: 0.14em;
  text-transform: lowercase;
  color: var(--muted);
  line-height: 1;
}

.acm-info-feedback {
  flex-basis: 100%;
  margin: 0;
  padding-left: 76px;
}

.acm-info-edit {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.acm-info-edit-input {
  width: 100%;
}

.acm-info-edit-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.acm-info-mask {
  letter-spacing: 0.12em;
  color: var(--muted);
}

.acm-info-link {
  border: 0;
  padding: 0;
  background: transparent;
  color: var(--ink);
  font-family: inherit;
  font-size: 12px;
  font-weight: 700;
  text-decoration: underline;
  cursor: pointer;

  &:hover {
    color: color-mix(in srgb, #1c1c22 72%, #ffffff);
  }
}

.acm-info-k {
  width: 64px;
  flex-shrink: 0;
  color: var(--muted);
}

.acm-info-coin {
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: #ca8a04;
}

.acm-info-empty {
  padding: 32px 16px;
}

.acm-ledger {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  border-top: 1px solid var(--line);
  padding: 10px 16px 12px;
}

.acm-ledger-head {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 8px;
  flex-shrink: 0;
}

.acm-ledger-en {
  font-size: 7px;
  letter-spacing: 0.16em;
  color: var(--muted);
}

.acm-ledger-title {
  margin: 0;
  font-size: 13px;
  font-weight: 700;
  line-height: 1.2;
}

.acm-ledger-empty {
  padding: 20px 0;
  font-size: 12px;
}

.acm-ledger-table-wrap {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  scrollbar-gutter: stable;
  -webkit-overflow-scrolling: touch;
  border: 1px solid var(--line);
  border-radius: 2px;
  background: var(--wash);
}

.acm-ledger-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;

  th,
  td {
    padding: 6px 8px;
    border-bottom: 1px solid var(--line);
    text-align: left;
    vertical-align: top;
  }

  th {
    position: sticky;
    top: 0;
    z-index: 1;
    background: var(--paper);
    font-weight: 700;
    white-space: nowrap;
  }

  tbody tr:last-child td {
    border-bottom: 0;
  }

  .is-num {
    text-align: right;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
}

.acm-ledger-time {
  white-space: nowrap;
}

.acm-ledger-note {
  max-width: 120px;
  word-break: break-word;
}

.acm-ledger-plus {
  color: #15803d;
  font-weight: 700;
}

.acm-ledger-minus {
  color: #b91c1c;
  font-weight: 700;
}

.acm-form {
  flex: 1;
  min-height: 0;
  padding: 8px 16px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.acm-fields {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.acm-footer {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  margin-top: 7px;
}

.acm-footer-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

.acm-hint {
  margin: auto 0 0;
  max-width: 42ch;
  font-size: 11px;
  line-height: 1.55;
  color: var(--muted);
}

.acm-error {
  margin: 0;
  color: #b91c1c;
  font-size: 11px;
}

.acm-ok {
  margin: 0;
  color: #15803d;
  font-size: 11px;
}

.acm-empty {
  padding: 32px 16px;
}
</style>
