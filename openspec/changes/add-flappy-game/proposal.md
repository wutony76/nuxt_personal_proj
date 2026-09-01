## Why

遊戲中心目前十六款遊戲涵蓋動作／反應（射擊、跑酷）、消除（match3 系列、orb match）、解謎（minesweeper）、策略規劃（solitaire）、對戰猜測（battleship）等類型，但沒有一款是「單鍵反應＋連續垂直物理」的經典反射型遊戲。新增 **FLAPPY**（原創像素角色版本，非 Flappy Bird 素材／角色／Logo 的複製）補齊這個空缺：玩家只需一個操作（點擊／Space／Touch）對抗持續重力，穿越自動捲動而來的成對管道空隙，是規則最單純、但對操作時機要求最高的一款。玩法核心與 `app/pages/game/runner.vue` 已驗證過的「重力＋跳躍＋自動捲軸＋障礙陣列 tick 移動」模式同源，可大量參考既有實作經驗，但角色的「連續受重力下墜、無固定地面站立姿態」與管道的「上下成對＋中間 gap」資料結構是本次新增的部分，需要獨立的物理與碰撞設計（詳見 design.md）。

## What Changes

- 新增遊戲頁面 `app/pages/game/flappy.vue`（**FLAPPY**）：
  - **Game Loop**：比照 `runner.vue` 的 `setInterval` 固定 tick（`TICK_MS`）驅動，每個 tick 依序執行「玩家物理積分 → 管道捲動與回收 → 管道生成 → 碰撞判定 → 通關計分」，非 `requestAnimationFrame`、非 Canvas。
  - **Player／Gravity／Jump**：角色只有垂直方向的連續物理，無「站立／下蹲」等離散姿態（與 runner 的 `PlayerState` 不同）；每 tick `velocityY += gravity`、`playerY += velocityY`；點擊／Space／Touch 觸發 `flap()`：`velocityY = jumpVelocity`（固定負值上衝，非疊加）。角色固定在畫面左側偏左的 x 座標（比照 runner 的 `PLAYER_X` 固定側視角）。
  - **Pipe／Obstacle**：管道陣列 `pipes: Pipe[]`，每筆 `{ id, x, gapTop, gapHeight, width, passed }`，代表「上管道從 0 到 gapTop、下管道從 gapTop+gapHeight 到畫面底部」的成對結構；比照 runner 的 `obstacles` 陣列 tick 中 `x -= scrollSpeed`、超出畫面左側即從陣列移除、`spawnPipe()` 定時生成新的一組（`gapTop` 隨機、`gapHeight` 固定為 `pipeGap`）。
  - **Auto Scroll**：`scrollSpeed` 隨分數提升緩步增加，上限為 `maxSpeed`（比照 runner 的 `scrollSpeed`/`SCROLL_SPEED_PER_LEVEL` 隨等級提升手法，但 FLAPPY 沒有離散等級，改成連續依分數內插並夾住上限）。
  - **Collision**：`checkCollision()` 純函式集中判定，範圍僅限「角色矩形框」與「管道上／下兩段矩形框」重疊，以及「角色觸底（地面）」；撞到畫面頂端（ceiling）不算 Game Over，只將 `playerY` 夾住在 0、`velocityY` 歸零（避免直接飛出畫面外），比照多數 Flappy 類遊戲的既定手感，並非新增判定漏洞（詳見 design.md Decision 5）。
  - **Score**：每通過一組管道（管道右緣越過角色左緣且該組未計分過）+1 分，`passed` 旗標防止重複計分；分數即「通過管道數」，理論無上限。
  - **High Score**：不另外設計儲存機制，直接讀 `useGameHistory().statsByGame['flappy'].best`（比照既有慣例）。
  - **Game Over**：撞到管道任一段或觸底時立即結束，顯示 `GAME OVER` overlay，呼叫 `useGameHistory().actions.record()` 寫入分數。
  - **Restart**：完整重置 Player／Pipes／Score／Scroll Speed／GameState，不殘留上一局資料。
  - **Pause**：ESC／P 觸發 `PAUSED` overlay，暫停期間停止 tick（不受重力影響、不捲動、不計時），比照 runner 的 pause/resume 慣例。
  - **Keyboard／Mouse／Touch**：Space／`↑`／滑鼠左鍵點擊／觸控 tap 皆觸發 `flap()`，比照既有遊戲 `window.addEventListener('keydown'/'keyup', ...)` 於 `onMounted`/`onUnmounted` 綁定與解綁的既有模式，額外在遊戲畫面容器綁定 `click`/`touchstart`。
  - **Pixel UI**：角色與管道皆為原創 CSS 方塊拼接（非外部圖片、非 Canvas 繪製），主題色採 `#06d6a0`（青綠色，跟現有遊戲皆不撞色），刻意避開 Flappy Bird 標誌性的「黃色鳥＋綠色水管＋淺藍天空」配色與角色輪廓（詳見 design.md Decision 6）。
  - 遊戲參數集中於 `app/utils/flappyEngine.ts` 頂部：`gravity`／`jumpVelocity`／`scrollSpeed`（含 `baseScrollSpeed`／`scrollSpeedPerPoint`）／`pipeGap`／`pipeSpawnInterval`／`maxSpeed`。
  - 掛載共用 `GameRateDialog`／`GameRuleDialog`。
- 新增純邏輯核心 `app/utils/flappyEngine.ts`（不依賴 Vue），比照 `battleshipEngine.ts`／`solitaireEngine.ts` 先例，內含 Player 物理／Pipe 生成與回收／Collision／Score／Game State，供頁面以 `getSnapshot()` 同步進 `reactive()` state。
- 新增 server 端服務檔 `server/services/game/retro/flappy.ts`，繼承既有 `RETRO_GAME_BASE`（`maxReasonableScore()` 抓開放式計分的寬裕上限，見 design.md Decision 4），並在 `server/services/storage.ts` 的遊戲初始化區塊新增註冊。
- 新增 server 端 API 路由 `server/api/games/retro/flappy/history.{get,post,delete}.ts`，比照既有樣板。
- `app/services/api.ts` 的 `RetroGameKey` 擴充新增 `'flappy'`，`api.games.retro` 新增對應 3 個函式。
- `app/composables/useGameHistory.ts` 的 `GAME_KEYS` 與 `_handlers.gameApi()` 擴充一個新分支。
- `app/components/GameHistoryDialog.vue` 的篩選 tab／`GAME_KEYS`／遊戲名稱對照擴充一筆。
- `app/config/gameSprites.ts` 新增一筆（icon 🐤，glow `#06d6a0`），連帶 `GameMachineCard.vue`／`GameHallSprites.vue` 自動套用。
- `app/pages/game-hall.vue` 新增一筆 `id: 18`、`name: 'FLAPPY'`、`status: 'open'`、`path: '/game/flappy'` 的卡片。

## Capabilities

### Modified Capabilities

- `game-history`：既有的遊戲紀錄／coin 轉換能力擴充支援 `flappy` 這個新的 `gameKey`；`score` 語意為「通過管道數」，屬於「表現越好分數越高、理論無上限」的既有開放式計分哲學（與 runner／racing 同類，跟 battleship／minesweeper 的「有精確理論上限」不同），沿用 `maxReasonableScore()` 抓寬裕防偽造上限的既有慣例。

## Impact

- 新增檔案（client）：`app/pages/game/flappy.vue`、`app/utils/flappyEngine.ts`
- 修改檔案（client）：`app/services/api.ts`、`app/composables/useGameHistory.ts`、`app/components/GameHistoryDialog.vue`、`app/config/gameSprites.ts`、`app/pages/game-hall.vue`
- 新增檔案（server）：`server/services/game/retro/flappy.ts`、對應 3 支 API 路由檔
- 修改檔案（server）：`server/services/storage.ts`（遊戲初始化區塊新增 `new RetroFlappyClass()`）
- 不涉及資料庫，沿用既有 in-memory `Storage.retroGames` 架構
- 本次架構首度出現「角色無固定站立姿態、純連續垂直物理＋成對管道（上下兩段＋中間 gap）」的資料結構；沿用專案既有 DOM/CSS 渲染慣例，**不引入 Canvas**（原始需求提及 Canvas，惟與專案現況不符，詳見 design.md Context／Decision 3，列為 Open Question 待使用者確認）
- 不影響既有十六款遊戲（snake／racing／tetriminos／match3rush／match3classic／pong／runner／spaceShooter／minesweeper／pacman／spaceInvaders／solitaire／typing／breakout／orbMatch／battleship）的程式碼與行為
- 本文件屬第一階段規劃產出（proposal／design／tasks／spec delta），尚未進入實作階段
