<script setup lang="ts">
import { cloneDeep } from 'lodash'
import Ball from '~/components/lottery/bg/6hc/of/base/Ball.vue'
import { SORT } from '~/config/constants'
import { _uuid2 } from 'serv/utils/encrypt'

const { $dialog } = useNuxtApp()
const { state: mxState, analyze: mxAnalyze, system: mxSystem, current: mxCurrent } = use6hcOfficial()
type AnalyzeDetailRow = {
  bets?: Array<string | number>
}
const state = reactive({
  hedgeBallList: [] as any[],
})
const isHedgeMode = computed(() => [SORT.DEFAULT, SORT.BET_COUNT_USER, SORT.OPEN_COUNT_SYSTEM, SORT.GAP_ISSUE_SYSTEM].includes(mxAnalyze.status))

const handle = {
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
  analyze: () => {
    if (!isHedgeMode.value) {
      state.hedgeBallList = []
      return
    }

    const betCountMap = handle.getBetCountMap()

    // 對衝球號邏輯：
    // 1) 每顆球先算 hedgeValue（依狀態切換公式）
    //    - DEFAULT/BET_COUNT_USER: |countShow - countIssue|
    //    - OPEN_COUNT_SYSTEM:      |countShow - betCount|
    //    - GAP_ISSUE_SYSTEM:       |countIssue - betCount|
    // 2) 依 hedgeValue 由大到小
    // 3) 同分時以 num 由小到大，避免排序抖動
    // 4) 取前 7 顆做最終結果
    state.hedgeBallList = (mxSystem.playList as any[])
      .map((play) => ({
        ...play,
        hedgeValue: (() => {
          const countShow = Number(play?.countShow ?? 0)
          const countIssue = Number(play?.countIssue ?? 0)
          const betCount = Number(betCountMap.get(Number(play?.num)) ?? 0)

          switch (mxAnalyze.status) {
            case SORT.OPEN_COUNT_SYSTEM:
              return Math.abs(countShow - betCount)
            case SORT.GAP_ISSUE_SYSTEM:
              return Math.abs(countIssue - betCount)
            case SORT.DEFAULT:
            case SORT.BET_COUNT_USER:
            default:
              return Math.abs(countShow - countIssue)
          }
        })(),
        selected: true,
      }))
      .sort((a, b) => {
        const diff = Number(b.hedgeValue) - Number(a.hedgeValue)
        if (diff !== 0) return diff
        return Number(a.num) - Number(b.num)
      })
      .slice(0, 7)
    state.hedgeBallList.sort((a, b) => a.num - b.num)
  }
}

const click = {
  add: () => {
    if (!isHedgeMode.value) return $dialog.alert('目前狀態無法加入注單')
    if (state.hedgeBallList.length !== 7) return $dialog.alert('推薦號碼不足 7 碼')

    const _bet = {
      hashKey: _uuid2(),
      playList: cloneDeep(state.hedgeBallList).map(play => ({ ...play, selected: true, countIssue: -1, countShow: -1, countBets: -1 })),
    }
    mxState.groupList.push(_bet)
    $dialog.alert('加入注單成功')
  }
}

watch(
  () => mxAnalyze.status,
  () => {
    handle.analyze()
  },
  { immediate: true }
)

watch(
  () => mxSystem.playList,
  () => {
    if (!isHedgeMode.value) return
    handle.analyze()
  },
  { deep: true }
)

watch(
  () => mxCurrent.detail,
  () => {
    if (!isHedgeMode.value) return
    handle.analyze()
  },
  { deep: true }
)

</script>

<template>
  <div class="block-main analyze-balls">
    <div class="header">
      <label> ※號碼推薦※ </label>
    </div>
    <div class="main">
      <template v-if="isHedgeMode">
        <div class="result-balls">
          <Ball v-for="play in state.hedgeBallList" :key="play.num"
            :data="{ ...play, countIssue: -1, countShow: -1, countBets: -1 }" :is-click="false" />
          <button type="button" class="action-btn bet add-btn" @click="click.add">+加入注單</button>
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

    .result-balls {
      margin-top: 7px;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 5px;

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
    }
  }

}
</style>