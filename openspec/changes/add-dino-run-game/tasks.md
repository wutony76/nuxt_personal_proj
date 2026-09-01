> **使用者已拍板採用方案 B（不新增 DINO RUN），本清單全數作廢，以下任務皆不執行。** 以下內容保留作為方案 A 的分析紀錄；實際的 Double Jump／Day-Night／Challenge Mode 工作項目，待另一個獨立的 `update-runner-game` 類提案重新展開任務。

## 1. Server 端服務層

- [ ] 1.1 新增 `server/services/game/retro/dinoRun.ts`：繼承 `RETRO_GAME_BASE`（`coinRate: 0.5`、`coinCapPerRun: 300`、`coinDailyCap: 100000`、`maxReasonableScore(): 1900`——比照 RUNNER 的 1700 略寬估算，見 design.md Decision 4）
- [ ] 1.2 `server/services/storage.ts`：遊戲初始化區塊新增 import 並註冊 `new RetroDinoRunClass()`

## 2. Server 端 API 路由

- [ ] 2.1 新增 `server/api/games/retro/dinoRun/history.get.ts`、`history.post.ts`、`history.delete.ts`（比照既有 16 款遊戲樣板）
- [ ] 2.2 確認 `server/middleware/auth.ts` 的 `/api/games` 前綴已涵蓋新路由，不需修改

## 3. Client API 層

- [ ] 3.1 `app/services/api.ts`：`RetroGameKey` 擴充 `'dinoRun'`，`api.games.retro` 新增對應 3 個函式

## 4. Client 資料層

- [ ] 4.1 `app/composables/useGameHistory.ts`：`GAME_KEYS` 陣列與 `_handlers.gameApi()` switch 新增一個分支

## 5. 遊戲核心邏輯（`app/utils/dinoRunEngine.ts` 或重用 RUNNER 邏輯，視方案決議）

- [ ] 5.1 型別與常數：`PlayerState`（`standing`/`jumping`/`ducking`）、`ObstacleType`（`ground`/`air`）、`LEVEL_SCORE_THRESHOLDS` 難度分段（比照 RUNNER 設計，見 design.md Context 第 2 點「可重用模組」）
- [ ] 5.2 Jump／Gravity 物理：跳躍高度、重力位移計算（比照 RUNNER `jumpOffset` 設計）
- [ ] 5.3 Double Jump（本次差異化玩法，見 design.md Decision 2）：`jumpsRemaining` 計數，起跳消耗一次，著地重置為 2，下蹲狀態不可觸發
- [ ] 5.4 Obstacle：`spawnObstacle()` 隨機生成地面/空中障礙（比照 RUNNER 的 `isAir` 隨機邏輯）
- [ ] 5.5 Auto Scroll／Collision：捲動速度隨等級提升，碰撞判定（比照 RUNNER 邏輯）
- [ ] 5.6 Score／Difficulty Increase：存活距離持續累加，依 `LEVEL_SCORE_THRESHOLDS` 分段提高捲動速度與障礙密度
- [ ] 5.7 `DinoRunEngine` class：整合 5.1～5.6，提供 `reset()`、`getSnapshot()`

## 6. 遊戲頁面與互動流程

- [ ] 6.1 `app/pages/game/dino-run.vue`：`reactive()` state 鏡像 engine snapshot，`_handlers`/`_actions`/`click` 三分法（比照 RUNNER 慣例）
- [ ] 6.2 原創 Pixel Dino 角色與原創障礙物造型（純 CSS/DOM 繪製，不使用外部圖片，不得使用 Chrome Dino 素材）
- [ ] 6.3 waiting/ready/countdown/playing/pause/gameover 狀態流程（比照 RUNNER 既有流程）
- [ ] 6.4 Keyboard（↑/W/空白鍵跳躍、二次按跳躍鍵觸發 Double Jump、↓/S 下蹲）／Touch（點擊跳躍、上滑二段跳、下滑下蹲）
- [ ] 6.5 Game Over：`useGameHistory().actions.record()` 寫入，`score` 為存活距離
- [ ] 6.6 Restart／Pause：完整重置狀態，不殘留上一局資料
- [ ] 6.7 掛載共用 `GameRateDialog`／`GameRuleDialog`，規則文字需說明 Double Jump 操作方式，`accent-color` 採 `#6a994e`（橄欖綠）

## 7. game-hall 入口

- [ ] 7.1 `app/pages/game-hall.vue`：`gameSlots` 新增 `{ id: 25, name: 'DINO RUN', status: 'open', path: '/game/dino-run' }`
- [ ] 7.2 `app/config/gameSprites.ts`：`GAME_SPRITES` 新增一筆（`key: 'dinoRun'`, `icon: '🦕'`, `glow: '#6a994e'`）
- [ ] 7.3 `app/components/GameHistoryDialog.vue`：`FILTERS`／`GAME_KEYS`／`GAME_NAME` 各新增一筆

## 8. OpenSpec 文件

- [ ] 8.1 `proposal.md` / `design.md` / `tasks.md` / `specs/game-history/spec.md`（本次變更文件本身，隨方案確認後更新為定案版本）

## 9. 驗證

- [ ] 9.1 `npm run dev` 啟動後，實際在瀏覽器測試 Jump／Gravity／Ground Obstacle／Flying Obstacle／Duck 閃避邏輯正確
- [ ] 9.2 實測 Double Jump：空中再次按跳躍鍵可再跳一次，著地後重置，下蹲時不可觸發
- [ ] 9.3 實測 Auto Scroll／Difficulty Increase：分數提升時捲動速度與障礙密度同步提高，難度不至於無法遊玩
- [ ] 9.4 實測 Collision：撞到地面或空中障礙皆正確結束遊戲
- [ ] 9.5 實測 Score／High Score：分數持續累加，無上限；`GameHistoryDialog` 能正確顯示 `DINO RUN` 紀錄
- [ ] 9.6 實測 Restart／Pause：完整重置，不殘留上一局資料
- [ ] 9.7 未登入：確認寫入 localStorage、重整頁面紀錄仍在
- [ ] 9.8 已登入：確認 server 端紀錄寫入、coin 依 `score × coinRate` 入帳、單局與每日上限機制正確
- [ ] 9.9 `game-hall.vue` 卡片正常顯示（id: 25），可點擊進入 `/game/dino-run`
- [ ] 9.10 確認沒有 Console Error，且 **`app/pages/game/runner.vue` 未被修改、行為完全不受影響**，不影響其他既有遊戲
- [ ] 9.11 `npx nuxt typecheck` 確認新增/修改檔案無型別錯誤
