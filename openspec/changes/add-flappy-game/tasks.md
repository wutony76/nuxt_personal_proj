## 1. Server 端服務層

- [ ] 1.1 新增 `server/services/game/retro/flappy.ts`：繼承 `RETRO_GAME_BASE`（`coinRate: 0.7`、`coinCapPerRun: 160`、`coinDailyCap: 100000`、`maxReasonableScore(): 500`——開放式計分的寬裕上限估算，見 design.md Decision 4）
- [ ] 1.2 `server/services/storage.ts`：遊戲初始化區塊新增 import 並 `new RetroFlappyClass()`

## 2. Server 端 API 路由

- [ ] 2.1 新增 `server/api/games/retro/flappy/history.get.ts`、`history.post.ts`、`history.delete.ts`（比照既有十六款遊戲樣板）
- [ ] 2.2 確認 `server/middleware/auth.ts` 的 `/api/games` 前綴已涵蓋新路由，不需修改

## 3. Client API 層

- [ ] 3.1 `app/services/api.ts`：`RetroGameKey` 擴充 `'flappy'`，`api.games.retro` 新增對應 3 個函式（`historyFlappy`／`recordFlappy`／`clearFlappy`）

## 4. Client 資料層

- [ ] 4.1 `app/composables/useGameHistory.ts`：`GAME_KEYS` 陣列與 `_handlers.gameApi()` switch 新增一個分支

## 5. 遊戲核心邏輯（`app/utils/flappyEngine.ts`，不依賴 Vue）

- [ ] 5.1 型別與常數：`Player`／`Pipe`／`GameState`，遊戲參數集中管理（`gravity`／`jumpVelocity`／`baseScrollSpeed`／`scrollSpeedPerPoint`／`maxSpeed`／`pipeGap`／`pipeSpawnInterval`／`STAGE_WIDTH`／`STAGE_HEIGHT`／`PLAYER_X`／player 尺寸），全部集中管理（需求「遊戲參數集中管理」）
- [ ] 5.2 Player 物理：`flap()`（`velocityY = jumpVelocity`）、每 tick 重力積分（`velocityY += gravity`、`playerY += velocityY`）、撞頂夾住（`playerY <= 0` 時歸零並清除向上殘餘速度，見 design.md Decision 5）
- [ ] 5.3 Pipe 生成與回收：`spawnPipe()`（`gapTop` 隨機、`gapHeight = pipeGap`）、tick 中所有 pipe `x -= scrollSpeed()`、超出畫面左側即從陣列濾除（比照 runner 的 obstacles 陣列模式，見 design.md Decision 1）
- [ ] 5.4 Scroll 速度公式：`scrollSpeed(score) = min(maxSpeed, baseScrollSpeed + score * scrollSpeedPerPoint)`（見 design.md Decision 2）
- [ ] 5.5 Collision：`checkCollision(player, pipes)` 集中判定角色矩形 vs 管道上/下兩段矩形＋觸底地面，回傳 `gameOver: boolean`（見 design.md Decision 5）
- [ ] 5.6 Score：`checkPassed(player, pipes)`——管道右緣越過角色左緣且該組 `passed` 為 `false` 時 +1 分並標記 `passed = true`，防止重複計分
- [ ] 5.7 `FlappyEngine` class：整合 5.1~5.6，提供 `reset()`、`step()`（回傳 `{ gameOver: boolean }`）、`flap()`、`getSnapshot()`（回傳 player 位置／pipes／score／scrollSpeed）

## 6. 遊戲頁面與互動流程

- [ ] 6.1 `app/pages/game/flappy.vue`：`reactive()` state 鏡像 engine snapshot，`_handlers`/`_actions`/`click` 三分法（比照 runner／battleship 慣例）
- [ ] 6.2 Rendering：角色與管道皆為絕對定位 `<div>`（比照 runner 的 `obstacleStyle()` inline style 模式），管道以「上管＋下管」兩個矩形疊加同一 `x` 座標渲染，沿用 DOM/CSS 渲染（見 design.md Decision 3／Open Questions，若使用者確認改用 Canvas 則此項調整為 Canvas 2D 繪圖）
- [ ] 6.3 Game Loop：`setInterval(TICK_MS)` 驅動 `engine.step()` → 同步 `reactive` state → `gameOver` 時觸發結束流程（比照 runner 的 `startTickLoop()` 慣例）
- [ ] 6.4 Input：`onMounted` 綁定 `window.addEventListener('keydown', ...)`（Space／`↑`）＋畫面容器 `click`（滑鼠）＋ `touchstart`（觸控），三種輸入來源統一呼叫 `engine.flap()`；`onUnmounted`／`onBeforeUnmount` 解綁
- [ ] 6.5 HUD：SCORE（即時分數）、HIGH SCORE（讀 `useGameHistory().statsByGame['flappy'].best`）、GAME STATE 指示（READY／PLAYING／PAUSE／GAME OVER）
- [ ] 6.6 Game Over：`GAME OVER` overlay 顯示本局 SCORE／HIGH SCORE，呼叫 `useGameHistory().actions.record('flappy', 'FLAPPY', { score })`
- [ ] 6.7 Restart：完整重置 Player 位置／Pipes／Score／ScrollSpeed／GameState，不殘留上一局資料（比照 runner 的 `resetGame()`）
- [ ] 6.8 Pause（ESC／P）：`PAUSED` overlay，`[RESUME]`／`[RESTART]`／`[EXIT]`，暫停期間停止 tick、不計分、不受重力影響
- [ ] 6.9 掛載共用 `GameRateDialog` / `GameRuleDialog`，`accent-color` 採 `#06d6a0`（青綠色，不與現有十六款遊戲撞色）
- [ ] 6.10 Pixel UI：角色與管道採原創造型與配色，明確迴避 Flappy Bird 的黃色鳥型與綠色圓頭水管配色組合（見 design.md Decision 6）

## 7. game-hall 入口

- [ ] 7.1 `app/pages/game-hall.vue`：`gameSlots` 新增 `{ id: 18, name: 'FLAPPY', status: 'open', path: '/game/flappy' }`
- [ ] 7.2 `app/config/gameSprites.ts`：`GAME_SPRITES` 新增一筆（`key: 'flappy'`, `icon: '🐤'`, `anim: 'hop'`, `glow: '#06d6a0'`）
- [ ] 7.3 `app/components/GameHistoryDialog.vue`：`FILTERS`／`GAME_KEYS`／`GAME_NAME` 各新增一筆

## 8. OpenSpec 文件

- [ ] 8.1 `proposal.md` / `design.md` / `tasks.md` / `specs/game-history/spec.md`（本次變更文件本身）

## 9. 驗證

- [ ] 9.1 `npm run dev` 啟動後，實際在瀏覽器測試核心玩法：點擊/Space/Touch 使角色上升、放開後受重力下墜，手感正常
- [ ] 9.2 實測 Pipe：管道自動生成、向左捲動、超出畫面後正確從陣列移除，`gapTop` 隨機但空隙大小固定
- [ ] 9.3 實測 Collision：撞到管道上段／下段／觸底皆正確判定 Game Over；撞頂只夾住位置、不觸發 Game Over
- [ ] 9.4 實測 Score：每通過一組管道正確 +1 分，同一組管道不會重複計分
- [ ] 9.5 實測 Scroll 難度曲線：`scrollSpeed` 隨分數提升，達到 `maxSpeed` 後不再繼續加快
- [ ] 9.6 實測 Restart：確認完整重置，不殘留上一局的角色位置/管道/分數/速度狀態
- [ ] 9.7 實測 Pause：ESC/P 觸發暫停，`[RESUME]`/`[RESTART]`/`[EXIT]` 行為正確，暫停期間角色不受重力影響
- [ ] 9.8 未登入：確認寫入 localStorage、重整頁面紀錄仍在
- [ ] 9.9 已登入：確認 server 端紀錄寫入、coin 依 `score × coinRate` 入帳、單局與每日上限機制正確
- [ ] 9.10 `GameHistoryDialog` 篩選 tab 能正確顯示 `FLAPPY` 紀錄與統計，`HIGH SCORE` 正確反映 `statsByGame` 的 `best` 值
- [ ] 9.11 `game-hall.vue` 卡片正常顯示、可點擊進入 `/game/flappy`
- [ ] 9.12 確認沒有 Console Error，不影響其他既有十六款遊戲
- [ ] 9.13 `npx nuxt typecheck` 確認新增/修改檔案無型別錯誤
