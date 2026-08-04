<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import Ball from '~/components/lottery/bg/6hc/cd/base/Ball.vue'
import { SORT, STATUS_TIME } from '~/config/constants'
import { use6hcCredit } from '~/composables/use6hcCredit'

type RecommendBall = {
  num?: number | string
  label?: string
  animal?: string
  hedgeValue: number
  countIssue: number
  countShow: number
  countBets: number
  selected: boolean
}

const RECOMMEND_COUNT = 6 // 推薦碼數（同 6hc-of）

const { $dialog } = useNuxtApp()
const { road: mxRoad, current: mxCurrent, analyze: mxAnalyze, state: mxState, actions: mxActions } = use6hcCredit()

const state = reactive({
  ballList: [] as RecommendBall[],
})

// --- COMPUTED ---
const isOpen = computed(() => String(mxCurrent.runtime?.currentStatus ?? '') === STATUS_TIME.OPEN)
const hasRecommend = computed(() => state.ballList.length === RECOMMEND_COUNT)
const recommendNumbers = computed(() => state.ballList.map((play) => Number(play.num)))

// --- HANDLE ---
const _handlers = {
  // 當期注單各號碼的下注次數（注項文字非數字者略過）
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
  // 對沖值：依排序模式決定「系統統計」與「自身下注」的落差，落差越大越推薦
  hedgeValue: (play: { num?: number | string; countShow?: number; countIssue?: number }, betCountMap: Map<number, number>) => {
    const countShow = Number(play.countShow ?? 0)
    const countIssue = Number(play.countIssue ?? 0)
    const betCount = Number(betCountMap.get(Number(play.num)) ?? 0)
    switch (mxAnalyze.status) {
      case SORT.OPEN_COUNT_SYSTEM: return Math.abs(countShow - betCount)
      case SORT.GAP_ISSUE_SYSTEM: return Math.abs(countIssue - betCount)
      default: return Math.abs(countShow - countIssue)
    }
  },
  build: () => {
    const betCountMap = _handlers.betCountMap()
    state.ballList = mxRoad.plays
      .map((play) => ({
        num: play.num,
        label: String(play.label ?? play.num ?? ''),
        animal: String(play.animal ?? ''),
        hedgeValue: _handlers.hedgeValue(play, betCountMap),
        // 推薦球不顯示統計數字
        countIssue: -1,
        countShow: -1,
        countBets: -1,
        selected: true,
      } satisfies RecommendBall))
      .sort((a, b) => {
        const diff = b.hedgeValue - a.hedgeValue
        return diff !== 0 ? diff : Number(a.num) - Number(b.num)
      })
      .slice(0, RECOMMEND_COUNT)
      .sort((a, b) => Number(a.num) - Number(b.num))
  },
}

const click = {
  // 把推薦號碼帶入當前分頁注項（取代既有選取，套用當前投注金額）
  add: () => {
    if (!isOpen.value) return $dialog.alert('目前非開盤中，無法加入')
    if (!hasRecommend.value) return $dialog.alert('推薦號碼不足，無法加入')
    const applied = mxActions.selectByNumbers(recommendNumbers.value)
    if (applied === 0) return $dialog.alert('當前分頁沒有對應的號碼球')
    $dialog.alert(`已加入 ${applied} 注（每注 ${mxState.amount}）`)
  },
}

// --- WATCH ---
watch(
  [() => mxAnalyze.status, () => mxRoad.plays, () => mxCurrent.detail],
  () => { _handlers.build() },
  { deep: true, immediate: true }
)
</script>

<template>
  <div class="block-main analyze-balls">
    <div class="header">
      <label>※號碼推薦※</label>
      <span class="hint">依「{{ mxAnalyze.status === SORT.DEFAULT ? '攪出 / 相隔' : '系統 / 自身' }}」落差推薦</span>
    </div>
    <div class="main">
      <div class="result-balls">
        <Ball v-for="play in state.ballList" :key="String(play.num)" :data="play" :is-click="false" />
        <span v-if="!hasRecommend" class="empty">尚無球號資料</span>
        <button type="button" class="add-btn" :disabled="!hasRecommend" @click="click.add">+加入注項</button>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.analyze-balls {
  flex: 0 0 auto;
  min-height: 82px;
  max-height: 180px;
  margin-bottom: 0.75rem;
  border-width: 2px;
  background: #f3b7bf;
  display: flex;
  flex-wrap: wrap;

  .header {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;

    label {
      border: 1px solid #902432;
      border-radius: 4px;
      background: #902432;
      padding: 0 7px;
      font-size: 13px;
      font-weight: 700;
      color: #fff;
    }

    .hint {
      font-size: 12px;
      font-weight: 600;
      color: #7f1d1d;
    }
  }

  .main {
    font-size: 13px;
    color: var(--color-red-desc);

    :deep(.ball) {
      width: 2.7rem;
      height: 2.7rem;
      background: #fff;
      font-size: 1.3rem;
      cursor: default;
    }

    .result-balls {
      margin-top: 7px;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;

      .empty {
        font-weight: 700;
        color: #7f1d1d;
      }

      .add-btn {
        margin-left: 20px;
        border: 1px solid var(--color-red-main);
        border-radius: 4px;
        background: var(--color-red-main);
        padding: 4px 10px;
        font-size: 12px;
        font-weight: 700;
        color: #fff;
        cursor: pointer;
        transition: filter 0.15s ease, transform 0.15s ease;

        &:hover:not(:disabled) {
          filter: brightness(1.08) saturate(1.2);
          transform: translateY(-1px);
        }

        &:active:not(:disabled) {
          transform: scale(0.96);
        }

        &:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }
      }
    }
  }
}
</style>
