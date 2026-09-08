<script setup lang="ts">
/**
 * 角色權限頁 aside：橫列捷徑，捲動至當頁各區塊，比照 OverviewPageNav.vue。
 */
type NavItem = {
  id: string
  en: string
  label: string
}

const ITEMS: NavItem[] = [
  { id: 'ar-members', en: 'List', label: '列表' },
  { id: 'ar-roles', en: 'Roles', label: '角色' },
  { id: 'ar-games', en: 'Games', label: '遊戲' }
]

const click = {
  scrollTo: (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}
</script>

<template>
  <nav class="arpn" aria-label="角色權限頁面捷徑">
    <button v-for="item in ITEMS" :key="item.id" type="button" class="arpn-card admin-panel"
      @click="click.scrollTo(item.id)">
      <span class="arpn-en-slot">
        <span class="admin-en arpn-en">{{ item.en }}</span>
      </span>
      <span class="arpn-label">{{ item.label }}</span>
    </button>
  </nav>
</template>

<style scoped lang="scss">
.arpn {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: 6px;
}

.arpn-card {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  justify-content: center;
  gap: 2px;
  min-width: 40px;
  min-height: 50px;
  padding: 4px 8px;
  border: 0;
  cursor: pointer;
  text-align: center;
  color: inherit;
  font-family: inherit;
  transition: background 0.12s;

  &:not(:last-child) {
    border-right: 1px solid var(--line);
    margin-right: 2px;
    padding-right: 10px;
  }

  &:hover {
    background: var(--wash);
  }
}

.arpn-en-slot {
  flex: none;
  width: 12px;
  height: 36px;
  position: relative;
  overflow: visible;
}

.arpn-en {
  position: absolute;
  top: 0;
  left: 0;
  font-size: 7px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  line-height: 1;
  white-space: nowrap;
  transform-origin: top left;
  transform: translateX(10%) rotate(90deg);
}

.arpn-label {
  flex: none;
  font-size: 12px;
  font-weight: 700;
  line-height: 1;
  writing-mode: vertical-rl;
  text-orientation: upright;
  letter-spacing: 0.06em;
}
</style>
