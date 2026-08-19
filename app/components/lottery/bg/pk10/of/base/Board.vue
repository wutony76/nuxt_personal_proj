<script setup lang="ts">
import { computed, reactive } from 'vue'
import Car from '~/components/lottery/bg/pk10/base/Car.vue'
import { usePk10 } from '~/composables/usePk10'
import { PK10_RANK_NAMES } from '#shared/config/pk10'

/**
 * PK10 官方盤投注看板
 *
 * 一個元件要應付 config 裡兩種分頁型態（照 pcv2 conf_pk10_og.js 的結構）：
 *   單選分頁（前一直選／定位膽）→ 與信用盤同款的「號碼｜金額」表格，逐項填金額
 *   複式分頁（前二／前三直選）  → 每個名次一列車號球，多選；注數＝各列選數相乘
 *
 * ── 為什麼複式要另一種版面 ──────────────────────────────
 *   複式的一注是「跨名次的組合」，不是清單裡的某一項 ——
 *   注碼在送單前才由 pk10DirectCombos() 展開，所以畫面上沒有「逐項金額」可填，
 *   全部注共用一個投注金額（同 pcv2 的複式）。
 *
 * ⚠️ 前三直選走彩池分層（combo.pool = true），畫面不顯示賠率而是顯示分層規則 ——
 *    那邊的獎金要開獎後依命中名次數從獎池分，事前沒有固定賠率可標。
 */
const {
  state: mxState,
  of,
  ofGroups,
  ofCombo,
  ofComboGroups,
  ofComboBets,
  ofIsPool,
  ofQuota,
  ofSelectedCount,
  ofTotalAmount,
  ofPrizeTiers,
  actions: mxActions
} = usePk10()

const money = (value: number) => Number(value ?? 0).toLocaleString('zh-TW')
const state = reactive({ hoverKey: '' as string })

/** 名次前綴由長到短，避免「第十名」被短前綴先吃掉 */
const RANK_PREFIXES = [...PK10_RANK_NAMES].sort((a, b) => b.length - a.length)

const _handlers = {
  /**
   * 注項的顯示文字（同 cd/base/Board.vue 的 shortOf）
   * 群組標題已經寫了名次，格子裡不必重複；只影響顯示，送單仍用原注碼
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
    if (text.startsWith('前一')) return text.slice(2) || text
    return text
  },
  /** 該注碼目前填了多少（單選分頁） */
  coinOf: (code: string) => Number(of.items.find((item) => item.code === String(code))?.coin ?? 0),
  /** 該注碼是否已選（單選分頁） */
  isPicked: (code: string) => of.items.some((item) => item.code === String(code) && Number(item.coin) > 0),
  /** 該名次是否選了這個車號（複式分頁） */
  isCarPicked: (pos: number, car: number) => (of.picks[pos] ?? []).includes(Number(car)),
  /** 橫向矩陣（依 config 順序橫向填，車號才不會跳號） */
  toRowMatrix: <T,>(list: T[], columns: number) => {
    const rows = Math.ceil(list.length / columns)
    return Array.from({ length: rows }, (_, rowIndex) =>
      Array.from({ length: columns }, (_, colIndex) => list[rowIndex * columns + colIndex] ?? null)
    )
  }
}

// --- COMPUTED ---
const minCoin = computed(() => ofQuota.value.item.min)
const maxCoin = computed(() => ofQuota.value.item.max)

/** 單選分頁的群組（含即時賠率與欄數，全部讀 config） */
const singleGroups = computed(() => {
  if (ofCombo.value) return []
  return (ofGroups.value as any[]).map((group) => {
    const groupName = String(group.groupName ?? '')
    const list = (group.groupList ?? []) as any[]
    const columns = Number(group.columns) > 0 ? Number(group.columns) : Math.max(1, Math.min(5, list.length))
    const items = list.map((item) => ({
      playId: String(item.playId ?? ''),
      name: String(item.name ?? ''),
      car: Number(item.car ?? 0),
      short: _handlers.shortOf(String(item.name ?? ''), groupName),
      odds: mxActions.ofOddsOf(String(item.name ?? ''))
    }))
    const oddsList = Array.from(new Set(items.map((item) => item.odds).filter((odds) => odds > 0)))
    return {
      groupName,
      columns,
      filled: Math.min(columns, items.length),
      // 官方盤的單選分頁每組賠率都相同（前一 9.6、定位膽 9.6），直接標一個值
      oddsSummary: oddsList.length === 1 ? `賠率[ ${oddsList[0]} ]` : '',
      rows: _handlers.toRowMatrix(items, columns)
    }
  })
})

/** 複式分頁展開後的注數與前幾注預覽 */
const comboPreview = computed(() => {
  const bets = ofComboBets.value
  return {
    count: bets.length,
    // 只預覽前 12 注，全部列出來（前三全選有 720 注）會把畫面撐爆
    sample: bets.slice(0, 12).map((cars) => mxActions.comboLabelOf(cars)),
    more: Math.max(0, bets.length - 12)
  }
})

/** 每個名次選了幾個車號（顯示在該列標題） */
const pickedCountOf = (pos: number) => (of.picks[pos] ?? []).length

const click = {
  /** 單選分頁：點注項切換選取 */
  cell: (code: string) => {
    if (!code) return
    mxActions.toggleOfItem(code)
  },
  coinInput: (code: string, event: Event) => {
    const target = event.target as HTMLInputElement
    const coin = Math.min(maxCoin.value, Math.max(0, Math.trunc(Number(target.value) || 0)))
    // 還沒選過就先建立一筆，再寫金額（0 視為取消）
    if (!of.items.some((item) => item.code === code)) mxActions.toggleOfItem(code)
    mxActions.setOfItemCoin(code, coin)
    target.value = coin > 0 ? String(coin) : ''
  },
  hoverEnter: (key: string) => { state.hoverKey = key },
  hoverLeave: () => { state.hoverKey = '' },
  /** 複式分頁：切換某名次的某個車號 */
  car: (pos: number, car: number) => mxActions.toggleOfPick(pos, car),
  carAll: (pos: number) => mxActions.toggleOfPickAll(pos)
}
</script>

<template>
  <div class="pk10-of-board">
    <!-- 該分頁限額（伺端以同一份 settings.quota 驗證） -->
    <div class="quota-bar">
      <span class="quota-item">單注 {{ money(minCoin) }} — {{ money(maxCoin) }}</span>
      <span v-if="ofQuota.issue.max > 0" class="quota-item">單期上限 {{ money(ofQuota.issue.max) }}</span>
      <span v-if="ofIsPool" class="quota-tag is-pool">彩池分層派彩</span>
      <span class="quota-note">
        {{ ofCombo ? '※ 每個名次至少選一個車號，注數 = 各名次選數相乘' : '※ 點注項即選取並套用投注金額，也可逐項改金額' }}
      </span>
    </div>

    <!-- ── 複式分頁（前二／前三直選）──────────────────────── -->
    <template v-if="ofCombo">
      <div v-for="group in ofComboGroups" :key="`pk10-of-pos-${group.pos}`" class="pick-row">
        <div class="pick-head">
          <span class="pick-label">{{ group.label }}</span>
          <span class="pick-count">已選 {{ pickedCountOf(group.pos) }}</span>
          <button type="button" class="pick-all" @click="click.carAll(group.pos)">
            {{ pickedCountOf(group.pos) === group.cars.length ? '清空' : '全選' }}
          </button>
        </div>
        <div class="pick-cars">
          <button v-for="car in group.cars" :key="`pos-${group.pos}-car-${car}`" type="button" class="pick-car"
            :class="{ active: _handlers.isCarPicked(group.pos, car) }" @click="click.car(group.pos, car)">
            <Car :car="car" size="md" />
          </button>
        </div>
      </div>

      <!-- 展開結果：注數 × 金額，以及前幾注的預覽 -->
      <div class="combo-sum">
        <div class="combo-line">
          <span>展開 <b>{{ comboPreview.count }}</b> 注</span>
          <span>× 每注 <b>{{ money(Number(mxState.amount) || 0) }}</b></span>
          <span>= 共 <b class="is-total">{{ money(ofTotalAmount) }}</b></span>
        </div>
        <div v-if="comboPreview.sample.length" class="combo-sample">
          <span v-for="(code, idx) in comboPreview.sample" :key="`sample-${idx}`" class="sample-tag">{{ code }}</span>
          <span v-if="comboPreview.more > 0" class="sample-more">…等 {{ comboPreview.more }} 注</span>
        </div>
        <p v-else class="combo-empty">尚未選滿 {{ ofCombo.positions }} 個名次</p>
      </div>

      <!-- 彩池分頁：沒有固定賠率，改標分層規則 -->
      <div v-if="ofIsPool" class="tier-note">
        <span class="tier-title">獎金分層</span>
        <span v-for="tier in ofPrizeTiers" :key="`tier-${tier.match}`" class="tier-item">
          命中 {{ tier.match }} 個名次 · {{ tier.name }}
          <b>{{ tier.type === 'pool' ? `獎池 ${Math.round(tier.ratio * 100)}%` : `${tier.amount} 倍` }}</b>
        </span>
      </div>
    </template>

    <!-- ── 單選分頁（前一直選／定位膽）─────────────────────── -->
    <template v-else>
      <div v-if="singleGroups.length === 0" class="empty">此分頁尚無注項</div>
      <div v-for="group in singleGroups" :key="`pk10-of-group-${group.groupName}`" class="play-group">
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
                  <span v-if="item && item.car > 0" class="car-set"><Car :car="item.car" size="md" /></span>
                  <button v-else-if="item" type="button" class="option is-pill">{{ item.short }}</button>
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
        已選 <b>{{ ofSelectedCount }}</b> 注 · 共 <b class="is-total">{{ money(ofTotalAmount) }}</b>
      </div>
    </template>
  </div>
</template>

<style scoped lang="scss">
.pk10-of-board {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;

  /* 分頁限額提示列（與信用盤同款） */
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

    .quota-tag.is-pool {
      border-radius: 999px;
      background: var(--color-red-main);
      padding: 2px 10px;
      font-weight: 700;
      color: #fff;
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

  /* ── 複式選號：一個名次一列 ─────────────────────────── */
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

    .pick-cars {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      padding: 10px;

      .pick-car {
        display: inline-flex;
        border: 2px solid transparent;
        border-radius: 50%;
        background: none;
        padding: 2px;
        cursor: pointer;
        /* 未選的球降低彩度，選中才跳出來 */
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
      }
    }
  }

  /* 複式展開結果 */
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

  /* 彩池分層規則（前三直選沒有固定賠率） */
  .tier-note {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 12px;
    border: 1px dashed var(--color-red-700);
    border-radius: 6px;
    padding: 7px 10px;
    font-size: 12px;
    color: var(--color-red-desc);

    .tier-title {
      font-weight: 700;
      color: var(--color-red-main);
    }

    .tier-item b {
      margin-left: 4px;
      font-weight: 800;
      color: #b45309;
    }
  }

  /* ── 單選分頁：與信用盤同款表格 ─────────────────────── */
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

  .car-set {
    display: inline-flex;
    justify-content: center;
    pointer-events: none;
  }

  .option {
    box-sizing: border-box;
    background: #fff;
    white-space: nowrap;
    pointer-events: none;

    &.is-pill {
      min-width: 44px;
      height: 30px;
      border-radius: 6px;
      border: 1px solid var(--color-red-700);
      padding: 0 10px;
      font-size: 14px;
      font-weight: 600;
      color: var(--color-red-main);
    }
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
