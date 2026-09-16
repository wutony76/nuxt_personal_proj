<script setup lang="ts">
import { computed } from 'vue'
import Ball from '~/components/lottery/tw/dlt/base/Ball.vue'
import { useDlt } from '~/composables/useDlt'

/**
 * 近期開獎（讀 recordOpenCode，逐期結算後才會累積，見 design.md Decision 4）。
 * 上線初期筆數不足時直接顯示現有筆數，不是錯誤。
 * ⚠️ 排除 admin 測試端點留下的假資料（issue 帶「（測試）」後綴，見 dlt.ts _attemptSettlement()）
 * ——這裡只給玩家看真實開獎紀錄，測試紀錄的追蹤／驗證用途在 DialogOpenCode.vue 那份完整清單即可。
 */
const { openCodeHistory, actions } = useDlt()

const realList = computed(() => openCodeHistory.list.filter((row) => !row.issue.includes('（測試）')))
const rows = computed(() => realList.value.slice(0, 5))

const click = {
  /** 「來一注」：把這期的 6 個正碼（不含特別號）套進投注區，比照官方紙本投注單不含特別號選項 */
  applyHistory: (row: { openCode: string[] }) => {
    const numbers = row.openCode.slice(0, 6).map((n) => Number(n)).filter((n) => Number.isFinite(n))
    actions.applyNumbers(numbers)
  }
}
</script>

<template>
  <div class="dlt-history">
    <h3 class="dlt-history-title">近五期開獎</h3>
    <p v-if="rows.length === 0" class="dlt-history-empty">
      {{ openCodeHistory.isLoading ? '載入中…' : '目前尚無開獎紀錄（本站上線後逐期累積，非錯誤）' }}
    </p>
    <ul v-else class="dlt-history-list">
      <li v-for="row in rows" :key="row.issue" class="dlt-history-row">
        <span class="dlt-history-issue">第 {{ row.issue }} 期</span>
        <span class="dlt-history-balls">
          <Ball v-for="(n, idx) in row.openCode.slice(0, 6)" :key="idx" :num="n" size="xs" />
          <span class="dlt-history-plus">+</span>
          <Ball :num="row.openCode[6]" size="xs" special />
        </span>
        <button type="button" class="dlt-history-bet-btn" @click="click.applyHistory(row)">來一注</button>
      </li>
    </ul>
  </div>
</template>

<style scoped lang="scss">
.dlt-history {
  height: 250px;
  box-sizing: border-box;
  border: 1px solid var(--color-neutral-300, #dcd3c4);
  border-radius: var(--base-radius, 0.375rem);
  background: var(--color-neutral-100, #f9f4ed);
  padding: 0.75rem;
}

.dlt-history-title {
  margin: 0 0 1.2rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px dashed var(--color-neutral-400, #c0b6a5);
  font-size: 13px;
  font-weight: 700;
  font-family: var(--font-heading);
  color: var(--color-accent-700, #8c491a);
}

.dlt-history-empty {
  margin: 0;
  font-size: 12px;
  color: var(--color-neutral-700, #645c50);
}

.dlt-history-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

.dlt-history-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 12px;
}

.dlt-history-issue {
  flex: 0 0 90px;
  white-space: nowrap;
  color: var(--color-neutral-700, #645c50);
}

.dlt-history-balls {
  margin-left: 20px;
  display: flex;
  align-items: center;
  gap: 0.2rem;

  :deep(.is-special) {
    margin-left: 3px;
  }
}

.dlt-history-plus {
  font-weight: 700;
  color: var(--color-neutral-700, #645c50);
}

.dlt-history-bet-btn {
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
