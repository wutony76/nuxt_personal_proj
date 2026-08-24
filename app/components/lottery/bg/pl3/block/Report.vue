<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, watch, type ComponentPublicInstance } from 'vue'
import Ball from '~/components/lottery/bg/pl3/base/Ball.vue'
import Pagination from '~/components/lottery/bg/6hc/cd/block/record/Pagination.vue'
import { usePl3 } from '~/composables/usePl3'

/**
 * 下注紀錄（含結算結果）與可領獎金
 * 版面與捲動行為參照 eggs 的 Report.vue；pl3 沒有爆池，不含派彩欄位的爆池加碼標示。
 */
const { userRecord: mxRecord, fetch: mxFetch } = usePl3()

const money = (value: number) => Number(value ?? 0).toLocaleString('zh-TW')
const claimable = computed(() =>
  Number(mxRecord.claimableIssues.reduce((sum, item) => sum + Number(item.amount ?? 0), 0).toFixed(2))
)
const statusText = (status: string) => ({ win: '中獎', lose: '未中', tie: '和局', pending: '待開獎' }[status] ?? status)

const state = reactive({
  page: 1,
  pageSize: 10,
  scrollRef: null as HTMLElement | null,
  isTableFilled: false,
  resizeObserver: null as ResizeObserver | null
})

const total = computed(() => mxRecord.betHistory.length)
const hasData = computed(() => total.value > 0)
const pagedRows = computed(() => {
  const page = Math.max(1, state.page)
  const size = Math.max(1, state.pageSize)
  return mxRecord.betHistory.slice((page - 1) * size, (page - 1) * size + size)
})
/** 投注單號／期數／注碼／金額／賠率／結果／派彩／開獎 */
const COLUMN_COUNT = 8

const _handlers = {
  syncScrollState: () => {
    const el = state.scrollRef
    const table = el?.querySelector('table') as HTMLElement | null
    state.isTableFilled = !!el && !!table && table.offsetHeight >= el.clientHeight - 1
  },
  setScrollRef: (el: Element | ComponentPublicInstance | null) => {
    state.scrollRef = el as HTMLElement | null
  }
}

onMounted(() => {
  nextTick(_handlers.syncScrollState)
  state.resizeObserver = new ResizeObserver(_handlers.syncScrollState)
  if (state.scrollRef) state.resizeObserver.observe(state.scrollRef)
  window.addEventListener('resize', _handlers.syncScrollState)
})

onBeforeUnmount(() => {
  state.resizeObserver?.disconnect()
  window.removeEventListener('resize', _handlers.syncScrollState)
})

watch(total, () => {
  nextTick(_handlers.syncScrollState)
})

watch([total, () => state.pageSize], ([count, size]) => {
  const maxPage = Math.max(1, Math.ceil(count / Math.max(1, size)))
  if (state.page > maxPage) state.page = maxPage
})
</script>

<template>
  <section class="block-main pl3-report">
    <div class="rp-head">
      <span class="rp-title">下注紀錄</span>
      <span class="rp-claim">
        待領中獎金額 <b>{{ money(claimable) }}</b>
        <button type="button" class="claim-btn" :disabled="claimable <= 0 || mxRecord.isSubmittingClaim"
          @click="mxFetch.claimOneIssue()">
          {{ mxRecord.isSubmittingClaim ? '領取中…' : '領取' }}
        </button>
      </span>
    </div>

    <div :ref="_handlers.setScrollRef" class="rp-body" :class="{ 'is-filled': state.isTableFilled }">
      <table class="report-table rp-table" :class="{ 'is-empty': !hasData }">
        <thead>
          <tr>
            <th class="th-order">投注單號</th>
            <th>期數</th>
            <th>注碼</th>
            <th>金額</th>
            <th>賠率</th>
            <th>結果</th>
            <th>派彩</th>
            <th>開獎</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in pagedRows" :key="row.orderId" :class="`is-${row.winStatus}`">
            <td class="t-order" :title="row.orderId">{{ row.orderId }}</td>
            <td class="t-issue">{{ row.issue }}</td>
            <td class="t-code">{{ row.betCode.join('、') }}</td>
            <td class="t-num">{{ money(row.coin) }}</td>
            <td class="t-num">{{ row.odds ?? '—' }}</td>
            <td class="t-status">{{ statusText(row.winStatus) }}</td>
            <td class="t-num t-payout">{{ row.winAmount > 0 ? money(row.winAmount) : '—' }}</td>
            <td class="t-open">
              <span v-if="row.openCode?.length" class="open-ball">
                <Ball v-for="(code, idx) in row.openCode" :key="idx" :digit="code" size="sm" />
              </span>
              <em v-else>—</em>
            </td>
          </tr>
          <tr v-if="!hasData" class="tr-no-records">
            <td :colspan="COLUMN_COUNT" class="no-records">
              {{ mxRecord.isLoading ? '載入中…' : '暫無資料' }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <nav class="rp-pagination" aria-label="下注紀錄分頁">
      <Pagination v-model="state.page" v-model:size="state.pageSize" :total="total" />
    </nav>
  </section>
</template>

<style scoped lang="scss">
.pl3-report {
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: #fff;

  .rp-head {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
    font-size: 13px;

    .rp-title {
      font-weight: 700;
      color: var(--color-red-main);
    }

    .rp-claim {
      color: var(--color-red-desc);

      b {
        font-size: 15px;
        color: #15803d;
      }

      .claim-btn {
        margin-left: 8px;
        border: 1px solid var(--color-red-main);
        border-radius: 4px;
        background: var(--color-red-main);
        padding: 3px 12px;
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
  }

  .rp-body {
    flex: 1 1 auto;
    min-height: 0;
    width: 100%;
    overflow-x: hidden;
    overflow-y: auto;
    border: 1px solid var(--color-red-content);
    border-top: 0;
    scrollbar-width: thin;
    scrollbar-color: var(--color-red-desc) #e8e6e6;

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

    &.is-filled .rp-table tbody tr:last-child td {
      border-bottom: none;
    }
  }

  .rp-table {
    table-layout: fixed;
    border: unset;

    thead th {
      position: sticky;
      top: 0;
      z-index: 2;
      background: color-mix(in srgb, var(--color-red-main) 8%, #fff);
      border-top: none;
      border-bottom: none;
      box-shadow:
        inset 0 1px 0 0 var(--color-red-content),
        inset 0 -1px 0 0 var(--color-red-content);
    }

    tbody tr:last-child td {
      border-bottom: 1px solid var(--color-red-content);
    }

    &.is-empty {
      height: 100%;
      min-height: 100%;
    }

    &.is-empty tbody tr:last-child td {
      border-bottom: none;
    }

    .th-order,
    .t-order {
      width: 215px;
      font-size: 11px;
      font-variant-numeric: tabular-nums;
    }

    .t-order {
      color: var(--color-red-desc);
      overflow-wrap: anywhere;
    }

    .t-issue {
      color: var(--color-red-desc);
      white-space: nowrap;
    }

    .t-code {
      font-weight: 700;
      color: var(--color-red-main);
      overflow-wrap: anywhere;
    }

    .t-num {
      text-align: right;
      white-space: nowrap;

      em {
        font-style: normal;
        color: #d97706;
      }
    }

    .t-status {
      text-align: center;
      font-weight: 700;
    }

    .t-payout {
      font-weight: 700;
    }

    .t-open .open-ball {
      display: inline-flex;
      gap: 3px;
    }

    .is-win {
      background: #f0fdf4;

      .t-status,
      .t-payout {
        color: #15803d;
      }
    }

    .is-lose .t-status {
      color: var(--color-red-desc);
    }

    .is-tie {
      background: #fffbeb;

      .t-status {
        color: #b45309;
      }
    }

    .is-pending .t-status {
      color: #f59e0b;
    }
  }

  .rp-pagination {
    flex: 0 0 auto;
    width: 100%;
    box-sizing: border-box;
    padding: 0.55rem 0.65rem 0;

    :deep(.pagination-wrap) {
      width: 100%;
      justify-content: space-between;
      flex-wrap: wrap;
      row-gap: 0.45rem;
      font-size: 12px;
      color: var(--color-red-desc);
    }

    :deep(.controls) {
      flex-wrap: wrap;
      justify-content: flex-end;
      row-gap: 0.35rem;
    }
  }
}
</style>
