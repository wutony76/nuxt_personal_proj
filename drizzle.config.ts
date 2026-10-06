import { defineConfig } from 'drizzle-kit'

/**
 * Migration 工具設定。只有實際要跑 `npm run db:generate`/`db:migrate` 時才會讀取，
 * 不影響 `npm run dev` 的既有行為（見 add-postgres-docker 的 DB 可選原則）。
 */
export default defineConfig({
  schema: './server/services/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? ''
  }
})
