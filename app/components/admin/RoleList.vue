<script setup lang="ts">
/**
 * 角色列表：左方角色清單、右方分頁（資訊／新增角色）。
 * 版面比照 CreateMember.vue 的左列表右分頁 pattern。
 */
import { computed, onMounted, reactive, watch } from 'vue'
import { api } from '~/services/api'
import { useRoleDefs } from '~/composables/useRoleDefs'

type RoleSettingsPatch = {
  testMode?: boolean
  npcMode?: boolean
  dailyCoinReward?: { enabled?: boolean; amount?: number }
}

type AsyncStatus = 'idle' | 'loading' | 'success' | 'error'
type DetailTab = 'info' | 'create'
type InfoSubTab = 'overview' | 'games'

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
  tab: 'create' as DetailTab,
  infoSubTab: 'overview' as InfoSubTab,
  removingId: '' as string,
  removeError: '',
  /** 待二次確認的角色 id；再次點擊同一顆刪除按鈕才會真的送出刪除 */
  confirmingId: '' as string,
  settingsSavingKey: '' as string,
  settingsError: '',
  dailyCoinAmountDraft: 0
})

const selected = computed(() => roles.value.find((r) => r.id === state.selectedId) ?? null)

watch(selected, (role) => {
  state.dailyCoinAmountDraft = role?.dailyCoinReward.amount ?? 0
}, { immediate: true })

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
  },
  remove: async (id: string) => {
    if (state.removingId) return
    state.removingId = id
    state.removeError = ''
    try {
      await api.admin.deleteRoleDef(id)
      if (state.selectedId === id) state.selectedId = ''
      await refreshRoleDefs()
    } catch (e: unknown) {
      state.removeError = (e as { data?: { message?: string }; message?: string })?.data?.message
        ?? (e as { message?: string })?.message
        ?? '刪除失敗'
    } finally {
      state.removingId = ''
    }
  },
  updateSettings: async (key: string, patch: RoleSettingsPatch) => {
    if (!selected.value || state.settingsSavingKey) return
    state.settingsSavingKey = key
    state.settingsError = ''
    try {
      await api.admin.setRoleSettings(selected.value.id, patch)
      await refreshRoleDefs()
    } catch (e: unknown) {
      state.settingsError = (e as { data?: { message?: string }; message?: string })?.data?.message
        ?? (e as { message?: string })?.message
        ?? '更新失敗'
    } finally {
      state.settingsSavingKey = ''
    }
  }
}

const click = {
  select: (id: string) => {
    state.selectedId = id
    state.tab = 'info'
    state.infoSubTab = 'overview'
    state.confirmingId = ''
  },
  setTab: (tab: DetailTab) => {
    state.tab = tab
    if (tab === 'info' && !state.selectedId) {
      state.selectedId = roles.value[0]?.id ?? ''
    }
    state.confirmingId = ''
  },
  setInfoSubTab: (tab: InfoSubTab) => {
    state.infoSubTab = tab
    state.confirmingId = ''
  },
  submit: () => _actions.create(),
  remove: (id: string) => {
    if (state.confirmingId !== id) {
      state.confirmingId = id
      return
    }
    state.confirmingId = ''
    _actions.remove(id)
  },
  toggleTestMode: () => {
    if (!selected.value) return
    _actions.updateSettings('testMode', { testMode: !selected.value.testMode })
  },
  toggleNpcMode: () => {
    if (!selected.value) return
    _actions.updateSettings('npcMode', { npcMode: !selected.value.npcMode })
  },
  toggleDailyCoinEnabled: () => {
    if (!selected.value) return
    _actions.updateSettings('dailyCoinReward', { dailyCoinReward: { enabled: !selected.value.dailyCoinReward.enabled } })
  },
  commitDailyCoinAmount: () => {
    if (!selected.value) return
    const amount = Math.max(0, Math.floor(Number(state.dailyCoinAmountDraft) || 0))
    state.dailyCoinAmountDraft = amount
    if (amount === selected.value.dailyCoinReward.amount) return
    _actions.updateSettings('dailyCoinReward', { dailyCoinReward: { amount } })
  }
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
          <li v-for="row in roles" :key="row.id" class="arl-item" :class="{ 'is-active': row.id === state.selectedId }">
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
            <span class="arl-tab-label">設定</span>
            <span class="admin-en arl-tab-en">Settings</span>
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
              <div class="arl-info-head">
                <div class="arl-info-name">{{ selected.name }}</div>
                <button v-if="!selected.builtin" type="button" class="admin-btn admin-btn-ghost arl-delete"
                  :class="{ 'is-confirming': state.confirmingId === selected.id }"
                  :disabled="state.removingId === selected.id" @click="click.remove(selected.id)">
                  {{
                    state.removingId === selected.id
                      ? '刪除中…'
                      : state.confirmingId === selected.id
                        ? '再次點擊確認刪除'
                        : '刪除角色'
                  }}
                </button>
              </div>
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
                {{ selected.builtin ? '內建功能不可修改或刪除, 若有其他需求請新增角色' : '可以依照需求設定角色功能。' }}
              </p>
              <p v-if="state.removeError" class="arl-error">{{ state.removeError }}</p>
            </div>

            <nav class="arl-subtabs" aria-label="角色設定子分頁">
              <button type="button" class="arl-subtab" :class="{ 'is-active': state.infoSubTab === 'overview' }"
                @click="click.setInfoSubTab('overview')">
                <span class="arl-subtab-label">總覽</span>
                <span class="admin-en arl-subtab-en">Overview</span>
              </button>
              <button v-if="!selected.builtin" type="button" class="arl-subtab"
                :class="{ 'is-active': state.infoSubTab === 'games' }" @click="click.setInfoSubTab('games')">
                <span class="arl-subtab-label">遊戲</span>
                <span class="admin-en arl-subtab-en">Games</span>
              </button>
            </nav>

            <div class="arl-subtab-content">
              <div v-if="state.infoSubTab === 'overview'" class="arl-settings">
                <div class="arl-setting-row">
                  <span class="arl-setting-label">
                    測試模式
                    <span v-if="selected.id === 'npc'" class="arl-setting-locked">（固定開啟）</span>
                  </span>
                  <button type="button" class="arl-setting-toggle"
                    :class="selected.testMode ? 'is-on' : 'is-off'"
                    :disabled="state.settingsSavingKey === 'testMode' || selected.id === 'npc'"
                    @click="click.toggleTestMode()">
                    {{ selected.testMode ? '開啟' : '關閉' }}
                  </button>
                </div>
                <div class="arl-setting-row">
                  <span class="arl-setting-label">
                    NPC模式
                    <span v-if="selected.id === 'npc'" class="arl-setting-locked">（固定開啟）</span>
                  </span>
                  <button type="button" class="arl-setting-toggle"
                    :class="selected.npcMode ? 'is-on' : 'is-off'"
                    :disabled="state.settingsSavingKey === 'npcMode' || selected.id === 'npc'"
                    @click="click.toggleNpcMode()">
                    {{ selected.npcMode ? '開啟' : '關閉' }}
                  </button>
                </div>
                <div class="arl-setting-row">
                  <span class="arl-setting-label">每日自動加F幣</span>
                  <input type="number" class="admin-input arl-setting-amount" min="0" max="1000000"
                    :value="state.dailyCoinAmountDraft"
                    :disabled="state.settingsSavingKey === 'dailyCoinReward'"
                    @input="state.dailyCoinAmountDraft = ($event.target as HTMLInputElement).valueAsNumber"
                    @change="click.commitDailyCoinAmount()">
                  <button type="button" class="arl-setting-toggle"
                    :class="selected.dailyCoinReward.enabled ? 'is-on' : 'is-off'"
                    :disabled="state.settingsSavingKey === 'dailyCoinReward'" @click="click.toggleDailyCoinEnabled()">
                    {{ selected.dailyCoinReward.enabled ? '開啟' : '關閉' }}
                  </button>
                </div>
                <p v-if="state.settingsError" class="arl-error">{{ state.settingsError }}</p>
              </div>
              <AdminRoleGamesPanel v-else-if="!selected.builtin && state.infoSubTab === 'games'"
                :role-id="selected.id" class="arl-games" />
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
              {{ state.submitStatus === 'loading' ? '新增中…' : '新增' }}
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
  height: 600px;
  min-height: 0;
  max-height: 600px;
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

.arl-info {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

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

.arl-info-card {
  flex-shrink: 0;
}

.arl-subtabs {
  display: flex;
  gap: 6px;
  padding: 10px 16px 0;
  flex-shrink: 0;
}

.arl-subtab-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 12px 16px 16px;
}

.arl-subtab {
  display: flex;
  align-items: baseline;
  gap: 5px;
  padding: 5px 10px;
  border: 1px solid var(--line);
  border-radius: 2px;
  background: transparent;
  color: var(--muted);
  font-family: inherit;
  cursor: pointer;

  &:hover {
    color: var(--ink);
  }

  &.is-active {
    color: var(--ink);
    background: var(--wash);
    border-color: var(--ink);
  }
}

.arl-subtab-label {
  font-size: 12px;
  font-weight: 700;
}

.arl-subtab-en {
  font-size: 7px;
  letter-spacing: 0.14em;
}

.arl-info-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
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

.arl-delete {
  flex-shrink: 0;
  color: #b91c1c;
  border: 1px solid #b91c1c;

  &:hover:not(:disabled) {
    background: color-mix(in srgb, #dc2626 12%, var(--paper));
  }

  &.is-confirming {
    background: #b91c1c;
    color: var(--paper);

    &:hover:not(:disabled) {
      background: #991b1b;
    }
  }
}

.arl-settings {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.arl-setting-row {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12px;
}

.arl-setting-label {
  min-width: 0;
  color: var(--ink);
}

.arl-setting-locked {
  font-size: 11px;
  color: var(--muted);
}

.arl-setting-amount {
  width: 96px;
  height: 28px;
  line-height: 26px;
  flex-shrink: 0;
}

.arl-setting-toggle {
  flex-shrink: 0;
  min-width: 56px;
  height: 28px;
  padding: 0 12px;
  border-radius: 2px;
  font-size: 11px;
  font-weight: 700;
  font-family: inherit;
  cursor: pointer;
  border: 1px solid transparent;

  &:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }

  &.is-on {
    background: color-mix(in srgb, #16a34a 14%, var(--paper));
    border-color: #16a34a;
    color: #15803d;
  }

  &.is-off {
    background: color-mix(in srgb, #dc2626 12%, var(--paper));
    border-color: #dc2626;
    color: #b91c1c;
  }
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
