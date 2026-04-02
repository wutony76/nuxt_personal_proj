<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '../composables/useAuth'

const router = useRouter()
const { initialized, isLoggedIn } = useAuth()

const isCheckingAuth = computed(() => !initialized.value)

onMounted(() => {
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
      <p class="mt-2 text-slate-600">請先登入後再進入台彩大廳。</p>
      <NuxtLink to="/login" class="mt-4 inline-block font-semibold text-blue-600">
        前往登入
      </NuxtLink>
    </section>

    <section v-else class="rounded-2xl border border-slate-200 bg-white p-6">
      <h1 class="text-2xl font-bold text-slate-900">台彩大廳</h1>
      <p class="mt-2 text-slate-600">
        這裡可擴充為台灣彩券專區，展示官方彩種、歷史號碼與推薦玩法。
      </p>

      <div class="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <article class="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <h2 class="mb-1 text-base font-semibold">官方彩種</h2>
          <p class="text-sm leading-6 text-slate-700">威力彩、大樂透、今彩 539、雙贏彩。</p>
        </article>
        <article class="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <h2 class="mb-1 text-base font-semibold">歷史資料</h2>
          <p class="text-sm leading-6 text-slate-700">依日期查詢歷史開獎結果與統計趨勢。</p>
        </article>
        <article class="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <h2 class="mb-1 text-base font-semibold">個人化推薦</h2>
          <p class="text-sm leading-6 text-slate-700">可依偏好建立追蹤清單與到期提醒。</p>
        </article>
      </div>
    </section>
  </main>
</template>
