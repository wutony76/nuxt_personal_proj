<script setup lang="ts">
defineProps<{
  balance: number
}>()

const formatted = (value: number) => Number(value).toLocaleString('zh-TW')
</script>

<template>
  <header class="toy-header">
    <NuxtLink to="/lottery-hall-taiwan#tw-shelf" class="toy-back">轉去大廳</NuxtLink>
    <span class="toy-coin">F 幣 {{ formatted(balance) }}</span>
  </header>
</template>

<style scoped lang="scss">
.toy-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 18px;
  background: var(--color-neutral-900, #2e2b25);
  color: var(--color-bg, #f5ead8);
}

.toy-back {
  color: inherit;
  text-decoration: none;
  font-family: var(--font-heading, serif);
  font-weight: 900;
}

.toy-coin {
  font-weight: 700;
}
</style>
