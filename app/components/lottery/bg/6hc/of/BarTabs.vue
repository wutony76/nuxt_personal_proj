<script setup lang="ts">
import { type PlayModeKey } from '~/composables/useA6Official'
import { use6hcOfficial } from '~/composables/use6hcOfficial'

const use6hc = use6hcOfficial()

const onSwitch = (mode: PlayModeKey) => {
  use6hc.setMode(mode)
}
</script>

<template>
  <section class="tabs">
    <button v-for="mode in use6hc.modeList" :key="mode.key" type="button" class="tab-btn"
      :class="{ active: use6hc.state.mode === mode.key }" @click="onSwitch(mode.key)">
      {{ mode.label }}
    </button>
  </section>
</template>

<style scoped lang="scss">
.tabs {
  margin-top: 12px;
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.tab-btn {
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
</style>
