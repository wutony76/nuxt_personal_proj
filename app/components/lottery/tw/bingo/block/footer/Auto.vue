<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import { useBingo } from '~/composables/useBingo'
import {
  BINGO_BET_UNIT,
  BINGO_BET_TYPES,
  BINGO_NUMBER_MIN,
  BINGO_NUMBER_MAX,
  BINGO_STAR_MIN,
  BINGO_STAR_MAX,
  type BingoBetType
} from '#shared/config/bingo'

/**
 * 賓果賓果自動下注（版面比照 P3/P4 的 footer/Auto.vue）
 *
 * 由 TwAutoPanel 統一渲染，頁面進入時以 useTwAutoActive 啟用。賓果賓果每 5 分鐘一期，「每期」
 * 在這裡指本站內部佔位期別（見 useBingo.ts）換了就自動送單一次；每次只送 1 組固定 25 元的注單
 * （超級獎號同樣 25 元／注，但屬加購性質，選擇超級獎號時不會疊加基本玩法金額），可切換投注類型
 * （基本玩法時機選星數對應個數的號碼；大小/單雙可指定固定猜哪一邊）。
 *
 * ⚠️ 各 tw 玩法的 Auto.vue 必須各自一份、不可共用同一個元件實例（見 P3 Auto.vue 檔頭同一段警語）。
 */
const { current: bingoCurrent, wallet: bingoWallet, actions: bingoActions, fetch: bingoFetch, isOpen } = useBingo()

const money = (value: number) => Number(value ?? 0).toLocaleString('zh-TW')
const BET_TYPE_LABEL: Record<string, string> = Object.fromEntries(BINGO_BET_TYPES.map((t) => [t.key, t.label]))

const state = reactive({
  enabled: false,
  betType: 'star' as BingoBetType,
  star: 5,
  bigSmallPick: '大' as '大' | '小',
  oddEvenPick: '單' as '單' | '雙',
  isRunning: false,
  lastIssue: '',
  statusText: '尚未啟用',
  statusType: 'idle'
})

const currentStatusText = computed(() => String(bingoCurrent.runtime?.currentStatus ?? '—'))

function _randomStarNumbers(star: number): number[] {
  const pool = Array.from({ length: BINGO_NUMBER_MAX - BINGO_NUMBER_MIN + 1 }, (_, i) => BINGO_NUMBER_MIN + i)
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j] as number, pool[i] as number]
  }
  return pool.slice(0, star).sort((a, b) => a - b)
}

const _handlers = {
  setStatus: (text: string, type: string) => {
    state.statusText = text
    state.statusType = type
  }
}

const _actions = {
  tryBet: () => {
    if (!state.enabled) return
    if (!isOpen.value) {
      _handlers.setStatus(`等待開盤（目前：${currentStatusText.value}）`, 'waiting')
      return
    }
    const issue = String(bingoCurrent.runtime?.issue ?? '')
    if (!issue || issue === state.lastIssue) return
    _actions.autoBet(issue)
  },
  autoBet: async (issue: string) => {
    if (state.isRunning) return
    if (Number(bingoWallet.coin ?? 0) < BINGO_BET_UNIT) {
      _handlers.setStatus(`餘額不足（${money(bingoWallet.coin)}），跳過本期`, 'low')
      return
    }
    state.isRunning = true
    _handlers.setStatus(`第${issue}期 投注中...`, 'running')
    try {
      bingoActions.clearAll()
      if (state.betType === 'star') {
        bingoActions.setStar(state.star)
        const numbers = _randomStarNumbers(state.star)
        numbers.forEach((n) => bingoActions.toggleStarNumber(n))
        bingoActions.addStarSlot()
      } else if (state.betType === 'super') {
        const numbers = _randomStarNumbers(1)
        bingoActions.setSuperNumber(numbers[0] as number)
        bingoActions.addSuperSlot()
      } else if (state.betType === 'bigSmall') {
        bingoActions.addBigSmallSlot(state.bigSmallPick)
      } else {
        bingoActions.addOddEvenSlot(state.oddEvenPick)
      }
      const result = await bingoFetch.submit()
      if (result?.ok) {
        state.lastIssue = issue
        _handlers.setStatus(`第${issue}期 — 下注成功（${money(Number(result.amount ?? 0))}）`, 'success')
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
  setBetType: (betType: BingoBetType) => { state.betType = betType },
  setStar: (star: number) => { state.star = star },
  setBigSmallPick: (pick: '大' | '小') => { state.bigSmallPick = pick },
  setOddEvenPick: (pick: '單' | '雙') => { state.oddEvenPick = pick },
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

watch([isOpen, () => bingoCurrent.runtime?.issue, currentStatusText], () => { _actions.tryBet() })
</script>

<template>
  <div class="auto-warp">
    <div class="control-auto">
      <div class="auto-header">
        <span class="auto-title">自動下注</span>
        <button class="auto-toggle" :class="{ on: state.enabled }" type="button" @click="click.toggle">
          <span class="toggle-track"><span class="toggle-thumb" /></span>
          <span class="toggle-label">{{ state.enabled ? 'ON' : 'OFF' }}</span>
        </button>
      </div>
      <div class="auto-info">
        <p class="auto-desc">※每期開盤自動送出 1 組（{{ money(BINGO_BET_UNIT) }} 元）</p>
        <div class="auto-status" :class="state.statusType">
          <span class="status-dot" />
          {{ state.statusText }}
        </div>
      </div>
      <div class="auto-coin">
        <span class="coin-label">投注類型</span>
        <div class="auto-modes" role="group" aria-label="自動下注類型">
          <button v-for="opt in BINGO_BET_TYPES" :key="opt.key" type="button" class="auto-mode"
            :class="{ 'is-active': state.betType === opt.key }" @click="click.setBetType(opt.key)">
            {{ BET_TYPE_LABEL[opt.key] }}
          </button>
        </div>
      </div>
      <div v-if="state.betType === 'star'" class="auto-coin">
        <span class="coin-label">星數</span>
        <select class="coin-input" :value="state.star" @change="click.setStar(Number(($event.target as HTMLSelectElement).value))">
          <option v-for="s in Array.from({ length: BINGO_STAR_MAX - BINGO_STAR_MIN + 1 }, (_, i) => BINGO_STAR_MIN + i)" :key="s" :value="s">{{ s }} 星</option>
        </select>
      </div>
      <div v-if="state.betType === 'bigSmall'" class="auto-coin">
        <span class="coin-label">猜哪邊</span>
        <div class="auto-modes">
          <button type="button" class="auto-mode" :class="{ 'is-active': state.bigSmallPick === '大' }" @click="click.setBigSmallPick('大')">大</button>
          <button type="button" class="auto-mode" :class="{ 'is-active': state.bigSmallPick === '小' }" @click="click.setBigSmallPick('小')">小</button>
        </div>
      </div>
      <div v-if="state.betType === 'oddEven'" class="auto-coin">
        <span class="coin-label">猜哪邊</span>
        <div class="auto-modes">
          <button type="button" class="auto-mode" :class="{ 'is-active': state.oddEvenPick === '單' }" @click="click.setOddEvenPick('單')">單</button>
          <button type="button" class="auto-mode" :class="{ 'is-active': state.oddEvenPick === '雙' }" @click="click.setOddEvenPick('雙')">雙</button>
        </div>
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

          .toggle-thumb { left: 21px; }
        }

        .toggle-label { color: var(--color-accent-700, #8c491a); }
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

      &.running, &.success { color: $c-success; }
      &.waiting { color: $c-waiting; }
      &.fail, &.low { color: $c-fail; }

      &.waiting .status-dot { background: $c-waiting; }
      &.success .status-dot { background: $c-success; }
      &.fail .status-dot, &.low .status-dot { background: $c-fail; }
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

      .coin-input {
        border: 1px solid $c-border;
        border-radius: 4px;
        background: var(--color-neutral-100, #f9f4ed);
        padding: 5px 8px;
        font-size: 13px;
        color: var(--color-accent-700, #8c491a);
        outline: none;
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
