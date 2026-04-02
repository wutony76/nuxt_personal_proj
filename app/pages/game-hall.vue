<script setup lang="ts">
import { ref } from 'vue'

type HallTab = 'lobby' | 'lottery' | 'taiwan'
type GameSlot = {
  id: number
  name: string
  description: string
  status: 'open' | 'coming'
  path?: string
}

const activeTab = ref<HallTab>('lobby')

const gameSlots = ref<GameSlot[]>([
  { id: 1, name: 'SNAKE', description: '經典貪吃蛇，支援 WASD / 方向鍵', status: 'open', path: '/game/snake' },
  { id: 2, name: '遊戲 02', description: '放你的第二個遊戲', status: 'open' },
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
  <main class="mx-auto max-w-6xl px-4 pb-16 pt-6">
    <section class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h1 class="text-2xl font-bold text-slate-900">遊戲中心</h1>
      <div class="mt-4 flex flex-wrap gap-2">
        <button type="button" class="rounded-lg px-3 py-1.5 text-sm font-semibold"
          :class="activeTab === 'lobby' ? 'bg-slate-900 text-white' : 'border border-slate-300 bg-white'"
          @click="activeTab = 'lobby'">
          遊戲大廳
        </button>
        <button type="button" class="rounded-lg px-3 py-1.5 text-sm font-semibold"
          :class="activeTab === 'lottery' ? 'bg-slate-900 text-white' : 'border border-slate-300 bg-white'"
          @click="activeTab = 'lottery'">
          彩票大廳
        </button>
        <button type="button" class="rounded-lg px-3 py-1.5 text-sm font-semibold"
          :class="activeTab === 'taiwan' ? 'bg-slate-900 text-white' : 'border border-slate-300 bg-white'"
          @click="activeTab = 'taiwan'">
          台彩大廳
        </button>
      </div>
    </section>

    <section v-if="activeTab === 'lobby'" class="mt-4 rounded-2xl border border-slate-200 bg-white p-6">
      <div class="mb-4">
        <h2 class="text-xl font-bold text-slate-900">遊戲格子</h2>
        <p class="mt-1 text-sm text-slate-600">這裡是一格一格的遊戲區塊，你可以直接替換名稱與連結。</p>
      </div>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <article v-for="slot in gameSlots" :key="slot.id" class="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div class="mb-2 flex items-center justify-between">
            <h3 class="text-base font-semibold text-slate-900">{{ slot.name }}</h3>
            <span class="rounded-full px-2 py-0.5 text-xs font-semibold"
              :class="slot.status === 'open' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'">
              {{ slot.status === 'open' ? '可上線' : '準備中' }}
            </span>
          </div>
          <p class="text-sm leading-6 text-slate-700">{{ slot.description }}</p>
          <NuxtLink
            v-if="slot.status === 'open' && slot.path"
            :to="slot.path"
            class="mt-3 block w-full rounded-md bg-slate-900 px-3 py-2 text-center text-sm font-semibold text-white"
          >
            進入遊戲
          </NuxtLink>
          <button
            v-else
            type="button"
            class="mt-3 w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
            :disabled="true"
          >
            進入遊戲
          </button>
        </article>
      </div>
    </section>

    <section v-if="activeTab === 'lottery'" class="mt-4">
      <div class="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 class="text-xl font-bold text-slate-900">彩票大廳</h2>
        <p class="mt-2 text-slate-600">可下注功能已整合完成，請進入專頁使用。</p>
        <NuxtLink to="/lottery-hall"
          class="mt-4 inline-block rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white">
          前往彩票大廳
        </NuxtLink>
      </div>
    </section>

    <section v-if="activeTab === 'taiwan'" class="mt-4">
      <div class="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 class="text-xl font-bold text-slate-900">台彩大廳</h2>
        <p class="mt-2 text-slate-600">台彩資訊與玩法說明請進入專頁查看。</p>
        <NuxtLink to="/taiwan-lottery-hall"
          class="mt-4 inline-block rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white">
          前往台彩大廳
        </NuxtLink>
      </div>
    </section>
  </main>
</template>
