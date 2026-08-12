<script setup lang="ts">
import { computed } from 'vue'
import { useK3 } from '~/composables/useK3'

/**
 * 投注控制（信用盤 / 官方盤共用）
 * 金額一律夾在該分頁限額內 —— 超限伺端會整筆拒單
 */
const {
  state: mxState, currentQuota, canSubmit, isOpen, isCd, isBetModeNormal,
  selectedCount, totalAmount, ofPicked, ofPicks, actions: mxActions, fetch: mxFetch
} = useK3()

/** 投注模式（對齊 pcv2 的 MODE_BET.NORMAL / FAST） */
const BET_MODES = [
  { key: 'normal' as const, label: '一般', hint: '逐項填金額' },
  { key: 'fast' as const, label: '快速', hint: '點選即套用共用金額' }
]

const { $dialog } = useNuxtApp()
const QUICK_COINS = [10, 50, 100, 300, 1000]
const money = (value: number) => Number(value ?? 0).toLocaleString('zh-TW')

// 官方盤的限額寫在伺端 K3_OF_QUOTA，信用盤讀該分頁 settings.quota
const range = computed(() => (isCd.value
  ? { min: currentQuota.value.item.min, max: currentQuota.value.item.max }
  : { min: 10, max: 5000 }))

const canBet = computed(() => (isCd.value ? canSubmit.value : isOpen.value && ofPicked.value))
const betLabel = computed(() => {
  if (isCd.value) return selectedCount.value > 0 ? `（${selectedCount.value} 注 / ${money(totalAmount.value)}）` : ''
  return ofPicked.value ? `（${ofPicks.list.join('、')}）` : ''
})

/** fast 模式編輯的是共用金額（moneyFast），其餘編輯 amount */
const currentMoney = computed(() => (isCd.value && !isBetModeNormal.value ? mxState.moneyFast : mxState.amount))

const _handlers = {
  clamp: (value: string | number) =>
    Math.min(range.value.max, Math.max(range.value.min, Math.trunc(Number(value) || 0))),
  setMoney: (value: string | number) => {
    const coin = _handlers.clamp(value)
    if (isCd.value && !isBetModeNormal.value) mxActions.setMoneyFast(coin)
    else mxState.amount = coin
    return coin
  },
  onAmountInput: (event: Event) => {
    const target = event.target as HTMLInputElement
    target.value = String(_handlers.setMoney(target.value))
  }
}

const click = {
  coin: (coin: number) => { _handlers.setMoney(coin) },
  submit: async () => {
    if (!isOpen.value) return $dialog.alert('目前非開盤中，無法投注')
    if (!isCd.value && !ofPicked.value) return $dialog.alert('請選滿 3 個點數')
    const result = isCd.value ? await mxFetch.bets() : await mxFetch.betsOf()
    $dialog.alert(result.ok ? `下注成功${betLabel.value}` : result.message)
    if (result.ok) await mxFetch.userRecordAll()
  }
}
</script>

<template>
  <div class="block-main k3-ctrl">
    <!-- 投注模式切換：僅信用盤有（官方盤一注固定 3 個點數，沒有逐項金額的概念） -->
    <div v-if="isCd" class="ctrl-modes">
      <button v-for="mode in BET_MODES" :key="mode.key" type="button" class="mode-btn"
        :class="{ active: mxState.betMode === mode.key }" @click="mxActions.setBetMode(mode.key)">
        {{ mode.label }}
      </button>
      <span class="mode-hint">{{ BET_MODES.find((m) => m.key === mxState.betMode)?.hint }}</span>
    </div>

    <div class="ctrl-head">{{ isCd && !isBetModeNormal ? '共用金額' : '投注金額' }}</div>
    <div class="ctrl-row">
      <input type="number" :min="range.min" :max="range.max" class="ctrl-input" :value="currentMoney"
        @input="_handlers.onAmountInput" @blur="_handlers.onAmountInput" />
      <span class="ctrl-unit">元</span>
      <span class="ctrl-range">{{ money(range.min) }} — {{ money(range.max) }}</span>
    </div>
    <div class="ctrl-quick">
      <button v-for="coin in QUICK_COINS" :key="coin" type="button" class="quick-btn" @click="click.coin(coin)">
        +{{ coin }}
      </button>
    </div>
    <div class="ctrl-acts">
      <button type="button" class="submit-btn" :disabled="!canBet" @click="click.submit()">
        確認投注{{ betLabel }}
      </button>
      <button type="button" class="clear-btn"
        @click="isCd ? mxActions.clearSelect() : mxActions.clearOfPicks()">清空</button>
    </div>
    <p v-if="mxState.errorMessage" class="ctrl-err">{{ mxState.errorMessage }}</p>
  </div>
</template>

<style scoped lang="scss">
.k3-ctrl {
  background: #fff;

  .ctrl-head { margin-bottom: 8px; font-size: 13px; font-weight: 700; color: var(--color-red-main); }

  .ctrl-row {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 8px;

    .ctrl-input {
      width: 5.4rem;
      border: 1px solid var(--color-red-content);
      border-radius: 4px;
      padding: 5px 7px;
      text-align: right;
      font-size: 14px;
      font-weight: 700;
      color: var(--color-red-main);
      outline: none;

      &:focus { border-color: var(--color-red-main); box-shadow: 0 0 0 2px rgba(213, 63, 83, 0.12); }
    }

    .ctrl-unit { font-size: 12px; color: var(--color-red-desc); }
    .ctrl-range { margin-left: auto; font-size: 11px; color: var(--color-red-desc); }
  }

  .ctrl-quick {
    display: flex;
    gap: 4px;
    margin-bottom: 10px;

    .quick-btn {
      flex: 1;
      border: 1px solid var(--color-red-content);
      border-radius: 4px;
      background: #fff;
      padding: 4px 0;
      font-size: 12px;
      font-weight: 700;
      color: var(--color-red-main);
      cursor: pointer;

      &:hover { background: #fff1f2; }
    }
  }

  .submit-btn {
    width: 100%;
    border: none;
    border-radius: 4px;
    background: linear-gradient(180deg, #e11d48, #9f1239);
    padding: 10px 0;
    font-size: 15px;
    font-weight: 700;
    letter-spacing: 0.08em;
    color: #fff;
    cursor: pointer;
    transition: filter 0.15s;

    &:hover:not(:disabled) { filter: brightness(1.08); }
    &:disabled { opacity: 0.45; cursor: not-allowed; }
  }

  .ctrl-modes {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-bottom: 10px;

    .mode-btn {
      border: 1px solid var(--color-red-content);
      border-radius: 4px;
      background: #fff;
      padding: 3px 12px;
      font-size: 12px;
      font-weight: 700;
      color: var(--color-red-main);
      cursor: pointer;

      &.active { border-color: var(--color-red-main); background: var(--color-red-main); color: #fff; }
    }

    .mode-hint { font-size: 11px; color: var(--color-red-desc); }
  }

  .ctrl-acts {
    display: flex;
    gap: 6px;

    .submit-btn { flex: 1 1 auto; }

    .clear-btn {
      flex: 0 0 auto;
      border: 1px solid var(--color-red-main);
      border-radius: 4px;
      background: #fff;
      padding: 10px 16px;
      font-size: 14px;
      font-weight: 700;
      color: var(--color-red-main);
      cursor: pointer;

      &:hover { background: #fff1f2; }
    }
  }

  .ctrl-err { margin: 8px 0 0; font-size: 12px; font-weight: 700; color: #dc2626; }
}
</style>
