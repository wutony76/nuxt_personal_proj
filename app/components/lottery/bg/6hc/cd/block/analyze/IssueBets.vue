<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import Ball from '~/components/lottery/bg/6hc/cd/base/Ball.vue'
import BarControls from '~/components/lottery/bg/6hc/cd/block/analyze/BarControls.vue'
import BarDimensions from '~/components/lottery/bg/6hc/cd/block/analyze/BarDimensions.vue'
import { SORT } from '~/config/constants'
import { use6hcCredit } from '~/composables/use6hcCredit'
import { creditAnalyzeAggregate, creditAnalyzeGroupsOf, CREDIT_ANALYZE_DIMENSIONS } from '#shared/config/cd/analyze'

type AnalyzeBall = {
  num?: number | string
  label?: string
  countIssue: number
  countShow: number
  countBets: number
  selected: boolean
  hasBet: boolean
}
type AnalyzeGroup = {
  name: string
  value: number
  /** 該群組涵蓋的號碼球（號碼數超過 MAX_SHOWN_NUMS 就不列，如「大」有 25 個號） */
  balls: AnalyzeBall[]
  numCount: number
}

// 系統統計模式（球下方顯示 road 統計，灰階依「本期有無下注」判斷）
const SYSTEM_MODES: string[] = [SORT.OPEN_COUNT_SYSTEM, SORT.GAP_ISSUE_SYSTEM]
// 群組卡片最多列出幾個號碼球（五行 8~12、生肖 4~5、尾數 4~5 都列得下；
// 大小／單雙／兩面每組 24~25 個，列出來會擠爆版面且本來就是人人皆知的範圍，故只顯示數量）
const MAX_SHOWN_NUMS = 12

const { road: mxRoad, current: mxCurrent, analyze: mxAnalyze } = use6hcCredit()

const state = reactive({
  playList: [] as AnalyzeBall[],
  groupList: [] as AnalyzeGroup[],
})

// --- HANDLE ---
const _handlers = {
  // 當期注單各號碼的下注次數（注項文字非數字者略過，如 紅波 / 特大）
  betCountMap: () => {
    const map = new Map<number, number>()
    mxCurrent.detail.forEach((detail) => {
      const bets = Array.isArray(detail?.bets) ? detail.bets : []
      bets.forEach((bet) => {
        const num = Number(bet)
        if (!Number.isFinite(num)) return
        map.set(num, (map.get(num) ?? 0) + 1)
      })
    })
    return map
  },
  // 依模式決定球下方顯示的數字
  countBy: (play: { countShow?: number; countIssue?: number }, betCount: number) => {
    switch (mxAnalyze.status) {
      case SORT.OPEN_COUNT_SYSTEM: return Number(play.countShow ?? 0)
      case SORT.GAP_ISSUE_SYSTEM: return Number(play.countIssue ?? 0)
      default: return betCount
    }
  },
  ballOf: (play: { num?: number | string; label?: string }, count: number, hasBet: boolean) => ({
    num: play.num,
    label: String(play.label ?? play.num ?? ''),
    // 球本體只顯示一列數字（countBets），統計欄位一律關閉
    countIssue: -1,
    countShow: -1,
    countBets: count,
    selected: true,
    hasBet,
  } satisfies AnalyzeBall),
  // 依顯示數字由多到少排序（同值時號碼小的在前）
  sortByCount: (list: AnalyzeBall[]) => list.sort((a, b) => {
    const diff = b.countBets - a.countBets
    return diff !== 0 ? diff : Number(a.num) - Number(b.num)
  }),
  build: () => {
    const betCountMap = _handlers.betCountMap()
    const list = mxRoad.plays.map((play) => {
      const betCount = Number(betCountMap.get(Number(play.num)) ?? 0)
      return _handlers.ballOf(play, _handlers.countBy(play, betCount), betCount > 0)
    })
    // 預設依號碼排序，其餘模式依顯示數字由多到少
    if (mxAnalyze.status === SORT.DEFAULT) list.sort((a, b) => Number(a.num) - Number(b.num))
    else _handlers.sortByCount(list)
    state.playList = list
    state.groupList = _handlers.buildGroups(list)
  },
  /**
   * 群組檢視：把各號碼的統計聚合到群組上
   * 相隔期數用 min（群組上次出現 = 組內最近出現的那個號碼），其餘用 sum
   */
  buildGroups: (balls: AnalyzeBall[]) => {
    if (mxAnalyze.dimension === 'number') return []
    const issue = String(mxCurrent.runtime?.issueCurrent ?? '')
    // 生肖／五行號碼表逐年輪轉，一律以該期年份為準
    const year = Number(issue.slice(0, 4)) || new Date().getFullYear()
    const groups = creditAnalyzeGroupsOf(mxAnalyze.dimension, year)
    const byNum = new Map(balls.map((ball) => [Number(ball.num), ball]))
    const mode = mxAnalyze.status === SORT.GAP_ISSUE_SYSTEM ? 'min' : 'sum'
    const rows = creditAnalyzeAggregate(groups, (num) => Number(byNum.get(num)?.countBets ?? 0), mode)
      .map((row) => ({
        name: row.name,
        value: row.value,
        numCount: row.nums.length,
        balls: row.nums.length <= MAX_SHOWN_NUMS
          ? row.nums.map((code) => byNum.get(Number(code))).filter((ball): ball is AnalyzeBall => Boolean(ball))
          : [],
      } satisfies AnalyzeGroup))
    // 預設維持該角度的原始順序（大小、生肖…都有慣用排列），其餘依統計值由多到少
    if (mxAnalyze.status === SORT.DEFAULT) return rows
    return rows.sort((a, b) => b.value - a.value)
  },
  // 灰階：系統模式看本期是否下注，其餘看顯示數字是否為 0
  isZero: (play: AnalyzeBall) => (SYSTEM_MODES.includes(mxAnalyze.status) ? !play.hasBet : play.countBets === 0),
}

// --- COMPUTED ---
const isNumberView = computed(() => mxAnalyze.dimension === 'number')
const hasData = computed(() => (isNumberView.value ? state.playList.length > 0 : state.groupList.length > 0))
const dimensionLabel = computed(() =>
  CREDIT_ANALYZE_DIMENSIONS.find((item) => item.key === mxAnalyze.dimension)?.label ?? '號碼'
)
// 統計值的意義（群組卡片的數字要標清楚是哪一種，不然 min / sum 混在一起會看不懂）
const valueHint = computed(() => {
  switch (mxAnalyze.status) {
    case SORT.OPEN_COUNT_SYSTEM: return '攪出次數合計'
    case SORT.GAP_ISSUE_SYSTEM: return '最近相隔期數'
    default: return '本期下注次數合計'
  }
})

// --- WATCH ---
watch(
  [() => mxAnalyze.status, () => mxAnalyze.dimension, () => mxRoad.plays, () => mxCurrent.detail],
  () => { _handlers.build() },
  { deep: true, immediate: true }
)
</script>

<template>
  <div class="block-main analyze-issue-bets">
    <!-- 分析角度：號碼 / 大小 / 單雙 / 兩面 / 五行 / 生肖 / 尾數 -->
    <BarDimensions v-model="mxAnalyze.dimension" />
    <div class="header">
      注號分析
      <!-- 統計種類說明只在群組檢視顯示：卡片上的數字有「合計 / 取最小」兩種語意需要標明，
           號碼檢視的球下方數字一目瞭然，且這行會把 header 擠成兩行、吃掉一列球的高度 -->
      <span v-if="!isNumberView" class="value-hint">{{ dimensionLabel }} · {{ valueHint }}</span>
      <BarControls v-model="mxAnalyze.status" />
    </div>
    <div v-if="!hasData" class="empty">尚無球號資料</div>
    <!-- 號碼角度：49 顆球各自的統計 -->
    <div v-else-if="isNumberView" class="grid">
      <div v-for="play in state.playList" :key="String(play.num)" class="ball-cell"
        :class="{ 'is-zero': _handlers.isZero(play) }">
        <Ball :data="play" :is-click="false" />
      </div>
    </div>
    <!-- 其餘角度：群組卡片（名稱 + 聚合統計 + 該組號碼） -->
    <div v-else class="group-grid">
      <div v-for="group in state.groupList" :key="group.name" class="group-card"
        :class="{ 'is-zero': group.value === 0 }">
        <div class="group-head">
          <span class="group-name">{{ group.name }}</span>
          <span class="group-value">{{ group.value }}</span>
        </div>
        <div v-if="group.balls.length > 0" class="group-balls">
          <div v-for="play in group.balls" :key="`${group.name}-${play.num}`" class="ball-cell"
            :class="{ 'is-zero': _handlers.isZero(play) }">
            <Ball :data="play" :is-click="false" />
          </div>
        </div>
        <span v-else class="group-count">共 {{ group.numCount }} 個號碼</span>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
/* 捲軸樣式：與「當期注單」（ReportIssueBets .main）完全一致。
   本檔有號碼／群組兩個捲動容器要共用，故在檔案內收成 mixin。 */
@mixin cd-analyze-scrollbar {
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
}

.analyze-issue-bets {
  flex: 1 1 auto;
  min-height: 0;
  width: 100%;
  background: var(--color-red-sub);
  display: flex;
  flex-direction: column;

  .header {
    flex: 0 0 auto;
    margin: 6px 0 7px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    flex-wrap: wrap;
    font-size: 14px;
    font-weight: 700;
    color: var(--color-red-main);

    /* 標清楚群組卡片上的數字是哪一種統計（合計 / 取最小 意義不同） */
    .value-hint {
      margin-right: auto;
      font-size: 12px;
      font-weight: 600;
      color: var(--color-red-desc);
    }
  }

  .empty {
    flex: 1 1 auto;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    font-weight: 700;
    color: var(--color-red-desc);
  }

  /* 群組檢視（大小 / 單雙 / 兩面 / 五行 / 生肖 / 尾數） */
  .group-grid {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 0.4rem;
    align-content: start;
    @include cd-analyze-scrollbar;

    .group-card {
      border: 1px solid #f3b7bf;
      border-radius: var(--base-radius);
      background: #fff;
      padding: 6px 8px;
      display: flex;
      flex-direction: column;
      gap: 5px;

      .group-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 6px;

        .group-name {
          font-size: 14px;
          font-weight: 700;
          color: var(--color-red-main);
        }

        .group-value {
          border-radius: 0.25rem;
          background: var(--color-red-main);
          padding: 1px 8px;
          font-size: 13px;
          font-weight: 700;
          color: #fff;
        }
      }

      .group-balls {
        display: flex;
        flex-wrap: wrap;
        gap: 0.25rem;
      }

      .group-count {
        font-size: 12px;
        font-weight: 600;
        color: var(--color-red-desc);
      }

      /* 統計為 0：整張卡片淡出（與號碼檢視的灰階一致） */
      &.is-zero {
        opacity: 0.5;

        .group-head .group-value {
          background: #bcbcbc;
        }
      }

      :deep(.ball) {
        width: 1.9rem;
        height: 1.9rem;
        background: #fff;
        font-size: 1rem;
        cursor: default;

        &.selected {
          border-width: 0.2rem;
        }
      }

      :deep(.count-wrap) {
        margin-top: unset;

        .count {
          font-size: 10px;
        }
      }

      /* 群組內的號碼球：本期未下注（或數字為 0）灰階 */
      .ball-cell.is-zero {
        :deep(.ball) {
          filter: grayscale(1);
          opacity: 0.5;
          border-color: #bcbcbc !important;
          color: #8f8f8f;
        }

        :deep(.count-wrap .count) {
          color: #9b9b9b;
        }
      }
    }
  }

  .grid {
    flex: 1 1 auto;
    min-height: 0;
    display: grid;
    grid-template-columns: repeat(10, 1fr);
    /* 列高依內容決定並靠上排 —— 用 1fr 的話高度不足時最後一列會被壓掉；
       再加 overflow-y 保底：空間真的不夠時可以捲動，絕不裁切
       （捲軸樣式與「當期注單」一致，見下方 @extend 的那組設定） */
    grid-auto-rows: min-content;
    align-content: start;
    overflow-y: auto;
    overflow-x: hidden;
    gap: 0.3rem;
    @include cd-analyze-scrollbar;

    :deep(.ball) {
      width: 2.5rem;
      height: 2.5rem;
      background: #fff;
      font-size: 1.3rem;
      cursor: default;

      &.selected {
        border-width: 0.3rem;
      }
    }

    :deep(.count-wrap) {
      margin-top: unset;
    }

    /* 本期未下注（或數字為 0）：灰階淡出 */
    .ball-cell.is-zero {
      :deep(.ball) {
        filter: grayscale(1);
        opacity: 0.45;
        border-color: #bcbcbc !important;
        color: #8f8f8f;
      }

      :deep(.count-wrap .count) {
        color: #9b9b9b;
      }
    }
  }
}
</style>
