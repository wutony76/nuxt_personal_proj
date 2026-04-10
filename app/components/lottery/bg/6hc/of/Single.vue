<script setup lang="ts">
import { GAME_6HC_OF } from '~/config/constants'

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
    SINGLE
    <div class="selector-warp" style="border: 1px solid red; min-height: 150px; display: flex;">
      <div class="selector" style="border: 1px solid blue; width:70%; height: 100%;">
        <div
          style="height: 30px; border-bottom: 1px solid green; display: flex; align-items: center; padding-left: 10px;">
          請選擇號碼</div>
        <div class="grid" style="display: grid; grid-template-columns: repeat(10, 1fr); gap: 10px;">
          <div>

            {{ mxState.playlist }}
          </div>
          <div> 1</div>
          <div> 2</div>
          <div> 3</div>
          <div> 4</div>
          <div> 5</div>
          <div> 6</div>
          <div> 7</div>
          <div> 8</div>
          <div> 9</div>
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
