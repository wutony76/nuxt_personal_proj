<script setup lang="ts">
/**
 * NPC 頁 aside：橫列捷徑，捲動至當頁各區塊，比照 RolesPageNav.vue。
 */
type NavItem = {
  id: string
  en: string
  label: string
}

const ITEMS: NavItem[] = [
  // { id: 'np-overview', en: 'Overview', label: '總覽' },
  { id: 'np-activity-log', en: 'Activity', label: '活動日誌' },
  { id: 'np-global-settings', en: 'Global', label: '全域設定' },
  { id: 'np-members', en: 'Members', label: 'NPC' }
]

const click = {
  scrollTo: (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}
</script>

<template>
  <nav class="npn" aria-label="NPC 頁面捷徑">
    <button v-for="item in ITEMS" :key="item.id" type="button" class="npn-card admin-panel"
      @click="click.scrollTo(item.id)">
      <span class="npn-en-slot">
        <span class="admin-en npn-en">{{ item.en }}</span>
      </span>
      <span class="npn-label">{{ item.label }}</span>
    </button>
  </nav>
</template>

<style scoped lang="scss">
.npn {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: 6px;
}

.npn-card {
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

.npn-en-slot {
  flex: none;
  width: 12px;
  height: 36px;
  position: relative;
  overflow: visible;
}

.npn-en {
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

.npn-label {
  flex: none;
  font-size: 12px;
  font-weight: 700;
  line-height: 1;
  writing-mode: vertical-rl;
  text-orientation: upright;
  letter-spacing: 0.06em;
}
</style>
