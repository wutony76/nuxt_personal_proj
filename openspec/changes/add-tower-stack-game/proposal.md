## Why

遊戲中心目前十六款遊戲涵蓋動作／反應（射擊、跑酷）、消除（match3 系列、orb match）、解謎（minesweeper）、策略規劃（solitaire）、對戰猜測（battleship）等類型，但沒有一款是「單一動作反覆疊加、靠精準時機控制寬度縮減」的**一鍵節奏堆疊遊戲**。新增 TOWER STACK 補齊這個空缺：方塊持續水平來回移動，玩家只需在對的時機按下一個按鍵（點擊／Space／觸控皆可）讓方塊落下，疊在塔頂；疊放位置越準，塔越不會變窄，連續完美疊放可以累積 Combo 加分；一旦完全沒有重疊，遊戲立即結束。操作只有「一個動作」，比 MINESWEEPER 的點擊判讀、BATTLESHIP 的座標選取更單純，是本次補齊「極簡操作、考驗手感節奏」這個玩法象限的目的。

## What Changes

- 新增遊戲頁面 `app/pages/game/tower-stack.vue`（**TOWER STACK**）：
  - **Moving Block**：塔頂上方有一個持續水平來回移動的方塊，移動速度為 `blockSpeed`，抵達畫面邊界即反彈方向，比照全專案零 `requestAnimationFrame`／零 `<canvas>` 慣例，改用 `setInterval` tick 驅動 DOM 元素座標。
  - **Drop（一鍵觸發）**：玩家點擊畫面／按 `Space`／觸控畫面，讓目前移動中的方塊立即停止並落下疊到塔頂。
  - **Overlap Detection（重疊判定）**：以一維區間交集運算比較「新方塊的水平範圍」與「塔頂現有層的水平範圍」，交集為 0 判定完全沒有重疊。
  - **Block Resize（寬度縮減）**：交集不為 0 且未達 Perfect 判定時，新層寬度＝交集寬度、位置＝交集起點，塔身因此變窄；此為本次唯一新架構，詳見 `design.md`。
  - **Block Falling（掉落碎片）**：未落入交集範圍的部分不會憑空消失，而是產生一個短暫存在的「掉落碎片」物件（比照 `breakout.vue` 的 `particles` 陣列模式：帶初始位置與下落速度、每 tick 更新位置、飛出畫面或計時結束後從陣列移除），純視覺效果，不影響分數與判定。
  - **Perfect 判定與 Combo**：新方塊與塔頂現有層的偏移量在 `perfectThreshold` 內時判定為 Perfect——維持原寬度（不縮減、不產生掉落碎片）、`combo +1`、額外加分；只要有一次非 Perfect 的成功疊放（仍有重疊但超出閾值），`combo` 歸零。
  - **Score**：塔的高度（成功疊放層數）為主要分數來源，疊加 Perfect／Combo 額外加分，開放式計分無理論上限（詳見 design.md Decision 5）。
  - **Difficulty Increase**：每次成功疊放後 `blockSpeed` 依 `speedIncrease` 遞增，並以 `maxSpeed` 封頂。
  - **Game Over**：Overlap Detection 判定完全沒有重疊時立即結束遊戲。
  - **Game Loop／Game State**：`ready → playing → paused → gameover` 四態，比照 BREAKOUT／MINESWEEPER 既有慣例；遊戲進行由單一 tick timer 驅動（moving block 位移、掉落碎片物理、難度遞增檢查）。
  - **Restart／Pause**：完整重置塔身／方塊／Combo／分數／速度，不殘留上一局資料；Pause 使用 ESC／P 或畫面按鈕，暫停時停用互動且不計入判定。
  - **Keyboard／Mouse／Touch**：三種輸入方式共用同一個 `dropBlock()` 動作，不做任何拖曳。
  - **Pixel UI**：低美術需求，方塊與塔身皆為純色 CSS 矩形／像素邊框，不使用外部圖片、不使用 Canvas。
  - 掛載共用 `GameRateDialog`／`GameRuleDialog`，主題色採用 `#118ab2`（藍色，與現有十六款遊戲皆不撞色）。
- 新增純邏輯核心 `app/utils/towerStackEngine.ts`（不依賴 Vue），比照 `battleshipEngine.ts` 的 class + `getSnapshot()` 模式，內含 Overlap Detection／Block Resize／Falling Piece 產生／Perfect＋Combo／難度遞增等規則，供頁面以 `getSnapshot()` 同步進 `reactive()` state。
- 新增 server 端服務檔 `server/services/game/retro/tower-stack.ts`，繼承既有 `RETRO_GAME_BASE`，並在 `server/services/storage.ts` 的遊戲初始化區塊新增註冊。
- 新增 server 端 API 路由 `server/api/games/retro/tower-stack/history.{get,post,delete}.ts`，比照既有樣板。
- `app/services/api.ts` 的 `RetroGameKey` 擴充新增 `'towerStack'`，`api.games.retro` 新增對應 3 個函式。
- `app/composables/useGameHistory.ts` 的 `GAME_KEYS` 與 `_handlers.gameApi()` 擴充一個新分支。
- `app/components/GameHistoryDialog.vue` 的篩選 tab／`GAME_KEYS`／遊戲名稱對照擴充一筆。
- `app/config/gameSprites.ts` 新增一筆（icon 🗼，glow `#118ab2`），連帶 `GameMachineCard.vue`／`GameHallSprites.vue` 自動套用。
- `app/pages/game-hall.vue` 新增一筆 `id: 23`、`name: 'TOWER STACK'`、`status: 'open'`、`path: '/game/tower-stack'` 的卡片。

> 本提案為第一階段架構分析與 MVP 規劃，尚未進入實作階段；`design.md` 的 Open Questions 待使用者確認後才會產生對應的實作變更。

## Capabilities

### Modified Capabilities

- `game-history`：既有的遊戲紀錄／coin 轉換能力擴充支援 `towerStack` 這個新的 `gameKey`；`score` 語意為「塔的高度（疊放層數）× 基礎分＋Perfect／Combo 加成」，是本次首度出現「分數會隨連續完美操作而非隨機表現產生額外加成」的計分模型（見 design.md Decision 4／5），`meta` 欄位額外記錄 `maxCombo`／`perfectCount`／`finalWidthRatio` 供統計呈現，不影響 `score` 計算本身。

## Impact

- 新增檔案（client）：`app/pages/game/tower-stack.vue`、`app/utils/towerStackEngine.ts`
- 修改檔案（client）：`app/services/api.ts`、`app/composables/useGameHistory.ts`、`app/components/GameHistoryDialog.vue`、`app/config/gameSprites.ts`、`app/pages/game-hall.vue`
- 新增檔案（server）：`server/services/game/retro/tower-stack.ts`、對應 3 支 API 路由檔
- 修改檔案（server）：`server/services/storage.ts`（遊戲初始化區塊新增 `new RetroTowerStackClass()`）
- 不涉及資料庫，沿用既有 in-memory `Storage.retroGames` 架構
- 首度出現「移動方塊寬度依玩家操作動態縮減」的堆疊玩法與對應的 Overlap Detection／Block Resize 演算法；渲染方式維持全專案「零 Canvas、零 requestAnimationFrame」的既有慣例（DOM/CSS + tick 驅動），詳見 design.md Decision 6 與 Open Questions
- 不影響既有十六款遊戲（snake／racing／tetriminos／match3rush／match3classic／pong／runner／spaceShooter／minesweeper／pacman／spaceInvaders／solitaire／typing／breakout／orbMatch／battleship）的程式碼與行為
