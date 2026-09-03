<script setup lang="ts">
/** 「遊戲管理」大項底下的常駐左側次導覽：BG彩票／彩運來／經典遊戲／遊戲試算 */
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
  <aside class="agn-aside">
    <div class="admin-en" style="padding:11px 14px 10px">Sub-pages</div>
    <nav class="agn-nav">
      <NuxtLink v-for="item in SUBNAV" :key="item.key" :to="item.path" class="agn-item"
        :class="{ active: item.key === active }">
        <span class="agn-label">{{ item.label }}</span>
        <span class="admin-num agn-path">{{ item.path }}</span>
      </NuxtLink>
    </nav>
  </aside>
</template>

<style scoped lang="scss">
.agn-aside {
  width: 214px;
  flex: none;
  border-top: 1px solid var(--ink);
  position: sticky;
  top: 20px;
}

.agn-nav {
  display: flex;
  flex-direction: column;
}

.agn-item {
  display: flex;
  flex-direction: column;
  gap: 3px;
  width: 100%;
  padding: 12px 14px;
  border: 0;
  border-left: 2px solid transparent;
  cursor: pointer;
  text-align: left;
  background: transparent;
  color: var(--muted);

  &:hover {
    background: var(--wash);
    color: var(--ink);
    text-decoration: none;
  }

  &.active {
    border-left-color: var(--ink);
    background: var(--wash);
    color: var(--ink);
  }
}

.agn-label {
  font-size: 13.5px;
}

.agn-path {
  font-size: 10px;
  opacity: 0.65;
}
</style>
