<script setup lang="ts">
import { computed } from 'vue'
import { useK3 } from '~/composables/useK3'

/**
 * 投注控制（信用盤 / 官方盤共用）
 * 金額一律夾在該分頁限額內 —— 超限伺端會整筆拒單
 */
const {
  state: mxState, currentQuota, canSubmit, isOpen, isCd,
  selectedCount, totalAmount, ofPicked, ofPicks, fetch: mxFetch
} = useK3()

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

const _handlers = {
  clamp: (value: string | number) =>
    Math.min(range.value.max, Math.max(range.value.min, Math.trunc(Number(value) || 0))),
  onAmountInput: (event: Event) => {
    const target = event.target as HTMLInputElement
    const val = _handlers.clamp(target.value)
    mxState.amount = val
    target.value = String(val)
  }
}

const click = {
  coin: (coin: number) => { mxState.amount = _handlers.clamp(coin) },
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
    <div class="ctrl-head">投注金額</div>
    <div class="ctrl-row">
      <input type="number" :min="range.min" :max="range.max" class="ctrl-input" :value="mxState.amount"
        @input="_handlers.onAmountInput" @blur="_handlers.onAmountInput" />
      <span class="ctrl-unit">元</span>
      <span class="ctrl-range">{{ money(range.min) }} — {{ money(range.max) }}</span>
    </div>
    <div class="ctrl-quick">
      <button v-for="coin in QUICK_COINS" :key="coin" type="button" class="quick-btn" @click="click.coin(coin)">
        +{{ coin }}
      </button>
    </div>
    <button type="button" class="submit-btn" :disabled="!canBet" @click="click.submit()">
      投注{{ betLabel }}
    </button>
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

  .ctrl-err { margin: 8px 0 0; font-size: 12px; font-weight: 700; color: #dc2626; }
}
</style>
