<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import { useGameHistory } from '~/composables/useGameHistory'
import type { RetroGameKey } from '~/services/api'

const props = defineProps<{
  visible: boolean
  title?: string
  width?: string
}>()
const emit = defineEmits<{ close: [] }>()

const { records, statsByGame, identityLabel, loading, ensureLoaded, actions } = useGameHistory()

type FilterKey = 'all' | RetroGameKey
const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: 'all', label: 'ALL' },
  { key: 'snake', label: 'SNAKE' },
  { key: 'racing', label: 'RACING' },
  { key: 'tetriminos', label: 'TETRIMINOS' },
  { key: 'match3rush', label: 'MATCH3 RUSH' },
  { key: 'match3classic', label: 'MATCH3 CLASSIC' }
]
const GAME_KEYS: RetroGameKey[] = ['snake', 'racing', 'tetriminos', 'match3rush', 'match3classic']
const GAME_NAME: Record<RetroGameKey, string> = {
  snake: 'SNAKE',
  racing: 'RACING',
  tetriminos: 'TETRIMINOS',
  match3rush: 'MATCH3 RUSH',
  match3classic: 'MATCH3 CLASSIC'
}

const ui = reactive({
  activeFilter: 'all' as FilterKey,
  confirmClearOpen: false
})

watch(
  () => props.visible,
  (visible) => {
    if (visible) ensureLoaded()
    else ui.confirmClearOpen = false
  },
  { immediate: true }
)

const filteredRecords = computed(() =>
  ui.activeFilter === 'all' ? records.value : records.value.filter((r) => r.gameKey === ui.activeFilter)
)

const pad2 = (value: number) => String(value).padStart(2, '0')
const formatPlayedAt = (iso: string) => {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return `${date.getMonth() + 1}/${pad2(date.getDate())} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`
}

const click = {
  filter: (key: FilterKey) => {
    ui.activeFilter = key
  },
  close: () => emit('close'),
  openClearConfirm: () => {
    ui.confirmClearOpen = true
  },
  cancelClear: () => {
    ui.confirmClearOpen = false
  },
  confirmClear: async () => {
    await actions.clear()
    ui.confirmClearOpen = false
  }
}
</script>

<template>
  <div v-if="visible" class="ghd-mask" @click.self="click.close()">
    <section class="ghd-panel" :style="width ? `width: ${width}` : undefined">
      <header class="ghd-head">
        <div class="ghd-title-wrap">
          <h3 class="ghd-title">{{ title ?? '遊戲紀錄' }}</h3>
          <div class="ghd-identity">{{ identityLabel }}</div>
        </div>
        <button type="button" class="ghd-close" aria-label="關閉" @click="click.close()">×</button>
      </header>

      <nav class="ghd-tabs">
        <button v-for="f in FILTERS" :key="f.key" type="button" class="ghd-tab"
          :class="{ active: ui.activeFilter === f.key }" @click="click.filter(f.key)">
          {{ f.label }}
        </button>
      </nav>

      <div class="ghd-summary">
        <div v-for="key in GAME_KEYS" :key="key" class="ghd-stat">
          <div class="k">{{ GAME_NAME[key] }}</div>
          <div class="v">{{ statsByGame[key]?.best ?? 0 }}</div>
          <div class="c">{{ statsByGame[key]?.count ?? 0 }} 局</div>
        </div>
      </div>

      <div class="ghd-list">
        <div v-if="loading" class="ghd-empty">載入中...</div>
        <div v-else-if="filteredRecords.length === 0" class="ghd-empty">尚無遊戲紀錄</div>
        <div v-for="r in filteredRecords" :key="r.id" class="ghd-row">
          <span class="game">{{ GAME_NAME[r.gameKey] }}</span>
          <span class="score">{{ r.score }}</span>
          <span class="level">{{ r.level !== undefined ? `Lv.${r.level}` : '' }}</span>
          <span class="time">{{ formatPlayedAt(r.playedAt) }}</span>
        </div>
      </div>

      <footer class="ghd-footer">
        <button type="button" class="ghd-clear" :disabled="records.length === 0" @click="click.openClearConfirm()">清除紀錄</button>
      </footer>

      <div v-if="ui.confirmClearOpen" class="ghd-confirm-mask" @click.self="click.cancelClear()">
        <div class="ghd-confirm-box">
          <div class="ghd-confirm-title">確認清除</div>
          <p class="ghd-confirm-text">確定要清除所有遊戲紀錄嗎？此動作無法復原。</p>
          <div class="ghd-confirm-actions">
            <button type="button" class="ghd-confirm-btn cancel" @click="click.cancelClear()">取消</button>
            <button type="button" class="ghd-confirm-btn ok" @click="click.confirmClear()">確認清除</button>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped lang="scss">
/* 沿用 game-hall.vue（.ops-hall）已定義的 CSS 變數，本元件恆為其子孫節點，不重新宣告一份 */
.ghd-mask {
  position: fixed;
  inset: 0;
  z-index: 50;
  background: rgba(2, 4, 10, 0.7);
  backdrop-filter: blur(3px);
  display: grid;
  place-items: center;
  padding: 20px;
  animation: ghdFadeIn 0.2s ease-out both;
}

.ghd-panel {
  position: relative;
  width: min(640px, 100%);
  max-height: min(720px, 90vh);
  background: var(--panel);
  border: 1px solid var(--cyan);
  box-shadow: 0 0 30px rgba(0, 229, 255, 0.25);
  clip-path: polygon(14px 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%, 0 14px);
  display: flex;
  flex-direction: column;
  font-family: "Share Tech Mono", monospace;
  animation: ghdPopIn 0.22s ease-out both;
}

.ghd-confirm-mask {
  position: absolute;
  inset: 0;
  z-index: 1;
  background: rgba(2, 4, 10, 0.82);
  backdrop-filter: blur(2px);
  display: grid;
  place-items: center;
  padding: 20px;
  animation: ghdFadeIn 0.15s ease-out both;
}

.ghd-confirm-box {
  width: min(340px, 100%);
  background: var(--panel);
  border: 1px solid var(--magenta);
  box-shadow: 0 0 24px rgba(255, 46, 136, 0.3);
  clip-path: polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px);
  padding: 18px;
  text-align: center;

  .ghd-confirm-title {
    font-family: "Orbitron", sans-serif;
    font-weight: 700;
    font-size: 13px;
    letter-spacing: 0.14em;
    color: var(--magenta-soft);
    text-shadow: 0 0 8px rgba(255, 46, 136, 0.5);
  }

  .ghd-confirm-text {
    margin-top: 10px;
    font-size: 12px;
    line-height: 1.6;
    color: var(--text-dim);
  }

  .ghd-confirm-actions {
    margin-top: 16px;
    display: flex;
    gap: 10px;
  }

  .ghd-confirm-btn {
    flex: 1;
    height: 32px;
    font-size: 11px;
    letter-spacing: 0.14em;
    cursor: pointer;
    border: 1px solid var(--line);
    background: rgba(0, 229, 255, 0.03);
    color: var(--text-dim);

    &:hover {
      color: #fff;
    }

    &.ok {
      border-color: var(--magenta);
      background: rgba(255, 46, 136, 0.1);
      color: var(--magenta-soft);
      font-weight: 700;

      &:hover {
        background: rgba(255, 46, 136, 0.2);
      }
    }
  }
}

.ghd-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 18px 20px 14px;
  border-bottom: 1px solid var(--line);

  .ghd-title-wrap {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .ghd-title {
    font-family: "Orbitron", sans-serif;
    font-weight: 700;
    font-size: 16px;
    letter-spacing: 0.16em;
    color: #fff;
    text-shadow: 0 0 10px rgba(0, 229, 255, 0.4);
  }

  .ghd-identity {
    font-size: 11px;
    letter-spacing: 0.1em;
    color: var(--text-mute);
  }

  .ghd-close {
    border: none;
    background: none;
    color: var(--text-dim);
    font-size: 20px;
    line-height: 1;
    cursor: pointer;

    &:hover {
      color: #fff;
    }
  }
}

.ghd-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 10px 20px 0;

  .ghd-tab {
    padding: 6px 14px;
    font-size: 11px;
    letter-spacing: 0.12em;
    color: var(--text-dim);
    border: 1px solid var(--line);
    background: rgba(0, 229, 255, 0.03);
    cursor: pointer;

    &:hover {
      color: #fff;
    }

    &.active {
      color: #02131a;
      background: var(--cyan);
      border-color: var(--cyan);
      font-weight: 700;
    }
  }
}

.ghd-summary {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  padding: 14px 20px 0;

  .ghd-stat {
    border: 1px solid var(--line);
    background: rgba(0, 229, 255, 0.04);
    padding: 8px 10px;
    text-align: center;

    .k {
      font-size: 10px;
      letter-spacing: 0.12em;
      color: var(--text-mute);
    }

    .v {
      margin-top: 4px;
      font-family: "Orbitron", sans-serif;
      font-size: 18px;
      color: var(--cyan);
    }

    .c {
      margin-top: 2px;
      font-size: 10px;
      color: var(--text-dim);
    }
  }
}

.ghd-list {
  flex: 1;
  overflow-y: auto;
  margin: 14px 20px 0;
  border: 1px solid var(--line);
  min-height: 120px;

  /* 捲軸改成 Cyberpunk HUD 風格，比照 game-hall.vue／專案既有的自訂捲軸慣例 */
  scrollbar-width: thin;
  scrollbar-color: var(--cyan) var(--panel);

  &::-webkit-scrollbar {
    width: 8px;
  }

  &::-webkit-scrollbar-track {
    background: var(--panel);
  }

  &::-webkit-scrollbar-thumb {
    background: var(--cyan);
    border-radius: 999px;
    border: 2px solid var(--panel);
  }

  &::-webkit-scrollbar-thumb:hover {
    background: var(--cyan-soft);
  }
}

.ghd-empty {
  padding: 30px 10px;
  text-align: center;
  color: var(--text-mute);
  font-size: 12px;
}

.ghd-row {
  display: grid;
  grid-template-columns: 108px 1fr 60px 90px;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  font-size: 12px;
  color: var(--text);
  border-bottom: 1px solid var(--line-soft);

  &:last-child {
    border-bottom: none;
  }

  .game {
    color: var(--text-dim);
    letter-spacing: 0.04em;
    font-size: 10.5px;
  }

  .score {
    font-family: "Orbitron", sans-serif;
    color: #fff;
  }

  .level {
    color: var(--amber);
    font-size: 11px;
  }

  .time {
    color: var(--text-mute);
    font-size: 11px;
    text-align: right;
  }
}

.ghd-footer {
  padding: 14px 20px 18px;
  display: flex;
  justify-content: flex-end;
}

.ghd-clear {
  height: 32px;
  padding: 0 18px;
  font-size: 11px;
  letter-spacing: 0.14em;
  border: 1px solid var(--magenta);
  background: rgba(255, 46, 136, 0.06);
  color: var(--magenta-soft);
  cursor: pointer;

  &:hover:not(:disabled) {
    background: rgba(255, 46, 136, 0.16);
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
}

@keyframes ghdFadeIn {
  from {
    opacity: 0;
  }

  to {
    opacity: 1;
  }
}

@keyframes ghdPopIn {
  from {
    opacity: 0;
    transform: translateY(12px) scale(0.98);
  }

  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
</style>
