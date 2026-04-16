<script setup lang="ts">
import { GAME_6HC_OF } from '~/config/constants'
import Controls from '~/components/lottery/bg/6hc/of/block/controls/Controls.vue'
import Selector from '~/components/lottery/bg/6hc/of/block/Selector.vue'

const { handle: mxHandle } = use6hcOfficial()
const state = reactive({
  status: GAME_6HC_OF.SINGLE.key as string,
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
    <div class="selector-warp">
      <Selector />
      <Controls />
    </div>
  </div>
</template>

<style scoped lang="scss">
.single {
  display: grid;
  gap: 12px;

  .selector-warp {
    display: flex;
    gap: 12px;
    min-height: 300px;
  }
}
</style>
