<script setup lang="ts">
import { computed } from 'vue'
import { useDlt } from '~/composables/useDlt'

/**
 * 8 獎項對獎表——下注前只顯示名稱／對中條件，開獎結算後才會在使用者的注單記錄裡
 * 看到實際 perPrize（本表不顯示金額，因為官方獎金要等結算後才知道，見 design.md Decision 2）。
 */
const { current: mxCurrent } = useDlt()

const CONDITION_TEXT: Record<string, string> = {
  jackpotAssign: '對中 6 個號碼',
  secondAssign: '對中 5 個號碼＋特別號',
  thirdAssign: '對中 5 個號碼',
  fourthAssign: '對中 4 個號碼＋特別號',
  fifthAssign: '對中 4 個號碼',
  sixthAssign: '對中 3 個號碼＋特別號',
  seventhAssign: '對中 3 個號碼',
  normalAssign: '對中 2 個號碼＋特別號'
}

const tiers = computed(() => mxCurrent.runtime?.tiers ?? [])
</script>

<template>
  <div class="dlt-report">
    <h3 class="dlt-report-title">對獎表</h3>
    <p class="dlt-report-hint">獎金鏡射官方大樂透當期實際分配金額，開獎結算後才會公布，下注當下不顯示金額。</p>
    <table class="dlt-report-table">
      <thead>
        <tr>
          <th>獎項</th>
          <th>對中條件</th>
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
.dlt-report {
  border: 1px solid #fee2e2;
  border-radius: var(--base-radius, 0.375rem);
  background: #fff;
  padding: 0.75rem;
}

.dlt-report-title {
  margin: 0 0 0.25rem;
  font-size: 13px;
  font-weight: 700;
  color: var(--color-red-main, #7f1d1d);
}

.dlt-report-hint {
  margin: 0 0 0.5rem;
  font-size: 11px;
  color: var(--color-red-desc, #9ca3af);
}

.dlt-report-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;

  th, td {
    border-bottom: 1px solid #fee2e2;
    padding: 5px 6px;
    text-align: left;
  }

  th {
    color: var(--color-red-desc, #9ca3af);
    font-weight: 600;
  }

  td:first-child {
    font-weight: 700;
    color: var(--color-red-main, #7f1d1d);
    white-space: nowrap;
  }
}
</style>
