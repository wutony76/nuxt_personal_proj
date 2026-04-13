<script setup lang="ts">
const MIN_COIN = 1
const MAX_COIN = 99999

const state = reactive({
  options: [5, 20, 100, 500, 900],
  coin: 1,
})

const handle = {
  normalizeCoin: (value: number) => {
    const safe = Number.isFinite(value) ? Math.trunc(value) : MIN_COIN
    return Math.min(MAX_COIN, Math.max(MIN_COIN, safe))
  }
}

const click = {
  add: (value: number) => {
    state.coin = handle.normalizeCoin(state.coin + value)
  }
}

const addCoin = (value: number) => {
  state.coin = handle.normalizeCoin(state.coin + value)
}

const onCoinInput = (event: Event) => {
  const target = event.target as HTMLInputElement
  state.coin = handle.normalizeCoin(Number(target.value))
}
</script>

<template>
  <div class="control-coin">
    <div class="left">
      <button v-for="item in state.options" :key="item" type="button" class="coin-btn" @click="click.add(item)">
        +{{ item }}
      </button>
    </div>
    <div class="right">
      <label class="coin-label" for="coin-input">投注金額</label>
      <input id="coin-input" :value="state.coin" type="number" min="1" max="99999" step="1" class="coin-input"
        @input="onCoinInput" @blur="onCoinInput" />
      <!-- <span class="coin-tip"> 1 ~ 99999</span> -->
    </div>
  </div>
</template>

<style scoped lang="scss">
.control-coin {
  display: flex;
  flex-direction: column;
  gap: 5px;
  background: #fff7f8;

  .left {
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

  .right {
    display: flex;
    align-items: center;
    gap: 4px;

    .coin-label {
      font-size: 12px;
      font-weight: 600;
      color: var(--color-red-desc);
    }

    .coin-input {
      width: 110px;
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

    .coin-tip {
      font-size: 11px;
      color: var(--color-red-desc);
    }
  }
}
</style>