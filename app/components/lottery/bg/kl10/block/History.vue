<script setup lang="ts">
import { computed } from 'vue'
import Ball from '~/components/lottery/bg/kl10/base/Ball.vue'
import {
  kl10NumbersOf,
  kl10ParityZoneOf,
  kl10SumOf,
  kl10ZoneOf,
  KL10_SUM_BIG_LINE
} from '#shared/config/kl10'
import { useKl10 } from '~/composables/useKl10'

/**
 * 開獎歷史：一期一列，直向排列（版位對應 eggs 的 History.vue）
 * 一列的資訊順序＝期號 → 8 顆號碼球 → 總和與兩面（大小／單雙）→ 上下盤／奇偶盤
 */
const { openCodeHistory: mxHistory } = useKl10()

/** 要顯示幾期（列數） */
const HIST_ROWS = 5

const rows = computed(() => mxHistory.list.slice(0, HIST_ROWS).map((item) => {
  const nums = kl10NumbersOf(item.openCode)
  const sum = nums ? kl10SumOf(nums) : 0
  return {
    issue: String(item.issue),
    openCode: item.openCode,
    sum,
    isBig: sum >= KL10_SUM_BIG_LINE,
    isOdd: sum % 2 === 1,
    zone: nums ? kl10ZoneOf(nums) : '',
    parityZone: nums ? kl10ParityZoneOf(nums) : ''
  }
}))
</script>

<template>
  <div class="block-main kl10-history">
    <div class="hist-head">
      <span class="hist-title">近五期開獎</span>
    </div>
    <div class="hist-body">
      <div v-for="row in rows" :key="row.issue" class="hist-row">
        <span class="hist-issue">{{ row.issue.slice(-3) }}</span>
        <span class="hist-ball">
          <Ball v-for="(code, idx) in row.openCode" :key="idx" :num="code" size="xs" />
        </span>
        <span class="hist-meta">
          <b>和{{ row.sum }}</b>
          <em :class="row.isBig ? 'is-red' : 'is-blue'">{{ row.isBig ? '大' : '小' }}</em>
          <em :class="row.isOdd ? 'is-red' : 'is-blue'">{{ row.isOdd ? '單' : '雙' }}</em>
          <em v-if="row.zone" class="is-pattern">{{ row.zone }}</em>
          <em v-if="row.parityZone" class="is-pattern">{{ row.parityZone }}</em>
        </span>
      </div>
      <div v-if="rows.length === 0" class="hist-empty">
        {{ mxHistory.isLoading ? '載入中…' : '暫無資料' }}
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.kl10-history {
  flex: 0 0 33%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #fff;

  .hist-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;

    .hist-title {
      font-size: 14px;
      font-weight: 700;
      color: var(--color-red-main);
    }
  }

  .hist-body {
    flex: 1 1 auto;
    min-height: 0;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    gap: 6px;
    overflow-x: hidden;
    overflow-y: auto;
    padding-right: 4px;
    scrollbar-width: thin;
    scrollbar-color: var(--color-red-desc) #e8e6e6;

    &::-webkit-scrollbar {
      width: 8px;
      height: 8px;
    }

    &::-webkit-scrollbar-track {
      background: #ffc6c6;
      border-radius: 999px;
    }

    &::-webkit-scrollbar-thumb {
      background: #f54c07;
      border-radius: 999px;
      border: 2px solid #ffc6c6;
    }

    &::-webkit-scrollbar-thumb:hover {
      background: #de4304;
    }
  }

  .hist-row {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    gap: 10px;
    border: 1px solid var(--color-red-content);
    border-radius: 6px;
    background: #fffafa;
    padding: 4px 8px;

    .hist-issue {
      flex: 0 0 30px;
      font-size: 11px;
      color: var(--color-red-desc);
    }

    .hist-ball {
      flex: 0 0 auto;
      display: flex;
      flex-wrap: wrap;
      gap: 2px;
    }

    .hist-meta {
      flex: 1 1 auto;
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 4px;
      font-size: 11px;

      b {
        font-weight: 700;
        color: var(--color-red-main);
      }

      em {
        font-style: normal;
        font-weight: 700;
        border-radius: 3px;
        padding: 0 4px;

        &.is-red {
          background: #fee2e2;
          color: #b91c1c;
        }

        &.is-blue {
          background: #dbeafe;
          color: #1d4ed8;
        }

        &.is-pattern {
          background: #fef3c7;
          color: #b45309;
        }
      }
    }
  }

  .hist-empty {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    background: #f7f7f7;
    font-size: 12px;
    color: var(--text-gray);
  }
}
</style>
