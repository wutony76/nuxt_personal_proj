<script setup lang="ts">
import { computed } from 'vue'
import { useP4 } from '~/composables/useP4'

/**
 * 2 種下注方式對照表——正彩／組彩下注前只顯示名稱／對中條件，開獎結算後才會在使用者的注單
 * 記錄裡看到實際 perPrize（本表不顯示金額，見 design.md Decision 5）。4星彩官方沒有對彩，
 * 不比照 P3 多顯示對彩列。
 */
const { current: p4Current } = useP4()

const CONDITION_TEXT: Record<string, string> = {
  lotto4DFirstAssign: '正彩：4 位數字逐位對應開獎號碼，完全相同',
  lotto4DSecondAssign: '組彩（4 碼互異）：數字相同、順序不同',
  lotto4DThirdAssign: '組彩（有任何重複，含一對相同／兩對相同／三同一異）：數字相同、順序不同'
}

const tiers = computed(() => p4Current.runtime?.tiers ?? [])
</script>

<template>
  <div class="p4-report">
    <h3 class="p4-report-title">玩法對照表</h3>
    <p class="p4-report-hint">正彩／組彩獎金鏡射官方4星彩當期實際分配金額，開獎結算後才會公布。</p>
    <table class="p4-report-table">
      <thead>
        <tr>
          <th>玩法</th>
          <th>中獎條件</th>
          <th>獎金</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="tier in tiers" :key="tier.key">
          <td>{{ tier.label }}</td>
          <td>{{ CONDITION_TEXT[tier.key] ?? tier.desc ?? '—' }}</td>
          <td>結算後公布</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped lang="scss">
.p4-report {
  border: 1px solid var(--color-neutral-300, #dcd3c4);
  border-radius: var(--base-radius, 0.375rem);
  background: var(--color-neutral-100, #f9f4ed);
  padding: 0.75rem;
}

.p4-report-title {
  margin: 0 0 0.25rem;
  font-size: 13px;
  font-weight: 700;
  font-family: var(--font-heading);
  color: var(--color-accent-700, #8c491a);
}

.p4-report-hint {
  margin: 0 0 0.5rem;
  font-size: 11px;
  color: var(--color-neutral-700, #645c50);
}

.p4-report-table {
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
