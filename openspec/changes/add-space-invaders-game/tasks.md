## 1. Server 端服務層

- [x] 1.1 新增 `server/services/game/retro/spaceInvaders.ts`：繼承 `RETRO_GAME_BASE`（`coinRate: 0.3`、`coinCapPerRun: 300`、`coinDailyCap: 100000`、`maxReasonableScore(): 8000`，見 design.md Decision 9）
- [x] 1.2 `server/services/storage.ts`：`retroGamesInit()` 新增 import 並 `new` 該類別

## 2. Server 端 API 路由

- [x] 2.1 新增 `server/api/games/retro/space-invaders/history.get.ts`、`history.post.ts`、`history.delete.ts`（比照既有九款遊戲樣板，見 design.md Decision 10 的 gameKey／路由命名說明）
- [x] 2.2 確認 `server/middleware/auth.ts` 的 `/api/games` 前綴已涵蓋新路由，不需修改

## 3. Client API 層

- [x] 3.1 `app/services/api.ts`：`RetroGameKey` 擴充 `'spaceInvaders'`，`api.games.retro` 新增對應 3 個函式（路由路徑用 `space-invaders`）

## 4. Client 資料層

- [x] 4.1 `app/composables/useGameHistory.ts`：`GAME_KEYS` 陣列與 `_handlers.gameApi()` switch 新增一個分支

## 5. 遊戲核心邏輯（頁面自包含）

- [x] 5.1 `app/pages/game/space-invaders.vue`：`SpaceInvadersEngine`（或 reactive state + `step()`）inline 邏輯，比照 space-shooter.vue／runner.vue 的 tick-driven engine 慣例
- [x] 5.2 隊形（formation）同步移動：5×8 成員陣列＋整體 `offsetX`／`offsetY`／`dir`，碰邊界整批下降並反向（見 design.md Decision 1）
- [x] 5.3 移動節奏隨存活比例加速：`ALIVE_RATIO_MULTIPLIERS` 對照表，敵機被擊落後重新查表（見 design.md Decision 2）
- [x] 5.4 玩家單發子彈限制：`playerBullet` 單一物件而非陣列，命中或飛出畫面前不可再次開火（見 design.md Decision 3）
- [x] 5.5 敵機還擊：僅每欄最前線存活成員可隨機開火，機率隨波次提升（見 design.md Decision 4）
- [x] 5.6 防禦掩體：4 座可摧毀格子陣列，玩家子彈／敵彈／敵機本體皆可摧毀對應格子（見 design.md Decision 5）
- [x] 5.7 UFO：獨立於隊形之外，定時出現、水平飛越，被玩家子彈擊中給隨機獎勵分並移除（見 design.md Decision 6）
- [x] 5.8 即死判定：隊形下降後檢查是否有成員超過底線，觸發則立即結算（獨立於生命值歸零的結束流程，見 design.md Decision 7）
- [x] 5.9 波次制：隊形全滅時波次 +1、重建滿編隊形、基礎速度與敵機開火機率隨波次提升；掩體損毀狀態、生命值、分數不隨波次重置（見 design.md Decision 8）
- [x] 5.10 生命值機制：3 條命，被敵彈或敵機本體擊中扣命＋短暫無敵＋重生於畫面下方中央，命數歸零觸發最終結算（比照 space-shooter.vue 既有做法）
- [x] 5.11 計分：依敵機所在列給分（`[40,40,30,20,10]`，由上到下）＋ UFO 隨機獎勵分累加（見 design.md Decision 9）

## 6. 遊戲頁面互動與流程

- [x] 6.1 WELCOME／READY／RESULT 三段式 overlay（比照既有遊戲慣例）
- [x] 6.2 玩家操作：←/→ 或 A/D 左右移動，空白鍵／Enter 開火（單發限制見 5.4）
- [x] 6.3 HUD 顯示目前分數、波次、剩餘生命；扣命／無敵狀態需有明確視覺提示（例如飛船閃爍）
- [x] 6.4 RESULT overlay 顯示最終 SCORE 與波次，呼叫 `useGameHistory().actions.record()`（生命值／掩體損毀狀態皆不入庫）
- [x] 6.5 掛載共用 `GameRateDialog` / `GameRuleDialog`，`accent-color` 採 `#ff3b3b`（警報紅，不與現有九款遊戲撞色）

## 7. game-hall 入口

- [x] 7.1 `app/pages/game-hall.vue`：`gameSlots` 陣列新增 `{ id: 11, name: 'SPACE INVADERS', status: 'open', path: '/game/space-invaders' }`（id 10 已被同時進行中的 PAC-MAN 新增佔用）
- [x] 7.2 `app/components/GameMachineCard.vue`：icon 對照新增 `SPACE INVADERS` 分支（👾）
- [x] 7.3 `app/components/GameHistoryDialog.vue`：篩選 tab／`GAME_KEYS`／遊戲名稱對照各新增一筆

## 8. OpenSpec 文件

- [x] 8.1 `proposal.md` / `design.md` / `tasks.md` / `specs/game-history/spec.md`（本次變更文件本身）

## 9. 驗證

- [x] 9.1 `npm run dev` 啟動後，用 Playwright 實測移動（←/→ 使玩家水平位移正確）／開火（持續按住空白鍵時 `.si-bullet.player` 數量全程 ≤1，證實單發限制生效）／隊形整批同步移動（1 秒間隔前後 3 個敵機樣本 x 座標同步平移 12px）／4 座掩體正確渲染（80 格＝4×20），行為皆正常，無 console 錯誤（僅有的 401 是既有 `useAuth` 訪客檢查的既有行為，SPACE SHOOTER 頁面同樣會出現，非本次新增問題）
- [ ] 9.2 實測即死條件：讓隊形下降到底線，確認不論剩餘生命數皆立即結算（需長時間對局，留待人工驗證）
- [ ] 9.3 實測生命值：確認扣命／無敵／重生流程正常，命數歸零才真正結束（留待人工驗證）
- [ ] 9.4 實測波次遞增：清空一波後隊形重新滿編出現、速度與開火頻率提高，掩體損毀狀態延續不重置（留待人工驗證）
- [ ] 9.5 未登入：確認寫入 localStorage、重整頁面紀錄仍在
- [ ] 9.6 已登入：確認 server 端紀錄寫入、coin 依 `score × coinRate` 入帳、單局與每日上限機制正確
- [ ] 9.7 `GameHistoryDialog` 篩選 tab 能正確顯示 `SPACE INVADERS` 紀錄與統計
- [x] 9.8 `game-hall.vue` 卡片正常顯示（curl 確認頁面含「SPACE INVADERS」字樣）、可點擊進入 `/game/space-invaders`（頁面回應 200）
- [x] 9.9 確認 `MINESWEEPER`／`SPACE SHOOTER` 兩款既有遊戲程式碼完全未被修改；額外驗證 SPACE SHOOTER 頁面仍正常載入、無新增 console 錯誤
- [x] 9.10 `npx nuxt typecheck`：新增/修改的檔案（`space-invaders.vue`、`spaceInvaders.ts`、API 路由、`api.ts`、`useGameHistory.ts`、`GameHistoryDialog.vue`、`GameMachineCard.vue`、`game-hall.vue`、`storage.ts`）皆無型別錯誤；專案既有的 lottery/kl8 相關型別錯誤與本次變更無關（修改前即存在）
