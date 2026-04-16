<script setup lang="ts">
import { actions } from '~/utils/common'

const MIN_COIN = 1
const MAX_COIN = 99999
const { $dialog } = useNuxtApp()
const { state: mxState, handle: mxHandle } = use6hcOfficial()

const state = reactive({
  options: [5, 20, 100, 500, 900],
  coin: 1,
})

const handle = {
  normalizeCoin: (value: number) => {
    const safe = Number.isFinite(value) ? Math.trunc(value) : MIN_COIN
    return Math.min(MAX_COIN, Math.max(MIN_COIN, safe))
  },
  input: (event: Event) => {
    const target = event.target as HTMLInputElement
    const value = Number(target.value)

    if (value > MAX_COIN) {
      state.coin = MAX_COIN
      target.value = String(MAX_COIN)
      $dialog.alert('已超過單注最大額')
      return
    }

    state.coin = handle.normalizeCoin(value)
    target.value = String(state.coin)
  }
}

const click = {
  add: (value: number) => {
    state.coin = handle.normalizeCoin(state.coin + value)
  },
  bet: () => {
    const _bets = mxState.groupList.length
    console.log('bet.count.', _bets)
    if (_bets === 0) return $dialog.alert('請先加入注單')
    const _totalMoney = _bets * state.coin
    console.log('bet._total.', _totalMoney)
    // if (_totalMoney > mxState.balance) return $dialog.alert('餘額不足')
    // mxHandle.submitBet()
  }
}
</script>

<template>
  <div class="control-coin">
    <div class="row-1">
      <button v-for="item in state.options" :key="item" type="button" class="coin-btn" @click="click.add(item)">
        +{{ item }}
      </button>
    </div>
    <div class="row-2">
      <div class="left">
        <label class="coin-label" for="coin-input">投注金額</label>
        <input id="coin-input" :value="state.coin" type="number" min="1" max="99999" step="1" class="coin-input"
          @input="handle.input" @blur="handle.input" />
      </div>
      <div class="right">
        <!-- <button type="button" class="action-btn bet" @click="click.bet"> 投注 </button> -->
        <div class="total-amount">
          總投注： {{ actions.thousands(mxState.groupList.length * state.coin) }}
        </div>
      </div>

    </div>
    <div>
      <button type="button" class="action-btn bet" @click="click.bet"> 投注 </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.control-coin {
  display: flex;
  flex-direction: column;
  gap: 5px;
  background: #fff7f8;

  .action-btn.bet {
    margin-top: 10px;

    width: 100%;
    height: 45px;
    font-size: 14px;
    transition: filter 0.15s ease, transform 0.15s ease;

    &:hover {
      filter: brightness(1.08) saturate(1.2);
      transform: translateY(-1px);
    }
  }

  .row-1 {
    display: flex;
    justify-content: space-between;
    gap: 5px;
    flex-wrap: wrap;

    .coin-btn {
      border: 1px solid #f3b7bf;
      border-radius: 4px;
      background: #fff;
      padding: 4px 10px;
      font-size: 12px;
      font-weight: 700;
      color: var(--color-red-main);
      cursor: pointer;
      transition: all 0.15s ease;

      &:hover {
        background: #ffecef;
      }
    }
  }

  .row-2 {
    display: flex;
    align-items: center;
    justify-content: space-between;

    .left {
      display: flex;
      align-items: center;
      gap: 4px;

      .coin-label {
        font-size: 12px;
        font-weight: 600;
        color: var(--color-red-desc);
      }

      .coin-input {
        width: 112px;
        border: 1px solid #f3b7bf;
        border-radius: 4px;
        background: #fff;
        padding: 4px 8px;
        text-align: right;
        font-size: 13px;
        color: var(--color-red-main);
        outline: none;

        &:focus {
          border-color: var(--color-red-main);
          box-shadow: 0 0 0 2px rgba(213, 63, 83, 0.12);
        }
      }
    }

    .right {
      .total-amount {
        font-size: 12px;
        font-weight: 600;
        color: var(--color-red-desc);
      }
    }

    .coin-tip {
      font-size: 11px;
      color: var(--color-red-desc);
    }
  }
}
</style>