<script setup lang="ts">
import { onMounted, reactive } from 'vue'
import { GET_CONT } from '../config/constants'
import { useRouter } from 'vue-router'
import type { LobbyItem } from '../types/lottery'

const router = useRouter()

const ROUTE_DICT: Record<string, string> = {
  '6HC-CD': '/lottery/bg/6hc-cd',
  '6HC-OF': '/lottery/bg/6hc-of'
}

const state = reactive({
  list: [] as LobbyItem[],
})
const init = () => {
  state.list = GET_CONT.lotteryAll()
}
const click = {
  start: (key: string) => {
    const target = ROUTE_DICT[key]
    if (!target) return
    router.push(target)
  }
}

onMounted(() => {
  init()
})

</script>

<template>
  <main class="lottery-bg mx-auto">
    <!-- <section v-if="isCheckingAuth"
      class="mx-auto mt-6 max-w-[1240px] rounded-2xl border border-slate-200 bg-white p-6 px-3 pb-16 pt-4 text-slate-600">
      正在檢查登入狀態...
    </section>

    <section v-else-if="!isLoggedIn"
      class="mx-auto mt-6 max-w-[1240px] rounded-2xl border border-slate-200 bg-white p-6 px-3 pb-16 pt-4">
      <h1 class="text-2xl font-bold text-slate-900">尚未登入</h1>
      <p class="mt-2 text-slate-600">請先登入後再進入彩票大廳。</p>
      <NuxtLink to="/login" class="mt-4 inline-block font-semibold text-blue-600">
        前往登入
      </NuxtLink>
    </section> -->

    <section class="flex min-h-0 w-full flex-1 flex-col">
      <div class="header">
        <div class="top">
          <div class="container">
            <div class="left">
              <NuxtLink to="/">HOME</NuxtLink>
              <div class="logo">
                <!-- <img src="/images/logo.png" alt="logo" /> -->
              </div>
            </div>
          </div>

        </div>
        <div class="center">
          <div class="container">
            BG-LOTTERY
          </div>
        </div>
      </div>

      <div class="main">
        <div class="container">
          <div class="flex w-full flex-wrap items-center gap-2 p-3">
            <button v-for="category in state.list" :key="category.key" type="button"
              class="rounded-md px-3 py-1.5 text-sm font-semibold transition"
              @click="click.start(`${category.key}-CD`)">
              {{ category.name }}
            </button>
          </div>

          <div class="flex w-full flex-wrap items-center gap-2 p-3">
            <button v-for="category in state.list" :key="category.key" type="button"
              class="rounded-md px-3 py-1.5 text-sm font-semibold transition"
              @click="click.start(`${category.key}-OF`)">
              {{ category.name }}
            </button>
          </div>
        </div>
      </div>

      <div class="footer">
        <div class="container">
          Copyright © 2026 HappyFatYoYo All Rights Reserved.
        </div>
      </div>
    </section>


    <!-- <section v-else class="grid grid-cols-1 gap-3 xl:grid-cols-[220px_1fr]">
      <aside class="rounded-lg border border-slate-200 bg-white p-3">
        <div class="rounded-md bg-slate-50 p-3">
          <p class="text-sm font-semibold text-slate-900">{{ user?.name || 'newt02c001' }}</p>
          <p class="mt-3 text-xs text-slate-500">信用額度：783,700,000.00</p>
          <p class="mt-1 text-xs text-slate-500">
            帳戶餘額：<span class="font-semibold text-emerald-700">{{ balance.toLocaleString() }}</span>
          </p>
        </div>
      </aside>

      <div class="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <header class="bg-sky-500 text-white">
          <div class="flex flex-wrap items-center gap-2 px-3 py-2">
            <button v-for="category in categoryOptions" :key="category.key" type="button"
              class="rounded-md px-2 py-1 text-xs font-semibold"
              :class="selectedCategory === category.key ? 'bg-white text-sky-700' : 'bg-sky-400/70'"
              @click="selectedCategory = category.key">
              {{ category.label }}
            </button>
          </div>
          <div class="flex gap-1 overflow-x-auto px-2 pb-2">
            <button v-for="game in hallTabs" :key="game.id" type="button"
              class="whitespace-nowrap rounded-md px-3 py-1.5 text-sm" :class="selectedGameId === game.id
                ? 'bg-white text-sky-700 font-semibold'
                : 'bg-sky-400/70 text-white hover:bg-sky-400'
                " @click="selectedGameId = game.id">
              {{ game.hallLabel }}
            </button>
          </div>
        </header>

        <div v-if="loading" class="p-6 text-slate-600">資料載入中...</div>

        <div v-else class="space-y-3 p-3">
          <section class="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_320px]">
            <div class="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div class="flex items-start justify-between">
                <div>
                  <p class="text-2xl font-bold text-slate-900">{{ selectedGameTitle }}</p>
                  <p class="text-sm text-slate-500">第 {{ issueNo }} 期開獎</p>
                </div>
              </div>
              <div class="mt-3 flex flex-wrap items-center gap-2">
                <span v-for="(num, idx) in openNumbers" :key="`${num}-${idx}`"
                  class="flex h-11 w-11 items-center justify-center rounded-full text-base font-bold"
                  :class="getBallClass(num, idx)">
                  {{ num }}
                </span>
              </div>
            </div>

            <div class="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p class="text-xs text-slate-500">距離封盤</p>
              <p class="mt-2 text-4xl font-bold tracking-widest text-sky-600">{{ countDownDisplay }}</p>
              <p class="mt-3 text-xs text-slate-500">單注限額 {{ selectedGame?.minBet || 0 }} - {{ selectedGame?.maxBet || 0
              }}</p>
              <p class="text-xs text-slate-500">預設賠率 {{ selectedGame?.defaultOdds || 0 }}</p>
            </div>
          </section>

          <section class="rounded-lg border border-slate-200 bg-white p-2">
            <div class="flex flex-wrap gap-1.5">
              <button v-for="play in selectedGame?.playTypes || []" :key="play" type="button"
                class="rounded-md border px-3 py-1 text-sm" :class="betType === play
                  ? 'border-sky-500 bg-sky-500 font-semibold text-white'
                  : 'border-slate-300 bg-slate-100 text-slate-700'
                  " @click="betType = play">
                {{ play }}
              </button>
            </div>
          </section>

          <section class="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_320px]">
            <div class="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <h2 class="mb-3 text-2xl font-bold text-slate-800">下注區</h2>
              <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label class="block text-sm font-semibold text-slate-700">
                  下注號碼
                  <input v-model="numberInput" type="text"
                    class="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                    placeholder="例：07 或 1,3,8" />
                </label>
                <label class="block text-sm font-semibold text-slate-700">
                  下注金額
                  <input v-model.number="amount" type="number" min="10"
                    class="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2" />
                </label>
              </div>

              <div class="mt-3 flex flex-wrap gap-2">
                <button v-for="quick in [50, 100, 500, 1000]" :key="quick" type="button"
                  class="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700"
                  @click="amount = quick">
                  {{ quick }}
                </button>
              </div>

              <p class="mt-3 text-sm text-slate-600">
                玩法：<span class="font-semibold text-slate-800">{{ betType || '-' }}</span>｜
                可中：<span class="font-semibold text-emerald-700">{{ potentialPayout }}</span>
              </p>

              <button type="button" :disabled="submitting || !selectedGame"
                class="mt-4 w-full rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
                @click="placeBet">
                {{ submitting ? '下注中...' : `確認下注（${selectedGame?.name || ''}）` }}
              </button>

              <p v-if="message" class="mt-3 text-sm font-medium text-emerald-700">{{ message }}</p>
              <p v-if="errorMessage" class="mt-3 text-sm font-medium text-red-700">{{ errorMessage }}</p>
            </div>

            <div class="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <h2 class="mb-3 text-2xl font-bold text-slate-800">最近注單</h2>
              <div v-if="recentBets.length === 0" class="text-sm text-slate-500">尚無下注紀錄。</div>
              <ul v-else class="space-y-2">
                <li v-for="bet in recentBets" :key="bet.id"
                  class="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                  <p class="font-semibold text-slate-800">{{ bet.gameName }}｜{{ bet.betType }}</p>
                  <p class="text-slate-600">號碼 {{ bet.number }}｜金額 {{ bet.amount }}</p>
                  <p class="text-xs text-slate-500">可中 {{ bet.potentialPayout }}</p>
                </li>
              </ul>
            </div>
          </section>
        </div>
      </div>
    </section> -->
  </main>
</template>
