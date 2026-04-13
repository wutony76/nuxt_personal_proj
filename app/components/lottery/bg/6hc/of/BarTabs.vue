<script setup lang="ts">
const { state: mxState, handle: mxHandle, click: mxClick } = use6hcOfficial()
</script>

<template>
  <section class="bar-tabs">
    <button v-for="mode in mxHandle.modeList()" :key="mode.key" type="button" class="bar-tabs-btn"
      :class="{ active: mxState.status === mode.key }" @click="mxClick.switch(mode.key)">
      {{ mode.label }}
    </button>
  </section>
</template>

<style scoped lang="scss">
.bar-tabs {
  margin-bottom: 10px;
  display: flex;
  gap: 8px;
  flex-wrap: wrap;

  &-btn {
    border: 1px solid #f3b7bf;
    border-radius: 0.25rem;
    background: #fff5f6;
    padding: 6px 14px;
    font-size: 13px;
    font-weight: 700;
    color: var(--color-red-main);
    cursor: pointer;

    &.active {
      background: var(--color-red-main);
      color: #fff;
      border-color: var(--color-red-main);
    }
  }
}
</style>
