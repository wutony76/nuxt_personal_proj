# Design

## 1. 補齊 `USER_BALANCE_SOURCES`

新增 8 筆，標籤比照 `tw-lottery-payout.get.ts` 的 `TW_RECORDS` 既有中文名稱，維持跟其他報表
一致：

```ts
{ key: 'dltRecord', label: '大樂透' },
{ key: 'superlottoRecord', label: '威力彩' },
{ key: 'd539Record', label: '今彩539' },
{ key: 'm649Record', label: '49樂合彩' },
{ key: 'm539Record', label: '39樂合彩' },
{ key: 'p3Record', label: '3星彩' },
{ key: 'p4Record', label: '4星彩' },
{ key: 'bingoRecord', label: '賓果賓果' }
```

## 2. `list()` 改 async，合併 `wallet_balance_changes`

`queryArchivedWalletChangesForUser(userId)`（`walletReportQuery.ts`，已存在，Area A 已經在用）
本來就回傳**全部 22 個 source** 的列，不需要額外篩選。合併邏輯比照 `gameHistory.ts`：
以 `${source}:${id}` 當去重鍵（記憶體優先），DB 版本補上記憶體裡已經被 5000→4000 上限裁掉的
舊資料。

```ts
list: async (userId: string): Promise<AdminMemberBalanceChange[]> => {
  const accounts = Storage.get.account()
  if (!accounts[userId]) throw createError({ statusCode: 404, message: '找不到該帳號。' })

  Storage.get.user(userId)
  const user = Storage.users[userId] as Record<string, unknown> | undefined

  const rows: AdminMemberBalanceChange[] = []
  const seenIds = new Set<string>()
  if (user) {
    for (const { key, label } of USER_BALANCE_SOURCES) {
      const slice = user[key] as UserRecordSlice | undefined
      if (!Array.isArray(slice?.balanceChanges)) continue
      for (const row of slice.balanceChanges) {
        const id = `${key}:${row.id}`
        seenIds.add(id)
        rows.push({ id, source: key, sourceLabel: label, ...})
      }
    }
  }

  const archived = await queryArchivedWalletChangesForUser(userId)
  const labelOf = new Map(USER_BALANCE_SOURCES.map((s) => [s.key, s.label]))
  for (const row of archived) {
    const id = `${row.source}:${row.id}`
    if (seenIds.has(id)) continue
    rows.push({ id, source: row.source, sourceLabel: labelOf.get(row.source) ?? row.source, ... })
  }

  return rows.toSorted((a, b) => b.createdAt - a.createdAt).slice(0, MAX_ROWS)
}
```

## 3. API 路由補 `await`

`members/[id]/balance-changes.get.ts` 的 handler 改 async。
