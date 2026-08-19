<script setup lang="ts">
import { computed, nextTick, reactive, watch, type ComponentPublicInstance } from 'vue'
import { x5DragonOf, x5NumbersOf, X5_BIG_LINE, X5_SUM_BIG_LINE, X5_SUM_TAIL_BIG_LINE } from '#shared/config/x5'
import { useX5 } from '~/composables/useX5'

/**
 * 11選5 路珠
 *
 * 版面：與同一列的「近五期開獎」用同一張卡片（.block-main：白底、紅框、0.75rem 內距），
 * 標題與分頁沿用那邊的字級與色票，並排時才不會有一塊深色特別跳。
 * 內容是常見的大路走勢 —— 連續同一結果往下疊成一直行，結果一變就換下一行；
 * 疊滿 ROWS 顆（長龍）就沿著同一列往右延伸。
 *
 * ⚠️ 與 ssc 最大的不同：11選5 一期開 5 個**不重複**號碼，
 *    所以龍虎**不會出現和局** —— 那一軸只有龍／虎兩種結果（ssc 有三種）。
 *    走勢的角度也照來源 bglottery `common/roadMap.vue` 的 11選5 那一段：
 *    大小／單雙 × 各球位與總和、龍虎 10 組球對；本元件取其中最常看的幾個角度。
 */
const { openCodeHistory: mxHistory, actions: mxActions } = useX5()

/** 走勢的五種角度（總和三組面 + 第一球大小 + 一二球龍虎） */
const DIMENSIONS = [
  { key: 'sumSize', name: '總和大小' },
  { key: 'sumParity', name: '總和單雙' },
  { key: 'sumTail', name: '總和尾大小' },
  { key: 'ballSize', name: '第一球大小' },
  { key: 'dragon', name: '一二球龍虎' }
] as const
type DimensionKey = (typeof DIMENSIONS)[number]['key']
type Outcome = 'big' | 'small' | 'odd' | 'even' | 'tailBig' | 'tailSmall' | 'dragon' | 'tiger'

const LABELS: Record<Outcome, string> = {
  big: '大', small: '小', odd: '單', even: '雙',
  tailBig: '尾大', tailSmall: '尾小', dragon: '龍', tiger: '虎'
}
/** 大／單／尾大／龍走紅，小／雙／尾小／虎走藍（與 Header、開獎歷史同一套配色） */
const TONES: Record<Outcome, string> = {
  big: 'is-red', small: 'is-blue', odd: 'is-red', even: 'is-blue',
  tailBig: 'is-red', tailSmall: 'is-blue', dragon: 'is-red', tiger: 'is-blue'
}

/**
 * 6 列（同 k3）
 *
 * 欄數不截斷 —— 全部走勢都畫出來，超出寬度就橫向捲動看更早的期數。
 * 欄數不足 MIN_COLS 時補空欄，整列寬度才會被填滿。
 */
const ROWS = 6
const MIN_COLS = 16

const state = reactive({
  dimension: 'sumSize' as DimensionKey,
  gridRef: null as HTMLElement | null
})

const _handlers = {
  outcomeOf: (openCode: string[], dimension: DimensionKey): Outcome | null => {
    // 格式（5 個、1~11、不重複）一律由 x5NumbersOf 判掉，後面不用再各自防
    const nums = x5NumbersOf(Array.isArray(openCode) ? openCode : [])
    if (!nums) return null
    if (dimension === 'sumSize' || dimension === 'sumParity' || dimension === 'sumTail') {
      const sum = mxActions.sumOf(openCode)
      if (dimension === 'sumSize') return sum >= X5_SUM_BIG_LINE ? 'big' : 'small'
      if (dimension === 'sumParity') return sum % 2 === 1 ? 'odd' : 'even'
      return sum % 10 >= X5_SUM_TAIL_BIG_LINE ? 'tailBig' : 'tailSmall'
    }
    if (dimension === 'ballSize') return Number(nums[0]) >= X5_BIG_LINE ? 'big' : 'small'
    // 一二球龍虎：第一球對第二球。⚠️ 五碼不重複 → 不可能相等，只有龍／虎兩種
    const result = x5DragonOf(nums, 0, 1)
    if (!result) return null
    return result === '龍' ? 'dragon' : 'tiger'
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
  <section class="block-main x5-road">
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

    <p class="road-note">※ 11選5 五碼不重複，龍虎沒有「和」；往左拉可看更早的走勢</p>
  </section>
</template>

<style scoped lang="scss">
/* 卡片外框由全域 .lottery-x5 .block-main 提供（同開獎歷史、當前注項） */
.x5-road {
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

      /* 與 6hc-of 的 .bar-tabs-btn 同一套 */
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
      /* ⚠️ 比 ssc 小一級：尾大／尾小是兩個字，13px 會擠出格子 */
      font-size: 12px;
      white-space: nowrap;
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
