## Why

遊戲中心目前十六款遊戲涵蓋動作／反應（射擊、跑酷）、消除（match3 系列、orb match）、解謎（minesweeper）、策略規劃（solitaire）、對戰（battleship）等類型，但沒有一款是「單一棋盤內數字合併」的**滑動益智遊戲**。新增 **2048** 補齊這個空缺：4×4 棋盤上以方向鍵／WASD／Touch Swipe 讓所有方塊往同一方向滑動、相同數字碰撞合併，直到合成 2048 或無法再移動。核心規則單純但邊界條件明確（同數字合併、一次移動每格只能合併一次、合併後座標壓縮、新 Tile 隨機產生、Game Over 判定），適合抽成獨立引擎檔，並沿用 MINESWEEPER 的 Grid 渲染模式與既有 `useGameHistory` 記錄／coin 架構。

## What Changes

- 新增遊戲頁面 `app/pages/game/2048.vue`（**2048**）：
  - **4×4 Board**：16 格棋盤，每格為空或一個 Tile（數值 2 的冪次：2/4/8/16/…/2048/…）。
  - **移動與合併**：玩家觸發上下左右任一方向後，該方向上所有 Tile 依序「壓縮（移除空格）→ 相鄰同值合併 → 再次壓縮」；同一次移動中，剛合併產生的新 Tile **不可再與下一個 Tile 二次合併**（比照原版規則，一次移動每格只合併一次）。
  - **新增 Tile**：只有在該次移動「確實造成棋盤變化（至少一格位置或數值改變）」時，才在任一空格隨機新增一個 Tile，數值 2 機率 90%、數值 4 機率 10%；若該方向沒有任何格子能移動或合併，視為無效移動，不消耗回合、不新增 Tile。
  - **Score**：分數＝所有合併事件的「合併後數值」累加（例如 2+2→4 得 4 分，之後 4+4→8 再得 8 分），無理論上限，典型優秀表現（合成 2048）落在數千至 2 萬分左右。
  - **Best Score**：不另建儲存機制，直接讀取既有 `useGameHistory.ts` 的 `statsByGame.value['2048']?.best`。
  - **2048 判定**：任一 Tile 首次達到 2048 時顯示 `YOU WIN` 提示 banner，但**遊戲不強制結束**，玩家可選擇 `[CONTINUE]` 繼續挑戰更高數值，或 `[RESTART]` 重來（比照原版 2048 的既定體驗，避免玩家在達標當下被迫結束）。
  - **Game Over**：棋盤全滿（16 格皆有 Tile）且四個方向皆無法移動或合併時，判定 Game Over 並立即結算紀錄。
  - **Restart**：完整重置 Board／Score／Tile id 計數器／GameState／WIN banner 狀態，不殘留上一局資料。
  - **Pause**（ESC／P）：`PAUSED` overlay，`[RESUME]`／`[RESTART]`／`[EXIT]`，暫停期間停用棋盤輸入。
  - **Keyboard**：方向鍵與 WASD 皆可觸發對應方向移動。
  - **Touch Swipe**：`pointerdown` 記錄起點座標＋`setPointerCapture`，`pointerup` 計算與起點的座標差量（dx/dy），取絕對值較大的軸向判斷上下或左右，差量需超過閾值（30px）才視為有效滑動，否則視為點按、不觸發移動——**這是全專案第一款需要「由 pointerdown 到 pointerup 的座標差量判斷方向」的手勢偵測**（先例 orb-match 的拖曳偵測是連續追蹤 `pointermove` 判斷跨格，用途與判定時機皆不同，見 design.md Decision 4）。
  - **Pixel UI**：沿用既有復古像素風格（等寬字型／硬邊框／無漸層陰影過度使用），Tile 依數值套用不同底色（2/4 淺色、8/16/32... 漸深，2048 用主題色 `#f4a261` 強調），棋盤採 MINESWEEPER 的 `flatCells` computed 攤平＋`grid-template-columns: repeat(4, var(--cell))` 渲染模式。
  - 掛載共用 `GameRateDialog`／`GameRuleDialog`，主題色採 `#f4a261`（沙橙色，呼應 2048 原版配色印象但非抄襲，且不與現有十六款遊戲的 glow 色碼相同）。
- 新增純邏輯核心 `app/utils/game2048Engine.ts`（不依賴 Vue），比照 `match3Engine.ts`／`battleshipEngine.ts` 先例，內含 Board／Tile／移動壓縮合併／新 Tile 產生／Game Over／2048 判定邏輯，供頁面以 `getSnapshot()` 同步進 `reactive()` state。
- 新增 server 端服務檔 `server/services/game/retro/2048.ts`，繼承既有 `RETRO_GAME_BASE`（`coinRate`／`coinCapPerRun`／`coinDailyCap`／`maxReasonableScore()` 校準見 design.md Decision 6），並在 `server/services/storage.ts` 的遊戲初始化區塊新增註冊。
- 新增 server 端 API 路由 `server/api/games/retro/2048/history.{get,post,delete}.ts`，比照既有樣板。
- `app/services/api.ts` 的 `RetroGameKey` 擴充新增 `'2048'`，`api.games.retro` 新增對應 3 個函式。
- `app/composables/useGameHistory.ts` 的 `GAME_KEYS` 與 `_handlers.gameApi()` 擴充一個新分支。
- `app/components/GameHistoryDialog.vue` 的篩選 tab／`GAME_KEYS`／遊戲名稱對照擴充一筆。
- `app/config/gameSprites.ts` 新增一筆（icon 🔢、沿用既有 `bounce` 動畫值、glow `#f4a261`），連帶 `GameMachineCard.vue`／`GameHallSprites.vue` 自動套用，不需新增動畫 CSS class。
- `app/pages/game-hall.vue` 新增一筆 `id: 17`、`name: '2048'`、`status: 'open'`、`path: '/game/2048'` 的卡片。

## Capabilities

### Modified Capabilities

- `game-history`：既有的遊戲紀錄／coin 轉換能力擴充支援 `2048` 這個新的 `gameKey`；`score` 語意為「本局所有合併事件的合併後數值加總」，無理論上限但實務上分數量級明顯低於多數既有遊戲（典型優秀表現數千至 2 萬分），`meta` 欄位可額外記錄 `maxTile`（本局達成的最大數值）／`moves`（有效移動次數）供統計呈現，但不影響 `score` 計算本身。

## Impact

- 新增檔案（client）：`app/pages/game/2048.vue`、`app/utils/game2048Engine.ts`
- 修改檔案（client）：`app/services/api.ts`、`app/composables/useGameHistory.ts`、`app/components/GameHistoryDialog.vue`、`app/config/gameSprites.ts`、`app/pages/game-hall.vue`
- 新增檔案（server）：`server/services/game/retro/2048.ts`、對應 3 支 API 路由檔
- 修改檔案（server）：`server/services/storage.ts`（遊戲初始化區塊新增 `new Retro2048Class()`）
- 不涉及資料庫，沿用既有 in-memory `Storage.retroGames` 架構
- 首度出現「由 pointerdown 到 pointerup 的座標差量判斷四向 Swipe」的手勢偵測方式（見 design.md Decision 4），全專案先前唯一的觸控互動 orb-match 是連續拖曳追蹤，判定邏輯與時機皆不同，需獨立實作，不重用 orb-match 的拖曳程式碼
- 不影響既有十六款遊戲（snake／racing／tetriminos／match3rush／match3classic／pong／runner／spaceShooter／minesweeper／pacman／spaceInvaders／solitaire／typing／breakout／orbMatch／battleship）的程式碼與行為
