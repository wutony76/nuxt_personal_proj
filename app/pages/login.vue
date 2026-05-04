<script setup lang="ts">
import { onMounted, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '../composables/useAuth'

const state = reactive({
  email: 'hfyy@cc.cc',
  password: '123456',
  errorMessage: '',
  isSubmitting: false
})

const router = useRouter()
const { isLoggedIn, init, login } = useAuth()

onMounted(async () => {
  await init()
  if (isLoggedIn.value) {
    router.replace('/admin')
  }
})

const _actions = {
  handleLogin: async () => {
    if (state.isSubmitting) {
      return
    }

    state.errorMessage = ''
    state.isSubmitting = true
    const result = await login(state.email, state.password)
    state.isSubmitting = false

    if (!result.ok) {
      state.errorMessage = result.message
      return
    }

    router.replace('/admin')
  }
}
</script>

<template>
  <main class="grid min-h-[calc(100vh-64px)] place-items-center px-6 py-8">
    <section class="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h1 class="text-2xl font-bold text-slate-900">登入後台</h1>
      <p class="mb-4 mt-2 text-sm text-slate-600">
        請輸入 Email 與密碼（至少 6 碼）。
      </p>

      <label class="mb-3 block text-sm font-semibold text-slate-700">
        Email
        <input v-model="state.email" type="email" placeholder="you@example.com"
          class="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none ring-indigo-200 focus:ring" />
      </label>

      <label class="mb-3 block text-sm font-semibold text-slate-700">
        Password
        <input v-model="state.password" type="password" placeholder="******"
          class="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none ring-indigo-200 focus:ring" />
      </label>

      <p v-if="state.errorMessage" class="mt-1 text-sm font-medium text-red-700">{{ state.errorMessage }}</p>

      <button type="button" :disabled="state.isSubmitting"
        class="mt-4 w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        @click="_actions.handleLogin">
        {{ state.isSubmitting ? '登入中...' : '登入' }}
      </button>
    </section>
  </main>
</template>
