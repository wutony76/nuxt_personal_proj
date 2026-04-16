<script setup lang="ts">
import AnalyzeBalls from '~/components/lottery/bg/6hc/of/block/analyze/AnalyzeBalls.vue'
import AnalyzeIssueBets from '~/components/lottery/bg/6hc/of/block/analyze/AnalyzeIssueBets.vue'
</script>

<template>
  <div class="record-analyze">
    <AnalyzeBalls />
    <AnalyzeIssueBets />
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
  // border: 1px solid var(--color-red-700);
  // border-radius: var(--base-radius);
}
</style>