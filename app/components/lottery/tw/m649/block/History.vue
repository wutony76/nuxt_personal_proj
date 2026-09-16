<script setup lang="ts">
import { computed } from 'vue'
import Ball from '~/components/lottery/tw/m649/base/Ball.vue'
import { useM649 } from '~/composables/useM649'
import { M649_DRAW_COUNT } from '#shared/config/m649'

/**
 * 近期開獎（讀 recordOpenCode，逐期結算後才會累積）。上線初期筆數不足時直接顯示現有筆數，
 * 不是錯誤。49樂合彩一期 6 碼（＝當期大樂透主號、無特別號）。
 * ⚠️ 排除 admin 測試端點留下的假資料（issue 帶「（測試）」後綴，見 m649.ts _attemptSettlement()）。
 */
const { openCodeHistory, actions } = useM649()

const realList = computed(() => openCodeHistory.list.filter((row) => !row.issue.includes('（測試）')))
const rows = computed(() => realList.value.slice(0, 5))

const click = {
  /** 「來一注」：把這期開出的號碼套進投注區（6 碼會依 useM649.applyNumbers 取前 4 個當四合） */
  applyHistory: (row: { openCode: string[] }) => {
    const numbers = row.openCode.slice(0, M649_DRAW_COUNT).map((n) => Number(n)).filter((n) => Number.isFinite(n))
    actions.applyNumbers(numbers)
  }
}
</script>

<template>
  <div class="m649-history">
    <h3 class="m649-history-title">近五期開獎</h3>
    <p v-if="rows.length === 0" class="m649-history-empty">
      {{ openCodeHistory.isLoading ? '載入中…' : '目前尚無開獎紀錄（本站上線後逐期累積，非錯誤）' }}
    </p>
    <ul v-else class="m649-history-list">
      <li v-for="row in rows" :key="row.issue" class="m649-history-row">
        <span class="m649-history-issue">第 {{ row.issue }} 期</span>
        <span class="m649-history-balls">
          <Ball v-for="(n, idx) in row.openCode.slice(0, M649_DRAW_COUNT)" :key="idx" :num="n" size="xs" />
        </span>
        <button type="button" class="m649-history-bet-btn" @click="click.applyHistory(row)">來一注</button>
      </li>
    </ul>
  </div>
</template>

<style scoped lang="scss">
.m649-history {
  height: 250px;
  box-sizing: border-box;
  border: 1px solid var(--color-neutral-300, #dcd3c4);
  border-radius: var(--base-radius, 0.375rem);
  background: var(--color-neutral-100, #f9f4ed);
  padding: 0.75rem;
}

.m649-history-title {
  margin: 0 0 1.2rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px dashed var(--color-neutral-400, #c0b6a5);
  font-size: 13px;
  font-weight: 700;
  font-family: var(--font-heading);
  color: var(--color-accent-700, #8c491a);
}

.m649-history-empty {
  margin: 0;
  font-size: 12px;
  color: var(--color-neutral-700, #645c50);
}

.m649-history-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

.m649-history-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 12px;
}

.m649-history-issue {
  flex: 0 0 90px;
  white-space: nowrap;
  color: var(--color-neutral-700, #645c50);
}

.m649-history-balls {
  margin-left: 12px;
  display: flex;
  align-items: center;
  gap: 0.2rem;
}

.m649-history-bet-btn {
  margin-left: auto;
  flex: none;
  border: 1px solid var(--color-accent-700, #8c491a);
  border-radius: 999px;
  background: var(--color-neutral-100, #f9f4ed);
  padding: 2px 10px;
  font-size: 11px;
  font-weight: 700;
  color: var(--color-accent-700, #8c491a);
  cursor: pointer;

  &:hover {
    background: var(--color-accent-700, #8c491a);
    color: #fff;
  }
}
</style>
