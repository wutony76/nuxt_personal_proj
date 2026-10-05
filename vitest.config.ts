import { defineConfig } from 'vitest/config'

/**
 * 單元測試設定（`npm run test:unit`）。
 *
 * 只測不依賴 Nuxt／Nitro runtime 的純函式，所以用一般 node 環境、不載入 Nuxt。
 * `test/test-*.mjs` 是打真實 dev server 的 E2E 腳本，不在這裡執行。
 *
 * `test:unit` 刻意用 `TZ=UTC` 執行：開獎時間計算必須跟伺服器時區無關，
 * 在 UTC 下跑得過，才能證明部署到雲端主機或 CI 時結果仍然是台灣時間。
 */
export default defineConfig({
  test: {
    include: ['test/unit/**/*.test.ts'],
    environment: 'node'
  }
})
