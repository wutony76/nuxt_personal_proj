<script setup lang="ts">
type PlayModeKey = 'single' | 'duplex' | 'dantuo' | 'number'

const use6hc = use6hcOfficial()

const onSwitch = (mode: PlayModeKey) => {
  use6hc.setMode(mode)
}
</script>

<template>
  <section class="bar-tabs">
    <button v-for="mode in use6hc.modeList" :key="mode.key" type="button" class="bar-tabs-btn"
      :class="{ active: use6hc.state.mode === mode.key }" @click="onSwitch(mode.key)">
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
