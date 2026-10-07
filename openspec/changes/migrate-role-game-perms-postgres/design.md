# Design

## 1. Schema

```sql
CREATE TABLE role_game_perms (
  role_id  TEXT NOT NULL REFERENCES role_defs(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  key      TEXT NOT NULL,
  PRIMARY KEY (role_id, category, key)
);
-- 一列存在 = 該角色該項目被關閉（稀疏表示法，跟現有 disabledByRole 記憶體語意一致）

CREATE TABLE game_global_disabled (
  category TEXT NOT NULL,
  key      TEXT NOT NULL,
  PRIMARY KEY (category, key)
);
-- 一列存在 = 該項目全站總閘關閉
```

`role_id` 用 `ON DELETE CASCADE`（不是 Phase 2 members 用的 `SET DEFAULT`）：這份資料語意上是
「角色的附屬設定」，角色沒了，設定也該一起消失，不像 members 需要退回預設角色繼續存在。這取代
現有 `clearRole()` 在 DB 層需要被動呼叫的清理動作。

## 2. Write-through

```ts
toggleGlobal: async (category, key, enabled) => {
  // 前置檢查不變（catalog 存在性）
  if (isDbEnabled()) {
    const db = getDb()
    if (enabled) await db.delete(gameGlobalDisabled).where(and(eq(category), eq(key)))
    else await db.insert(gameGlobalDisabled).values({ category, key }).onConflictDoNothing()
  }
  // 記憶體 mutation 不變
}

toggle: async (roleId, category, key, enabled) => {
  // 前置檢查不變（角色存在、非 builtin、catalog 存在性）
  if (isDbEnabled()) {
    const db = getDb()
    if (enabled) await db.delete(roleGamePermsTable).where(and(eq(roleId), eq(category), eq(key)))
    else await db.insert(roleGamePermsTable).values({ roleId, category, key }).onConflictDoNothing()
  }
  // 記憶體 mutation 不變
}
```

## 3. 開機回填

```ts
rehydrateFromDb: async () => {
  if (!isDbEnabled()) return
  const [globalRows, roleRows] = await Promise.all([
    getDb().select().from(gameGlobalDisabled),
    getDb().select().from(roleGamePermsTable)
  ])
  disabledGlobally.clear()
  globalRows.forEach(r => disabledGlobally.add(_compositeKey(r.category, r.key)))
  disabledByRole.clear()
  roleRows.forEach(r => {
    if (!disabledByRole.has(r.roleId)) disabledByRole.set(r.roleId, new Set())
    disabledByRole.get(r.roleId)!.add(_compositeKey(r.category, r.key))
  })
}
```

沒有「DB 是空的就跑種子」的分支——空 DB 天然對應「全部開啟」，這正是現有記憶體的預設狀態，
不需要額外種子邏輯。呼叫時機：`hfyyManage.ts` 既有的 admin-db-init try/catch 區塊內，排在
`roleDefs.rehydrateOrSeed()` 之後（FK 依賴 `role_defs` 已存在）。

## 4. `clearRole()` 維持純記憶體

DB 層的級聯清理交給 `ON DELETE CASCADE` 自動處理（`role-defs/[id].delete.ts` 刪除角色時）；
`clearRole()` 本身不變，純粹鏡射記憶體狀態，跟 Phase 2 `clearRoleAssignments()` 處理
`members.role_id` cascade 的模式一致。
