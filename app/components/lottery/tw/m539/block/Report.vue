<script setup lang="ts">
import { computed } from 'vue'
import { useM539 } from '~/composables/useM539'

/**
 * 3 個「合數」對照表——下注前只顯示名稱／對中條件，開獎結算後才會在使用者的注單記錄裡
 * 看到實際 perPrize（本表不顯示金額，因為官方獎金要等結算後才知道，見 design.md Decision 2）。
 * 39樂合彩沒有分獎項等級，判定是「選的號碼是否全部被開出」（全中才中獎）。
 */
const { current: mxCurrent } = useM539()

const CONDITION_TEXT: Record<string, string> = {
  m539TwoAssign: '選 2 個號碼，全部開出',
  m539ThreeAssign: '選 3 個號碼，全部開出',
  m539FourAssign: '選 4 個號碼，全部開出'
}

const tiers = computed(() => mxCurrent.runtime?.tiers ?? [])
</script>

<template>
  <div class="m539-report">
    <h3 class="m539-report-title">玩法對照表</h3>
    <p class="m539-report-hint">獎金鏡射官方39樂合彩當期實際分配金額，開獎結算後才會公布，下注當下不顯示金額。</p>
    <table class="m539-report-table">
      <thead>
        <tr>
          <th>玩法</th>
          <th>中獎條件</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="tier in tiers" :key="tier.key">
          <td>{{ tier.label }}</td>
          <td>{{ CONDITION_TEXT[tier.key] ?? tier.desc ?? '—' }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped lang="scss">
.m539-report {
  border: 1px solid var(--color-neutral-300, #dcd3c4);
  border-radius: var(--base-radius, 0.375rem);
  background: var(--color-neutral-100, #f9f4ed);
  padding: 0.75rem;
}

.m539-report-title {
  margin: 0 0 0.25rem;
  font-size: 13px;
  font-weight: 700;
  font-family: var(--font-heading);
  color: var(--color-accent-700, #8c491a);
}

.m539-report-hint {
  margin: 0 0 0.5rem;
  font-size: 11px;
  color: var(--color-neutral-700, #645c50);
}

.m539-report-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;

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
