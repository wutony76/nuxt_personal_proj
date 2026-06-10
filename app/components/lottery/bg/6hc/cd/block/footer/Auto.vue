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
        <span class="coin-label">金額</span>
        <input type="number" min="1" max="99999" class="coin-input" :value="state.betAmount"
          @input="_handlers.onAmountInput" @blur="_handlers.onAmountInput" />
        <span class="auto-unit">元</span>
      </div>
      <div class="auto-play-info">
        <span class="coin-label">玩法</span>
        <span class="play-val">{{ playInfo }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { use6hcCredit } from '~/composables/use6hcCredit'

const credit = use6hcCredit()
const { state: mxState, time } = credit

const playInfo = computed(() => {
  const play = mxState.activePlay?.name || '-'
  const type = mxState.selectedTypeName || '-'
  const codes = mxState.selectedCodes.length > 0 ? mxState.selectedCodes.join('、') : '（未選）'
  return `${play} / ${type}：${codes}`
})

const state = reactive({
  enabled: false,
  betAmount: 10,
  isRunning: false,
  lastPeriodSeconds: -1,
  statusText: '尚未啟用',
  statusType: 'idle',
})

const _handlers = {
  setStatus(text: string, type: string) {
    state.statusText = text
    state.statusType = type
  },
  normalizeAmount(val: string | number) {
    return Math.min(99999, Math.max(1, Math.trunc(Number(val) || 1)))
  },
  onAmountInput(e: Event) {
    const target = e.target as HTMLInputElement
    const val = _handlers.normalizeAmount(target.value)
    state.betAmount = val
    target.value = String(val)
  },
}

const _actions = {
  async autoBet() {
    if (state.isRunning) return
    if (mxState.selectedCodes.length === 0) {
      _handlers.setStatus('未選號碼，跳過本期', 'low')
      return
    }
    state.isRunning = true
    const prevAmount = mxState.amount
    mxState.amount = state.betAmount
    _handlers.setStatus('投注中...', 'running')
    try {
      await credit.actions.submitBet()
      if (mxState.submitStatus === 'success') {
        _handlers.setStatus('下注成功', 'success')
      } else {
        _handlers.setStatus(mxState.errorMessage || '下注失敗', 'fail')
      }
    } catch {
      _handlers.setStatus('下注失敗，請稍後再試', 'fail')
    } finally {
      mxState.amount = prevAmount
      state.isRunning = false
    }
  },
}

const click = {
  toggle() {
    state.enabled = !state.enabled
    if (!state.enabled) {
      _handlers.setStatus('尚未啟用', 'idle')
    } else {
      _handlers.setStatus('等待開盤...', 'waiting')
    }
  },
}

watch(() => time.statusRemainSec, (seconds) => {
  if (!state.enabled) return
  if (seconds === 0 && state.lastPeriodSeconds !== 0) {
    _actions.autoBet()
  }
  state.lastPeriodSeconds = seconds
})
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
