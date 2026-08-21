<script setup lang="ts">
import { computed, reactive } from 'vue'
import lodash from 'lodash'
import { useKl8, type Kl8SelectItem } from '~/composables/useKl8'
import { kl8TabOddsOf } from '#shared/config/kl8cd/helpers'

const { cloneDeep } = lodash

/**
 * 快樂8信用盤投注看板（只負責「兩面」）
 *
 * 版面與 kl10 / k3 / ssc 的 base/Board.vue 同一套（一個群組一塊 .play-group，
 * thead 把「注項｜金額」重複 columns 次，tbody 每列塞 columns 組注項）。
 *
 * ⚠️ 這支只負責「一注項一金額」的兩面玩法（和值／上下盤／奇偶盤／五行）；
 *    任選是選號池 + 複式展開，走 base/BoardRenxuan.vue；選號彩池玩法走 block/PoolPicker.vue。
 * ⚠️ 兩面的注碼本身就是短字（大／上下和／金…），沒有 kl10 那種「第 N 球／龍虎」前綴要削，
 *    也沒有號碼球注項，全部以文字膠囊呈現。
 */
const {
  state: mxState,
  select: mxSelect,
  currentQuota: mxQuota,
  groupList: mxGroupList,
  actions: mxActions
} = useKl8()

type BoardItem = Kl8SelectItem & { odds: number }

const money = (value: number) => Number(value ?? 0).toLocaleString('zh-TW')
const state = reactive({ hoverKey: '' as string })

const _handlers = {
  /**
   * 群組賠率摘要（同 kl10 / k3 / ssc 的 oddsInfoOf）
   *   整組同賠率      → 賠率[ 2.06 ]
   *   賠率不同、注項少 → 逐項列出
   *   賠率不同、注項多 → 區間 + isRange（標題可 hover 浮出明細）
   */
  oddsInfoOf: (list: BoardItem[] = []) => {
    const pairs = list
      .map((item) => ({ name: String(item?.name ?? ''), odds: Number(item?.odds ?? 0) }))
      .filter((item) => item.odds > 0)
    if (pairs.length === 0) return { summary: '', detail: [] as typeof pairs, isRange: false }
    const distinct = Array.from(new Set(pairs.map((item) => item.odds)))
    if (distinct.length === 1) return { summary: `賠率[ ${distinct[0]} ]`, detail: pairs, isRange: false }
    if (pairs.length > 4) {
      return {
        summary: `賠率 ${Math.min(...distinct)} — ${Math.max(...distinct)}`,
        detail: pairs,
        isRange: true
      }
    }
    return {
      summary: `賠率[ ${pairs.map((item) => `${item.name} ${item.odds}`).join(' | ')} ]`,
      detail: pairs,
      isRange: false
    }
  },

  /** 橫向（row-major）矩陣：注項依 config 順序橫向填 */
  toRowMatrix: (list: BoardItem[] = [], columns: number) => {
    const rows = Math.ceil(list.length / columns)
    return Array.from({ length: rows }, (_, rowIndex) =>
      Array.from({ length: columns }, (_, colIndex) => list[rowIndex * columns + colIndex] ?? null)
    )
  }
}

// --- COMPUTED ---
/**
 * 當前分頁的注項（含即時賠率）
 * ⚠️ 包成 reactive 並登記給 composable，讓 item.select / item.coin 的讀寫具反應性；
 *    resetToken 是為了在 composable 清掉 pool 後強制重新登記（否則 computed 被快取住）
 */
const layout = computed(() => {
  void mxSelect.resetToken
  const found = mxGroupList.value.find((tab: any) => Number(tab.tabId) === Number(mxState.selectTabId))
  if (!found?.tabGroup) {
    if (import.meta.client) mxActions.registerSelectPool([])
    return null
  }
  const cloned = reactive(cloneDeep(found))
  const pool: BoardItem[] = []
  cloned.tabGroup.forEach((group: any) => {
    group.groupList.forEach((item: BoardItem) => {
      item.select = false
      item.coin = 0
      item.odds = kl8TabOddsOf(mxState.select, mxState.selectTabId, String(item.name))
      pool.push(item)
    })
  })
  if (import.meta.client) mxActions.registerSelectPool(pool)
  return cloned
})

const tableGroups = computed(() =>
  (layout.value?.tabGroup ?? []).map((group: any) => {
    const list = group.groupList as BoardItem[]
    // 一列幾組由 config 決定；沒設就依注項數推一個合理值
    const columns = Number(group.columns) > 0
      ? Number(group.columns)
      : Math.max(1, Math.min(6, list.length))
    const oddsInfo = _handlers.oddsInfoOf(list)
    return {
      groupName: String(group.groupName ?? ''),
      columns,
      /** 真的有注項的欄數（config 的 columns 可能大於注項數） */
      filled: Math.min(columns, list.length),
      oddsSummary: oddsInfo.summary,
      oddsDetail: oddsInfo.detail,
      hasOddsDetail: oddsInfo.isRange,
      rows: _handlers.toRowMatrix(list, columns)
    }
  })
)

const minCoin = computed(() => mxQuota.value.item.min)
const maxCoin = computed(() => mxQuota.value.item.max)

/** 整格的狀態 class（事件與樣式都掛在 td 這層） */
const cellClassOf = (item: BoardItem | null) => ({
  active: !!item?.select,
  hover: !!item && state.hoverKey === String(item.playId),
  clickable: !!item
})

const click = {
  /** 點注項：切換選取，選取時套用「投注金額」並夾在該分頁單注限額內 */
  cell: (item: BoardItem | null) => {
    if (!item) return
    item.select = !item.select
    item.coin = item.select
      ? Math.min(maxCoin.value, Math.max(minCoin.value, Math.trunc(Number(mxState.amount) || 0)))
      : 0
    mxActions.syncSelectItems()
  },
  coinInput: (item: BoardItem, event: Event) => {
    const target = event.target as HTMLInputElement
    const coin = Math.min(maxCoin.value, Math.max(0, Math.trunc(Number(target.value) || 0)))
    item.coin = coin
    item.select = coin > 0
    target.value = coin > 0 ? String(coin) : ''
    mxActions.syncSelectItems()
  },
  hoverEnter: (item: BoardItem | null) => { state.hoverKey = item ? String(item.playId) : '' },
  hoverLeave: () => { state.hoverKey = '' }
}
</script>

<template>
  <div class="kl8-board">
    <!-- 該分頁限額（伺端以同一份 settings.quota 驗證） -->
    <div class="quota-bar">
      <span class="quota-item">單注 {{ money(minCoin) }} — {{ money(maxCoin) }}</span>
      <span v-if="mxQuota.issue.max > 0" class="quota-item">單期上限 {{ money(mxQuota.issue.max) }}</span>
      <span class="quota-note">※ 點注項即選取並套用投注金額，也可逐項改金額</span>
    </div>

    <div v-if="tableGroups.length === 0" class="empty">此分頁尚無注項</div>

    <div v-for="group in tableGroups" :key="`kl8-group-${group.groupName}`" class="play-group">
      <div class="group-title">
        {{ group.groupName }}
        <span v-if="group.oddsSummary" class="group-odds" :class="{ 'has-detail': group.hasOddsDetail }"
          :tabindex="group.hasOddsDetail ? 0 : undefined">
          {{ group.oddsSummary }}
          <!-- 標題只顯示區間時，hover / focus 浮出逐項賠率 -->
          <span v-if="group.hasOddsDetail" class="odds-tip" role="tooltip">
            <em v-for="row in group.oddsDetail" :key="`tip-${group.groupName}-${row.name}`">
              <i>{{ row.name }}</i><b>{{ row.odds }}</b>
            </em>
          </span>
        </span>
      </div>

      <!-- ⚠️ 一定要寫出 tbody：瀏覽器會自動為 table 補 tbody，
           SSR 輸出若直接是 <table><tr> 就會與 hydration 後的 DOM 對不上 -->
      <table class="play-table is-pill">
        <thead>
          <tr>
            <template v-for="col in group.columns" :key="`head-${group.groupName}-${col}`">
              <th class="th-code" :class="{ 'is-empty': col > group.filled }">
                {{ col > group.filled ? '' : '注項' }}
              </th>
              <th class="th-amount" :class="{ 'is-empty': col > group.filled }">
                {{ col > group.filled ? '' : '金額' }}
              </th>
            </template>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, rowIndex) in group.rows" :key="`row-${group.groupName}-${rowIndex}`">
            <template v-for="(item, colIndex) in row" :key="`cell-${group.groupName}-${rowIndex}-${colIndex}`">
              <td class="td-code" :class="[cellClassOf(item), { 'is-empty': !item }]" @click="click.cell(item)"
                @mouseenter="click.hoverEnter(item)" @mouseleave="click.hoverLeave()">
                <button v-if="item" type="button" class="option is-pill" :class="{ active: item.select }">
                  {{ item.name }}
                </button>
              </td>
              <td class="td-amount" :class="[cellClassOf(item), { 'is-empty': !item }]" @click="click.cell(item)"
                @mouseenter="click.hoverEnter(item)" @mouseleave="click.hoverLeave()">
                <input v-if="item" type="number" min="0" :max="maxCoin" :value="item.coin || ''" placeholder="0"
                  @click.stop @input="click.coinInput(item, $event)" />
              </td>
            </template>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped lang="scss">
/* 樣式沿用 kl10 的 base/Board.vue（再往上是 6hc-cd 的 .main-play-base） */
.kl8-board {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;

  .quota-bar {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    border: 1px solid #fee2e2;
    border-radius: 0.25rem;
    background: #fff5f6;
    padding: 6px 10px;
    font-size: 12px;

    .quota-item {
      font-weight: 700;
      color: var(--color-red-main);
      font-variant-numeric: tabular-nums;

      &+.quota-item::before {
        content: '·';
        margin-right: 8px;
        color: var(--color-red-desc);
      }
    }

    .quota-note {
      margin-left: auto;
      color: var(--color-red-desc);
    }
  }

  .empty {
    padding: 24px;
    text-align: center;
    font-weight: 700;
    color: var(--color-red-desc);
  }

  .play-group {
    display: flex;
    flex-direction: column;

    .group-title {
      text-align: center;
      padding: 0.5rem 0;
      font-size: 15px;
      font-weight: 700;
      color: var(--color-red-main);

      .group-odds {
        margin-left: 10px;
        font-size: 11px;
        font-weight: 700;
        color: var(--color-red-desc);
        font-variant-numeric: tabular-nums;

        &.has-detail {
          position: relative;
          display: inline-block;
          border-bottom: 1px dashed var(--color-red-desc);
          cursor: help;
          outline: none;

          &:hover,
          &:focus-visible {
            color: var(--color-red-main);
            border-bottom-color: var(--color-red-main);
          }

          &:hover .odds-tip,
          &:focus-visible .odds-tip {
            opacity: 1;
            visibility: visible;
            transform: translate(-50%, 0);
          }
        }

        .odds-tip {
          position: absolute;
          top: calc(100% + 9px);
          left: 50%;
          transform: translate(-50%, -4px);
          z-index: 30;
          display: grid;
          grid-template-columns: repeat(4, auto);
          gap: 3px 16px;
          border: 1px solid var(--color-red-700);
          border-radius: 6px;
          background: #fff;
          padding: 8px 12px;
          box-shadow: 0 6px 18px rgba(127, 29, 29, 0.22);
          white-space: nowrap;
          opacity: 0;
          visibility: hidden;
          pointer-events: none;
          transition: opacity 0.15s ease, transform 0.15s ease;

          &::before {
            content: '';
            position: absolute;
            top: -5px;
            left: 50%;
            width: 8px;
            height: 8px;
            transform: translateX(-50%) rotate(45deg);
            border-top: 1px solid var(--color-red-700);
            border-left: 1px solid var(--color-red-700);
            background: #fff;
          }

          em {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
            font-style: normal;

            i {
              font-style: normal;
              font-size: 12px;
              font-weight: 600;
              color: var(--color-red-desc);
            }

            b {
              font-size: 12px;
              font-weight: 800;
              color: #b45309;
              font-variant-numeric: tabular-nums;
            }
          }
        }
      }
    }

    .play-table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;

      th,
      td {
        border: 1px solid #fee2e2;
        text-align: center;
        vertical-align: middle;
      }

      thead th {
        height: 34px;
        background: #fdeef0;
        font-size: 13px;
        font-weight: 600;
        color: var(--color-red-desc);
      }

      .is-empty {
        border-color: transparent;
        background: transparent;
      }

      .td-code {
        padding: 6px 4px;
      }

      &.is-pill {

        .th-code,
        .td-code {
          width: 72px;
        }
      }

      .td-amount {
        padding: 6px 8px;

        input {
          width: 100%;
          height: 28px;
          border: 1px solid #f3b7bf;
          border-radius: 4px;
          background: #fff;
          text-align: center;
          font-size: 13px;
          font-weight: 700;
          color: var(--color-red-main);
          outline: none;
          cursor: text;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;

          &:focus {
            border-color: var(--color-red-main);
            box-shadow: 0 0 0 2px rgba(213, 63, 83, 0.12);
          }
        }
      }

      .td-code.clickable,
      .td-amount.clickable {
        cursor: pointer;
      }

      .td-code.hover,
      .td-amount.hover {
        background: #fbe3e6;
      }

      .td-code.active,
      .td-amount.active {
        background: var(--color-yellow-text);
      }

      .td-amount.active input {
        border-color: var(--color-red-main);
        color: var(--color-red-main);
        font-weight: 700;
      }
    }

    .option {
      box-sizing: border-box;
      background: #fff;
      white-space: nowrap;
      font-weight: 600;
      color: var(--color-red-desc);
      transition: all 0.15s ease;
      pointer-events: none;

      &.is-pill {
        min-width: 52px;
        height: 30px;
        border-radius: 6px;
        border: 1px solid var(--color-red-700);
        padding: 0 12px;
        font-size: 14px;
        color: var(--color-red-main);
      }
    }
  }
}
</style>
