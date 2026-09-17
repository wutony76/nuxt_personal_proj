<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, watch, type ComponentPublicInstance } from 'vue'
import Ball from '~/components/lottery/tw/superlotto/base/Ball.vue'
import Pagination from '~/components/lottery/bg/6hc/cd/block/record/Pagination.vue'
import { useSuperlotto } from '~/composables/useSuperlotto'

/**
 * 下注紀錄（含結算結果）與可領獎金——版面與捲動行為參照 dlt 的 BetRecord.vue。
 * 威力彩注碼為兩區（"第一區6碼|第二區1碼"），開獎球分兩區顯示（第一區 6 顆＋第二區 1 顆）、
 * 各自比對命中；開獎號 openCode 為 7 碼（前 6 第一區、最後 1 第二區）。
 */
const { userRecord, fetch } = useSuperlotto()

/** 官方期別格式：民國年 3 碼＋該年度序號 6 碼。admin 測試工具用合成的 "TEST-<timestamp>" 期別，格式對不上，藉此濾掉。 */
const REAL_ISSUE_PATTERN = /^\d{3}\d{6}$/
const realBetHistory = computed(() => userRecord.betHistory.filter((row) => REAL_ISSUE_PATTERN.test(row.issue)))
const realClaimableIssues = computed(() =>
  userRecord.claimableIssues.filter((row) => REAL_ISSUE_PATTERN.test(String(row.issue)))
)

const money = (value: number) => Number(value ?? 0).toLocaleString('zh-TW')
const claimable = computed(() =>
  Number(realClaimableIssues.value.reduce((sum, item) => sum + Number(item.amount ?? 0), 0).toFixed(2))
)
const statusText = (status: string) => ({ win: '中獎', lose: '未中', pending: '待開獎' }[status] ?? status)

const state = reactive({
  page: 1,
  pageSize: 10,
  scrollRef: null as HTMLElement | null,
  isTableFilled: false,
  resizeObserver: null as ResizeObserver | null
})

const total = computed(() => realBetHistory.value.length)
const hasData = computed(() => total.value > 0)
const pagedRows = computed(() => {
  const page = Math.max(1, state.page)
  const size = Math.max(1, state.pageSize)
  return realBetHistory.value.slice((page - 1) * size, (page - 1) * size + size)
})
/** 注單序號／期數／號碼／金額／狀態／派彩 */
const COLUMN_COUNT = 6

/** betCode 是「1 個元素、內容為 '第一區6碼|第二區1碼'」的陣列，拆成兩區號碼字串 */
function betZones(betCode: string[]): { zoneA: string[]; zoneB: string } {
  const raw = betCode[0] ?? ''
  const [aPart, bPart] = raw.split('|')
  const zoneA = String(aPart ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  return { zoneA, zoneB: String(bPart ?? '').trim() }
}
/** 第一區命中：比對開獎號前 6 碼 */
function isZoneAHit(code: string, openCode: string[]): boolean {
  return openCode.slice(0, 6).some((c) => +c === +code)
}
/** 第二區命中：比對開獎號第 7 碼（index 6） */
function isZoneBHit(code: string, openCode: string[]): boolean {
  return openCode[6] !== undefined && +openCode[6] === +code
}

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

const click = {
  claim: () => fetch.claimOneIssue()
}
</script>

<template>
  <section class="superlotto-record">
    <div class="rp-head">
      <span class="rp-title">下注紀錄</span>
      <span class="rp-claim">
        待領中獎金額 <b>{{ money(claimable) }}</b>
        <button type="button" class="claim-btn" :disabled="claimable <= 0 || userRecord.isSubmittingClaim"
          @click="click.claim">
          {{ userRecord.isSubmittingClaim ? '領取中…' : '領取' }}
        </button>
      </span>
    </div>

    <div :ref="_handlers.setScrollRef" class="rp-body taiwan-lottery-scrollbar" :class="{ 'is-filled': state.isTableFilled }">
      <table class="rp-table" :class="{ 'is-empty': !hasData }">
        <thead>
          <tr>
            <th class="th-order">注單序號</th>
            <th>期數</th>
            <th>號碼</th>
            <th>金額</th>
            <th>狀態</th>
            <th>派彩</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in pagedRows" :key="row.orderId" :class="`is-${row.winStatus}`">
            <td class="t-order" :title="row.orderId">{{ row.orderId }}</td>
            <td class="t-issue">{{ row.issue }}</td>
            <td class="t-code">
              <span class="bet-balls">
                <Ball v-for="code in betZones(row.betCode).zoneA" :key="`a-${code}`" :num="code"
                  :hit="row.winStatus === 'win' && isZoneAHit(code, row.openCode)" size="xs" />
                <span class="bet-sep">+</span>
                <Ball :num="betZones(row.betCode).zoneB"
                  :hit="row.winStatus === 'win' && isZoneBHit(betZones(row.betCode).zoneB, row.openCode)"
                  size="xs" special />
              </span>
            </td>
            <td class="t-num">{{ money(row.coin) }}</td>
            <td class="t-status">{{ row.winStatus === 'win' ? `中獎（${row.tierLabel}）` : statusText(row.winStatus) }}</td>
            <td class="t-num t-payout">{{ row.winAmount > 0 ? money(row.winAmount) : '—' }}</td>
          </tr>
          <tr v-if="!hasData" class="tr-no-records">
            <td :colspan="COLUMN_COUNT" class="no-records">
              {{ userRecord.isLoading ? '載入中…' : '暫無資料' }}
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
.superlotto-record {
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
  border: 1px solid #dcd3c4;
  border-radius: 0.5rem;
  background: var(--color-neutral-100, #f9f4ed);
  box-shadow: var(--shadow-sm);
  padding: calc(0.75rem + 6px) 0.75rem 0.75rem;

  &::before {
    content: '';
    position: absolute;
    inset: 0 0 auto 0;
    height: 6px;
    background: var(--color-accent-500);
    background-image: repeating-linear-gradient(90deg,
      var(--color-accent-2-500) 0 14px,
      var(--color-accent-500) 14px 28px);
  }

  .rp-head {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
    padding-bottom: 8px;
    border-bottom: 1px dashed var(--color-neutral-400, #c0b6a5);
    font-size: 13px;

    .rp-title {
      font-weight: 700;
      font-family: var(--font-heading);
      color: var(--color-accent-700, #8c491a);
    }

    .rp-claim {
      color: var(--color-neutral-700, #645c50);

      b {
        font-size: 15px;
        color: #15803d;
      }

      .claim-btn {
        margin-left: 8px;
        border: 1px solid var(--color-accent-700, #8c491a);
        border-radius: 4px;
        background: var(--color-accent-700, #8c491a);
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
    border: 1px solid var(--color-neutral-300, #dcd3c4);
    border-top: 0;
    &.is-filled .rp-table tbody tr:last-child td {
      border-bottom: none;
    }
  }

  .rp-table {
    width: 100%;
    table-layout: fixed;
    border-collapse: collapse;
    font-size: 12px;

    th, td {
      padding: 6px 8px;
      text-align: center;
    }

    thead th {
      position: sticky;
      top: 0;
      z-index: 1;
      background: color-mix(in srgb, var(--color-accent-700, #8c491a) 8%, var(--color-neutral-100, #f9f4ed));
      color: var(--color-neutral-700, #645c50);
      font-weight: 700;
      box-shadow:
        inset 0 1px 0 0 var(--color-neutral-300, #dcd3c4),
        inset 0 -1px 0 0 var(--color-neutral-300, #dcd3c4);
    }

    tbody td {
      border-bottom: 1px solid var(--color-neutral-300, #dcd3c4);
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
      font-size: 11px;
      font-variant-numeric: tabular-nums;
    }

    .t-order {
      color: var(--color-neutral-700, #645c50);
      overflow-wrap: anywhere;
    }

    .t-issue {
      color: var(--color-neutral-700, #645c50);
      white-space: nowrap;
    }

    .t-num {
      white-space: nowrap;
    }

    .t-status {
      font-weight: 700;
    }

    .t-payout {
      font-weight: 700;
    }

    .is-win {
      background: #f0fdf4;

      .t-status,
      .t-payout {
        color: #15803d;
      }
    }

    .is-lose .t-status {
      color: var(--color-neutral-700, #645c50);
    }

    .is-pending .t-status {
      color: #b45309;
    }

    .bet-balls {
      display: inline-flex;
      flex-wrap: wrap;
      gap: 3px;
      align-items: center;
      justify-content: center;

      .bet-sep {
        font-weight: 700;
        color: var(--color-neutral-700, #645c50);
      }
    }

    .no-records {
      text-align: center;
      color: var(--color-neutral-700, #645c50);
      padding: 12px 0;
    }
  }

  .rp-pagination {
    flex: 0 0 auto;
    width: 100%;
    box-sizing: border-box;
    padding: 0.55rem 0.1rem 0;

    --color-red-main: var(--color-accent-700, #8c491a);
    --color-red-content: var(--color-neutral-300, #dcd3c4);
    --color-red-desc: var(--color-neutral-700, #645c50);

    :deep(.pagination-wrap) {
      width: 100%;
      justify-content: space-between;
      flex-wrap: wrap;
      row-gap: 0.45rem;
      font-size: 12px;
      color: var(--color-neutral-700, #645c50);
    }

    :deep(.controls) {
      flex-wrap: wrap;
      justify-content: flex-end;
      row-gap: 0.35rem;
    }

    :deep(.btn:not(.active)),
    :deep(.size select),
    :deep(.page-input) {
      background: var(--color-neutral-100, #f9f4ed);
    }
  }
}
</style>
