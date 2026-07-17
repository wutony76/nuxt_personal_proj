<script setup lang="ts">
import { cloneDeep } from 'lodash-es'
import { LHC_COLORS } from '#shared/config/6hc-cd'

type PlayItem = { playId: string | number; name: string; coin?: string | number; select?: boolean }

// 各群組每列（欄）數量
const GROUP_COLUMNS: Record<string, number> = {
  特碼: 5,
  兩面: 4,
  色波: 3,
}
const DEFAULT_COLUMNS = 5
const MIN_COIN = 0
const MAX_COIN = 99999
const { state: mxState, groupList: mxGroupList, select: mxSelect } = use6hcCredit()
const state = reactive({
  selectItems: []
})
const hoverKey = ref<string | null>(null)


// --- HANDLE HANDLE ---
const _handlers = {
  columnsOf: (groupName: string) => GROUP_COLUMNS[groupName] ?? DEFAULT_COLUMNS,
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
  // 僅保留數字，並限制在 [MIN_COIN, MAX_COIN] 範圍內
  normalizeCoin: (raw: string) => {
    const digits = raw.replace(/\D/g, '')
    if (!digits) return ''
    const num = Math.min(MAX_COIN, Math.max(MIN_COIN, Math.trunc(Number(digits))))
    return String(num)
  },
  // 直向（column-major）排成 rows × columns 的表格矩陣
  toMatrix: (list: PlayItem[] = [], columns: number) => {
    const rows = Math.ceil(list.length / columns)
    return Array.from({ length: rows }, (_, rowIndex) =>
      Array.from({ length: columns }, (_, colIndex) => list[rowIndex + colIndex * rows] ?? null)
    )
  },
  selectItems: () => {
    const _selects = state.selectItems.filter(item => item.select)
    mxSelect.items = _selects
  }
}
const click = {
  toggle: (item: PlayItem) => {
    const key = String(item.playId)
    if (mxState.selectedCodes.includes(key)) {
      mxState.selectedCodes = mxState.selectedCodes.filter((code) => code !== key)
      item.select = false
      return
    }
    mxState.selectedCodes = [...mxState.selectedCodes, key]
    if (!item.coin) item.coin = mxState.amount
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
      if (!mxState.selectedCodes.includes(key)) mxState.selectedCodes = [...mxState.selectedCodes, key]
    } else {
      mxState.selectedCodes = mxState.selectedCodes.filter((code) => code !== key)
    }
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
  state.selectItems = []
  const _found = mxGroupList.value.find((item) => item.tabId === mxState.selectTabId)
  if (!_found || !_found.tabGroup) return null
  // 包成 reactive，讓 item.coin / item.select 的讀寫具反應性（watch 更新才會反映到畫面）
  const _layout = reactive(cloneDeep(_found))
  _layout.tabGroup.forEach((group) => {
    group.groupList.forEach((item: PlayItem) => {
      item.select = false
      item.coin = 0
      state.selectItems.push(item)
    })
  })
  return _layout
})
// 每個群組預先算好欄數與表格矩陣
const tableGroups = computed(() =>
  (layout.value?.tabGroup ?? []).map((group) => {
    const columns = _handlers.columnsOf(group.groupName)
    return {
      groupName: group.groupName,
      columns,
      // 號碼為文字（非數字）→ 膠囊型玩法（兩面 / 色波）
      isPill: !_handlers.isNumber(String(group.groupList[0]?.name ?? '0')),
      rows: _handlers.toMatrix(group.groupList, columns),
    }
  })
)

// --- WATCH ---
watch(() => mxState.amount, (val) => {
  console.log('watch. amount', val)
  mxSelect.items.forEach(item => {
    item.coin = val
  })
})


</script>

<template>
  <div class="main-play-base tema">
    <div v-for="group in tableGroups" :key="`tema-${group.groupName}`" class="play-group">
      <div class="group-title">{{ group.groupName }}</div>
      <table class="play-table" :class="{ 'pill-table': group.isPill }">
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
                <input v-if="item" type="number" :min="MIN_COIN" :max="MAX_COIN" :value="_handlers.coinOf(item)"
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

  .play-group {
    display: flex;
    flex-direction: column;

    .group-title {
      text-align: center;
      font-size: 15px;
      font-weight: 700;
      color: var(--color-red-main);
      padding: 0.5rem 0;
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
}
</style>
