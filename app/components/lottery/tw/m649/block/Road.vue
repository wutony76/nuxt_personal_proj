<script setup lang="ts">
import { computed } from 'vue'
import { useM649 } from '~/composables/useM649'
import { M649_NUMBER_MIN, M649_NUMBER_MAX } from '#shared/config/m649'

/**
 * 冷熱號：統計 recordOpenCode 內 1~49 各號碼出現次數（49樂合彩一期 6 碼、無特別號）。
 * ⚠️ 排除 admin 測試端點留下的假資料（issue 帶「（測試）」後綴，見 m649.ts _attemptSettlement()）
 * ——統計只採真實開獎紀錄，避免假資料污染次數分布。
 */
const { openCodeHistory } = useM649()

const realList = computed(() => openCodeHistory.list.filter((row) => !row.issue.includes('（測試）')))

const counts = computed(() => {
  const map = new Map<number, number>()
  for (let n = M649_NUMBER_MIN; n <= M649_NUMBER_MAX; n++) map.set(n, 0)
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
  <div class="m649-road">
    <h3 class="m649-road-title">冷熱號</h3>
    <p v-if="!hasData" class="m649-road-empty">
      {{ openCodeHistory.isLoading ? '載入中…' : '目前累積的開獎期數還不夠，暫無冷熱號統計（非錯誤）' }}
    </p>
    <div v-else class="m649-road-grid">
      <div v-for="row in counts" :key="row.num" class="m649-road-cell">
        <span class="m649-road-num">{{ String(row.num).padStart(2, '0') }}</span>
        <span class="m649-road-bar">
          <span class="m649-road-bar-fill" :style="{ width: `${(row.count / maxCount) * 100}%` }" />
        </span>
        <span class="m649-road-count">{{ row.count }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.m649-road {
  border: 1px solid var(--color-neutral-300, #dcd3c4);
  border-radius: var(--base-radius, 0.375rem);
  background: var(--color-neutral-100, #f9f4ed);
  padding: 0.75rem;
}

.m649-road-title {
  margin: 0 0 0.5rem;
  font-size: 13px;
  font-weight: 700;
  font-family: var(--font-heading);
  color: var(--color-accent-700, #8c491a);
}

.m649-road-empty {
  margin: 0;
  font-size: 12px;
  color: var(--color-neutral-700, #645c50);
}

.m649-road-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 0.3rem;
}

.m649-road-cell {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 11px;
}

.m649-road-num {
  flex: 0 0 20px;
  font-weight: 700;
  color: var(--color-accent-700, #8c491a);
}

.m649-road-bar {
  flex: 1;
  height: 8px;
  background: var(--color-neutral-200, #eee7db);
  border-radius: 4px;
  overflow: hidden;
}

.m649-road-bar-fill {
  display: block;
  height: 100%;
  background: var(--color-accent-700, #8c491a);
}

.m649-road-count {
  flex: 0 0 18px;
  text-align: right;
  color: var(--color-neutral-700, #645c50);
}
</style>
