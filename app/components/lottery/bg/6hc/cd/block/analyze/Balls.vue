<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import Ball from '~/components/lottery/bg/6hc/cd/base/Ball.vue'
import { SORT, STATUS_TIME } from '~/config/constants'
import { use6hcCredit } from '~/composables/use6hcCredit'

type RankedBall = {
  num?: number | string
  label?: string
  animal?: string
  hedgeValue: number
}

// 換算注項最少需要的號碼數：預測開獎要 6 顆正碼 + 1 顆特別號
const MIN_RANKED = 7

const { $dialog } = useNuxtApp()
const {
  road: mxRoad, current: mxCurrent, analyze: mxAnalyze, state: mxState,
  actions: mxActions, recommendOf: mxRecommendOf,
} = use6hcCredit()

const state = reactive({
  // 全部號碼的對沖排序（高→低）。換算注項需要完整排序：
  // 預測開獎取前 7 顆、「全不中」取末段、「十選中一」取前 10 顆
  rankedNumbers: [] as number[],
})

// --- COMPUTED ---
const isOpen = computed(() => String(mxCurrent.runtime?.currentStatus ?? '') === STATUS_TIME.OPEN)
const hasRecommend = computed(() => state.rankedNumbers.length >= MIN_RANKED)

/**
 * 當前分頁的推薦內容 —— 與「加入注項」按下去會選的完全是同一份
 * （同一支 recommendOf，切玩法／分頁會自動重算）
 */
const recommend = computed(() => (hasRecommend.value ? mxRecommendOf(state.rankedNumbers) : null))

/**
 * 要顯示的推薦項目
 * 組合型玩法（連碼／合肖／全不中…）的一注是一組號碼／生肖／尾數 → 顯示 codes
 * 其餘玩法每個注項各自一注 → 顯示 names
 * 數字項目照原本的號碼球呈現（含色波配色），文字項目（金、豬、特大、5肖…）改用膠囊
 */
const recommendItems = computed(() => {
  const result = recommend.value
  if (!result) return []
  const list = result.codes.length > 0 ? result.codes : result.names
  return list.map((name) => {
    const text = String(name)
    const num = Number(text)
    const isNumber = /^\d+$/.test(text) && num >= 1 && num <= 49
    return {
      key: text,
      text,
      isNumber,
      // 號碼球：label 決定色波配色，統計數字一律 -1 代表不顯示
      ball: { num, label: text.padStart(2, '0'), countIssue: -1, countShow: -1, countBets: -1, selected: true },
      // 色波注項讓膠囊直接帶對應顏色，其餘用預設色
      color: _handlers.chipColorOf(text),
    }
  })
})
/** 組合型玩法的一注要標示「這 n 項合為一注」 */
const isComboBet = computed(() => (recommend.value?.codes.length ?? 0) > 0)

// --- HANDLE ---
const _handlers = {
  // 文字注項的膠囊配色：色波／半波帶對應顏色，其餘用預設
  chipColorOf: (text: string) => {
    if (text.includes('紅')) return 'red'
    if (text.includes('藍')) return 'blue'
    if (text.includes('綠')) return 'green'
    return 'default'
  },
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
    state.rankedNumbers = mxRoad.plays
      .map((play) => ({
        num: play.num,
        label: String(play.label ?? play.num ?? ''),
        animal: String(play.animal ?? ''),
        hedgeValue: _handlers.hedgeValue(play, betCountMap),
      } satisfies RankedBall))
      .sort((a, b) => {
        const diff = b.hedgeValue - a.hedgeValue
        return diff !== 0 ? diff : Number(a.num) - Number(b.num)
      })
      .map((play) => Number(play.num))
  },
}

const click = {
  // 把推薦換算成當前分頁的注項（取代既有選取，套用當前投注金額）
  add: () => {
    if (!isOpen.value) return $dialog.alert('目前非開盤中，無法加入')
    if (!hasRecommend.value) return $dialog.alert('球號資料不足，無法加入')
    const result = mxActions.selectByRecommend(state.rankedNumbers)
    if (!result) return $dialog.alert('此分頁依目前推薦推不出注項，請改用隨機選號')
    const detail = result.codes.length > 0 ? `一注：${result.codes.join('、')}` : `注項：${result.names.join('、')}`
    // 少數分頁照預測開獎組不出必中的一注（如 7 顆球涵蓋 7 個尾數時的四尾連不中）
    const hint = result.guaranteed ? '' : '\n（此分頁依目前推薦無必中組合，已取最保險的一組）'
    $dialog.alert(`已加入 ${result.applied} 注（每注 ${mxState.amount}）\n${detail}${hint}`)
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
      <span class="hint">
        依「{{ mxAnalyze.status === SORT.DEFAULT ? '攪出 / 相隔' : '系統 / 自身' }}」落差推薦
        <template v-if="mxState.selectTabName">
          · {{ mxState.selectTabName }} 推薦{{ isComboBet ? `一注（${recommendItems.length} 項合為一注）` : `${recommendItems.length} 注` }}
        </template>
      </span>
    </div>
    <div class="main">
      <div class="result-balls">
        <!-- 依玩法顯示該分頁真正該押的注項：號碼用球、文字（金／豬／特大／5肖…）用膠囊 -->
        <template v-for="item in recommendItems" :key="item.key">
          <Ball v-if="item.isNumber" :data="item.ball" :is-click="false" />
          <span v-else class="rec-chip" :class="`is-${item.color}`">{{ item.text }}</span>
        </template>
        <span v-if="!hasRecommend" class="empty">尚無球號資料</span>
        <span v-else-if="recommendItems.length === 0" class="empty">此分頁依目前推薦無可押注項</span>
        <span v-else-if="recommend && !recommend.guaranteed" class="soft-hint">※ 此分頁無必中組合，已取最保險的一組</span>
        <button type="button" class="add-btn" :disabled="!hasRecommend || recommendItems.length === 0"
          @click="click.add">+加入注項</button>
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
    margin-top: unset;

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

      /* 非必中組合的提示（僅少數分頁在特定排序下出現） */
      .soft-hint {
        font-size: 11px;
        font-weight: 700;
        color: #92400e;
      }

      /* 文字注項（五行「金」、生肖「豬」、兩面「特大」、一肖量「5肖」…） */
      .rec-chip {
        min-width: 2.7rem;
        height: 2.7rem;
        padding: 0 8px;
        border: 2px solid #fff;
        border-radius: 999px;
        background: #fff;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 1.05rem;
        font-weight: 700;
        line-height: 1;
        color: #902432;

        &.is-red {
          border-color: var(--color-ball-red, #dc2626);
          color: var(--color-ball-red, #dc2626);
        }

        &.is-blue {
          border-color: var(--color-ball-blue, #2563eb);
          color: var(--color-ball-blue, #2563eb);
        }

        &.is-green {
          border-color: var(--color-ball-green, #16a34a);
          color: var(--color-ball-green, #16a34a);
        }
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
