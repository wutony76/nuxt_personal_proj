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
 * 版面改用 6hc-cd 的 .play-table（參照 app/components/lottery/bg/6hc/cd/base/PlayBoard.vue，
 * 一肖 Yixiao.vue 是它的使用範例）：
 *   ‧ 一個群組一塊 .play-group：置中的 .group-title ＋ 一張 .play-table
 *   ‧ thead 把「號碼｜金額」重複 columns 次，tbody 每列塞 columns 組注項 ——
 *     整組共用一個表頭，不像原本每個注項各自帶一張小表格
 *   ‧ 一列幾組由 config 的 group.columns 決定（對齊 pcv2 的 thirdWidth / quarterWidth…）
 *   ‧ 整格（td）可點、hover、選中，選項本身 pointer-events: none
 *
 * 賠率也依 6hc-cd 的做法：不做成表格欄位，改標在群組標題上 ——
 *   整組同賠率 → 賠率[ X ]
 *   注項多且賠率不同 → 顯示區間，標題可 hover 浮出逐項賠率（點數）
 * 數值一律用 k3TabOddsOf 依該分頁 rtp 即時推算，不讀 config 的 odds 快照。
 *
 * K3 專屬差異：注項帶 nums 時（三軍／圍骰／長牌／短牌）號碼欄畫骰子點，
 * 而且保留 pcv2 的 normal／fast 兩種投注模式（fast 模式沒有金額欄）。
 */
const {
  state: mxState,
  select: mxSelect,
  currentQuota: mxQuota,
  groupList: mxGroupList,
  isBetModeNormal,
  actions: mxActions
} = useK3()
/** 注碼顯示名稱（點數會補「點」），與當期注單／注單報表共用同一份 */
const labelOf = mxActions.labelOf

type BoardItem = K3SelectItem & { odds: number; nums?: number[] }

const money = (value: number) => Number(value ?? 0).toLocaleString('zh-TW')
const state = reactive({ hoverKey: '' as string })

const _handlers = {
  isNumber: (name: string) => /^\d+$/.test(String(name)),

  /**
   * 群組賠率摘要（同 6hc-cd 的 oddsInfoOf）
   *   整組同賠率      → 賠率[ 2.3 ]
   *   賠率不同、注項少 → 逐項列出
   *   賠率不同、注項多 → 區間 + isRange（標題可 hover 浮出明細，例如點數 16 項）
   * ⚠️ 6hc-cd 逐項列出時取 name.charAt(0)（紅波→紅），K3 的注項名是「三軍1」這種，
   *    取首字會失義，所以這裡列完整名稱。
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
    return { summary: `賠率[ ${pairs.map((item) => `${item.name}${item.odds}`).join(' | ')} ]`, detail: pairs, isRange: false }
  },

  /**
   * 橫向（row-major）矩陣
   *
   * 6hc-cd 的號碼球盤是直向填（1、3、5 / 2、4、6），但 K3 的注項是有序的
   * （三軍1~6、點數 3~18），必須依 config 順序橫向填才不會跳號。
   */
  toRowMatrix: (list: BoardItem[] = [], columns: number) => {
    const rows = Math.ceil(list.length / columns)
    return Array.from({ length: rows }, (_, rowIndex) =>
      Array.from({ length: columns }, (_, colIndex) => list[rowIndex * columns + colIndex] ?? null)
    )
  },

  /**
   * 號碼欄寬度分三種：骰子（最寬）／點數方框／文字膠囊
   *
   * 點數（和值 3~18）不用號碼球 —— 它不是「號碼」而是三顆骰子的總和，
   * 用圓球會被誤讀成六合彩那種號碼球，所以改方框並顯示「N點」。
   */
  variantOf: (list: BoardItem[] = []) => {
    if (list.some((item) => (item?.nums?.length ?? 0) > 0)) return 'dice'
    return list.every((item) => _handlers.isNumber(String(item?.name ?? ''))) ? 'box' : 'pill'
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

const tableGroups = computed(() =>
  (layout.value?.tabGroup ?? []).map((group: any) => {
    const list = group.groupList as BoardItem[]
    // 一列幾組由 config 決定；沒設就依注項數推一個合理值
    const columns = Number(group.columns) > 0
      ? Number(group.columns)
      : (list.length >= 12 ? 8 : Math.max(1, Math.min(6, list.length)))
    const oddsInfo = _handlers.oddsInfoOf(list)
    return {
      groupName: String(group.groupName ?? ''),
      columns,
      /**
       * 真的有注項的欄數
       *
       * 全骰只有 1 個注項但 config 給 columns: 4（pcv2 把圍骰／全骰畫成同一個 4 欄格），
       * 照 columns 展開會多出 3 組空白的「號碼｜金額」表頭。這裡算出實際用到幾欄，
       * 超出的表頭與空格改為透明 —— 欄數仍是 4，所以與上方圍骰的欄位對齊不會跑掉。
       * 橫向填的關係，前 filled 欄一定都有內容。
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

/** 整格的狀態 class（事件與樣式都掛在 td 這層，同 6hc-cd） */
const cellClassOf = (item: BoardItem | null) => ({
  active: !!item?.select,
  hover: !!item && state.hoverKey === String(item.playId),
  // normal 模式點格不切換（與 pcv2 一致，靠填金額選取），所以只有 fast 模式才是可點的
  clickable: !!item && !isBetModeNormal.value
})

const click = {
  /** 點注項：normal 模式不動作（與 pcv2 一致），fast 模式切換選取 */
  cell: (item: BoardItem | null) => {
    if (!item || isBetModeNormal.value) return
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
  },
  hoverEnter: (item: BoardItem | null) => { state.hoverKey = item ? String(item.playId) : '' },
  hoverLeave: () => { state.hoverKey = '' }
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
    <!-- 該分頁限額（伺端以同一份 settings.quota 驗證） -->
    <div class="quota-bar">
      <span class="quota-item">單注 {{ money(minCoin) }} — {{ money(maxCoin) }}</span>
      <span v-if="mxQuota.issue.max > 0" class="quota-item">單期上限 {{ money(mxQuota.issue.max) }}</span>
      <span class="quota-note">
        {{ isBetModeNormal ? '※ 逐項填入金額即為選取' : '※ 點注項即選取，套用上方共用金額' }}
      </span>
    </div>

    <div v-if="tableGroups.length === 0" class="empty">此分頁尚無注項</div>

    <div v-for="group in tableGroups" :key="`k3-group-${group.groupName}`" class="play-group">
      <div class="group-title">
        {{ group.groupName }}
        <span v-if="group.oddsSummary" class="group-odds" :class="{ 'has-detail': group.hasOddsDetail }"
          :tabindex="group.hasOddsDetail ? 0 : undefined">
          {{ group.oddsSummary }}
          <!-- 標題只顯示區間時（點數），hover / focus 浮出逐項賠率 -->
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
              <th v-if="isBetModeNormal" class="th-amount" :class="{ 'is-empty': col > group.filled }">
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
                <!-- 有 nums 就畫骰子（三軍／圍骰／長牌／短牌），否則數字球（點數）或文字膠囊（大小單雙／全骰） -->
                <span v-if="item?.nums?.length" class="dice-set">
                  <Dice v-for="(num, dIdx) in item.nums" :key="dIdx" :num="num" size="sm" />
                </span>
                <button v-else-if="item" type="button" class="option"
                  :class="[_handlers.isNumber(item.name) ? 'is-box' : 'is-pill', { active: item.select }]">
                  {{ labelOf(item.name) }}
                </button>
              </td>
              <td v-if="isBetModeNormal" class="td-amount" :class="[cellClassOf(item), { 'is-empty': !item }]"
                @click="click.cell(item)"
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
/* 樣式取自 6hc-cd 的 .main-play-base（PlayBoard.vue），
   僅把號碼球換成骰子點、並加上 fast 模式沒有金額欄的排版 */
.k3-board {
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

      /* 群組賠率（整組同值顯示一個，點數等不同值則顯示區間） */
      .group-odds {
        margin-left: 10px;
        font-size: 11px;
        font-weight: 700;
        color: var(--color-red-desc);
        font-variant-numeric: tabular-nums;

        /* 只顯示區間的群組（點數）：hover 浮出逐項賠率 */
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
          grid-template-columns: repeat(2, auto);
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

    /* 欄寬固定，避免 active 內容變化（值／粗體）撐寬欄位 */
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

      /* 沒有注項的欄位（全骰只佔 4 欄中的第 1 欄）：不畫框也不上底色，
         但欄位本身保留，才不會跟同分頁其他群組的欄位對不齊 */
      .is-empty {
        border-color: transparent;
        background: transparent;
      }

      .td-code {
        padding: 6px 4px;
      }

      /* 號碼欄寬度依內容型態分三種，金額欄自動吸收剩餘寬度 */
      &.is-dice {

        .th-code,
        .td-code {
          /* 最多 3 顆骰子（圍骰）：30px × 3 + 間距 */
          width: 108px;
        }
      }

      &.is-box {

        .th-code,
        .td-code {
          /* 「18點」三個字 + 方框內距 */
          width: 68px;
        }
      }

      &.is-pill {

        .th-code,
        .td-code {
          /* 「圍骰全」三個字 + 膠囊左右內距，76px 會被擠到換行 */
          width: 88px;
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

    /* 骰子點：點擊交給整格 td 處理 */
    .dice-set {
      display: inline-flex;
      justify-content: center;
      gap: 3px;
      pointer-events: none;
    }

    /* ── 選項（數字球 / 文字膠囊）───────────────────────── */
    .option {
      box-sizing: border-box;
      /* border 計入尺寸，active 時寬度不變 */
      background: #fff;
      /* 注項名稱一律不換行（「圍骰全」「18點」） */
      white-space: nowrap;
      font-weight: 600;
      color: var(--color-red-desc);
      transition: all 0.15s ease;
      /* 點擊交給整格 td 處理 */
      pointer-events: none;

      /* 點數（和值）：方框而非號碼球 */
      &.is-box {
        min-width: 48px;
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

  /* fast 模式沒有金額欄，號碼欄改由表格平均分配 */
  &.is-fast .play-group .play-table {

    &.is-dice,
    &.is-box,
    &.is-pill {

      .th-code,
      .td-code {
        width: auto;
      }
    }
  }
}
</style>
