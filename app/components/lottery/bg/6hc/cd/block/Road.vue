<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, watch } from 'vue'
import Ball from '~/components/lottery/bg/6hc/cd/base/Ball.vue'
import { use6hcCredit } from '~/composables/use6hcCredit'

type RoadPlay = {
  id?: number | string
  num?: number | string
  label?: string
  countIssue?: number
  countShow?: number
  animal?: string
}

const HIGHLIGHT_TOP = 7 // 相隔期數 / 攪出次數 各取前 7 名高亮
const DIM_RATIO = 0.7 // 開獎動畫中隨機打暗的比例
const ANIM_INTERVAL_MS = 100 // 開獎動畫隨機刷新間隔
const REVEAL_FADE_MS = 1400 // 開獎結束後中獎球光暈淡出時間

const { road: mxRoad, current: mxCurrent, isOpening, openingRevealedNumbers } = use6hcCredit()

const state = reactive({
  timer: null as ReturnType<typeof setInterval> | null,
  fadeTimer: null as ReturnType<typeof setTimeout> | null,
  randomDimSet: new Set<string>(),
  randomIssueSet: new Set<string>(),
  randomShowSet: new Set<string>(),
  fadingOutSet: new Set<number>(), // 開獎結束後仍在淡出的中獎號碼
  lastRevealedSet: new Set<number>(), // 開獎中已開出號碼的快照（供結束後淡出使用）
})

// --- COMPUTED ---
// 最新一期已開出的號碼（未開出者打暗）
const openedNumSet = computed(() => {
  const openCode = mxCurrent.runtime?.openCode ?? []
  return new Set(
    openCode
      .map((num) => Number(num))
      .filter((num) => Number.isFinite(num))
  )
})
const maxIssueTopSet = computed(() => _handlers.topKeysBy('countIssue'))
const maxShowTopSet = computed(() => _handlers.topKeysBy('countShow'))

// --- HANDLE ---
const _handlers = {
  playKey: (play: RoadPlay) => String(play.id ?? play.num ?? ''),
  // 依指定欄位取前 HIGHLIGHT_TOP 名的球號 key 集合
  topKeysBy: (field: 'countIssue' | 'countShow') => {
    const sorted = [...mxRoad.plays]
      .filter((play) => Number.isFinite(Number(play[field])) && Number(play[field]) >= 0)
      .sort((a, b) => Number(b[field]) - Number(a[field]))
      .slice(0, HIGHLIGHT_TOP)
    return new Set(sorted.map((play) => _handlers.playKey(play)))
  },
  isOpenedNumber: (num?: string | number) => {
    const value = Number(num)
    if (!Number.isFinite(value)) return false
    return openedNumSet.value.has(value)
  },
  // 開獎中且該號碼已被開出（跟著 Header 的開球節奏亮起）
  isRevealed: (play: RoadPlay) => isOpening.value && openingRevealedNumbers.value.has(Number(play.num)),
  isFadingOut: (play: RoadPlay) => state.fadingOutSet.has(Number(play.num)),
  isDimmed: (play: RoadPlay) => {
    if (_handlers.isRevealed(play)) return false
    if (isOpening.value) return state.randomDimSet.has(_handlers.playKey(play))
    return !_handlers.isOpenedNumber(play.num)
  },
  isIssueHighlighted: (play: RoadPlay) => {
    const key = _handlers.playKey(play)
    if (isOpening.value && !_handlers.isRevealed(play)) return state.randomIssueSet.has(key)
    return maxIssueTopSet.value.has(key)
  },
  isShowHighlighted: (play: RoadPlay) => {
    const key = _handlers.playKey(play)
    if (isOpening.value && !_handlers.isRevealed(play)) return state.randomShowSet.has(key)
    return maxShowTopSet.value.has(key)
  },
  countText: (value?: number) => (Number(value ?? -1) >= 0 ? String(value) : '-'),
  hasCount: (play: RoadPlay) => Number(play.countIssue ?? -1) >= 0 || Number(play.countShow ?? -1) >= 0,
  ballTitle: (play: RoadPlay) => {
    const label = String(play.label ?? play.num ?? '')
    return play.animal ? `${label} ${play.animal}` : label
  },
}

// --- 開獎動畫（隨機打暗 / 隨機外框，模擬攪珠中資料跳動） ---
const _anim = {
  pick: (keys: string[], count: number) => {
    const pool = [...keys]
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      const tmp = pool[i] ?? ''
      pool[i] = pool[j] ?? ''
      pool[j] = tmp
    }
    return new Set(pool.slice(0, Math.max(0, Math.min(count, pool.length))))
  },
  run: () => {
    const keys = mxRoad.plays.map((play) => _handlers.playKey(play)).filter((key) => key.length > 0)
    if (keys.length === 0) {
      _anim.reset()
      return
    }
    state.randomDimSet = _anim.pick(keys, Math.max(1, Math.floor(keys.length * DIM_RATIO)))
    state.randomIssueSet = _anim.pick(keys, HIGHLIGHT_TOP)
    state.randomShowSet = _anim.pick(keys, HIGHLIGHT_TOP)
  },
  reset: () => {
    state.randomDimSet = new Set()
    state.randomIssueSet = new Set()
    state.randomShowSet = new Set()
  },
  start: () => {
    if (state.timer) return
    _anim.run()
    state.timer = setInterval(() => _anim.run(), ANIM_INTERVAL_MS)
  },
  stop: () => {
    if (state.timer) {
      clearInterval(state.timer)
      state.timer = null
    }
    _anim.reset()
  },
  clearFadeTimer: () => {
    if (state.fadeTimer) {
      clearTimeout(state.fadeTimer)
      state.fadeTimer = null
    }
  },
}

// --- WATCH ---
// openingRevealedNumbers 依賴 isOpening，狀態一翻就會歸零，
// 故開獎中先留快照，結束後才有號碼可做淡出
watch(() => openingRevealedNumbers.value.size, (size) => {
  if (!isOpening.value || size === 0) return
  state.lastRevealedSet = new Set(openingRevealedNumbers.value)
})

watch(isOpening, (opening) => {
  if (opening) {
    _anim.start()
    _anim.clearFadeTimer()
    state.fadingOutSet = new Set()
    state.lastRevealedSet = new Set()
    return
  }
  // 開獎結束：停止跳動，中獎球光暈延遲淡出
  _anim.stop()
  if (state.lastRevealedSet.size === 0) return
  state.fadingOutSet = new Set(state.lastRevealedSet)
  state.lastRevealedSet = new Set()
  state.fadeTimer = setTimeout(() => {
    state.fadingOutSet = new Set()
    state.fadeTimer = null
  }, REVEAL_FADE_MS)
}, { immediate: true })

onBeforeUnmount(() => {
  _anim.stop()
  _anim.clearFadeTimer()
})
</script>

<template>
  <div class="road-warp">
    <div v-if="mxRoad.plays.length === 0" class="empty">
      {{ mxRoad.fetchStatus === 'error' ? (mxRoad.errorMessage || '球號分析載入失敗') : '球號分析載入中…' }}
    </div>
    <div v-else class="road-grid" :class="{ 'is-animating': isOpening }">
      <div v-for="play in mxRoad.plays" :key="String(play.id ?? play.num)" class="road-item" :class="{
        'is-dim': _handlers.isDimmed(play),
        'is-highlight-issue': _handlers.isIssueHighlighted(play),
        'is-highlight-show': _handlers.isShowHighlighted(play),
        'is-revealed': _handlers.isRevealed(play),
        'is-revealed-out': _handlers.isFadingOut(play),
      }" :title="_handlers.ballTitle(play)">
        <Ball :data="{
          num: play.num,
          label: String(play.label ?? '').padStart(2, '0'),
          selected: true,
        }" :is-click="false" />
        <div v-if="_handlers.hasCount(play)" class="road-count">
          <span class="road-count-issue">{{ _handlers.countText(play.countIssue) }}</span>
          <span class="road-count-sep">/</span>
          <span class="road-count-show">{{ _handlers.countText(play.countShow) }}</span>
        </div>
      </div>
    </div>
    <div class="note">
      <div>未中獎號碼</div>
      <div>相隔期數最多</div>
      <div>攪出次數最多</div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.road-warp {
  position: relative;
  flex: 1;
  min-height: 100%;
  display: flex;
  align-items: stretch;
  justify-content: center;
  background: var(--color-red-desc);
  border: 1px solid #f6d9de;
  border-radius: 6px;
  padding: 0.65rem;

  .empty {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-size: 0.875rem;
    font-weight: 700;
  }

  .road-grid {
    width: 100%;
    display: grid;
    grid-template-columns: repeat(10, minmax(0, 1fr));
    gap: 0.35rem;
    align-content: start;

    /* 路珠球比玩法頁號碼球小一號 */
    :deep(.ball-wrapper) {
      .ball {
        width: 2.3rem;
        height: 2.3rem;
        background: #fff;
        font-size: 1rem;
        cursor: default;
      }
    }

    .road-item {
      position: relative;
      border-radius: 0.4rem;

      /* 未中獎號碼：整格壓暗 */
      &.is-dim::after {
        content: '';
        position: absolute;
        inset: 0;
        background: #7f0a0a6b;
        border-radius: 0.4rem;
        pointer-events: none;
        z-index: 2;
      }

      /* 相隔期數 / 攪出次數 最多：外框標記 */
      &.is-highlight-issue::before,
      &.is-highlight-show::before {
        content: '';
        position: absolute;
        inset: -2px;
        border-radius: 0.5rem;
        pointer-events: none;
        z-index: 3;
        transition: opacity 0.7s ease;
      }

      &.is-highlight-issue::before {
        box-shadow: inset 0 0 0 2px #ff0000;
      }

      &.is-highlight-show::before {
        border: 2px solid #facc15;
      }

      &.is-highlight-issue.is-highlight-show::before {
        box-shadow: inset 0 0 0 2px #ff0000;
        border: 2px solid #facc15;
      }

      /* 開獎中已開出：彈出 + 金色光暈脈動 */
      &.is-revealed {
        z-index: 5;
        animation: road-revealed-pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both;

        :deep(.ball) {
          transform: scale(1.12);
          box-shadow:
            0 0 10px 4px rgba(255, 210, 0, 0.65),
            0 0 22px 8px rgba(255, 140, 0, 0.4),
            inset 0 1px 0 rgba(255, 255, 255, 0.45);
          transition: transform 0.25s, box-shadow 0.25s;
        }

        &::after {
          content: '';
          position: absolute;
          inset: -5px;
          border-radius: 0.65rem;
          pointer-events: none;
          z-index: 4;
          animation: road-revealed-ring 1s ease-in-out infinite;
        }
      }

      /* 開獎結束：光暈淡出 */
      &.is-revealed-out {
        z-index: 5;
        animation: road-revealed-out 1.4s ease-out forwards;

        :deep(.ball) {
          transform: scale(1);
          box-shadow: none;
          transition: transform 1.4s ease-out, box-shadow 1.4s ease-out;
        }

        &::after {
          content: '';
          position: absolute;
          inset: -5px;
          border-radius: 0.65rem;
          pointer-events: none;
          z-index: 4;
          animation: road-revealed-ring-out 1.4s ease-out forwards;
        }
      }
    }

    /* 攪珠中：外框標記先隱藏，避免與隨機跳動打架 */
    &.is-animating {
      .road-item.is-highlight-issue::before,
      .road-item.is-highlight-show::before {
        opacity: 0;
        transition: none;
      }
    }

    .road-count {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 2px;
      margin-top: 2px;
      font-size: 10px;
      font-weight: 800;
      line-height: 1.1;
      color: #fff;

      &-issue {
        color: #280202;
      }

      &-show {
        color: #facc15;
      }

      &-sep {
        opacity: 0.6;
      }
    }
  }

  .note {
    position: absolute;
    bottom: 0;
    right: 5px;
    color: #fff;
    font-size: 12px;
    font-weight: 700;

    div {
      position: relative;

      &::before {
        content: '';
        position: absolute;
        top: 4px;
        left: -15px;
        width: 10px;
        height: 10px;
        background: #fff;
      }

      &:nth-child(1)::before {
        background: #7f0a0a6b;
      }

      &:nth-child(2)::before {
        background: unset;
        border: 1.3px solid #ff0000;
      }

      &:nth-child(3)::before {
        background: unset;
        border: 1.3px solid #facc15;
      }
    }
  }
}

@keyframes road-revealed-pop {
  0% {
    transform: scale(0.15) rotate(-12deg);
    opacity: 0;
    filter: brightness(3) saturate(0);
  }

  50% {
    transform: scale(1.35) rotate(6deg);
    opacity: 1;
    filter: brightness(1.8) saturate(1.4);
  }

  70% {
    transform: scale(0.88) rotate(-3deg);
    filter: brightness(1.15);
  }

  100% {
    transform: scale(1) rotate(0deg);
    filter: brightness(1);
  }
}

@keyframes road-revealed-ring {

  0%,
  100% {
    box-shadow:
      0 0 0 2.5px #ffd700,
      0 0 12px 4px rgba(255, 200, 0, 0.75),
      0 0 24px 8px rgba(255, 100, 0, 0.4);
  }

  50% {
    box-shadow:
      0 0 0 4px #ffd700,
      0 0 24px 10px rgba(255, 200, 0, 1),
      0 0 44px 18px rgba(255, 100, 0, 0.6),
      0 0 60px 24px rgba(255, 60, 0, 0.25);
  }
}

@keyframes road-revealed-out {
  0% {
    filter: brightness(1.1);
  }

  100% {
    filter: brightness(1);
  }
}

@keyframes road-revealed-ring-out {
  0% {
    box-shadow:
      0 0 0 2.5px #ffd700,
      0 0 12px 4px rgba(255, 200, 0, 0.75),
      0 0 24px 8px rgba(255, 100, 0, 0.4);
    opacity: 1;
  }

  100% {
    box-shadow:
      0 0 0 0 rgba(255, 215, 0, 0),
      0 0 0 0 rgba(255, 200, 0, 0),
      0 0 0 0 rgba(255, 100, 0, 0);
    opacity: 0;
  }
}
</style>
