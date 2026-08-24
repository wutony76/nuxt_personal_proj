<script setup lang="ts">
import { computed, reactive } from 'vue'
import Ball from '~/components/lottery/bg/fc3d/base/Ball.vue'
import { useFc3d } from '~/composables/useFc3d'

/**
 * 福彩3D投注看板
 *
 * 一個元件要應付 3 種分頁型態（見 fc3dof/plays.js 的分工）：
 *   單選分頁（定位膽）      —— 與 eggs 同款的「號碼｜金額」表格，逐項填金額
 *   複式分頁（其餘 4 個）  —— 每個位置／每組一列可選值（號碼、和值或面），多選；
 *                            注數＝各列選數相乘（組選類是組合數，見 useFc3d 的 rawComboCount）
 *   輸入分頁（三星直選單式）—— 文字框直接貼 3 位數字注碼，不走複式展開
 *
 * ⚠️ 複式的選號格值域不只 0~9（三星直選和值／三星組選和值是 0~27 的和值），
 *    超過 9 的值改用方框數字而不是號碼球（Ball 元件只認 0~9）。
 */
const {
  state: mxState,
  board,
  combo,
  isInputMode,
  comboGroups,
  comboCodes,
  comboOverflow,
  comboHint,
  currentQuota,
  groupList,
  selectedCount,
  totalAmount,
  actions: mxActions
} = useFc3d()

const money = (value: number) => Number(value ?? 0).toLocaleString('zh-TW')
const state = reactive({ hoverKey: '' as string })

const _handlers = {
  /** 該注碼是否已選（單選分頁） */
  isPicked: (code: string) => board.items.some((item) => item.code === String(code)),
  /** 該注碼目前填了多少（單選分頁） */
  coinOf: (code: string) => Number(board.items.find((item) => item.code === String(code))?.coin ?? 0),
  /** 該格是否已選（複式分頁；value 可能是號碼、和值或面） */
  isPickedAt: (pos: number, value: number | string) =>
    (board.picks[pos] ?? []).some((item) => String(item) === String(value)),
  /** 橫向矩陣（依 config 順序橫向填，號碼才不會跳號） */
  toRowMatrix: <T,>(list: T[], columns: number) => {
    const rows = Math.ceil(list.length / columns)
    return Array.from({ length: rows }, (_, rowIndex) =>
      Array.from({ length: columns }, (_, colIndex) => list[rowIndex * columns + colIndex] ?? null)
    )
  }
}

// --- COMPUTED ---
const minCoin = computed(() => currentQuota.value.item.min)
const maxCoin = computed(() => currentQuota.value.item.max)

/** 單選分頁（定位膽）的群組：百/十/個位各 10 個號碼，全部是號碼球 */
const singleGroups = computed(() => {
  if (combo.value) return []
  const tab = (groupList.value as any[]).find((item) => Number(item.tabId) === Number(mxState.tabId))
  return (tab?.tabGroup ?? []).map((group: any) => {
    const groupName = String(group.groupName ?? '')
    const list = (group.groupList ?? []) as any[]
    const columns = Number(group.columns) > 0 ? Number(group.columns) : Math.max(1, Math.min(5, list.length))
    const items = list.map((item) => ({
      playId: String(item.playId ?? ''),
      name: String(item.name ?? ''),
      digit: Number(item.digit ?? -1),
      odds: mxActions.oddsOf(String(item.name ?? ''))
    }))
    const oddsList = Array.from(new Set(items.map((item) => item.odds).filter((odds) => odds > 0)))
    return {
      groupName,
      columns,
      filled: Math.min(columns, items.length),
      oddsSummary: oddsList.length === 1 ? `賠率[ ${oddsList[0]} ]` : '',
      rows: _handlers.toRowMatrix(items, columns)
    }
  })
})

/** 複式分頁：展開後的注數（含超過上限時的原始注數）與前幾注預覽 */
const comboPreview = computed(() => {
  const codes = comboCodes.value
  return {
    // 只預覽前 12 注，全部列出來（複式選滿時可能上千注）會把畫面撐爆
    sample: codes.slice(0, 12),
    more: Math.max(0, codes.length - 12)
  }
})

/** 每個位置／每組已選幾個值（顯示在該列標題） */
const pickedCountOf = (pos: number) => (board.picks[pos] ?? []).length

const click = {
  /** 單選分頁：點注項切換選取 */
  cell: (code: string) => {
    if (!code) return
    mxActions.toggleItem(code)
  },
  coinInput: (code: string, event: Event) => {
    const target = event.target as HTMLInputElement
    const coin = Math.min(maxCoin.value, Math.max(0, Math.trunc(Number(target.value) || 0)))
    if (!board.items.some((item) => item.code === code)) mxActions.toggleItem(code)
    mxActions.setItemCoin(code, coin)
    target.value = coin > 0 ? String(coin) : ''
  },
  hoverEnter: (key: string) => { state.hoverKey = key },
  hoverLeave: () => { state.hoverKey = '' },
  /** 複式分頁：切換某位置／某組的某個值（號碼、和值或面） */
  pick: (pos: number, value: number | string) => mxActions.togglePick(pos, value),
  pickAll: (pos: number) => mxActions.togglePickAll(pos),
  inputText: (event: Event) => {
    mxActions.setInputText((event.target as HTMLTextAreaElement).value)
  }
}
</script>

<template>
  <div class="fc3d-board">
    <!-- 該分頁限額（伺端以同一份 settings.quota 驗證） -->
    <div class="quota-bar">
      <span class="quota-item">單注 {{ money(minCoin) }} — {{ money(maxCoin) }}</span>
      <span v-if="currentQuota.issue.max > 0" class="quota-item">單期上限 {{ money(currentQuota.issue.max) }}</span>
      <span class="quota-note">
        {{ isInputMode ? '※ 輸入 3 位數字注碼，每注套用投注金額'
          : combo ? '※ 選號後自動組成注碼，每注套用投注金額' : '※ 點注項即選取並套用投注金額，也可逐項改金額' }}
      </span>
    </div>

    <!-- ── 輸入分頁（三星直選單式）─────────────────────────── -->
    <template v-if="isInputMode">
      <textarea class="input-area" rows="4" placeholder="請輸入 3 位數字注碼，可用逗號或換行分隔多筆，例如：123,456"
        :value="board.input.text" @input="click.inputText" />
      <div class="combo-sum">
        <div class="combo-line">
          <span>共 <b>{{ board.input.validCodes.length }}</b> 注</span>
          <span>× 每注 <b>{{ money(Number(mxState.amount) || 0) }}</b></span>
          <span>= 共 <b class="is-total">{{ money(totalAmount) }}</b></span>
        </div>
        <div v-if="board.input.validCodes.length" class="combo-sample">
          <span v-for="code in board.input.validCodes.slice(0, 20)" :key="`input-${code}`" class="sample-tag">
            {{ code }}
          </span>
          <span v-if="board.input.validCodes.length > 20" class="sample-more">
            …等 {{ board.input.validCodes.length - 20 }} 注
          </span>
        </div>
        <p v-if="comboHint" class="combo-empty">{{ comboHint }}</p>
      </div>
    </template>

    <!-- ── 複式分頁（直選組選／三星／不定位／大小單雙）──────── -->
    <template v-else-if="combo">
      <div v-for="group in comboGroups" :key="`fc3d-pos-${group.pos}`" class="pick-row">
        <div class="pick-head">
          <span class="pick-label">{{ group.label }}</span>
          <span class="pick-count">已選 {{ pickedCountOf(group.pos) }}</span>
          <button type="button" class="pick-all" @click="click.pickAll(group.pos)">
            {{ pickedCountOf(group.pos) === (group.values.length || group.sides.length) ? '清空' : '全選' }}
          </button>
        </div>
        <!-- 大小單雙：面別膠囊 -->
        <div v-if="group.sides.length > 0" class="pick-values is-side">
          <button v-for="side in group.sides" :key="`pos-${group.pos}-side-${side}`" type="button"
            class="pick-value is-pill" :class="{ active: _handlers.isPickedAt(group.pos, side) }"
            @click="click.pick(group.pos, side)">
            {{ side }}
          </button>
        </div>
        <!-- 號碼（0~9）：號碼球 -->
        <div v-else-if="Math.max(...group.values, 0) <= 9" class="pick-values">
          <button v-for="digit in group.values" :key="`pos-${group.pos}-digit-${digit}`" type="button"
            class="pick-value" :class="{ active: _handlers.isPickedAt(group.pos, digit) }"
            @click="click.pick(group.pos, digit)">
            <Ball :digit="digit" size="md" />
          </button>
        </div>
        <!-- 和值（0~27）：方框數字 -->
        <div v-else class="pick-values">
          <button v-for="value in group.values" :key="`pos-${group.pos}-value-${value}`" type="button"
            class="pick-value is-box" :class="{ active: _handlers.isPickedAt(group.pos, value) }"
            @click="click.pick(group.pos, value)">
            {{ value }}
          </button>
        </div>
      </div>

      <!-- 展開結果：注數 × 金額，以及前幾注的預覽 -->
      <div class="combo-sum">
        <div class="combo-line">
          <span>{{ comboOverflow ? '選號共' : '展開' }} <b>{{ comboCodes.length || selectedCount }}</b> 注</span>
          <span>× 每注 <b>{{ money(Number(mxState.amount) || 0) }}</b></span>
          <span>= 共 <b class="is-total">{{ money(totalAmount) }}</b></span>
        </div>
        <div v-if="comboPreview.sample.length" class="combo-sample">
          <span v-for="(code, idx) in comboPreview.sample" :key="`sample-${idx}`" class="sample-tag">{{ code }}</span>
          <span v-if="comboPreview.more > 0" class="sample-more">…等 {{ comboPreview.more }} 注</span>
        </div>
        <p v-else class="combo-empty">{{ comboHint }}</p>
      </div>
    </template>

    <!-- ── 單選分頁（定位膽）─────────────────────────────── -->
    <template v-else>
      <div v-if="singleGroups.length === 0" class="empty">此分頁尚無注項</div>
      <div v-for="group in singleGroups" :key="`fc3d-group-${group.groupName}`" class="play-group">
        <div class="group-title">
          {{ group.groupName }}
          <span v-if="group.oddsSummary" class="group-odds">{{ group.oddsSummary }}</span>
        </div>

        <!-- ⚠️ 一定要寫出 tbody，否則 SSR 輸出與 hydration 後的 DOM 對不上 -->
        <table class="play-table">
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
                <td class="td-code"
                  :class="{
                    active: item ? _handlers.isPicked(item.name) : false,
                    hover: !!item && state.hoverKey === item.playId,
                    clickable: !!item,
                    'is-empty': !item
                  }"
                  @click="item && click.cell(item.name)" @mouseenter="click.hoverEnter(item?.playId ?? '')"
                  @mouseleave="click.hoverLeave()">
                  <span v-if="item" class="ball-set"><Ball :digit="item.digit" size="md" /></span>
                </td>
                <td class="td-amount"
                  :class="{
                    active: item ? _handlers.isPicked(item.name) : false,
                    hover: !!item && state.hoverKey === item.playId,
                    clickable: !!item,
                    'is-empty': !item
                  }"
                  @click="item && click.cell(item.name)" @mouseenter="click.hoverEnter(item?.playId ?? '')"
                  @mouseleave="click.hoverLeave()">
                  <input v-if="item" type="number" min="0" :max="maxCoin"
                    :value="_handlers.coinOf(item.name) || ''" placeholder="0" @click.stop
                    @input="click.coinInput(item.name, $event)" />
                </td>
              </template>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="single-sum">
        已選 <b>{{ selectedCount }}</b> 注 · 共 <b class="is-total">{{ money(totalAmount) }}</b>
      </div>
    </template>
  </div>
</template>

<style scoped lang="scss">
.fc3d-board {
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

  .input-area {
    width: 100%;
    box-sizing: border-box;
    border: 1px solid #f3b7bf;
    border-radius: 6px;
    background: #fff;
    padding: 10px;
    font-size: 13px;
    font-variant-numeric: tabular-nums;
    color: var(--color-red-main);
    resize: vertical;
    outline: none;

    &:focus {
      border-color: var(--color-red-main);
      box-shadow: 0 0 0 2px rgba(213, 63, 83, 0.12);
    }
  }

  /* ── 複式選號：一個位置／一組一列 ───────────────────── */
  .pick-row {
    border: 1px solid #fee2e2;
    border-radius: 6px;
    background: #fff;

    &+.pick-row {
      margin-top: -1px;
    }

    .pick-head {
      display: flex;
      align-items: center;
      gap: 10px;
      border-bottom: 1px solid #fee2e2;
      background: #fdeef0;
      padding: 5px 10px;

      .pick-label {
        font-size: 13px;
        font-weight: 700;
        color: var(--color-red-main);
      }

      .pick-count {
        font-size: 12px;
        color: var(--color-red-desc);
        font-variant-numeric: tabular-nums;
      }

      .pick-all {
        margin-left: auto;
        border: 1px solid var(--color-red-main);
        border-radius: 4px;
        background: #fff;
        padding: 2px 10px;
        font-size: 12px;
        font-weight: 700;
        color: var(--color-red-main);
        cursor: pointer;

        &:hover {
          background: var(--color-red-main);
          color: #fff;
        }
      }
    }

    .pick-values {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      padding: 10px;

      .pick-value {
        display: inline-flex;
        border: 2px solid transparent;
        border-radius: 50%;
        background: none;
        padding: 2px;
        cursor: pointer;
        opacity: 0.45;
        transition: opacity 0.15s ease, border-color 0.15s ease, transform 0.15s ease;

        &:hover {
          opacity: 0.8;
        }

        &.active {
          opacity: 1;
          border-color: var(--color-red-main);
          transform: translateY(-1px);
        }

        /* 大小單雙：面別膠囊，不是圓球 */
        &.is-pill {
          border-radius: 6px;
          border: 1px solid var(--color-red-700);
          padding: 4px 16px;
          font-size: 14px;
          font-weight: 700;
          color: var(--color-red-main);

          &.active {
            background: var(--color-yellow-text);
          }
        }

        /* 和值（0~27）：方框數字，不是圓球 */
        &.is-box {
          border-radius: 4px;
          border: 1px solid var(--color-red-700);
          min-width: 32px;
          height: 32px;
          padding: 0 6px;
          font-size: 13px;
          font-weight: 700;
          color: var(--color-red-main);

          &.active {
            background: var(--color-yellow-text);
          }
        }
      }
    }
  }

  /* 複式展開結果／輸入模式的注碼預覽 */
  .combo-sum {
    border: 1px solid var(--color-red-700);
    border-radius: 6px;
    background: #fff5f6;
    padding: 8px 10px;

    .combo-line {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;
      font-size: 13px;
      color: var(--color-red-desc);

      b {
        font-weight: 800;
        color: var(--color-red-main);
        font-variant-numeric: tabular-nums;
      }

      b.is-total {
        color: #15803d;
      }
    }

    .combo-sample {
      display: flex;
      flex-wrap: wrap;
      gap: 5px;
      margin-top: 7px;

      .sample-tag {
        border: 1px solid #f3b7bf;
        border-radius: 4px;
        background: #fff;
        padding: 1px 7px;
        font-size: 11px;
        font-weight: 700;
        color: var(--color-red-main);
        font-variant-numeric: tabular-nums;
      }

      .sample-more {
        font-size: 11px;
        color: var(--color-red-desc);
      }
    }

    .combo-empty {
      margin: 7px 0 0;
      font-size: 12px;
      color: var(--color-red-desc);
    }
  }

  /* ── 單選分頁：與 eggs 同款表格 ─────────────────────── */
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
        width: 48px;
      }

      .th-code {
        width: 48px;
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
      }
    }
  }

  .ball-set {
    display: inline-flex;
    justify-content: center;
    pointer-events: none;
  }

  .single-sum {
    text-align: right;
    font-size: 13px;
    color: var(--color-red-desc);

    b {
      font-weight: 800;
      color: var(--color-red-main);
      font-variant-numeric: tabular-nums;
    }

    b.is-total {
      color: #15803d;
    }
  }
}
</style>
