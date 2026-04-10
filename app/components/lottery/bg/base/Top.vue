<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useAuth } from '~/composables/useAuth'

const router = useRouter()
const { logout } = useAuth()

const handleLogout = () => {
  logout()
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
        <NuxtLink to="/">USER</NuxtLink>
        <NuxtLink to="/">OPENCODE</NuxtLink>
        <button type="button" @click="handleLogout">LOGOUT</button>
      </div>
    </div>
  </section>
</template>
