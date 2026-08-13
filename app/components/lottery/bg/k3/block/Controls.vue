<script setup lang="ts">
import { computed } from 'vue'
import { useK3 } from '~/composables/useK3'

/**
 * 投注控制（信用盤 / 官方盤共用）
 * 金額一律夾在該分頁限額內 —— 超限伺端會整筆拒單
 */
const {
  state: mxState, currentQuota, canSubmit, isOpen, isCd,
  selectedCount, totalAmount, ofPicked, ofPicks, actions: mxActions, fetch: mxFetch
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
  /** 信用盤改金額要一併更新已選注項（點注項時套用的就是這個值） */
  setMoney: (value: string | number) => {
    const coin = _handlers.clamp(value)
    if (isCd.value) mxActions.setAmount(coin)
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
    <!-- 總下注額度：信用盤是已選注項金額合計，官方盤是選滿 3 個點數後的單注金額 -->
    <div class="ctrl-total">
      <span class="total-label">總下注額度</span>
      <span class="total-value">{{ money(isCd ? totalAmount : (ofPicked ? Number(mxState.amount) : 0)) }}</span>
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

  /* 總下注額度：擺在確認投注鈕上方 */
  .ctrl-total {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 8px;
    border-top: 1px dashed var(--color-red-content);
    padding-top: 8px;

    .total-label {
      font-size: 13px;
      font-weight: 700;
      color: var(--color-red-desc);
    }

    .total-value {
      font-size: 12px;
      font-weight: 800;
      color: var(--color-red-main);
      font-variant-numeric: tabular-nums;
    }
  }

  /* 黃色投注鈕（色票取專案既有的 --color-yellow-black-btn / --color-yellow-btn-text） */
  .submit-btn {
    width: 100%;
    border: none;
    border-radius: 4px;
    background: var(--color-yellow-black-btn);
    padding: 10px 0;
    font-size: 15px;
    font-weight: 700;
    letter-spacing: 0.08em;
    color: var(--color-yellow-btn-text);
    cursor: pointer;
    transition: filter 0.15s;

    &:hover:not(:disabled) { filter: brightness(1.08); }
    &:disabled { opacity: 0.45; cursor: not-allowed; }
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
