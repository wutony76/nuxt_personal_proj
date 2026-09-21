<script setup lang="ts">
import type { ToyCatalogItem } from '~/services/api'

defineProps<{
  item: ToyCatalogItem
}>()

const emit = defineEmits<{
  open: []
}>()
</script>

<template>
  <button v-if="item.status === 'open' && item.path" type="button" class="shelf-card is-open" @click="emit('open')">
    <span class="shelf-card-top" />
    <span class="shelf-mark">{{ item.mark }}</span>
    <span class="shelf-name">{{ item.name }}</span>
    <span class="shelf-kind">{{ item.kind }}</span>
    <span class="shelf-blurb">{{ item.blurb }}</span>
  </button>
  <div v-else class="shelf-card is-soon" aria-disabled="true">
    <span class="shelf-mark">{{ item.mark }}</span>
    <span class="shelf-name">{{ item.name }}</span>
    <span class="shelf-kind">{{ item.kind }}</span>
    <span class="shelf-blurb">{{ item.blurb }}</span>
    <span class="shelf-soon-tag">敬請期待</span>
  </div>
</template>

<style scoped lang="scss">
.shelf-card {
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  font: inherit;
  cursor: pointer;
  background: var(--color-bg, #f5ead8);
  border: 1px solid var(--color-accent-300, #ffc6a5);
  border-radius: 13px;
  padding: 16px 12px 14px;
  text-align: center;
  text-decoration: none;
  color: inherit;
  box-shadow: var(--shadow-sm);
  transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;

  &.is-open:hover {
    transform: translateY(-4px);
    border-color: var(--color-accent-500, #d67f48);
    box-shadow: var(--shadow-md);
  }

  &.is-open:active {
    transform: translateY(-1px);
  }

  &.is-soon {
    opacity: 0.7;
    cursor: default;
    background: var(--color-neutral-200, #ede4d3);
  }
}

/* 木紋裝飾條：暖色系底 + 兩層不同疏密的木紋線疊出來 */
.shelf-card-top {
  position: absolute;
  inset: 0 0 auto 0;
  height: 7px;
  background:
    repeating-linear-gradient(90deg,
      rgba(64, 35, 16, 0.35) 0px, rgba(64, 35, 16, 0.35) 1px,
      transparent 1px, transparent 5px),
    repeating-linear-gradient(90deg,
      rgba(64, 35, 16, 0.18) 0px, rgba(64, 35, 16, 0.18) 2px,
      transparent 2px, transparent 11px),
    linear-gradient(90deg,
      var(--color-accent-500, #d67f48),
      var(--color-accent-600, #b2622d) 35%,
      var(--color-accent-700, #8c491a) 65%,
      var(--color-accent-600, #b2622d));
  box-shadow: inset 0 -1px 0 rgba(64, 35, 16, 0.4);
}

.shelf-mark {
  width: 56px;
  height: 56px;
  margin: 10px auto 10px;
  border-radius: 999px;
  background: var(--color-accent-200, #ffe1d0);
  border: 2px solid var(--color-accent-400, #f6a06b);
  box-shadow: inset 0 0 0 3px var(--color-bg, #f5ead8);
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
  font-size: 17px;
  color: var(--color-neutral-900);
}

.shelf-kind {
  display: inline-block;
  margin-top: 6px;
  padding: 2px 10px;
  border-radius: 999px;
  background: var(--color-accent-2-100, #f0fae1);
  color: var(--color-accent-2-800, #3d472b);
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.04em;
}

.shelf-blurb {
  display: block;
  margin-top: 8px;
  font-size: 11.5px;
  line-height: 1.5;
  color: var(--color-neutral-600, #82796a);
}

.shelf-soon-tag {
  position: absolute;
  top: 10px;
  right: -28px;
  width: 110px;
  transform: rotate(38deg);
  background: var(--color-accent-2-700, #56633f);
  color: var(--color-bg, #f5ead8);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  padding: 3px 0;
  box-shadow: var(--shadow-sm);
}
</style>
