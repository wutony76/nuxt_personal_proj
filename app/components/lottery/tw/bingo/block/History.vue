<script setup lang="ts">
import { computed } from 'vue'
import Ball from '~/components/lottery/tw/bingo/base/Ball.vue'
import { useBingo } from '~/composables/useBingo'

/**
 * 近期開獎（讀 recordOpenCode，逐期結算後才會累積）。上線初期筆數不足時直接顯示現有筆數，非錯誤。
 * ⚠️ 排除 admin 測試端點留下的假資料（issue 帶「（測試）」後綴，見 bingo.ts `_attemptSettlement()`）。
 */
const { openCodeHistory } = useBingo()

const realList = computed(() => openCodeHistory.list.filter((row) => !row.issue.includes('（測試）')))
const rows = computed(() => realList.value.slice(0, 5))
</script>

<template>
  <div class="bingo-history">
    <h3 class="bingo-history-title">近五期開獎</h3>
    <p v-if="rows.length === 0" class="bingo-history-empty">
      {{ openCodeHistory.isLoading ? '載入中…' : '目前尚無開獎紀錄（本站上線後逐期累積，非錯誤）' }}
    </p>
    <ul v-else class="bingo-history-list">
      <li v-for="row in rows" :key="row.issue" class="bingo-history-row">
        <span class="bingo-history-issue">第 {{ row.issue }} 期</span>
        <span class="bingo-history-balls">
          <Ball v-for="(n, idx) in row.openCode" :key="idx" :num="n" size="xs" :hit="idx === row.openCode.length - 1" />
        </span>
        <span class="bingo-history-tags">
          <span class="bingo-tag">{{ row.lotBigSmall || '—' }}</span>
          <span class="bingo-tag">{{ row.lotOddEven || '—' }}</span>
        </span>
      </li>
    </ul>
  </div>
</template>

<style scoped lang="scss">
.bingo-history {
  height: 250px;
  box-sizing: border-box;
  border: 1px solid var(--color-neutral-300, #dcd3c4);
  border-radius: var(--base-radius, 0.375rem);
  background: var(--color-neutral-100, #f9f4ed);
  padding: 0.75rem;
  overflow-y: auto;
}

.bingo-history-title {
  margin: 0 0 0.8rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px dashed var(--color-neutral-400, #c0b6a5);
  font-size: 13px;
  font-weight: 700;
  font-family: var(--font-heading);
  color: var(--color-accent-700, #8c491a);
}

.bingo-history-empty {
  margin: 0;
  font-size: 12px;
  color: var(--color-neutral-700, #645c50);
}

.bingo-history-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
}

.bingo-history-row {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  font-size: 12px;
  padding-bottom: 0.5rem;
  border-bottom: 1px dashed var(--color-neutral-300, #dcd3c4);

  &:last-child {
    border-bottom: none;
    padding-bottom: 0;
  }
}

.bingo-history-issue {
  color: var(--color-neutral-700, #645c50);
}

.bingo-history-balls {
  display: flex;
  align-items: center;
  gap: 0.15rem;
  flex-wrap: wrap;
}

.bingo-history-tags {
  display: flex;
  gap: 0.3rem;
}

.bingo-tag {
  border: 1px solid var(--color-accent-700, #8c491a);
  border-radius: 999px;
  background: var(--color-accent-100, #fff2eb);
  padding: 1px 8px;
  font-size: 11px;
  font-weight: 700;
  color: var(--color-accent-700, #8c491a);
}
</style>
