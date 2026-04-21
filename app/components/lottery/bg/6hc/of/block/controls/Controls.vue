<script setup lang="ts">
import { cloneDeep } from 'lodash'
import { _uuid2 } from 'serv/utils/encrypt'
import ControlGroup from './ControlGroup.vue';
import ControlCoin from './ControlCoin.vue'
import { GAME_6HC_OF } from '~/config/constants'

const { $dialog } = useNuxtApp()

const props = withDefaults(defineProps<{
  hint?: string
}>(), {
  hint: '單式玩法需選 7 碼'
})

const { state: mxState, handle: mxHandle } = use6hcOfficial()

const handle = {
  random: (max = 7) => {
    const targetCount = Math.max(1, Math.min(mxState.playList.length, Number(max) || 7))
    const selectedSet = new Set(
      mxState.playList.filter((item) => item.selected).map((item) => Number(item.num))
    )

    // 如果已達到需求數量，改為整組重新隨機。
    if (selectedSet.size >= targetCount) {
      const nextSet = new Set(
        [...mxState.playList]
          .sort(() => Math.random() - 0.5)
          .slice(0, targetCount)
          .map((item) => Number(item.num))
      )

      const next = mxState.playList.map((item) => ({ ...item, selected: nextSet.has(Number(item.num)) }))
      mxState.playList = next
      return
    }

    const needCount = targetCount - selectedSet.size
    const candidates = mxState.playList
      .filter((item) => !selectedSet.has(Number(item.num)))
      .sort(() => Math.random() - 0.5)
      .slice(0, needCount)

    candidates.forEach((item) => {
      selectedSet.add(Number(item.num))
    })

    const next = mxState.playList.map((item) => ({ ...item, selected: selectedSet.has(Number(item.num)) }))
    mxState.playList = next
  }
}

const click = {
  random: () => {
    switch (mxState.status) {
      case GAME_6HC_OF.SINGLE.key:
        handle.random(7)
        break
      case GAME_6HC_OF.DUPLEX.key:
        // mxHandle.randomSelect(8)
        break
    }
  },
  clear: () => {
    mxHandle.clearSelect()
  },
  add: () => {
    const _count = mxState.isSelector.length
    const _limit = mxState.limit.max
    if (_count !== _limit) return $dialog.alert('單式玩法需選 7 碼')
    const _bet = {
      hashKey: _uuid2(),
      playList: cloneDeep(mxState.isSelector),
    }
    mxState.groupList.push(_bet)
    mxHandle.clearSelect()
  }
}

</script>

<template>
  <div class="controls">
    <div class="controls-actions">
      <div class="left">
        <button type="button" class="action-btn" @click="click.random()">隨機選號</button>
        <button type="button" class="action-btn" @click="click.add()">加入</button>
      </div>
      <div class="right">
        <button type="button" class="action-btn ghost" @click="click.clear()">清空</button>
      </div>
    </div>

    <div class="hint">{{ props.hint }}</div>
    <!-- <div class="group"> </div> -->
    <ControlGroup />
    <ControlCoin />
  </div>
</template>

<style scoped lang="scss">
.controls {
  background: #fff7f8;
  display: flex;
  flex-direction: column;
  flex: 0 0 28%;
  width: 28%;
  min-width: 0;
  border: 1px solid #fee2e2;
  border-radius: 6px;
  padding: 12px;
  gap: 12px;

  .controls-actions {
    display: flex;
    justify-content: space-between;

    .left {
      display: flex;
      gap: 8px;
    }

    .action-btn {
      border: 1px solid var(--color-red-main);
      border-radius: 4px;
      background: var(--color-red-main);
      color: #fff;
      padding: 6px 12px;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;

      &.ghost {
        background: #fff;
        color: var(--color-red-main);
      }
    }
  }

  .hint {
    font-size: 12px;
    line-height: 1.4;
    color: var(--color-red-desc);
  }


}
</style>