<script setup lang="ts">
import { computed } from 'vue'
import { usePl3 } from '~/composables/usePl3'

/**
 * 投注控制（pl3 只有官方盤、單一送單流程，比照 eggs 的 Controls.vue 拿掉彩池玩法分支）
 * 金額一律夾在該分頁限額內 —— 超限伺端會整筆拒單
 */
const {
  state: mxState, currentQuota, canSubmit, isOpen,
  selectedCount, totalAmount, actions: mxActions, fetch: mxFetch
} = usePl3()

const { $dialog } = useNuxtApp()
const router = useRouter()
const QUICK_COINS = [1, 5, 10, 30, 100]
const money = (value: number) => Number(value ?? 0).toLocaleString('zh-TW')

const range = computed(() => ({ min: currentQuota.value.item.min, max: currentQuota.value.item.max }))
const canBet = computed(() => canSubmit.value)
const betLabel = computed(() =>
  selectedCount.value > 0 ? `（${selectedCount.value} 注 / ${money(totalAmount.value)}）` : ''
)

const _handlers = {
  clamp: (value: string | number) =>
    Math.min(range.value.max, Math.max(range.value.min, Math.trunc(Number(value) || 0))),
  setMoney: (value: string | number) => {
    const coin = _handlers.clamp(value)
    mxState.amount = coin
    return coin
  },
  onAmountInput: (event: Event) => {
    const target = event.target as HTMLInputElement
    target.value = String(_handlers.setMoney(target.value))
  }
}

const click = {
  /** 快捷金額是「累加」不是「設定」（按鈕文案就是 +10、+50…） */
  coin: (coin: number) => { _handlers.setMoney((Number(mxState.amount) || 0) + coin) },
  /** 清空：只還原投注金額到該分頁的單注最低額，不動已選注項（要清注項請用當前注項卡上的清空） */
  clear: () => { mxState.amount = range.value.min },
  submit: async () => {
    if (!isOpen.value) return $dialog.alert('目前非開盤中，無法投注')
    const result = await mxFetch.betsPl3()
    if ((result as { loginExpired?: boolean }).loginExpired) {
      return $dialog.alert(result.message, { cb: () => router.push('/login') })
    }
    $dialog.alert(result.ok ? `下注成功${betLabel.value}` : result.message)
  }
}
</script>

<template>
  <div class="block-main pl3-ctrl">
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
    <div class="ctrl-total">
      <span class="total-label">總注額</span>
      <span class="total-value">{{ money(totalAmount) }}</span>
    </div>

    <div class="ctrl-acts">
      <button type="button" class="submit-btn" :disabled="!canBet" @click="click.submit()">
        投注
      </button>
      <button type="button" class="clear-btn" @click="click.clear()">清空</button>
    </div>
    <p v-if="mxState.errorMessage" class="ctrl-err">{{ mxState.errorMessage }}</p>
  </div>
</template>

<style scoped lang="scss">
.pl3-ctrl {
  background: #fff;

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

      &:focus {
        border-color: var(--color-red-main);
        box-shadow: 0 0 0 2px rgba(213, 63, 83, 0.12);
      }
    }

    .ctrl-unit {
      font-size: 12px;
      color: var(--color-red-desc);
    }

    .ctrl-range {
      margin-left: auto;
      font-size: 11px;
      color: var(--color-red-desc);
    }
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

      &:hover {
        background: #fff1f2;
      }
    }
  }

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

  .submit-btn {
    height: 45px;
    border: 1px solid #e98e5c;
    border-radius: 4px;
    background: var(--color-yellow-black-btn);
    padding: 0 12px;
    font-size: 14px;
    font-weight: 700;
    color: var(--color-yellow-btn-text);
    cursor: pointer;
    transition: filter 0.15s ease, transform 0.15s ease;

    &:hover:not(:disabled) {
      filter: brightness(1.08) saturate(1.2);
      transform: translateY(-1px);
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }

  .ctrl-acts {
    display: flex;
    gap: 6px;

    .submit-btn {
      flex: 1 1 auto;
    }

    .clear-btn {
      flex: 0 0 auto;
      height: 45px;
      border: 1px solid var(--color-red-main);
      border-radius: 4px;
      background: #fff;
      padding: 0 16px;
      font-size: 14px;
      font-weight: 700;
      color: var(--color-red-main);
      cursor: pointer;

      &:hover {
        background: #fff1f2;
      }
    }
  }

  .ctrl-err {
    margin: 8px 0 0;
    font-size: 12px;
    font-weight: 700;
    color: #dc2626;
  }
}
</style>
