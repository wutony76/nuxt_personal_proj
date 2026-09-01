## Why

遊戲中心目前十六款遊戲（含新加入的 BATTLESHIP）已涵蓋動作／反應、消除、解謎、策略規劃與「雙棋盤隱藏資訊」回合制對戰，但沒有一款是「公開資訊、輪流落子、連線判定」型態的經典棋類遊戲。新增 CONNECT 4（四子棋，Player vs AI）補齊這個空缺：7×6 棋盤、玩家與 AI 交替選擇欄位讓棋子重力落下，任一方率先連成 4 子（Horizontal／Vertical／Diagonal）即獲勝，棋盤填滿無人連線則 Draw。操作與判定模式延續 BATTLESHIP 已驗證的「回合制對戰＋玩家與 AI 共用同一套判定純函式」架構（見 `add-battleship-game` design.md Decision 7），但本次棋盤資訊完全公開（無隱藏資訊），且不需要獨立的佈局階段，複雜度低於 BATTLESHIP。

本次為 OpenSpec 第一階段的規劃文件，僅產出架構分析、可重用模組盤點與 MVP 順序，供使用者確認後才進入 tasks 實作。

## What Changes

- 新增遊戲頁面 `app/pages/game/connect4.vue`（**CONNECT 4**）：
  - **7×6 棋盤**：比照 MINESWEEPER 的 `flatCells` computed 攤平二維陣列＋`grid-template-columns: repeat(7, var(--cell))` 渲染模式，每格顯示 `EMPTY`／`PLAYER`／`AI` 三種狀態之一。
  - **Column Selection**：玩家點擊欄位（欄頂按鈕或整欄 hover 高亮）觸發落子，欄位已滿時該欄停用不可點擊。
  - **Gravity Drop**：落子邏輯瞬間計算並更新該欄最低空位（`getNextOpenRow()`），視覺上以簡單 CSS transition 讓棋子從欄頂滑到實際落點格，純裝飾用途、不影響判定時機（不需要 canvas 物理）。
  - **Turn 狀態機**：`PLAYER_TURN → PLAYER_DROP → PLAYER_RESULT → AI_TURN(400~800ms delay) → AI_DROP → AI_RESULT → PLAYER_TURN …` 循環直到 `GAME_OVER`，玩家先手；比照 BATTLESHIP 精神但拿掉佈局階段（`PLACEMENT`／`READY`），因為 CONNECT 4 一開局即可直接對戰。
  - **Win Detection**：`checkWinFromMove()` 為單一純函式，從剛落子的座標往 Horizontal／Vertical／Diagonal(↗↙)／Diagonal(↘↖) 四個軸雙向掃描，只要任一軸連續同色達 4 即判定獲勝；玩家落子與 AI 落子後皆呼叫同一支函式判定，不寫兩份邏輯。
  - **Draw 判定**：棋盤 42 格全滿（頂列皆非空）且最後一步未觸發勝利，即判定 Draw。
  - **AI（Rule-Based，MVP）**：`chooseAiColumn()` 依序評估合法欄位——(1) 若某欄可讓 AI 立即獲勝，選該欄；(2) 否則若某欄是玩家下一步的獲勝欄，選該欄阻擋；(3) 否則從所有合法欄位中隨機選一欄。AI 評估「試下是否獲勝」與正式落子後的勝負判定共用同一支 `checkWinFromMove()`，不重複寫規則（見 design.md Decision 3）。
  - **計分（需自行設計，詳見 design.md Decision 5）**：獲勝分數＝固定基礎分＋依落子效率（玩家用子數）遞減的加成，平手為固定中等分數，落敗為 0；與 BATTLESHIP「勝利分數恆為單一固定值」的既有模型不同，需在 design.md 中說明取捨並列為 Open Question 待確認。
  - **HUD**：TURN 指示（PLAYER/AI THINKING...）、已用步數、GAME OVER 結果（WIN/LOSE/DRAW）。
  - **Restart**：完整重置 Board／Turn／Score／Timer／GameState，不殘留上一局資料。
  - **Pause**（ESC/P）：`PAUSED` overlay，`[RESUME]`／`[RESTART]`／`[EXIT]`。
  - 掛載共用 `GameRateDialog`／`GameRuleDialog`，主題色採 `#e63946`（紅色，與現有十六款遊戲皆不撞色）。
- 新增純邏輯核心 `app/utils/connect4Engine.ts`（不依賴 Vue），比照 `battleshipEngine.ts` 先例，內含 Board／Gravity／Win Detection（四方向掃描）／Draw／AI 決策，供頁面以 `getSnapshot()` 同步進 `reactive()` state。
- 新增 server 端服務檔 `server/services/game/retro/connect4.ts`，繼承既有 `RETRO_GAME_BASE`，並在 `server/services/storage.ts` 的遊戲初始化區塊新增註冊。
- 新增 server 端 API 路由 `server/api/games/retro/connect4/history.{get,post,delete}.ts`，比照既有樣板。
- `app/services/api.ts` 的 `RetroGameKey` 擴充新增 `'connect4'`，`api.games.retro` 新增對應 3 個函式。
- `app/composables/useGameHistory.ts` 的 `GAME_KEYS` 與 `_handlers.gameApi()` 擴充一個新分支。
- `app/components/GameHistoryDialog.vue` 的篩選 tab／`GAME_KEYS`／遊戲名稱對照擴充一筆。
- `app/config/gameSprites.ts` 新增一筆（glow `#e63946`），連帶 `GameMachineCard.vue`／`GameHallSprites.vue` 自動套用。
- `app/pages/game-hall.vue` 新增一筆 `id: 20`、`name: 'CONNECT 4'`、`status: 'open'`、`path: '/game/connect4'` 的卡片。

## Capabilities

### Modified Capabilities

- `game-history`：既有的遊戲紀錄／coin 轉換能力擴充支援 `connect4` 這個新的 `gameKey`；`score` 語意為「勝利固定基礎分＋落子效率加成，平手固定中等分，落敗 0」，是繼 BATTLESHIP（勝利分數恆為固定值）之後第二種「非開放式表現分數」的計分模型，但引入效率加成使其與 BATTLESHIP 略有不同（見 design.md Decision 5），`meta` 欄位可額外記錄 `movesUsed` 供統計呈現。

## Impact

- 新增檔案（client）：`app/pages/game/connect4.vue`、`app/utils/connect4Engine.ts`
- 修改檔案（client）：`app/services/api.ts`、`app/composables/useGameHistory.ts`、`app/components/GameHistoryDialog.vue`、`app/config/gameSprites.ts`、`app/pages/game-hall.vue`
- 新增檔案（server）：`server/services/game/retro/connect4.ts`、對應 3 支 API 路由檔
- 修改檔案（server）：`server/services/storage.ts`（遊戲初始化區塊新增 `new RetroConnect4Class()`）
- 不涉及資料庫，沿用既有 in-memory `Storage.retroGames` 架構
- 本次為公開資訊、無隱藏棋盤的回合制對戰玩法，複雜度低於 BATTLESHIP（無佈局階段、無隱藏視角過濾邏輯）
- 本次僅實作 Rule-Based AI（優先獲勝→優先擋→隨機合法欄）；Minimax／深度搜尋／開局庫等進階策略列為 Non-Goal，留待後續變更
- 不影響既有十六款遊戲（snake／racing／tetriminos／match3rush／match3classic／pong／runner／spaceShooter／minesweeper／pacman／spaceInvaders／solitaire／typing／breakout／orbMatch／battleship）的程式碼與行為
- 本次僅為規劃文件（proposal／design／tasks／specs），尚未進入實作階段
