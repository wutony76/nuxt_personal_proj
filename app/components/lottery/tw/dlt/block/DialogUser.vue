<script setup lang="ts">
import { computed } from 'vue'
import DialogShell from '~/components/lottery/tw/dlt/block/DialogShell.vue'
import { useDlt } from '~/composables/useDlt'

const props = defineProps<{ visible: boolean }>()
const emit = defineEmits<{ close: [] }>()

const { userRecord, fetch } = useDlt()

const money = (value: number) => Number(value ?? 0).toLocaleString('zh-TW')

const claimable = computed(() => userRecord.claimableIssues.filter((item) => Number(item.amount) > 0))
const totalClaimable = computed(() => claimable.value.reduce((sum, item) => sum + Number(item.amount ?? 0), 0))

const click = {
  claim: () => fetch.claimOneIssue()
}
</script>

<template>
  <DialogShell :visible="props.visible" title="我的紀錄" @close="emit('close')">
    <section class="dlt-user-section">
      <h4>可領獎金（合計 {{ money(totalClaimable) }}）</h4>
      <button type="button" class="dlt-claim-btn" :disabled="claimable.length === 0 || userRecord.isSubmittingClaim"
        @click="click.claim">
        {{ userRecord.isSubmittingClaim ? '領取中…' : '領取一期' }}
      </button>
      <ul class="dlt-user-list">
        <li v-for="item in claimable" :key="item.issue">
          第 {{ item.issue }} 期 — {{ money(item.amount) }}
        </li>
      </ul>
    </section>

    <section class="dlt-user-section">
      <h4>下注紀錄</h4>
      <table class="dlt-user-table">
        <thead>
          <tr>
            <th>期別</th>
            <th>號碼</th>
            <th>狀態</th>
            <th>獎項</th>
            <th>派彩</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in userRecord.betHistory" :key="row.orderId">
            <td>{{ row.issue }}</td>
            <td>{{ row.betCode.join(' / ') }}</td>
            <td>{{ row.winStatus === 'pending' ? '結算中' : row.winStatus === 'win' ? '中獎' : '未中' }}</td>
            <td>{{ row.tierLabel || '—' }}</td>
            <td>{{ row.winAmount > 0 ? money(row.winAmount) : '—' }}</td>
          </tr>
        </tbody>
      </table>
    </section>
  </DialogShell>
</template>

<style scoped lang="scss">
.dlt-user-section {
  margin-bottom: 1rem;

  h4 {
    margin: 0 0 0.5rem;
    font-size: 13px;
    color: var(--color-red-main);
  }
}

.dlt-claim-btn {
  border: 1px solid var(--color-red-main);
  background: var(--color-red-main);
  color: #fff;
  border-radius: 0.25rem;
  font-size: 12px;
  padding: 4px 10px;
  cursor: pointer;
  margin-bottom: 0.5rem;

  &:disabled {
    opacity: 0.5;
    cursor: default;
  }
}

.dlt-user-list {
  margin: 0;
  padding-left: 1.2rem;
  font-size: 12px;
}

.dlt-user-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;

  th, td {
    border-bottom: 1px solid #fee2e2;
    padding: 4px 6px;
    text-align: left;
  }
}
</style>
