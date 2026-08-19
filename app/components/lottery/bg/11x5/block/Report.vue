<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, watch, type ComponentPublicInstance } from 'vue'
import Ball from '~/components/lottery/bg/11x5/base/Ball.vue'
import Pagination from '~/components/lottery/bg/6hc/cd/block/record/Pagination.vue'
import { useX5 } from '~/composables/useX5'

/**
 * 下注紀錄（含結算結果）與可領獎金
 *
 * 版面與捲動行為沿用 k3 的 Report（再往上是 6hc-cd 的當期注單）：
 *   ‧ 表格區吃掉卡片剩餘高度、內部捲動，分頁器固定在下方
 *   ‧ 表頭 sticky，上下框線改用 inset box-shadow 畫 ——
 *     捲動時表格自身的上框會被捲走，用 inset 才補得回來
 *   ‧ 分頁器直接沿用 6hc-cd 那支（同一份行為與樣式，不另外複製一份）
 *
 * ⚠️ 與 pk10 的差別：一期只開 5 顆號碼球，「開獎」欄畫得下全部 ——
 *    不像那邊要截前三名再補一個「…」。
 */
const { userRecord: mxRecord, isCd, fetch: mxFetch, actions: mxActions } = useX5()

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
/** 當前頁的紀錄（前端切頁） */
const pagedRows = computed(() => {
  const page = Math.max(1, state.page)
  const size = Math.max(1, state.pageSize)
  return mxRecord.betHistory.slice((page - 1) * size, (page - 1) * size + size)
})
/** 投注單號／期數／注碼／金額／賠率或命中／結果／派彩／開獎 */
const COLUMN_COUNT = 8

const _handlers = {
  /**
   * 表格是否「填滿」捲動區（剛好等高或溢出都算）——
   * 填滿時最後一列的下框會與捲動區外框底邊疊成 2px 粗線，此時改由外框單獨畫。
   * ⚠️ 不能用 scrollHeight > clientHeight：內容沒溢出時兩者相等（規範如此），
   *    剛好等高的情況會被判成 false。
   */
  syncScrollState: () => {
    const el = state.scrollRef
    const table = el?.querySelector('table') as HTMLElement | null
    state.isTableFilled = !!el && !!table && table.offsetHeight >= el.clientHeight - 1
  },
  setScrollRef: (el: Element | ComponentPublicInstance | null) => {
    state.scrollRef = el as HTMLElement | null
  },
  /**
   * 注碼顯示
   * ⚠️ 11選5 的注碼一律是帶前綴的字串（第一球07、總和尾大、龍虎12龍、全中07），
   *    沒有 pk10 彩池那種「純車號陣列」，所以不需要判斷形狀。
   */
  codeLabelOf: (betCode: string[]) => {
    const list = Array.isArray(betCode) ? betCode : []
    if (list.length === 0) return '—'
    return list.map((code) => mxActions.labelOf(code)).join('、')
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

// 資料變少或每頁筆數變大時把頁碼夾回範圍內
watch([total, () => state.pageSize], ([count, size]) => {
  const maxPage = Math.max(1, Math.ceil(count / Math.max(1, size)))
  if (state.page > maxPage) state.page = maxPage
})
</script>

<template>
  <section class="block-main x5-report">
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
            <!-- 官方盤的後三直選吃彩池、沒有固定賠率，欄名跟著分流 -->
            <th>{{ isCd ? '賠率' : '賠率／分層' }}</th>
            <th>結果</th>
            <th>派彩</th>
            <th>開獎</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in pagedRows" :key="row.orderId" :class="`is-${row.winStatus}`">
            <!-- 單號完整放在 DOM（複製得到全長），title 供 hover 看；太窄時折行不截字 -->
            <td class="t-order" :title="row.orderId">{{ row.orderId }}</td>
            <td class="t-issue">{{ row.issue }}</td>
            <td class="t-code">{{ _handlers.codeLabelOf(row.betCode) }}</td>
            <td class="t-num">{{ money(row.coin) }}</td>
            <td class="t-num">{{ row.odds || '—' }}<em v-if="!isCd && row.tierName">（{{ row.tierName }}）</em></td>
            <td class="t-status">{{ statusText(row.winStatus) }}</td>
            <td class="t-num t-payout">{{ row.winAmount > 0 ? money(row.winAmount) : '—' }}</td>
            <td class="t-open">
              <span v-if="row.openCode?.length" class="open-balls">
                <Ball v-for="(code, idx) in row.openCode" :key="idx" :digit="code" size="xs" />
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
/* 卡片外框由全域 .lottery-x5 .block-main 提供；表格沿用全域 .report-table（同 ssc / k3 / 6hc） */
.x5-report {
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
    /* 吃掉卡片剩餘高度，內容超過則內部捲動（同 6hc-cd 的 .report-issue-bets） */
    flex: 1 1 auto;
    min-height: 0;
    width: 100%;
    overflow-x: hidden;
    overflow-y: auto;
    border: 1px solid var(--color-red-content);
    /* 上框交給 sticky 表頭的 inset shadow 畫，否則捲動後上緣會沒有線 */
    border-top: 0;
    /* 捲軸樣式與 6hc 的當期注單一致 */
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

    /* 填滿捲動區時最後一列不畫下框，免得與外框底邊疊成雙線 */
    &.is-filled .rp-table tbody tr:last-child td {
      border-bottom: none;
    }
  }

  .rp-table {
    table-layout: fixed;
    /* 外框由 .rp-body 負責 */
    border: unset;

    thead th {
      position: sticky;
      top: 0;
      z-index: 2;
      /* 與 lhc_k3.scss .report-table 表頭底色一致，避免捲動時 tbody 透出 */
      background: color-mix(in srgb, var(--color-red-main) 8%, #fff);
      /* 用 inset 單層畫上下框：捲動時表格自身的上框會被捲走，
         而 border-bottom 會與 .report-table 的規則疊成雙線 */
      border-top: none;
      border-bottom: none;
      box-shadow:
        inset 0 1px 0 0 var(--color-red-content),
        inset 0 -1px 0 0 var(--color-red-content);
    }

    tbody tr:last-child td {
      border-bottom: 1px solid var(--color-red-content);
    }

    /* 暫無資料時撐滿捲動區 */
    &.is-empty {
      height: 100%;
      min-height: 100%;
    }

    &.is-empty tbody tr:last-child td {
      border-bottom: none;
    }

    /* 投注單號：單號要能整段複製（對帳用），所以顯示完整字串不截字。
       ⚠️ table-layout 是 fixed，欄寬只認 thead 那一列 —— width 設在 tbody 的 td 上會被忽略，
          一定要設在 th。設錯的話 8 欄均分成 152px，單號折成兩行、列高從 31px 變成 62px。
       寬度沿用 ssc 的 240px：信用盤單號如 X5-CD20260819095000001(1/1)（29 字），
       階段 2 官方盤複式展開後的 (n/總數) 會更長，先留足餘裕。
       ⚠️ 220px 就會折行（pk10 那邊實測過）—— 改小之前請先用最長單號量一次。 */
    .th-order,
    .t-order {
      width: 240px;
      font-size: 11px;
      font-variant-numeric: tabular-nums;
    }

    .t-order {
      color: var(--color-red-desc);
      /* 真的塞不下時折行，不要溢出（.rp-body 是 overflow-x: hidden） */
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

    .t-open .open-balls {
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

  /* 分頁器（沿用 6hc-cd 的 Pagination，外層邊距與字級對齊那邊的做法） */
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
