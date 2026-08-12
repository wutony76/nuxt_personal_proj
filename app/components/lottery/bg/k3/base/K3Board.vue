<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import lodash from 'lodash'
import Dice from '~/components/lottery/bg/k3/base/Dice.vue'
import { useK3, type K3SelectItem } from '~/composables/useK3'
import { k3TabOddsOf } from '#shared/config/k3cd/helpers'

const { cloneDeep } = lodash

/**
 * 快3 信用盤投注看板
 *
 * 版面與操作方式參照 pcv2_0223 的 app/components/bg/k3cd/play.vue：
 *   ‧ 每個玩法群組一列（.type-row），左側是群組名（.type-name）
 *   ‧ 注項切成小表格並排，一列幾個由 config 的 group.columns 決定
 *     （對齊 pcv2 的 thirdWidth / quarterWidth / fifthWidth）
 *   ‧ 表頭「號碼｜賠率｜金額」只在每一列的第一個注項出現，看起來像整列共用一個表頭
 *   ‧ 三軍／長牌／短牌／圍骰用骰子點呈現（pcv2 用 .die1~.die6 貼圖，這裡用點陣元件）
 *   ‧ normal 模式逐項填金額、點列不切換；fast 模式點列即選取並套用共用金額
 *
 * 賠率一律用 k3TabOddsOf 依該分頁 rtp 即時推算，不讀 config 的 odds 快照。
 */
const {
  state: mxState,
  select: mxSelect,
  currentQuota: mxQuota,
  groupList: mxGroupList,
  isBetModeNormal,
  actions: mxActions
} = useK3()

type BoardItem = K3SelectItem & { odds: number; nums?: number[] }

const money = (value: number) => Number(value ?? 0).toLocaleString('zh-TW')
const state = reactive({ hoverKey: '' as string })

const _handlers = {
  /** 群組賠率摘要：同群組賠率一致就顯示單一值，不一致顯示區間 + hover 明細 */
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
      item.odds = k3TabOddsOf(mxState.select, mxState.selectTabId, String(item.name))
      pool.push(item)
    })
  })
  if (import.meta.client) mxActions.registerSelectPool(pool)
  return cloned
})

const typeRows = computed(() =>
  (layout.value?.tabGroup ?? []).map((group: any) => {
    const list = group.groupList as BoardItem[]
    // 一列幾個由 config 決定；沒設就依注項數推一個合理值
    const columns = Number(group.columns) > 0
      ? Number(group.columns)
      : (list.length >= 12 ? 8 : Math.max(1, Math.min(6, list.length)))
    const oddsInfo = _handlers.oddsInfoOf(list)
    return {
      groupName: String(group.groupName ?? ''),
      columns,
      oddsSummary: oddsInfo.summary,
      oddsDetail: oddsInfo.detail,
      hasOddsDetail: oddsInfo.isRange,
      // showHead：只有「第一列」的注項渲染表頭（對齊 pcv2 的 playIdx < 3/4/5）。
      // ⚠️ 不能用 idx % columns === 0（每列第一個）—— 那會讓每列的第一格被表頭推低，
      //    和同列其他格對不齊。
      items: list.map((item, idx) => ({ item, showHead: idx < columns }))
    }
  })
)

const minCoin = computed(() => mxQuota.value.item.min)
const maxCoin = computed(() => mxQuota.value.item.max)

const click = {
  /** 點注項：normal 模式不動作（與 pcv2 一致），fast 模式切換選取 */
  row: (item: BoardItem) => {
    if (isBetModeNormal.value) return
    item.select = !item.select
    item.coin = item.select ? Math.max(0, Math.trunc(Number(mxState.moneyFast) || 0)) : 0
    mxActions.syncSelectItems()
  },
  coinInput: (item: BoardItem, event: Event) => {
    const target = event.target as HTMLInputElement
    const coin = Math.min(maxCoin.value, Math.max(0, Math.trunc(Number(target.value) || 0)))
    item.coin = coin
    item.select = coin > 0
    target.value = coin > 0 ? String(coin) : ''
    mxActions.syncSelectItems()
  }
}

// fast 模式的共用金額變動時，同步已選注項
watch(() => mxState.moneyFast, (val) => {
  if (isBetModeNormal.value) return
  const coin = Math.max(0, Math.trunc(Number(val) || 0))
  mxSelect.pool.forEach((item) => { if (item.select) item.coin = coin })
  mxActions.syncSelectItems()
})
</script>

<template>
  <div class="k3-board" :class="{ 'is-fast': !isBetModeNormal }">
    <div class="quota-bar">
      <span class="quota-item">單注 {{ money(minCoin) }} — {{ money(maxCoin) }}</span>
      <span v-if="mxQuota.issue.max > 0" class="quota-item">單期上限 {{ money(mxQuota.issue.max) }}</span>
      <span class="quota-note">
        {{ isBetModeNormal ? '※ 逐項填入金額即為選取' : '※ 點注項即選取，套用上方共用金額' }}
      </span>
    </div>

    <div v-if="typeRows.length === 0" class="empty">此分頁尚無注項</div>

    <!-- 每個玩法群組一列（對齊 pcv2 的 .type-row） -->
    <div v-for="row in typeRows" :key="`k3-type-${row.groupName}`" class="type-row">
      <div class="type-head">
        <span class="type-name">{{ row.groupName }}</span>
        <span v-if="row.oddsSummary" class="type-odds" :class="{ 'has-detail': row.hasOddsDetail }"
          :tabindex="row.hasOddsDetail ? 0 : undefined"
          @mouseenter="state.hoverKey = row.groupName" @mouseleave="state.hoverKey = ''"
          @focus="state.hoverKey = row.groupName" @blur="state.hoverKey = ''">
          {{ row.oddsSummary }}
          <span v-if="row.hasOddsDetail && state.hoverKey === row.groupName" class="odds-tip">
            {{ row.oddsDetail }}
          </span>
        </span>
      </div>

      <div class="type-body" :style="`--cols: ${row.columns}`">
        <!-- 每個注項一個小表格；表頭只在每一列的第一個出現 -->
        <div v-for="cell in row.items" :key="String(cell.item.playId)" class="play-group">
          <!-- ⚠️ 一定要寫出 tbody：瀏覽器會自動為 table 補 tbody，
               SSR 輸出若直接是 <table><tr> 就會與 hydration 後的 DOM 對不上
               （pcv2 是 SPA 沒 SSR 所以沒這問題） -->
          <table cellspacing="0">
            <tbody>
              <tr v-if="cell.showHead" class="group-name">
                <td>號碼</td>
                <td>賠率</td>
                <td v-if="isBetModeNormal">金額</td>
              </tr>
              <tr class="selecter" :class="{ active: cell.item.select }" @click="click.row(cell.item)">
                <td class="cell-name">
                  <!-- 有 nums 就畫骰子（三軍／圍骰／長牌／短牌），否則顯示文字（大小單雙／點數／全骰） -->
                  <span v-if="cell.item.nums?.length" class="dice-set">
                    <Dice v-for="(num, dIdx) in cell.item.nums" :key="dIdx" :num="num" size="sm" />
                  </span>
                  <span v-else class="play-name">{{ cell.item.name }}</span>
                </td>
                <td class="cell-odds">{{ cell.item.odds.toFixed(3) }}</td>
                <td v-if="isBetModeNormal" class="cell-coin">
                  <input type="number" min="0" :max="maxCoin" class="coin-input" :value="cell.item.coin || ''"
                    placeholder="0" @click.stop @input="click.coinInput(cell.item, $event)" />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
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

    .quota-note { margin-left: auto; }
  }

  .empty {
    padding: 24px;
    text-align: center;
    font-weight: 700;
    color: var(--color-red-desc);
  }

  /* ── 一個玩法群組一列（pcv2 的 .type-row）───────────────── */
  .type-row {
    margin-bottom: 14px;

    .type-head {
      margin-bottom: 6px;
      display: flex;
      align-items: center;
      gap: 8px;

      .type-name {
        border-left: 4px solid var(--color-red-main);
        padding-left: 8px;
        font-size: 14px;
        font-weight: 700;
        color: var(--color-red-main);
      }

      .type-odds {
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

        .odds-tip {
          position: absolute;
          left: 0;
          top: calc(100% + 6px);
          z-index: 20;
          min-width: 260px;
          max-width: 480px;
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

    /* 注項並排：一列 --cols 個（對齊 pcv2 的 thirdWidth / quarterWidth / fifthWidth） */
    .type-body {
      display: grid;
      grid-template-columns: repeat(var(--cols, 6), 1fr);
      gap: 4px;
    }
  }

  .play-group {
    min-width: 0;

    table {
      width: 100%;
      table-layout: fixed;
      border-collapse: collapse;
    }

    /* 表頭：每一列只有第一個注項會渲染，視覺上像整列共用 */
    .group-name td {
      border-bottom: 1px solid var(--color-red-content);
      padding: 2px 0;
      background: color-mix(in srgb, var(--color-red-main) 8%, #fff);
      text-align: center;
      font-size: 11px;
      font-weight: 700;
      color: var(--color-red-desc);
      white-space: nowrap;
    }

    .selecter {
      cursor: pointer;
      transition: background 0.15s;

      td {
        border: 1px solid var(--color-red-content);
        padding: 4px 2px;
        text-align: center;
        background: #fff;
        vertical-align: middle;
      }

      &:hover:not(.active) td { background: #fff1f2; }

      &.active td {
        border-color: var(--color-red-main);
        background: var(--color-red-main);

        .play-name,
        &.cell-odds { color: #fff; }
      }

      &.active .cell-odds { color: #fff; }

      .cell-name {
        .dice-set {
          display: inline-flex;
          gap: 2px;
          justify-content: center;
        }

        .play-name {
          font-size: 14px;
          font-weight: 700;
          color: var(--color-red-main);
          white-space: nowrap;
        }
      }

      .cell-odds {
        font-size: 11px;
        font-weight: 700;
        color: #d97706;
        white-space: nowrap;
      }

      .cell-coin {
        padding: 2px;

        .coin-input {
          width: 100%;
          min-width: 0;
          border: 1px solid var(--color-red-content);
          border-radius: 3px;
          background: #fff;
          padding: 2px 4px;
          text-align: right;
          font-size: 12px;
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

  /* fast 模式沒有金額欄，注項可以排得緊一些 */
  &.is-fast .play-group .selecter td { padding: 5px 2px; }
}
</style>
