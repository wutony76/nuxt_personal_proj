<script setup lang="ts">
import { computed } from 'vue'
import Dice from '~/components/lottery/bg/k3/base/Dice.vue'
import Picker from '~/components/lottery/bg/k3/of/block/Picker.vue'
import { useK3 } from '~/composables/useK3'

/**
 * 快3 官方盤投注看板（賠率制 + 彩池玩法）
 *
 * 玩法結構參照 pcv2_0223 的 conf_k3_og.js：
 *   和值 / 三同號 / 三不同號 / 三連號 / 二同號 / 二不同號 ＋ 原本的「選號（彩池）」
 *
 * 三種分頁型態，用同一個版面呈現（表格與樣式沿用 6hc-cd 的 .play-table）：
 *   單選　—— 一格一注碼（和值、三同號、三連號、二同號），填金額即選取
 *   標準　—— 從 1~6 選 pick 個以上點數，注碼由 C(n, pick) 展開（三不同號、二不同號）
 *   膽拖　—— 膽碼必含、拖碼補滿 pick 個，注碼由 C(拖, pick−膽) 展開
 *   彩池　—— 切到「選號（彩池）」時直接用 of/block/Picker.vue（獎池分層派彩）
 *
 * ⚠️ 賠率一律用 k3OfTabOddsOf 依該分頁 rtp 即時推算，不讀 config 的 odds 快照。
 */
const {
  state: mxState,
  of: mxOf,
  ofTabList,
  ofGroups,
  ofCombo,
  ofQuota,
  ofComboCodes,
  isOfPool,
  actions: mxActions
} = useK3()

const money = (value: number) => Number(value ?? 0).toLocaleString('zh-TW')

const minCoin = computed(() => ofQuota.value.item.min)
const maxCoin = computed(() => ofQuota.value.item.max)

/**
 * 組合分頁的每注賠率
 *
 * 組合分頁沒有固定注項清單，用「1 ~ pick」這組樣本注碼問賠率 ——
 * 同一個分頁的每一注機率都相同（三不同號皆 6/216、二不同號皆 30/216），
 * 所以任一組合的賠率都能代表整個分頁。
 */
const comboOdds = computed(() => {
  const combo = ofCombo.value
  if (!combo) return 0
  const sample = Array.from({ length: combo.pick }, (_, idx) => idx + 1).join('')
  return mxActions.ofOddsOf(`${combo.prefix}${sample}`)
})

/** 單選分頁：把群組整理成 .play-table 要的矩陣（一列 columns 組） */
const tableGroups = computed(() => (ofGroups.value as any[]).map((group) => {
  const list = (group.groupList ?? []) as Array<{ playId?: string; name?: string; nums?: number[] }>
  const columns = Number(group.columns) > 0 ? Number(group.columns) : Math.min(6, Math.max(1, list.length))
  const rows = Array.from({ length: Math.ceil(list.length / columns) }, (_, row) =>
    Array.from({ length: columns }, (_, col) => list[row * columns + col] ?? null)
  )
  // 組合分頁的 groupList 是「可選點數」不是注碼，賠率要拿一組樣本注碼去問
  // （同一個組合分頁的每一注賠率都一樣）
  const odds = ofCombo.value
    ? [comboOdds.value].filter((value) => value > 0)
    : list.map((item) => mxActions.ofOddsOf(String(item?.name ?? ''))).filter((value) => value > 0)
  const distinct = Array.from(new Set(odds))
  return {
    groupName: String(group.groupName ?? ''),
    groupTag: (group.groupTag ?? '') as '' | 'dan' | 'tuo',
    columns,
    filled: Math.min(columns, list.length),
    // 整組同賠率顯示單一值，否則顯示區間（同 6hc-cd 的群組標題）
    oddsSummary: distinct.length === 0
      ? ''
      : distinct.length === 1
        ? `賠率[ ${distinct[0]} ]`
        : `賠率 ${Math.min(...distinct)} — ${Math.max(...distinct)}`,
    rows
  }
}))

const _handlers = {
  /** 該注碼已選的金額（未選回 0） */
  coinOf: (code: string) => Number(mxOf.items.find((item) => item.code === code)?.coin ?? 0),
  isSelected: (code: string) => mxOf.items.some((item) => item.code === code),
  /** 組合分頁：該點數是否已選（依 bucket） */
  isPicked: (bucket: 'nums' | 'dan' | 'tuo', point: number) => mxOf[bucket].includes(point),
  /** 注項名稱要不要畫骰子（三同號／二同號的 nums 是骰子點） */
  diceOf: (item: { nums?: number[] } | null) => (item?.nums?.length ? item.nums : null)
}

const click = {
  toggleItem: (code: string) => mxActions.toggleOfItem(code),
  coinInput: (code: string, event: Event) => {
    const target = event.target as HTMLInputElement
    const coin = Math.min(maxCoin.value, Math.max(0, Math.trunc(Number(target.value) || 0)))
    mxActions.setOfItemCoin(code, coin)
    target.value = coin > 0 ? String(coin) : ''
  },
  point: (bucket: 'nums' | 'dan' | 'tuo', point: number) => mxActions.toggleOfPoint(bucket, point)
}

/** 組合分頁的提示文字（幾注、規則） */
const comboHint = computed(() => {
  const combo = ofCombo.value
  if (!combo) return ''
  const count = ofComboCodes.value.length
  if (combo.mode === 'dantuo') {
    return `膽碼 ${mxOf.dan.length}／${combo.maxDan ?? combo.pick - 1} 個 · 拖碼 ${mxOf.tuo.length} 個 → ${count} 注`
  }
  return `已選 ${mxOf.nums.length} 個點數（至少 ${combo.pick} 個）→ ${count} 注`
})
</script>

<template>
  <!-- 彩池玩法：沿用原本的選號器（獎池分層派彩） -->
  <Picker v-if="isOfPool" />

  <div v-else class="k3-of-board">
    <!-- 分頁（通選／單選、標準／膽拖）；只有一個分頁時不顯示 -->
    <div v-if="ofTabList.length > 1" class="of-tabs">
      <button v-for="tab in ofTabList" :key="tab.tabId" type="button" class="of-tab"
        :class="{ active: Number(mxOf.tabId) === Number(tab.tabId) }" @click="mxActions.setOfTab(Number(tab.tabId))">
        {{ tab.tabName }}
      </button>
    </div>

    <div class="quota-bar">
      <span class="quota-item">單注 {{ money(minCoin) }} — {{ money(maxCoin) }}</span>
      <span v-if="ofQuota.issue.max > 0" class="quota-item">單期上限 {{ money(ofQuota.issue.max) }}</span>
      <span class="quota-note">
        {{ ofCombo ? '※ 選點數後自動組成注碼，每注套用投注金額' : '※ 點注項即選取並套用投注金額，也可逐項改金額' }}
      </span>
    </div>

    <!-- ── 組合分頁：從 1~6 選點數 ── -->
    <template v-if="ofCombo">
      <div v-for="group in tableGroups" :key="`of-combo-${group.groupName}`" class="play-group">
        <div class="group-title">
          {{ group.groupName }}
          <span v-if="group.oddsSummary" class="group-odds">{{ group.oddsSummary }}</span>
        </div>
        <div class="point-row">
          <button v-for="point in 6" :key="`p-${group.groupTag}-${point}`" type="button" class="point-btn" :class="{
            active: _handlers.isPicked(group.groupTag || 'nums', point)
          }" @click="click.point(group.groupTag || 'nums', point)">
            <Dice :num="point" size="sm" />
          </button>
        </div>
      </div>

      <div class="combo-foot">
        <span class="combo-hint">{{ comboHint }}</span>
        <span v-if="ofComboCodes.length > 0" class="combo-codes">{{ ofComboCodes.join('、') }}</span>
      </div>
    </template>

    <!-- ── 單選分頁：一格一注碼 ── -->
    <div v-for="group in tableGroups" v-else :key="`of-${group.groupName}`" class="play-group">
      <div class="group-title">
        {{ group.groupName }}
        <span v-if="group.oddsSummary" class="group-odds">{{ group.oddsSummary }}</span>
      </div>

      <!-- ⚠️ 一定要寫出 tbody：瀏覽器會自動補，SSR 少寫會與 hydration 後對不上 -->
      <table class="play-table">
        <thead>
          <tr>
            <template v-for="col in group.columns" :key="`h-${group.groupName}-${col}`">
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
          <tr v-for="(row, rowIdx) in group.rows" :key="`r-${group.groupName}-${rowIdx}`">
            <template v-for="(item, colIdx) in row" :key="`c-${group.groupName}-${rowIdx}-${colIdx}`">
              <td class="td-code" :class="{
                active: item && _handlers.isSelected(String(item.name)),
                clickable: !!item,
                'is-empty': !item
              }" @click="item && click.toggleItem(String(item.name))">
                <span v-if="_handlers.diceOf(item)" class="dice-set">
                  <Dice v-for="(num, dIdx) in _handlers.diceOf(item)" :key="dIdx" :num="num" size="sm" />
                </span>
                <button v-else-if="item" type="button" class="option">{{ item.name }}</button>
              </td>
              <td class="td-amount" :class="{
                active: item && _handlers.isSelected(String(item.name)),
                'is-empty': !item
              }">
                <input v-if="item" type="number" min="0" :max="maxCoin" :value="_handlers.coinOf(String(item.name)) || ''"
                  placeholder="0" @click.stop @input="click.coinInput(String(item.name), $event)" />
              </td>
            </template>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped lang="scss">
/* 表格與選項樣式沿用 6hc-cd 的 .play-table（同 K3Board） */
.k3-of-board {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;

  .of-tabs {
    display: inline-flex;
    gap: 4px;

    .of-tab {
      border: 1px solid var(--color-red-content);
      border-radius: 4px;
      background: #fff;
      padding: 3px 14px;
      font-size: 13px;
      font-weight: 700;
      color: var(--color-red-main);
      cursor: pointer;

      &.active {
        border-color: var(--color-red-main);
        background: var(--color-red-main);
        color: #fff;
      }
    }
  }

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
  }

  /* ── 組合分頁：1~6 的點數選鈕 ── */
  .point-row {
    display: flex;
    justify-content: center;
    gap: 10px;

    .point-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: 1px solid var(--color-red-content);
      border-radius: 6px;
      background: #fff;
      padding: 6px;
      cursor: pointer;
      transition: all 0.15s ease;

      &:hover:not(.active) {
        background: #fff1f2;
      }

      &.active {
        border-color: var(--color-red-main);
        background: var(--color-yellow-text);
      }
    }
  }

  .combo-foot {
    display: flex;
    align-items: baseline;
    gap: 10px;
    border-top: 1px dashed var(--color-red-content);
    padding-top: 8px;
    font-size: 12px;

    .combo-hint {
      flex: 0 0 auto;
      font-weight: 700;
      color: var(--color-red-main);
    }

    .combo-codes {
      min-width: 0;
      color: var(--color-red-desc);
      overflow-wrap: anywhere;
    }
  }

  /* ── 單選分頁的表格（同 6hc-cd 的 .play-table）── */
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

    /* 沒有注項的欄位不畫框也不上底色，但欄位保留以維持對齊 */
    .is-empty {
      border-color: transparent;
      background: transparent;
    }

    .td-code {
      padding: 6px 4px;

      &.clickable {
        cursor: pointer;
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
        transition: border-color 0.15s ease, box-shadow 0.15s ease;

        &:focus {
          border-color: var(--color-red-main);
          box-shadow: 0 0 0 2px rgba(213, 63, 83, 0.12);
        }
      }
    }

    .td-code.active,
    .td-amount.active {
      background: var(--color-yellow-text);
    }

    .td-amount.active input {
      border-color: var(--color-red-main);
      color: var(--color-red-main);
    }

    .dice-set {
      display: inline-flex;
      justify-content: center;
      gap: 3px;
      pointer-events: none;
    }

    .option {
      box-sizing: border-box;
      min-width: 52px;
      height: 30px;
      border: 1px solid var(--color-red-700);
      border-radius: 6px;
      background: #fff;
      padding: 0 12px;
      white-space: nowrap;
      font-size: 14px;
      font-weight: 600;
      color: var(--color-red-main);
      /* 點擊交給整格 td */
      pointer-events: none;
    }
  }
}
</style>
