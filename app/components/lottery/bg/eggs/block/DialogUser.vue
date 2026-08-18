<script setup lang="ts">
import { computed, reactive } from 'vue'
import Ball from '~/components/lottery/bg/eggs/base/Ball.vue'
import DialogShell from '~/components/lottery/bg/eggs/block/DialogShell.vue'
import { useEggs } from '~/composables/useEggs'

/** 下注紀錄彈窗：餘額變動 / 下注紀錄 / 可領獎金（PC蛋蛋只有信用盤，比照 k3 拿掉盤口分支） */
const props = defineProps<{ visible: boolean }>()
const emit = defineEmits<{ close: [] }>()

const { userRecord: mxRecord, wallet: mxWallet, fetch: mxFetch } = useEggs()

const TABS = [
  { key: 'claim', label: '可領獎金' },
  { key: 'balance', label: '餘額變動表' },
  { key: 'bets', label: '下注紀錄' }
] as const
const state = reactive({ tab: 'bets' as (typeof TABS)[number]['key'] })

const money = (value: number) => Number(value ?? 0).toLocaleString('zh-TW', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const timeOf = (ms: number) => new Date(Number(ms || 0)).toLocaleString('zh-TW')
const claimable = computed(() =>
  Number(mxRecord.claimableIssues.reduce((sum, item) => sum + Number(item.amount ?? 0), 0).toFixed(2))
)
const statusText = (status: string) => ({ win: '中獎', lose: '未中', tie: '和局', pending: '待開獎' }[status] ?? status)
</script>

<template>
  <DialogShell :visible="props.visible" title="下注紀錄" @close="emit('close')">
    <div class="du-summary">
      <span>F幣餘額 <b class="is-coin">{{ money(mxWallet.coin) }}</b></span>
      <span>可領獎金 <b>{{ money(claimable) }}</b></span>
      <button type="button" class="claim-btn" :disabled="claimable <= 0 || mxRecord.isSubmittingClaim"
        @click="mxFetch.claimOneIssue()">
        {{ mxRecord.isSubmittingClaim ? '領取中…' : '領取一期' }}
      </button>
    </div>

    <nav class="du-tabs">
      <button v-for="tab in TABS" :key="tab.key" type="button" class="du-tab" :class="{ active: state.tab === tab.key }"
        @click="state.tab = tab.key">
        {{ tab.label }}
      </button>
    </nav>

    <!-- 可領獎金 -->
    <div v-if="state.tab === 'claim'" class="dialog-table-wrap">
      <table class="report-table">
        <thead>
          <tr>
            <th>期數</th>
            <th>金額</th>
            <th>開獎</th>
            <th>時間</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in mxRecord.claimableIssues" :key="item.issue">
            <td>{{ item.issue }}</td>
            <td>{{ money(Number(item.amount)) }}</td>
            <td>
              <span class="du-ball">
                <Ball v-for="(code, idx) in (item.openCode ?? [])" :key="idx" :digit="code" size="sm" />
              </span>
            </td>
            <td>{{ timeOf(Number(item.createdAt)) }}</td>
          </tr>
          <tr v-if="mxRecord.claimableIssues.length === 0">
            <td colspan="4">目前沒有可領取獎金</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 餘額變動表 -->
    <div v-else-if="state.tab === 'balance'" class="dialog-table-wrap">
      <table class="report-table">
        <thead>
          <tr>
            <th>時間</th>
            <th>期數</th>
            <th>類型</th>
            <th>備註</th>
            <th>變動</th>
            <th>餘額</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in mxRecord.balanceChanges" :key="String(row.id)">
            <td>{{ timeOf(Number(row.createdAt)) }}</td>
            <td>{{ row.issue }}</td>
            <td>{{ row.type === 'bet' ? '下注' : '領獎' }}</td>
            <td>{{ row.note }}</td>
            <td :class="Number(row.amount) < 0 ? 'is-minus' : 'is-plus'">{{ money(Number(row.amount)) }}</td>
            <td>{{ money(Number(row.after)) }}</td>
          </tr>
          <tr v-if="mxRecord.balanceChanges.length === 0">
            <td colspan="6" class="no-records">暫無資料</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 下注紀錄 -->
    <div v-else class="dialog-table-wrap">
      <table class="report-table">
        <thead>
          <tr>
            <th class="th-order">投注單號</th>
            <th>期數</th>
            <th>注碼</th>
            <th>金額</th>
            <th>賠率</th>
            <th>狀態</th>
            <th>派彩</th>
            <th>開獎</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in mxRecord.betHistory" :key="row.orderId">
            <td class="td-order" :title="row.orderId">{{ row.orderId }}</td>
            <td>{{ row.issue }}</td>
            <td>{{ row.betCode.join('、') }}</td>
            <td>{{ money(row.coin) }}</td>
            <td>{{ row.odds ?? '—' }}</td>
            <td :class="`is-${row.winStatus}`">{{ statusText(row.winStatus) }}</td>
            <td>{{ row.winAmount > 0 ? money(row.winAmount) : '—' }}</td>
            <td>
              <span v-if="row.openCode?.length" class="du-ball">
                <Ball v-for="(code, idx) in row.openCode" :key="idx" :digit="code" size="sm" />
              </span>
              <em v-else>—</em>
            </td>
          </tr>
          <tr v-if="mxRecord.betHistory.length === 0">
            <td colspan="8" class="no-records">暫無資料</td>
          </tr>
        </tbody>
      </table>
    </div>
  </DialogShell>
</template>

<style scoped lang="scss">
/* 表格自己捲動（比照 k3 的 DialogUser.vue） */
.dialog-table-wrap {
  max-height: 320px;
  overflow: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--color-red-desc) #e8e6e6;
}

:deep(.report-table) {
  border-top: 0;

  thead th {
    position: sticky;
    top: 0;
    z-index: 2;
    box-shadow:
      inset 0 1px 0 0 var(--color-red-content),
      inset 0 -1px 0 0 var(--color-red-content);
  }
}

:deep(.report-table) {
  .th-order,
  .td-order {
    white-space: nowrap;
    font-size: 11px;
    font-variant-numeric: tabular-nums;
  }
}

.no-records {
  height: 150px;
  background: #f7f7f7;
  color: var(--text-gray);
}

.du-summary {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 10px;
  font-size: 13px;
  color: var(--color-red-desc);

  b {
    font-size: 15px;
    font-weight: 700;
    color: var(--color-red-main);
  }

  b.is-coin {
    color: #15803d;
  }

  .claim-btn {
    margin-left: auto;
    border: 1px solid var(--color-red-main);
    border-radius: 4px;
    background: var(--color-red-main);
    padding: 4px 14px;
    font-size: 12px;
    font-weight: 700;
    color: #fff;
    cursor: pointer;

    &:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }
  }
}

.du-tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 8px;

  .du-tab {
    border: 1px solid var(--color-red-content);
    border-radius: 4px 4px 0 0;
    background: #fff;
    padding: 4px 14px;
    font-size: 13px;
    font-weight: 700;
    color: var(--color-red-main);
    cursor: pointer;

    &.active {
      border-color: var(--color-red-main);
      background: var(--color-red-main);
      color: #fff;
    }
  }
}

.du-ball {
  display: inline-flex;
  gap: 3px;
}

:deep(.report-table) {
  .is-plus {
    color: #15803d;
    font-weight: 700;
  }

  .is-minus {
    color: #dc2626;
    font-weight: 700;
  }

  .is-win {
    color: #15803d;
    font-weight: 700;
  }

  .is-tie {
    color: #b45309;
    font-weight: 700;
  }

  .is-pending {
    color: #f59e0b;
  }

  em {
    font-style: normal;
    color: #d97706;
  }
}
</style>
