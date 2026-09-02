<script setup lang="ts">
/**
 * 總覽頁 .ash-page-header 右側：橫列捷徑，捲動至當頁各區塊。
 */
type NavItem = {
  id: string
  en: string
  label: string
}

const ITEMS: NavItem[] = [
  { id: 'ao-chat', en: 'Chat', label: '聊天室' },
  { id: 'ao-members', en: 'Members', label: '會員' },
  { id: 'ao-perms', en: 'Access', label: '權限' },
  { id: 'ao-cards', en: 'Go', label: '前往' }
]

const click = {
  scrollTo: (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}
</script>

<template>
  <nav class="aopn" aria-label="總覽頁面捷徑">
    <button v-for="item in ITEMS" :key="item.id" type="button" class="aopn-card admin-panel"
      @click="click.scrollTo(item.id)">
      <span class="aopn-en-slot">
        <span class="admin-en aopn-en">{{ item.en }}</span>
      </span>
      <span class="aopn-label">{{ item.label }}</span>
    </button>
  </nav>
</template>

<style scoped lang="scss">
.aopn {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: 6px;
}

.aopn-card {
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

.aopn-en-slot {
  flex: none;
  width: 12px;
  height: 36px;
  position: relative;
  overflow: visible;
}

.aopn-en {
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

.aopn-label {
  flex: none;
  font-size: 12px;
  font-weight: 700;
  line-height: 1;
  writing-mode: vertical-rl;
  text-orientation: upright;
  letter-spacing: 0.06em;
}
</style>
