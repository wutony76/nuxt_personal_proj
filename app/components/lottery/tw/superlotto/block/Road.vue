<script setup lang="ts">
import { computed } from 'vue'
import { useSuperlotto } from '~/composables/useSuperlotto'
import { SUPERLOTTO_ZONE_A_MIN, SUPERLOTTO_ZONE_A_MAX } from '#shared/config/superlotto'

/**
 * 冷熱號：統計 recordOpenCode 內第一區（01–38）各號碼出現次數。
 * ⚠️ 只統計第一區（每期 openCode 前 6 碼）——第二區號碼 01–08 與第一區數值範圍重疊，
 *    若把第二區也算進來會讓 01–08 的次數被灌水、失真，因此刻意排除。
 * ⚠️ 排除 admin 測試端點留下的假資料（issue 帶「（測試）」後綴）。
 */
const { openCodeHistory } = useSuperlotto()

const realList = computed(() => openCodeHistory.list.filter((row) => !row.issue.includes('（測試）')))

const counts = computed(() => {
  const map = new Map<number, number>()
  for (let n = SUPERLOTTO_ZONE_A_MIN; n <= SUPERLOTTO_ZONE_A_MAX; n++) map.set(n, 0)
  realList.value.forEach((row) => {
    row.openCode.slice(0, 6).forEach((code) => {
      const n = Number(code)
      if (Number.isFinite(n) && map.has(n)) map.set(n, (map.get(n) ?? 0) + 1)
    })
  })
  return Array.from(map.entries()).map(([num, count]) => ({ num, count }))
})

const maxCount = computed(() => Math.max(1, ...counts.value.map((row) => row.count)))
const hasData = computed(() => realList.value.length > 0)
</script>

<template>
  <div class="superlotto-road">
    <h3 class="superlotto-road-title">冷熱號（第一區）</h3>
    <p v-if="!hasData" class="superlotto-road-empty">
      {{ openCodeHistory.isLoading ? '載入中…' : '目前累積的開獎期數還不夠，暫無冷熱號統計（非錯誤）' }}
    </p>
    <div v-else class="superlotto-road-grid">
      <div v-for="row in counts" :key="row.num" class="superlotto-road-cell">
        <span class="superlotto-road-num">{{ String(row.num).padStart(2, '0') }}</span>
        <span class="superlotto-road-bar">
          <span class="superlotto-road-bar-fill" :style="{ width: `${(row.count / maxCount) * 100}%` }" />
        </span>
        <span class="superlotto-road-count">{{ row.count }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.superlotto-road {
  border: 1px solid var(--color-neutral-300, #dcd3c4);
  border-radius: var(--base-radius, 0.375rem);
  background: var(--color-neutral-100, #f9f4ed);
  padding: 0.75rem;
}

.superlotto-road-title {
  margin: 0 0 0.5rem;
  font-size: 13px;
  font-weight: 700;
  font-family: var(--font-heading);
  color: var(--color-accent-700, #8c491a);
}

.superlotto-road-empty {
  margin: 0;
  font-size: 12px;
  color: var(--color-neutral-700, #645c50);
}

.superlotto-road-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 0.3rem;
}

.superlotto-road-cell {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 11px;
}

.superlotto-road-num {
  flex: 0 0 20px;
  font-weight: 700;
  color: var(--color-accent-700, #8c491a);
}

.superlotto-road-bar {
  flex: 1;
  height: 8px;
  background: var(--color-neutral-200, #eee7db);
  border-radius: 4px;
  overflow: hidden;
}

.superlotto-road-bar-fill {
  display: block;
  height: 100%;
  background: var(--color-accent-700, #8c491a);
}

.superlotto-road-count {
  flex: 0 0 18px;
  text-align: right;
  color: var(--color-neutral-700, #645c50);
}
</style>
