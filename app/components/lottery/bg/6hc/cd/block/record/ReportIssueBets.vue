<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, watch, type ComponentPublicInstance } from 'vue'
import Pagination from '~/components/lottery/bg/6hc/cd/block/record/Pagination.vue'
import { LHC_COLORS } from '#shared/config/6hc-cd'
import { use6hcCredit } from '~/composables/use6hcCredit'
import { actions } from '~/utils/common'

const { current: mxCurrent } = use6hcCredit()

const hasData = computed(() => mxCurrent.detail.length > 0)
const state = reactive({
  betListPage: 1,
  betListPageSize: 10,
  tableScrollRef: null as HTMLElement | null,
  isTableFilled: false,
  tableResizeObserver: null as ResizeObserver | null
})
const betListTotal = computed(() => mxCurrent.detail.length)
const thisPageDetail = computed(() => {
  const page = Math.max(1, state.betListPage)
  const pageSize = Math.max(1, state.betListPageSize)
  const start = (page - 1) * pageSize
  return mxCurrent.detail.slice(start, start + pageSize)
})
const betTotalCoin = computed(() => actions.thousands(mxCurrent.detail.reduce((acc, curr) => acc + Number(curr.coin), 0) ?? 0))

const _handlers = {
  isNumber: (name: string | number) => /^\d+$/.test(String(name)),
  // 玩法欄小字：主標已顯示 tabName（如 特碼A），小字補玩法名，重複則不顯示
  playSubName: (detail: { tabName?: string; playName?: string; playTypeName?: string }) => {
    const main = detail.tabName || detail.playName || ''
    const sub = detail.playTypeName || detail.playName || ''
    return sub && sub !== main ? sub : ''
  },
  // 依號碼 / 波色文字推得色系（read from #shared/config/6hc-cd 的 LHC_COLORS）
  colorOf: (name: string | number) => {
    const s = String(name)
    if (/^\d+$/.test(s)) {
      const n = s.padStart(2, '0')
      if ((LHC_COLORS.red as readonly string[]).includes(n)) return 'red'
      if ((LHC_COLORS.blue as readonly string[]).includes(n)) return 'blue'
      if ((LHC_COLORS.green as readonly string[]).includes(n)) return 'green'
      return 'yellow'
    }
    if (s.includes('紅')) return 'red'
    if (s.includes('藍')) return 'blue'
    if (s.includes('綠')) return 'green'
    return ''
  },
  // 顯示值：數字補零成兩位，其餘（膠囊玩法文字）原樣
  /**
   * 注碼顯示：不補零（1 ~ 9 就顯示 1 ~ 9），與看板設定、伺端存下的注碼一致
   * 色波配色另外由 colorOf 內部補零查表，兩者互不影響
   */
  displayCode: (name: string | number) => String(name),
  /**
   * 表格是否「填滿」捲動區（剛好等高或溢出都算）
   *
   * 填滿時，表格最後一列的下框會落在捲動區底緣，與 footer（總投注額）的上框
   * 重疊成 2px 粗線 —— 沒有任何投注時 .is-empty 讓表格 height: 100%，必定填滿，
   * 所以空狀態一定看得到那條粗線。填滿時就把最後一列的下框拿掉，改由 footer 畫。
   *
   * ⚠️ 不能用 scrollHeight > clientHeight 判斷：內容沒有溢出時 scrollHeight
   *    等於 clientHeight（規範如此），剛好等高的情況會被判成 false。
   */
  syncScrollState: () => {
    const el = state.tableScrollRef
    const table = el?.querySelector('table') as HTMLElement | null
    state.isTableFilled = !!el && !!table && table.offsetHeight >= el.clientHeight - 1
  },
  setTableScrollRef: (el: Element | ComponentPublicInstance | null) => {
    state.tableScrollRef = el as HTMLElement | null
  }
}

onMounted(() => {
  nextTick(_handlers.syncScrollState)
  state.tableResizeObserver = new ResizeObserver(_handlers.syncScrollState)
  if (state.tableScrollRef) {
    state.tableResizeObserver.observe(state.tableScrollRef)
  }
  window.addEventListener('resize', _handlers.syncScrollState)
})

onBeforeUnmount(() => {
  state.tableResizeObserver?.disconnect()
  window.removeEventListener('resize', _handlers.syncScrollState)
})

watch(() => mxCurrent.detail.length, () => {
  nextTick(_handlers.syncScrollState)
})

watch([betListTotal, () => state.betListPageSize], ([total, pageSize]) => {
  const normalizedPageSize = Math.max(1, pageSize)
  const maxPage = Math.max(1, Math.ceil(total / normalizedPageSize))
  if (state.betListPage > maxPage) {
    state.betListPage = maxPage
  }
})
</script>

<template>
  <div class="report-issue-bets-root">
    <div :ref="_handlers.setTableScrollRef" class="report-issue-bets"
      :class="{ 'is-filled': state.isTableFilled }">
      <table class="report-table report-issue-bets-table" :class="{ 'is-empty': !hasData }">
        <colgroup>
          <col class="col-id" />
          <col class="col-time" />
          <col class="col-play" />
          <col class="col-bet" />
          <col class="col-coin" />
          <!-- <col class="col-status" /> -->
        </colgroup>
        <thead>
          <tr>
            <th class="col-id">投注單號</th>
            <th class="col-time">投注時間</th>
            <th class="col-play">投注玩法</th>
            <th class="col-bet">投注號碼</th>
            <th class="col-coin">注數 / 金額</th>
            <!-- <th class="col-status">狀態</th> -->
          </tr>
        </thead>
        <tbody>
          <tr v-for="(detail, rowIdx) in thisPageDetail" :key="rowIdx">
            <td class="col-id">{{ detail.id }}</td>
            <td class="col-time">{{ detail.time }}</td>
            <td class="col-play">
              <div class="play-cell">
                <span class="name">{{ detail.tabName || detail.playName || '-' }}</span>
                <span v-if="_handlers.playSubName(detail)" class="type">{{ _handlers.playSubName(detail) }}</span>
              </div>
            </td>
            <td class="col-bet">
              <div class="order-bets">
                <span v-for="(ball, ballIdx) in detail.bets" :key="ballIdx" class="option" :class="[
                  _handlers.isNumber(ball) ? 'is-ball' : 'is-pill',
                  _handlers.colorOf(ball) ? `c-${_handlers.colorOf(ball)}` : '',
                ]">
                  {{ _handlers.displayCode(ball) }}
                </span>
              </div>
            </td>
            <td class="col-coin">
              <div class="coin-cell">
                <span class="count">{{ detail.betCount }} 注</span>
                <span class="amount">{{ actions.thousands(Number(detail.coin)) }}</span>
              </div>
            </td>
            <!-- <td class="col-status">{{ STATUS_MAP.get(detail.status) || 'none' }}</td> -->
          </tr>
          <tr v-if="!hasData" class="tr-no-records">
            <td colspan="5" class="no-records">暫無資料</td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="footer">總投注額：{{ betTotalCoin }}</div>
    <nav class="report-issue-bets-pagination" aria-label="投注紀錄分頁">
      <Pagination v-model="state.betListPage" v-model:size="state.betListPageSize" :total="betListTotal" />
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

  /* 投注號碼：依設定（LHC_COLORS）渲染號碼球 / 膠囊，與 Tema、CurrPlayItems 一致 */
  .option {
    box-sizing: border-box;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    background: #fff;
    color: var(--color-red-desc);

    &.is-ball {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      border: 0.16rem solid var(--6hcOf-ball-yellow);
      font-size: 13px;
      color: #000;
    }

    &.is-pill {
      min-width: 46px;
      height: 24px;
      padding: 0 10px;
      border-radius: 6px;
      border: 1px solid var(--color-red-700);
      font-size: 13px;
      color: var(--color-red-main);
    }

    &.c-red {
      border-color: var(--6hcOf-ball-red);

      &.is-pill {
        color: var(--6hcOf-ball-red);
      }
    }

    &.c-blue {
      border-color: var(--6hcOf-ball-blue);

      &.is-pill {
        color: var(--6hcOf-ball-blue);
      }
    }

    &.c-green {
      border-color: var(--6hcOf-ball-green);

      &.is-pill {
        color: var(--6hcOf-ball-green);
      }
    }

    &.c-yellow {
      border-color: var(--6hcOf-ball-yellow);

      &.is-pill {
        color: var(--6hcOf-ball-yellow);
      }
    }
  }
}

/* 外層：配合 Issue .main 的 flex column，讓表格區可捲動、footer 固定在下 */
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
    /* 撐滿卡片剩餘高度（同 6hc-of），內容超過則內部捲動（sticky 表頭 + 固定 footer）；
       原本是 flex: 0 1 auto + max-height，會縮成內容高度，導致卡片下方留白、footer 與分頁上移 */
    flex: 1 1 auto;
    min-height: 0;
    width: 100%;
    overflow: scroll;
    overflow-x: hidden;
    /* 與 Group.vue .group-list 捲軸一致 */
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

      /* 暫無資料：撐滿捲動區高度（同 6hc-of），避免空狀態只有一小塊 */
      &.is-empty {
        height: 100%;
        min-height: 100%;
      }

      /* 暫無資料：隱藏最後一列（no-records）下框線 */
      &.is-empty tbody tr:last-child td {
        border-bottom: none;
      }

      col.col-id {
        width: 240px;
      }

      th.col-id,
      td.col-id {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      col.col-time {
        width: 14%;
      }

      col.col-play {
        width: 15%;
      }

      td.col-play {
        text-align: center;
        vertical-align: middle;

        .play-cell {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1px;

          .name {
            font-size: 12px;
            font-weight: 700;
            color: var(--color-red-main);
          }

          .type {
            font-size: 10px;
            color: var(--color-red-desc);
            font-weight: 600;
          }
        }
      }

      col.col-bet {
        width: auto;
      }

      td.col-bet {
        text-align: center;
        vertical-align: middle;
        padding: 0.3rem 0.4rem;
      }

      col.col-coin {
        width: 14%;
      }

      td.col-coin {
        text-align: center;
        vertical-align: middle;

        .coin-cell {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1px;

          .count {
            font-size: 10px;
            color: var(--color-red-desc);
            font-weight: 600;
          }

          .amount {
            font-size: 12px;
            font-weight: 700;
            color: var(--color-red-main);
          }
        }
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

    /* 填滿捲動區時，最後一列的下框會與 footer 上框疊成 2px，改由 footer 單獨畫 */
    &.is-filled .report-issue-bets-table tbody tr:last-child td {
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
    // border-top: unset;
  }

  .report-issue-bets-pagination {
    flex: 0 0 auto;
    width: 100%;
    box-sizing: border-box;
    padding: 0.55rem 0.65rem;
    /* background: linear-gradient( */
    /*   180deg, */
    /*   color-mix(in srgb, var(--color-red-main) 4%, #fff) 0%, */
    /*   #fff 100% */
    /* ); */
    /* border: 1px solid var(--color-red-content); */
    /* border-top: 1px solid color-mix(in srgb, var(--color-red-main) 14%, var(--color-red-content)); */

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
