<script setup lang="ts">
import { cloneDeep } from 'lodash'
import { _uuid2 } from 'serv/utils/encrypt'
import Group from './Group.vue'
import Coin from './Coin.vue'
import { GAME_6HC_OF } from '~/config/constants'

const { $dialog } = useNuxtApp()

const props = withDefaults(defineProps<{
  hint?: string
}>(), {
  hint: '單式玩法需選 6 碼'
})

const { state: mxState, handle: mxHandle } = use6hcOfficial()

const _handlers = {
  random: (max = 6) => {
    const targetCount = Math.max(1, Math.min(mxState.playList.length, Number(max) || 6))
    const selectedSet = new Set(
      mxState.playList.filter((item) => item.selected).map((item) => Number(item.num))
    )

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

const _actions = {
  random: () => {
    switch (mxState.status) {
      case GAME_6HC_OF.SINGLE.key:
        _handlers.random(6)
        break
      case GAME_6HC_OF.DUPLEX.key: {
        const pool = mxState.playList.filter((item) => item.id !== 50)
        const selectedCount = pool.filter((item) => item.selected).length
        if (selectedCount >= 20) {
          // 超過 20：全換新的 6 個隨機號
          const picked = new Set(
            [...pool].sort(() => Math.random() - 0.5).slice(0, 6).map((item) => Number(item.num))
          )
          mxState.playList = mxState.playList.map((item) => ({
            ...item,
            selected: item.id !== 50 ? picked.has(Number(item.num)) : item.selected
          }))
        } else if (selectedCount < 6) {
          // 補齊到 6 個
          const need = 6 - selectedCount
          const candidates = pool
            .filter((item) => !item.selected)
            .sort(() => Math.random() - 0.5)
            .slice(0, need)
          const toAdd = new Set(candidates.map((item) => Number(item.num)))
          mxState.playList = mxState.playList.map((item) => ({
            ...item,
            selected: item.id !== 50
              ? item.selected || toAdd.has(Number(item.num))
              : item.selected
          }))
        } else {
          // 滿 6 未滿 20：再加 1
          const extra = pool
            .filter((item) => !item.selected)
            .sort(() => Math.random() - 0.5)
            .slice(0, 1)
          if (extra.length > 0) {
            const addNum = Number(extra[0].num)
            mxState.playList = mxState.playList.map((item) => ({
              ...item,
              selected: item.id !== 50
                ? item.selected || Number(item.num) === addNum
                : item.selected
            }))
          }
        }
        break
      }
    }
  },
  clear: () => {
    mxHandle.clearSelect()
  },
  add: () => {
    switch (mxState.status) {
      case GAME_6HC_OF.SINGLE.key: {
        const _count = mxState.isSelector.length
        const _limit = mxState.limit.max
        if (_count !== _limit) return $dialog.alert('單式玩法需選 6 碼')
        const _bet = {
          hashKey: _uuid2(),
          playList: cloneDeep(mxState.isSelector),
        }
        mxState.groupList.push(_bet)
        mxHandle.clearSelect()
        break
      }
      case GAME_6HC_OF.DUPLEX.key:
        break
    }


  }
}

</script>

<template>
  <div class="controls">
    <div class="controls-actions">
      <div class="left">
        <button type="button" class="action-btn" @click="_actions.random()">隨機選號</button>
        <button type="button" class="action-btn" @click="_actions.add()">加入</button>
      </div>
      <div class="right">
        <button type="button" class="action-btn ghost" @click="_actions.clear()">清空</button>
      </div>
    </div>

    <div class="hint">{{ props.hint }}</div>
    <Group />
    <Coin />
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
