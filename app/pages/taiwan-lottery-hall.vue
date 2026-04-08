<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { $fetch } from 'ofetch'
import { useAuth } from '../composables/useAuth'

type TaiwanLotteryResult = {
  gameCode: number
  gameName: string
  en: string
  period?: string
  lotNumber: Array<string | number>
}

const router = useRouter()
const { initialized, isLoggedIn, init } = useAuth()

const isCheckingAuth = computed(() => !initialized.value)
const loading = ref(false)
const errorMessage = ref('')
const updatedAt = ref('')
const results = ref<TaiwanLotteryResult[]>([])

const updatedAtLabel = computed(() => {
  if (!updatedAt.value) return '-'
  const date = new Date(updatedAt.value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString('zh-TW', { hour12: false })
})

const getBallClass = (index: number, total: number) => {
  if (index === total - 1) return 'bg-rose-500 text-white'
  const mod = index % 3
  if (mod === 0) return 'bg-amber-400 text-slate-900'
  if (mod === 1) return 'bg-sky-500 text-white'
  return 'bg-emerald-500 text-white'
}

const loadLastNumber = async () => {
  loading.value = true
  errorMessage.value = ''
  try {
    const response = await $fetch<{ updatedAt: string; results: TaiwanLotteryResult[] }>(
      '/api/taiwan-lottery/last-number'
    )
    updatedAt.value = response.updatedAt
    results.value = response.results
  } catch {
    errorMessage.value = '目前無法取得台彩開獎資料，請稍後再試。'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  init()
  if (!isLoggedIn.value) {
    router.replace('/login')
    return
  }
  loadLastNumber()
})
</script>

<template>
  <main class="mx-auto max-w-6xl px-5 pb-16 pt-8">
    <section
      v-if="isCheckingAuth"
      class="rounded-2xl border border-slate-200 bg-white p-6 text-slate-600"
    >
      正在檢查登入狀態...
    </section>

    <section v-else-if="!isLoggedIn" class="rounded-2xl border border-slate-200 bg-white p-6">
      <h1 class="text-2xl font-bold text-slate-900">尚未登入</h1>
      <p class="mt-2 text-slate-600">請先登入後再進入台彩大廳。</p>
      <NuxtLink to="/login" class="mt-4 inline-block font-semibold text-blue-600">
        前往登入
      </NuxtLink>
    </section>

    <section v-else class="rounded-2xl border border-slate-200 bg-white p-6">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 class="text-2xl font-bold text-slate-900">台彩大廳</h1>
          <p class="mt-1 text-sm text-slate-500">最後更新：{{ updatedAtLabel }}</p>
        </div>
        <button
          type="button"
          class="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="loading"
          @click="loadLastNumber"
        >
          {{ loading ? '更新中...' : '重新整理開獎' }}
        </button>
      </div>

      <p v-if="errorMessage" class="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {{ errorMessage }}
      </p>

      <div v-else-if="loading" class="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-6 text-slate-600">
        正在取得台彩開獎資料...
      </div>

      <div v-else-if="results.length === 0" class="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-6 text-slate-600">
        目前尚無開獎資料。
      </div>

      <div v-else class="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <article
          v-for="game in results"
          :key="game.gameCode"
          class="rounded-xl border border-slate-200 bg-slate-50 p-4"
        >
          <div class="flex items-start justify-between gap-2">
            <div>
              <h2 class="text-lg font-semibold text-slate-900">{{ game.gameName }}</h2>
              <p class="text-xs text-slate-500">{{ game.en }}</p>
            </div>
            <span class="rounded-md bg-white px-2 py-1 text-xs font-semibold text-slate-700">
              第 {{ game.period || '-' }} 期
            </span>
          </div>

          <div class="mt-3 flex flex-wrap items-center gap-2">
            <span
              v-for="(num, idx) in game.lotNumber"
              :key="`${game.gameCode}-${idx}-${num}`"
              class="flex h-9 min-w-9 items-center justify-center rounded-full px-2 text-sm font-bold shadow-sm"
              :class="getBallClass(idx, game.lotNumber.length)"
            >
              {{ String(num).padStart(2, '0') }}
            </span>
          </div>
        </article>
      </div>
    </section>
  </main>
</template>
