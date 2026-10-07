# Design

## 1. 服務層：新增/調整的方法

### 1a. `adminAccessService.deleteMember(userId, actorId)`（核心，`adminAccess.ts`）

沿用既有 write-through 慣例（先 DB 成功才動記憶體）：

```ts
deleteMember: async (userId: string, actorId: string): Promise<void> => {
  if (!accounts[userId]) throw createError({ statusCode: 404, message: '找不到該會員。' })
  if (userId === actorId) {
    throw createError({ statusCode: 400, message: '不可刪除自己的帳號。' })
  }
  if (adminIds.has(userId)) {
    throw createError({ statusCode: 400, message: '不可直接刪除管理員帳號，請先降級為一般角色再刪除。' })
  }

  if (isDbEnabled()) {
    // members 列刪除會透過 ON DELETE CASCADE 自動清掉 npc_member_settings/
    // npc_member_games/npc_daily_spent 三張表，不需要額外呼叫
    await getDb().delete(membersTable).where(eq(membersTable.id, userId))
  }

  delete accounts[userId]
  delete Storage.users[userId]
  adminIds.delete(userId)
  memberRoleId.delete(userId)

  // 安全考量：被刪除帳號若還有有效 session，必須立即失效，不能留著繼續通行
  for (const [token, session] of Storage.get.sessions().entries()) {
    if (session.user?.id === userId) Storage.get.sessions().delete(token)
  }
}
```

`Storage.users[userId]` 刪除後，`UsersClass` 實例連帶的 `coin`/`record.balanceChanges`/
`record.betHistory`/`record.claimableIssues`，以及 14 個彩種專屬 record（`k3Record`／
`pk10Record`…）全部一次清掉，不需要逐一處理——這是 `walletBalanceService`/
`memberBalanceHistoryService` 完全寄生在 `Storage.users[userId]` 上的直接好處。

### 1b. `loginHistoryService.remove(userId)`（`loginHistory.ts`）

```ts
remove: (userId: string): void => {
  byUser.delete(userId)
}
```

純記憶體操作。DB 的 `login_history` 既有列不會被清（sync 是 upsert-only，見 design.md 2 節），
刻意保留當歷史稽核。

### 1c. `npcAutoPlayService.removeMemberData(userId)`（`npcAutoPlay.ts`）

```ts
removeMemberData: (userId: string): void => {
  _allowedGamesByUser.delete(userId)
  _memberSettings.delete(userId)
  _dailySpent.delete(userId)
  _nextActionAt.delete(userId)
}
```

純記憶體操作。DB 端的 `npc_member_settings`/`npc_member_games`/`npc_daily_spent` 已經由
`members` 表的 `ON DELETE CASCADE` 處理，這裡不需要、也不應該重複呼叫 DB delete。

## 2. 為什麼 DB 孤兒資料可以接受

`game_orders`/`retro_game_history`/`retro_daily_grants`/`login_history`/
`chat_schedules.created_by` 當初設計時就沒有掛 FK（見 Phase 3/聊天室排程/登入紀錄各自的
design.md），語意上都是「事件發生當下的快照」，不是「必須跟活著的會員同步」的即時狀態。
`login_history` 的 `rehydrateOrSeed` 式回填本來就定位為「永久備份」而非「即時鏡射」，會員被
刪除後，這些表留著 userId 不會造成任何查詢錯誤（既有的報表/查詢都是直接顯示 userId 或走
`LEFT JOIN` 語意的鬆散關聯，沒有任何地方假設 userId 一定能在 `members` 表找到對應列）。

## 3. API 路由：`server/api/admin/members/[id].delete.ts`（新檔）

比照 `role-defs/[id].delete.ts` 的「路由當編排層」慣例：

```ts
import { sessionController } from 'serv/services/auth'
import { Storage } from 'serv/services/storage'

export default defineEventHandler(async (event) => {
  const actor = sessionController.requireAdmin(event)
  const id = String(getRouterParam(event, 'id') ?? '').trim()
  if (!id) throw createError({ statusCode: 400, message: '缺少會員 id。' })

  Storage.manager.admin.npcAutoPlay.removeMemberData(id)
  Storage.manager.admin.loginHistory.remove(id)
  await Storage.manager.admin.access.deleteMember(id, actor.id)

  return { ok: true }
})
```

NPC/登入紀錄的記憶體清理放在 DB delete **之前**：就算 DB delete 失敗（例如 DB 連不上）整個
request 會 500、但記憶體清理已經先做了也沒關係——`removeMemberData`/`remove` 都是純記憶體操作，
沒有副作用、重複呼叫也安全（`Map.delete()` 對不存在的 key 是 no-op）。DB delete 放最後，失敗
時整個刪除動作視為沒發生（`accounts[id]` 仍在，前端會看到 500 錯誤，不會誤以為刪除成功）。

## 4. 前端：二次點擊確認刪除（比照 `RoleList.vue`）

`app/components/admin/CreateMember.vue` 的會員列表加一顆刪除按鈕，狀態機沿用
`RoleList.vue` 的 `removingId`/`confirmingId` 模式：第一次點擊只標記 `confirmingId`，按鈕文案
變成「再次點擊確認刪除」；第二次點擊才真的呼叫 API。切換選取會員或分頁時重置
`confirmingId = ''`。

`app/services/api.ts` 新增 `api.admin.deleteMember(id)`，比照 `deleteRoleDef` 的形狀：
`$fetch<{ ok: boolean }>(\`/api/admin/members/${id}\`, { method: 'DELETE' })`。

## 5. 不做的事

- 不提供「批次刪除」
- 不處理 `toys/pool.ts`/`toys/whistleCandy.ts`/`chatService.ts` 的小型 per-user Map
  （見 proposal.md「刻意不清除」清單，純粹是用不到的殘留，不影響任何功能）
- 不回溯清理 23 款彩種/30 款復古遊戲的記憶體歷史紀錄（`OrdersClass`/`RetroHistoryClass`）
