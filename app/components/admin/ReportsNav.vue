<script setup>
const props = defineProps({
  active: {
    type: String,
    default: ''
  }
})

const NAV = [
  { key: 'dashboard', label: '總覽', en: 'Overview', path: '/admin/reports' },
  { key: 'sales', label: '銷售', en: 'Sales', path: '/admin/reports/sales' },
  { key: 'plays', label: '玩法', en: 'Plays', path: '/admin/reports/plays' },
  { key: 'settlement', label: '結算 / 月', en: 'Settlement', path: '/admin/reports/settlement' },
  { key: 'fcoin', label: '兌F幣', en: 'F Coin', path: '/admin/reports/fcoin' },
]
</script>

<template>
  <div class="arn-tabs">
    <NuxtLink v-for="item in NAV" :key="item.key" :to="item.path" class="arn-tab"
      :class="{ active: item.key === props.active }">
      <span>{{ item.label }}</span>
      <span class="admin-en arn-tab-en">{{ item.en }}</span>
    </NuxtLink>
  </div>
</template>

<style scoped lang="scss">
.arn-tabs {
  display: flex;
  gap: 2px;
  border-bottom: 1px solid var(--line);
  margin-bottom: 32px;
  flex-wrap: wrap;
}

.arn-tab {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 16px;
  height: 40px;
  font-size: 13px;
  border: 0;
  background: transparent;
  color: var(--muted);
  border-bottom: 2px solid transparent;
  cursor: pointer;
  margin-bottom: -1px;
  text-decoration: none;
  white-space: nowrap;

  &:hover {
    color: var(--ink);
    background: var(--wash);
    text-decoration: none;
  }

  &.active {
    color: var(--ink);
    border-bottom-color: var(--ink);
  }
}

.arn-tab-en {
  font-size: 8px;
  opacity: 0.5;
}
</style>
