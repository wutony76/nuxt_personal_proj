<script setup lang="ts">
import { computed, nextTick, reactive, watch, type ComponentPublicInstance } from 'vue'
import { EGGS_BIG_LINE } from '#shared/config/eggs'
import { useEggs } from '~/composables/useEggs'

/**
 * PC蛋蛋路珠（版面／邏輯比照 `k3/block/Road.vue`）
 *
 * ⚠️ 與 k3 的差異：k3 三顆骰同點算圍骰（另計「和」），
 *    PC蛋蛋 3 球和值範圍 0~27、大小分界 >13 為大，沒有圍骰或和局的概念，
 *    所以這裡只有大小／單雙兩種結果，沒有 tie。
 */
const { openCodeHistory: mxHistory, actions: mxActions } = useEggs()

/** 走勢的兩種角度（對應截圖上方的兩個分頁） */
const DIMENSIONS = [
  { key: 'size', name: '大小' },
  { key: 'parity', name: '單雙' }
] as const
type DimensionKey = (typeof DIMENSIONS)[number]['key']
type Outcome = 'big' | 'small' | 'odd' | 'even'

const LABELS: Record<Outcome, string> = { big: '大', small: '小', odd: '單', even: '雙' }
/** 大／單走紅、小／雙走藍（與 Header、開獎歷史同一套配色） */
const TONES: Record<Outcome, string> = { big: 'is-red', small: 'is-blue', odd: 'is-red', even: 'is-blue' }

/**
 * 6 列（同 k3）
 *
 * 欄數不再截斷 —— 全部走勢都畫出來，超出寬度就橫向捲動看更早的期數。
 * 欄數不足 MIN_COLS 時補空欄，整列寬度才會被填滿。
 * 每欄至少 CELL_PX，配合 1fr：欄少時撐滿容器、欄多時維持寬度並出現捲軸。
 */
const ROWS = 6
const MIN_COLS = 16

const state = reactive({
  dimension: 'size' as DimensionKey,
  gridRef: null as HTMLElement | null
})

const _handlers = {
  outcomeOf: (openCode: string[], dimension: DimensionKey): Outcome | null => {
    const digits = (Array.isArray(openCode) ? openCode : []).map(Number)
    if (digits.length !== 3 || digits.some((num) => !Number.isFinite(num) || num < 0)) return null
    const sum = mxActions.sumOf(openCode)
    if (dimension === 'size') return sum > EGGS_BIG_LINE ? 'big' : 'small'
    return sum % 2 === 1 ? 'odd' : 'even'
  },

  /**
   * 大路排列
   *
   * 與前一顆相同 → 往下疊；下方到底或被佔用 → 沿同一列往右（長龍拐彎）。
   * 與前一顆不同 → 跳到目前最右欄的下一欄，從第一列開始。
   */
  build: (outcomes: Outcome[]) => {
    const grid = new Map<string, Outcome>()
    let col = 0
    let row = 0
    let maxCol = 0
    let prev: Outcome | null = null

    outcomes.forEach((outcome, index) => {
      if (index === 0) {
        col = 0
        row = 0
      } else if (outcome === prev) {
        if (row + 1 < ROWS && !grid.has(`${row + 1}-${col}`)) row += 1
        else col += 1
      } else {
        col = maxCol + 1
        row = 0
      }
      grid.set(`${row}-${col}`, outcome)
      maxCol = Math.max(maxCol, col)
      prev = outcome
    })
    return { grid, usedCols: maxCol + 1 }
  }
}

const board = computed(() => {
  // 開獎歷史是新到舊，走勢要由舊到新排
  const outcomes = [...mxHistory.list]
    .reverse()
    .map((item) => _handlers.outcomeOf(item.openCode as string[], state.dimension))
    .filter((outcome): outcome is Outcome => outcome !== null)

  const { grid, usedCols } = _handlers.build(outcomes)
  const cols = Math.max(usedCols, MIN_COLS)
  return {
    cols,
    cells: Array.from({ length: ROWS }, (_, row) =>
      Array.from({ length: cols }, (_, col) => grid.get(`${row}-${col}`) ?? null)
    )
  }
})

const hasData = computed(() => board.value.cells.some((row) => row.some(Boolean)))

const _scroll = {
  /** 捲到最右邊（最新一期）；要看更早的往左拉 */
  toLatest: () => {
    const el = state.gridRef
    if (el) el.scrollLeft = el.scrollWidth
  }
}

if (import.meta.client) {
  watch([() => board.value.cols, () => state.dimension], () => {
    nextTick(_scroll.toLatest)
  }, { immediate: true })
}

const click = {
  dimension: (key: DimensionKey) => { state.dimension = key },
  setGridRef: (el: Element | ComponentPublicInstance | null) => {
    state.gridRef = el as HTMLElement | null
    nextTick(_scroll.toLatest)
  }
}
</script>

<template>
  <section class="block-main eggs-road">
    <div class="road-head">
      <span class="road-title">路單走勢</span>
      <div class="road-tabs">
        <button v-for="dim in DIMENSIONS" :key="dim.key" type="button" class="road-tab"
          :class="{ active: state.dimension === dim.key }" @click="click.dimension(dim.key)">
          {{ dim.name }}
        </button>
      </div>
    </div>

    <div :ref="click.setGridRef" class="road-grid" :style="{ '--cols': board.cols, '--rows': ROWS }">
      <!-- 空格也要畫出來，整列寬度才會被填滿 -->
      <span v-for="(outcome, idx) in board.cells.flat()" :key="`road-${idx}`" class="road-cell"
        :class="outcome ? TONES[outcome] : 'is-empty'">
        {{ outcome ? LABELS[outcome] : '' }}
      </span>
      <div v-if="!hasData" class="road-empty">{{ mxHistory.isLoading ? '載入中…' : '暫無資料' }}</div>
    </div>

    <p class="road-note">※ 和值 &gt;13 為大、≤13 為小；往左拉可看更早的走勢</p>
  </section>
</template>

<style scoped lang="scss">
/* 卡片外框由全域 .lottery-eggs .block-main 提供（同開獎歷史、當前注項） */
.eggs-road {
  min-width: 0;
  display: flex;
  flex-direction: column;
  background: #fff;

  .road-head {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 8px;

    /* 與開獎歷史的 .hist-title 同字級同色 */
    .road-title {
      font-size: 14px;
      font-weight: 700;
      color: var(--color-red-main);
    }

    .road-tabs {
      display: inline-flex;
      gap: 4px;

      .road-tab {
        border: 1px solid #f3b7bf;
        border-radius: 0.25rem;
        background: #fff5f6;
        padding: 3px 14px;
        font-size: 12px;
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
  }

  .road-grid {
    position: relative;
    flex: 1 1 auto;
    min-height: 0;
    display: grid;
    /* 每欄至少 --cell：欄少時 1fr 撐滿容器、欄多時維持寬度並橫向捲動 */
    grid-template-columns: repeat(var(--cols, 16), minmax(var(--cell, 34px), 1fr));
    grid-template-rows: repeat(var(--rows, 6), minmax(0, 1fr));
    border: 1px solid var(--color-red-content);
    border-radius: 6px;
    /* 與開獎歷史的期數卡同一個淺底 */
    background: #fffafa;
    overflow-x: auto;
    overflow-y: hidden;
    /* 捲軸與開獎歷史、當前注項一致 */
    scrollbar-width: thin;
    scrollbar-color: var(--color-red-desc) #e8e6e6;

    &::-webkit-scrollbar {
      width: 8px;
      height: 8px;
    }

    &::-webkit-scrollbar-track {
      background: #ffc6c6;
      border-radius: 999px;
    }

    &::-webkit-scrollbar-thumb {
      background: #f54c07;
      border-radius: 999px;
      border: 2px solid #ffc6c6;
    }

    &::-webkit-scrollbar-thumb:hover {
      background: #de4304;
    }

    .road-cell {
      display: flex;
      align-items: center;
      justify-content: center;
      /* 只畫右／下，最外緣交給 .road-grid 的框 */
      border-right: 1px solid #fbeaec;
      border-bottom: 1px solid #fbeaec;
      font-size: 13px;
      font-weight: 700;
      line-height: 1;

      /* 有結果的格子給一點白底，讓走勢從淺底上浮出來 */
      &:not(.is-empty) {
        background: #fff;
      }

      &.is-red {
        color: var(--color-red-main);
      }

      &.is-blue {
        color: var(--text-blue);
      }
    }

    /* 沒有資料時整塊反灰 */
    .road-empty {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f7f7f7;
      font-size: 12px;
      font-weight: 700;
      color: var(--text-gray);
    }
  }

  .road-note {
    flex: 0 0 auto;
    margin: 8px 0 0;
    font-size: 11px;
    color: var(--color-red-desc);
  }
}
</style>
