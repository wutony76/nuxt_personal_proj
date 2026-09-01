## Why

遊戲中心目前 16 款遊戲涵蓋動作反應（射擊、跑酷）、消除（match3 系列、orb match）、解謎（minesweeper）、策略規劃（solitaire）、對戰（battleship）等類型，但沒有一款是「XOR 切換式」的純邏輯棋盤解謎遊戲。LIGHTS OUT 是經典益智題型：點擊一格會連動翻轉自己與上下左右鄰格的燈泡狀態，目標是讓整片棋盤全滅（全 OFF），規則單純、操作直覺，適合補齊「輕量純邏輯棋盤解謎」這個空缺。且座標邊界判斷可以直接沿用 MINESWEEPER 已驗證的模式、關卡遞增可以直接沿用 BREAKOUT 已驗證的模式，不需要新建架構，是本次新增遊戲裡實作成本相對低的一款。

## What Changes

- 新增遊戲頁面 `app/pages/game/lights-out.vue`（**LIGHTS OUT**）：
  - **Grid 棋盤**：依當前 level 從關卡資料表讀取棋盤大小與初始 ON/OFF 盤面，比照 MINESWEEPER 的 `flatCells` computed 攤平 + `grid-template-columns: repeat(N, var(--cell))` 渲染。
  - **Toggle Logic／Neighbor Toggle**：點擊一格 → 自己＋上／下／左／右鄰格 XOR 切換 ON/OFF；超出棋盤範圍的鄰居忽略。沿用 MINESWEEPER `neighbors()`/`inBounds()` 的邊界判斷模式，差異只在鄰域從 8 方向（Moore neighborhood）改成 4 方向（von Neumann neighborhood），且動作語意從「展開（reveal）」改成「切換（toggle）」，見 design.md Decision 1。
  - **Move Counter**：每次點擊（含鍵盤/觸控觸發的等效操作）遞增一次；LIGHTS OUT 沒有「非法點擊」的概念，任何一格都能點。
  - **Level／關卡資料表**：比照 BREAKOUT 的 `LEVELS` 陣列＋依 level 讀當關參數的模式，集中管理於 `lightsOutEngine.ts`；關卡越高棋盤越大（3×3 → 4×4 → 5×5 → 6×6…）、同尺寸 tier 內步數上限（`moveLimit`）越低，見 design.md Decision 2。
  - **Win Detection**：棋盤所有 Cell 皆為 OFF 時判定過關，短暫顯示 `LEVEL CLEAR` 後自動重建為下一關的初始盤面（`level += 1`）。
  - **Game Over**：當前關卡的累計步數超過該關 `moveLimit` 仍未全部熄燈時，立即判定 Game Over（呼應原始需求 MVP 清單中「Game Over / Clear」是獨立於 Win 的另一種結局，非 continue/lives 制），見 design.md Decision 3。
  - **Restart**：完整重置 Level／Grid／Move Counter／Score／GameState，不殘留上一局資料。
  - **Pause**（ESC/P）：`PAUSED` overlay 停用點擊；本遊戲非 tick-driven，只需要停用輸入，不需要停計時器。
  - **Keyboard**：方向鍵移動一個游標高亮格，Space/Enter 觸發該格 Toggle，與滑鼠點擊呼叫同一支 `toggleCell()`。
  - **Touch**：點按即 Toggle，與滑鼠 `click` 共用同一個事件 handler，不需要額外的拖曳/長按手勢。
  - **不實作 Undo**：原始需求「不允許 Undo 的話，先不要實作」＋列為第二階段項目，本次 MVP 不做（見 Non-Goals）。
  - **計分**：`ClearBonus(level)` 固定過關獎勵 ＋ 步數反比的 `EfficiencyScore`，逐關累加進 `state.score`，直到 Game Over 才寫入一筆紀錄（比照 BREAKOUT 累計到 game over 才 `record()` 的既有模式），公式細節見 design.md Decision 4。
  - **HUD**：LEVEL／MOVES／MOVE LIMIT／SCORE。
  - 掛載共用 `GameRateDialog`／`GameRuleDialog`，主題色採 `#adb5bd`（鋼灰色，呼應燈泡熄滅意象，不與現有 16 款遊戲的 glow 色碼相同）。
- 新增純邏輯核心 `app/utils/lightsOutEngine.ts`（不依賴 Vue），比照 `battleshipEngine.ts` 的 class + `getSnapshot()` 模式，內含 `toggleCell(grid, x, y)` 純函式、`LEVELS` 關卡資料表、Win／Game Over 判定，供頁面以 `getSnapshot()` 同步進 `reactive()` state。
- 新增 server 端服務檔 `server/services/game/retro/lightsOut.ts`，繼承既有 `RETRO_GAME_BASE`，並在 `server/services/storage.ts` 的遊戲初始化區塊新增註冊。
- 新增 server 端 API 路由 `server/api/games/retro/lightsOut/history.{get,post,delete}.ts`，比照既有樣板。
- `app/services/api.ts` 的 `RetroGameKey` 擴充新增 `'lightsOut'`，`api.games.retro` 新增對應 3 個函式。
- `app/composables/useGameHistory.ts` 的 `GAME_KEYS` 與 `_handlers.gameApi()` 擴充一個新分支。
- `app/components/GameHistoryDialog.vue` 的篩選 tab／`GAME_KEYS`／`GAME_NAME` 對照擴充一筆。
- `app/config/gameSprites.ts` 新增一筆（icon 💡，glow `#adb5bd`），連帶 `GameMachineCard.vue`／`GameHallSprites.vue` 自動套用。
- `app/pages/game-hall.vue` 新增一筆 `id: 22`、`name: 'LIGHTS OUT'`、`status: 'open'`、`path: '/game/lights-out'` 的卡片。

## Capabilities

### Modified Capabilities

- `game-history`：既有的遊戲紀錄／coin 轉換能力擴充支援 `lightsOut` 這個新的 `gameKey`；`score` 語意為「每過一關的 ClearBonus + 步數反比效率分數」逐關累加，直到 Game Over 才結算寫入一筆紀錄（比照 BREAKOUT 的累計模式，而非像 BATTLESHIP 單局固定值的模式）；`meta` 欄位記錄 `levelReached`／`movesUsed`，為第二階段 Best Moves 功能預留欄位，不影響 `score` 計算本身。

## Impact

- 新增檔案（client）：`app/pages/game/lights-out.vue`、`app/utils/lightsOutEngine.ts`
- 修改檔案（client）：`app/services/api.ts`、`app/composables/useGameHistory.ts`、`app/components/GameHistoryDialog.vue`、`app/config/gameSprites.ts`、`app/pages/game-hall.vue`
- 新增檔案（server）：`server/services/game/retro/lightsOut.ts`、對應 3 支 API 路由檔
- 修改檔案（server）：`server/services/storage.ts`（遊戲初始化區塊新增 `new RetroLightsOutClass()`）
- 不涉及資料庫，沿用既有 in-memory `Storage.retroGames` 架構
- 不影響既有 16 款遊戲（snake／racing／tetriminos／match3rush／match3classic／pong／runner／spaceShooter／minesweeper／pacman／spaceInvaders／solitaire／typing／breakout／orbMatch／battleship）的程式碼與行為
- 本階段（本次變更）只產出 OpenSpec 文件（README／proposal／design／tasks／specs），不涉及任何實際程式碼變更；`app/`、`server/`、`shared/` 底下既有檔案完全未被觸碰
