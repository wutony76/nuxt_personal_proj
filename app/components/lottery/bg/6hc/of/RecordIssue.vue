<script setup lang="ts">
import report from '~/components/lottery/bg/6hc/of/ReportIssueBets.vue'


</script>

<template>
  <div class="block-main record-issue">
    <div class="header"> 當期注單 </div>
    <div class="main">
      <report />
    </div>
  </div>
</template>

<style scoped lang="scss">
.record-issue {
  width: 60%;
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  background: #fff;

  .header,
  .main {
    width: 100%;
    white-space: normal;
    overflow-wrap: anywhere;
  }

  .header {
    // padding-bottom: 6px;
    // border-bottom: 1px solid var(--color-red-700);
    font-size: 14px;
    font-weight: 700;
    color: var(--color-red-main);
  }

  .main {
    flex: 1 1 auto;
    min-height: 0;
    min-width: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
  }

}
</style>