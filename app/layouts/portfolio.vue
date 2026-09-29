<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuth } from '~/composables/useAuth'
import { useProjectFonts } from '~/composables/useProjectFonts'

useProjectFonts()

const route = useRoute()
const router = useRouter()
const { user, isLoggedIn, init, logout } = useAuth()

onMounted(async () => {
  await init()
})

const isHome = computed(() => route.path === '/')
const isProject = computed(() => route.path.startsWith('/project'))

const handleLogout = async () => {
  await logout()
  router.push('/')
}
</script>

<template>
  <div class="project-scope pf-shell">
    <!-- ── Header ── -->
    <header class="pf-header">
      <NuxtLink to="/" class="pf-brand">
        HFYY<span class="pf-brand-dot">.</span>
      </NuxtLink>
      <nav class="pf-nav">
        <NuxtLink
          to="/"
          :class="['pf-nav-link', isHome && 'pf-nav-link-active']"
        >首頁</NuxtLink>
        <NuxtLink
          to="/project"
          :class="['pf-nav-link', isProject && 'pf-nav-link-active']"
        >專案</NuxtLink>
        <NuxtLink
          v-if="isLoggedIn"
          to="/lottery-hall"
          class="pf-nav-link"
        >彩票</NuxtLink>
        <NuxtLink
          v-if="isLoggedIn"
          to="/lottery-hall-taiwan"
          class="pf-nav-link"
        >彩運來</NuxtLink>
        <NuxtLink to="/game-hall" class="pf-nav-link">遊戲</NuxtLink>
        <NuxtLink
          v-if="isLoggedIn"
          to="/admin"
          class="pf-nav-link"
        >後台</NuxtLink>
        <NuxtLink
          v-if="!isLoggedIn"
          to="/login"
          class="pf-nav-link"
        >登入</NuxtLink>
        <button
          v-else
          type="button"
          class="pf-nav-user"
          @click="handleLogout"
        >登出 {{ user?.name }}</button>
      </nav>
    </header>

    <!-- ── Page content ── -->
    <slot />

    <!-- ── Footer ── -->
    <footer class="pf-footer">
      <span>© 2026 HappyFatYoYo</span>
      <span>HFYY<span class="pf-brand-dot">.</span></span>
    </footer>
  </div>
</template>
