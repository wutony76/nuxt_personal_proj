<script setup lang="ts">
/**
 * 角色列表：左方角色清單、右方分頁（資訊／新增角色）。
 * 版面比照 CreateMember.vue 的左列表右分頁 pattern。
 */
import { computed, onMounted, reactive } from 'vue'
import { api } from '~/services/api'
import { useRoleDefs } from '~/composables/useRoleDefs'

type AsyncStatus = 'idle' | 'loading' | 'success' | 'error'
type DetailTab = 'info' | 'create'

const emit = defineEmits<{
  created: []
}>()

const { roles, fetch: fetchRoleDefs, refresh: refreshRoleDefs } = useRoleDefs()

const state = reactive({
  selectedId: '' as string,
  name: '',
  submitStatus: 'idle' as AsyncStatus,
  submitError: '',
  successId: '',
  tab: 'create' as DetailTab
})

const selected = computed(() => roles.value.find((r) => r.id === state.selectedId) ?? null)

const _actions = {
  create: async () => {
    if (state.submitStatus === 'loading') return
    const name = state.name.trim()
    if (!name) {
      state.submitError = '請輸入角色名稱。'
      state.submitStatus = 'error'
      return
    }
    state.submitStatus = 'loading'
    state.submitError = ''
    try {
      const res = await api.admin.createRoleDef(name)
      state.name = ''
      state.successId = res.role.id
      state.selectedId = res.role.id
      state.tab = 'info'
      state.submitStatus = 'success'
      await refreshRoleDefs()
      emit('created')
    } catch (e: unknown) {
      state.submitError = (e as { data?: { message?: string }; message?: string })?.data?.message
        ?? (e as { message?: string })?.message
        ?? '新增失敗'
      state.submitStatus = 'error'
    }
  }
}

const click = {
  select: (id: string) => {
    state.selectedId = id
    state.tab = 'info'
  },
  setTab: (tab: DetailTab) => {
    state.tab = tab
    if (tab === 'info' && !state.selectedId) {
      state.selectedId = roles.value[0]?.id ?? ''
    }
  },
  submit: () => _actions.create()
}

onMounted(() => {
  fetchRoleDefs()
})
</script>

<template>
  <div class="arl">
    <div class="arl-grid">
      <div class="arl-list-wrap">
        <div class="arl-col-label admin-en">Roles</div>
        <ul v-if="roles.length > 0" class="arl-list">
          <li v-for="row in roles" :key="row.id" class="arl-item"
            :class="{ 'is-active': row.id === state.selectedId }">
            <button type="button" class="arl-item-btn" @click="click.select(row.id)">
              <span class="arl-item-name">{{ row.name }}</span>
              <span class="arl-item-meta">
                <span class="admin-num arl-item-id">{{ row.id }}</span>
                <span class="admin-tag" :class="{ 'is-user': !row.builtin }">
                  {{ row.builtin ? '內建' : '自訂' }}
                </span>
              </span>
            </button>
          </li>
        </ul>
        <div v-else class="admin-empty arl-list-empty">尚無角色</div>
      </div>

      <div class="arl-detail">
        <nav class="arl-tabs" aria-label="角色功能分頁">
          <button type="button" class="arl-tab" :class="{ 'is-active': state.tab === 'info' }"
            @click="click.setTab('info')">
            <span class="arl-tab-label">資訊</span>
            <span class="admin-en arl-tab-en">Info</span>
          </button>
          <button type="button" class="arl-tab" :class="{ 'is-active': state.tab === 'create' }"
            @click="click.setTab('create')">
            <span class="arl-tab-label">新增</span>
            <span class="admin-en arl-tab-en">New</span>
          </button>
        </nav>

        <div v-if="state.tab === 'info'" class="arl-info">
          <template v-if="selected">
            <div class="arl-info-card">
              <div class="arl-info-name">{{ selected.name }}</div>
              <div class="arl-info-row">
                <span class="arl-info-k">角色 ID</span>
                <span class="admin-num">{{ selected.id }}</span>
              </div>
              <div class="arl-info-row">
                <span class="arl-info-k">類型</span>
                <span class="admin-tag" :class="{ 'is-user': !selected.builtin }">
                  {{ selected.builtin ? '內建' : '自訂' }}
                </span>
              </div>
              <p class="arl-hint">
                {{ selected.builtin ? '內建角色不可重新命名或刪除。' : '自訂角色，重新命名／刪除留待後續開放。' }}
              </p>
            </div>
          </template>
          <div v-else class="admin-empty arl-info-empty">請從左側選擇角色</div>
        </div>

        <form v-else class="arl-form" @submit.prevent="click.submit">
          <div class="arl-fields">
            <div class="admin-field">
              <label>角色名稱</label>
              <input v-model="state.name" type="text" class="admin-input" maxlength="20" placeholder="例如 VIP"
                autocomplete="off">
            </div>
          </div>

          <div class="arl-footer">
            <button type="submit" class="admin-btn admin-btn-primary" :disabled="state.submitStatus === 'loading'">
              {{ state.submitStatus === 'loading' ? '新增中…' : '新增角色' }}
            </button>
            <p v-if="state.submitError" class="arl-error">{{ state.submitError }}</p>
            <p v-else-if="state.submitStatus === 'success'" class="arl-ok">
              已建立 <span class="admin-num">{{ state.successId }}</span>（in-memory，重啟後消失）
            </p>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.arl {
  height: 360px;
  min-height: 0;
  max-height: 360px;
  border: 1px solid var(--line);
  border-radius: 2px;
  background: var(--paper);
  overflow: hidden;
}

.arl-grid {
  display: grid;
  grid-template-columns: minmax(220px, 1fr) minmax(260px, 1fr);
  height: 100%;
  min-height: 0;

  @media (max-width: 800px) {
    grid-template-columns: 1fr;
  }
}

.arl-col-label {
  padding: 8px 12px 0;
  color: var(--muted);
}

.arl-list-wrap {
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

.arl-list {
  list-style: none;
  margin: 0;
  padding: 8px;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  scrollbar-gutter: stable;
}

.arl-item-btn {
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

.arl-item.is-active .arl-item-btn {
  background: var(--paper);
  border-color: var(--ink);
}

.arl-item-name {
  font-size: 13px;
  font-weight: 700;
}

.arl-item-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.arl-item-id {
  font-size: 11px;
  color: var(--muted);
}

.arl-detail {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.arl-tabs {
  display: flex;
  gap: 2px;
  padding: 0 12px;
  border-bottom: 1px solid var(--line);
  flex-shrink: 0;
}

.arl-tab {
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

.arl-tab-label {
  font-size: 13px;
  font-weight: 700;
  line-height: 1.1;
}

.arl-tab-en {
  font-size: 7px;
  letter-spacing: 0.16em;
  line-height: 1;
}

.arl-info,
.arl-form {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.arl-info-card,
.arl-form {
  padding: 12px 16px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.arl-info-name {
  font-size: 18px;
  font-weight: 700;
}

.arl-info-row {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 12px;
}

.arl-info-k {
  width: 64px;
  flex-shrink: 0;
  color: var(--muted);
}

.arl-hint {
  margin: 4px 0 0;
  font-size: 11px;
  line-height: 1.55;
  color: color-mix(in srgb, #1c1c22 62%, #ffffff);
}

.arl-fields {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.arl-footer {
  margin-top: 4px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: flex-start;
}

.arl-error {
  margin: 0;
  color: #b91c1c;
  font-size: 11px;
}

.arl-ok {
  margin: 0;
  color: #15803d;
  font-size: 11px;
}

.arl-list-empty,
.arl-info-empty {
  padding: 32px 16px;
}
</style>
