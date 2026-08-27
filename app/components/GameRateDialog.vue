<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import { useAuth } from '~/composables/useAuth'
import { api, type RetroGameKey, type RetroGameRateInfo } from '~/services/api'

const props = defineProps<{
  visible: boolean
  gameKey: RetroGameKey
  gameName?: string
}>()
const emit = defineEmits<{ close: [] }>()

const { isLoggedIn, init: initAuth } = useAuth()

type AsyncStatus = 'idle' | 'loading' | 'success' | 'error'

const state = reactive({
  status: 'idle' as AsyncStatus,
  rate: null as RetroGameRateInfo | null
})

/** 私有工具方法：兌換範例試算 */
const _handlers = {
  exampleCoin: (score: number): number => {
    if (!state.rate) return 0
    return Math.min(Math.floor(score * state.rate.coinRate), state.rate.coinCapPerRun)
  }
}

const _actions = {
  /** 三段狀態：loading → success（拿到該遊戲的兌換比）／error */
  load: async () => {
    if (state.status === 'loading') return
    state.status = 'loading'
    try {
      await initAuth()
      const res = await api.games.retro.rates()
      state.rate = res.rates.find((r) => r.key === props.gameKey) ?? null
      state.status = state.rate ? 'success' : 'error'
    } catch {
      state.status = 'error'
    }
  }
}

watch(
  () => props.visible,
  (visible) => {
    if (visible) _actions.load()
  },
  { immediate: true }
)

const click = {
  close: () => emit('close')
}

const displayName = computed(() => props.gameName ?? state.rate?.name ?? '')
</script>

<template>
  <div v-if="visible" class="grd-mask" @click.self="click.close">
    <section class="grd-panel">
      <header class="grd-head">
        <h3 class="grd-title">COIN CONVERT</h3>
        <button type="button" class="grd-close" aria-label="關閉" @click="click.close">×</button>
      </header>

      <div class="grd-body">
        <div v-if="state.status === 'loading'" class="grd-empty">載入中...</div>
        <div v-else-if="state.status === 'error'" class="grd-empty">載入失敗，請稍後再試</div>
        <template v-else-if="state.rate">
          <p class="grd-game-name">{{ displayName }}</p>

          <div class="grd-rows">
            <div class="grd-row">
              <span>兌換倍率</span>
              <b>分數 × {{ state.rate.coinRate }}</b>
            </div>
            <div class="grd-row">
              <span>範例</span>
              <b>100 分 → {{ _handlers.exampleCoin(100) }} coin</b>
            </div>
            <div class="grd-row">
              <span>單局上限</span>
              <b>{{ state.rate.coinCapPerRun }} coin</b>
            </div>
            <div class="grd-row">
              <span>每日上限</span>
              <b>{{ state.rate.coinDailyCap }} coin</b>
            </div>
          </div>

          <div class="grd-identity" :class="{ guest: !isLoggedIn }">
            <p v-if="isLoggedIn">已登入，結算時會依上述比例自動兌換 coin。</p>
            <template v-else>
              <p>登入後結算才會依此比例兌換 coin，訪客紀錄僅保存在本機、不會兌換。</p>
              <NuxtLink to="/login" class="grd-login-btn">前往登入</NuxtLink>
            </template>
          </div>
        </template>
      </div>
    </section>
  </div>
</template>

<style scoped lang="scss">
/*
 * 這是跨五款遊戲共用的元件（每款遊戲頁各自的視覺主題都不同：snake 綠、racing/tetriminos 各自配色、
 * match3-rush 暖橘、match3-classic 冷紫），因此不依賴任何外層頁面的 CSS 變數，
 * 自成一套獨立的 Cyberpunk HUD 配色，確保在任何一款遊戲頁面掛載時視覺都一致。
 */
.grd-mask {
  position: fixed;
  inset: 0;
  z-index: 50;
  background: rgba(2, 4, 10, 0.75);
  backdrop-filter: blur(3px);
  display: grid;
  place-items: center;
  padding: 20px;
  animation: grdFadeIn 0.2s ease-out both;
}

.grd-panel {
  width: min(380px, 100%);
  background: #0d1326;
  border: 1px solid #00e5ff;
  box-shadow: 0 0 30px rgba(0, 229, 255, 0.25);
  clip-path: polygon(14px 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%, 0 14px);
  font-family: "Share Tech Mono", monospace;
  animation: grdPopIn 0.22s ease-out both;
}

.grd-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 18px 12px;
  border-bottom: 1px solid #1c2a55;

  .grd-title {
    font-family: "Orbitron", sans-serif;
    font-weight: 700;
    font-size: 14px;
    letter-spacing: 0.14em;
    color: #fff;
    text-shadow: 0 0 10px rgba(0, 229, 255, 0.4);
  }

  .grd-close {
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

.grd-body {
  padding: 16px 18px 18px;
}

.grd-empty {
  padding: 24px 0;
  text-align: center;
  color: #4b5e85;
  font-size: 12px;
}

.grd-game-name {
  margin: 0 0 10px;
  font-family: "Orbitron", sans-serif;
  font-size: 12px;
  letter-spacing: 0.12em;
  color: #00e5ff;
}

.grd-rows {
  border: 1px solid #1c2a55;
}

.grd-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  font-size: 12px;
  color: #cfe8ff;
  border-bottom: 1px solid #15203f;

  &:last-child {
    border-bottom: none;
  }

  span {
    color: #7891b8;
    letter-spacing: 0.06em;
  }

  b {
    color: #fff;
    font-weight: 700;
  }
}

.grd-identity {
  margin-top: 14px;
  padding: 10px 12px;
  border: 1px solid #1c2a55;
  background: rgba(0, 229, 255, 0.04);

  p {
    margin: 0;
    font-size: 11.5px;
    line-height: 1.6;
    color: #7891b8;
  }

  &.guest {
    border-color: #ff2e88;
    background: rgba(255, 46, 136, 0.06);
  }
}

.grd-login-btn {
  margin-top: 10px;
  display: inline-flex;
  height: 30px;
  padding: 0 16px;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  letter-spacing: 0.14em;
  text-decoration: none;
  color: #02141a;
  background: #ff2e88;
  font-weight: 700;
  clip-path: polygon(8px 0, 100% 0, calc(100% - 8px) 100%, 0 100%);

  &:hover {
    background: #ff7ab8;
  }
}

@keyframes grdFadeIn {
  from {
    opacity: 0;
  }

  to {
    opacity: 1;
  }
}

@keyframes grdPopIn {
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
