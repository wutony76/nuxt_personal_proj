<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import Ball from '~/components/lottery/bg/6hc/of/base/Ball.vue'

const { road: mxRoad, current: mxCurrent, isOpening, openingRevealedNumbers } = use6hcOfficial()
const state = reactive({
  timer: null as ReturnType<typeof setInterval> | null,
  randomDimSet: new Set<string>(),
  randomIssueSet: new Set<string>(),
  randomShowSet: new Set<string>(),
})

const openedNumSet = computed(() => {
  const openCode = mxCurrent.runtime?.openCode ?? []
  return new Set(
    openCode
      .map((num) => Number(num))
      .filter((num) => Number.isFinite(num))
  )
})

const isOpenedNumber = (num?: string | number) => {
  const value = Number(num)
  if (!Number.isFinite(value)) return false
  return openedNumSet.value.has(value)
}

const getPlayKey = (play: { id?: number | string; num?: number | string }) => String(play.id ?? play.num ?? '')

const maxIssueTop7Set = computed(() => {
  const sorted = [...mxRoad.plays]
    .filter((play) => Number.isFinite(Number(play.countIssue)) && Number(play.countIssue) >= 0)
    .sort((a, b) => Number(b.countIssue) - Number(a.countIssue))
    .slice(0, 7)
  return new Set(sorted.map((play) => getPlayKey(play)))
})

const maxShowTop7Set = computed(() => {
  const sorted = [...mxRoad.plays]
    .filter((play) => Number.isFinite(Number(play.countShow)) && Number(play.countShow) >= 0)
    .sort((a, b) => Number(b.countShow) - Number(a.countShow))
    .slice(0, 7)
  return new Set(sorted.map((play) => getPlayKey(play)))
})

const anim = {
  random: (keys: string[], count: number) => {
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
    const keys = mxRoad.plays.map((play) => getPlayKey(play)).filter((key) => key.length > 0)
    if (keys.length === 0) {
      state.randomDimSet = new Set()
      state.randomIssueSet = new Set()
      state.randomShowSet = new Set()
      return
    }
    const dimCount = Math.max(1, Math.floor(keys.length * 0.7))
    state.randomDimSet = anim.random(keys, dimCount)
    state.randomIssueSet = anim.random(keys, 7)
    state.randomShowSet = anim.random(keys, 7)
  },
  stop: () => {
    if (state.timer) {
      clearInterval(state.timer)
      state.timer = null
    }
    state.randomDimSet = new Set()
    state.randomIssueSet = new Set()
    state.randomShowSet = new Set()
  },
  start: () => {
    if (state.timer) return
    anim.run()
    state.timer = setInterval(() => {
      anim.run()
    }, 100)
  },
}

const fadingOutRevealedSet = ref(new Set<number>())
let fadeOutTimer: ReturnType<typeof setTimeout> | null = null

watch(isOpening, (opening) => {
  if (opening) {
    anim.start()
    if (fadeOutTimer) { clearTimeout(fadeOutTimer); fadeOutTimer = null }
    fadingOutRevealedSet.value = new Set()
    return
  }
  anim.stop()
  const revealed = new Set(openingRevealedNumbers.value)
  if (revealed.size > 0) {
    fadingOutRevealedSet.value = revealed
    fadeOutTimer = setTimeout(() => {
      fadingOutRevealedSet.value = new Set()
      fadeOutTimer = null
    }, 1400)
  }
}, { immediate: true })

onBeforeUnmount(() => {
  anim.stop()
  if (fadeOutTimer) clearTimeout(fadeOutTimer)
})

const isRevealedDuringOpening = (play: { num?: number | string }) => {
  return isOpening.value && openingRevealedNumbers.value.has(Number(play.num))
}

const isFadingOut = (play: { num?: number | string }) => {
  return fadingOutRevealedSet.value.has(Number(play.num))
}

const isDimmed = (play: { id?: number | string; num?: number | string }) => {
  if (isRevealedDuringOpening(play)) return false
  if (isOpening.value) return state.randomDimSet.has(getPlayKey(play))
  return !isOpenedNumber(play.num)
}

const isIssueHighlighted = (play: { id?: number | string; num?: number | string }) => {
  const key = getPlayKey(play)
  if (isRevealedDuringOpening(play)) return maxIssueTop7Set.value.has(key)
  if (isOpening.value) return state.randomIssueSet.has(key)
  return maxIssueTop7Set.value.has(key)
}

const isShowHighlighted = (play: { id?: number | string; num?: number | string }) => {
  const key = getPlayKey(play)
  if (isRevealedDuringOpening(play)) return maxShowTop7Set.value.has(key)
  if (isOpening.value) return state.randomShowSet.has(key)
  return maxShowTop7Set.value.has(key)
}
</script>

<template>
  <div class="road-warp">
    <div v-if="mxRoad.plays.length === 0" class="empty">ROAD</div>
    <div v-else class="road-grid" :class="{ 'is-animating': isOpening }">
      <div v-for="play in mxRoad.plays" :key="String(play.id ?? play.num)" class="road-item" :class="{
        'is-dim': isDimmed(play),
        'is-highlight-issue': isIssueHighlighted(play),
        'is-highlight-show': isShowHighlighted(play),
        'is-revealed': isRevealedDuringOpening(play),
        'is-revealed-out': isFadingOut(play)
      }">
        <Ball :data="{
          num: play.num,
          label: String(play.label ?? '').padStart(2, '0'),
          selected: true,
        }" :is-click="false" />
        <div v-if="Number(play.countIssue ?? -1) >= 0 || Number(play.countShow ?? -1) >= 0" class="road-count">
          <span class="road-count-issue">{{ Number(play.countIssue ?? -1) >= 0 ? play.countIssue : '-' }}</span>
          <span class="road-count-sep">/</span>
          <span class="road-count-show">{{ Number(play.countShow ?? -1) >= 0 ? play.countShow : '-' }}</span>
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
  background: var(--color-red-desc);
  flex: 1;
  min-height: 100%;
  display: flex;
  align-items: stretch;
  justify-content: center;
  border-radius: var(--base-radius);
  // background: #fff;
  border: 1px solid #f6d9de;
  padding: 0.65rem;

  .empty {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--color-red-desc);
    font-size: 0.875rem;
    font-weight: 700;
  }

  .road-grid {
    width: 100%;
    display: grid;
    grid-template-columns: repeat(10, minmax(0, 1fr));
    gap: 0.35rem;
    align-content: start;

    :deep(.ball-wrapper) {
      .ball {
        background: #fff;
        width: 2.3rem;
        height: 2.3rem;
        font-size: 1rem;
        cursor: default;
      }

      .count-wrap {
        margin-top: 2px;

        .count {
          color: #fff;
          font-size: 10px;
          font-weight: 800;
          line-height: 1.1;
        }
      }
    }

    .road-item {
      position: relative;
      border-radius: 0.4rem;
    }

    .road-item.is-highlight-issue::before,
    .road-item.is-highlight-show::before {
      content: '';
      position: absolute;
      inset: -2px;
      border-radius: 0.5rem;
      pointer-events: none;
      z-index: 3;
      transition: opacity 0.7s ease;
    }

    .road-item.is-highlight-issue::before {
      box-shadow: inset 0 0 0 2px #ff0000;
    }

    .road-item.is-highlight-show::before {
      border: 2px solid #facc15;
    }

    .road-item.is-highlight-issue.is-highlight-show::before {
      box-shadow: inset 0 0 0 2px #ff0000;
      border: 2px solid #facc15;
    }

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

    .road-item.is-dim::after {
      content: '';
      position: absolute;
      inset: 0;
      background: #7f0a0a6b;
      border-radius: 0.4rem;
      pointer-events: none;
      z-index: 2;
    }

    .road-item.is-revealed {
      z-index: 5;
      animation: revealed-pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both;

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
        animation: revealed-ring 1s ease-in-out infinite;
      }
    }

    .road-item.is-revealed-out {
      z-index: 5;
      animation: revealed-out 1.4s ease-out forwards;

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
        animation: revealed-ring-out 1.4s ease-out forwards;
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

      &:nth-child(1) {
        &::before {
          background: #7f0a0a6b;
        }
      }

      &:nth-child(2) {
        &::before {
          background: unset;
          border: 1.3px solid #ff0000;
        }
      }

      &:nth-child(3) {
        &::before {
          background: unset;
          border: 1.3px solid #facc15;
        }
      }
    }
  }
}

@keyframes revealed-pop {
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

@keyframes revealed-ring {
  0%, 100% {
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

@keyframes revealed-out {
  0% {
    filter: brightness(1.1);
  }
  100% {
    filter: brightness(1);
  }
}

@keyframes revealed-ring-out {
  0% {
    box-shadow:
      0 0 0 2.5px #ffd700,
      0 0 12px 4px rgba(255, 200, 0, 0.75),
      0 0 24px 8px rgba(255, 100, 0, 0.4);
    opacity: 1;
  }
  100% {
    box-shadow:
      0 0 0 0px rgba(255, 215, 0, 0),
      0 0 0 0 rgba(255, 200, 0, 0),
      0 0 0 0 rgba(255, 100, 0, 0);
    opacity: 0;
  }
}
</style>
