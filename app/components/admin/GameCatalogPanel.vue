<script setup lang="ts">
/**
 * 遊戲管理總閘（見 openspec/changes/add-role-game-perms）：
 * 分「BG 彩票」「遊戲中心」兩區塊列出全部項目，關閉後不分角色（含內建角色）全站都看不到／用不到，
 * 是比 RoleGamesPanel（單一自訂角色的開關）更高一層的全域開關。
 */
import { computed, onMounted, reactive } from 'vue'
import { api, type RoleGamePerm } from '~/services/api'

type AsyncStatus = 'idle' | 'loading' | 'success' | 'error'

const state = reactive({
  status: 'idle' as AsyncStatus,
  error: '',
  games: [] as RoleGamePerm[],
  togglingKey: '' as string
})

const bgGames = computed(() => state.games.filter((g) => g.category === 'bg'))
const retroGames = computed(() => state.games.filter((g) => g.category === 'retro'))

const _actions = {
  fetch: async () => {
    state.status = 'loading'
    state.error = ''
    try {
      const res = await api.admin.gameCatalog()
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
      const res = await api.admin.setGameEnabled(row.category, row.key, next)
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

onMounted(() => _actions.fetch())
</script>

<template>
  <div class="gcp">
    <div v-if="state.status === 'loading'" class="admin-empty gcp-empty">載入中...</div>
    <div v-else-if="state.status === 'error'" class="admin-empty gcp-empty">{{ state.error }}</div>
    <template v-else>
      <p class="gcp-hint">總閘關閉後，不分角色（含 Admin／User／NPC）全站都看不到、也用不到該項目。</p>

      <section class="gcp-section">
        <div class="gcp-section-head">
          <span class="admin-en">BG Lottery</span>
          <span class="gcp-section-title">BG 彩票</span>
        </div>
        <div class="gcp-grid">
          <button v-for="row in bgGames" :key="row.key" type="button" class="gcp-toggle"
            :class="row.enabled ? 'is-on' : 'is-off'" :disabled="!!state.togglingKey"
            :aria-pressed="row.enabled" @click="click.toggle(row)">
            <span class="gcp-toggle-name">{{ row.name }}</span>
            <span class="gcp-toggle-state">{{ row.enabled ? '開啟' : '關閉' }}</span>
          </button>
        </div>
      </section>

      <section class="gcp-section">
        <div class="gcp-section-head">
          <span class="admin-en">Game Center</span>
          <span class="gcp-section-title">遊戲中心</span>
        </div>
        <div class="gcp-grid">
          <button v-for="row in retroGames" :key="row.key" type="button" class="gcp-toggle"
            :class="row.enabled ? 'is-on' : 'is-off'" :disabled="!!state.togglingKey"
            :aria-pressed="row.enabled" @click="click.toggle(row)">
            <span class="gcp-toggle-name">{{ row.name }}</span>
            <span class="gcp-toggle-state">{{ row.enabled ? '開啟' : '關閉' }}</span>
          </button>
        </div>
      </section>

      <p v-if="state.error" class="gcp-error">{{ state.error }}</p>
    </template>
  </div>
</template>

<style scoped lang="scss">
.gcp {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.gcp-empty {
  padding: 24px 0;
}

.gcp-hint {
  margin: 0;
  font-size: 11px;
  line-height: 1.55;
  color: var(--muted);
}

.gcp-section-head {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 8px;
}

.gcp-section-title {
  font-size: 12.5px;
  font-weight: 700;
}

.gcp-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 6px;
}

.gcp-toggle {
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

    .gcp-toggle-state {
      color: #15803d;
    }
  }

  &.is-off {
    background: color-mix(in srgb, #dc2626 12%, var(--paper));
    border-color: #dc2626;

    .gcp-toggle-state {
      color: #b91c1c;
    }
  }
}

.gcp-toggle-name {
  font-size: 11.5px;
  font-weight: 600;
  color: var(--ink);
}

.gcp-toggle-state {
  font-size: 10px;
  font-weight: 700;
}

.gcp-error {
  margin: 0;
  color: #b91c1c;
  font-size: 11px;
}
</style>
