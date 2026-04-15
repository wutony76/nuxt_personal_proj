<script setup lang="ts">
import { computed, reactive } from 'vue'
import Ball from '~/components/lottery/bg/6hc/of/Ball.vue'

interface ReportIssueBetRow {
  id: string
  time: string
  bets: string[]
  coin: number
  status: number
}

const STATUS_MAP = new Map<number, string>([
  [-1, 'none'],
  [0, 'none'],
  [1, 'pending'],
  [2, 'win'],
  [3, 'lose'],
  [4, 'tie'],
  [5, 'cancel'],
  [6, 'refund'],
  [7, 'refund'],
])

const state = reactive({
  detail: [] as ReportIssueBetRow[],
})
const handle = {}
const init = {
  run: () => {
    state.detail = [
      {
        id: '1234567890',
        time: '10:00:00',
        bets: ['1', '2', '3', '4', '5', '6', '7'],
        coin: 100,
        status: -1,
      },
      {
        id: '1234567890',
        time: '10:00:00',
        bets: ['1', '2', '3', '4', '5', '6', '7'],
        coin: 100,
        status: -1,
      },
      {
        id: '1234567890',
        time: '10:00:00',
        bets: ['1', '2', '3', '4', '5', '6', '7'],
        coin: 100,
        status: -1,
      },
      {
        id: '1234567890',
        time: '10:00:00',
        bets: ['1', '2', '3', '4', '5', '6', '7'],
        coin: 100,
        status: -1,
      }, {
        id: '1234567890',
        time: '10:00:00',
        bets: ['1', '2', '3', '4', '5', '6', '7'],
        coin: 100,
        status: -1,
      },
      {
        id: '1234567890',
        time: '10:00:00',
        bets: ['1', '2', '3', '4', '5', '6', '7'],
        coin: 100,
        status: -1,
      },
      {
        id: '1234567890',
        time: '10:00:00',
        bets: ['1', '2', '3', '4', '5', '6', '7'],
        coin: 100,
        status: -1,
      },
      {
        id: '1234567890',
        time: '10:00:00',
        bets: ['1', '2', '3', '4', '5', '6', '7'],
        coin: 100,
        status: -1,
      },
      {
        id: '1234567890',
        time: '10:00:00',
        bets: ['1', '2', '3', '4', '5', '6', '7'],
        coin: 100,
        status: -1,
      },
      {
        id: '1234567890',
        time: '10:00:00',
        bets: ['1', '2', '3', '4', '5', '6', '7'],
        coin: 100,
        status: -1,
      },
      {
        id: '1234567890',
        time: '10:00:00',
        bets: ['1', '2', '3', '4', '5', '6', '7'],
        coin: 100,
        status: -1,
      }, {
        id: '1234567890',
        time: '10:00:00',
        bets: ['1', '2', '3', '4', '5', '6', '7'],
        coin: 100,
        status: -1,
      },
      {
        id: '1234567890',
        time: '10:00:00',
        bets: ['1', '2', '3', '4', '5', '6', '7'],
        coin: 100,
        status: -1,
      },
      {
        id: '1234567890',
        time: '10:00:00',
        bets: ['1', '2', '3', '4', '5', '6', '7'],
        coin: 100,
        status: -1,
      },

    ]
  }
}

const hasData = computed(() => state.detail.length > 0)
init.run()
</script>

<template>
  <div class="report-issue-bets">
    <table class="report-table report-issue-bets-table">
      <colgroup>
        <col class="col-id" />
        <col class="col-time" />
        <col class="col-bet" />
        <col class="col-coin" />
        <col class="col-status" />
      </colgroup>
      <thead>
        <tr>
          <th class="col-id">投注單號</th>
          <th class="col-time">投注時間</th>
          <th class="col-bet">投注號碼</th>
          <th class="col-coin">投注金額</th>
          <th class="col-status">狀態</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(detail, rowIdx) in state.detail" :key="rowIdx">
          <td class="col-id">{{ detail.id }}</td>
          <td class="col-time">{{ detail.time }}</td>
          <td class="col-bet">
            <div class="order-bets">
              <Ball :data="{ num: Number(ball), label: String(ball).padStart(2, '0'), selected: true }"
                v-for="(ball, ballIdx) in detail.bets" :key="ballIdx" />
            </div>
          </td>
          <td class="col-coin">{{ detail.coin }}</td>
          <td class="col-status">{{ STATUS_MAP.get(detail.status) }}</td>
        </tr>
        <tr v-if="!hasData" class="tr-no-records">
          <td colspan="5" class="no-records">暫無資料</td>
        </tr>
        <tr class="subtotal-row">
          <td>小計</td>
          <td />
          <td />
          <td />
          <td />
        </tr>
        <tr class="total-row">
          <td>總計</td>
          <td />
          <td />
          <td />
          <td />
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped lang="scss">
.color-blue {
  color: var(--text-blue);
}

.color-red {
  color: var(--text-red);
}

.st-pending {
  color: var(--text-green);
}

.st-tie {
  color: var(--text-link);
}

.st-win {
  color: var(--text-red);
}

.st-muted {
  color: var(--text-gray);
}

.order-bets {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-width: 0;
  gap: 0.2rem;
}

.order-bets :deep(.ball-wrapper .ball) {
  width: 1.65rem;
  height: 1.65rem;
  font-size: 0.95rem;
}

.order-bets :deep(.ball.selected) {
  border-width: 0.12rem;
}

.order-bets :deep(.ball.color-y) {
  border-width: 0.12rem;
}

/* 單一 report-table：沿用 .lottery-6hc-of .report-table（lhc_of.scss），此處只補版面與欄寬 */
.report-issue-bets {
  flex: 1 1 auto;
  min-height: 0;
  width: 100%;
  overflow: auto;
}

.report-issue-bets-table {
  table-layout: fixed;
}

.report-issue-bets-table col.col-id {
  width: 28%;
}

.report-issue-bets-table col.col-time {
  width: 16%;
}

.report-issue-bets-table col.col-bet {
  width: 30%;
}

.report-issue-bets-table col.col-coin {
  width: 14%;
}

.report-issue-bets-table col.col-status {
  width: 12%;
}

.report-issue-bets-table tr.subtotal-row td {
  background: color-mix(in srgb, var(--color-red-main) 5%, #f9f9f9);
  font-weight: 600;
}
</style>
