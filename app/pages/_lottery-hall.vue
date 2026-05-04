<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '../composables/useAuth'
import { type BetRecord, type LotteryGame } from '~/services/api'
import { LotteryHallService } from '~/services/lotteryHallService'

const router = useRouter()
const { user, initialized, isLoggedIn, init } = useAuth()
const lotteryHallService = new LotteryHallService()

const isCheckingAuth = computed(() => !initialized.value)
const state = reactive({
  games: [] as LotteryGame[],
  recentBets: [] as BetRecord[],
  balance: 0,
  loading: false,
  submitting: false,
  message: '',
  errorMessage: '',
  issueNo: '2026036',
  countDownSeconds: 600,
  timer: null as ReturnType<typeof setInterval> | null,
  selectedCategory: '6hc' as '6hc' | 'a6' | 'bg',
  selectedGameId: null as number | null,
  betType: '',
  numberInput: '',
  amount: 100
})

const categoryOptions = [
  { key: '6hc' as const, label: '六合彩' },
  { key: 'a6' as const, label: '官方六合彩' },
  { key: 'bg' as const, label: 'BG 系列' }
]

const filteredGames = computed(() =>
  state.games.filter((game) => game.category === state.selectedCategory)
)

const selectedGame = computed(() => {
  if (!state.selectedGameId) return null
  return state.games.find((item) => item.id === state.selectedGameId) ?? null
})

const selectedGameTitle = computed(() => {
  if (!selectedGame.value) return '-'
  if (selectedGame.value.name === '快3') return '澳门快三'
  if (selectedGame.value.name === 'PK10') return '澳门PK10'
  if (selectedGame.value.name === '時時彩') return '澳门时时彩'
  return selectedGame.value.name
})

const potentialPayout = computed(() => {
  if (!selectedGame.value) return 0
  return Number((state.amount * selectedGame.value.defaultOdds).toFixed(2))
})

const countDownDisplay = computed(() => {
  const total = Math.max(state.countDownSeconds, 0)
  const hh = String(Math.floor(total / 3600)).padStart(2, '0')
  const mm = String(Math.floor((total % 3600) / 60)).padStart(2, '0')
  const ss = String(total % 60).padStart(2, '0')
  return `${hh}:${mm}:${ss}`
})

const openNumbers = computed(() => {
  if (!selectedGame.value) return []
  if (selectedGame.value.key === 'k3') return ['2', '4', '5']
  if (selectedGame.value.key === 'pk10') return ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10']
  if (selectedGame.value.key === 'ssc') return ['1', '3', '6', '8', '9']
  return ['01', '02', '03', '04', '05', '06', '07']
})

const hallTabs = computed(() => {
  const mapLabel = (name: string) => {
    if (name === '快3') return '澳门快三'
    if (name === 'PK10') return '澳门PK10'
    if (name === '時時彩') return '澳门时时彩'
    return name
  }

  return filteredGames.value.map((game) => ({
    ...game,
    hallLabel: mapLabel(game.name)
  }))
})

const _handlers = {
  getBallClass: (value: string, index: number) => {
    if (!selectedGame.value) return 'bg-slate-200 text-slate-800'
    if (selectedGame.value.key === '6hc' || selectedGame.value.key === 'a6') {
      if (index === openNumbers.value.length - 1) return 'bg-red-100 text-red-700 ring-2 ring-red-300'
      const num = Number(value)
      if (num % 3 === 0) return 'bg-blue-100 text-blue-700 ring-2 ring-blue-300'
      if (num % 3 === 1) return 'bg-emerald-100 text-emerald-700 ring-2 ring-emerald-300'
      return 'bg-amber-100 text-amber-700 ring-2 ring-amber-300'
    }
    return 'bg-sky-100 text-sky-700 ring-2 ring-sky-300'
  },
  syncSelectedGameByCategory: () => {
    const nextGame = filteredGames.value[0]
    if (!nextGame) {
      state.selectedGameId = null
      state.betType = ''
      return
    }
    state.selectedGameId = nextGame.id
    state.betType = nextGame.playTypes[0] || ''
  },
  syncBetTypeByGame: (nextGame: LotteryGame | null) => {
    if (!nextGame) {
      state.betType = ''
      return
    }
    if (!nextGame.playTypes.includes(state.betType)) {
      state.betType = nextGame.playTypes[0] || ''
    }
  }
}

const _actions = {
  loadHallData: async () => {
    state.loading = true
    state.errorMessage = ''
    try {
      const [gamesResponse, stateResponse] = await Promise.all([
        lotteryHallService.fetchGames(),
        lotteryHallService.fetchState()
      ])

      state.games = gamesResponse.games
      const firstCategoryGame = gamesResponse.games.find((game) => game.category === state.selectedCategory)
      if (!state.selectedGameId && firstCategoryGame) {
        state.selectedGameId = firstCategoryGame.id
        state.betType = firstCategoryGame.playTypes[0] || ''
      } else if (!state.selectedGameId && gamesResponse.games.length > 0) {
        state.selectedGameId = gamesResponse.games[0].id
        state.betType = gamesResponse.games[0].playTypes[0] || ''
      }

      state.balance = Number(stateResponse.balance ?? 0)
      state.recentBets = Array.isArray(stateResponse.recentBets) ? stateResponse.recentBets : []
    } catch {
      state.errorMessage = '讀取資料失敗，請稍後重試。'
    } finally {
      state.loading = false
    }
  },
  placeBet: async () => {
    state.message = ''
    state.errorMessage = ''
    if (!state.selectedGameId) {
      state.errorMessage = '請先選擇遊戲。'
      return
    }

    state.submitting = true
    try {
      const response = await lotteryHallService.submitBet({
        gameId: state.selectedGameId,
        betType: state.betType,
        number: state.numberInput,
        amount: state.amount
      })

      state.balance = Number(response.balance ?? state.balance)
      if (response.bet) {
        state.recentBets = [response.bet, ...state.recentBets].slice(0, 10)
        state.message = `${response.message}，注單 ${response.bet.id}`
      } else {
        state.message = String(response.message ?? '下注成功')
      }
      state.numberInput = ''
    } catch (error: any) {
      state.errorMessage = error?.data?.statusMessage || '下注失敗，請確認輸入內容。'
    } finally {
      state.submitting = false
    }
  }
}

onMounted(async () => {
  await init()
  if (!isLoggedIn.value) {
    router.replace('/login')
    return
  }
  _actions.loadHallData()

  state.timer = setInterval(() => {
    if (state.countDownSeconds <= 0) {
      state.countDownSeconds = 600
      return
    }
    state.countDownSeconds -= 1
  }, 1000)
})

onUnmounted(() => {
  if (state.timer) clearInterval(state.timer)
})

watch(() => state.selectedCategory, () => {
  _handlers.syncSelectedGameByCategory()
})

watch(selectedGame, (nextGame) => {
  _handlers.syncBetTypeByGame(nextGame)
})
</script>

<template>
  <main class="mx-auto max-w-[1240px] px-3 pb-16 pt-4">
    <section
      v-if="isCheckingAuth"
      class="rounded-2xl border border-slate-200 bg-white p-6 text-slate-600"
    >
      正在檢查登入狀態...
    </section>

    <section v-else-if="!isLoggedIn" class="rounded-2xl border border-slate-200 bg-white p-6">
      <h1 class="text-2xl font-bold text-slate-900">尚未登入</h1>
      <p class="mt-2 text-slate-600">請先登入後再進入彩票大廳。</p>
      <NuxtLink to="/login" class="mt-4 inline-block font-semibold text-blue-600">
        前往登入
      </NuxtLink>
    </section>

    <section v-else class="grid grid-cols-1 gap-3 xl:grid-cols-[220px_1fr]">
      <aside class="rounded-lg border border-slate-200 bg-white p-3">
        <div class="rounded-md bg-slate-50 p-3">
          <p class="text-sm font-semibold text-slate-900">{{ user?.name || 'newt02c001' }}</p>
          <p class="mt-3 text-xs text-slate-500">信用額度：783,700,000.00</p>
          <p class="mt-1 text-xs text-slate-500">
            帳戶餘額：<span class="font-semibold text-emerald-700">{{ state.balance.toLocaleString() }}</span>
          </p>
        </div>
      </aside>

      <div class="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <header class="bg-sky-500 text-white">
          <div class="flex flex-wrap items-center gap-2 px-3 py-2">
            <button
              v-for="category in categoryOptions"
              :key="category.key"
              type="button"
              class="rounded-md px-2 py-1 text-xs font-semibold"
              :class="state.selectedCategory === category.key ? 'bg-white text-sky-700' : 'bg-sky-400/70'"
              @click="state.selectedCategory = category.key"
            >
              {{ category.label }}
            </button>
          </div>
          <div class="flex gap-1 overflow-x-auto px-2 pb-2">
            <button
              v-for="game in hallTabs"
              :key="game.id"
              type="button"
              class="whitespace-nowrap rounded-md px-3 py-1.5 text-sm"
              :class="
                state.selectedGameId === game.id
                  ? 'bg-white text-sky-700 font-semibold'
                  : 'bg-sky-400/70 text-white hover:bg-sky-400'
              "
              @click="state.selectedGameId = game.id"
            >
              {{ game.hallLabel }}
            </button>
          </div>
        </header>

        <div v-if="state.loading" class="p-6 text-slate-600">資料載入中...</div>

        <div v-else class="space-y-3 p-3">
          <section class="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_320px]">
            <div class="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div class="flex items-start justify-between">
                <div>
                  <p class="text-2xl font-bold text-slate-900">{{ selectedGameTitle }}</p>
                  <p class="text-sm text-slate-500">第 {{ state.issueNo }} 期開獎</p>
                </div>
              </div>
              <div class="mt-3 flex flex-wrap items-center gap-2">
                <span
                  v-for="(num, idx) in openNumbers"
                  :key="`${num}-${idx}`"
                  class="flex h-11 w-11 items-center justify-center rounded-full text-base font-bold"
                  :class="_handlers.getBallClass(num, idx)"
                >
                  {{ num }}
                </span>
              </div>
            </div>

            <div class="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p class="text-xs text-slate-500">距離封盤</p>
              <p class="mt-2 text-4xl font-bold tracking-widest text-sky-600">{{ countDownDisplay }}</p>
              <p class="mt-3 text-xs text-slate-500">單注限額 {{ selectedGame?.minBet || 0 }} - {{ selectedGame?.maxBet || 0 }}</p>
              <p class="text-xs text-slate-500">預設賠率 {{ selectedGame?.defaultOdds || 0 }}</p>
            </div>
          </section>

          <section class="rounded-lg border border-slate-200 bg-white p-2">
            <div class="flex flex-wrap gap-1.5">
              <button
                v-for="play in selectedGame?.playTypes || []"
                :key="play"
                type="button"
                class="rounded-md border px-3 py-1 text-sm"
                :class="
                  state.betType === play
                    ? 'border-sky-500 bg-sky-500 font-semibold text-white'
                    : 'border-slate-300 bg-slate-100 text-slate-700'
                "
                @click="state.betType = play"
              >
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
                  <input
                    v-model="state.numberInput"
                    type="text"
                    class="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                    placeholder="例：07 或 1,3,8"
                  />
                </label>
                <label class="block text-sm font-semibold text-slate-700">
                  下注金額
                  <input
                    v-model.number="state.amount"
                    type="number"
                    min="10"
                    class="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                  />
                </label>
              </div>

              <div class="mt-3 flex flex-wrap gap-2">
                <button
                  v-for="quick in [50, 100, 500, 1000]"
                  :key="quick"
                  type="button"
                  class="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700"
                  @click="state.amount = quick"
                >
                  {{ quick }}
                </button>
              </div>

              <p class="mt-3 text-sm text-slate-600">
                玩法：<span class="font-semibold text-slate-800">{{ state.betType || '-' }}</span>｜
                可中：<span class="font-semibold text-emerald-700">{{ potentialPayout }}</span>
              </p>

              <button
                type="button"
                :disabled="state.submitting || !selectedGame"
                class="mt-4 w-full rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
                @click="_actions.placeBet"
              >
                {{ state.submitting ? '下注中...' : `確認下注（${selectedGame?.name || ''}）` }}
              </button>

              <p v-if="state.message" class="mt-3 text-sm font-medium text-emerald-700">{{ state.message }}</p>
              <p v-if="state.errorMessage" class="mt-3 text-sm font-medium text-red-700">{{ state.errorMessage }}</p>
            </div>

            <div class="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <h2 class="mb-3 text-2xl font-bold text-slate-800">最近注單</h2>
              <div v-if="state.recentBets.length === 0" class="text-sm text-slate-500">尚無下注紀錄。</div>
              <ul v-else class="space-y-2">
                <li
                  v-for="bet in state.recentBets"
                  :key="bet.id"
                  class="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  <p class="font-semibold text-slate-800">{{ bet.gameName }}｜{{ bet.betType }}</p>
                  <p class="text-slate-600">號碼 {{ bet.number }}｜金額 {{ bet.amount }}</p>
                  <p class="text-xs text-slate-500">可中 {{ bet.potentialPayout }}</p>
                </li>
              </ul>
            </div>
          </section>
        </div>
      </div>
    </section>
  </main>
</template>
