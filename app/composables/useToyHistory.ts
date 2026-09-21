import { computed, reactive } from 'vue'
import { api, type ToyHistoryRecord } from '~/services/api'

const state = reactive({
  records: [] as ToyHistoryRecord[],
  loaded: false,
  loading: false
})

let loadPromise: Promise<void> | null = null

/** 柑仔店櫥仔（尪仔標、抽抽樂等玩具）的下注／結算紀錄；只有登入會員才有 F 幣錢包，未登入不會進到這個 composable */
export const useToyHistory = () => {
  const load = async () => {
    state.loading = true
    try {
      const result = await api.games.toys.history()
      state.records = result.records
      state.loaded = true
    } finally {
      state.loading = false
    }
  }

  const ensureLoaded = async () => {
    if (state.loaded) return
    if (!loadPromise) {
      loadPromise = load().finally(() => {
        loadPromise = null
      })
    }
    return loadPromise
  }

  const actions = {
    reload: () => {
      state.loaded = false
      return ensureLoaded()
    }
  }

  const totals = computed(() => {
    let bet = 0
    let reward = 0
    for (const r of state.records) {
      if (r.type === 'toy-bet') bet += Math.abs(r.amount)
      else reward += r.amount
    }
    return { bet, reward, count: state.records.length }
  })

  return {
    records: computed(() => state.records),
    totals,
    loaded: computed(() => state.loaded),
    loading: computed(() => state.loading),
    ensureLoaded,
    actions
  }
}
