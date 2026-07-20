<script setup lang="ts">
import { computed } from 'vue'
import { actions } from '~/utils/common'
import { STATUS_TIME } from '~/config/constants'
import { use6hcCredit } from '~/composables/use6hcCredit'

// const QUICK_AMOUNTS = [5, 20, 100, 500, 900]
const QUICK_AMOUNTS = [1, 5, 20, 50, 100, 300]
const MAX_COIN = 99999
const { $dialog } = useNuxtApp()
const credit = use6hcCredit()
const { state: mxState, current, select: mxSelect, fetch: mxFetch } = credit

const isOpen = computed(() => String(current.runtime?.currentStatus ?? '') === STATUS_TIME.OPEN)
// const totalBet = computed(() => mxState.selectedCodes.length * Number(mxState.amount || 0))
const totalBet = computed(() => mxSelect.items.reduce((acc, item) => acc + Number(item.coin || 0), 0) || 0)
const submitting = computed(() => mxState.submitStatus === 'loading')
const hasBet = computed(() => mxSelect.items.some((item) => Number(item.coin) > 0))
const canSubmit = computed(() => isOpen.value && hasBet.value && !submitting.value)
const submitLabel = computed(() => (isOpen.value ? '投注' : '尚未開盤'))

const _handlers = {
  normalizeAmount: (val: string | number) => Math.min(MAX_COIN, Math.max(1, Math.trunc(Number(val) || 1))),
}

const click = {
  addAmount: (n: number) => {
    mxState.amount = _handlers.normalizeAmount(Number(mxState.amount || 0) + n)
  },
  onAmountInput: (event: Event) => {
    const target = event.target as HTMLInputElement
    const normalized = _handlers.normalizeAmount(target.value)
    mxState.amount = normalized
    // 夾值後強制寫回 DOM value：避免夾值結果與現有 state 相同時，
    // Vue 判斷值未變而不更新畫面，導致輸入框仍顯示未受限的原始數字
    target.value = String(normalized)
  },
  bet: () => {
    if (submitting.value) return
    if (!isOpen.value) return $dialog.alert('請等待開盤')
    if (!hasBet.value) return $dialog.alert('尚未選擇注項')

    mxFetch.bets().then(() => {
      if (mxState.submitStatus === 'success') $dialog.alert(mxState.message || '下注成功')
      else if (mxState.submitStatus === 'error') $dialog.alert(mxState.errorMessage || '下注失敗')
    })
  },
  toggleCurrItems: () => {
    mxSelect.show = !mxSelect.show
  },
}
</script>

<template>
  <div class="controls-wrap">
    <div class="left">
      <!-- 快選金額 -->
      <div class="quick-row">
        <button v-for="n in QUICK_AMOUNTS" :key="n" type="button" class="quick-btn" @click="click.addAmount(n)">
          +{{ n }}
        </button>
      </div>
      <!-- 金額 / 總投注 -->
      <div class="amount-row">
        <label class="amount-field">
          <span class="amount-label">投注金額(注)</span>
          <input type="number" min="1" :max="MAX_COIN" class="amount-input" :value="mxState.amount"
            @input="click.onAmountInput" />
        </label>
        <span class="total" :class="{ 'has-bet': totalBet > 0 }">
          總投注：<strong class="total-value">{{ actions.thousands(totalBet) }}</strong>
        </span>
      </div>
      <button type="button" class="btn-detail" :class="{ active: mxSelect.show }" @click="click.toggleCurrItems">
        當前注項
      </button>
    </div>
    <div class="right">
      <button type="button" class="submit-btn" :class="{ open: canSubmit }" @click="click.bet">
        投注
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.controls-wrap {
  position: relative;
  width: 570px;
  display: flex;
  flex-direction: row;
  align-items: stretch;
  gap: 10px;
  padding: 12px;
  background: linear-gradient(180deg, #ffffff 0%, #fff6f7 100%);
  border: 2px solid #7f1d1d;
  border-radius: 6px;
  box-shadow: 0 10px 28px rgba(127, 29, 29, 0.2), 0 2px 6px rgba(127, 29, 29, 0.1);

  /* 頂部漸層飾條（自帶圓角，避免外層需要 overflow: hidden 而擋住 .total） */
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 5px;
    background: linear-gradient(90deg, #7f1d1d 0%, #c9a227 50%, #7f1d1d 100%);
  }

  /* 左側：金額區（縱向） */
  .left {
    position: relative;
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 5px;

    /* 總投注 */
    .total {
      position: absolute;
      bottom: -39px;
      right: 0px;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
      font-weight: 600;
      color: var(--color-red-desc);
      white-space: nowrap;
      transition: color 0.2s ease;

      .total-value {
        font-size: 14px;
        font-weight: 800;
        color: var(--color-red-main);
      }

      /* 有投注金額時，加強視覺提示 */
      &.has-bet {
        color: var(--color-red-desc);

        .total-value {
          text-shadow: 0 1px 2px rgba(127, 29, 29, 0.2);
        }
      }
    }

    .btn-detail {
      position: absolute;
      bottom: -40px;
      right: -90px;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      flex-shrink: 0;
      border: 1px solid var(--color-red-desc);
      border-radius: 3px;
      background: #fde1e5;
      padding: 2px 8px;
      font-size: 11px;
      font-weight: 700;
      color: var(--color-red-desc);
      cursor: pointer;
      white-space: nowrap;
      box-shadow: 0 2px 6px rgba(127, 29, 29, 0.12);
      transition: all 0.18s ease;

      &:hover {
        border-color: var(--color-red-main);
        background: linear-gradient(180deg, #fff5f6 0%, #ffe1e5 100%);
        color: var(--color-red-main);
        box-shadow: 0 4px 12px rgba(185, 28, 28, 0.22);
        transform: translateY(-1px);
      }

      &:active {
        transform: translateY(0) scale(0.95);
        box-shadow: 0 1px 4px rgba(127, 29, 29, 0.15);
      }

      /* 面板開啟中：填色回饋 */
      &.active {
        border-color: var(--color-red-main);
        background: var(--color-red-main);
        color: #fff;
      }
    }
  }

  /* 右側：送出鈕 */
  .right {
    width: 40%;
    flex-shrink: 0;
    display: flex;
    display: flex;
    align-items: center;
    justify-content: end;


    .submit-btn {
      width: 200px;
      height: 50px;
      min-height: unset;
      border-radius: 6px;
    }
  }

  /* 快選金額 */
  .quick-row {
    display: flex;
    justify-content: space-between;
    gap: 5px;
    flex-wrap: wrap;

    .quick-btn {
      border: 1px solid #f3b7bf;
      border-radius: 4px;
      background: #fff;
      padding: 4px 10px;
      font-size: 12px;
      font-weight: 700;
      color: var(--color-red-main);
      cursor: pointer;
      transition: all 0.15s ease;
      // flex: 1;
      // height: 34px;
      // border: 1px solid #f2b7c1;
      // border-radius: 6px;
      // background: linear-gradient(180deg, #fff 0%, #fff2f4 100%);
      // font-size: 14px;
      // font-weight: 800;
      // color: var(--color-red-main);
      // cursor: pointer;
      // transition: all 0.18s ease;
      // box-shadow: 0 1px 2px rgba(127, 29, 29, 0.08);

      &:hover {
        background: linear-gradient(180deg, #dc2626 0%, #b91c1c 100%);
        border-color: var(--color-red-main);
        color: #fff;
        box-shadow: 0 3px 10px rgba(185, 28, 28, 0.35);
        transform: translateY(-1px);
      }

      &:active {
        transform: translateY(0) scale(0.95);
      }
    }
  }

  /* 金額 / 總投注 */
  .amount-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;

    .amount-field {
      display: flex;
      align-items: center;
      gap: 8px;

      .amount-label {
        font-size: 13px;
        font-weight: 700;
        color: var(--color-red-desc);
        white-space: nowrap;
      }

      /* 參考 6hc-of coin-input 樣式 */
      .amount-input {
        width: 108px;
        height: 32px;
        border: 1px solid #f3b7bf;
        border-radius: 6px;
        background: #fff;
        padding: 4px 10px;
        text-align: right;
        font-size: 14px;
        font-weight: 700;
        color: var(--color-red-main);
        outline: none;
        transition: border-color 0.15s ease, box-shadow 0.15s ease;

        &:focus {
          border-color: var(--color-red-main);
          box-shadow: 0 0 0 3px rgba(213, 63, 83, 0.15);
        }
      }
    }

    /* 注項查詢：次要動作，走 outline 樣式 */
    .query-btn {
      flex-shrink: 0;
      border: 1px solid var(--color-red-desc);
      border-radius: 999px;
      background: transparent;
      padding: 4px 12px;
      font-size: 12px;
      font-weight: 600;
      color: var(--color-red-desc);
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.15s ease;

      &:hover {
        border-color: var(--color-red-main);
        background: rgba(127, 29, 29, 0.06);
        color: var(--color-red-main);
      }

      &:active {
        transform: scale(0.96);
      }
    }
  }

  /* 送出鈕（右側，撐滿高度） */
  .submit-btn {
    position: relative;
    overflow: hidden;
    width: 100%;
    height: 100%;
    min-height: 74px;
    border: none;
    border-radius: 10px;
    /* 尚未開盤：暖金 */
    // background: linear-gradient(160deg, #e6d29a 0%, #cbb069 100%);
    background: linear-gradient(160deg, #dc2626 0%, #b91c1c 55%, #d97706 100%);
    color: #fff;
    font-size: 17px;
    font-weight: 800;
    letter-spacing: 0.12em;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.18);
    cursor: not-allowed;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.35);
    transition: all 0.18s ease;

    /* 金光掃過 */
    &::after {
      content: '';
      position: absolute;
      top: 0;
      left: -150%;
      width: 55%;
      height: 100%;
      background: linear-gradient(100deg,
          transparent 0%,
          rgba(255, 255, 255, 0.15) 40%,
          rgba(255, 255, 255, 0.75) 50%,
          rgba(255, 255, 255, 0.15) 60%,
          transparent 100%);
      transform: skewX(-20deg);
      pointer-events: none;
      animation: submit-shine 3.2s ease-in-out infinite;
    }

    /* hover / 點擊：質感金 + 深金棕字 */
    &:hover,
    &:active {
      background: linear-gradient(160deg, #ffe487 0%, #f6c945 48%, #e2a72c 100%);
      color: #5a3a00;
      text-shadow: 0 1px 0 rgba(255, 255, 255, 0.4);
      box-shadow: 0 8px 20px rgba(214, 158, 44, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.65), inset 0 -1px 0 rgba(120, 80, 0, 0.15);
    }

    /* 開盤中且可送出 */
    &.open:not(:disabled) {
      background: linear-gradient(160deg, #dc2626 0%, #b91c1c 55%, #d97706 100%);
      cursor: pointer;
      box-shadow: 0 6px 18px rgba(185, 28, 28, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.3);

      /* hover / 點擊：質感金 + 深金棕字（覆蓋漸層）*/
      &:hover,
      &:active {
        background: linear-gradient(160deg, #ffe487 0%, #f6c945 48%, #e2a72c 100%);
        color: #5a3a00;
        filter: none;
        text-shadow: 0 1px 0 rgba(255, 255, 255, 0.4);
        box-shadow: 0 8px 20px rgba(214, 158, 44, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.65), inset 0 -1px 0 rgba(120, 80, 0, 0.15);
      }

      &:hover {
        transform: translateY(-1px);
      }

      &:active {
        transform: translateY(0) scale(0.97);
      }
    }
  }
}

/* 金光掃過動畫（掃一次後停一下再掃）*/
@keyframes submit-shine {
  0% {
    left: -150%;
  }

  55%,
  100% {
    left: 150%;
  }
}
</style>
