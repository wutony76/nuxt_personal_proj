<script setup lang="ts">
import type { ToyCatalogItem } from '~/services/api'

defineProps<{
  item: ToyCatalogItem
}>()
</script>

<template>
  <NuxtLink v-if="item.status === 'open' && item.path" :to="item.path" class="shelf-card is-open">
    <span class="shelf-mark">{{ item.mark }}</span>
    <span class="shelf-name">{{ item.name }}</span>
    <span class="shelf-kind">{{ item.kind }}</span>
  </NuxtLink>
  <div v-else class="shelf-card is-soon" aria-disabled="true">
    <span class="shelf-mark">{{ item.mark }}</span>
    <span class="shelf-name">{{ item.name }}</span>
    <span class="shelf-kind">{{ item.kind }}</span>
  </div>
</template>

<style scoped lang="scss">
.shelf-card {
  display: block;
  background: var(--color-neutral-100);
  border: 1px solid var(--color-neutral-300);
  border-radius: var(--radius-md);
  padding: 14px;
  text-align: center;
  text-decoration: none;
  color: inherit;
  box-shadow: var(--shadow-sm);

  &.is-soon {
    opacity: 0.62;
  }
}

.shelf-mark {
  width: 56px;
  height: 56px;
  margin: 0 auto 10px;
  border-radius: 999px;
  background: var(--color-accent-200);
  border: 2px solid var(--color-accent-400);
  display: grid;
  place-items: center;
  font-family: var(--font-heading);
  font-weight: 900;
  font-size: 20px;
  color: var(--color-accent-800);
}

.shelf-name {
  display: block;
  font-family: var(--font-heading);
  font-weight: 900;
  font-size: 16px;
  color: var(--color-neutral-900);
}

.shelf-kind {
  display: block;
  font-size: 11px;
  color: var(--color-neutral-600);
  margin-top: 3px;
}
</style>
