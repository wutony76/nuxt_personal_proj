<script setup lang="ts">
import { type PlayModeKey } from '~/composables/useA6Official'
import { use6hcOfficial } from '~/composables/use6hcOfficial'

const a6 = use6hcOfficial()

const onSwitch = (mode: PlayModeKey) => {
  a6.setMode(mode)
}
</script>

<template>
  <section class="a6-tabs">
    <button
      v-for="mode in a6.modeList"
      :key="mode.key"
      type="button"
      class="tab-btn"
      :class="{ active: a6.state.mode === mode.key }"
      @click="onSwitch(mode.key)"
    >
      {{ mode.label }}
    </button>
  </section>
</template>

<style scoped lang="scss">
.a6-tabs {
  margin-top: 12px;
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.tab-btn {
  border: 1px solid #dfe6ec;
  border-radius: 0.25rem;
  background: #fff;
  padding: 6px 14px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;

  &.active {
    background: #20a0ff;
    color: #fff;
    border-color: #20a0ff;
  }
}
</style>
