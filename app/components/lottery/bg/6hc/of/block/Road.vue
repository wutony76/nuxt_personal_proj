<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, watch } from 'vue'
import Ball from '~/components/lottery/bg/6hc/of/base/Ball.vue'

const { road: mxRoad, current: mxCurrent } = use6hcOfficial()
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

const isOpening = computed(() => {
  const status = String(mxCurrent.runtime?.currentStatus ?? '')
  return status.includes('開獎中')
})

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

watch(isOpening, (opening) => {
  if (opening) {
    anim.start()
    return
  }
  anim.stop()
}, { immediate: true })

onBeforeUnmount(() => {
  anim.stop()
})

const isDimmed = (play: { id?: number | string; num?: number | string }) => {
  if (isOpening.value) return state.randomDimSet.has(getPlayKey(play))
  return !isOpenedNumber(play.num)
}

const isIssueHighlighted = (play: { id?: number | string; num?: number | string }) => {
  const key = getPlayKey(play)
  if (isOpening.value) return state.randomIssueSet.has(key)
  return maxIssueTop7Set.value.has(key)
}

const isShowHighlighted = (play: { id?: number | string; num?: number | string }) => {
  const key = getPlayKey(play)
  if (isOpening.value) return state.randomShowSet.has(key)
  return maxShowTop7Set.value.has(key)
}
</script>

<template>
  <div class="road-warp">
    <div v-if="mxRoad.plays.length === 0" class="empty">ROAD</div>
    <div v-else class="road-grid">
      <div v-for="play in mxRoad.plays" :key="String(play.id ?? play.num)" class="road-item" :class="{
        'is-dim': isDimmed(play),
        'is-highlight-issue': isIssueHighlighted(play),
        'is-highlight-show': isShowHighlighted(play)
      }">
        <Ball :data="{
          num: play.num,
          label: String(play.label ?? '').padStart(2, '0'),
          selected: true,
          // countIssue: Number(play.countIssue ?? -1),
          countShow: Number(play.countShow ?? -1)
        }" :is-click="false" />
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
    }

    .road-item.is-highlight-issue::before {
      border: 2px solid #facc15;
    }

    .road-item.is-highlight-show::before {
      box-shadow: inset 0 0 0 2px #ff0000;
    }

    .road-item.is-highlight-issue.is-highlight-show::before {
      border: 2px solid #facc15;
      box-shadow: inset 0 0 0 2px #ff0000;
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
</style>
