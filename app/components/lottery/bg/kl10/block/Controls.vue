<script setup lang="ts">
import { computed } from 'vue'
import { useKl10 } from '~/composables/useKl10'

/**
 * 投注控制（快樂十分只有信用盤，比照 eggs 的 Controls.vue）
 * 金額一律夾在該分頁限額內 —— 超限伺端會整筆拒單
 *
 * ⚠️ 任選分頁的金額欄是「單注金額」（每個組合各下這個金額），與表格看板的
 *    「點注項時套用的金額」是兩個不同的 state（renxuan.amount / state.amount），
 *    所以這裡的輸入與投注都要依 isRenxuan 分流，不能只改一邊。
 */
const {
  state: mxState, currentQuota, canSubmit, isOpen,
  selectedCount, totalAmount, actions: mxActions, fetch: mxFetch,
  isRenxuan, renxuan: mxRenxuan, renxuanCombos, currentChosen
} = useKl10()

const { $dialog } = useNuxtApp()
const router = useRouter()
const QUICK_COINS = [1, 5, 10, 30, 100]
const money = (value: number) => Number(value ?? 0).toLocaleString('zh-TW')

const range = computed(() => ({ min: currentQuota.value.item.min, max: currentQuota.value.item.max }))
const canBet = computed(() => canSubmit.value)
/** 注數：表格看板算已選注項數，任選算展開後的組合數 */
const betCount = computed(() => (isRenxuan.value ? renxuanCombos.value.length : selectedCount.value))
const betLabel = computed(() =>
  betCount.value > 0 ? `（${betCount.value} 注 / ${money(totalAmount.value)}）` : ''
)
/** 畫面顯示的金額欄：任選是單注金額 */
const inputAmount = computed(() => (isRenxuan.value ? mxRenxuan.amount : mxState.amount))
const amountLabel = computed(() => (isRenxuan.value ? '單注' : '金額'))
const totalBetAmount = computed(() => totalAmount.value)

const _handlers = {
  clamp: (value: string | number) =>
    Math.min(range.value.max, Math.max(range.value.min, Math.trunc(Number(value) || 0))),
  /** 改金額要一併更新已選注項（點注項時套用的就是這個值）；任選改的是單注金額 */
  setMoney: (value: string | number) => {
    const coin = _handlers.clamp(value)
    if (isRenxuan.value) mxActions.setRenxuanAmount(coin)
    else mxActions.setAmount(coin)
    return coin
  },
  onAmountInput: (event: Event) => {
    const target = event.target as HTMLInputElement
    target.value = String(_handlers.setMoney(target.value))
  }
}

const click = {
  /** 快捷金額是「累加」不是「設定」（按鈕文案就是 +10、+50…），同 k3 的做法 */
  coin: (coin: number) => { _handlers.setMoney((Number(inputAmount.value) || 0) + coin) },
  /**
   * 清空：只還原投注金額到該分頁的單注最低額
   * ⚠️ 不動當前注項 —— 要清注項請用當前注項卡上的清空
   */
  clear: () => {
    if (isRenxuan.value) mxActions.setRenxuanAmount(range.value.min)
    else mxState.amount = range.value.min
  },
  submit: async () => {
    if (!isOpen.value) return $dialog.alert('目前非開盤中，無法投注')
    // 任選走複式送單（在 composable 內展開成 C(k, N) 注）
    const result = isRenxuan.value ? await mxFetch.betsRenxuan() : await mxFetch.bets()
    if ((result as { loginExpired?: boolean }).loginExpired) {
      return $dialog.alert(result.message, { cb: () => router.push('/login') })
    }
    $dialog.alert(result.ok ? `下注成功${betLabel.value}` : result.message)
  }
}
</script>

<template>
  <div class="block-main kl10-ctrl">
    <div class="ctrl-row">
      <input type="number" :min="range.min" :max="range.max" class="ctrl-input" :value="inputAmount"
        @input="_handlers.onAmountInput" @blur="_handlers.onAmountInput" />
      <span class="ctrl-unit">{{ amountLabel }}</span>
      <span class="ctrl-range">{{ money(range.min) }} — {{ money(range.max) }}</span>
    </div>
    <div class="ctrl-quick">
      <button v-for="coin in QUICK_COINS" :key="coin" type="button" class="quick-btn" @click="click.coin(coin)">
        +{{ coin }}
      </button>
    </div>
    <div class="ctrl-total">
      <span class="total-label">總注額</span>
      <span class="total-value">{{ money(totalBetAmount) }}</span>
    </div>
    <p v-if="isRenxuan" class="ctrl-note">
      {{ mxState.selectTabName }}：一注 {{ currentChosen?.pick ?? 0 }} 碼，
      目前 {{ betCount }} 注（單注 {{ money(mxRenxuan.amount) }}）
    </p>

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
.kl10-ctrl {
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

  .ctrl-note {
    margin: 0;
    font-size: 11px;
    font-weight: 600;
    color: var(--color-red-desc);
    text-align: center;
  }

  .ctrl-err {
    margin: 8px 0 0;
    font-size: 12px;
    font-weight: 700;
    color: #dc2626;
  }
}
</style>
