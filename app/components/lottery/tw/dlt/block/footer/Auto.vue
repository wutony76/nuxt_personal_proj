<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import { useDlt } from '~/composables/useDlt'
import { DLT_BET_AMOUNT, DLT_MAX_SLOTS } from '#shared/config/dlt'

/**
 * 大樂透自動下注（版面比照 pl3 的 footer/Auto.vue）
 *
 * 由 TwAutoPanel 統一渲染，頁面進入時以 useTwAutoActive 啟用。開獎週期是每週二、五
 * （不是分鐘級高頻期別），「每期」在這裡指本站內部佔位期別（見 useDlt.ts）換了就自動送單一次；
 * 每組固定 50 coin、不可調整金額（比照官方每注售價），可調整的只有「自動選幾組（A~E）」。
 */
const { current: mxCurrent, wallet: mxWallet, actions: mxActions, fetch: mxFetch, isOpen } = useDlt()

const money = (value: number) => Number(value ?? 0).toLocaleString('zh-TW')

const state = reactive({
  enabled: false,
  slotCount: 1,
  isRunning: false,
  lastIssue: '',
  statusText: '尚未啟用',
  statusType: 'idle'
})

const currentStatusText = computed(() => String(mxCurrent.runtime?.currentStatus ?? '—'))
const totalCost = computed(() => state.slotCount * DLT_BET_AMOUNT)

const _handlers = {
  setStatus: (text: string, type: string) => {
    state.statusText = text
    state.statusType = type
  },
  normalizeSlotCount: (val: string | number) => Math.min(DLT_MAX_SLOTS, Math.max(1, Math.trunc(Number(val) || 1))),
  onSlotCountInput: (event: Event) => {
    const target = event.target as HTMLInputElement
    const val = _handlers.normalizeSlotCount(target.value)
    state.slotCount = val
    target.value = String(val)
  }
}

const _actions = {
  tryBet: () => {
    if (!state.enabled) return
    if (!isOpen.value) {
      _handlers.setStatus(`等待開盤（目前：${currentStatusText.value}）`, 'waiting')
      return
    }
    const issue = String(mxCurrent.runtime?.issue ?? '')
    if (!issue || issue === state.lastIssue) return
    _actions.autoBet(issue)
  },
  autoBet: async (issue: string) => {
    if (state.isRunning) return
    if (Number(mxWallet.coin ?? 0) < totalCost.value) {
      _handlers.setStatus(`餘額不足（${money(mxWallet.coin)}），跳過本期`, 'low')
      return
    }
    state.isRunning = true
    _handlers.setStatus(`第${issue}期 投注中...`, 'running')
    try {
      mxActions.clearAll()
      for (let i = 1; i < state.slotCount; i++) mxActions.addSlot()
      const slotIds = ['A', 'B', 'C', 'D', 'E'].slice(0, state.slotCount)
      slotIds.forEach((id) => mxActions.quickPick(id))
      const result = await mxFetch.submit()
      if (result?.ok) {
        state.lastIssue = issue
        _handlers.setStatus(
          `第${issue}期 — 下注成功（${Number(result.count ?? 0)} 組 / ${money(Number(result.amount ?? 0))}）`,
          'success'
        )
      } else {
        _handlers.setStatus(result?.message || '下注失敗', 'fail')
      }
    } catch {
      _handlers.setStatus('下注失敗，請稍後再試', 'fail')
    } finally {
      state.isRunning = false
    }
  }
}

const click = {
  toggle: () => {
    state.enabled = !state.enabled
    if (!state.enabled) {
      _handlers.setStatus('尚未啟用', 'idle')
      return
    }
    state.lastIssue = ''
    _handlers.setStatus(`等待開盤（目前：${currentStatusText.value}）`, 'waiting')
    _actions.tryBet()
  }
}

watch([isOpen, () => mxCurrent.runtime?.issue, currentStatusText], () => { _actions.tryBet() })
</script>

<template>
  <div class="auto-warp">
    <div class="control-auto">
      <div class="auto-header">
        <span class="auto-title">自動下注</span>
        <button class="auto-toggle" :class="{ on: state.enabled }" type="button" @click="click.toggle">
          <span class="toggle-track">
            <span class="toggle-thumb" />
          </span>
          <span class="toggle-label">{{ state.enabled ? 'ON' : 'OFF' }}</span>
        </button>
      </div>
      <div class="auto-info">
        <p class="auto-desc">※每次開獎後自動機選送單</p>
        <div class="auto-status" :class="state.statusType">
          <span class="status-dot" />
          {{ state.statusText }}
        </div>
      </div>
      <div class="auto-coin">
        <span class="coin-label">每組金額</span>
        <span class="fixed-amount">{{ money(DLT_BET_AMOUNT) }}（固定）</span>
      </div>
      <div class="auto-coin">
        <span class="coin-label">自動選幾組</span>
        <input type="number" min="1" :max="DLT_MAX_SLOTS" class="coin-input count-input" :value="state.slotCount"
          @input="_handlers.onSlotCountInput" @blur="_handlers.onSlotCountInput" />
        <span class="auto-unit">組（A~E）/ 共 {{ money(totalCost) }}</span>
      </div>
    </div>
  </div>
</template>

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

    .auto-status {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
      white-space: nowrap;

      .status-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: $c-dot-idle;
      }

      &.waiting .status-dot { background: $c-waiting; }
      &.success .status-dot { background: $c-success; }
      &.fail .status-dot,
      &.low .status-dot { background: $c-fail; }
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

      .fixed-amount {
        font-size: 13px;
        font-weight: 700;
        color: var(--color-red-main);
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
  }
}
</style>
