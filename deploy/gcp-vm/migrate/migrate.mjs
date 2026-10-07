/**
 * 部署時套用資料庫 migration（`drizzle/` 底下的 SQL 檔）。
 *
 * 本機開發用 `npm run db:migrate`（drizzle-kit，devDependency）；production 的建置產物 `.output`
 * 不含 devDependencies，所以這裡改用 drizzle-orm 內建的 migrator。兩者共用同一張
 * `drizzle.__drizzle_migrations` 紀錄表，已經用 drizzle-kit 跑過的資料庫可以直接接續。
 *
 * 用法（由 remote-deploy.sh 呼叫）：
 *   node --env-file=/srv/portfolio/shared/.env migrate/migrate.mjs
 */
import { fileURLToPath } from 'node:url'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'

const url = process.env.DATABASE_URL
if (!url) {
  console.log('DATABASE_URL 未設定，維持純記憶體模式，略過 migration')
  process.exit(0)
}

const migrationsFolder = fileURLToPath(new URL('../drizzle', import.meta.url))
const client = postgres(url, { max: 1 })

try {
  await migrate(drizzle(client), { migrationsFolder })
  console.log(`migration 完成（${migrationsFolder}）`)
} finally {
  await client.end()
}
