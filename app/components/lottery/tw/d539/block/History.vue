<script setup lang="ts">
import { computed } from 'vue'
import Ball from '~/components/lottery/tw/d539/base/Ball.vue'
import { useD539 } from '~/composables/useD539'

/**
 * 近期開獎（讀 recordOpenCode，逐期結算後才會累積）。上線初期筆數不足時直接顯示現有筆數，
 * 不是錯誤。今彩539一期 5 碼、無特別號。
 * ⚠️ 排除 admin 測試端點留下的假資料（issue 帶「（測試）」後綴，見 d539.ts _attemptSettlement()）
 * ——這裡只給玩家看真實開獎紀錄，測試紀錄的追蹤／驗證用途在 DialogOpenCode.vue 那份完整清單即可。
 */
const { openCodeHistory, actions } = useD539()

const realList = computed(() => openCodeHistory.list.filter((row) => !row.issue.includes('（測試）')))
const rows = computed(() => realList.value.slice(0, 5))

const click = {
  /** 「來一注」：把這期的 5 個號碼套進投注區 */
  applyHistory: (row: { openCode: string[] }) => {
    const numbers = row.openCode.slice(0, 5).map((n) => Number(n)).filter((n) => Number.isFinite(n))
    actions.applyNumbers(numbers)
  }
}
</script>

<template>
  <div class="d539-history">
    <h3 class="d539-history-title">近五期開獎</h3>
    <p v-if="rows.length === 0" class="d539-history-empty">
      {{ openCodeHistory.isLoading ? '載入中…' : '目前尚無開獎紀錄（本站上線後逐期累積，非錯誤）' }}
    </p>
    <ul v-else class="d539-history-list">
      <li v-for="row in rows" :key="row.issue" class="d539-history-row">
        <span class="d539-history-issue">第 {{ row.issue }} 期</span>
        <span class="d539-history-balls">
          <Ball v-for="(n, idx) in row.openCode.slice(0, 5)" :key="idx" :num="n" size="xs" />
        </span>
        <button type="button" class="d539-history-bet-btn" @click="click.applyHistory(row)">來一注</button>
      </li>
    </ul>
  </div>
</template>

<style scoped lang="scss">
.d539-history {
  height: 250px;
  box-sizing: border-box;
  border: 1px solid var(--color-neutral-300, #dcd3c4);
  border-radius: var(--base-radius, 0.375rem);
  background: var(--color-neutral-100, #f9f4ed);
  padding: 0.75rem;
}

.d539-history-title {
  margin: 0 0 1.2rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px dashed var(--color-neutral-400, #c0b6a5);
  font-size: 13px;
  font-weight: 700;
  font-family: var(--font-heading);
  color: var(--color-accent-700, #8c491a);
}

.d539-history-empty {
  margin: 0;
  font-size: 12px;
  color: var(--color-neutral-700, #645c50);
}

.d539-history-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

.d539-history-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 12px;
}

.d539-history-issue {
  flex: 0 0 90px;
  white-space: nowrap;
  color: var(--color-neutral-700, #645c50);
}

.d539-history-balls {
  margin-left: 20px;
  display: flex;
  align-items: center;
  gap: 0.2rem;
}

.d539-history-bet-btn {
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
