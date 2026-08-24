<script setup lang="ts">
import { computed, nextTick, reactive, watch, type ComponentPublicInstance } from 'vue'
import {
  kl8NumbersOf,
  kl8ParityZoneOf,
  kl8SumOf,
  kl8WuxingOf,
  kl8ZoneOf,
  KL8_HALF_LINE,
  KL8_SUM_BIG_LINE
} from '#shared/config/kl8'
import { useKl8 } from '~/composables/useKl8'

/**
 * 快樂8路珠（版面／邏輯比照 kl10 的 `block/Road.vue`）
 *
 * ⚠️ 與 kl10 的差異：快樂8的走勢有五個角度 ——
 *    總和大小（≥810 大）、總和單雙、上下盤／奇偶盤（10:10 時是「和盤」），
 *    以及看板獨有的五行（20 球總和落在等機率五等分區間）。
 *    上下盤／奇偶盤有第三種結果（和），五行有五種結果，故路珠比 kl10 多一組配色。
 */
const { openCodeHistory: mxHistory } = useKl8()

/** 走勢的五個角度（對應看板上方的分組） */
const DIMENSIONS = [
  { key: 'size', name: '總和大小' },
  { key: 'parity', name: '總和單雙' },
  { key: 'zone', name: '上下盤' },
  { key: 'parityZone', name: '奇偶盤' },
  { key: 'wuxing', name: '五行' }
] as const
type DimensionKey = (typeof DIMENSIONS)[number]['key']
type Outcome =
  | 'big' | 'small' | 'odd' | 'even' | 'up' | 'down' | 'oddZone' | 'evenZone' | 'tie'
  | 'metal' | 'wood' | 'water' | 'fire' | 'earth'

const LABELS: Record<Outcome, string> = {
  big: '大', small: '小', odd: '單', even: '雙',
  up: '上', down: '下', oddZone: '奇', evenZone: '偶', tie: '和',
  metal: '金', wood: '木', water: '水', fire: '火', earth: '土'
}
/** 大／單／上／奇走紅、小／雙／下／偶走藍、和盤走灰；五行各自一色（與 Header、開獎歷史同一套配色） */
const TONES: Record<Outcome, string> = {
  big: 'is-red', small: 'is-blue', odd: 'is-red', even: 'is-blue',
  up: 'is-red', down: 'is-blue', oddZone: 'is-red', evenZone: 'is-blue', tie: 'is-gray',
  metal: 'is-metal', wood: 'is-wood', water: 'is-water', fire: 'is-fire', earth: 'is-earth'
}

/**
 * 6 列（同 kl10）
 *
 * 欄數不再截斷 —— 全部走勢都畫出來，超出寬度就橫向捲動看更早的期數。
 * 欄數不足 MIN_COLS 時補空欄，整列寬度才會被填滿。
 */
const ROWS = 6
const MIN_COLS = 16

const state = reactive({
  dimension: 'size' as DimensionKey,
  gridRef: null as HTMLElement | null
})

const _handlers = {
  outcomeOf: (openCode: string[], dimension: DimensionKey): Outcome | null => {
    const nums = kl8NumbersOf(Array.isArray(openCode) ? openCode : [])
    if (!nums) return null
    if (dimension === 'size') return kl8SumOf(nums) >= KL8_SUM_BIG_LINE ? 'big' : 'small'
    if (dimension === 'parity') return kl8SumOf(nums) % 2 === 1 ? 'odd' : 'even'
    if (dimension === 'zone') {
      const zone = kl8ZoneOf(nums)
      return zone === '上盤' ? 'up' : zone === '下盤' ? 'down' : 'tie'
    }
    if (dimension === 'parityZone') {
      const parityZone = kl8ParityZoneOf(nums)
      return parityZone === '奇盤' ? 'oddZone' : parityZone === '偶盤' ? 'evenZone' : 'tie'
    }
    const wuxing = kl8WuxingOf(kl8SumOf(nums))
    return wuxing === '金' ? 'metal'
      : wuxing === '木' ? 'wood'
        : wuxing === '水' ? 'water'
          : wuxing === '火' ? 'fire' : 'earth'
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
  <section class="block-main kl8-road">
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

    <p class="road-note">
      ※ 總和 ≥{{ KL8_SUM_BIG_LINE }} 為大；上下盤比「1~{{ KL8_HALF_LINE }} 的個數」、
      奇偶盤比「奇數的個數」，10:10 為和；五行依 20 球總和分五段；往左拉可看更早的走勢
    </p>
  </section>
</template>

<style scoped lang="scss">
/* 卡片外框由全域 .lottery-kl8 .block-main 提供（同開獎歷史、當前注項） */
.kl8-road {
  min-width: 0;
  /* 與 kl10 的 .kl10-road 對齊高度——兩者都靠 align-items:stretch 撐開這一列，
     但 kl8 多一個「五行」分頁、格線內容較少，撐出來的自然高度比 kl10 矮，
     這裡固定同一個值，兩款遊戲的路單走勢卡片高度才會一致。 */
  min-height: 294px;
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

    .road-title {
      font-size: 14px;
      font-weight: 700;
      color: var(--color-red-main);
    }

    .road-tabs {
      display: inline-flex;
      flex-wrap: wrap;
      gap: 4px;

      .road-tab {
        border: 1px solid #f3b7bf;
        border-radius: 0.25rem;
        background: #fff5f6;
        padding: 3px 12px;
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
    background: #fffafa;
    overflow-x: auto;
    overflow-y: hidden;
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
      border-right: 1px solid #fbeaec;
      border-bottom: 1px solid #fbeaec;
      font-size: 13px;
      font-weight: 700;
      line-height: 1;

      &:not(.is-empty) {
        background: #fff;
      }

      &.is-red {
        color: var(--color-red-main);
      }

      &.is-blue {
        color: var(--text-blue);
      }

      /* 上下盤／奇偶盤 10:10 的「和」 */
      &.is-gray {
        color: var(--text-gray);
      }

      /* 五行五色 */
      &.is-metal {
        color: #b45309;
      }

      &.is-wood {
        color: #15803d;
      }

      &.is-water {
        color: #1d4ed8;
      }

      &.is-fire {
        color: #dc2626;
      }

      &.is-earth {
        color: #92400e;
      }
    }

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
