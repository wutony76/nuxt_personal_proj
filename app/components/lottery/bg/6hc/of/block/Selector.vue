<script setup lang="ts">
import { GAME_6HC_OF } from '~/config/constants'
import Ball from '~/components/lottery/bg/6hc/of/base/Ball.vue'

const { $dialog } = useNuxtApp()
const { state: mxState, danSelector, tuoSelector } = use6hcOfficial()

const dantuoMode = ref<'dan' | 'tuo'>('dan')

const _all1to49Selected = computed(() =>
  mxState.playList
    .filter((p: any) => p.id !== 50)
    .every((p: any) => p.selected)
)

watch(_all1to49Selected, (allSelected) => {
  if (mxState.status !== GAME_6HC_OF.DUPLEX.key) return
  const ball50 = mxState.playList.find((p: any) => p.id === 50)
  if (ball50) ball50.selected = allSelected
})

const selectedCount = computed(() => {
  if (mxState.status === GAME_6HC_OF.DANTUO.key) {
    return `膽:${danSelector.value.length} 拖:${tuoSelector.value.length}`
  }
  return mxState.isSelector.length
})

const _handle = {
  selectAll: (selected: boolean) => {
    mxState.playList.forEach((play) => {
      play.selected = selected
    })
  }
}

const _actions = {
  select: (play: any) => {
    switch (mxState.status) {
      case GAME_6HC_OF.SINGLE.key:
        const _select = play.selected
        if (!_select && mxState.limit.max === mxState.isSelector.length) return $dialog.alert('此注選號已滿')
        play.selected = !play.selected
        break
      case GAME_6HC_OF.DUPLEX.key: {
        const _selected = play.selected
        const _id = play.id
        play.selected = !play.selected
        if (_id === 50) _handle.selectAll(!_selected)
        break
      }
      case GAME_6HC_OF.DANTUO.key: {
        if (dantuoMode.value === 'dan') {
          if (play.id === 50) return
          if (play.tuoSelected) return $dialog.alert('此號已選為拖碼，不可重複選為膽碼')
          if (!play.danSelected && danSelector.value.length >= 5) return $dialog.alert('膽碼最多選 5 碼')
          play.danSelected = !play.danSelected
        } else {
          if (play.id === 50) {
            const newState = !play.tuoSelected
            play.tuoSelected = newState
            mxState.playList.forEach((b: any) => {
              if (b.id !== 50 && !b.danSelected) b.tuoSelected = newState
            })
          } else {
            if (play.danSelected) return $dialog.alert('此號已選為膽碼，不可重複選為拖碼')
            play.tuoSelected = !play.tuoSelected
          }
        }
        break
      }
    }
  }
}

</script>

<template>
  <div class="selector">
    <div class="head">
      <span>請選擇號碼</span>
      <span class="picked">已選 {{ selectedCount }} 碼</span>
    </div>

    <div v-if="mxState.status === 'DANTUO'" class="dantuo-tabs">
      <button type="button" class="tab-btn" :class="{ active: dantuoMode === 'dan' }"
        @click="dantuoMode = 'dan'"><span>膽</span>
      </button>
      <button type="button" class="tab-btn tuo" :class="{ active: dantuoMode === 'tuo' }"
        @click="dantuoMode = 'tuo'"><span>拖</span>
      </button>
    </div>

    <div class="grid">
      <button v-for="play in mxState.playList" :key="play.id" type="button" class="ball-btn"
        :class="{ 'ball-hidden': play.id === 50 && mxState.status === GAME_6HC_OF.DANTUO.key && dantuoMode === 'dan' }"
        @click="_actions.select(play)">
        <Ball :data="play" />
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.selector {
  width: 72%;
  background: #fff;
  border: 1px solid #fee2e2;
  border-radius: 6px;
  overflow: hidden;
  display: flex;
  flex-direction: column;

  .head {
    height: 36px;
    background: var(--color-red-bets);
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid var(--color-red-bets);
    padding: 0 12px;
    font-size: 13px;
    font-weight: 600;

    .picked {
      color: var(--color-yellow-text);
      font-size: 12px;
    }
  }
}

.dantuo-tabs {
  display: flex;
  height: 36px;
  width: fit-content;
  margin-top: 15px;
  margin-left: auto;
  margin-right: 20px;
  border: 1px solid var(--color-red-desc);
  border-radius: 6px;

  .tab-btn {
    flex: 0 0 auto;
    width: 36px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 5px 0;
    font-size: 13px;
    font-weight: 700;
    line-height: 1.3;
    border: none;
    border-right: 1px solid var(--color-red-desc);
    // background: #fff;
    color: var(--color-red-desc);
    cursor: pointer;
    transition: background 0.15s, color 0.15s;

    &:last-child {
      border-right: none;
    }

    &.active {
      background: var(--color-red-desc);
      color: #fff;
      // color: var(--color-yellow-text);
    }

    // &.tuo.active {
    //   background: rgba(29, 111, 168, 0.08);
    //   color: #1d6fa8;
    // }
  }
}

.grid {
  flex: 1;
  display: grid;
  margin-top: 0;
  grid-template-columns: repeat(10, minmax(0, 1fr));
  align-items: center;
  align-content: center;
  gap: 10px;
  padding: 12px;
}

.ball-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  border: 0;
  background: transparent;
  padding: 0;
  cursor: pointer;

  &.ball-hidden {
    visibility: hidden;
    pointer-events: none;
  }
}
</style>