<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import lodash from 'lodash'
import { useK3, type K3SelectItem } from '~/composables/useK3'
import { k3TabOddsOf } from '#shared/config/k3cd/helpers'

const { cloneDeep } = lodash

/**
 * 快3 信用盤投注看板
 *
 * 快3 的 7 個玩法注項型態都一樣（一注一個注項、名稱即注碼），
 * 因此一支通用看板就夠 —— 不像 6hc 還要分號碼球盤／膠囊盤／組合盤。
 *
 * 賠率一律用 k3TabOddsOf 依該分頁 rtp 即時推算，不讀 config 的 odds 快照，
 * 這樣改 rtp 畫面就跟著變，也與伺端鎖進注單的值一致。
 */
const props = defineProps<{
  /** 每個群組一列排幾個注項；不給則依注項數自動決定 */
  columns?: number
}>()

const { state: mxState, select: mxSelect, currentQuota: mxQuota, groupList: mxGroupList, actions: mxActions } = useK3()

type BoardItem = K3SelectItem & { odds: number }

const money = (value: number) => Number(value ?? 0).toLocaleString('zh-TW')

const _handlers = {
  /** 依注項數決定欄數：和值 16 項排 8 欄、二同號 30 項排 6 欄，其餘看數量 */
  columnsOf: (count: number) => {
    if (props.columns) return props.columns
    if (count >= 24) return 6
    if (count >= 12) return 8
    if (count >= 6) return 6
    return Math.max(1, count)
  },
  toMatrix: (list: BoardItem[], columns: number) => {
    const rows: BoardItem[][] = []
    for (let i = 0; i < list.length; i += columns) rows.push(list.slice(i, i + columns))
    return rows
  },
  /** 群組賠率摘要：同群組賠率一致就顯示單一值，不一致顯示區間 */
  oddsInfoOf: (list: BoardItem[]) => {
    const values = list.map((item) => Number(item.odds)).filter((odds) => odds > 0)
    if (values.length === 0) return { summary: '', detail: '', isRange: false }
    const min = Math.min(...values)
    const max = Math.max(...values)
    if (min === max) return { summary: `賠率 ${min}`, detail: '', isRange: false }
    return {
      summary: `賠率 ${min} — ${max}`,
      detail: list.map((item) => `${item.name} ${item.odds}`).join('　'),
      isRange: true
    }
  }
}

const state = reactive({ hoverKey: '' as string })

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
      // 賠率即時推算（config 的 odds 只是快照，rtp 改了會不一致）
      item.odds = k3TabOddsOf(mxState.select, mxState.selectTabId, String(item.name))
      pool.push(item)
    })
  })
  if (import.meta.client) mxActions.registerSelectPool(pool)
  return cloned
})

const tableGroups = computed(() =>
  (layout.value?.tabGroup ?? []).map((group: any) => {
    const list = group.groupList as BoardItem[]
    const columns = _handlers.columnsOf(list.length)
    const oddsInfo = _handlers.oddsInfoOf(list)
    return {
      groupName: String(group.groupName ?? ''),
      columns,
      oddsSummary: oddsInfo.summary,
      oddsDetail: oddsInfo.detail,
      hasOddsDetail: oddsInfo.isRange,
      rows: _handlers.toMatrix(list, columns)
    }
  })
)

const minCoin = computed(() => mxQuota.value.item.min)
const maxCoin = computed(() => mxQuota.value.item.max)

const click = {
  item: (item: BoardItem) => {
    item.select = !item.select
    item.coin = item.select ? Math.min(maxCoin.value, Math.max(minCoin.value, Number(mxState.amount) || 0)) : 0
    mxActions.syncSelectItems()
  },
  coinInput: (item: BoardItem, event: Event) => {
    const target = event.target as HTMLInputElement
    const coin = Math.min(maxCoin.value, Math.max(0, Math.trunc(Number(target.value) || 0)))
    item.coin = coin
    item.select = coin > 0
    target.value = String(coin)
    mxActions.syncSelectItems()
  }
}

// 統一金額變動時，同步已選注項的金額
watch(() => mxState.amount, (val) => {
  const coin = Math.min(maxCoin.value, Math.max(minCoin.value, Number(val) || 0))
  mxSelect.items.forEach((item) => { item.coin = coin })
})
</script>

<template>
  <div class="k3-board">
    <!-- 該分頁限額（伺端以同一份 settings.quota 驗證） -->
    <div class="quota-bar">
      <span class="quota-item">單注 {{ money(minCoin) }} — {{ money(maxCoin) }}</span>
      <span v-if="mxQuota.issue.max > 0" class="quota-item">單期上限 {{ money(mxQuota.issue.max) }}</span>
      <span class="quota-note">※ 賠率依回報率即時推算，派彩以下注時鎖定的賠率為準</span>
    </div>

    <div v-if="tableGroups.length === 0" class="empty">此分頁尚無注項</div>

    <div v-for="group in tableGroups" :key="`k3-group-${group.groupName}`" class="play-group">
      <div class="group-title">
        {{ group.groupName }}
        <span v-if="group.oddsSummary" class="group-odds" :class="{ 'has-detail': group.hasOddsDetail }"
          :tabindex="group.hasOddsDetail ? 0 : undefined"
          @mouseenter="state.hoverKey = group.groupName" @mouseleave="state.hoverKey = ''"
          @focus="state.hoverKey = group.groupName" @blur="state.hoverKey = ''">
          {{ group.oddsSummary }}
          <!-- 賠率不一致時（如和值 3 ~ 18 差 200 倍）逐項明細用浮層呈現 -->
          <span v-if="group.hasOddsDetail && state.hoverKey === group.groupName" class="odds-tip">
            {{ group.oddsDetail }}
          </span>
        </span>
      </div>

      <table class="play-table">
        <tbody>
          <tr v-for="(row, rowIdx) in group.rows" :key="`k3-row-${group.groupName}-${rowIdx}`">
            <template v-for="item in row" :key="`k3-cell-${item.playId}`">
              <td class="td-code clickable" :class="{ 'is-active': item.select }" @click="click.item(item)">
                <span class="code-name">{{ item.name }}</span>
                <span class="code-odds">{{ item.odds }}</span>
              </td>
              <td class="td-coin">
                <input type="number" min="0" :max="maxCoin" class="coin-input" :value="item.coin || ''"
                  placeholder="0" @click.stop @input="click.coinInput(item, $event)" />
              </td>
            </template>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped lang="scss">
.k3-board {
  width: 100%;

  .quota-bar {
    margin-bottom: 10px;
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
    font-size: 12px;
    color: var(--color-red-desc);

    .quota-item {
      border: 1px solid var(--color-red-content);
      border-radius: 4px;
      background: #fff;
      padding: 2px 8px;
      font-weight: 700;
      color: var(--color-red-main);
    }

    .quota-note {
      margin-left: auto;
    }
  }

  .empty {
    padding: 24px;
    text-align: center;
    font-weight: 700;
    color: var(--color-red-desc);
  }

  .play-group {
    margin-bottom: 14px;

    .group-title {
      margin-bottom: 6px;
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
      font-weight: 700;
      color: var(--color-red-main);

      .group-odds {
        position: relative;
        border-radius: 4px;
        background: #fff5f6;
        padding: 1px 8px;
        font-size: 12px;
        font-weight: 700;
        color: #d97706;

        &.has-detail {
          border-bottom: 1px dashed #d97706;
          cursor: help;
        }

        /* 逐項賠率浮層（和值等賠率差距大的群組用） */
        .odds-tip {
          position: absolute;
          left: 0;
          top: calc(100% + 6px);
          z-index: 20;
          min-width: 260px;
          max-width: 460px;
          border: 1px solid var(--color-red-main);
          border-radius: 4px;
          background: #fff;
          padding: 8px 10px;
          font-size: 12px;
          font-weight: 600;
          line-height: 1.7;
          color: var(--color-red-main);
          box-shadow: 0 6px 20px rgba(0, 0, 0, 0.14);
          white-space: normal;
        }
      }
    }

    .play-table {
      width: 100%;
      table-layout: fixed;
      border-collapse: separate;
      border-spacing: 3px;

      .td-code {
        border: 1px solid var(--color-red-content);
        border-radius: 4px;
        background: #fff;
        padding: 5px 4px;
        text-align: center;
        line-height: 1.25;
        transition: background 0.15s, border-color 0.15s;

        &.clickable {
          cursor: pointer;

          &:hover:not(.is-active) {
            background: #fff1f2;
          }
        }

        &.is-active {
          border-color: var(--color-red-main);
          background: var(--color-red-main);

          .code-name,
          .code-odds {
            color: #fff;
          }
        }

        .code-name {
          display: block;
          font-size: 14px;
          font-weight: 700;
          color: var(--color-red-main);
          white-space: nowrap;
        }

        .code-odds {
          display: block;
          font-size: 11px;
          font-weight: 600;
          color: #d97706;
        }
      }

      .td-coin {
        width: 4.2rem;

        .coin-input {
          width: 100%;
          border: 1px solid var(--color-red-content);
          border-radius: 4px;
          background: #fff;
          padding: 4px 6px;
          text-align: right;
          font-size: 13px;
          color: var(--color-red-main);
          outline: none;

          &:focus {
            border-color: var(--color-red-main);
            box-shadow: 0 0 0 2px rgba(213, 63, 83, 0.12);
          }
        }
      }
    }
  }
}
</style>
