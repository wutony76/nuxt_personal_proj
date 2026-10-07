# Proposal

## 變更名稱

`migrate-npc-settings-postgres` — NPC 設定持久化

## 背景

`server/services/admin/modules/npcAutoPlay.ts` 的 7 個記憶體 store 全部重啟歸零。使用者盤點
優先序的最後一項。

## 不只是「設定遺失」——這批是在修一個真正的功能回歸

跟前面幾批（遊戲設定、聊天室排程）不同，這批的立論基礎不只是「管理員調過的值重啟後消失」，而是
會**讓 `openspec/changes/fix-npc-game-diversity` 想修的問題重新發生**：

- `_allowedGamesByUser`（每個 NPC 勾選的遊戲）跟 `_memberSettings`（每個 NPC 的分類權重）清空後，
  `_allowedGamesOf()`/`_memberSettingOf()` 的 fallback 邏輯會啟動：視為「這個 NPC 還沒設定過」，
  套用「全部 61 款遊戲都選」+ 全域統一權重
- `fix-npc-game-diversity` 當初就是為了修正「20 個 NPC 全部勾選全部遊戲、共用同一組權重，導致
  後台『資料統計／會員』每款遊戲的不重複人數被拉平、看不出熱門/冷門差異」這個問題，改成
  `autoCreateMember()` 時隨機抽玩家原型（`_assignArchetype()`）差異化每個 NPC
- **但這個修正只在記憶體裡生效一次**：只要重啟，20 個 NPC 的 archetype 設定全部消失，
  `_allowedGamesOf()`/`_memberSettingOf()` 的 fallback 立刻把所有 NPC 打回「全選+同權重」，
  跟沒修之前一樣。持久化後這個 fix 才會真正長期有效。

## 範圍：7 個 store，3 種處理方式

| Store | 處理方式 | 理由 |
|---|---|---|
| `_enabled`（總開關） | write-through | 低頻 admin 設定 |
| `_schedule`（全域排程參數，9 個數值） | write-through | 低頻 admin 設定 |
| `_nameWords`（單字庫） | write-through | 低頻 admin 設定 |
| `_gamePresets`（遊戲勾選範本） | write-through | 低頻 admin 設定 |
| `_memberSettings`（每個 NPC 的個別設定，14 欄位） | write-through | 低頻（admin 調整或 `_assignArchetype()` 新增 NPC 時寫一次） |
| `_allowedGamesByUser`（每個 NPC 勾選的遊戲） | write-through | 同上，稀疏表示法（列存在=允許，`role_game_perms` 反過來的語意） |
| `_dailySpent`（NPC 今日已花費） | write-through（fire-and-forget，不擋 tick） | 高頻（每個 NPC 每次下注都寫），語意等同 `retro_daily_grants` 但沒有 game_key |
| `_nextActionAt`／`_lastTickAt` | **不持久化** | 純排程 scratch，重啟後每個 NPC 視為立即可行動，無害 |

## 順手修正的既有缺陷

- `hfyyManage.ts` 結尾無條件 `npcAutoPlay.setEnabled(true)`：持久化後改成只在 DB 未啟用時才這樣
  做（維持純記憶體模式的既有行為），DB 啟用時尊重從 DB 回填的 `_enabled` 值——不然管理員關閉
  NPC 自動遊玩，重啟後一樣被蓋回開啟
- `_dailySpent` 語意等同 `retro_daily_grants`，持久化後順便修正「重啟導致當日配額歸零」的
  同款舊 bug（NPC 的每日花費上限重啟後失去意義）

## 範圍（不包含）

- `_nextActionAt`/`_lastTickAt`：純排程 scratch，不持久化
- `npcBgPayload.ts`/`npcTwPayload.ts`/`npcToyPlay.ts`：純函式，沒有狀態，不在範圍內

## 驗證方式

- 每個 write 方法呼叫後確認 DB 正確寫入
- 重啟後確認：既有 NPC 的 `allowedGames`/個別權重設定維持（不會打回「全選+同權重」）、
  總開關/排程參數/單字庫/範本正確回填、今日已花費正確回填
- DB enabled/disabled 兩種設定下 `npm test` 皆通過

## 成功標準

- [ ] 7 個 store 依上表分類完成 write-through/不處理
- [ ] 既有測試無回歸
- [ ] 重啟後既有 NPC 不會被打回「全選+同權重」的 fallback 狀態
