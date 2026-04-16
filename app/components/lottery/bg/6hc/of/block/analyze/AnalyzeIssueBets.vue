<script setup lang="ts">
import { cloneDeep } from 'lodash';
import Ball from '~/components/lottery/bg/6hc/of/base/Ball.vue'
import BarControls from '~/components/lottery/bg/6hc/of/block/analyze/BarControls.vue'
import { GAME_6HC_OF, SORT } from '~/config/constants';

const { current: mxCurrent, system: mxSystem, analyze: mxAnalyze, init: mxInit } = use6hcOfficial()

type AnalyzeDetailRow = {
  bets?: Array<string | number>
}
const state = reactive({
  playList: [] as any[],
})

const handle = {
  count: (data: any[]) => {
    const betCountMap = new Map<number, number>()

      ; (mxCurrent.detail as AnalyzeDetailRow[]).forEach((detail) => {
        if (!Array.isArray(detail?.bets)) return

        detail.bets.forEach((bet) => {
          const betNum = Number(bet)
          if (Number.isNaN(betNum)) return
          betCountMap.set(betNum, (betCountMap.get(betNum) ?? 0) + 1)
        })
      })

    state.playList = data.map((play) => ({
      ...play,
      countBets: betCountMap.get(Number(play.num)) ?? 0,
    }))
  },
  syncSystemCount: (key: 'countShow' | 'countIssue') => {
    const systemCountMap = new Map<number, number>()

      ; (mxSystem.playList as any[]).forEach((play) => {
        systemCountMap.set(Number(play.num), Number(play?.[key] ?? 0))
      })

    state.playList = state.playList.map((play) => ({
      ...play,
      countBets: systemCountMap.get(Number(play.num)) ?? 0,
    }))
  },
  markUnselectedByDetail: () => {
    const selectedBetNumSet = new Set<number>()
      ; (mxCurrent.detail as AnalyzeDetailRow[]).forEach((detail) => {
        if (!Array.isArray(detail?.bets)) return
        detail.bets.forEach((bet) => {
          const betNum = Number(bet)
          if (Number.isNaN(betNum)) return
          selectedBetNumSet.add(betNum)
        })
      })

    state.playList = state.playList.map((play) => ({
      ...play,
      isSelectedInDetail: selectedBetNumSet.has(Number(play.num)),
    }))
  },
  switch: () => {
    switch (mxAnalyze.status) {
      case SORT.DEFAULT:
        handle.count(state.playList as any[])
        state.playList = state.playList.sort((a, b) => a.num - b.num)
        break
      case SORT.BET_COUNT_USER:
        handle.count(state.playList as any[])
        break
      case SORT.OPEN_COUNT_SYSTEM:
        handle.syncSystemCount('countShow')
        break
      case SORT.GAP_ISSUE_SYSTEM:
        handle.syncSystemCount('countIssue')
        break
    }

    // DEFAULT.STATUS 需要 sort
    if (mxAnalyze.status !== SORT.DEFAULT) {
      state.playList = state.playList.sort((a, b) => {
        const countDiff = (b.countBets ?? 0) - (a.countBets ?? 0)
        if (countDiff !== 0) return countDiff
        return Number(a.num) - Number(b.num)
      })
    }

    // OPEN_COUNT_SYSTEM, GAP_ISSUE_SYSTEM STATUS 下未選擇的注號需要反灰
    if ([SORT.OPEN_COUNT_SYSTEM, SORT.GAP_ISSUE_SYSTEM].includes(mxAnalyze.status)) {
      handle.markUnselectedByDetail()
    }
  }
}

const init = {
  run: () => {
    state.playList = cloneDeep(mxInit.playList(GAME_6HC_OF.SINGLE.key)).map(item => ({ ...item, selected: true })) as any[]
    handle.switch()
  }
}
init.run()

watch(
  () => mxCurrent.detail,
  () => {
    handle.switch()
  },
  { deep: true }
)
watch(
  () => mxAnalyze.status,
  () => {
    handle.switch()
  }
)

</script>

<template>
  <div class="block-main analyze-issue-bets">
    <div class="header"> 注號分析
      <BarControls v-model="mxAnalyze.status" />
    </div>
    <div class="grid">
      <div v-for="(play, idx) in state.playList" :key="idx" class="ball-cell" :class="{
        'is-zero': [SORT.OPEN_COUNT_SYSTEM, SORT.GAP_ISSUE_SYSTEM].includes(mxAnalyze.status)
          ? !play.isSelectedInDetail
          : (play.countBets ?? 0) === 0
      }">
        <Ball :data="play" />
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
    font-size: 14px;
    font-weight: 700;
    color: var(--color-red-main);
    margin-bottom: 10px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    flex-wrap: wrap;
  }

  .grid {
    flex: 1 1 auto;
    min-height: 0;
    overflow: visible;
    display: grid;
    grid-template-columns: repeat(10, 1fr);
    gap: .3rem;

    :deep(.ball) {
      background: #fff;
      width: 2.5rem;
      height: 2.5rem;
      font-size: 1.3rem;
      cursor: default;

      &.selected {
        border-width: 0.3rem;
      }
    }

    :deep(.count-wrap) {
      margin-top: unset;
    }

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