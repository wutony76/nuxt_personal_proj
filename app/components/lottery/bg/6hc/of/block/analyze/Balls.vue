<script setup lang="ts">
import { cloneDeep } from 'lodash'
import Ball from '~/components/lottery/bg/6hc/of/base/Ball.vue'
import { GAME_6HC_OF, SORT } from '~/config/constants'
import { actions } from '~/utils/common'
import { _uuid2 } from 'serv/utils/encrypt'

const { $dialog } = useNuxtApp()
const { state: mxState, analyze: mxAnalyze, system: mxSystem, current: mxCurrent, isOpen } = use6hcOfficial()
type AnalyzeDetailRow = {
  bets?: Array<string | number>
}
const state = reactive({
  hedgeBallList: [] as any[],
  danBallList: [] as any[],
  tuoBallList: [] as any[],
})
const isDantuoMode = computed(() => mxState.status === GAME_6HC_OF.DANTUO.key)
const isHedgeMode = computed(() => !isDantuoMode.value && [SORT.DEFAULT, SORT.BET_COUNT_USER, SORT.OPEN_COUNT_SYSTEM, SORT.GAP_ISSUE_SYSTEM].includes(mxAnalyze.status))

const _handlers = {
  getBetCountMap: () => {
    const betCountMap = new Map<number, number>()
      ; (mxCurrent.detail as AnalyzeDetailRow[]).forEach((detail) => {
        if (!Array.isArray(detail?.bets)) return
        detail.bets.forEach((bet) => {
          const betNum = Number(bet)
          if (Number.isNaN(betNum)) return
          betCountMap.set(betNum, (betCountMap.get(betNum) ?? 0) + 1)
        })
      })
    return betCountMap
  },
  getHedgeValue: (play: any, betCountMap: Map<number, number>) => {
    const countShow = Number(play?.countShow ?? 0)
    const countIssue = Number(play?.countIssue ?? 0)
    const betCount = Number(betCountMap.get(Number(play?.num)) ?? 0)
    switch (mxAnalyze.status) {
      case SORT.OPEN_COUNT_SYSTEM: return Math.abs(countShow - betCount)
      case SORT.GAP_ISSUE_SYSTEM: return Math.abs(countIssue - betCount)
      default: return Math.abs(countShow - countIssue)
    }
  },
  analyzeDantuo: () => {
    const betCountMap = _handlers.getBetCountMap()
    const sorted = (mxSystem.playList as any[])
      .map((play) => ({ ...play, hedgeValue: _handlers.getHedgeValue(play, betCountMap) }))
      .sort((a, b) => {
        const diff = Number(b.hedgeValue) - Number(a.hedgeValue)
        return diff !== 0 ? diff : Number(a.num) - Number(b.num)
      })
    state.danBallList = sorted.slice(0, 2)
      .map(p => ({ ...p, danSelected: true, selected: true, countIssue: -1, countShow: -1, countBets: -1 }))
      .sort((a, b) => a.num - b.num)
    state.tuoBallList = sorted.slice(2, 6)
      .map(p => ({ ...p, tuoSelected: true, selected: true, countIssue: -1, countShow: -1, countBets: -1 }))
      .sort((a, b) => a.num - b.num)
  },
  analyzeHedge: () => {
    const betCountMap = _handlers.getBetCountMap()
    state.hedgeBallList = (mxSystem.playList as any[])
      .map((play) => ({
        ...play,
        hedgeValue: _handlers.getHedgeValue(play, betCountMap),
        selected: true,
      }))
      .sort((a, b) => {
        const diff = Number(b.hedgeValue) - Number(a.hedgeValue)
        return diff !== 0 ? diff : Number(a.num) - Number(b.num)
      })
      .slice(0, 6)
    state.hedgeBallList.sort((a, b) => a.num - b.num)
  },
  analyze: () => {
    if (isDantuoMode.value) {
      state.hedgeBallList = []
      _handlers.analyzeDantuo()
    } else if (isHedgeMode.value) {
      state.danBallList = []
      state.tuoBallList = []
      _handlers.analyzeHedge()
    } else {
      state.hedgeBallList = []
      state.danBallList = []
      state.tuoBallList = []
    }
  }
}

const dantuoBetCount = computed(() => {
  const needTuo = 6 - state.danBallList.length
  return actions.comb(state.tuoBallList.length, needTuo)
})

const _actions = {
  add: () => {
    if (!isOpen.value) return $dialog.alert('目前非開盤中，無法加入')
    if (isDantuoMode.value) {
      if (state.danBallList.length !== 2 || state.tuoBallList.length !== 4) return $dialog.alert('推薦號碼不足，無法加入')
      const _bet = {
        hashKey: _uuid2(),
        playList: [...cloneDeep(state.danBallList), ...cloneDeep(state.tuoBallList)],
        danList: cloneDeep(state.danBallList),
        tuoList: cloneDeep(state.tuoBallList),
        betCount: dantuoBetCount.value,
      }
      mxState.groupList.push(_bet)
      $dialog.alert('加入注單成功')
      return
    }
    if (!isHedgeMode.value) return $dialog.alert('目前狀態無法加入注單')
    if (state.hedgeBallList.length !== 6) return $dialog.alert('推薦號碼不足 6 碼')
    const _bet = {
      hashKey: _uuid2(),
      playList: cloneDeep(state.hedgeBallList).map(play => ({ ...play, selected: true, countIssue: -1, countShow: -1, countBets: -1 })),
      betCount: 1
    }
    mxState.groupList.push(_bet)
    $dialog.alert('加入注單成功')
  }
}

watch(
  () => mxAnalyze.status,
  () => {
    _handlers.analyze()
  },
  { immediate: true }
)

watch(
  () => mxState.status,
  () => { _handlers.analyze() }
)

watch(
  () => mxSystem.playList,
  () => { _handlers.analyze() },
  { deep: true }
)

watch(
  () => mxCurrent.detail,
  () => { _handlers.analyze() },
  { deep: true }
)

</script>

<template>
  <div class="block-main analyze-balls">
    <div class="header">
      <label> ※號碼推薦※ </label>
    </div>
    <div class="main">
      <template v-if="isDantuoMode">
        <div class="result-balls">
          <Ball v-for="play in state.danBallList" :key="play.num" :data="play" :is-click="false" />
          <Ball v-for="play in state.tuoBallList" :key="play.num" :data="play" :is-click="false" />

          <button type="button" class="action-btn bet add-btn" @click="_actions.add">+加入注單</button>
        </div>

      </template>
      <template v-else-if="isHedgeMode">
        <div class="result-balls">
          <Ball v-for="play in state.hedgeBallList" :key="play.num"
            :data="{ ...play, countIssue: -1, countShow: -1, countBets: -1 }" :is-click="false" />
          <button type="button" class="action-btn bet add-btn" @click="_actions.add">+加入注單</button>
        </div>
      </template>
    </div>
  </div>

</template>
<style scoped lang="scss">
.analyze-balls {
  background: #f3b7bf;
  display: flex;
  flex: 0 0 auto;
  flex-wrap: wrap;
  margin-bottom: 0.75rem;
  min-height: 82px;
  max-height: 180px;
  border-width: 2px;

  .header {
    width: 100%;

    display: flex;
    justify-content: space-between;

    label {
      background: #902432;
      font-size: 13px;
      font-weight: 700;
      color: #fff;
      border: 1px solid #902432;
      border-radius: 4px;
      padding: 0 7px;
    }
  }

  .main {
    margin-top: unset;
    font-size: 13px;
    color: var(--color-red-desc);

    .label {
      margin-right: 4px;
    }

    .value {
      font-weight: 700;
      color: var(--color-red-main);
    }

    :deep(.ball) {
      background: #fff;
      width: 2.7rem;
      height: 2.7rem;
      font-size: 1.3rem;
    }

    .add-btn {
      width: auto;
      padding: 4px 10px;
      transition: filter 0.15s ease, transform 0.15s ease;

      &:hover {
        filter: brightness(1.08) saturate(1.2);
        transform: translateY(-1px);
      }
    }

    .result-balls {
      margin-top: 7px;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;

      .add-btn {
        margin-left: 20px;
      }
    }

    .result-dantuo {
      margin-top: 6px;
      display: flex;
      flex-direction: column;
      gap: 4px;

      .dt-row {
        display: flex;
        align-items: center;
        gap: 5px;
      }

      .dt-label {
        font-size: 12px;
        font-weight: 700;
        padding: 2px 4px;
        border-radius: 3px;
        flex-shrink: 0;

        &.dan {
          color: #b45309;
          background: rgba(255, 200, 0, 0.25);
        }

        &.tuo {
          color: #1d6fa8;
          background: rgba(80, 180, 255, 0.18);
        }
      }

      .dt-balls {
        display: flex;
        flex-wrap: wrap;
        gap: 5px;
      }

      .dt-footer {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-top: 2px;

        .bet-count {
          font-size: 12px;
          font-weight: 700;
          color: var(--color-red-main);
        }
      }
    }
  }

}
</style>
