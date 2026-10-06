<script setup lang="ts">
/**
 * 遊戲試算（/admin/game-simulator）：刮刮樂機率/派彩驗證工具，純模擬運算，
 * 不扣款、不派彩。
 *
 * 見 replace-scratch-simulator-with-python-proxy：機率表、消費邏輯、卡片
 * 視覺渲染全部不在 Nuxt 內重做，直接轉呼叫使用者本機長期在跑的 Python
 * 試算服務（`SCRATCH_PY_API_BASE`，預設 `http://127.0.0.1:8000`），包含
 * 它已經算好、渲染好的卡片圖（`b64card`）一併顯示——取代先前逐個 model
 * 手動移植機率表＋用 HTML/CSS 疊圖還原卡片視覺的做法（model02/03 皆是
 * 用這種方式做的，過程中光是版面對齊就反覆調整多輪，改用這支既有的
 * Python API 後不再需要）。
 *
 * model01~09 的 `play_one`/`play_two`/`play_three` 形狀因玩法而異（猜拳、
 * 撲克牌、號碼配對...），不針對每個 model 另外刻版面，統一用格式化 JSON
 * 呈現原始資料，足夠「機率/派彩驗證」這個用途；卡片圖本身已經是正式
 * 畫面呈現，視覺還原交給它負責。
 */
import { computed, onMounted, reactive } from 'vue'
import { api, type ScratchModelInfo, type ScratchSimResult } from '~/services/api'

type AsyncStatus = 'idle' | 'loading' | 'success' | 'error'

const state = reactive({
  infoStatus: 'idle' as AsyncStatus,
  infoError: '',
  models: {} as Record<string, ScratchModelInfo>,

  model: '',
  coin: 0,
  count: 10,

  runStatus: 'idle' as AsyncStatus,
  runError: '',
  results: [] as ScratchSimResult[]
})

const modelKeys = computed(() => Object.keys(state.models).sort())
const validCoins = computed(() => state.models[state.model]?.valid_coins ?? [])

/**
 * 預設挑一個隨機的非 0 金額，不要固定挑清單第一個（每個 model 的
 * valid_coins 清單第一個幾乎都是 0，0 分的卡面不會有任何中獎標記，
 * 看起來會跟 avscratch_all 隨機抽到的卡差很多）——對應原始 Python
 * 測試頁 `avscratch_all_models_view` 的
 * `random.choice([c for c in valid_coins if c > 0] or valid_coins)`。
 */
function _pickDefaultCoin(coins: number[]): number {
  const nonZero = coins.filter((c) => c > 0)
  const pool = nonZero.length > 0 ? nonZero : coins
  return pool[Math.floor(Math.random() * pool.length)] ?? 0
}

const _actions = {
  loadInfo: async () => {
    state.infoStatus = 'loading'
    state.infoError = ''
    try {
      const res = await api.admin.gameSimulator.scratchInfo()
      state.models = res.models
      const firstModel = modelKeys.value[0]
      if (firstModel) {
        state.model = firstModel
        state.coin = _pickDefaultCoin(state.models[firstModel]?.valid_coins ?? [])
      }
      state.infoStatus = 'success'
    } catch (e: unknown) {
      state.infoError = (e as { message?: string })?.message ?? '無法取得 model 清單'
      state.infoStatus = 'error'
    }
  },
  run: async () => {
    if (state.runStatus === 'loading' || !state.model) return
    state.runStatus = 'loading'
    state.runError = ''
    try {
      const res = await api.admin.gameSimulator.scratch({
        model: state.model,
        coin: state.coin,
        count: state.count
      })
      state.results = res.results
      state.runStatus = 'success'
    } catch (e: unknown) {
      state.runError = (e as { message?: string })?.message ?? '試算失敗'
      state.runStatus = 'error'
    }
  }
}

const click = {
  setModel: (model: string) => {
    state.model = model
    state.coin = _pickDefaultCoin(state.models[model]?.valid_coins ?? [])
  },
  run: () => _actions.run()
}

onMounted(() => _actions.loadInfo())
</script>

<template>
  <AdminShell
    active="gamemgmt"
    kicker="Simulator"
    title="遊戲試算"
    desc="刮刮樂機率/派彩驗證，純模擬不扣款。資料與卡片圖由本機 Python 試算服務提供。"
  >
    <div class="ags-layout">
      <AdminGameNav active="simulator" />
      <div class="ags-content">
        <div v-if="state.infoStatus === 'error'" class="admin-empty" style="color:#b91c1c">
          {{ state.infoError }}
        </div>

        <template v-else-if="state.infoStatus === 'success'">
          <div class="ags-model-tabs">
            <button
              v-for="key in modelKeys"
              :key="key"
              type="button"
              class="ags-model-tab"
              :class="{ active: state.model === key }"
              @click="click.setModel(key)"
            >
              Model{{ key }} · {{ state.models[key]?.name }}
            </button>
          </div>

          <div class="ags-form">
            <div class="admin-field">
              <label>目標金額</label>
              <select v-model.number="state.coin" class="admin-input">
                <option v-for="coin in validCoins" :key="coin" :value="coin">{{ coin.toLocaleString('zh-TW') }}</option>
              </select>
            </div>
            <div class="admin-field">
              <label>模擬張數</label>
              <input v-model.number="state.count" type="number" min="1" max="50" class="admin-input" />
            </div>
            <button type="button" class="admin-btn admin-btn-primary ags-run-btn" @click="click.run()">
              {{ state.runStatus === 'loading' ? '試算中…' : '隨機試算' }}
            </button>
          </div>

          <div v-if="state.runStatus === 'error'" class="admin-empty" style="color:#b91c1c">{{ state.runError }}</div>
          <div v-else-if="state.runStatus === 'idle'" class="admin-empty">設定好目標金額與張數後按「隨機試算」。</div>

          <template v-else-if="state.runStatus === 'success'">
            <div class="ags-meta">共 {{ state.results.length }} 張</div>

            <div v-for="(result, idx) in state.results" :key="idx" class="ags-card admin-panel">
              <div class="ags-card-head">
                <span class="admin-en">Card #{{ idx + 1 }}</span>
                <span class="ags-card-target">得獎金額：{{ (result.win_coin ?? state.coin).toLocaleString('zh-TW') }}</span>
              </div>

              <img v-if="result.b64card" class="ags-card-img" :src="result.b64card" :alt="`Model${state.model} 卡片 #${idx + 1}`" />
              <div v-else class="ags-no-card-img">此 model 無卡片圖素材（原始系統本來就沒有）</div>

              <details class="ags-raw">
                <summary>原始資料（play_one / play_two / play_three）</summary>
                <pre>{{ JSON.stringify({ play_one: result.play_one, play_two: result.play_two, play_three: result.play_three }, null, 2) }}</pre>
              </details>
            </div>
          </template>
        </template>

        <div v-else class="admin-empty">載入中…</div>
      </div>
    </div>
  </AdminShell>
</template>

<style scoped lang="scss">
.ags-layout {
  display: flex;
  flex-direction: column;
}

.ags-content {
  flex: 1;
  min-width: 0;
}

.ags-model-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
  margin-bottom: 20px;
  border-bottom: 1px solid var(--line, #e5e7eb);
}

.ags-model-tab {
  padding: 10px 16px;
  border: 0;
  background: transparent;
  cursor: pointer;
  font-size: 13px;
  color: var(--muted, #6b7280);
  border-bottom: 2px solid transparent;

  &.active {
    color: inherit;
    font-weight: 700;
    border-bottom-color: var(--ink, #1c1c22);
  }
}

.ags-form {
  display: flex;
  align-items: flex-end;
  gap: 16px;
  margin-bottom: 20px;
}

.ags-run-btn {
  height: 38px;
}

.ags-meta {
  margin-bottom: 14px;
  font-size: 12.5px;
  color: var(--muted, #6b7280);
}

.ags-card {
  margin-bottom: 16px;
  padding: 14px 18px;
}

.ags-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
  font-size: 13px;
}

.ags-card-target {
  font-weight: 700;
}

.ags-card-img {
  display: block;
  width: 100%;
  max-width: 600px;
  height: auto;
  margin-bottom: 10px;
}

.ags-no-card-img {
  margin-bottom: 10px;
  padding: 10px;
  font-size: 12.5px;
  color: var(--muted, #6b7280);
  border: 1px dashed var(--line, #e5e7eb);
}

.ags-raw {
  font-size: 12px;

  summary {
    cursor: pointer;
    color: var(--muted, #6b7280);
  }

  pre {
    margin-top: 8px;
    padding: 10px;
    background: #f8f8f8;
    overflow-x: auto;
    white-space: pre-wrap;
    word-break: break-all;
  }
}
</style>
