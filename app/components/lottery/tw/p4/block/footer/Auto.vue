<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import { useP4 } from '~/composables/useP4'
import { P4_BET_AMOUNT, P4_MAX_SLOTS, P4_BET_TYPES } from '#shared/config/p4'
import type { P4BetType } from '#shared/config/p4'

/**
 * 4星彩自動下注（版面比照 P3/M649/D539 的 footer/Auto.vue）
 *
 * 由 TwAutoPanel 統一渲染，頁面進入時以 useTwAutoActive 啟用。開獎頻率是每天（週一至週六），
 * 「每期」在這裡指本站內部佔位期別（見 useP4.ts）換了就自動送單一次；每組固定 25 coin、
 * 不可調整金額，可調整的是「下注方式」（正彩/組彩，沒有對彩）與「自動選幾組（A~E）」，
 * 每組都用同一種下注方式機選數字（組彩自動避開豹子）。
 *
 * ⚠️ 各 tw 玩法的 Auto.vue 必須各自一份、不可共用同一個元件實例——TwAutoPanel 的 v-if 鏈若
 * 指向同一個元件，Vue 會就地 patch 保留 instance，切換玩法時 enabled 會殘留、對另一款玩法
 * 偷偷下注（比照 project.md「含跨盤口狀態的組件必須各自一份」的既有教訓）。
 */
const { current: p4Current, wallet: p4Wallet, actions: p4Actions, fetch: p4Fetch, isOpen } = useP4()

const money = (value: number) => Number(value ?? 0).toLocaleString('zh-TW')
const BET_TYPE_LABEL: Record<string, string> = Object.fromEntries(P4_BET_TYPES.map((t) => [t.key, t.label]))

const state = reactive({
  enabled: false,
  /** 自動下注要用哪種下注方式；每組都用這個方式機選 */
  betType: P4_BET_TYPES[0]!.key as P4BetType,
  slotCount: 1,
  isRunning: false,
  lastIssue: '',
  statusText: '尚未啟用',
  statusType: 'idle'
})

const currentStatusText = computed(() => String(p4Current.runtime?.currentStatus ?? '—'))
const totalCost = computed(() => state.slotCount * P4_BET_AMOUNT)

const _handlers = {
  setStatus: (text: string, type: string) => {
    state.statusText = text
    state.statusType = type
  },
  normalizeSlotCount: (val: string | number) => Math.min(P4_MAX_SLOTS, Math.max(1, Math.trunc(Number(val) || 1))),
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
    const issue = String(p4Current.runtime?.issue ?? '')
    if (!issue || issue === state.lastIssue) return
    _actions.autoBet(issue)
  },
  autoBet: async (issue: string) => {
    if (state.isRunning) return
    if (Number(p4Wallet.coin ?? 0) < totalCost.value) {
      _handlers.setStatus(`餘額不足（${money(p4Wallet.coin)}），跳過本期`, 'low')
      return
    }
    state.isRunning = true
    _handlers.setStatus(`第${issue}期 投注中...`, 'running')
    try {
      p4Actions.clearAll()
      for (let i = 1; i < state.slotCount; i++) p4Actions.addSlot()
      const slotIds = ['A', 'B', 'C', 'D', 'E'].slice(0, state.slotCount)
      slotIds.forEach((id) => {
        // 先把該組設成選定的下注方式，再機選 4 位數字
        p4Actions.setBetType(id, state.betType)
        p4Actions.quickPick(id)
      })
      const result = await p4Fetch.submit()
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
  setBetType: (betType: P4BetType) => {
    state.betType = betType
  },
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

watch([isOpen, () => p4Current.runtime?.issue, currentStatusText], () => { _actions.tryBet() })
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
        <span class="coin-label">下注方式</span>
        <div class="auto-modes" role="group" aria-label="自動下注方式">
          <button v-for="opt in P4_BET_TYPES" :key="opt.key" type="button" class="auto-mode"
            :class="{ 'is-active': state.betType === opt.key }" @click="click.setBetType(opt.key)">
            {{ BET_TYPE_LABEL[opt.key] }}
          </button>
        </div>
      </div>
      <div class="auto-coin">
        <span class="coin-label">每組金額</span>
        <span class="fixed-amount">{{ money(P4_BET_AMOUNT) }}（固定）</span>
      </div>
      <div class="auto-coin">
        <span class="coin-label">自動選幾組</span>
        <input type="number" min="1" :max="P4_MAX_SLOTS" class="coin-input count-input" :value="state.slotCount"
          @input="_handlers.onSlotCountInput" @blur="_handlers.onSlotCountInput" />
        <span class="auto-unit">組（A~E）/ 共 {{ money(totalCost) }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
$c-border: #dcd3c4;
$c-bg: #f5ead8;
$c-muted: #645c50;
$c-dot-idle: #c0b6a5;
$c-track-off: #dcd3c4;
$c-waiting: #f59e0b;
$c-success: #16a34a;
$c-fail: #dc2626;

.auto-warp {
  flex: 0 0 300px;
  width: 300px;
  overflow: hidden;
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
        font-family: var(--font-heading, inherit);
        color: var(--color-accent-700, #8c491a);
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
          background: var(--color-accent-700, #8c491a);

          .toggle-thumb {
            left: 21px;
          }
        }

        .toggle-label {
          color: var(--color-accent-700, #8c491a);
        }
      }
    }

    .auto-info {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 4px;

      .auto-desc {
        margin: 0;
        font-size: 12px;
        color: var(--color-neutral-700, #645c50);
      }
    }

    .auto-status {
      display: flex;
      align-items: center;
      gap: 4px;
      max-width: 100%;
      font-size: 12px;
      color: $c-muted;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;

      .status-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: $c-dot-idle;
      }

      &.running,
      &.success {
        color: $c-success;
      }

      &.waiting {
        color: $c-waiting;
      }

      &.fail,
      &.low {
        color: $c-fail;
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
        color: var(--color-neutral-700, #645c50);
        white-space: nowrap;
      }

      .fixed-amount {
        font-size: 13px;
        font-weight: 700;
        color: var(--color-accent-700, #8c491a);
      }

      .coin-input {
        width: 72px;
        border: 1px solid $c-border;
        border-radius: 4px;
        background: var(--color-neutral-100, #f9f4ed);
        padding: 5px 8px;
        text-align: right;
        font-size: 13px;
        color: var(--color-accent-700, #8c491a);
        outline: none;
        transition: border-color 0.15s, box-shadow 0.15s;

        &:focus {
          border-color: var(--color-accent-700, #8c491a);
          box-shadow: 0 0 0 2px rgba(140, 73, 26, 0.12);
        }
      }

      .auto-unit {
        font-size: 12px;
        color: var(--color-neutral-700, #645c50);
        white-space: nowrap;
      }
    }

    .auto-modes {
      display: inline-flex;
      gap: 4px;
      padding: 2px;
      border-radius: 999px;
      background: var(--color-neutral-200, #eee7db);
      flex-wrap: wrap;

      .auto-mode {
        border: none;
        border-radius: 999px;
        background: transparent;
        color: var(--color-accent-700, #8c491a);
        font-size: 12px;
        font-weight: 700;
        padding: 3px 10px;
        cursor: pointer;
        transition: background-color 0.15s ease, color 0.15s ease;

        &.is-active {
          background: var(--color-accent-700, #8c491a);
          color: #fff;
        }
      }
    }
  }
}
</style>
