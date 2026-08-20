<script setup lang="ts">
import { computed } from 'vue'
import Ball from '~/components/lottery/bg/kl10/base/Ball.vue'
import { useKl10 } from '~/composables/useKl10'
import { kl10NumberLabel } from '#shared/config/kl10'

/**
 * 快樂十分「彩池玩法（選號）」投注看板
 *
 * ── 為什麼不與 base/BoardRenxuan.vue 共用 ─────────────────────
 *   任選是「選 k 個號碼 → 依 C(k, N) 展開成多注、全中才算中」；
 *   彩池玩法是「固定選 4 碼 → 一注 → 依命中顆數分層派彩」，兩者判定與送單邏輯完全獨立
 *   （見 shared/config/kl10-cd.ts 的 kl10PoolMatchCount／KL10_POOL_PRIZE_TIERS），
 *   互動模型雖然都是「號碼池」，但不共用同一份選號狀態（poolPlay vs renxuan）。
 * ⚠️ 這個玩法刻意不進 kl10cd/plays.js 看板網格（比照 k3-of 的 xuanhao），
 *    這裡只負責選號與預覽，送單一律走 composable 的 `fetch.betsPool()`。
 */
const {
  state: mxState,
  poolPlay: mxPool,
  poolPlayState: mxPoolState,
  currentQuota: mxQuota,
  poolPlayPicked: mxPicked,
  poolPlayReady: mxReady,
  poolPickCount: mxPickCount,
  actions: mxActions
} = useKl10()

const money = (value: number) => Number(value ?? 0).toLocaleString('zh-TW')

const pickedCount = computed(() => mxPicked.value.length)
const minCoin = computed(() => mxQuota.value.item.min)
const maxCoin = computed(() => mxQuota.value.item.max)
const atMax = computed(() => pickedCount.value >= mxPickCount)

const click = {
  number: (num: number) => {
    const result = mxActions.togglePoolNumber(num)
    if (!result.ok && result.message) mxState.message = result.message
    else mxState.message = ''
  },
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
  <div class="kl10-pool-picker">
    <div class="quota-bar">
      <span class="quota-item">單注 {{ money(minCoin) }} — {{ money(maxCoin) }}</span>
      <span v-if="mxQuota.issue.max > 0" class="quota-item">單期上限 {{ money(mxQuota.issue.max) }}</span>
      <span class="quota-note">※ 固定選 {{ mxPickCount }} 碼，依命中顆數分層派彩（不是全中才算中）</span>
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

    <div class="play-group">
      <div class="group-title">號碼 01 ~ 20</div>
      <div class="number-grid">
        <button v-for="item in mxPool.nums" :key="item.num" type="button" class="number-cell"
          :class="{ active: item.select, disabled: !item.select && atMax }" @click="click.number(item.num)">
          <Ball :num="item.num" size="md" :muted="!item.select" :hit="item.select" />
        </button>
      </div>
    </div>

    <div class="pool-bar">
      <div class="picked">
        <span class="label">已選 {{ pickedCount }} / {{ mxPickCount }}</span>
        <span v-if="mxPicked.length" class="codes">
          {{ mxPicked.map((num) => kl10NumberLabel(num)).join(' ') }}
        </span>
        <span v-else class="codes is-empty">尚未選號</span>
      </div>

      <div class="tools">
        <label class="amount">
          單注金額
          <input type="number" min="0" :max="maxCoin" :value="mxPool.amount || ''" placeholder="0"
            @input="click.amountInput($event)" />
        </label>
        <button type="button" class="btn" @click="click.random()">機選 {{ mxPickCount }} 碼</button>
        <button type="button" class="btn" @click="click.clear()">清空選號</button>
      </div>
    </div>

    <div class="pool-summary" :class="{ 'is-ready': mxReady }">
      <template v-if="mxReady">
        1 注 × 單注 {{ money(mxPool.amount) }} ＝ 總額 <strong>{{ money(mxPool.amount) }}</strong>
      </template>
      <template v-else>
        還要再選 <strong>{{ mxPickCount - pickedCount }}</strong> 個號碼才能下注
      </template>
    </div>
  </div>
</template>

<style scoped lang="scss">
/* 版面比照 base/BoardRenxuan.vue，多一張靜態分層獎金表 */
.kl10-pool-picker {
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

  .play-group {
    display: flex;
    flex-direction: column;

    .group-title {
      text-align: center;
      padding: 0.5rem 0;
      font-size: 15px;
      font-weight: 700;
      color: var(--color-red-main);
    }

    .number-grid {
      display: grid;
      grid-template-columns: repeat(10, 1fr);
      gap: 6px;

      @media (max-width: 900px) {
        grid-template-columns: repeat(5, 1fr);
      }

      .number-cell {
        display: flex;
        align-items: center;
        justify-content: center;
        border: 1px solid #fee2e2;
        border-radius: 6px;
        background: #fff;
        padding: 6px 0;
        cursor: pointer;
        transition: background 0.15s ease, border-color 0.15s ease;

        &:hover {
          background: #fbe3e6;
        }

        &.active {
          border-color: var(--color-red-main);
          background: var(--color-yellow-text);
        }

        &.disabled {
          cursor: not-allowed;
          opacity: 0.45;
        }
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
