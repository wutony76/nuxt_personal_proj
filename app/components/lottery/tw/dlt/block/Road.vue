<script setup lang="ts">
import { computed } from 'vue'
import { useDlt } from '~/composables/useDlt'
import { DLT_NUMBER_MIN, DLT_NUMBER_MAX } from '#shared/config/dlt'

/**
 * 冷熱號：統計 recordOpenCode 內 1~49 各號碼出現次數（含特別號）。
 * ⚠️ 排除 admin 測試端點留下的假資料（issue 帶「（測試）」後綴，見 dlt.ts _attemptSettlement()）
 * ——統計只採真實開獎紀錄，避免假資料污染次數分布。
 */
const { openCodeHistory } = useDlt()

const realList = computed(() => openCodeHistory.list.filter((row) => !row.issue.includes('（測試）')))

const counts = computed(() => {
  const map = new Map<number, number>()
  for (let n = DLT_NUMBER_MIN; n <= DLT_NUMBER_MAX; n++) map.set(n, 0)
  realList.value.forEach((row) => {
    row.openCode.forEach((code) => {
      const n = Number(code)
      if (Number.isFinite(n)) map.set(n, (map.get(n) ?? 0) + 1)
    })
  })
  return Array.from(map.entries()).map(([num, count]) => ({ num, count }))
})

const maxCount = computed(() => Math.max(1, ...counts.value.map((row) => row.count)))
const hasData = computed(() => realList.value.length > 0)
</script>

<template>
  <div class="dlt-road">
    <h3 class="dlt-road-title">冷熱號</h3>
    <p v-if="!hasData" class="dlt-road-empty">
      {{ openCodeHistory.isLoading ? '載入中…' : '目前累積的開獎期數還不夠，暫無冷熱號統計（非錯誤）' }}
    </p>
    <div v-else class="dlt-road-grid">
      <div v-for="row in counts" :key="row.num" class="dlt-road-cell">
        <span class="dlt-road-num">{{ String(row.num).padStart(2, '0') }}</span>
        <span class="dlt-road-bar">
          <span class="dlt-road-bar-fill" :style="{ width: `${(row.count / maxCount) * 100}%` }" />
        </span>
        <span class="dlt-road-count">{{ row.count }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.dlt-road {
  border: 1px solid var(--color-neutral-300, #dcd3c4);
  border-radius: var(--base-radius, 0.375rem);
  background: var(--color-neutral-100, #f9f4ed);
  padding: 0.75rem;
}

.dlt-road-title {
  margin: 0 0 0.5rem;
  font-size: 13px;
  font-weight: 700;
  font-family: var(--font-heading);
  color: var(--color-accent-700, #8c491a);
}

.dlt-road-empty {
  margin: 0;
  font-size: 12px;
  color: var(--color-neutral-700, #645c50);
}

.dlt-road-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 0.3rem;
}

.dlt-road-cell {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 11px;
}

.dlt-road-num {
  flex: 0 0 20px;
  font-weight: 700;
  color: var(--color-accent-700, #8c491a);
}

.dlt-road-bar {
  flex: 1;
  height: 8px;
  background: var(--color-neutral-200, #eee7db);
  border-radius: 4px;
  overflow: hidden;
}

.dlt-road-bar-fill {
  display: block;
  height: 100%;
  background: var(--color-accent-700, #8c491a);
}

.dlt-road-count {
  flex: 0 0 18px;
  text-align: right;
  color: var(--color-neutral-700, #645c50);
}
</style>
