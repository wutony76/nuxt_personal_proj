<script setup lang="ts">
import { defineAsyncComponent, ref } from 'vue'

type HallTab = 'lobby' | 'lottery' | 'taiwan'
type GameSlot = {
  id: number
  name: string
  description: string
  status: 'open' | 'coming'
  path?: string
}

const activeTab = ref<HallTab>('lobby')
const GameMachineCard = defineAsyncComponent(() => import('../components/GameMachineCard.vue'))

const gameSlots = ref<GameSlot[]>([
  { id: 1, name: 'SNAKE', description: '經典像素貪吃蛇遊戲', status: 'open', path: '/game/snake' },
  { id: 2, name: 'RACING', description: '經典像素閃避賽車，可以跑多遠', status: 'open', path: '/game/racing' },
  { id: 3, name: '遊戲 03', description: '放你的第三個遊戲', status: 'coming' },
  { id: 4, name: '遊戲 04', description: '預留遊戲位置', status: 'coming' },
  { id: 5, name: '遊戲 05', description: '預留遊戲位置', status: 'coming' },
  { id: 6, name: '遊戲 06', description: '預留遊戲位置', status: 'coming' },
  { id: 7, name: '遊戲 07', description: '預留遊戲位置', status: 'coming' },
  { id: 8, name: '遊戲 08', description: '預留遊戲位置', status: 'coming' },
  { id: 9, name: '遊戲 09', description: '預留遊戲位置', status: 'coming' }
])
</script>

<template>
  <main class="arcade-hall min-h-screen w-full px-4 pb-16 pt-6 md:px-6">
    <i class="party-light light-left" />
    <i class="party-light light-right" />
    <i class="hud-grid" />

    <section class="hero-panel rounded-3xl border border-fuchsia-400/40 bg-slate-900/80 p-5 shadow-sm">
      <h1 class="hero-title text-2xl font-black text-white">遊戲中心 GAME HALL</h1>
      <div class="mt-4 flex flex-wrap gap-2">
        <button type="button" class="tab-btn rounded-xl px-3 py-1.5 text-sm font-semibold"
          :class="activeTab === 'lobby' ? 'is-active' : ''" @click="activeTab = 'lobby'">
          遊戲大廳
        </button>
        <button type="button" class="tab-btn rounded-xl px-3 py-1.5 text-sm font-semibold"
          :class="activeTab === 'lottery' ? 'is-active' : ''" @click="activeTab = 'lottery'">
          彩票大廳
        </button>
        <button type="button" class="tab-btn rounded-xl px-3 py-1.5 text-sm font-semibold"
          :class="activeTab === 'taiwan' ? 'is-active' : ''" @click="activeTab = 'taiwan'">
          台彩大廳
        </button>
      </div>
    </section>

    <section v-if="activeTab === 'lobby'"
      class="tech-panel mt-4 rounded-3xl border border-cyan-400/30 bg-slate-950/75 p-6">
      <div class="mb-4">
        <h2 class="text-xl font-bold text-cyan-200">遊戲機台</h2>
        <p class="mt-1 text-sm text-slate-300">熱鬧遊戲廳機台區，點擊 START 立即進入。</p>
      </div>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <GameMachineCard v-for="slot in gameSlots" :key="slot.id" :game="slot" />
      </div>
    </section>

    <section v-if="activeTab === 'lottery'" class="mt-4">
      <div class="tech-panel rounded-3xl border border-fuchsia-400/40 bg-slate-950/75 p-6">
        <h2 class="text-xl font-bold text-fuchsia-200">彩票大廳</h2>
        <p class="mt-2 text-slate-300">可下注功能已整合完成，請進入專頁使用。</p>
        <NuxtLink to="/lottery-hall"
          class="mt-4 inline-block rounded-lg bg-fuchsia-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-fuchsia-400">
          前往彩票大廳
        </NuxtLink>
      </div>
    </section>

    <section v-if="activeTab === 'taiwan'" class="mt-4">
      <div class="tech-panel rounded-3xl border border-sky-400/40 bg-slate-950/75 p-6">
        <h2 class="text-xl font-bold text-sky-200">台彩大廳</h2>
        <p class="mt-2 text-slate-300">台彩資訊與玩法說明請進入專頁查看。</p>
        <NuxtLink to="/taiwan-lottery-hall"
          class="mt-4 inline-block rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-400">
          前往台彩大廳
        </NuxtLink>
      </div>
    </section>
  </main>
</template>

<style scoped lang="scss">
.arcade-hall {
  position: relative;
  isolation: isolate;

  &::before {
    content: '';
    position: absolute;
    inset: -20px 0 -40px;
    z-index: -1;
    border-radius: 28px;
    background: radial-gradient(circle at 20% 0%, rgba(168, 85, 247, 0.22), transparent 35%),
      radial-gradient(circle at 85% 20%, rgba(14, 165, 233, 0.22), transparent 38%),
      radial-gradient(circle at 50% 100%, rgba(34, 197, 94, 0.16), transparent 40%),
      linear-gradient(180deg, #140a2a 0%, #090f24 55%, #061015 100%);
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.05);
  }

  &::after {
    content: '';
    position: absolute;
    inset: 0;
    z-index: -1;
    pointer-events: none;
    background-image: linear-gradient(135deg,
        rgba(56, 189, 248, 0.08) 0,
        rgba(56, 189, 248, 0.08) 1px,
        transparent 1px,
        transparent 32px);
    opacity: 0.26;
    animation: circuit-drift 18s linear infinite;
  }
}

.hud-grid {
  position: absolute;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  background-image: linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
  background-size: 24px 24px;
  mask-image: radial-gradient(circle at center, rgba(0, 0, 0, 0.7), transparent 86%);
  animation: grid-pulse 6s ease-in-out infinite;
}

.hero-panel {
  position: relative;
  backdrop-filter: blur(4px);
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: linear-gradient(100deg,
        transparent 25%,
        rgba(255, 255, 255, 0.18) 50%,
        transparent 75%);
    transform: translateX(-130%);
    animation: panel-sweep 5.4s ease-in-out infinite;
  }
}

.tech-panel {
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    top: 0;
    height: 2px;
    background: linear-gradient(90deg, transparent, rgba(34, 211, 238, 0.75), transparent);
    animation: top-line-scan 4.8s linear infinite;
    pointer-events: none;
  }
}

.hero-title {
  letter-spacing: 0.04em;
  text-shadow: 0 0 12px rgba(236, 72, 153, 0.55), 0 0 20px rgba(34, 211, 238, 0.45);
}

.tab-btn {
  border: 1px solid rgba(148, 163, 184, 0.35);
  color: #dbeafe;
  background: rgba(15, 23, 42, 0.55);
  transition: all 0.2s ease;

  &:hover {
    border-color: rgba(56, 189, 248, 0.75);
    color: #fff;
  }

  &.is-active {
    border-color: rgba(217, 70, 239, 0.8);
    background: linear-gradient(135deg, rgba(217, 70, 239, 0.65), rgba(14, 165, 233, 0.65));
    color: #fff;
    box-shadow: 0 0 18px rgba(217, 70, 239, 0.35);
  }
}

.party-light {
  position: absolute;
  top: -4px;
  width: 140px;
  height: 220px;
  pointer-events: none;
  filter: blur(30px);
  opacity: 0.45;
  z-index: -1;
}

.light-left {
  left: 0;
  background: radial-gradient(circle, rgba(244, 63, 94, 0.7), transparent 70%);
}

.light-right {
  right: 0;
  background: radial-gradient(circle, rgba(56, 189, 248, 0.75), transparent 70%);
}

@keyframes panel-sweep {

  0%,
  78%,
  100% {
    transform: translateX(-130%);
  }

  45% {
    transform: translateX(130%);
  }
}

@keyframes top-line-scan {
  0% {
    transform: translateX(-100%);
  }

  100% {
    transform: translateX(100%);
  }
}

@keyframes grid-pulse {

  0%,
  100% {
    opacity: 0.15;
  }

  50% {
    opacity: 0.34;
  }
}

@keyframes circuit-drift {
  0% {
    transform: translate(0, 0);
  }

  100% {
    transform: translate(16px, 12px);
  }
}
</style>
