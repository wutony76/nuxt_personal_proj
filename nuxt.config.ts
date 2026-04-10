import tailwindcss from '@tailwindcss/vite'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  devServer: {
    port: 6100
  },
  css: ['~/assets/style/base.css', '~/assets/css/main.css'],
  alias: {
    app: new URL('./app', import.meta.url).pathname,
  },
  vite: {
    plugins: [tailwindcss()]
  }
})
