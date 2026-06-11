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
        <p class="auto-desc">※每期開盤隨機下注</p>
        <div class="auto-status" :class="state.statusType">
          <span class="status-dot" />
          {{ state.statusText }}
        </div>
      </div>
      <div class="auto-coin">
        <span class="coin-label">金額</span>
        <input id="auto-coin-input" type="number" min="1" max="99999" class="coin-input" :value="state.betAmount"
          @input="_handlers.onAmountInput" @blur="_handlers.onAmountInput" />
        <span class="auto-sep">×</span>
        <input id="auto-count-input" type="number" min="1" max="1000" class="coin-input count-input"
          :value="state.betCount" @input="_handlers.onCountInput" @blur="_handlers.onCountInput" />
        <span class="auto-unit">注</span>
      </div>
    </div>

    <!-- 自動追號 -->
    <div class="control-auto track">
      <div class="auto-header">
        <span class="auto-title">自動追號</span>
        <button class="auto-toggle" :class="{ on: state.track.enabled }" type="button" @click="click.toggleTrack">
          <span class="toggle-track">
            <span class="toggle-thumb" />
          </span>
          <span class="toggle-label">{{ state.track.enabled ? 'ON' : 'OFF' }}</span>
        </button>
      </div>
      <div class="auto-info">
        <p class="auto-desc">※固定號碼連續追 N 期</p>
        <div class="auto-status" :class="state.track.statusType">
          <span class="status-dot" />
          {{ state.track.statusText }}
        </div>
      </div>
      <div class="track-numbers">
        <Ball v-for="n in state.track.numbers" :key="n.label" :data="n" :isClick="false" />
        <button class="reroll-btn" type="button" :disabled="state.track.enabled" @click="click.rerollTrack">
          換號
        </button>
      </div>
      <div class="auto-coin">
        <span class="coin-label">金額</span>
        <input type="number" min="1" max="99999" class="coin-input" :value="state.track.amount"
          @input="_handlers.onTrackAmountInput" @blur="_handlers.onTrackAmountInput" />
        <span class="auto-sep">追</span>
        <input type="number" min="1" max="50" class="coin-input count-input" :value="state.track.maxPeriods"
          @input="_handlers.onTrackPeriodInput" @blur="_handlers.onTrackPeriodInput" />
        <span class="auto-unit">期</span>
        <span v-if="state.track.enabled" class="track-progress">
          {{ state.track.period }}/{{ state.track.maxPeriods }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { cloneDeep } from 'lodash'
import { PLAYLIST } from '#shared/config/6hc-of'
import Ball from '~/components/lottery/bg/6hc/of/base/Ball.vue'

const { state: mxState, fetch: mxFetch, current, wallet, isOpen } = use6hcOfficial()
const { user } = useAuth()

const state = reactive({
  // 自動投注
  enabled: false,
  betAmount: 2,
  betCount: 12,
  isRunning: false,
  lastIssue: '',
  statusText: '尚未啟用',
  statusType: 'idle',
  // 自動追號
  track: {
    enabled: false,
    amount: 1,
    maxPeriods: 5,
    numbers: [],
    period: 0,
    isRunning: false,
    lastIssue: '',
    statusText: '尚未啟用',
    statusType: 'idle',
  },
})

const _handlers = {
  // --- 自動投注 ---
  setStatus(text, type) {
    state.statusText = text
    state.statusType = type
  },
  normalizeAmount(val) {
    return Math.min(99999, Math.max(1, Math.trunc(Number(val) || 1)))
  },
  normalizeCount(val) {
    return Math.min(1000, Math.max(1, Math.trunc(Number(val) || 1)))
  },
  onAmountInput(e) {
    const val = _handlers.normalizeAmount(e.target.value)
    state.betAmount = val
    e.target.value = String(val)
  },
  onCountInput(e) {
    const val = _handlers.normalizeCount(e.target.value)
    state.betCount = val
    e.target.value = String(val)
  },
  buildGroups(count) {
    return Array.from({ length: count }, (_, i) => {
      const pool = cloneDeep(PLAYLIST.slice(0, 49))
      const picked = [...pool].sort(() => Math.random() - 0.5).slice(0, 6)
      return {
        hashKey: `auto-${Date.now()}-${i}`,
        playList: picked.map(item => ({ ...item, selected: true })),
        betCount: 1,
      }
    })
  },
  // --- 自動追號 ---
  setTrackStatus(text, type) {
    state.track.statusText = text
    state.track.statusType = type
  },
  buildTrackNumbers() {
    const pool = cloneDeep(PLAYLIST.slice(0, 49))
    return [...pool].sort(() => Math.random() - 0.5).slice(0, 6).map(p => ({ ...p, selected: true }))
  },
  onTrackAmountInput(e) {
    const val = _handlers.normalizeAmount(e.target.value)
    state.track.amount = val
    e.target.value = String(val)
  },
  onTrackPeriodInput(e) {
    const val = Math.min(50, Math.max(1, Math.trunc(Number(e.target.value) || 1)))
    state.track.maxPeriods = val
    e.target.value = String(val)
  },
}

const _actions = {
  async autoBet(issue) {
    if (state.isRunning) return
    state.isRunning = true

    const totalCost = state.betAmount * state.betCount
    try {
      if (wallet.coin < totalCost) {
        _handlers.setStatus(`餘額不足（${wallet.coin}），跳過本期`, 'low')
        return
      }

      const groups = _handlers.buildGroups(state.betCount)
      const hashKeys = new Set(groups.map(g => g.hashKey))
      groups.forEach(g => mxState.groupList.push(g))

      _handlers.setStatus('投注中...', 'running')

      const result = await mxFetch.bets(state.betAmount, user.value?.id)

      if (result.ok) {
        state.lastIssue = issue
        _handlers.setStatus(`第${issue}期 — 下注成功`, 'success')
      } else {
        mxState.groupList = mxState.groupList.filter(g => !hashKeys.has(g.hashKey))
        _handlers.setStatus(result.message || '下注失敗', 'fail')
      }
    } catch {
      _handlers.setStatus('下注失敗，請稍後再試', 'fail')
    } finally {
      state.isRunning = false
    }
  },

  async trackBet(issue) {
    if (state.track.isRunning) return
    state.track.isRunning = true

    try {
      if (wallet.coin < state.track.amount) {
        _handlers.setTrackStatus(`餘額不足（${wallet.coin}），停止追號`, 'fail')
        state.track.enabled = false
        return
      }

      const group = {
        hashKey: `track-${Date.now()}`,
        playList: state.track.numbers.map(item => ({ ...cloneDeep(item), selected: true })),
        betCount: 1,
      }
      mxState.groupList.push(group)

      const next = state.track.period + 1
      _handlers.setTrackStatus(`第 ${next}/${state.track.maxPeriods} 期，投注中...`, 'running')

      const result = await mxFetch.bets(state.track.amount, user.value?.id)

      if (result.ok) {
        state.track.lastIssue = issue
        state.track.period++
        if (state.track.period >= state.track.maxPeriods) {
          state.track.enabled = false
          _handlers.setTrackStatus(`追號完成（共 ${state.track.maxPeriods} 期）`, 'success')
        } else {
          _handlers.setTrackStatus(`第 ${state.track.period}/${state.track.maxPeriods} 期 — 成功`, 'success')
        }
      } else {
        mxState.groupList = mxState.groupList.filter(g => g.hashKey !== group.hashKey)
        _handlers.setTrackStatus(result.message || '下注失敗', 'fail')
        state.track.enabled = false
      }
    } catch {
      _handlers.setTrackStatus('下注失敗，請稍後再試', 'fail')
      state.track.enabled = false
    } finally {
      state.track.isRunning = false
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
  toggleTrack() {
    state.track.enabled = !state.track.enabled
    if (!state.track.enabled) {
      state.track.period = 0
      _handlers.setTrackStatus('尚未啟用', 'idle')
    } else {
      state.track.period = 0
      if (state.track.numbers.length === 0) {
        state.track.numbers = _handlers.buildTrackNumbers()
      }
      _handlers.setTrackStatus('等待開盤...', 'waiting')
    }
  },
  rerollTrack() {
    state.track.numbers = _handlers.buildTrackNumbers()
  },
}

watch(isOpen, (open) => {
  if (!open) return
  const issue = String(current.runtime?.issueCurrent ?? '')
  if (!issue) return

  if (state.enabled && issue !== state.lastIssue) {
    _actions.autoBet(issue)
  }
  if (state.track.enabled && issue !== state.track.lastIssue) {
    _actions.trackBet(issue)
  }
})

onMounted(() => {
  state.track.numbers = _handlers.buildTrackNumbers()
})
</script>

<style scoped lang="scss">
// component-scoped color tokens
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
    border-bottom: 1px solid $c-border;

    &.track {
      border-bottom: unset;
    }

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

        &.count-input {
          width: 56px;
        }

        &:focus {
          border-color: var(--color-red-main);
          box-shadow: 0 0 0 2px rgba(213, 63, 83, 0.12);
        }
      }

      .auto-sep,
      .auto-unit {
        font-size: 12px;
        color: var(--color-red-desc);
        white-space: nowrap;
      }

      .track-progress {
        margin-left: auto;
        font-size: 11px;
        font-weight: 700;
        color: var(--color-red-main);
        white-space: nowrap;
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

        .status-dot {
          background: $c-success;
        }
      }

      &.fail,
      &.low {
        color: $c-fail;

        .status-dot {
          background: $c-fail;
        }
      }
    }

    .track-numbers {
      display: flex;
      align-items: center;
      gap: 2px;
      flex-wrap: wrap;

      :deep(.ball-wrapper .ball) {
        width: 1.65rem;
        height: 1.65rem;
        background: #fff;
        font-size: 0.95rem;
        border-width: 0.2rem;
      }

      .reroll-btn {
        margin-left: auto;
        border: 1px solid $c-border;
        border-radius: 4px;
        background: #fff;
        padding: 3px 8px;
        font-size: 11px;
        font-weight: 700;
        color: var(--color-red-desc);
        cursor: pointer;
        transition: border-color 0.15s, color 0.15s;

        &:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        &:hover:not(:disabled) {
          border-color: var(--color-red-main);
          color: var(--color-red-main);
        }
      }
    }
  }
}

@keyframes dot-pulse {

  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0.3;
  }
}
</style>
