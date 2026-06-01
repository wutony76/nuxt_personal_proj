<script setup lang="ts">
import { GAME_6HC_OF } from '~/config/constants'
import Ball from '~/components/lottery/bg/6hc/of/base/Ball.vue'

const { $dialog } = useNuxtApp()
const { state: mxState } = use6hcOfficial()

const selectedCount = computed(() => {
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
        // console.log('TTT2.UI select duplex', play)
        const _selected = play.selected
        const _id = play.id
        play.selected = !play.selected
        if (_id === 50) _handle.selectAll(!_selected)
        break
      }
      case GAME_6HC_OF.DANTUO.key:
        break
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
    <div class="grid">
      <button v-for="play in mxState.playList" :key="play.id" type="button" class="ball-btn"
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

.grid {
  display: grid;
  margin-top: 30px;
  grid-template-columns: repeat(10, minmax(0, 1fr));
  align-items: center;
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
}
</style>