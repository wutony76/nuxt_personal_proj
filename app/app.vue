<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuth } from './composables/useAuth'

const route = useRoute()
const router = useRouter()
const { user, isLoggedIn, init, logout } = useAuth()
const isImmersiveGameRoute = computed(() => route.path.startsWith('/game/'))

onMounted(() => {
  init()
})

const handleLogout = () => {
  logout()
  router.push('/')
}
</script>

<template>
  <div :class="isImmersiveGameRoute ? 'min-h-screen bg-black' : 'min-h-screen bg-slate-50'">
    <NuxtRouteAnnouncer />
    <AppTopbar
      v-if="!isImmersiveGameRoute"
      :is-logged-in="isLoggedIn"
      :user-name="user?.name"
      @logout="handleLogout"
    />

    <NuxtPage />
  </div>
</template>
