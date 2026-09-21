<script setup lang="ts">
/** 「遊戲管理」大項底下的常駐橫向次導覽：BG彩票／彩運來／經典遊戲／遊戲試算 */
defineProps<{
  active: 'bg' | 'taiwan' | 'games' | 'simulator'
}>()

const SUBNAV = [
  { key: 'bg' as const, label: 'BG彩票', en: 'BG Lottery', path: '/admin/bg-lottery' },
  { key: 'taiwan' as const, label: '彩運來', en: 'Taiwan Lottery', path: '/admin/taiwan-lottery' },
  { key: 'games' as const, label: '經典遊戲', en: 'Retro Games', path: '/admin/games' },
  { key: 'simulator' as const, label: '遊戲試算', en: 'Simulator', path: '/admin/game-simulator' }
]
</script>

<template>
  <div class="agn-tabs">
    <NuxtLink v-for="item in SUBNAV" :key="item.key" :to="item.path" class="agn-tab"
      :class="{ active: item.key === active }">
      <span>{{ item.label }}</span>
      <span class="admin-en agn-tab-en">{{ item.en }}</span>
    </NuxtLink>
  </div>
</template>

<style scoped lang="scss">
.agn-tabs {
  display: flex;
  gap: 2px;
  border-bottom: 1px solid var(--line);
  margin-bottom: 32px;
  flex-wrap: wrap;
}

.agn-tab {
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

.agn-tab-en {
  font-size: 8px;
  opacity: 0.5;
}
</style>
