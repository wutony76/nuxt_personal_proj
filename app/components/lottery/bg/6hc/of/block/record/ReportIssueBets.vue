<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import Ball from '~/components/lottery/bg/6hc/of/base/Ball.vue'
import Pagination from '~/components/lottery/bg/6hc/of/block/record/Pagination.vue'


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

const { current: mxCurrent } = use6hcOfficial()

// TODO: TTT.TEST.DATA 可調整測試資料筆數（0 = 顯示暫無資料）
const MOCK_DETAIL_COUNT = 20
const handle = {}
const init = {
  run: () => {
    // TODO: TTT.TEST.DATA 後端資料
    mxCurrent.detail = Array.from({ length: MOCK_DETAIL_COUNT }, (_, idx) => ({
      id: String(1234567890 + idx),
      time: '10:00:00',
      bets: ['1', '2', '3', '4', '5', '6', '7'],
      coin: 100,
      status: -1,
    }))
  }
}

const hasData = computed(() => mxCurrent.detail.length > 0)
const betListPage = ref(1)
const betListPageSize = ref(10)
const betListTotal = computed(() => mxCurrent.detail.length)
const tableScrollRef = ref<HTMLElement | null>(null)
const hasVerticalScroll = ref(false)
let tableResizeObserver: ResizeObserver | null = null

const syncScrollState = () => {
  const el = tableScrollRef.value

  if (!el) {
    hasVerticalScroll.value = false
    return
  }

  hasVerticalScroll.value = el.scrollHeight > el.clientHeight + 1
}

onMounted(() => {
  nextTick(syncScrollState)
  tableResizeObserver = new ResizeObserver(syncScrollState)
  if (tableScrollRef.value) {
    tableResizeObserver.observe(tableScrollRef.value)
  }
  window.addEventListener('resize', syncScrollState)
})

onBeforeUnmount(() => {
  tableResizeObserver?.disconnect()
  window.removeEventListener('resize', syncScrollState)
})

watch(() => mxCurrent.detail.length, () => {
  nextTick(syncScrollState)
})
init.run()
</script>

<template>
  <div class="report-issue-bets-root">
    <div ref="tableScrollRef" class="report-issue-bets" :class="{ 'has-scroll': hasVerticalScroll }">
      <table class="report-table report-issue-bets-table" :class="{ 'is-empty': !hasData }">
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
          <tr v-for="(detail, rowIdx) in mxCurrent.detail" :key="rowIdx">
            <td class="col-id">{{ detail.id }}</td>
            <td class="col-time">{{ detail.time }}</td>
            <td class="col-bet">
              <div class="order-bets">
                <Ball :data="{ num: Number(ball), label: String(ball).padStart(2, '0'), selected: true }"
                  v-for="(ball, ballIdx) in detail.bets" :key="ballIdx" />
              </div>
            </td>
            <td class="col-coin">{{ detail.coin }}</td>
            <td class="col-status">{{ STATUS_MAP.get(detail.status) || 'none' }}</td>
          </tr>
          <tr v-if="!hasData" class="tr-no-records">
            <td colspan="5" class="no-records">暫無資料</td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="footer">總投注額：10000</div>
    <nav class="report-issue-bets-pagination" aria-label="投注紀錄分頁">
      <Pagination v-model="betListPage" v-model:size="betListPageSize" :total="betListTotal" />
    </nav>
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
  border-width: 0.2rem;
}

.order-bets :deep(.ball.color-y) {
  border-width: 0.12rem;
}

/* 外層：配合 RecordIssue .main 的 flex column，讓表格區可捲動、footer 固定在下 */
.report-issue-bets-root {
  flex: 1 1 auto;
  min-height: 0;
  min-width: 0;
  width: 100%;
  display: flex;
  flex-direction: column;

  /* 有 footer 時避免與 .report-issue-bets 底邊框重疊成雙線，改由 footer 畫外框底 */
  &:has(> .footer) .report-issue-bets {
    border-bottom: none;
  }

  /* 單一 report-table：沿用 .lottery-6hc-of .report-table（lhc_of.scss），此處只補版面與欄寬 */
  .report-issue-bets {
    flex: 1 1 auto;
    min-height: 0;
    width: 100%;
    overflow: scroll;
    overflow-x: hidden;
    /* 與 ControlGroup.vue .group-list 捲軸一致 */
    scrollbar-width: thin;
    scrollbar-color: var(--color-red-desc) #e8e6e6;
    border: 1px solid var(--color-red-content);
    border-top: 0px;

    &::-webkit-scrollbar {
      width: 8px;
      height: 8px;
    }

    &::-webkit-scrollbar-track {
      background: #ffc6c6;
      border-radius: 999px;
    }

    &::-webkit-scrollbar-thumb {
      background: #f54c07;
      border-radius: 999px;
      border: 2px solid #ffc6c6;
    }

    &::-webkit-scrollbar-thumb:hover {
      background: #de4304;
    }

    .report-issue-bets-table {
      table-layout: fixed;
      border: unset;
      height: auto;
      min-height: 0;

      &.is-empty {
        height: 100%;
        min-height: 100%;
      }

      col.col-id {
        width: 120px;
      }

      col.col-time {
        width: 16%;
      }

      col.col-bet {
        width: auto;
      }

      col.col-coin {
        width: 14%;
      }

      col.col-status {
        width: 60px;
      }

      tr.subtotal-row td {
        background: color-mix(in srgb, var(--color-red-main) 5%, #f9f9f9);
        font-weight: 600;
      }

      thead th {
        position: sticky;
        top: 0;
        z-index: 2;
        /* 與 lhc_of.scss .report-table 表頭底色一致，避免滾動時 tbody 透出 */
        background: color-mix(in srgb, var(--color-red-main) 8%, #fff);
        color: var(--color-red-desc);
        font-weight: 700;
        /* 避免與 .report-table 的 th border-bottom 疊成雙線，改由 inset 單層畫上下 */
        border-top: none;
        border-bottom: none;
        box-shadow:
          inset 0 1px 0 0 var(--color-red-content),
          inset 0 -1px 0 0 var(--color-red-content);
      }

      tbody tr:last-child td {
        border-bottom: 1px solid var(--color-red-content);
      }
    }

    &.has-scroll .report-issue-bets-table tbody tr:last-child td {
      border-bottom: none;
    }
  }

  .footer {
    flex: 0 0 auto;
    width: 100%;
    box-sizing: border-box;
    padding: 0.5rem 0.65rem;
    font-size: 12px;
    font-weight: 600;
    color: var(--color-red-desc);
    text-align: right;
    background: color-mix(in srgb, var(--color-red-main) 5%, #fff);
    border: 1px solid var(--color-red-content);
    border-top: 1px solid var(--color-red-content);
  }

  .report-issue-bets-pagination {
    flex: 0 0 auto;
    width: 100%;
    box-sizing: border-box;
    padding: 0.55rem 0.65rem;
    // background: linear-gradient(
    //   180deg,
    //   color-mix(in srgb, var(--color-red-main) 4%, #fff) 0%,
    //   #fff 100%
    // );
    // border: 1px solid var(--color-red-content);
    // border-top: 1px solid color-mix(in srgb, var(--color-red-main) 14%, var(--color-red-content));

    :deep(.pagination-wrap) {
      width: 100%;
      justify-content: space-between;
      flex-wrap: wrap;
      row-gap: 0.45rem;
      color: var(--color-red-desc);
      font-size: 12px;
    }

    :deep(.controls) {
      flex-wrap: wrap;
      justify-content: flex-end;
      row-gap: 0.35rem;
    }
  }
}
</style>
