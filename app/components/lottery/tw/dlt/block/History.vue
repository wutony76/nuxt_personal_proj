<script setup lang="ts">
import { computed } from 'vue'
import Ball from '~/components/lottery/tw/dlt/base/Ball.vue'
import { useDlt } from '~/composables/useDlt'

/**
 * 近期開獎（讀 recordOpenCode，逐期結算後才會累積，見 design.md Decision 4）。
 * 上線初期筆數不足時直接顯示現有筆數，不是錯誤。
 */
const { openCodeHistory } = useDlt()

const rows = computed(() => openCodeHistory.list.slice(0, 10))
</script>

<template>
  <div class="dlt-history">
    <h3 class="dlt-history-title">近期開獎</h3>
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
      </li>
    </ul>
  </div>
</template>

<style scoped lang="scss">
.dlt-history {
  border: 1px solid #fee2e2;
  border-radius: var(--base-radius, 0.375rem);
  background: #fff;
  padding: 0.75rem;
}

.dlt-history-title {
  margin: 0 0 0.5rem;
  font-size: 13px;
  font-weight: 700;
  color: var(--color-red-main, #7f1d1d);
}

.dlt-history-empty {
  margin: 0;
  font-size: 12px;
  color: var(--color-red-desc, #9ca3af);
}

.dlt-history-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.dlt-history-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 12px;
}

.dlt-history-issue {
  flex: 0 0 90px;
  color: var(--color-red-desc, #9ca3af);
}

.dlt-history-balls {
  display: flex;
  align-items: center;
  gap: 0.2rem;
}

.dlt-history-plus {
  font-weight: 700;
  color: var(--color-red-desc, #9ca3af);
}
</style>
