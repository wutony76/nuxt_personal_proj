<script setup lang="ts">
import { computed } from 'vue'
import { useK3 } from '~/composables/useK3'

/**
 * 投注控制（信用盤 / 官方盤共用）
 * 金額一律夾在該分頁限額內 —— 超限伺端會整筆拒單
 */
const {
  state: mxState, currentQuota, canSubmit, isOpen, isCd,
  selectedCount, totalAmount, ofPicked, ofPicks, actions: mxActions, fetch: mxFetch,
  ogQuota, ogSelectedCount, ogTotalAmount, canSubmitOg, isOgPool
} = useK3()

const { $dialog } = useNuxtApp()
const QUICK_COINS = [1, 5, 10, 30, 100]
const money = (value: number) => Number(value ?? 0).toLocaleString('zh-TW')

/**
 * 單注限額
 *   信用盤          → 該分頁 settings.quota
 *   官方盤賠率玩法  → k3og 該分頁 settings.quota
 *   官方盤彩池玩法  → 伺端 K3_OF_QUOTA（⚠️ 這組值是手抄的，改伺端要一起改）
 */
const range = computed(() => {
  if (isCd.value) return { min: currentQuota.value.item.min, max: currentQuota.value.item.max }
  if (!isOgPool.value) return { min: ogQuota.value.item.min, max: ogQuota.value.item.max }
  return { min: 2, max: 10000 }
})

const canBet = computed(() => {
  if (isCd.value) return canSubmit.value
  return isOgPool.value ? isOpen.value && ofPicked.value : canSubmitOg.value
})
const betLabel = computed(() => {
  if (isCd.value) return selectedCount.value > 0 ? `（${selectedCount.value} 注 / ${money(totalAmount.value)}）` : ''
  if (!isOgPool.value) {
    return ogSelectedCount.value > 0 ? `（${ogSelectedCount.value} 注 / ${money(ogTotalAmount.value)}）` : ''
  }
  return ofPicked.value ? `（${ofPicks.list.join('、')}）` : ''
})

/** 總下注額度：信用盤／官方盤賠率玩法都是合計，彩池玩法是單注金額 */
const totalBetAmount = computed(() => {
  if (isCd.value) return totalAmount.value
  if (!isOgPool.value) return ogTotalAmount.value
  return ofPicked.value ? Number(mxState.amount) : 0
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
  /** 快捷金額是「累加」不是「設定」（按鈕文案就是 +10、+50…），同 6hc-of Coin.vue 的 add */
  coin: (coin: number) => { _handlers.setMoney((Number(mxState.amount) || 0) + coin) },
  /**
   * 清空：只還原投注金額到該分頁的單注最低額
   *
   * ⚠️ 不動當前注項 —— 既不清掉已選注項，也不透過 setAmount 去改它們的金額
   *    （setAmount 會把已選注項一起同步成新金額）。要清注項請用當前注項卡上的清空。
   */
  clear: () => {
    mxState.amount = range.value.min
  },
  submit: async () => {
    if (!isOpen.value) return $dialog.alert('目前非開盤中，無法投注')
    if (!isCd.value && isOgPool.value && !ofPicked.value) return $dialog.alert('請選滿 3 個點數')
    const result = isCd.value
      ? await mxFetch.bets()
      : isOgPool.value ? await mxFetch.betsOf() : await mxFetch.betsOg()
    $dialog.alert(result.ok ? `下注成功${betLabel.value}` : result.message)
    if (result.ok) await mxFetch.userRecordAll()
  }
}
</script>

<template>
  <div class="block-main k3-ctrl">
    <!-- <div class="ctrl-head">投注金額</div> -->
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
      <span class="total-label">總注額</span>
      <span class="total-value">{{ money(totalBetAmount) }}</span>
    </div>

    <div class="ctrl-acts">
      <button type="button" class="submit-btn" :disabled="!canBet" @click="click.submit()">
        <!-- 確認投注{{ betLabel }} -->
        投注
      </button>
      <button type="button" class="clear-btn" @click="click.clear()">清空</button>
    </div>
    <p v-if="mxState.errorMessage" class="ctrl-err">{{ mxState.errorMessage }}</p>
  </div>
</template>

<style scoped lang="scss">
.k3-ctrl {
  background: #fff;

  .ctrl-head {
    margin-bottom: 8px;
    font-size: 13px;
    font-weight: 700;
    color: var(--color-red-main);
  }

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

  /**
   * 投注鈕：樣式對齊 6hc-of 的 .action-btn.bet
   * 基底來自 app/assets/style/lhc_of.scss（radius 4px／字重 700／黃底墨黃字 ＋ #e98e5c 描邊），
   * 高度 45px／字級 14px／hover 與 disabled 取自
   * app/components/lottery/bg/6hc/of/block/controls/Coin.vue。
   */
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
      /* 高度跟著投注鈕的 45px，同一列才不會錯位 */
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
