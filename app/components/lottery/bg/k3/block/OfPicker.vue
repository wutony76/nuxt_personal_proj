<script setup lang="ts">
import { computed } from 'vue'
import Dice from '~/components/lottery/bg/k3/base/Dice.vue'
import { useK3 } from '~/composables/useK3'

/**
 * 官方盤選號：3 欄各選一個 1 ~ 6 的點數（可重複）
 * 直接對應伺端 k3OfPicksOf 的「3 個點數、可重複」規格
 */
const { ofPicks, ofPicked, ofPrizeTiers, actions: mxActions } = useK3()

const POINTS = [1, 2, 3, 4, 5, 6]
const COLUMN_LABELS = ['第一顆', '第二顆', '第三顆']
const money = (value: number) => Number(value ?? 0).toLocaleString('zh-TW')
const picked = computed(() => ofPicks.list.filter((num) => num > 0))
</script>

<template>
  <div class="of-picker">
    <div class="pick-note">
      每注選 <strong>3 個點數</strong>（可重複），依<strong>命中顆數</strong>分層從共用彩池分配
    </div>

    <div v-for="(label, idx) in COLUMN_LABELS" :key="label" class="pick-row">
      <span class="pick-label">{{ label }}</span>
      <button v-for="point in POINTS" :key="`${idx}-${point}`" type="button" class="pick-btn"
        :class="{ active: ofPicks.list[idx] === point }" @click="mxActions.setOfPick(idx, point)">
        <Dice :num="point" size="sm" />
      </button>
    </div>

    <div class="pick-foot">
      <span class="pick-current">
        已選：<strong>{{ picked.length ? picked.join('、') : '—' }}</strong>
        <em v-if="!ofPicked">（需選滿 3 個）</em>
      </span>
      <span class="pick-acts">
        <button type="button" class="act-btn" @click="mxActions.randomOfPicks()">機選</button>
        <button type="button" class="act-btn is-clear" @click="mxActions.clearOfPicks()">清空</button>
      </span>
    </div>

    <table class="report-table tier-table">
      <thead><tr><th>命中</th><th>分層</th><th>派彩方式</th></tr></thead>
      <tbody>
        <tr v-for="tier in ofPrizeTiers" :key="tier.name">
          <td class="t-match">{{ tier.match }} 顆</td>
          <td class="t-name">{{ tier.name }}</td>
          <td class="t-desc">
            <template v-if="tier.type === 'pool'">
              彩池 {{ (tier.ratio * 100).toFixed(0) }}%，依下注額比例分配
              <em v-if="tier.minAmount">（每單位最低 {{ money(tier.minAmount) }}）</em>
            </template>
            <template v-else>固定 {{ tier.amount }} 倍</template>
          </td>
        </tr>
      </tbody>
    </table>
    <p class="tier-note">※ 該層沒有中獎者時，該層獎金整塊滾存至下期</p>
  </div>
</template>

<style scoped lang="scss">
.of-picker {
  .pick-note {
    margin-bottom: 10px;
    font-size: 13px;
    color: var(--color-red-desc);

    strong { color: var(--color-red-main); }
  }

  .pick-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;

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

      &:hover { transform: translateY(-2px); }
      &.active { border-color: var(--color-red-main); background: #fff1f2; }
    }
  }

  .pick-foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin: 10px 0;
    font-size: 13px;

    .pick-current {
      color: var(--color-red-desc);
      strong { font-size: 15px; color: var(--color-red-main); }
      em { font-size: 12px; font-style: normal; color: #d97706; }
    }

    .act-btn {
      margin-left: 6px;
      border: 1px solid var(--color-red-main);
      border-radius: 4px;
      background: var(--color-red-main);
      padding: 3px 12px;
      font-size: 12px;
      font-weight: 700;
      color: #fff;
      cursor: pointer;

      &.is-clear { background: #fff; color: var(--color-red-main); }
    }
  }

  /* 表格外觀沿用全域 .report-table（同 6hc），這裡只寫欄寬與強調色 */
  .tier-table {
    .t-match { width: 4rem; font-weight: 700; color: var(--color-red-main); }
    .t-name { width: 4rem; font-weight: 700; color: #d97706; }
    .t-desc { color: var(--color-red-desc); em { font-style: normal; } }
  }

  .tier-note { margin: 6px 0 0; font-size: 11px; color: var(--color-red-desc); }
}
</style>
