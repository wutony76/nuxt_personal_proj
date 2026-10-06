import { sql } from 'drizzle-orm'
import { getDb } from './db'

/**
 * 通用「記憶體 → SQL 定時同步」來源介面（見
 * openspec/changes/add-postgres-docker/design.md 第 8.3 節）。本次（Phase 1）只定義介面與
 * 空的註冊表，不實作任何具體來源——之後每個 Phase（members/role-defs、遊戲紀錄…）各自
 * 實作一個 SyncSource 並呼叫 registerSyncSource() 註冊進來。
 */
export interface SyncSource {
  /** 對應的 SQL table 名稱 */
  table: string
  /** upsert 用的唯一鍵欄位 */
  primaryKey: string[]
  /** 同步瞬間，從 Storage 取出要寫入的列（必須是同步函式，避免 read-tearing，見 design.md 8.4 節） */
  snapshot(): Record<string, unknown>[]
}

const _sources: SyncSource[] = []

export function registerSyncSource(source: SyncSource): void {
  _sources.push(source)
}

/** 測試用：清空註冊表 */
export function _clearSyncSourcesForTest(): void {
  _sources.length = 0
}

function _buildUpsertSql(source: SyncSource, rows: Record<string, unknown>[]) {
  const columns = Object.keys(rows[0])
  const columnsSql = sql.join(columns.map((c) => sql.identifier(c)), sql`, `)
  const valuesSql = sql.join(
    rows.map((row) => sql`(${sql.join(columns.map((c) => sql`${row[c]}`), sql`, `)})`),
    sql`, `
  )
  const conflictColumns = sql.join(source.primaryKey.map((c) => sql.identifier(c)), sql`, `)
  const updateSql = sql.join(
    columns
      .filter((c) => !source.primaryKey.includes(c))
      .map((c) => sql`${sql.identifier(c)} = excluded.${sql.identifier(c)}`),
    sql`, `
  )
  return sql`
    insert into ${sql.identifier(source.table)} (${columnsSql})
    values ${valuesSql}
    on conflict (${conflictColumns}) do update set ${updateSql}
  `
}

async function runSyncTick(): Promise<void> {
  const startedAt = Date.now()
  const db = getDb()
  let totalRows = 0

  for (const source of _sources) {
    try {
      const rows = source.snapshot()
      if (rows.length === 0) continue
      await db.execute(_buildUpsertSql(source, rows))
      totalRows += rows.length
      console.log(`SYNC.tick.source.success table=${source.table} rows=${rows.length}`)
    } catch (error) {
      // 單一來源失敗不影響其他來源，也不影響主流程（見 design.md 第 8.6 節）
      console.error(`SYNC.tick.source.failed table=${source.table}`, error)
    }
  }

  console.log(`SYNC.tick.done sources=${_sources.length} rows=${totalRows} durationMs=${Date.now() - startedAt}`)
}

export class SyncScheduler {
  private isRunning = false
  private _timer: ReturnType<typeof setTimeout> | null = null
  private intervalMs: number

  constructor(intervalMs = 300_000) {
    this.intervalMs = intervalMs
  }

  private async _circle(): Promise<void> {
    try {
      await runSyncTick()
    } catch (error) {
      // runSyncTick() 內部已經個別 catch 每個來源，這裡是最後一道防線，
      // 確保就算 runSyncTick() 本身意外拋錯，也不會讓整個 timer 停擺。
      console.error('SYNC.tick.unexpected-error', error)
    }
    if (!this.isRunning) return
    this._timer = setTimeout(() => this._circle(), this.intervalMs)
  }

  /** 啟動定時同步；若 DB 未啟用，呼叫端不應該呼叫這個方法（見 server/plugins/init.ts）。 */
  start(): this {
    this.isRunning = true
    void this._circle()
    return this
  }

  stop(): void {
    this.isRunning = false
    if (this._timer) {
      clearTimeout(this._timer)
      this._timer = null
    }
  }
}
