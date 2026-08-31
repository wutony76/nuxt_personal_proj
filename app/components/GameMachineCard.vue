<script setup lang="ts">
import { computed } from 'vue'

type GameSlot = {
  id: number
  name: string
  description: string
  status: 'open' | 'coming'
  path?: string
}

const props = defineProps<{
  game: GameSlot
}>()

const cuteIcon = computed(() => {
  const name = props.game.name.toUpperCase()
  if (name.includes('SNAKE')) return '🐍'
  if (name.includes('RACING')) return '🏎️'
  if (name.includes('TETRIMINOS')) return '🧩'
  if (name.includes('MATCH3')) return '🍬'
  if (name.includes('PONG')) return '🏓'
  if (name.includes('RUNNER')) return '🏃'
  if (name.includes('SPACE SHOOTER')) return '🚀'
  if (name.includes('MINESWEEPER')) return '💣'
  if (name.includes('PAC-MAN')) return '👻'
  return '🎮'
})
</script>

<template>
  <article class="game-card" :class="game.status === 'open' ? 'is-open' : 'is-coming'">
    <div class="gc-head">
      <div class="av">{{ cuteIcon }}</div>
      <div class="id-tag">#{{ String(game.id).padStart(2, '0') }}</div>
    </div>
    <h3 class="gc-name">{{ game.name }}</h3>
    <span class="badge" :class="game.status === 'open' ? 'badge-open' : 'badge-coming'">
      {{ game.status === 'open' ? '開放中' : '準備中' }}
    </span>
    <p class="gc-desc">{{ game.description }}</p>

    <NuxtLink v-if="game.status === 'open' && game.path" :to="game.path" class="gc-btn gc-btn-primary">
      START
    </NuxtLink>
    <button v-else type="button" class="gc-btn gc-btn-locked" disabled>
      LOCKED
    </button>
  </article>
</template>

<style scoped lang="scss">
/* 版面比照 game-hall.vue 的清單風參考稿（Cyberpunk.html）：切角面板＋霓虹描邊＋徽章狀態 */
.game-card {
  position: relative;
  background: rgba(13, 19, 38, 0.6);
  border: 1px solid var(--line, #1c2a55);
  clip-path: polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  transition: border-color 0.15s, box-shadow 0.15s;
  animation: fadeSlideUp 0.45s ease-out var(--enter-delay, 0.1s) both;

  &.is-open {
    &:hover {
      border-color: var(--cyan, #00e5ff);
      box-shadow: 0 0 14px rgba(0, 229, 255, 0.35);
    }
  }

  &.is-coming {
    opacity: 0.7;
  }
}

.gc-head {
  display: flex;
  align-items: center;
  justify-content: space-between;

  .av {
    width: 34px;
    height: 34px;
    display: grid;
    place-items: center;
    background: rgba(0, 229, 255, 0.08);
    border: 1px solid var(--line, #1c2a55);
    font-size: 16px;
  }

  .id-tag {
    color: var(--text-mute, #4b5e85);
    font-size: 10px;
    letter-spacing: 0.14em;
    font-family: "Share Tech Mono", monospace;
  }
}

.gc-name {
  font-family: "Orbitron", sans-serif;
  font-weight: 700;
  font-size: 14px;
  letter-spacing: 0.08em;
  color: #fff;
}

.badge {
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 9px;
  font-size: 10px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  border: 1px solid;
  font-weight: 700;
  font-family: "Share Tech Mono", monospace;

  &::before {
    content: '';
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: currentColor;
    box-shadow: 0 0 6px currentColor;
  }
}

.badge-open {
  color: var(--green, #39ffa0);
  border-color: rgba(57, 255, 160, 0.45);
  background: rgba(57, 255, 160, 0.07);
}

.badge-coming {
  color: var(--amber, #ffb627);
  border-color: rgba(255, 182, 39, 0.5);
  background: rgba(255, 182, 39, 0.08);
}

.gc-desc {
  min-height: 34px;
  font-size: 11.5px;
  line-height: 1.5;
  color: var(--text-dim, #7891b8);
  font-family: "Share Tech Mono", monospace;
}

.gc-btn {
  margin-top: auto;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  letter-spacing: 0.18em;
  font-family: "Share Tech Mono", monospace;
  text-decoration: none;
  cursor: pointer;
  border: none;
}

.gc-btn-primary {
  background: var(--cyan, #00e5ff);
  color: #02141a;
  font-weight: 700;
  clip-path: polygon(8px 0, 100% 0, calc(100% - 8px) 100%, 0 100%);
  box-shadow: 0 0 10px rgba(0, 229, 255, 0.4);

  &:hover {
    background: var(--cyan-soft, #5cf3ff);
    box-shadow: 0 0 16px rgba(0, 229, 255, 0.65);
  }
}

.gc-btn-locked {
  background: transparent;
  border: 1px solid var(--line, #1c2a55);
  color: var(--text-mute, #4b5e85);
  cursor: not-allowed;
}

/* 比照 game-hall.vue 的進場動畫慣例，卡片各自依 --enter-delay 依序浮現 */
@keyframes fadeSlideUp {
  from {
    transform: translateY(40px);
    opacity: 0;
  }

  to {
    transform: translateY(0);
    opacity: 1;
  }
}
</style>
