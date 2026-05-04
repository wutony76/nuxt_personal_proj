<script setup lang="ts">
import Balls from '~/components/lottery/bg/6hc/of/block/analyze/Balls.vue'
import IssueBets from '~/components/lottery/bg/6hc/of/block/analyze/IssueBets.vue'
</script>

<template>
  <div class="record-analyze">
    <Balls />
    <IssueBets />
  </div>
</template>

<style scoped lang="scss">
.record-analyze {
  flex: 1 1 40%;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
</style>
