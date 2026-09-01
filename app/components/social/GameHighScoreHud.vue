<script setup lang="ts">
import { computed, onMounted, reactive } from 'vue'
import { api, type RetroLeaderboardEntry } from '~/services/api'

const state = reactive({
  entries: [] as RetroLeaderboardEntry[],
  loading: false,
  error: ''
})

const entries = computed(() => state.entries)

const _actions = {
  fetch: async () => {
    if (state.loading) return
    state.loading = true
    state.error = ''
    try {
      const result = await api.games.retro.leaderboard()
      state.entries = result.entries
    } catch (error: unknown) {
      const data = (error as { data?: { message?: string } })?.data
      state.error = data?.message ?? '排行榜載入失敗'
    } finally {
      state.loading = false
    }
  }
}

onMounted(() => {
  _actions.fetch()
})
</script>

<template>
  <div class="ghs">
    <p v-if="state.loading" class="ghs-status">// 載入中...</p>
    <p v-else-if="state.error" class="ghs-status is-error">{{ state.error }}</p>
    <p v-else-if="entries.length === 0" class="ghs-status">// 尚無紀錄</p>

    <ol v-else class="ghs-list">
      <li v-for="row in entries" :key="`${row.gameKey}-${row.userId}`" class="ghs-row">
        <span class="rank">{{ String(row.rank).padStart(2, '0') }}</span>
        <span class="game">{{ row.gameName }}</span>
        <span class="user">{{ row.userName }}</span>
        <span class="score">{{ row.score.toLocaleString() }}</span>
      </li>
    </ol>
  </div>
</template>

<style scoped lang="scss">
.ghs {
  --accent: #ff3b4a;
  --panel: #150808;
  --line: #3a1518;
  --text: #ffe0e0;
  --text-dim: #c99090;
  --text-mute: #8a5555;

  width: 100%;
  height: 100%;
  min-height: 0;
  flex: 1;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  font-family: "Share Tech Mono", monospace;
  font-size: 12px;
  color: var(--text-dim);
}

.ghs-status {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0;
  padding: 0;
  letter-spacing: 0.12em;
  color: var(--text-mute);

  &.is-error {
    color: #ff7a7a;
  }
}

.ghs-list {
  list-style: none;
  margin: 0;
  padding: 0;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  box-sizing: border-box;
  align-content: start;
}

.ghs-row {
  display: grid;
  grid-template-columns: 28px 1fr minmax(0, 72px) 56px;
  align-items: center;
  gap: 10px;
  min-height: 40px;
  box-sizing: border-box;
  padding: 10px 12px;
  border: 1px solid var(--line);
  background: rgba(255, 59, 74, 0.05);

  &:first-child {
    border-color: rgba(255, 59, 74, 0.45);
    box-shadow: inset 0 0 18px rgba(255, 59, 74, 0.08);
  }

  .rank {
    font-family: "Orbitron", sans-serif;
    font-size: 13px;
    font-weight: 700;
    color: var(--accent);
    letter-spacing: 0.08em;
  }

  .game {
    color: var(--text);
    letter-spacing: 0.1em;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .user {
    color: var(--text-mute);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-align: right;
  }

  .score {
    color: var(--accent);
    font-weight: 700;
    text-align: right;
    letter-spacing: 0.06em;
  }
}
</style>
