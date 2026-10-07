# Design

## 1. Schema

```sql
CREATE TABLE login_history (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  email      TEXT NOT NULL,
  ip         TEXT NOT NULL,
  user_agent TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_login_history_user ON login_history (user_id, created_at);
```

## 2. SyncSource（全量快照，比照 `retro_game_history`）

```ts
registerSyncSource({
  table: 'login_history',
  primaryKey: ['id'],
  snapshot: () => {
    const rows: Record<string, unknown>[] = []
    for (const entries of byUser.values()) {
      for (const entry of entries) {
        rows.push({
          id: entry.id, user_id: entry.userId, email: entry.email,
          ip: entry.ip, user_agent: entry.userAgent,
          created_at: new Date(entry.createdAt)
        })
      }
    }
    return rows
  }
})
```

不裁剪記憶體（跟 `retro_game_history` 一樣，記憶體本身已有每人 100 筆上限）。於
`server/plugins/init.ts` 的 `if (isDbEnabled())` 區塊內註冊，跟其他三個 Phase 3 來源並列。
