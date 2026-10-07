# Proposal

## 變更名稱

`migrate-game-settings-postgres` — 遊戲設定持久化（復古遊戲賠率 / 柑仔店 / Pac-Man 迷宮樣板）

## 背景

使用者盤點「後台功能 vs DB 持久化」後，指定下一個處理順序：先做「遊戲的設定」，再做聊天室排程、
NPC 設定。「遊戲的設定」實際涵蓋三個獨立的純記憶體模組，重啟全部回復預設值：

1. `server/services/admin/modules/retroGameRates.ts` — 30 款復古遊戲的 coin 兌換三常數
   （`coinRate`/`coinCapPerRun`/`coinDailyCap`），直接改在 `RETRO_GAME_BASE` 執行期實例上
2. `server/services/admin/modules/toyShop.ts` — 柑仔店櫥仔全站開關 + 8 款玩法的賠率倍數/難度/
   上下架
3. `server/services/game/retro/mazeTemplates.ts` — Pac-Man 固定樣板迷宮（管理員手刻、經連通性
   驗證才能存檔）

## 為什麼這三個算同一批

都是「低頻 admin 設定、沒有對應記憶體以外備份」的資料，跟已完成的 `role_defs`/`role_game_perms`
同一類，適用 write-through。差異只在於有沒有「種子/預設回退」邏輯：

- 復古遊戲賠率、柑仔店賠率：DB 沒有資料列 = 使用程式碼寫死的預設值（跟 `role_game_perms` 的
  「沒有種子概念」一樣，空 DB 對應目前既有預設行為，不需要種子分支）
- Pac-Man 迷宮樣板：目前預設只有 1 筆 `classic-01`，DB 為空時要把這筆寫回 DB（沿用
  `roleDefs.rehydrateOrSeed()` 的「空就寫種子、有資料就用 DB 覆蓋記憶體」模式），因為這是
  陣列型態、管理員新增的樣板完全沒有程式碼預設值可回退

## 重啟遺失的實際影響（為什麼要做）

- 復古遊戲賠率：管理員調過的兌換比/上限，重啟後悄悄變回程式碼預設值
- 柑仔店：管理員下架的玩法重啟後重新上架；調整過的賠率/難度重啟後重設——這是後台「功能被使用者
  關掉但自己又開回來」類型的 bug，使用者體感最強
- Pac-Man 迷宮樣板：管理員手刻、通過連通性驗證的自訂樣板重啟後**直接消失**，沒有任何預設值可回退
  （只剩 `classic-01`），是三者中最嚴重的一個（唯一「不可接受」等級的遺失）

## 範圍

- 包含：上述三個模組改 write-through，開機回填（復古賠率/柑仔店：覆蓋式回填，無種子分支；
  Pac-Man 樣板：空則種子、有則覆蓋）
- 不包含：`_nameWords`/NPC 設定/聊天室排程（下一批處理）；復古遊戲賠率的**讀取路徑**維持讀記憶體
  不變（`settleReward()` 每次結算都會讀，改讀 DB 會拖慢遊戲主流程，寫入才是本次要處理的缺口）

## 驗證方式

- 三個模組個別呼叫寫入 API，確認 DB 正確寫入
- 重啟 dev server 後資料正確回填（含 Pac-Man 樣板的「空則種子」情境：全新 DB 第一次啟動）
- DB enabled/disabled 兩種設定下 `npm test` 皆通過

## 成功標準

- [ ] 三個模組皆完成 write-through + 開機回填
- [ ] 既有測試無回歸
