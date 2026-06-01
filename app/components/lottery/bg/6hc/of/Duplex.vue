<script setup lang="ts">
import { GAME_6HC_OF } from '~/config/constants'
import Controls from '~/components/lottery/bg/6hc/of/block/controls/index.vue'
import Selector from '~/components/lottery/bg/6hc/of/block/Selector.vue'

const { handle: mxHandle } = use6hcOfficial()
const state = reactive({
  status: GAME_6HC_OF.DUPLEX.key as string,
})
const init = {
  run: () => {
    console.log('TTT2.UI duplex init', state.status)
    mxHandle.newGame(state.status)
  }
}
onMounted(() => {
  init.run()
})

</script>

<template>
  <div class="duplex">
    <div class="selector-warp">
      <Selector />
      <Controls />
    </div>
  </div>
</template>

<style scoped lang="scss">
.duplex {
  display: grid;
  gap: 12px;

  .selector-warp {
    display: flex;
    gap: 12px;
    min-height: 300px;
  }
}
</style>
