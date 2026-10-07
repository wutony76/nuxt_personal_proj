# Proposal

## 變更名稱

`add-delete-member` — 補齊刪除會員功能

## 背景

後台目前只有新增會員（`POST /api/admin/members`）、編輯會員（`PATCH /api/admin/members/[id]`），
沒有刪除。這是先前多次盤點中都提到的既有功能缺口（`test-roles.mjs`/NPC 測試帳號只能手動 SQL
清理）。

## 範圍：一個會員的資料散落在哪些地方，各自怎麼處理

已盤點全部位置（見對話記錄的 agent 研究報告），依「會刪」「不刪、留著當歷史」分兩類：

**會清除：**

| 位置 | 處理方式 |
|---|---|
| `members` 表（DB） | write-through delete |
| `npc_member_settings`/`npc_member_games`/`npc_daily_spent`（DB） | 既有 `ON DELETE CASCADE`，刪 `members` 列自動清 |
| `Storage.account[userId]` | 記憶體直接刪 |
| `Storage.users[userId]` | 記憶體直接刪（連帶清掉 coin + 23 款彩種的 balanceChanges/betHistory/claimableIssues，一次到位） |
| `adminIds`/`memberRoleId`（adminAccess.ts） | 記憶體直接刪 |
| 該會員目前的 session | 走訪 `Storage.sessions` 找到並刪除（安全考量：不能讓已刪除帳號的 session 繼續有效） |
| `loginHistory.ts` 的 `byUser` | 新增 `remove(userId)` 方法 |
| `npcAutoPlay.ts` 的 4 個 Map（`_allowedGamesByUser`/`_memberSettings`/`_dailySpent`/`_nextActionAt`） | 新增 `removeMemberData(userId)` 方法 |

**刻意不清除（記錄為已知限制，理由見 design.md）：**

- `game_orders`/`retro_game_history`/`retro_daily_grants`/`login_history`/`chat_schedules.created_by`
  的 DB 列（無 FK，會變孤兒，但本來就是「歷史稽核資料」定位，跟 `login_history` 現有「重啟後
  只當備份」的既有哲學一致）
- 23 款彩種 `OrdersClass.orders`/`members`、30 款復古遊戲 `RetroHistoryClass.records`/
  `dailyGrants` 的記憶體內容（逐一清理 53 個 class 實例成本過高、效益極低，這些本來就是
  「結算當下」的歷史紀錄，不影響刪除後的正確性，只是舊紀錄裡還留著已刪除會員的 userId）
- `toys/pool.ts`/`whistleCandy.ts`/`chatService.ts` 的小型 per-user Map（`records`/`locks`/
  `histories`/`lastSentAt`）：被刪除帳號的 userId 不會再被任何請求用到，純粹是幾筆用不到的
  殘留資料，不是功能缺陷

## 保護規則（沿用 `setRole()` 既有的保護邏輯）

- 不可刪除自己
- 不可直接刪除管理員帳號（`adminIds` 內的帳號）——要刪除管理員，必須先透過既有的
  `setRole()` 降級，降級本身已經有「至少保留一位 Admin」的保護，避免在兩處重複實作同一條
  規則

## UX

比照 `RoleList.vue` 既有的「二次點擊確認刪除」模式（專案內不用瀏覽器 `confirm()` 彈窗），
在會員列表加一顆刪除按鈕。

## 驗證方式

- 刪除一般會員（user/demo 角色）、刪除 NPC 會員，確認 DB 與記憶體皆正確清除
- 確認被刪除會員的 session 立即失效（下一次請求會被拒絕）
- 確認無法刪除自己、無法直接刪除管理員帳號
- DB enabled/disabled 兩種設定下 `npm test` 皆通過

## 成功標準

- [ ] `DELETE /api/admin/members/[id]` 完成並通過上述驗證
- [ ] 既有測試無回歸
