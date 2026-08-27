## 1. 共用核心引擎

- [ ] 1.1 新增 `app/utils/match3Engine.ts`：`Match3CoreEngine` class（棋盤初始化＋無初始消除保證、`trySwap()`、連鎖消除、掉落補位、無解自動洗牌、`getSnapshot()`）
- [ ] 1.2 `app/utils/match3Engine.ts` 新增 `calcMatch3Level(score)` / `calcMatch3TypeCount(level)`，`Match3CoreEngine` 新增 `setTypeCount()`，支援難度隨分數自動升級（比照 snake/racing/tetriminos 既有 Lv 慣例，見 design.md Decision 7）

## 2. Server 端服務層

- [ ] 2.1 新增 `server/services/game/retro/match3rush.ts`：繼承 `RETRO_GAME_BASE`（`coinRate: 0.1`、`coinCapPerRun: 300`、`coinDailyCap: 100000`、`maxReasonableScore(): 20000`）
- [ ] 2.2 新增 `server/services/game/retro/match3classic.ts`：同上（`maxReasonableScore(): 8000`）
- [ ] 2.3 `server/services/storage.ts`：`retroGamesInit()` 新增 import 並 `new` 兩個新類別

## 3. Server 端 API 路由

- [ ] 3.1 新增 `server/api/games/retro/match3rush/history.get.ts`、`history.post.ts`、`history.delete.ts`（比照 `snake` 樣板）
- [ ] 3.2 新增 `server/api/games/retro/match3classic/history.get.ts`、`history.post.ts`、`history.delete.ts`（同上）
- [ ] 3.3 確認 `server/middleware/auth.ts` 的 `/api/games` 前綴已涵蓋新路由，不需修改

## 4. Client API 層

- [ ] 4.1 `app/services/api.ts`：`RetroGameKey` 擴充 `'match3rush' | 'match3classic'`，`api.games.retro` 新增對應 6 個函式

## 5. Client 資料層

- [ ] 5.1 `app/composables/useGameHistory.ts`：`GAME_KEYS` 陣列與 `_handlers.gameApi()` switch 新增兩個分支

## 6. 遊戲頁面

- [ ] 6.1 新增 `app/pages/game/match3-rush.vue`：`Match3RushEngine`（包裝 `Match3CoreEngine` + 60 秒倒數計時 + Lv 自動升級）、格子點擊交換互動、waiting/ready/result overlay（比照 snake.vue 慣例）、`_actions.recordHistory()` 接線（含 `level`）
- [ ] 6.2 新增 `app/pages/game/match3-classic.vue`：`Match3ClassicEngine`（包裝 `Match3CoreEngine` + 20 步計數，只有成功消除的交換扣一步 + Lv 自動升級），其餘同上

## 7. game-hall 入口

- [ ] 7.1 `app/pages/game-hall.vue`：`gameSlots` 的 id 4、5 改為 `MATCH3 RUSH` / `MATCH3 CLASSIC`（`status: 'open'`）
- [ ] 7.2 `app/components/GameMachineCard.vue`：`cuteIcon` 新增 `MATCH3` 圖示分支
- [ ] 7.3 `app/components/GameHistoryDialog.vue`：`FILTERS`／`GAME_KEYS`／`GAME_NAME` 各新增兩筆，摘要卡版面（`ghd-summary` grid 欄數）配合調整

## 8. OpenSpec 文件

- [ ] 8.1 `proposal.md` / `design.md` / `tasks.md` / `specs/game-history/spec.md`（本次變更文件本身）

## 9. 驗證

- [ ] 9.1 `npm run dev` 啟動後，實際在瀏覽器分別玩一局 RUSH（時間到強制結算）與 CLASSIC（步數用完強制結算），確認交換／連鎖消除／無效交換復位／無解自動洗牌皆正常
- [ ] 9.2 未登入：確認寫入 localStorage、重整頁面紀錄仍在
- [ ] 9.3 已登入：確認 server 端紀錄寫入、coin 依倍率入帳、單局與每日上限機制正確、`coinCapped` 提示正確顯示
- [ ] 9.4 `GameHistoryDialog` 篩選 tab 能正確顯示 `MATCH3 RUSH`／`MATCH3 CLASSIC` 兩筆獨立紀錄與統計，不與既有三款遊戲混淆
- [ ] 9.5 `game-hall.vue` 卡片正常顯示、可點擊進入對應路由
- [ ] 9.6 `npx nuxt typecheck` 確認新增/修改檔案無型別錯誤
