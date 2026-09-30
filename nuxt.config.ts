import tailwindcss from '@tailwindcss/vite'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  devServer: {
    port: 6100
  },
  // SCSS 依 7-1 pattern 收在 app/assets/style/main.scss 這個唯一 manifest；
  // Tailwind 走 assets/css/main.css 獨立入口（@layer base，優先權天生低於下方 non-layered 規則）。
  css: ['~/assets/style/main.scss', '~/assets/css/main.css'],
  alias: {
    app: new URL('./app', import.meta.url).pathname,
    serv: new URL('./server', import.meta.url).pathname,
  },
  vite: {
    plugins: [tailwindcss()]
  },
  nitro: {
    experimental: {
      websocket: true
    }
  }
})
