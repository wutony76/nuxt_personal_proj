<script setup>
import { computed } from 'vue'
/**
 * @typedef {import('~/config/bg/6hc-cd').CreditPlayDefinition} CreditPlayDefinition
 */

const props = defineProps({
  /** @type {CreditPlayDefinition[]} */
  plays: {
    type: Array,
    required: true
  },
  selectedKey: {
    type: String,
    required: true
  },
  basePath: {
    type: String,
    default: '/lottery/bg/6hc-cd'
  }
})

const safePlays = computed(() => {
  const list = Array.isArray(props.plays) ? props.plays : []
  return list.filter((item) => item && item.key)
})

</script>

<template>
  <section class="play-tabs">
    <NuxtLink
      v-for="play in safePlays"
      :key="play.key"
      :to="`${props.basePath}/${play.key}`"
      class="tab-btn"
      :class="{ active: play.key === props.selectedKey }">
      <span>{{ play.name }}</span>
      <small>{{ play.key }}</small>
    </NuxtLink>
  </section>
</template>

<style scoped lang="scss">
.play-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  padding: 0.45rem;
  border: 1px solid #e7edf1;
  border-radius: 6px;
  background: #fff;
}

.tab-btn {
  border: 1px solid #d8e2ea;
  border-radius: 4px;
  background: #f9fbfd;
  min-height: 34px;
  padding: 0.2rem 0.55rem;
  display: flex;
  flex-direction: row;
  align-items: baseline;
  justify-content: center;
  gap: 0.35rem;
  color: #4f6778;
  text-decoration: none;
  cursor: pointer;

  small {
    color: #7f94a4;
    font-size: 0.68rem;
    line-height: 1;
  }

  &.active {
    border-color: #2d9fe2;
    background: #2d9fe2;
    color: #fff;

    small {
      color: rgba(255, 255, 255, 0.8);
    }
  }
}
</style>
