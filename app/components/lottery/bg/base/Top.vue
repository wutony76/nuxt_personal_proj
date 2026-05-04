<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useAuth } from '~/composables/useAuth'

const router = useRouter()
const { logout } = useAuth()
const props = withDefaults(defineProps<{
  theme?: 'red' | 'blue'
}>(), {
  theme: 'red'
})
const emit = defineEmits<{
  (event: 'open-user-dialog'): void
  (event: 'open-opencode-dialog'): void
}>()

const handleLogout = async () => {
  await logout()
  router.push('/login')
}
</script>

<template>
  <section class="top" :class="props.theme">
    <div class="inner">
      <div class="left">
        <NuxtLink to="/lottery-hall">BACK</NuxtLink>
      </div>
      <div class="right menu">
        <NuxtLink to="/">HOME</NuxtLink>
        <button type="button" class="ghost-btn" @click="emit('open-user-dialog')">USER</button>
        <button type="button" class="ghost-btn" @click="emit('open-opencode-dialog')">OPENCODE</button>
        <button type="button" class="logout-btn" @click="handleLogout">LOGOUT</button>
      </div>
    </div>
  </section>
</template>

<style scoped lang="scss">
.top {
  --top-main: #d53f53;
  --top-desc: #a94452;
  --top-soft-border: #f0b7bf;
  --top-grad-start: #fdf1f3;
  --top-shadow: rgba(131, 38, 50, 0.08);
  --top-hover-main: #b02f40;
  border-bottom: 1px solid var(--top-soft-border);
  background: linear-gradient(180deg, var(--top-grad-start) 0%, #fff 100%);
  box-shadow: 0 2px 8px var(--top-shadow);
}

.top.blue {
  --top-main: #2d9fe2;
  --top-desc: #5f7f95;
  --top-soft-border: #bfd8ea;
  --top-grad-start: #edf6fd;
  --top-shadow: rgba(45, 124, 177, 0.12);
  --top-hover-main: #237db4;
}

.inner {
  margin: 0 auto;
  max-width: 1240px;
  min-height: 56px;
  padding: 0.5rem 0.875rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.left :deep(a) {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  border: 1px solid var(--top-main);
  border-radius: 6px;
  background: #fff;
  color: var(--top-main);
  padding: 0.35rem 0.75rem;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.02em;
  text-decoration: none;
  transition: all 0.18s ease;
}

.left :deep(a:hover) {
  background: var(--top-main);
  color: #fff;
}

.menu {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.menu :deep(a),
.menu .ghost-btn {
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: var(--top-desc);
  padding: 0.35rem 0.55rem;
  font-size: 12px;
  font-weight: 700;
  line-height: 1;
  letter-spacing: 0.02em;
  text-decoration: none;
  cursor: pointer;
  transition: all 0.18s ease;
}

.menu :deep(a:hover),
.menu .ghost-btn:hover {
  border-color: var(--top-soft-border);
  background: #fff;
  color: var(--top-main);
}

.menu .logout-btn {
  border-color: var(--top-main);
  background: var(--top-main);
  color: #fff;
  border-radius: 6px;
  padding: 0.35rem 0.55rem;
  font-size: 12px;
  font-weight: 700;
  line-height: 1;
  letter-spacing: 0.02em;
  cursor: pointer;
  transition: all 0.18s ease;
}

.menu .logout-btn:hover {
  border-color: var(--top-hover-main);
  background: var(--top-hover-main);
  color: #fff;
}

@media (max-width: 640px) {
  .inner {
    min-height: auto;
    flex-direction: column;
    align-items: stretch;
    gap: 0.5rem;
  }

  .left {
    display: flex;
    justify-content: center;
  }

  .menu {
    justify-content: space-between;
  }
}
</style>
