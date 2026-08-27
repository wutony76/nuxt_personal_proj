<script setup lang="ts">
/**
 * 遊戲規則說明 dialog：跟 GameRateDialog 一樣是跨五款遊戲共用的殼，但內容（玩法說明／計分方式／
 * 等級對照）每款遊戲完全不同、且是靜態文字，不需要打 API，因此直接由呼叫端（各遊戲頁面）以 props 帶入，
 * 而不是像 GameRateDialog 那樣向 server 拉即時資料。
 */
import { computed } from 'vue'

type LevelRow = { level: number | string; condition: string }

const props = withDefaults(
  defineProps<{
    visible: boolean
    gameName: string
    description: string
    scoreRule: string
    levels: LevelRow[]
    note?: string
    /** 該遊戲頁面自己的主題色（例如 snake 綠、match3-rush 橘），讓 dialog 的邊框/發光跟當前遊戲一致 */
    accentColor?: string
  }>(),
  { accentColor: '#00e5ff' }
)
const emit = defineEmits<{ close: [] }>()

const panelStyle = computed(() => ({ '--accent': props.accentColor }))

const click = {
  close: () => emit('close')
}
</script>

<template>
  <div v-if="visible" class="grud-mask" @click.self="click.close">
    <section class="grud-panel" :style="panelStyle">
      <header class="grud-head">
        <h3 class="grud-title">RULE</h3>
        <button type="button" class="grud-close" aria-label="關閉" @click="click.close">×</button>
      </header>

      <div class="grud-body">
        <p class="grud-game-name">{{ gameName }}</p>
        <p class="grud-desc">{{ description }}</p>

        <div class="grud-section-title">計分方式</div>
        <p class="grud-desc">{{ scoreRule }}</p>

        <div class="grud-section-title">等級對照</div>
        <div class="grud-levels">
          <div v-for="row in levels" :key="row.level" class="grud-level-row">
            <span class="lv">{{ typeof row.level === 'number' ? `Lv.${row.level}` : row.level }}</span>
            <span class="cond">{{ row.condition }}</span>
          </div>
        </div>

        <p v-if="note" class="grud-note">{{ note }}</p>
      </div>
    </section>
  </div>
</template>

<style scoped lang="scss">
/* 比照 GameRateDialog.vue：不依賴外層頁面的 CSS 變數，但透過 accentColor prop 讓外框/發光跟隨當前遊戲主題色 */
.grud-mask {
  position: fixed;
  inset: 0;
  z-index: 50;
  background: rgba(2, 4, 10, 0.75);
  backdrop-filter: blur(3px);
  display: grid;
  place-items: center;
  padding: 20px;
  animation: grudFadeIn 0.2s ease-out both;
}

.grud-panel {
  width: min(400px, 100%);
  max-height: min(560px, 90vh);
  overflow-y: auto;
  background: #0d1326;
  border: 1px solid var(--accent, #00e5ff);
  box-shadow: 0 0 30px color-mix(in srgb, var(--accent, #00e5ff) 25%, transparent);
  clip-path: polygon(14px 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%, 0 14px);
  font-family: "Share Tech Mono", monospace;
  animation: grudPopIn 0.22s ease-out both;

  /* 捲軸改成 Cyberpunk HUD 風格，比照 game-hall.vue／專案既有的自訂捲軸慣例，顏色跟隨當前遊戲主題色 */
  scrollbar-width: thin;
  scrollbar-color: var(--accent, #00e5ff) #0d1326;

  &::-webkit-scrollbar {
    width: 8px;
  }

  &::-webkit-scrollbar-track {
    background: #0d1326;
  }

  &::-webkit-scrollbar-thumb {
    background: var(--accent, #00e5ff);
    border-radius: 999px;
    border: 2px solid #0d1326;
    box-shadow: 0 0 6px color-mix(in srgb, var(--accent, #00e5ff) 50%, transparent);
  }

  &::-webkit-scrollbar-thumb:hover {
    background: color-mix(in srgb, var(--accent, #00e5ff) 70%, white);
  }
}

.grud-head {
  position: sticky;
  top: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 18px 12px;
  border-bottom: 1px solid #1c2a55;
  background: #0d1326;

  .grud-title {
    font-family: "Orbitron", sans-serif;
    font-weight: 700;
    font-size: 14px;
    letter-spacing: 0.14em;
    color: #fff;
    text-shadow: 0 0 10px color-mix(in srgb, var(--accent, #00e5ff) 40%, transparent);
  }

  .grud-close {
    border: none;
    background: none;
    color: #7891b8;
    font-size: 20px;
    line-height: 1;
    cursor: pointer;

    &:hover {
      color: #fff;
    }
  }
}

.grud-body {
  padding: 16px 18px 18px;
}

.grud-game-name {
  margin: 0 0 8px;
  font-family: "Orbitron", sans-serif;
  font-size: 12px;
  letter-spacing: 0.12em;
  color: var(--accent, #00e5ff);
}

.grud-desc {
  margin: 0 0 14px;
  font-size: 12px;
  line-height: 1.7;
  color: #cfe8ff;
}

.grud-section-title {
  margin-bottom: 8px;
  font-size: 11px;
  letter-spacing: 0.14em;
  color: #ffb627;
  font-weight: 700;
}

.grud-levels {
  border: 1px solid #1c2a55;
  margin-bottom: 6px;
}

.grud-level-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 7px 12px;
  font-size: 12px;
  color: #cfe8ff;
  border-bottom: 1px solid #15203f;

  &:last-child {
    border-bottom: none;
  }

  .lv {
    color: #ff2e88;
    font-weight: 700;
    letter-spacing: 0.06em;
  }

  .cond {
    color: #fff;
  }
}

.grud-note {
  margin: 10px 0 0;
  font-size: 11px;
  line-height: 1.6;
  color: #7891b8;
}

@keyframes grudFadeIn {
  from {
    opacity: 0;
  }

  to {
    opacity: 1;
  }
}

@keyframes grudPopIn {
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
