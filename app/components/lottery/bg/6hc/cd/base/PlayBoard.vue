<script setup lang="ts">
import { cloneDeep } from 'lodash-es'
import { LHC_COLORS } from '#shared/config/6hc-cd'
import { use6hcCredit } from '~/composables/use6hcCredit'

type PlayItem = { playId: string | number; name: string; odds?: number; coin?: string | number; select?: boolean }

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
  // 賠率不同但注項多 → 區間，避免標題過長
  oddsSummaryOf: (list: PlayItem[] = []) => {
    const pairs = list
      .map((item) => ({ label: String(item?.name ?? '').charAt(0), odds: Number(item?.odds ?? 0) }))
      .filter((item) => item.odds > 0)
    if (pairs.length === 0) return ''
    const distinct = Array.from(new Set(pairs.map((item) => item.odds)))
    if (distinct.length === 1) return `賠 ${distinct[0]}`
    if (pairs.length > 4) return `賠 ${Math.min(...distinct)} — ${Math.max(...distinct)}`
    return `賠 ${pairs.map((item) => `${item.label}${item.odds}`).join(' / ')}`
  },
  // 直向（column-major）排成 rows × columns 的表格矩陣
  toMatrix: (list: PlayItem[] = [], columns: number) => {
    const rows = Math.ceil(list.length / columns)
    return Array.from({ length: rows }, (_, rowIndex) =>
      Array.from({ length: columns }, (_, colIndex) => list[rowIndex + colIndex * rows] ?? null)
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
    return {
      groupName: group.groupName,
      columns,
      oddsSummary: _handlers.oddsSummaryOf(group.groupList),
      // 號碼為文字（非數字）→ 膠囊型玩法（兩面 / 色波）
      isPill: !_handlers.isNumber(String(group.groupList[0]?.name ?? '0')),
      rows: _handlers.toMatrix(group.groupList, columns),
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
        <span v-if="group.oddsSummary" class="group-odds">· {{ group.oddsSummary }}</span>
      </div>
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

      & + .quota-item::before {
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
        margin-left: 4px;
        font-size: 13px;
        font-weight: 700;
        color: var(--color-gold);
        font-variant-numeric: tabular-nums;
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
