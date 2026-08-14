<script setup lang="ts">
import { computed } from 'vue'
import Dice from '~/components/lottery/bg/k3/base/Dice.vue'
import { K3_BIG_LINE } from '#shared/config/k3-cd'
import { useK3 } from '~/composables/useK3'

/**
 * 開獎歷史：一期一列，直向排列（版位對應 6hc-cd 的路珠 Road）
 *
 * 一列的資訊順序＝期號 → 3 顆骰子 → 和值與兩面（大小／單雙）：
 *   150  ⚂⚁⚃  和9 小 單
 * 只顯示 HIST_ROWS 期；卡片寬度取 .info-main 的一半，一列的資訊不需要吃滿版。
 */
const { openCodeHistory: mxHistory, actions: mxActions } = useK3()

/** 要顯示幾期（列數） */
const HIST_ROWS = 5

/**
 * 一期一列的顯示資料
 *
 * 大小分界讀 K3_BIG_LINE 而不是寫死 11；和值在 template 會用到三次，
 * 這裡先算好避免每次 render 重複呼叫 sumOf。
 */
const rows = computed(() => mxHistory.list.slice(0, HIST_ROWS).map((item) => {
  const sum = mxActions.sumOf(item.openCode)
  return {
    issue: String(item.issue),
    openCode: item.openCode,
    sum,
    isBig: sum >= K3_BIG_LINE,
    isOdd: sum % 2 === 1,
    isTriple: item.openCode.length === 3 && new Set(item.openCode).size === 1
  }
}))
</script>

<template>
  <div class="block-main k3-history">
    <div class="hist-head">
      <span class="hist-title">近五期開獎</span>
      <span class="hist-note">※ 與 [官方] 同開獎號</span>
    </div>
    <div class="hist-body">
      <div v-for="row in rows" :key="row.issue" class="hist-row">
        <span class="hist-issue">{{ row.issue.slice(-3) }}</span>
        <span class="hist-dice">
          <Dice v-for="(code, idx) in row.openCode" :key="idx" :num="code" size="sm" />
        </span>
        <span class="hist-meta">
          <b>和{{ row.sum }}</b>
          <em :class="row.isBig ? 'is-red' : 'is-blue'">{{ row.isBig ? '大' : '小' }}</em>
          <em :class="row.isOdd ? 'is-red' : 'is-blue'">{{ row.isOdd ? '單' : '雙' }}</em>
          <em v-if="row.isTriple" class="is-triple">圍</em>
        </span>
      </div>
      <div v-if="rows.length === 0" class="hist-empty">
        {{ mxHistory.isLoading ? '載入中…' : '尚無開獎紀錄' }}
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.k3-history {
  /* 一期一列後不需要整個 .info-main 的寬度，取一半 */
  // width: 33%;
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

    .hist-note {
      font-size: 11px;
      color: var(--color-red-desc);
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
    /* 捲軸與 6hc 當期注單一致 */
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
      /* 固定寬度，期號位數不同也不會讓後面的骰子跳動 */
      flex: 0 0 30px;
      font-size: 11px;
      color: var(--color-red-desc);
    }

    .hist-dice {
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

        /* 大／單走紅、小／雙走藍，與 Header 的開獎標籤同一套配色 */
        &.is-red {
          background: #fee2e2;
          color: #b91c1c;
        }

        &.is-blue {
          background: #dbeafe;
          color: #1d4ed8;
        }

        &.is-triple {
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
    font-size: 12px;
    color: var(--color-red-desc);
  }
}
</style>
