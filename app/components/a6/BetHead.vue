<script setup lang="ts">
import { use6hcOfficial } from '~/composables/use6hcOfficial'

const a6 = use6hcOfficial()
</script>

<template>
  <div class="block-bet-head">
    <h2>{{ a6.currentRule.label }}</h2>
    <p>{{ a6.currentRule.hint }}</p>
  </div>
</template>

<style scoped lang="scss">
.block-bet-head {
  min-height: 3rem;
  border-bottom: 1px solid #dfe6ec;
  padding: 20px;

  h2 {
    margin: 0;
    font-size: 17px;
    color: #333;
  }

  p {
    margin: 4px 0 0;
    color: #777;
    font-size: 13px;
  }
}
</style>
