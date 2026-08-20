<script setup lang="ts">
import { computed } from 'vue'
import Ball from '~/components/lottery/bg/eggs/base/Ball.vue'
import { useEggs } from '~/composables/useEggs'

/**
 * PC蛋蛋「彩池玩法（選號）」投注看板
 *
 * ── 為什麼是「3 個獨立槽位」而不是號碼池 toggle ─────────────
 *   PC蛋蛋開獎可重複（0~9），跟 KL10 的「不重複、選幾個算幾個」不同，
 *   toggle 式號碼池無法表達「同一個數字選兩次」，所以比照 k3-of 的 Picker.vue：
 *   固定 EGGS_POOL_PICK_COUNT 個槽位，各自獨立選一個 0~9（可重複）。
 * ⚠️ 這個玩法刻意不進 eggscd/plays.js 看板網格（比照 k3-of 的 xuanhao），
 *    這裡只負責選號與預覽，送單一律走 composable 的 `fetch.betsPool()`。
 */
const {
  state: mxState,
  poolPlay: mxPool,
  poolPlayState: mxPoolState,
  currentQuota: mxQuota,
  poolPlayReady: mxReady,
  poolPickCount: mxPickCount,
  actions: mxActions
} = useEggs()

const DIGITS = Array.from({ length: 10 }, (_, i) => i)
const COLUMN_LABELS = Array.from({ length: mxPickCount }, (_, i) => `第${'一二三四五'[i] ?? i + 1}碼`)
const money = (value: number) => Number(value ?? 0).toLocaleString('zh-TW')

const minCoin = computed(() => mxQuota.value.item.min)
const maxCoin = computed(() => mxQuota.value.item.max)
const picked = computed(() => mxPool.picks.filter((digit) => digit !== null) as number[])

const click = {
  amountInput: (event: Event) => {
    const target = event.target as HTMLInputElement
    const coin = Math.min(maxCoin.value, Math.max(0, Math.trunc(Number(target.value) || 0)))
    mxActions.setPoolAmount(coin)
    target.value = coin > 0 ? String(coin) : ''
  },
  random: () => { mxActions.randomPool() },
  clear: () => { mxActions.clearPool() }
}

const tierDesc = (tier: (typeof mxPoolState.prizeTiers)[number]) =>
  tier.type === 'pool'
    ? `彩池 ${(tier.ratio * 100).toFixed(0)}%，依下注額比例分配${tier.minAmount ? `（每單位最低 ${money(tier.minAmount)}）` : ''}`
    : `固定 ${tier.amount} 倍`
</script>

<template>
  <div class="eggs-pool-picker">
    <div class="quota-bar">
      <span class="quota-item">單注 {{ money(minCoin) }} — {{ money(maxCoin) }}</span>
      <span v-if="mxQuota.issue.max > 0" class="quota-item">單期上限 {{ money(mxQuota.issue.max) }}</span>
      <span class="quota-note">※ 每注選 {{ mxPickCount }} 個數字（可重複），依命中顆數分層派彩</span>
    </div>

    <div class="pool-amount">
      彩金池 <strong>{{ money(mxPoolState.distributable) }}</strong>
    </div>

    <table class="tier-table">
      <thead>
        <tr><th>命中顆數</th><th>獎項</th><th>派彩方式</th></tr>
      </thead>
      <tbody>
        <tr v-for="tier in mxPoolState.prizeTiers" :key="tier.match">
          <td>{{ tier.match }} 顆</td>
          <td>{{ tier.name }}</td>
          <td>{{ tierDesc(tier) }}</td>
        </tr>
      </tbody>
    </table>

    <div v-for="(label, idx) in COLUMN_LABELS" :key="label" class="pick-row">
      <span class="pick-label">{{ label }}</span>
      <button v-for="digit in DIGITS" :key="`${idx}-${digit}`" type="button" class="pick-btn"
        :class="{ active: mxPool.picks[idx] === digit }" @click="mxActions.setPoolPick(idx, digit)">
        <Ball :digit="digit" size="sm" :muted="mxPool.picks[idx] !== digit" :hit="mxPool.picks[idx] === digit" />
      </button>
    </div>

    <div class="pool-bar">
      <div class="picked">
        <span class="label">已選 {{ picked.length }} / {{ mxPickCount }}</span>
        <span v-if="picked.length" class="codes">{{ picked.join(' ') }}</span>
        <span v-else class="codes is-empty">尚未選號</span>
      </div>

      <div class="tools">
        <label class="amount">
          單注金額
          <input type="number" min="0" :max="maxCoin" :value="mxPool.amount || ''" placeholder="0"
            @input="click.amountInput($event)" />
        </label>
        <button type="button" class="btn" @click="click.random()">機選</button>
        <button type="button" class="btn" @click="click.clear()">清空選號</button>
      </div>
    </div>

    <div class="pool-summary" :class="{ 'is-ready': mxReady }">
      <template v-if="mxReady">
        1 注 × 單注 {{ money(mxPool.amount) }} ＝ 總額 <strong>{{ money(mxPool.amount) }}</strong>
      </template>
      <template v-else>
        還要再選 <strong>{{ mxPickCount - picked.length }}</strong> 個數字才能下注
      </template>
    </div>
  </div>
</template>

<style scoped lang="scss">
/* 版面比照 kl10 的 block/PoolPicker.vue，選號區改用「N 個獨立槽位」（k3-of Picker.vue 的模式） */
.eggs-pool-picker {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;

  .quota-bar {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    border: 1px solid #fee2e2;
    border-radius: 0.25rem;
    background: #fff5f6;
    padding: 6px 10px;
    font-size: 12px;

    .quota-item {
      font-weight: 700;
      color: var(--color-red-main);
      font-variant-numeric: tabular-nums;

      &+.quota-item::before {
        content: '·';
        margin-right: 8px;
        color: var(--color-red-desc);
      }
    }

    .quota-note {
      margin-left: auto;
      color: var(--color-red-desc);
    }
  }

  .pool-amount {
    border: 1px solid #fee2e2;
    border-radius: 0.25rem;
    background: #fffafa;
    padding: 8px 10px;
    text-align: center;
    font-size: 14px;
    color: var(--color-red-desc);

    strong {
      font-size: 18px;
      font-weight: 800;
      color: var(--color-red-main);
      font-variant-numeric: tabular-nums;
    }
  }

  .tier-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;

    th,
    td {
      border: 1px solid #fee2e2;
      padding: 4px 8px;
      text-align: center;
    }

    th {
      background: #fff5f6;
      color: var(--color-red-main);
    }

    td {
      color: var(--color-red-desc);
    }
  }

  .pick-row {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;

    .pick-label {
      width: 3.6rem;
      flex-shrink: 0;
      font-size: 13px;
      font-weight: 700;
      color: var(--color-red-main);
    }

    .pick-btn {
      border: 2px solid transparent;
      border-radius: 8px;
      background: none;
      padding: 2px;
      cursor: pointer;
      transition: border-color 0.15s, transform 0.15s;

      &:hover {
        transform: translateY(-2px);
      }

      &.active {
        border-color: var(--color-red-main);
        background: #fff1f2;
      }
    }
  }

  .pool-bar {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
    border: 1px solid #fee2e2;
    border-radius: 0.25rem;
    background: #fffafa;
    padding: 8px 10px;

    .picked {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;

      .label {
        font-size: 12px;
        font-weight: 700;
        color: var(--color-red-main);
        white-space: nowrap;
      }

      .codes {
        font-size: 13px;
        font-weight: 700;
        color: var(--color-red-desc);
        font-variant-numeric: tabular-nums;

        &.is-empty {
          font-weight: 500;
          color: var(--text-gray);
        }
      }
    }

    .tools {
      margin-left: auto;
      display: flex;
      align-items: center;
      gap: 8px;

      .amount {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        font-weight: 700;
        color: var(--color-red-main);

        input {
          width: 90px;
          height: 28px;
          border: 1px solid #f3b7bf;
          border-radius: 4px;
          background: #fff;
          text-align: center;
          font-size: 13px;
          font-weight: 700;
          color: var(--color-red-main);
          outline: none;

          &:focus {
            border-color: var(--color-red-main);
            box-shadow: 0 0 0 2px rgba(213, 63, 83, 0.12);
          }
        }
      }

      .btn {
        height: 28px;
        border: 1px solid var(--color-red-700);
        border-radius: 6px;
        background: #fff;
        padding: 0 10px;
        font-size: 12px;
        font-weight: 700;
        color: var(--color-red-main);
        cursor: pointer;

        &:hover {
          background: #fbe3e6;
        }
      }
    }
  }

  .pool-summary {
    border: 1px dashed #f3b7bf;
    border-radius: 0.25rem;
    background: #fff;
    padding: 8px 10px;
    text-align: center;
    font-size: 13px;
    color: var(--color-red-desc);
    font-variant-numeric: tabular-nums;

    strong {
      font-weight: 800;
      color: var(--color-red-main);
    }

    &.is-ready {
      border-style: solid;
      background: #fff5f6;
    }
  }
}
</style>
