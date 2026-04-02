<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '../composables/useAuth'

const router = useRouter()
const { user, initialized, isLoggedIn, init } = useAuth()

const isCheckingAuth = computed(() => !initialized.value)

onMounted(() => {
  init()
  if (!isLoggedIn.value) {
    router.replace('/login')
  }
})
</script>

<template>
  <main class="mx-auto max-w-5xl px-5 pb-16 pt-8">
    <section
      v-if="isCheckingAuth"
      class="rounded-2xl border border-slate-200 bg-white p-6 text-slate-600"
    >
      正在檢查登入狀態...
    </section>

    <section v-else-if="!isLoggedIn" class="rounded-2xl border border-slate-200 bg-white p-6">
      <h1 class="text-2xl font-bold text-slate-900">尚未登入</h1>
      <p class="mt-2 text-slate-600">請先登入後再進入後台。</p>
      <NuxtLink to="/login" class="mt-4 inline-block font-semibold text-blue-600">
        前往登入
      </NuxtLink>
    </section>

    <section v-else class="rounded-2xl border border-slate-200 bg-white p-6">
      <h1 class="text-2xl font-bold text-slate-900">後台管理</h1>
      <p class="mt-2 text-slate-600">歡迎回來，{{ user?.name }}（{{ user?.email }}）</p>

      <div class="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <article class="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <h2 class="mb-1 text-base font-semibold">網站狀態</h2>
          <p class="text-sm leading-6 text-slate-700">首頁運行正常，服務可用。</p>
        </article>
        <article class="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <h2 class="mb-1 text-base font-semibold">內容管理</h2>
          <p class="text-sm leading-6 text-slate-700">
            可在這裡擴充文章、專案與個人資訊編輯功能。
          </p>
        </article>
        <article class="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <h2 class="mb-1 text-base font-semibold">下一步</h2>
          <p class="text-sm leading-6 text-slate-700">
            可串接真實 API 與資料庫，改成正式權限系統。
          </p>
        </article>
      </div>
    </section>
  </main>
</template>
