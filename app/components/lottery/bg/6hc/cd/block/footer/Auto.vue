<template>
  <div class="auto-warp">
    <!-- 自動投注 -->
    <div class="control-auto">
      <div class="auto-header">
        <span class="auto-title">自動投注</span>
        <button class="auto-toggle" :class="{ on: state.enabled }" type="button" @click="click.toggle">
          <span class="toggle-track">
            <span class="toggle-thumb" />
          </span>
          <span class="toggle-label">{{ state.enabled ? 'ON' : 'OFF' }}</span>
        </button>
      </div>
      <div class="auto-info">
        <p class="auto-desc">※每期開盤自動下注</p>
        <div class="auto-status" :class="state.statusType">
          <span class="status-dot" />
          {{ state.statusText }}
        </div>
      </div>
      <div class="auto-coin">
        <span class="coin-label">選號方式</span>
        <div class="mode-tabs">
          <button v-for="item in MODES" :key="item.key" type="button" class="mode-btn"
            :class="{ active: state.mode === item.key }" @click="click.setMode(item.key)">
            {{ item.label }}
          </button>
        </div>
      </div>
      <div class="auto-coin">
        <span class="coin-label">每注金額</span>
        <input type="number" :min="minAmount" :max="maxAmount" class="coin-input" :value="state.betAmount"
          @input="_handlers.onAmountInput" @blur="_handlers.onAmountInput" />
        <span class="auto-unit">元</span>
      </div>
      <div class="auto-coin">
        <span class="coin-label">每期注數</span>
        <!-- 推薦模式的注數由推薦結果決定（改不了），故停用輸入框只顯示實際注數 -->
        <input type="number" min="1" :max="maxCount" class="coin-input" :disabled="state.mode === 'recommend'"
          :value="effectiveCount" @input="_handlers.onCountInput" @blur="_handlers.onCountInput" />
        <span class="auto-unit">注 / 共 {{ actions.money(totalCost) }}</span>
      </div>
      <div class="auto-play-info">
        <span class="coin-label">玩法</span>
        <span class="play-val">{{ playInfo }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import { SORT, STATUS_TIME } from '~/config/constants'
import { actions } from '~/utils/common'
import { use6hcCredit } from '~/composables/use6hcCredit'

const MODES = [
  { key: 'random' as const, label: '隨機' },
  { key: 'recommend' as const, label: '號碼推薦' },
]

const MAX_COUNT = 49 // 注數上限的硬天花板（一個分頁最多 49 個號碼球）

const credit = use6hcCredit()
const {
  state: mxState, current: mxCurrent, select: mxSelect, road: mxRoad, analyze: mxAnalyze,
  wallet: mxWallet, fetch: mxFetch, currentQuota: mxQuota, currentCombo: mxCombo,
  recommendOf: mxRecommendOf, autoBetMaxCount: mxAutoBetMaxCount,
} = credit
// 每注金額限額（依當前分頁 settings.quota）
const minAmount = computed(() => mxQuota.value.item.min)
const maxAmount = computed(() => mxQuota.value.item.max)

const state = reactive({
  enabled: false,
  betAmount: 10,
  betCount: 5,
  // random = 隨機組注；recommend = 押號碼推薦換算出的注項（注數由推薦決定）
  mode: 'random' as 'random' | 'recommend',
  isRunning: false,
  lastIssue: '', // 已自動投注過的期數，避免同期重複下注
  statusText: '尚未啟用',
  statusType: 'idle',
})

// --- COMPUTED ---
const isOpen = computed(() => String(mxCurrent.runtime?.currentStatus ?? '') === STATUS_TIME.OPEN)
// 可自動投注的注項數（與玩法頁隨機選號同一組 pool）
const poolSize = computed(() => {
  const balls = mxSelect.pool.filter((item) => /^\d+$/.test(String(item.name)))
  return balls.length > 0 ? balls.length : mxSelect.pool.length
})
/**
 * 注數上限：組合型玩法一注是 pick 個號碼／生肖／尾數，
 * 上限為 C(maxPick, pick)（與伺端 validateBetQuota 同一條，超過整期會被拒單）
 */
const maxCount = computed(() => {
  void mxSelect.pool // pool 換了要重算
  const max = mxAutoBetMaxCount()
  return Math.max(1, Math.min(MAX_COUNT, max || MAX_COUNT))
})
// 對沖排序（推薦模式用）：與號碼推薦面板同一套落差算法
const rankedNumbers = computed(() => {
  const betCount = new Map<number, number>()
  mxCurrent.detail.forEach((detail) => {
    (Array.isArray(detail?.bets) ? detail.bets : []).forEach((bet) => {
      const num = Number(bet)
      if (Number.isFinite(num)) betCount.set(num, (betCount.get(num) ?? 0) + 1)
    })
  })
  const hedgeOf = (play: { num?: number | string; countShow?: number; countIssue?: number }) => {
    const show = Number(play.countShow ?? 0)
    const issue = Number(play.countIssue ?? 0)
    const mine = Number(betCount.get(Number(play.num)) ?? 0)
    switch (mxAnalyze.status) {
      case SORT.OPEN_COUNT_SYSTEM: return Math.abs(show - mine)
      case SORT.GAP_ISSUE_SYSTEM: return Math.abs(issue - mine)
      default: return Math.abs(show - issue)
    }
  }
  return [...mxRoad.plays]
    .sort((a, b) => {
      const diff = hedgeOf(b) - hedgeOf(a)
      return diff !== 0 ? diff : Number(a.num) - Number(b.num)
    })
    .map((play) => Number(play.num))
})
// 推薦模式下實際會下的注項（注數由推薦結果決定，不看使用者填的注數）
const recommend = computed(() =>
  state.mode === 'recommend' && rankedNumbers.value.length >= 7 ? mxRecommendOf(rankedNumbers.value) : null
)
const recommendCodes = computed(() => {
  const result = recommend.value
  if (!result) return []
  return result.codes.length > 0 ? result.codes : result.names
})
// 推薦模式：組合型玩法一組 = 一注，其餘玩法每個注項各自一注
const effectiveCount = computed(() => {
  if (state.mode !== 'recommend') return state.betCount
  if (recommendCodes.value.length === 0) return 0
  return recommend.value?.codes.length ? 1 : recommendCodes.value.length
})
const totalCost = computed(() => effectiveCount.value * state.betAmount)
const playInfo = computed(() => {
  const play = mxState.activePlay?.name || '-'
  const tab = mxState.selectTabName || '-'
  const unit = mxCombo.value ? `每注 ${mxCombo.value.pick} 碼` : '每注 1 項'
  if (state.mode === 'recommend') {
    const detail = recommendCodes.value.length > 0 ? recommendCodes.value.join('、') : '（推不出注項）'
    return `${play} / ${tab}：推薦 ${effectiveCount.value} 注（${unit}）— ${detail}`
  }
  return `${play} / ${tab}：隨機 ${state.betCount} 注（${unit}，上限 ${maxCount.value} 注）`
})

// --- HANDLE ---
const _handlers = {
  setStatus: (text: string, type: string) => {
    state.statusText = text
    state.statusType = type
  },
  normalizeAmount: (val: string | number) =>
    Math.min(maxAmount.value, Math.max(minAmount.value, Math.trunc(Number(val) || minAmount.value))),
  normalizeCount: (val: string | number) => Math.min(maxCount.value, Math.max(1, Math.trunc(Number(val) || 1))),
  onAmountInput: (event: Event) => {
    const target = event.target as HTMLInputElement
    const val = _handlers.normalizeAmount(target.value)
    state.betAmount = val
    target.value = String(val)
  },
  onCountInput: (event: Event) => {
    const target = event.target as HTMLInputElement
    const val = _handlers.normalizeCount(target.value)
    state.betCount = val
    target.value = String(val)
  },
}

const _actions = {
  // 開盤中 + 該期尚未自動投注 → 投注（以期數為單位，避免一期內重複觸發）
  tryBet: () => {
    if (!state.enabled || !isOpen.value) return
    const issue = String(mxCurrent.runtime?.issueCurrent ?? '')
    if (!issue || issue === state.lastIssue) return
    _actions.autoBet(issue)
  },
  // 每期開盤自動下注：走 composable 的 autoBets（隨機取號，不動使用者手動選取的注項）
  autoBet: async (issue: string) => {
    if (state.isRunning) return
    if (poolSize.value === 0) {
      _handlers.setStatus('玩法未載入，跳過本期', 'low')
      return
    }
    // 推薦模式：此分頁在目前排序下推不出注項就跳過本期（例如路珠還沒載完）
    if (state.mode === 'recommend' && effectiveCount.value === 0) {
      _handlers.setStatus('此分頁推不出推薦注項，跳過本期', 'low')
      return
    }
    if (Number(mxWallet.coin ?? 0) < totalCost.value) {
      _handlers.setStatus(`餘額不足（${actions.money(mxWallet.coin)}），跳過本期`, 'low')
      return
    }
    state.isRunning = true
    _handlers.setStatus(`第${issue}期 投注中...`, 'running')
    try {
      const result = await mxFetch.autoBets({
        count: state.betCount,
        amount: state.betAmount,
        mode: state.mode,
        ranked: state.mode === 'recommend' ? rankedNumbers.value : undefined,
      })
      if (result?.ok) {
        state.lastIssue = issue
        // count / amount 只在成功回傳時帶（失敗分支只有 message），故補預設值
        const betCount = Number(result.count ?? 0)
        const betTotal = Number(result.amount ?? 0)
        _handlers.setStatus(`第${issue}期 — 下注成功（${betCount} 注 / ${actions.money(betTotal)}）`, 'success')
      } else {
        _handlers.setStatus(result?.message || '下注失敗', 'fail')
      }
    } catch {
      _handlers.setStatus('下注失敗，請稍後再試', 'fail')
    } finally {
      state.isRunning = false
    }
  },
}

const click = {
  toggle: () => {
    state.enabled = !state.enabled
    if (!state.enabled) {
      _handlers.setStatus('尚未啟用', 'idle')
      return
    }
    // 開啟時若已在開盤中，直接投注本期，否則等下一期開盤
    state.lastIssue = ''
    _handlers.setStatus('等待開盤...', 'waiting')
    _actions.tryBet()
  },
  setMode: (mode: 'random' | 'recommend') => {
    if (state.mode === mode) return
    state.mode = mode
    // 換模式視為新設定，允許本期重新投注一次
    state.lastIssue = ''
    if (state.enabled) _actions.tryBet()
  },
}

watch([isOpen, () => mxCurrent.runtime?.issueCurrent], () => { _actions.tryBet() })
// 切換玩法 / 分頁時，每注金額改夾在新分頁的單注限額內（否則自動投注會整期被伺端拒單）
watch([minAmount, maxAmount], () => {
  state.betAmount = _handlers.normalizeAmount(state.betAmount)
}, { immediate: true })
// 注數同理：組合型玩法的上限是 C(maxPick, pick)（如「一粒任中」只有 3 注），
// 從 49 個號碼球的分頁切過來若不夾值，會整期被伺端以超出注數上限拒單
watch(maxCount, () => {
  state.betCount = _handlers.normalizeCount(state.betCount)
}, { immediate: true })
</script>

<style scoped lang="scss">
$c-border: #dcb4b4;
$c-bg: #efe6e6;
$c-muted: #9ca3af;
$c-dot-idle: #d1d5db;
$c-track-off: #e5e7eb;
$c-waiting: #f59e0b;
$c-success: #16a34a;
$c-fail: #dc2626;

.auto-warp {
  flex: 0 0 300px;
  display: flex;
  flex-direction: column;
  background: $c-bg;
  border: 1px solid $c-border;
  border-radius: var(--base-radius);

  .control-auto {
    display: flex;
    flex-direction: column;
    gap: 7px;
    padding: 0.75rem;

    .auto-header {
      display: flex;
      align-items: center;
      justify-content: space-between;

      .auto-title {
        font-size: 15px;
        font-weight: 700;
        color: var(--color-red-main);
      }
    }

    .auto-toggle {
      display: flex;
      align-items: center;
      gap: 6px;
      background: none;
      border: none;
      cursor: pointer;
      padding: 0;

      .toggle-track {
        position: relative;
        width: 40px;
        height: 22px;
        border-radius: 11px;
        background: $c-track-off;
        transition: background 0.2s;

        .toggle-thumb {
          position: absolute;
          top: 3px;
          left: 3px;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #fff;
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
          transition: left 0.2s;
        }
      }

      .toggle-label {
        font-size: 12px;
        font-weight: 700;
        color: $c-muted;
        transition: color 0.2s;
      }

      &.on {
        .toggle-track {
          background: var(--color-red-main);

          .toggle-thumb {
            left: 21px;
          }
        }

        .toggle-label {
          color: var(--color-red-main);
        }
      }
    }

    .auto-info {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;

      .auto-desc {
        margin: 0;
        font-size: 12px;
        color: var(--color-red-desc);
        white-space: nowrap;
      }
    }

    .auto-coin {
      display: flex;
      align-items: center;
      gap: 8px;

      .coin-label {
        font-size: 12px;
        color: var(--color-red-desc);
        white-space: nowrap;
      }

      .coin-input {
        width: 72px;
        border: 1px solid $c-border;
        border-radius: 4px;
        background: #fff;
        padding: 5px 8px;
        text-align: right;
        font-size: 13px;
        color: var(--color-red-main);
        outline: none;
        transition: border-color 0.15s, box-shadow 0.15s;

        &:focus {
          border-color: var(--color-red-main);
          box-shadow: 0 0 0 2px rgba(213, 63, 83, 0.12);
        }
      }

      .auto-unit {
        font-size: 12px;
        color: var(--color-red-desc);
        white-space: nowrap;
      }

      .coin-input:disabled {
        background: #f3f4f6;
        color: $c-muted;
        cursor: not-allowed;
      }

      /* 選號方式：隨機 / 號碼推薦 */
      .mode-tabs {
        display: flex;
        gap: 4px;

        .mode-btn {
          border: 1px solid $c-border;
          border-radius: 4px;
          background: #fff;
          padding: 4px 9px;
          font-size: 12px;
          font-weight: 700;
          color: var(--color-red-desc);
          cursor: pointer;
          transition: background 0.15s, color 0.15s, border-color 0.15s;

          &:hover:not(.active) {
            border-color: var(--color-red-main);
          }

          &.active {
            border-color: var(--color-red-main);
            background: var(--color-red-main);
            color: #fff;
          }
        }
      }
    }

    .auto-play-info {
      display: flex;
      align-items: flex-start;
      gap: 6px;
      font-size: 12px;

      .coin-label {
        color: var(--color-red-desc);
        white-space: nowrap;
        flex-shrink: 0;
      }

      .play-val {
        color: var(--color-red-main);
        word-break: break-all;
        line-height: 1.4;
      }
    }

    .auto-status {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      font-weight: 600;
      color: $c-muted;

      .status-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: $c-dot-idle;
        flex-shrink: 0;
      }

      &.waiting {
        color: $c-waiting;

        .status-dot {
          background: $c-waiting;
          animation: dot-pulse 1.2s ease-in-out infinite;
        }
      }

      &.running {
        color: var(--color-red-main);

        .status-dot {
          background: var(--color-red-main);
          animation: dot-pulse 0.7s ease-in-out infinite;
        }
      }

      &.success {
        color: $c-success;

        .status-dot { background: $c-success; }
      }

      &.fail,
      &.low {
        color: $c-fail;

        .status-dot { background: $c-fail; }
      }
    }
  }
}

@keyframes dot-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}
</style>
