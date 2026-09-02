<script setup lang="ts">
/**
 * 會員管理：左方會員列表、右方新增會員表單。
 */
import { onMounted, reactive, watch } from 'vue'
import { api, type AdminAccessUser, type UserRole } from '~/services/api'

type AsyncStatus = 'idle' | 'loading' | 'success' | 'error'

const DEFAULT_MEMBER_EMAIL = 'test@admin.hfyy'
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
  email: DEFAULT_MEMBER_EMAIL,
  password: DEFAULT_MEMBER_PASSWORD,
  role: 'user' as UserRole,
  submitStatus: 'idle' as AsyncStatus,
  submitError: '',
  successId: ''
})

const _handlers = {
  roleLabel: (role: UserRole) => (role === 'admin' ? 'Admin' : 'User')
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
      } else if (!state.selectedId || !state.users.some((u) => u.id === state.selectedId)) {
        state.selectedId = state.users[0]?.id ?? ''
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
      state.email = DEFAULT_MEMBER_EMAIL
      state.password = DEFAULT_MEMBER_PASSWORD
      state.role = 'user'
      state.successId = res.user.id
      state.selectedId = res.user.id
      state.submitStatus = 'success'
      await _actions.fetch()
      emit('created')
    } catch (e: unknown) {
      state.submitError = (e as { message?: string; data?: { message?: string } })?.data?.message
        ?? (e as { message?: string })?.message
        ?? '新增失敗'
      state.submitStatus = 'error'
    }
  }
}

const click = {
  select: (id: string) => {
    state.selectedId = id
  },
  submit: () => _actions.create()
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
        <div class="acm-col-label admin-en">New member</div>
        <form class="acm-form" @submit.prevent="click.submit">
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
            預設 Email <span class="admin-num">{{ DEFAULT_MEMBER_EMAIL }}</span>、密碼
            <span class="admin-num">{{ DEFAULT_MEMBER_PASSWORD }}</span>；含
            <span class="admin-num">@admin</span> 的 Email 可重複建立（登入時對到第一筆符合帳號）。
          </p>
        </form>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.acm {
  min-height: 460px;
  border: 1px solid var(--line);
  border-radius: 2px;
  background: var(--paper);
  overflow: hidden;
}

.acm-grid {
  display: grid;
  grid-template-columns: minmax(220px, 1fr) minmax(260px, 1fr);
  min-height: 460px;
  height: 100%;

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
  overflow: visible;
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
