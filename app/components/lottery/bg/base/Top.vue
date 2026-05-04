<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useAuth } from '~/composables/useAuth'

const router = useRouter()
const { logout } = useAuth()
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
  <section class="top">
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
  border-bottom: 1px solid #f0b7bf;
  background: linear-gradient(180deg, #fdf1f3 0%, #fff 100%);
  box-shadow: 0 2px 8px rgba(131, 38, 50, 0.08);
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
  border: 1px solid var(--color-red-main, #d53f53);
  border-radius: 6px;
  background: #fff;
  color: var(--color-red-main, #d53f53);
  padding: 0.35rem 0.75rem;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.02em;
  text-decoration: none;
  transition: all 0.18s ease;
}

.left :deep(a:hover) {
  background: var(--color-red-main, #d53f53);
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
  color: var(--color-red-desc, #a94452);
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
  border-color: #f0b7bf;
  background: #fff;
  color: var(--color-red-main, #d53f53);
}

.menu .logout-btn {
  border-color: var(--color-red-main, #d53f53);
  background: var(--color-red-main, #d53f53);
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
  border-color: #b02f40;
  background: #b02f40;
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
