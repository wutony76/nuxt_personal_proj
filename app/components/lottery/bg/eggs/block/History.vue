<script setup lang="ts">
import { computed } from 'vue'
import Ball from '~/components/lottery/bg/eggs/base/Ball.vue'
import { EGGS_BIG_LINE, eggsDigitsOf, eggsSumOf, eggsPatternOf } from '#shared/config/eggs'
import { useEggs } from '~/composables/useEggs'

/**
 * 開獎歷史：一期一列，直向排列（版位對應 k3 的 History.vue）
 * 一列的資訊順序＝期號 → 3 顆號碼球 → 和值與兩面（大小／單雙）→ 特殊牌型
 */
const { openCodeHistory: mxHistory } = useEggs()

/** 要顯示幾期（列數） */
const HIST_ROWS = 5

const rows = computed(() => mxHistory.list.slice(0, HIST_ROWS).map((item) => {
  const digits = eggsDigitsOf(item.openCode)
  const sum = digits ? eggsSumOf(digits) : 0
  const pattern = digits ? eggsPatternOf(digits) : null
  return {
    issue: String(item.issue),
    openCode: item.openCode,
    sum,
    isBig: sum > EGGS_BIG_LINE,
    isOdd: sum % 2 === 1,
    pattern
  }
}))
</script>

<template>
  <div class="block-main eggs-history">
    <div class="hist-head">
      <span class="hist-title">近五期開獎</span>
    </div>
    <div class="hist-body">
      <div v-for="row in rows" :key="row.issue" class="hist-row">
        <span class="hist-issue">{{ row.issue.slice(-3) }}</span>
        <span class="hist-ball">
          <Ball v-for="(code, idx) in row.openCode" :key="idx" :digit="code" size="sm" />
        </span>
        <span class="hist-meta">
          <b>和{{ row.sum }}</b>
          <em :class="row.isBig ? 'is-red' : 'is-blue'">{{ row.isBig ? '大' : '小' }}</em>
          <em :class="row.isOdd ? 'is-red' : 'is-blue'">{{ row.isOdd ? '單' : '雙' }}</em>
          <em v-if="row.pattern" class="is-pattern">{{ row.pattern }}</em>
        </span>
      </div>
      <div v-if="rows.length === 0" class="hist-empty">
        {{ mxHistory.isLoading ? '載入中…' : '暫無資料' }}
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.eggs-history {
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
      gap: 3px;
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
