<script setup lang="ts">
import { cloneDeep } from 'lodash-es'
import { LHC_COLORS } from '#shared/config/6hc-cd'
import { creditTabOddsOf } from '#shared/config/cd/helpers'
import { use6hcCredit } from '~/composables/use6hcCredit'

type PlayItem = {
  playId: string | number
  name: string
  odds?: number
  coin?: string | number
  select?: boolean
  /** 該注項涵蓋的號碼（半波 / 五行），有值時會顯示在注項下方 */
  nums?: string[]
}

/**
 * 玩法注項看板（特碼 / 正碼共用）
 * 各玩法元件只需傳入 boardClass 與該玩法各群組的欄數，
 * 注項池登記 / 選取 / 金額輸入 / 隨機選號同步等邏輯全部集中在這裡。
 */
const props = defineProps<{
  /** 根節點附加 class，供各玩法微調樣式 */
  boardClass?: string
  /** 各群組每列（欄）數量，如 { 特碼: 5, 兩面: 4 } */
  groupColumns?: Record<string, number>
}>()

const DEFAULT_COLUMNS = 5
const {
  state: mxState,
  groupList: mxGroupList,
  select: mxSelect,
  actions: mxActions,
  currentQuota: mxQuota
} = use6hcCredit()
// 單注限額（依當前分頁 settings.quota）
const minCoin = computed(() => mxQuota.value.item.min)
const maxCoin = computed(() => mxQuota.value.item.max)
const hoverKey = ref<string | null>(null)


// --- HANDLE HANDLE ---
const _handlers = {
  columnsOf: (groupName: string) => props.groupColumns?.[groupName] ?? DEFAULT_COLUMNS,
  isNumber: (name: string) => /^\d+$/.test(String(name)),
  // 依號碼 / 波色文字推得色系（red / blue / green / yellow / ''）
  colorOf: (name: string) => {
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
  isSelected: (item: PlayItem) => mxState.selectedCodes.includes(String(item.playId)),
  isHovered: (item: PlayItem) => hoverKey.value === String(item.playId),
  // 該號碼顯示的金額：取自身輸入值（item.coin）
  coinOf: (item: PlayItem) => item.coin ?? 0,
  // 僅保留數字，並夾在該分頁的單注限額內（清空視為取消該注，不套用 min）
  normalizeCoin: (raw: string) => {
    const digits = raw.replace(/\D/g, '')
    if (!digits) return ''
    const num = Math.min(maxCoin.value, Math.max(minCoin.value, Math.trunc(Number(digits))))
    return String(num)
  },
  // 千分位（限額提示用）
  money: (value: number) => Number(value).toLocaleString('zh-TW'),
  // 群組賠率摘要：
  // 整組同賠率 → 單一值（特碼 · 賠 48）
  // 賠率不同且注項數少 → 逐項列出（色波 · 賠 紅2.7 / 藍2.9 / 綠2.9）
  // 賠率不同但注項多 → 區間，避免標題過長；此時 isRange = true，
  //   標題會變成可 hover，浮出 detail 逐項賠率（五行 / 半波 / 一肖 / 七碼）
  oddsInfoOf: (list: PlayItem[] = []) => {
    const pairs = list
      .map((item) => ({ name: String(item?.name ?? ''), odds: Number(item?.odds ?? 0) }))
      .filter((item) => item.odds > 0)
    if (pairs.length === 0) return { summary: '', detail: [], isRange: false }
    const distinct = Array.from(new Set(pairs.map((item) => item.odds)))
    if (distinct.length === 1) {
      return { summary: `賠率[ ${distinct[0]} ]`, detail: pairs, isRange: false }
    }
    if (pairs.length > 4) {
      return {
        summary: `賠率 ${Math.min(...distinct)} — ${Math.max(...distinct)}`,
        detail: pairs,
        isRange: true,
      }
    }
    const inline = pairs.map((item) => `${item.name.charAt(0)}${item.odds}`).join(' | ')
    return { summary: `賠率[ ${inline} ]`, detail: pairs, isRange: false }
  },
  // 直向（column-major）排成 rows × columns 的表格矩陣
  toMatrix: (list: PlayItem[] = [], columns: number) => {
    const rows = Math.ceil(list.length / columns)
    return Array.from({ length: rows }, (_, rowIndex) =>
      Array.from({ length: columns }, (_, colIndex) => list[rowIndex + colIndex * rows] ?? null)
    )
  },
  // 橫向（row-major）矩陣：半波 / 五行的注項是成對的（紅大紅小、金木），
  // 用直向排會把紅大跟綠單放在同一列，必須依 config 順序橫向填
  toRowMatrix: (list: PlayItem[] = [], columns: number) => {
    const rows = Math.ceil(list.length / columns)
    return Array.from({ length: rows }, (_, rowIndex) =>
      Array.from({ length: columns }, (_, colIndex) => list[rowIndex * columns + colIndex] ?? null)
    )
  },
  // 同步「當前注項」清單（改由 composable 依注項池統一計算，隨機選號 / 清空共用同一份邏輯）
  selectItems: () => {
    mxActions.syncSelectItems()
  }
}
const click = {
  toggle: (item: PlayItem) => {
    const key = String(item.playId)
    if (mxState.selectedCodes.includes(key)) {
      mxState.selectedCodes = mxState.selectedCodes.filter((code) => code !== key)
      item.select = false

      // --- select items ---
      _handlers.selectItems()
      return
    }

    mxState.selectedCodes = [...mxState.selectedCodes, key]
    item.coin = Math.min(maxCoin.value, Math.max(minCoin.value, Number(mxState.amount) || 0))
    item.select = true

    // --- select items ---
    _handlers.selectItems()
  },
  // 直接輸入金額：僅允許數字，並限制在 [MIN_COIN, MAX_COIN]；有值→選取、歸零/空→取消
  onCoinInput: (item: PlayItem, event: Event) => {
    const key = String(item.playId)
    const target = event.target as HTMLInputElement
    const normalized = _handlers.normalizeCoin(target.value)
    item.coin = normalized
    target.value = normalized
    const num = Math.max(0, Math.floor(Number(normalized) || 0))
    if (num > 0) {
      item.select = true
      if (!mxState.selectedCodes.includes(key)) mxState.selectedCodes = [...mxState.selectedCodes, key]
    } else {
      item.select = false
      mxState.selectedCodes = mxState.selectedCodes.filter((code) => code !== key)
    }
    _handlers.selectItems()
  },
  hoverEnter: (item: PlayItem) => {
    hoverKey.value = String(item.playId)
  },
  hoverLeave: () => {
    hoverKey.value = null
  },
}

// --- COMPUTED ---
const layout = computed(() => {
  void mxSelect.resetToken // 依 resetToken 觸發重新 init（下注成功後清空號碼球選取 / 金額）
  const _found = mxGroupList.value.find((item) => item.tabId === mxState.selectTabId)
  if (!_found || !_found.tabGroup) {
    if (import.meta.client) mxActions.registerSelectPool([])
    return null
  }
  // 包成 reactive，讓 item.coin / item.select 的讀寫具反應性（watch 更新才會反映到畫面）
  const _layout = reactive(cloneDeep(_found))
  const _pool: PlayItem[] = []
  _layout.tabGroup.forEach((group) => {
    group.groupList.forEach((item: PlayItem) => {
      item.select = false
      item.coin = 0
      // 五行的賠率不寫在 config（號碼數逐年變動，由號碼數推算），在此補上供群組標題顯示
      if (!(Number(item.odds) > 0)) {
        item.odds = creditTabOddsOf(mxState.select, mxState.selectTabId, item.name)
      }
      _pool.push(item)
    })
  })
  // 登記注項池給 composable（AutoSelect 隨機選號 / 清空共用同一批 reactive 物件）
  // 僅在 client 登記：select 是 module 級 singleton，SSR 期間寫入會跨請求殘留，
  // 導致第二次之後的 SSR 與 client 首次渲染不一致（AutoSelect hydration mismatch）
  if (import.meta.client) mxActions.registerSelectPool(_pool)
  return _layout
})
// 每個群組預先算好欄數與表格矩陣
const tableGroups = computed(() =>
  (layout.value?.tabGroup ?? []).map((group) => {
    const columns = _handlers.columnsOf(group.groupName)
    const hasNums = (group.groupList as PlayItem[]).some((item) => (item?.nums?.length ?? 0) > 0)
    const oddsInfo = _handlers.oddsInfoOf(group.groupList)
    return {
      groupName: group.groupName,
      columns,
      oddsSummary: oddsInfo.summary,
      // 標題只放區間時（注項多、賠率不一），逐項賠率改用 hover 浮層呈現
      oddsDetail: oddsInfo.detail,
      hasOddsDetail: oddsInfo.isRange,
      // 號碼為文字（非數字）→ 膠囊型玩法（兩面 / 色波）
      isPill: !_handlers.isNumber(String(group.groupList[0]?.name ?? '0')),
      // 注項帶號碼清單（半波 / 五行）→ 改用「項目｜金額｜號碼」清單式排版，一列並排 columns 組
      hasNums,
      // hasNums：橫向排列（紅大、紅小依序左右並排），其餘玩法維持直向排的號碼球盤
      rows: hasNums
        ? _handlers.toRowMatrix(group.groupList, columns)
        : _handlers.toMatrix(group.groupList, columns),
    }
  })
)

// --- WATCH ---
watch(() => mxState.amount, (val) => {
  const coin = Math.min(maxCoin.value, Math.max(minCoin.value, Number(val) || 0))
  mxSelect.items.forEach(item => {
    item.coin = coin
  })
})
</script>

<template>
  <div class="main-play-base" :class="props.boardClass">
    <!-- 該分頁限額（伺端以同一份 settings.quota 驗證） -->
    <div class="quota-bar">
      <span class="quota-item">單注 {{ _handlers.money(minCoin) }} — {{ _handlers.money(maxCoin) }}</span>
      <span v-if="mxQuota.issue.max > 0" class="quota-item">
        單期上限 {{ _handlers.money(mxQuota.issue.max) }}
      </span>
      <span class="quota-note">※ 賠率標於各群組標題，派彩以下注時的賠率為準</span>
    </div>

    <div v-for="group in tableGroups" :key="`board-${group.groupName}`" class="play-group">
      <div class="group-title">
        {{ group.groupName }}
        <span v-if="group.oddsSummary" class="group-odds" :class="{ 'has-detail': group.hasOddsDetail }"
          :tabindex="group.hasOddsDetail ? 0 : undefined">
          .{{ group.oddsSummary }}
          <!-- 標題只顯示區間時，hover / focus 浮出逐項賠率 -->
          <span v-if="group.hasOddsDetail" class="odds-tip" role="tooltip">
            <em v-for="row in group.oddsDetail" :key="`tip-${group.groupName}-${row.name}`">
              <i>{{ row.name }}</i><b>{{ row.odds }}</b>
            </em>
          </span>
        </span>
      </div>
      <!-- 半波 / 五行：清單式排版（項目｜金額｜號碼），一列並排 group.columns 組 -->
      <table v-if="group.hasNums" class="play-table nums-list-table">
        <thead>
          <tr>
            <template v-for="col in group.columns" :key="`head-${group.groupName}-${col}`">
              <th class="th-name">項目</th>
              <th class="th-amount">金額</th>
              <th class="th-nums">號碼</th>
            </template>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, rowIndex) in group.rows" :key="`row-${group.groupName}-${rowIndex}`">
            <template v-for="(item, colIndex) in row" :key="`cell-${group.groupName}-${rowIndex}-${colIndex}`">
              <td class="td-name" :class="{
                active: item && _handlers.isSelected(item),
                hover: item && _handlers.isHovered(item),
                clickable: !!item,
              }" @click="item && click.toggle(item)" @mouseenter="item && click.hoverEnter(item)"
                @mouseleave="click.hoverLeave()">
                <button v-if="item" type="button" class="option is-pill" :class="[
                  _handlers.colorOf(item.name) ? `c-${_handlers.colorOf(item.name)}` : '',
                  { active: _handlers.isSelected(item) },
                ]">
                  {{ item.name }}
                </button>
              </td>
              <td class="td-amount" :class="{
                active: item && _handlers.isSelected(item),
                hover: item && _handlers.isHovered(item),
                clickable: !!item,
              }" @click="item && click.toggle(item)" @mouseenter="item && click.hoverEnter(item)"
                @mouseleave="click.hoverLeave()">
                <input v-if="item" type="number" :min="minCoin" :max="maxCoin" :value="_handlers.coinOf(item)"
                  @click.stop @input="click.onCoinInput(item, $event)" />
              </td>
              <td class="td-nums" :class="{
                active: item && _handlers.isSelected(item),
                hover: item && _handlers.isHovered(item),
                clickable: !!item,
              }" @click="item && click.toggle(item)" @mouseenter="item && click.hoverEnter(item)"
                @mouseleave="click.hoverLeave()">
                <span v-if="item?.nums?.length" class="nums-balls">
                  <em v-for="num in item.nums" :key="`${item.playId}-${num}`" class="num-ball"
                    :class="_handlers.colorOf(num) ? `c-${_handlers.colorOf(num)}` : ''">{{ num }}</em>
                </span>
              </td>
            </template>
          </tr>
        </tbody>
      </table>

      <table v-else class="play-table" :class="{ 'pill-table': group.isPill }">
        <thead>
          <tr>
            <template v-for="col in group.columns" :key="`head-${group.groupName}-${col}`">
              <th class="th-code">號碼</th>
              <th class="th-amount">金額</th>
            </template>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, rowIndex) in group.rows" :key="`row-${group.groupName}-${rowIndex}`">
            <template v-for="(item, colIndex) in row" :key="`cell-${group.groupName}-${rowIndex}-${colIndex}`">
              <td class="td-code" :class="{
                active: item && _handlers.isSelected(item),
                hover: item && _handlers.isHovered(item),
                clickable: !!item,
              }" @click="item && click.toggle(item)" @mouseenter="item && click.hoverEnter(item)"
                @mouseleave="click.hoverLeave()">
                <button v-if="item" type="button" class="option" :class="[
                  _handlers.isNumber(item.name) ? 'is-ball' : 'is-pill',
                  _handlers.colorOf(item.name) ? `c-${_handlers.colorOf(item.name)}` : '',
                  { active: _handlers.isSelected(item) },
                ]">
                  {{ item.name }}
                </button>
              </td>
              <td class="td-amount" :class="{
                active: item && _handlers.isSelected(item),
                hover: item && _handlers.isHovered(item),
                clickable: !!item,
              }" @click="item && click.toggle(item)" @mouseenter="item && click.hoverEnter(item)"
                @mouseleave="click.hoverLeave()">
                <input v-if="item" type="number" :min="minCoin" :max="maxCoin" :value="_handlers.coinOf(item)"
                  @click.stop @input="click.onCoinInput(item, $event)" />
              </td>
            </template>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped lang="scss">
.main-play-base {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-top: 1rem;
  padding: 0 0.75rem 0.75rem;
  /* 表格內縮，與 .right 卡片外框保留間距 */

  /* 分頁限額提示列 */
  .quota-bar {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    padding: 6px 10px;
    border: 1px solid #fee2e2;
    border-radius: 0.25rem;
    background: #fff5f6;
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

  .play-group {
    display: flex;
    flex-direction: column;

    .group-title {
      text-align: center;
      font-size: 15px;
      font-weight: 700;
      color: var(--color-red-main);
      padding: 0.5rem 0;

      /* 群組賠率（整組同值顯示一個，色波等不同值則拆開） */
      .group-odds {
        margin-left: 10px;
        font-size: 11px;
        font-weight: 700;
        color: var(--color-red-desc);
        font-variant-numeric: tabular-nums;

        /* 只顯示區間的群組（五行 / 半波 / 一肖 / 七碼）：hover 浮出逐項賠率 */
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
          pointer-events: none;
          /* 純提示用，不攔滑鼠，避免蓋住下方注項 */
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

    .play-table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      /* 欄寬固定，避免 active 內容變化（值/粗體）撐寬欄位 */

      th,
      td {
        border: 1px solid #fee2e2;
        text-align: center;
        vertical-align: middle;
      }

      thead th {
        height: 34px;
        font-size: 13px;
        font-weight: 600;
        color: var(--color-red-desc);
        background: #fdeef0;
      }

      /* 號碼欄固定窄寬，金額欄自動吸收剩餘寬度 */
      .th-code,
      .td-code {
        width: 52px;
        white-space: nowrap;
      }

      /* 膠囊型玩法（兩面 / 色波）：號碼為文字，號碼欄改自動分配避免超出 */
      &.pill-table {

        .th-code,
        .td-code {
          width: 70px;
        }
      }

      /* 帶號碼清單的玩法（半波 / 五行）：清單式排版，項目／金額窄、號碼欄吃剩餘寬度 */
      &.nums-list-table {
        .th-name,
        .td-name {
          width: 64px;
        }

        .td-name {
          padding: 6px 4px;
        }

        .th-amount,
        .td-amount {
          width: 120px;
        }

        .td-nums {
          padding: 6px 8px;
        }
      }

      .td-code {
        padding: 6px 4px;
      }

      .td-amount {
        padding: 6px 8px;

        /* 參考 6hc-of coin-input 樣式 */
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
          /* 可直接輸入金額 */
          transition: border-color 0.15s ease, box-shadow 0.15s ease;

          &:focus {
            border-color: var(--color-red-main);
            box-shadow: 0 0 0 2px rgba(213, 63, 83, 0.12);
          }
        }
      }

      /* 整格可點擊 / hover / 選中（事件與樣式都在 td 這層） */
      .td-code.clickable,
      .td-name.clickable,
      .td-amount.clickable,
      .td-nums.clickable {
        cursor: pointer;
      }

      .td-code.hover,
      .td-name.hover,
      .td-amount.hover,
      .td-nums.hover {
        background: #fbe3e6;
      }

      .td-code.active,
      .td-name.active,
      .td-amount.active,
      .td-nums.active {
        background: var(--color-yellow-text);
      }

      .td-amount.active input {
        border-color: var(--color-red-main);
        color: var(--color-red-main);
        font-weight: 700;
      }
    }

    /* 注項涵蓋的號碼（半波 / 五行）：獨立「號碼」欄，轉成與號碼球一致的圓形樣式 */
    .nums-balls {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 4px;
      pointer-events: none;

      .num-ball {
        box-sizing: border-box;
        width: 26px;
        height: 26px;
        border-radius: 50%;
        border: 0.15rem solid var(--6hcOf-ball-yellow);
        background: #fff;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        font-style: normal;
        font-weight: 600;
        color: #000;
        font-variant-numeric: tabular-nums;

        &.c-red {
          border-color: var(--6hcOf-ball-red);
        }

        &.c-blue {
          border-color: var(--6hcOf-ball-blue);
        }

        &.c-green {
          border-color: var(--6hcOf-ball-green);
        }

        &.c-yellow {
          border-color: var(--6hcOf-ball-yellow);
        }
      }
    }

    /* ── 選項（號碼球 / 膠囊） ────────────────────────────── */
    .option {
      box-sizing: border-box;
      /* border 計入尺寸，active 時寬度不變 */
      font-weight: 600;
      background: #fff;
      color: var(--color-red-desc);
      transition: all 0.15s ease;
      pointer-events: none;
      /* 點擊交給整格 td 處理 */

      &.is-ball {
        width: 34px;
        height: 34px;
        border-radius: 50%;
        border: 0.2rem solid var(--6hcOf-ball-yellow);
        font-size: 15px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        color: #000;
      }

      &.is-pill {
        min-width: 52px;
        height: 30px;
        padding: 0 12px;
        border-radius: 6px;
        border: 1px solid var(--color-red-700);
        font-size: 14px;
        color: var(--color-red-main);
      }

      &.c-red {
        border-color: var(--6hcOf-ball-red);

        /* 波色膠囊：文字色跟邊框一致（號碼球維持黑字） */
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

  /* 七碼：注項名稱有 5 個字（單0雙7），膠囊與號碼欄需比其他玩法再寬一些才不會換行 */
  &.qima .play-group .play-table.pill-table {

    .th-code,
    .td-code {
      width: 92px;
    }

    .option.is-pill {
      min-width: 78px;
      padding: 0 8px;
    }
  }
}
</style>
