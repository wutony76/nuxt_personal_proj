<script setup lang="ts">
defineProps<{
  isLoggedIn: boolean
  userName?: string
}>()

defineEmits<{
  logout: []
}>()
</script>

<template>
  <header class="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
    <div class="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-3">
      <NuxtLink to="/" class="text-base font-bold text-slate-900"> HAPPY-FAT-YOYO </NuxtLink>

      <nav class="flex items-center gap-2 sm:gap-3">
        <NuxtLink to="/" class="rounded-md px-2 py-1 text-slate-900 hover:bg-indigo-50">
          首頁
        </NuxtLink>
        <NuxtLink v-if="isLoggedIn" to="/lottery-hall" class="rounded-md px-2 py-1 text-slate-900 hover:bg-indigo-50">
          彩票
        </NuxtLink>
        <NuxtLink v-if="isLoggedIn" to="/taiwan-lottery-hall"
          class="rounded-md px-2 py-1 text-slate-900 hover:bg-indigo-50">
          台彩
        </NuxtLink>
        <NuxtLink to="/game-hall" class="rounded-md px-2 py-1 text-slate-900 hover:bg-indigo-50">
          遊戲
        </NuxtLink>
        <NuxtLink v-if="isLoggedIn" to="/admin" class="rounded-md px-2 py-1 text-slate-900 hover:bg-indigo-50">
          後台
        </NuxtLink>
        <NuxtLink v-if="!isLoggedIn" to="/login"
          class="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-slate-800">
          登入
        </NuxtLink>
        <button v-else type="button" class="rounded-md px-2 py-1 text-slate-900 hover:bg-indigo-50"
          @click="$emit('logout')">
          登出 {{ userName }}
        </button>
      </nav>
    </div>
  </header>
</template>
