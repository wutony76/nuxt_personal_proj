<script setup lang="ts">
import Ball from '~/components/lottery/bg/6hc/of/base/Ball.vue'

const { $dialog } = useNuxtApp()
const { state: mxState, handle: mxHandle } = use6hcOfficial()

const selectedCount = computed(() => {
  return mxState.isSelector.length
})

const click = {
  select: (play: any) => {
    const _select = play.selected
    if (!_select && mxState.limit.max === mxState.isSelector.length) return $dialog.alert('此注選號已滿')
    play.selected = !play.selected
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
        @click="click.select(play)">
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
  grid-template-columns: repeat(10, minmax(0, 1fr));
  gap: 10px;
  padding: 12px;
}

.ball-btn {
  border: 0;
  background: transparent;
  padding: 0;
  cursor: pointer;
}
</style>