<script setup lang="ts">
import { computed, reactive } from 'vue'
import lodash from 'lodash'
import Car from '~/components/lottery/bg/pk10/base/Car.vue'
import { usePk10, type Pk10SelectItem } from '~/composables/usePk10'
import { pk10TabOddsOf } from '#shared/config/pk10cd/helpers'
import { PK10_RANK_NAMES } from '#shared/config/pk10'

const { cloneDeep } = lodash

/**
 * PK10 信用盤投注看板
 *
 * 版面與 k3 的 cd/base/Board.vue 同一套（再往上是 6hc-cd 的 .play-table）：
 *   ‧ 一個群組一塊 .play-group：置中的 .group-title ＋ 一張 .play-table
 *   ‧ thead 把「號碼｜金額」重複 columns 次，tbody 每列塞 columns 組注項
 *   ‧ 一列幾組由 config 的 group.columns 決定
 *   ‧ 整格（td）可點、hover、選中，選項本身 pointer-events: none
 *
 * ── 完全由 config 驅動 ──────────────────────────────────
 *   群組、注項、欄數、限額全部讀 shared/config/pk10cd/plays.js（內容照 pcv2 提取），
 *   本元件不認得任何玩法名稱 —— 只依注項身上的 car / pair 決定畫成什麼樣子：
 *     car  → 車號球（定位膽）
 *     pair → 兩顆車號球（冠亞組合）
 *     其餘 → 方框（和值）或文字膠囊（兩面／龍虎）
 *   賠率一律用 pk10TabOddsOf 依該分頁 rtp 即時推算，不讀 config 的 odds 快照。
 */
const {
  state: mxState,
  select: mxSelect,
  currentQuota: mxQuota,
  groupList: mxGroupList,
  actions: mxActions
} = usePk10()

type BoardItem = Pk10SelectItem & { odds: number }

const money = (value: number) => Number(value ?? 0).toLocaleString('zh-TW')
const state = reactive({ hoverKey: '' as string })

/** 名次前綴由長到短，避免「第十名」被短前綴先吃掉 */
const RANK_PREFIXES = [...PK10_RANK_NAMES].sort((a, b) => b.length - a.length)

const _handlers = {
  isNumber: (name: string) => /^\d+$/.test(String(name)),

  /**
   * 注項的顯示文字
   *
   * 注碼帶了前綴（冠軍大、和大單、組合01-02）方便伺端判定，但群組標題已經寫了名次，
   * 格子裡再重複一次會很擠 —— 這裡把「群組已經表達的部分」去掉：
   *   群組「冠軍」   + 注碼「冠軍大」   → 大
   *   群組「冠亞軍和」+ 注碼「和大單」   → 大單
   *   群組「冠軍 VS 第十名」+ 注碼「冠軍龍」→ 龍
   *   群組「冠亞和值」+ 注碼「和8」     → 8
   * ⚠️ 只影響顯示 —— 送伺端與結算的注碼一律是原本的 name。
   */
  shortOf: (name: string, groupName: string) => {
    let text = String(name ?? '')
    if (groupName && text.startsWith(groupName)) return text.slice(groupName.length) || text
    for (const prefix of RANK_PREFIXES) {
      if (text.startsWith(prefix)) {
        text = text.slice(prefix.length)
        return text || String(name ?? '')
      }
    }
    if (text.startsWith('和')) return text.slice(1) || text
    if (text.startsWith('組合')) return text.slice(2) || text
    return text
  },

  /**
   * 群組賠率摘要（同 k3 / 6hc-cd 的 oddsInfoOf）
   *   整組同賠率      → 賠率[ 9.69 ]
   *   賠率不同、注項少 → 逐項列出
   *   賠率不同、注項多 → 區間 + isRange（標題可 hover 浮出明細，例如和值 17 項）
   */
  oddsInfoOf: (list: BoardItem[] = [], groupName = '') => {
    const pairs = list
      .map((item) => ({ name: _handlers.shortOf(String(item?.name ?? ''), groupName), odds: Number(item?.odds ?? 0) }))
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

  /**
   * 橫向（row-major）矩陣
   * 注項是有序的（車號 01~10、和值 3~19），必須依 config 順序橫向填才不會跳號
   */
  toRowMatrix: (list: BoardItem[] = [], columns: number) => {
    const rows = Math.ceil(list.length / columns)
    return Array.from({ length: rows }, (_, rowIndex) =>
      Array.from({ length: columns }, (_, colIndex) => list[rowIndex * columns + colIndex] ?? null)
    )
  },

  /** 號碼欄要畫成什麼：車號球／兩顆球／方框（純數字）／文字膠囊 */
  variantOf: (list: BoardItem[] = []) => {
    if (list.some((item) => Array.isArray(item?.pair) && item.pair.length === 2)) return 'pair'
    if (list.some((item) => Number(item?.car) > 0)) return 'car'
    return list.every((item) => _handlers.isNumber(_handlers.shortOf(String(item?.name ?? ''), ''))) ? 'box' : 'pill'
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
      item.odds = pk10TabOddsOf(mxState.select, mxState.selectTabId, String(item.name))
      pool.push(item)
    })
  })
  if (import.meta.client) mxActions.registerSelectPool(pool)
  return cloned
})

const tableGroups = computed(() =>
  (layout.value?.tabGroup ?? []).map((group: any) => {
    const list = group.groupList as BoardItem[]
    const groupName = String(group.groupName ?? '')
    // 一列幾組由 config 決定；沒設就依注項數推一個合理值
    const columns = Number(group.columns) > 0
      ? Number(group.columns)
      : (list.length >= 12 ? 5 : Math.max(1, Math.min(5, list.length)))
    const oddsInfo = _handlers.oddsInfoOf(list, groupName)
    return {
      groupName,
      columns,
      /**
       * 真的有注項的欄數
       * config 的 columns 可能大於注項數（例如某群組只剩 2 項卻設 4 欄），
       * 超出的表頭與空格改為透明 —— 欄數仍照 config，與其他群組的欄位對齊不會跑掉。
       */
      filled: Math.min(columns, list.length),
      variant: _handlers.variantOf(list),
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
  <div class="pk10-board">
    <!-- 該分頁限額（伺端以同一份 settings.quota 驗證） -->
    <div class="quota-bar">
      <span class="quota-item">單注 {{ money(minCoin) }} — {{ money(maxCoin) }}</span>
      <span v-if="mxQuota.issue.max > 0" class="quota-item">單期上限 {{ money(mxQuota.issue.max) }}</span>
      <span class="quota-note">※ 點注項即選取並套用投注金額，也可逐項改金額</span>
    </div>

    <div v-if="tableGroups.length === 0" class="empty">此分頁尚無注項</div>

    <div v-for="group in tableGroups" :key="`pk10-group-${group.groupName}`" class="play-group">
      <div class="group-title">
        {{ group.groupName }}
        <span v-if="group.oddsSummary" class="group-odds" :class="{ 'has-detail': group.hasOddsDetail }"
          :tabindex="group.hasOddsDetail ? 0 : undefined">
          {{ group.oddsSummary }}
          <!-- 標題只顯示區間時（和值），hover / focus 浮出逐項賠率 -->
          <span v-if="group.hasOddsDetail" class="odds-tip" role="tooltip">
            <em v-for="row in group.oddsDetail" :key="`tip-${group.groupName}-${row.name}`">
              <i>{{ row.name }}</i><b>{{ row.odds }}</b>
            </em>
          </span>
        </span>
      </div>

      <!-- ⚠️ 一定要寫出 tbody：瀏覽器會自動為 table 補 tbody，
           SSR 輸出若直接是 <table><tr> 就會與 hydration 後的 DOM 對不上 -->
      <table class="play-table" :class="`is-${group.variant}`">
        <thead>
          <tr>
            <template v-for="col in group.columns" :key="`head-${group.groupName}-${col}`">
              <th class="th-code" :class="{ 'is-empty': col > group.filled }">
                {{ col > group.filled ? '' : '號碼' }}
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
                <!-- 冠亞組合：兩顆車號球 -->
                <span v-if="item?.pair?.length === 2" class="car-set">
                  <Car v-for="(car, cIdx) in item.pair" :key="cIdx" :car="car" size="sm" />
                </span>
                <!-- 定位膽：單顆車號球 -->
                <span v-else-if="Number(item?.car) > 0" class="car-set">
                  <Car :car="item!.car" size="md" />
                </span>
                <!-- 兩面／龍虎（膠囊）與和值（方框） -->
                <button v-else-if="item" type="button" class="option"
                  :class="[group.variant === 'box' ? 'is-box' : 'is-pill', { active: item.select }]">
                  {{ _handlers.shortOf(String(item.name), group.groupName) }}
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
/* 樣式沿用 k3 的 cd/base/Board.vue（再往上是 6hc-cd 的 .main-play-base），
   僅把骰子點換成車號球、欄寬改成 PK10 的內容尺寸 */
.pk10-board {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;

  /* 分頁限額提示列 */
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

      /* 群組賠率（整組同值顯示一個，和值等不同值則顯示區間） */
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
          /* 和值 17 項用 3 欄，浮層才不會比畫面高 */
          grid-template-columns: repeat(3, auto);
          gap: 3px 16px;
          border: 1px solid var(--color-red-700);
          border-radius: 6px;
          background: #fff;
          padding: 8px 12px;
          box-shadow: 0 6px 18px rgba(127, 29, 29, 0.22);
          white-space: nowrap;
          opacity: 0;
          visibility: hidden;
          /* 純提示用，不攔滑鼠，避免蓋住下方注項 */
          pointer-events: none;
          transition: opacity 0.15s ease, transform 0.15s ease;

          /* 指向標題的小三角 */
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

    /* 欄寬固定，避免 active 內容變化撐寬欄位 */
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

      /* 沒有注項的欄位：不畫框也不上底色，但欄位本身保留，
         才不會跟同分頁其他群組的欄位對不齊 */
      .is-empty {
        border-color: transparent;
        background: transparent;
      }

      .td-code {
        padding: 6px 4px;
      }

      /* 號碼欄寬度依內容型態分四種，金額欄自動吸收剩餘寬度 */
      &.is-pair {

        .th-code,
        .td-code {
          /* 兩顆 sm 球 + 間距 */
          width: 66px;
        }
      }

      &.is-car {

        .th-code,
        .td-code {
          /* 一顆 md 球 */
          width: 48px;
        }
      }

      &.is-box {

        .th-code,
        .td-code {
          /* 「19」兩個字 + 方框內距 */
          width: 56px;
        }
      }

      &.is-pill {

        .th-code,
        .td-code {
          /* 「大單」兩個字 + 膠囊左右內距 */
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

      /* 整格可點擊 / hover / 選中（事件與樣式都在 td 這層） */
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

    /* 車號球：點擊交給整格 td 處理 */
    .car-set {
      display: inline-flex;
      justify-content: center;
      gap: 3px;
      pointer-events: none;
    }

    /* ── 選項（方框 / 文字膠囊）─────────────────────────── */
    .option {
      box-sizing: border-box;
      /* border 計入尺寸，active 時寬度不變 */
      background: #fff;
      white-space: nowrap;
      font-weight: 600;
      color: var(--color-red-desc);
      transition: all 0.15s ease;
      /* 點擊交給整格 td 處理 */
      pointer-events: none;

      /* 和值：方框而非號碼球（它是兩個車號的總和，不是號碼） */
      &.is-box {
        min-width: 40px;
        height: 32px;
        border-radius: 4px;
        border: 1px solid var(--color-red-700);
        padding: 0 6px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        font-weight: 700;
        color: var(--color-red-main);
      }

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
