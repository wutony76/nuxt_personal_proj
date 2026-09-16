<script setup lang="ts">
import { computed } from 'vue'
import { useD539 } from '~/composables/useD539'
import { D539_NUMBER_MIN, D539_NUMBER_MAX } from '#shared/config/d539'

/**
 * 冷熱號：統計 recordOpenCode 內 1~39 各號碼出現次數（今彩539一期 5 碼、無特別號）。
 * ⚠️ 排除 admin 測試端點留下的假資料（issue 帶「（測試）」後綴，見 d539.ts _attemptSettlement()）
 * ——統計只採真實開獎紀錄，避免假資料污染次數分布。
 */
const { openCodeHistory } = useD539()

const realList = computed(() => openCodeHistory.list.filter((row) => !row.issue.includes('（測試）')))

const counts = computed(() => {
  const map = new Map<number, number>()
  for (let n = D539_NUMBER_MIN; n <= D539_NUMBER_MAX; n++) map.set(n, 0)
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
  <div class="d539-road">
    <h3 class="d539-road-title">冷熱號</h3>
    <p v-if="!hasData" class="d539-road-empty">
      {{ openCodeHistory.isLoading ? '載入中…' : '目前累積的開獎期數還不夠，暫無冷熱號統計（非錯誤）' }}
    </p>
    <div v-else class="d539-road-grid">
      <div v-for="row in counts" :key="row.num" class="d539-road-cell">
        <span class="d539-road-num">{{ String(row.num).padStart(2, '0') }}</span>
        <span class="d539-road-bar">
          <span class="d539-road-bar-fill" :style="{ width: `${(row.count / maxCount) * 100}%` }" />
        </span>
        <span class="d539-road-count">{{ row.count }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.d539-road {
  border: 1px solid var(--color-neutral-300, #dcd3c4);
  border-radius: var(--base-radius, 0.375rem);
  background: var(--color-neutral-100, #f9f4ed);
  padding: 0.75rem;
}

.d539-road-title {
  margin: 0 0 0.5rem;
  font-size: 13px;
  font-weight: 700;
  font-family: var(--font-heading);
  color: var(--color-accent-700, #8c491a);
}

.d539-road-empty {
  margin: 0;
  font-size: 12px;
  color: var(--color-neutral-700, #645c50);
}

.d539-road-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 0.3rem;
}

.d539-road-cell {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 11px;
}

.d539-road-num {
  flex: 0 0 20px;
  font-weight: 700;
  color: var(--color-accent-700, #8c491a);
}

.d539-road-bar {
  flex: 1;
  height: 8px;
  background: var(--color-neutral-200, #eee7db);
  border-radius: 4px;
  overflow: hidden;
}

.d539-road-bar-fill {
  display: block;
  height: 100%;
  background: var(--color-accent-700, #8c491a);
}

.d539-road-count {
  flex: 0 0 18px;
  text-align: right;
  color: var(--color-neutral-700, #645c50);
}
</style>
