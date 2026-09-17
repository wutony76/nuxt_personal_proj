<script setup lang="ts">
import { BINGO_STAR_PAYOUT, BINGO_SUPER_NUMBER_PRIZE, BINGO_BIG_SMALL_PRIZE, BINGO_ODD_EVEN_PRIZE, BINGO_STAR_MIN, BINGO_STAR_MAX } from '#shared/config/bingo'

/** 4 種投注類型的固定賠率對照表——賓果賓果官方沒有中獎明細端點，賠率全部是官方公開固定金額，下注前即可得知（不像 P3/P4 正彩/組彩要等結算才知道金額） */
const starRows = Array.from({ length: BINGO_STAR_MAX - BINGO_STAR_MIN + 1 }, (_, i) => {
  const star = BINGO_STAR_MIN + i
  const table = BINGO_STAR_PAYOUT[star] ?? {}
  const hits = Object.keys(table).map(Number).sort((a, b) => b - a)
  return { star, text: hits.map((hit) => `中${hit}中${table[hit]}元`).join('／') }
})
</script>

<template>
  <div class="bingo-report">
    <h3 class="bingo-report-title">玩法對照表</h3>
    <p class="bingo-report-hint">賓果賓果官方沒有中獎明細查詢端點，以下賠率為台灣彩券官方公開固定金額，下注前即可得知。</p>
    <table class="bingo-report-table">
      <thead>
        <tr>
          <th>星數</th>
          <th>對中獎金（每注 25 元）</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in starRows" :key="row.star">
          <td>{{ row.star }} 星</td>
          <td>{{ row.text }}</td>
        </tr>
        <tr>
          <td>超級獎號</td>
          <td>猜中第 20 個開出的號碼：{{ BINGO_SUPER_NUMBER_PRIZE }} 元（加購 25 元／注）</td>
        </tr>
        <tr>
          <td>猜大小</td>
          <td>猜中：{{ BINGO_BIG_SMALL_PRIZE }} 元；和局退款</td>
        </tr>
        <tr>
          <td>猜單雙</td>
          <td>猜中：{{ BINGO_ODD_EVEN_PRIZE }} 元；和局退款</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped lang="scss">
.bingo-report {
  border: 1px solid var(--color-neutral-300, #dcd3c4);
  border-radius: var(--base-radius, 0.375rem);
  background: var(--color-neutral-100, #f9f4ed);
  padding: 0.75rem;
}

.bingo-report-title {
  margin: 0 0 0.25rem;
  font-size: 13px;
  font-weight: 700;
  font-family: var(--font-heading);
  color: var(--color-accent-700, #8c491a);
}

.bingo-report-hint {
  margin: 0 0 0.5rem;
  font-size: 11px;
  color: var(--color-neutral-700, #645c50);
}

.bingo-report-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
  max-height: 260px;

  th, td {
    border-bottom: 1px dashed var(--color-neutral-400, #c0b6a5);
    padding: 5px 6px;
    text-align: left;
  }

  th {
    color: var(--color-neutral-700, #645c50);
    font-weight: 600;
  }

  td:first-child {
    font-weight: 700;
    color: var(--color-accent-700, #8c491a);
    white-space: nowrap;
  }
}
</style>
