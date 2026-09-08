<script setup lang="ts">
/**
 * 自訂角色的遊戲／盤口開關（見 openspec/changes/add-role-game-perms）：
 * 分「BG 彩票」「遊戲中心」兩區塊列出全部項目，可即時切換開關。
 * 只給自訂角色用，內建角色不顯示此面板（見 RoleList.vue 的 v-if）。
 */
import { computed, reactive, watch } from 'vue'
import { api, type RoleGamePerm } from '~/services/api'

type AsyncStatus = 'idle' | 'loading' | 'success' | 'error'

const props = defineProps<{
  roleId: string
}>()

const state = reactive({
  status: 'idle' as AsyncStatus,
  error: '',
  games: [] as RoleGamePerm[],
  togglingKey: '' as string
})

const bgGames = computed(() => state.games.filter((g) => g.category === 'bg'))
const retroGames = computed(() => state.games.filter((g) => g.category === 'retro'))

const _actions = {
  fetch: async (roleId: string) => {
    if (!roleId) return
    state.status = 'loading'
    state.error = ''
    try {
      const res = await api.admin.roleGames(roleId)
      state.games = res.games
      state.status = 'success'
    } catch (e: unknown) {
      state.error = (e as { data?: { message?: string }; message?: string })?.data?.message
        ?? (e as { message?: string })?.message
        ?? '載入失敗'
      state.status = 'error'
    }
  },
  toggle: async (row: RoleGamePerm) => {
    if (state.togglingKey) return
    const compositeKey = `${row.category}:${row.key}`
    state.togglingKey = compositeKey
    const next = !row.enabled
    try {
      const res = await api.admin.setRoleGame(props.roleId, row.category, row.key, next)
      state.games = res.games
    } catch (e: unknown) {
      state.error = (e as { data?: { message?: string }; message?: string })?.data?.message
        ?? (e as { message?: string })?.message
        ?? '更新失敗'
    } finally {
      state.togglingKey = ''
    }
  }
}

const click = {
  toggle: (row: RoleGamePerm) => _actions.toggle(row)
}

watch(() => props.roleId, (roleId) => _actions.fetch(roleId), { immediate: true })
</script>

<template>
  <div class="rgp">
    <div v-if="state.status === 'loading'" class="admin-empty rgp-empty">載入中...</div>
    <div v-else-if="state.status === 'error'" class="admin-empty rgp-empty">{{ state.error }}</div>
    <template v-else>
      <section class="rgp-section">
        <div class="rgp-section-head">
          <span class="admin-en">BG Lottery</span>
          <span class="rgp-section-title">BG 彩票</span>
        </div>
        <div class="rgp-grid">
          <button v-for="row in bgGames" :key="row.key" type="button" class="rgp-toggle"
            :class="row.enabled ? 'is-on' : 'is-off'" :disabled="!!state.togglingKey"
            :aria-pressed="row.enabled" @click="click.toggle(row)">
            <span class="rgp-toggle-name">{{ row.name }}</span>
            <span class="rgp-toggle-state">{{ row.enabled ? '開啟' : '關閉' }}</span>
          </button>
        </div>
      </section>

      <section class="rgp-section">
        <div class="rgp-section-head">
          <span class="admin-en">Game Center</span>
          <span class="rgp-section-title">遊戲中心</span>
        </div>
        <div class="rgp-grid">
          <button v-for="row in retroGames" :key="row.key" type="button" class="rgp-toggle"
            :class="row.enabled ? 'is-on' : 'is-off'" :disabled="!!state.togglingKey"
            :aria-pressed="row.enabled" @click="click.toggle(row)">
            <span class="rgp-toggle-name">{{ row.name }}</span>
            <span class="rgp-toggle-state">{{ row.enabled ? '開啟' : '關閉' }}</span>
          </button>
        </div>
      </section>

      <p v-if="state.error" class="rgp-error">{{ state.error }}</p>
    </template>
  </div>
</template>

<style scoped lang="scss">
.rgp {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.rgp-empty {
  padding: 24px 0;
}

.rgp-section-head {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 8px;
}

.rgp-section-title {
  font-size: 12.5px;
  font-weight: 700;
}

.rgp-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 6px;
}

.rgp-toggle {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 3px;
  padding: 6px 8px;
  border: 1px solid transparent;
  border-radius: 2px;
  background: var(--wash);
  font-family: inherit;
  cursor: pointer;
  text-align: left;

  &:disabled {
    cursor: default;
    opacity: 0.6;
  }

  &.is-on {
    background: color-mix(in srgb, #16a34a 14%, var(--paper));
    border-color: #16a34a;

    .rgp-toggle-state {
      color: #15803d;
    }
  }

  &.is-off {
    background: color-mix(in srgb, #dc2626 12%, var(--paper));
    border-color: #dc2626;

    .rgp-toggle-state {
      color: #b91c1c;
    }
  }
}

.rgp-toggle-name {
  font-size: 11.5px;
  font-weight: 600;
  color: var(--ink);
}

.rgp-toggle-state {
  font-size: 10px;
  font-weight: 700;
}

.rgp-error {
  margin: 0;
  color: #b91c1c;
  font-size: 11px;
}
</style>
