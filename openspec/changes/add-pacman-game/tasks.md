## 1. Server 端服務層

- [x] 1.1 新增 `server/services/game/retro/pacMan.ts`：繼承 `RETRO_GAME_BASE`（`coinRate: 0.05`、`coinCapPerRun: 2500`——使用者決定調高、比照 spaceShooter 先例、`coinDailyCap: 100000`、`maxReasonableScore(): 200000`——同步調高保留餘裕，見 design.md Decision 6）
- [x] 1.2 `server/services/storage.ts`：`gamesInitRetro()` 新增 import 並 `new` 該類別

## 2. Server 端 API 路由

- [x] 2.1 新增 `server/api/games/retro/pac-man/history.get.ts`、`history.post.ts`、`history.delete.ts`（比照既有遊戲樣板）
- [x] 2.2 確認 `server/middleware/auth.ts` 的 `/api/games` 前綴已涵蓋新路由，不需修改

## 3. Client API 層

- [x] 3.1 `app/services/api.ts`：`RetroGameKey` 擴充 `'pacman'`，`api.games.retro` 新增對應 3 個函式

## 4. Client 資料層

- [x] 4.1 `app/composables/useGameHistory.ts`：`GAME_KEYS` 陣列與 `_handlers.gameApi()` switch 新增一個分支

## 5. 迷宮與遊戲核心邏輯（頁面自包含，tick-driven）

- [x] 5.1 `app/pages/game/pac-man.vue`：`buildRandomMaze()` 以柱狀網格規則隨機生成 19×21 迷宮（保證通道全連通，見 design.md Decision 3），含穿隧列、4 個角落大力丸、Pac-Man 與 4 隻鬼魂出生格；每次 `setupLevel()` 皆重新擲骰
- [x] 5.1b `FIXED_MAZE_TEMPLATES`／`parseFixedTemplate()`／`isMazeFullyConnected()`／`pickMaze()`：可設定的固定樣板迷宮（ASCII `#`/`.` 格式），載入時驗證尺寸／邊界／BFS 連通性，失敗自動退回隨機生成；`pickMaze()` 把隨機生成與所有固定樣板放進同一個候選池等機率抽選（見 design.md Decision 4，後台管理介面本身另待規劃）
- [x] 5.2 `PacManEngine` class：`reset()`／`setupLevel()`（過關重置迷宮豆子與位置，保留分數與命數）、`movePac()`（可隨時反向）、`step()` 逐 tick 處理移動／吃豆／碰撞／過關判定
- [x] 5.3 鬼魂 AI 三層難度（`aiTier()` 依關卡數判斷）：Lv1–2 簡化貪心＋路口隨機、Lv3–4 四性格（chaser/ambusher/flanker/shy）、Lv5+ 四性格 + scatter⇄chase 交替計時器，Lv5 以後只再靠 `getTickSpeed()` 加快速度（見 design.md Decision 1）
- [x] 5.4 驚嚇模式：吃大力丸觸發全鬼魂 flee、可反殺，連續吃鬼分數倍增（200/400/800/1600），吃掉後 `eaten` 模式返回出生格

## 6. 遊戲頁面互動與流程

- [x] 6.1 WELCOME／READY／RESULT 三段式 overlay（比照既有遊戲慣例），過關以短暫 toast 提示、不中斷遊戲流程
- [x] 6.2 玩家操作：方向鍵／WASD 控制，命歸零觸發 game over 並呼叫 `useGameHistory().actions.record()`（`score` 為跨關卡累加總分，`level` 為抵達的最高關卡）
- [x] 6.3 HUD 顯示 SCORE／LIVES／LEVEL；碰鬼與吃大力丸皆有畫面回饋（閃爍效果）
- [x] 6.4 掛載共用 `GameRateDialog` / `GameRuleDialog`，`accent-color` 採 `#ff3b3b`（不與現有十款遊戲撞色）

## 7. game-hall 入口

- [x] 7.1 `app/pages/game-hall.vue`：`gameSlots` 新增 `PAC-MAN`（`status: 'open'`，`path: '/game/pac-man'`）
- [x] 7.2 `app/components/GameMachineCard.vue`：`cuteIcon` 新增 `PAC-MAN` 圖示分支（👻）
- [x] 7.3 `app/components/GameHistoryDialog.vue`：`FILTERS`／`GAME_KEYS`／`GAME_NAME` 各新增一筆

## 8. OpenSpec 文件

- [x] 8.1 `proposal.md` / `design.md` / `tasks.md` / `specs/game-history/spec.md`（本次變更文件本身）

## 9. 驗證

- [x] 9.1 以 Playwright 自動化腳本驅動真實無頭瀏覽器測試：方向鍵移動有反應、吃豆分數確實增加（40→170）、鬼魂會與 Pac-Man 碰撞並正確扣命（3→2）、4 隻鬼魂與迷宮/HUD 皆正常渲染、無 console/page 錯誤
- [ ] 9.2（待手動補測）穿隧通道、吃大力丸觸發驚嚇與吃鬼連鎖加分、吃光全部豆子過關並重置迷宮、命數歸零的 RESULT 結算畫面
- [ ] 9.3（待手動補測）實際玩到 Lv1–2／Lv3–4／Lv5+ 三個難度區間，確認鬼魂行為肉眼可辨的差異，且 Lv5 之後只有速度變化（目前僅靜態程式碼審閱確認邏輯一致，未實際遊玩驗證體感）
- [ ] 9.4（待手動補測）未登入：確認寫入 localStorage、重整頁面紀錄仍在；已登入：確認 server 端紀錄寫入、coin 依 `score × coinRate` 入帳、單局與每日上限機制正確
- [x] 9.5 `GameHistoryDialog` 篩選 tab／`game-hall.vue` 卡片：已用 curl／瀏覽器確認 PAC-MAN 卡片可點擊進入 `/game/pac-man`、`/api/games/retro/rates` 公開端點回傳 pacman 費率
- [x] 9.6 `npx nuxt typecheck`：確認新增/修改檔案無新增型別錯誤（既有的 6hc/kl8/kl10 型別錯誤為修改前既存，與本次變更無關）
- [x] 9.7 迷宮隨機生成：獨立腳本對 `buildRandomMaze()` 跑 300 次 BFS 連通性驗證，100% 連通、300 次皆為不同版面；瀏覽器 8 次真實載入牆壁數量確實不同（102～124 區間）
- [x] 9.8 固定樣板混選：瀏覽器 20 次真實載入逐格比對牆面座標，9/20（≈45%）與 `classic-01` 樣板完全一致，符合「隨機生成／固定樣板等機率混選」的設計（見 design.md Decision 4），過程無 console 警告（代表樣板驗證皆通過，未觸發退回隨機生成的分支）
