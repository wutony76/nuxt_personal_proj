<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import { STATUS_TIME } from '~/config/constants'
import { useSsc } from '~/composables/useSsc'

/**
 * 時時彩官方盤自動下注（版面與 6hc-of / k3-of 的 footer/Auto.vue 同一套）
 *
 * 由 app.vue 的 BgAutoPanel 統一渲染，頁面進入時以 useBgAutoActive 啟用。
 * 隨機方式依當前分頁型態不同：
 *   單選分頁（定位膽）—— 從該分頁注碼隨機取 N 個
 *   複式分頁（其餘 10 個）—— 每一格隨機挑號碼／面，展開到注數 ≥ N
 *                          （注數是乘積或組合數，故為「至少 N 注」）
 *
 * ⚠️ 與信用盤分成兩個元件（cd/of 各一個 footer/Auto.vue）而不是一個元件用 isCd 分流 ——
 *    BgAutoPanel 的 v-if 鏈若用同一個元件，Vue 會就地 patch 保留 instance，
 *    切換盤口時 enabled 會殘留、對另一個盤口偷偷下注（6hc 與 k3 也是各自一個元件）。
 * ⚠️ 走 fetch.autoBetsOf（直接組 payload），不動使用者手動填的注項；
 *    但送單成功後會與手動下注一樣清空選取。
 */
const {
  current: mxCurrent, wallet: mxWallet, fetch: mxFetch,
  of: mxOf, ofPlayList, ofQuota, ofAutoMaxCount, ofCombo
} = useSsc()

const money = (value: number) => Number(value ?? 0).toLocaleString('zh-TW')

/** 每注金額限額依當前分頁的 sscof settings.quota，超限伺端會整筆拒單 */
const minAmount = computed(() => ofQuota.value.item.min)
const maxAmount = computed(() => ofQuota.value.item.max)

const state = reactive({
  enabled: false,
  betAmount: 10,
  betCount: 5,
  isRunning: false,
  /** 已自動投注過的期數，避免同期重複下注 */
  lastIssue: '',
  statusText: '尚未啟用',
  statusType: 'idle'
})

// --- COMPUTED ---
const isOpen = computed(() => String(mxCurrent.runtime?.currentStatus ?? '') === STATUS_TIME.OPEN)
/** 當前期別狀態（待命文字要寫出來，讓人知道是還沒開盤而不是壞了） */
const currentStatusText = computed(() => String(mxCurrent.runtime?.currentStatus ?? '—'))
/**
 * 注數上限＝該分頁全選能組出幾注（複式再夾 SSC_OF_MAX_COMBO）
 * ⚠️ 不能用「目前已選展開的注數」—— 自動下注時使用者根本沒選號，那個值是 0。
 */
const maxCount = computed(() => Math.max(1, ofAutoMaxCount.value || 1))
const totalCost = computed(() => state.betCount * state.betAmount)
const playInfo = computed(() => {
  const play = ofPlayList.value.find((item) => item.key === mxOf.play)?.name || '-'
  const tab = mxOf.tabName || '-'
  if (ofCombo.value) {
    return `${play} / ${tab}：隨機選號組成 ${state.betCount} 注以上（上限 ${maxCount.value} 注）`
  }
  return `${play} / ${tab}：隨機 ${state.betCount} 注（上限 ${maxCount.value} 注）`
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
  }
}

const _actions = {
  /** 開盤中 + 該期尚未自動投注 → 投注（以期數為單位，避免一期內重複觸發） */
  tryBet: () => {
    if (!state.enabled) return
    if (!isOpen.value) {
      // 待命中：寫出當下卡在哪個階段，否則只看到「等待開盤...」會以為是壞了
      _handlers.setStatus(`等待開盤（目前：${currentStatusText.value}）`, 'waiting')
      return
    }
    const issue = String(mxCurrent.runtime?.issueCurrent ?? '')
    if (!issue || issue === state.lastIssue) return
    _actions.autoBet(issue)
  },
  autoBet: async (issue: string) => {
    if (state.isRunning) return
    if (ofAutoMaxCount.value === 0) {
      _handlers.setStatus('玩法未載入，跳過本期', 'low')
      return
    }
    if (Number(mxWallet.coin ?? 0) < totalCost.value) {
      _handlers.setStatus(`餘額不足（${money(mxWallet.coin)}），跳過本期`, 'low')
      return
    }
    state.isRunning = true
    _handlers.setStatus(`第${issue}期 投注中...`, 'running')
    try {
      const result = await mxFetch.autoBetsOf({ count: state.betCount, amount: state.betAmount })
      if (result?.ok) {
        state.lastIssue = issue
        _handlers.setStatus(
          `第${issue}期 — 下注成功（${Number(result.count ?? 0)} 注 / ${money(Number(result.amount ?? 0))}）`,
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
    // 開啟時若已在開盤中就直接投注本期，否則等下一期開盤
    state.lastIssue = ''
    _handlers.setStatus(`等待開盤（目前：${currentStatusText.value}）`, 'waiting')
    _actions.tryBet()
  }
}

watch([isOpen, () => mxCurrent.runtime?.issueCurrent, currentStatusText], () => { _actions.tryBet() })
// 切換玩法／分頁時把金額與注數夾回新分頁的限額，否則自動投注會整期被伺端拒單
watch([minAmount, maxAmount], () => {
  state.betAmount = _handlers.normalizeAmount(state.betAmount)
}, { immediate: true })
watch(maxCount, () => {
  state.betCount = _handlers.normalizeCount(state.betCount)
}, { immediate: true })
// 換玩法／分頁視為新設定，允許本期重新投注一次（否則要等下一期）
watch([() => mxOf.play, () => mxOf.tabId], () => {
  state.lastIssue = ''
})
</script>

<template>
  <div class="auto-warp">
    <!-- 自動投注 -->
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
        <p class="auto-desc">※每期開盤隨機下注</p>
        <div class="auto-status" :class="state.statusType">
          <span class="status-dot" />
          {{ state.statusText }}
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
        <input type="number" min="1" :max="maxCount" class="coin-input count-input" :value="state.betCount"
          @input="_handlers.onCountInput" @blur="_handlers.onCountInput" />
        <span class="auto-unit">注 / 共 {{ money(totalCost) }}</span>
      </div>
      <div class="auto-play-info">
        <span class="coin-label">玩法</span>
        <span class="play-val">{{ playInfo }}</span>
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
