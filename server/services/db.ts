import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { sql } from 'drizzle-orm'

/**
 * DB 可選原則（見 openspec/changes/add-postgres-docker/design.md 第 5.1 節）：
 * 沒設定 DATABASE_URL 時，全站退回純記憶體模式，任何呼叫端都必須先檢查這個函式，
 * 而不是各自直接檢查 process.env.DATABASE_URL——避免分散判斷、漏掉某一處。
 */
export function isDbEnabled(): boolean {
  return Boolean(process.env.DATABASE_URL)
}

let _client: ReturnType<typeof postgres> | null = null
let _db: ReturnType<typeof drizzle> | null = null

/** 連線 pool singleton；只有 isDbEnabled() 為 true 時才會真的建立連線。 */
function getClient() {
  if (!isDbEnabled()) {
    throw new Error('DATABASE_URL 未設定，不應呼叫 getClient()——呼叫前請先檢查 isDbEnabled()')
  }
  if (!_client) {
    _client = postgres(process.env.DATABASE_URL as string, { max: 10 })
    _db = drizzle(_client)
  }
  return _client
}

export function getDb() {
  getClient()
  return _db as ReturnType<typeof drizzle>
}

/** 最小健康檢查，本次（Phase 1）不建立任何 table 或 repository 方法。 */
export async function ping(): Promise<boolean> {
  if (!isDbEnabled()) return false
  const db = getDb()
  await db.execute(sql`select 1`)
  return true
}
