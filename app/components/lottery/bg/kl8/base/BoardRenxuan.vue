<script setup lang="ts">
import { computed } from 'vue'
import Ball from '~/components/lottery/bg/kl8/base/Ball.vue'
import { useKl8 } from '~/composables/useKl8'
import { kl8NumberLabel } from '#shared/config/kl8'

/**
 * 快樂8「任選」投注看板
 *
 * ── 為什麼不與 base/Board.vue 共用 ─────────────────────────
 *   表格看板（兩面）是「一注項一金額」；任選是複式：
 *   先從 01~80 選 k 個號碼，再依 C(k, N) 展開成多注、共用同一個單注金額
 *   （與來源 `bglottery kl8/allTraditional/renxuan/play.vue` 同一套互動）。
 *   兩種狀態機硬塞進同一支元件只會讓兩邊都難讀，故各自一支。
 *
 * ⚠️ 這裡只負責選號與預覽，展開與送單一律走 composable 的 `fetch.betsRenxuan()`
 *    （注碼與注數在那裡產生，伺端會再驗一次）。
 */
const {
  state: mxState,
  renxuan: mxRenxuan,
  currentQuota: mxQuota,
  currentChosen: mxChosen,
  renxuanPicked: mxPicked,
  renxuanCombos: mxCombos,
  renxuanOdds: mxOdds,
  renxuanTotal: mxTotal,
  actions: mxActions
} = useKl8()

const money = (value: number) => Number(value ?? 0).toLocaleString('zh-TW')

/** 該分頁的選號規則（min ≤ 已選 ≤ max，一注 pick 碼） */
const chosen = computed(() => mxChosen.value)
const pickedCount = computed(() => mxPicked.value.length)
const comboCount = computed(() => mxCombos.value.length)
/** 還差幾個號碼才湊得出一注 */
const shortOf = computed(() => Math.max(0, Number(chosen.value?.min ?? 0) - pickedCount.value))
const minCoin = computed(() => mxQuota.value.item.min)
const maxCoin = computed(() => mxQuota.value.item.max)

const state = computed(() => ({
  /** 已選滿上限時，未選的號碼要標示成不可再加選 */
  atMax: chosen.value ? pickedCount.value >= chosen.value.max : false
}))

const click = {
  number: (num: number) => {
    const result = mxActions.toggleRenxuanNumber(num)
    if (!result.ok && result.message) mxState.message = result.message
    else mxState.message = ''
  },
  amountInput: (event: Event) => {
    const target = event.target as HTMLInputElement
    const coin = Math.min(maxCoin.value, Math.max(0, Math.trunc(Number(target.value) || 0)))
    mxActions.setRenxuanAmount(coin)
    target.value = coin > 0 ? String(coin) : ''
  },
  random: () => { mxActions.randomRenxuan() },
  clear: () => { mxActions.clearRenxuan() }
}
</script>

<template>
  <div class="kl8-board-renxuan">
    <div class="quota-bar">
      <span class="quota-item">單注 {{ money(minCoin) }} — {{ money(maxCoin) }}</span>
      <span v-if="mxQuota.issue.max > 0" class="quota-item">單期上限 {{ money(mxQuota.issue.max) }}</span>
      <span class="quota-note">
        ※ {{ mxState.selectTabName }}：一注 {{ chosen?.pick ?? 0 }} 碼，可選 {{ chosen?.min ?? 0 }} ~ {{ chosen?.max ?? 0 }} 個號碼，
        多選會依組合展開成多注
      </span>
    </div>

    <div class="play-group">
      <div class="group-title">
        號碼 01 ~ 80
        <span class="group-odds">賠率[ {{ mxOdds || '—' }} ]</span>
      </div>

      <div class="number-grid">
        <button v-for="item in mxRenxuan.pool" :key="item.num" type="button" class="number-cell"
          :class="{ active: item.select, disabled: !item.select && state.atMax }" @click="click.number(item.num)">
          <Ball :num="item.num" size="md" :muted="!item.select" :hit="item.select" />
        </button>
      </div>
    </div>

    <div class="renxuan-bar">
      <div class="picked">
        <span class="label">已選 {{ pickedCount }} 個</span>
        <span v-if="mxPicked.length" class="codes">
          {{ mxPicked.map((num) => kl8NumberLabel(num)).join(' ') }}
        </span>
        <span v-else class="codes is-empty">尚未選號</span>
      </div>

      <div class="tools">
        <label class="amount">
          單注金額
          <input type="number" min="0" :max="maxCoin" :value="mxRenxuan.amount || ''" placeholder="0"
            @input="click.amountInput($event)" />
        </label>
        <button type="button" class="btn" @click="click.random()">機選 {{ chosen?.min ?? 0 }} 碼</button>
        <button type="button" class="btn" @click="click.clear()">清空選號</button>
      </div>
    </div>

    <div class="renxuan-summary" :class="{ 'is-ready': comboCount > 0 }">
      <template v-if="comboCount > 0">
        共 <strong>{{ comboCount }}</strong> 注（C({{ pickedCount }}, {{ chosen?.pick ?? 0 }})）
        × 單注 {{ money(mxRenxuan.amount) }} ＝ 總額 <strong>{{ money(mxTotal) }}</strong>
      </template>
      <template v-else>
        還要再選 <strong>{{ shortOf }}</strong> 個號碼才能下注
      </template>
    </div>
  </div>
</template>

<style scoped lang="scss">
/* 版面沿用 base/Board.vue 的限額列與群組標題，選號區改為號碼球網格 */
.kl8-board-renxuan {
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

  .play-group {
    display: flex;
    flex-direction: column;

    .group-title {
      text-align: center;
      padding: 0.5rem 0;
      font-size: 15px;
      font-weight: 700;
      color: var(--color-red-main);

      .group-odds {
        margin-left: 10px;
        font-size: 11px;
        font-weight: 700;
        color: var(--color-red-desc);
        font-variant-numeric: tabular-nums;
      }
    }

    .number-grid {
      display: grid;
      grid-template-columns: repeat(10, 1fr);
      gap: 6px;

      @media (max-width: 900px) {
        grid-template-columns: repeat(8, 1fr);
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

  .renxuan-bar {
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

  .renxuan-summary {
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
