<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import Ball from '~/components/lottery/bg/6hc/cd/base/Ball.vue'
import BarControls from '~/components/lottery/bg/6hc/cd/block/analyze/BarControls.vue'
import { SORT } from '~/config/constants'
import { use6hcCredit } from '~/composables/use6hcCredit'

type AnalyzeBall = {
  num?: number | string
  label?: string
  countIssue: number
  countShow: number
  countBets: number
  selected: boolean
  hasBet: boolean
}

// 系統統計模式（球下方顯示 road 統計，灰階依「本期有無下注」判斷）
const SYSTEM_MODES: string[] = [SORT.OPEN_COUNT_SYSTEM, SORT.GAP_ISSUE_SYSTEM]

const { road: mxRoad, current: mxCurrent, analyze: mxAnalyze } = use6hcCredit()

const state = reactive({
  playList: [] as AnalyzeBall[],
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
  build: () => {
    const betCountMap = _handlers.betCountMap()
    const list = mxRoad.plays.map((play) => {
      const betCount = Number(betCountMap.get(Number(play.num)) ?? 0)
      return {
        num: play.num,
        label: String(play.label ?? play.num ?? ''),
        // 球本體只顯示一列數字（countBets），統計欄位一律關閉
        countIssue: -1,
        countShow: -1,
        countBets: _handlers.countBy(play, betCount),
        selected: true,
        hasBet: betCount > 0,
      } satisfies AnalyzeBall
    })
    // 預設依號碼排序，其餘模式依顯示數字由多到少（同值時號碼小的在前）
    if (mxAnalyze.status === SORT.DEFAULT) {
      list.sort((a, b) => Number(a.num) - Number(b.num))
    } else {
      list.sort((a, b) => {
        const diff = b.countBets - a.countBets
        return diff !== 0 ? diff : Number(a.num) - Number(b.num)
      })
    }
    state.playList = list
  },
  // 灰階：系統模式看本期是否下注，其餘看顯示數字是否為 0
  isZero: (play: AnalyzeBall) => (SYSTEM_MODES.includes(mxAnalyze.status) ? !play.hasBet : play.countBets === 0),
}

// --- COMPUTED ---
const hasData = computed(() => state.playList.length > 0)

// --- WATCH ---
watch(
  [() => mxAnalyze.status, () => mxRoad.plays, () => mxCurrent.detail],
  () => { _handlers.build() },
  { deep: true, immediate: true }
)
</script>

<template>
  <div class="block-main analyze-issue-bets">
    <div class="header">
      注號分析
      <BarControls v-model="mxAnalyze.status" />
    </div>
    <div v-if="!hasData" class="empty">尚無球號資料</div>
    <div v-else class="grid">
      <div v-for="play in state.playList" :key="String(play.num)" class="ball-cell"
        :class="{ 'is-zero': _handlers.isZero(play) }">
        <Ball :data="play" :is-click="false" />
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.analyze-issue-bets {
  flex: 1 1 auto;
  min-height: 0;
  width: 100%;
  background: var(--color-red-sub);
  display: flex;
  flex-direction: column;

  .header {
    margin-bottom: 10px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    flex-wrap: wrap;
    font-size: 14px;
    font-weight: 700;
    color: var(--color-red-main);
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

  .grid {
    flex: 1 1 auto;
    min-height: 0;
    display: grid;
    grid-template-columns: repeat(10, 1fr);
    gap: 0.3rem;

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
