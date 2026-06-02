<script setup lang="ts">
import { computed, ref, watch, onMounted } from 'vue'
import { cloneDeep } from 'lodash'
import { actions } from '~/utils/common'
import { use6hcOfficial } from '~/composables/use6hcOfficial'
import { GAME_6HC_OF } from '~/config/constants'
import Ball from '~/components/lottery/bg/6hc/of/base/Ball.vue'
import IconSvg from '~/components/IconSvg.vue'
import { _uuid2 } from 'serv/utils/encrypt'

const { state: mxState, totalBetCount } = use6hcOfficial()

const displayBetsFormatted = computed(() => {
  if (mxState.status === GAME_6HC_OF.DUPLEX.key) return actions.thousands(displayBets.value || 0)

  return displayBets.value
})

const displayBets = ref(0)
let rafId: number | null = null

function animateBetsTo(target: number, durationMs = 400) {
  if (rafId !== null) cancelAnimationFrame(rafId)
  const from = displayBets.value
  const diff = target - from
  if (Math.abs(diff) < 1) { displayBets.value = target; return }
  const start = performance.now()
  function step(now: number) {
    const t = Math.min((now - start) / durationMs, 1)
    const ease = 1 - Math.pow(1 - t, 3)
    displayBets.value = Math.round(from + diff * ease)
    if (t < 1) { rafId = requestAnimationFrame(step) }
    else { rafId = null }
  }
  rafId = requestAnimationFrame(step)
}

onMounted(() => {
  displayBets.value = totalBetCount.value
  watch(totalBetCount, (newVal) => animateBetsTo(newVal))
})

const _actions = {
  copy: (group: any) => {
    const _bet = {
      hashKey: _uuid2(),
      playList: cloneDeep(group.playList),
    }
    mxState.groupList.push(_bet)
  },
  del: (group: any) => {
    const targetHashKey = group?.hashKey
    if (!targetHashKey) return
    mxState.groupList = mxState.groupList.filter((item: any) => item?.hashKey !== targetHashKey)
  },
}
</script>


<template>
  <div class="group">
    <div class="group-list">
      <div v-for="group in mxState.groupList.slice().reverse()" :key="group.id" class="group-bet">
        <div class="left">
          <!-- {{ group }} -->
          <Ball :data="play" v-for="play in group.playList" :key="play.id" />
        </div>
        <div class="right">
          <IconSvg icon-class="copy" class="icon" @click="_actions.copy(group)" />
          <IconSvg icon-class="del" class="icon" @click="_actions.del(group)" />
        </div>
      </div>
    </div>
    <div class="footer">
      <div> 當前注數：{{ displayBetsFormatted }} 注 </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.group {
  background: #fff;
  flex: 0 0 185px;
  border: 1px solid #fee2e2;
  border-radius: var(--base-radius);
  height: 185px;
  min-height: 120px;
  max-height: 185px;
  padding: 3px;

  display: flex;
  flex-direction: column;
  gap: 5px;

  .footer {
    height: 23px;
    display: flex;
    justify-content: flex-end;
    background: #fff;
    border-top: 1px solid #fee2e2;
    padding: 4px 7px 0 7px;
    text-align: right;
    font-size: 12px;
    color: var(--color-red-desc);
    z-index: 1;
  }

  .group-list {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: scroll;
    overflow-x: hidden;
    scrollbar-width: thin;
    scrollbar-color: var(--color-red-desc) #e8e6e6;

    display: flex;
    flex-direction: column;
    gap: 3px;

    &::-webkit-scrollbar {
      width: 8px;
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

  .group-bet {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    width: 100%;
    padding-left: 7px;
    padding-right: -3px;

    .left {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: flex-start;
      flex: 1 1 auto;

      :deep(.ball-wrapper) {
        .ball {
          width: 30px;
          height: 30px;
          font-size: 13px;
          border-width: 4px;
          cursor: default;
        }
      }
    }

    .right {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 2px;

      :deep(.icon) {
        cursor: pointer;
        flex: 0 0 auto;
        width: 23px;
        height: 23px;
        color: #f54c07;
        transition: color 0.2s ease;

        &:hover {
          color: var(--color-red-main);
        }

        svg {
          width: 100%;
          height: 100%;
        }
      }
    }

  }
}
</style>
