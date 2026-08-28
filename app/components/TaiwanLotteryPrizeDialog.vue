<script setup lang="ts">
/**
 * 台彩中獎明細 dialog：比照 GameRateDialog.vue 的「自己 watch visible 觸發 fetch」慣例，
 * 內部依 gameCode 快取已查過的中獎明細，同一次頁面停留切換不同遊戲不會重複打 API；
 * 視覺套用「台彩柑仔店」主題（見 app/assets/style/taiwan_lottery.scss）。
 */
import { computed, reactive, watch } from 'vue'
import { TaiwanLotteryService } from '~/services/taiwanLotteryService'
import type { TaiwanLotteryPrizeTier } from '~/services/api'

const props = defineProps<{
  visible: boolean
  gameCode: number
  gameName: string
  period: string
}>()
const emit = defineEmits<{ close: [] }>()

const taiwanLotteryService = new TaiwanLotteryService()

type AsyncStatus = 'idle' | 'loading' | 'success' | 'error'

const state = reactive({
  status: 'idle' as AsyncStatus,
  cache: {} as Record<number, TaiwanLotteryPrizeTier[]>
})

const currentTiers = computed(() => state.cache[props.gameCode] ?? [])

const _actions = {
  load: async (force = false) => {
    if (!force && state.cache[props.gameCode]) {
      state.status = 'success'
      return
    }
    state.status = 'loading'
    try {
      const res = await taiwanLotteryService.fetchPrizeDetail(props.gameCode, props.period)
      state.cache[props.gameCode] = res.tiers
      state.status = 'success'
    } catch {
      state.status = 'error'
    }
  }
}

watch(
  () => [props.visible, props.gameCode, props.period],
  ([visible]) => {
    if (visible) _actions.load()
  },
  { immediate: true }
)

const click = {
  close: () => emit('close'),
  retry: () => _actions.load(true)
}
</script>

<template>
  <div v-if="visible" class="tpd-mask theme-taiwan-lottery" @click.self="click.close">
    <section class="tpd-panel taiwan-lottery-scrollbar">
      <header class="tpd-head">
        <div>
          <h3 class="tpd-title">{{ gameName }}</h3>
          <p class="tpd-period">中獎明細 · 第 {{ period }} 期</p>
        </div>
        <button type="button" class="tpd-close" aria-label="關閉" @click="click.close">×</button>
      </header>

      <div class="tpd-body">
        <div v-if="state.status === 'loading'" class="tpd-empty">查詢中...</div>

        <div v-else-if="state.status === 'error'" class="tpd-empty">
          <p>暫時無法取得中獎明細，請稍後再試。</p>
          <button type="button" class="tw-btn tw-btn-secondary" @click="click.retry">重試</button>
        </div>

        <template v-else>
          <div v-if="currentTiers.length" class="tpd-rows">
            <div class="tpd-row tpd-row-head">
              <span>獎項</span>
              <span>中獎注數</span>
              <span>單注獎金</span>
            </div>
            <div v-for="tier in currentTiers" :key="tier.label" class="tpd-row">
              <span class="tpd-tier-label">
                {{ tier.label }}
                <b v-if="tier.multiple || tier.bonus" class="tpd-tier-multiple">{{ tier.multiple || tier.bonus }}</b>
              </span>
              <span>{{ tier.winnerCount.toLocaleString() }} 注</span>
              <span class="tpd-tier-prize">{{ tier.perPrize ? `$${tier.perPrize.toLocaleString()}` : '—' }}</span>
            </div>
          </div>
          <p v-else class="tpd-empty">本期尚無中獎明細資料。</p>
        </template>
      </div>
    </section>
  </div>
</template>

<style scoped lang="scss">
.tpd-mask {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: grid;
  place-items: center;
  padding: 20px;
  background: color-mix(in srgb, var(--color-neutral-900, #2e2b25) 55%, transparent);
  animation: tpdFadeIn 0.18s ease-out both;
}

.tpd-panel {
  width: min(420px, 100%);
  max-height: min(560px, 88vh);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  background: var(--color-surface);
  border: 2px solid var(--color-accent-400);
  border-radius: calc(var(--radius-lg) * 1.15);
  box-shadow: var(--shadow-lg);
  animation: tpdPopIn 0.2s ease-out both;
}

.tpd-head {
  position: sticky;
  top: 0;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 18px 20px 14px;
  background: var(--color-surface);
  border-bottom: 1px dashed var(--color-neutral-400);

  .tpd-title {
    margin: 0;
    font-size: 20px;
    color: var(--color-accent-800);
  }

  .tpd-period {
    margin: 4px 0 0;
    font-size: 12px;
    letter-spacing: 0.08em;
    color: var(--color-neutral-700);
  }
}

.tpd-close {
  border: none;
  background: none;
  color: var(--color-neutral-600);
  font-size: 22px;
  line-height: 1;
  cursor: pointer;

  &:hover {
    color: var(--color-accent-800);
  }
}

.tpd-body {
  padding: 16px 20px 22px;
}

.tpd-empty {
  padding: 26px 0;
  text-align: center;
  font-size: 13px;
  color: var(--color-neutral-700);

  p {
    margin: 0 0 12px;
  }
}

.tpd-rows {
  border: 1px solid var(--color-neutral-300);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.tpd-row {
  display: grid;
  grid-template-columns: 1.4fr 1fr 1fr;
  gap: 8px;
  padding: 10px 14px;
  font-size: 13px;
  background: var(--color-neutral-100);
  border-bottom: 1px solid var(--color-neutral-300);

  &:last-child {
    border-bottom: none;
  }
}

.tpd-row-head {
  background: var(--color-accent-2-200);
  color: var(--color-accent-2-800);
  font-size: 11px;
  letter-spacing: 0.1em;
  font-weight: 700;
}

.tpd-tier-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 700;
  color: var(--color-neutral-900);
}

.tpd-tier-multiple {
  font-size: 11px;
  font-weight: 700;
  color: var(--color-accent-700);
}

.tpd-tier-prize {
  font-weight: 700;
  color: var(--color-accent-800);
}

@keyframes tpdFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes tpdPopIn {
  from { opacity: 0; transform: translateY(12px) scale(0.98); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
</style>
