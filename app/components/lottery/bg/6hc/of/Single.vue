<script setup lang="ts">
import { GAME_6HC_OF } from '~/config/constants'
import Ball from '~/components/lottery/bg/6hc/of/Ball.vue'

const { state: mxState, handle: mxHandle } = use6hcOfficial()
const state = reactive({
  status: GAME_6HC_OF.SINGLE as String,
  groupList: [],
})
const init = {
  run: () => {
    mxHandle.newGame(state.status)
  }
}

onMounted(() => {
  init.run()
})

</script>

<template>
  <div class="single">
    <div class="selector-warp" style="border: 1px solid red; min-height: 150px; display: flex;">
      <div class="selector" style="border: 1px solid blue; width:70%; height: 100%;">
        <div
          style="height: 30px; border-bottom: 1px solid green; display: flex; align-items: center; padding-left: 10px;">
          請選擇號碼</div>
        <div class="grid" style="display: grid; grid-template-columns: repeat(10, 1fr); gap: 10px;">
          <Ball v-for="item in mxState.playlist" :key="item.id" :data="item" />
        </div>
      </div>

      <div class="controls" style="flex: 1;">
        <div>
          <button> 隨機選注 </button>
          <button> 隨機選注 </button>
          <button> 清空 </button>
        </div>
      </div>

    </div>
  </div>
</template>

<style scoped lang="scss">
.single {
  display: grid;
  gap: 12px;
}
</style>
