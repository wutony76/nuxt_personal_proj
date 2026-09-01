## Why

遊戲中心目前 16 款遊戲涵蓋動作反應（射擊、跑酷）、消除（match3 系列、orb match）、解謎（minesweeper）、策略規劃（solitaire）、對戰猜測（battleship）等類型，但沒有一款是「固定地圖、多車道連續移動障礙物、玩家逐格閃避前進」的傳統 Arcade 閃避遊戲。新增 FROGGER（原創像素蛙角色穿越道路與河流）補齊這個空缺：玩家從起點逐格跳向終點，途中穿越車道閃避車輛、穿越河道踩踏浮木渡河，是全專案第一款需要「玩家離散跳格移動」與「NPC 連續 tick 平移」兩種驅動機制並存的遊戲（見 design.md Decision 2），需要在實作前先把架構定案。本次僅產出 OpenSpec 提案文件（README／proposal／design／tasks／specs），尚未寫任何程式碼，供確認 MVP 範圍與架構設計後再進入實作。

不複製 Frogger 原版的角色、Logo、素材或任何受版權保護內容，全部採用原創像素蛙與原創車輛/浮木圖形（純 CSS/DOM 色塊＋emoji，不使用外部圖片）。

## What Changes

- 新增遊戲頁面 `app/pages/game/frogger.vue`（**FROGGER**）：
  - **Grid**：13 列 × 11 欄固定視角地圖（無捲動視窗，一屏顯示全部列），由下到上依序為：第 12 列 HOME（起點安全區）、第 7～11 列共 5 條 ROAD（車道）、第 6 列 MEDIAN（安全中線）、第 1～5 列共 5 條 RIVER（河道）、第 0 列 GOAL（終點列，含 5 個固定欄位的蓮花座）。比照 MINESWEEPER 的 `flatCells` computed 攤平＋`grid-template-columns: repeat(11, var(--cell))` 渲染模式。
  - **Player**：原創像素蛙角色，僅在玩家按下方向鍵（上/下/左/右）時離散跳動一格，不會自動前進、無連續位移動畫，比照現有遊戲「瞬間重繪」的既有渲染哲學。
  - **Road／Vehicle／Vehicle Movement**：5 條車道各自有獨立的方向（往左／往右）與速度，車輛以浮點座標透過集中的 `setInterval` game loop 連續平移，超出畫面邊界時 wrap-around 循環出現在另一側，不需要動態 spawn/despawn。
  - **River／Moving Platform**：5 條河道各自有獨立的方向與速度的浮木平台，玩家站上浮木後會隨浮木一起水平漂移（見 design.md Decision 4「平台跟隨判定」），若玩家所在欄位失去平台覆蓋（浮木已漂走）即視為落水。
  - **Collision**：車道上玩家所在格與任一車輛佔用格重疊 → 撞車；河道上玩家所在格不在任一浮木佔用格內 → 落水；一律以整數格判定，不做像素級 AABB（見 design.md Decision 5）。
  - **Goal**：終點列有 5 個固定欄位的蓮花座，玩家精準跳進未被佔用的蓮花座視為完成一格終點（記錄該座已佔用、玩家重置回起點繼續下一趟）；跳進終點列上非蓮花座的欄位視為落水（比照經典 Frogger 規則）；5 個蓮花座全部佔用即完成一輪。
  - **Life**：初始 3 條命（比照 `typing.vue`／`pac-man.vue` 的 `lives -= 1` 判定模式），撞車或落水扣 1 命並重置玩家回起點，命數歸零進入 Game Over。
  - **Score**：每次跳格推進超過本命最遠進度 +10（HOP，防止原地來回洗分）、成功佔用一個蓮花座 +200（GOAL）、5 個蓮花座全部佔用（完成一輪）額外 +500（LEVEL CLEAR），分數在命數歸零前持續累計，不因落水/撞車重置。
  - **Level／Difficulty Increase**：每完成一輪（5 個蓮花座全部佔用），`level += 1`，所有車道/河道的速度依 `getLaneSpeedForLevel()` 提升、車輛/浮木間距依 `getLaneGapForLevel()` 縮小（比照 `breakout.vue` 每清光一關 `level += 1` 並提高密度/速度上限的模式，而非 `runner.vue` 依分數分段的模式，因為 FROGGER 的「一輪」定義明確是「填滿全部終點欄位」而非連續分數區間）。
  - **Game Over／Restart**：命數歸零顯示 `GAME OVER` overlay 並寫入一筆遊戲紀錄；`[RESTART]` 完整重置 Grid／車道實體／河道實體／玩家位置／終點佔用狀態／Life／Score／Level，不殘留上一局資料。
  - **Pause**：ESC／P 觸發 `PAUSED` overlay，暫停期間車道/河道 tick 與玩家輸入皆停用，不計入任何進度。
  - **Keyboard／Touch**：方向鍵/WASD 綁定同一組 `click.dir(direction)` 處理函式；行動裝置比照 `pac-man.vue` 的 `pm-keypad` on-screen 四方向按鈕先例，呼叫同一支函式，鍵盤與觸控共用同一套移動邏輯，不重複寫兩份。
  - 掛載共用 `GameRateDialog`／`GameRuleDialog`，主題色採全新配色 `#52b788`（森林綠，不與現有 16 款遊戲撞色）。
- 新增純邏輯核心 `app/utils/froggerEngine.ts`（不依賴 Vue），比照 `battleshipEngine.ts`／`solitaireEngine.ts` 先例，內含 Grid／Lane／Vehicle／Platform／Player 移動／碰撞／Goal／Level／Score 邏輯，供頁面以 `getSnapshot()` 同步進 `reactive()` state。
- 新增 server 端服務檔 `server/services/game/retro/frogger.ts`，繼承既有 `RETRO_GAME_BASE`（`coinRate`／`coinCapPerRun`／`coinDailyCap`／`maxReasonableScore()`，見 design.md Decision 6），並在 `server/services/storage.ts` 的遊戲初始化區塊新增註冊。
- 新增 server 端 API 路由 `server/api/games/retro/frogger/history.{get,post,delete}.ts`，比照既有樣板。
- `app/services/api.ts` 的 `RetroGameKey` 擴充新增 `'frogger'`，`api.games.retro` 新增對應 3 個函式。
- `app/composables/useGameHistory.ts` 的 `GAME_KEYS` 與 `_handlers.gameApi()` 擴充一個新分支。
- `app/components/GameHistoryDialog.vue` 的篩選 tab／`GAME_KEYS`／遊戲名稱對照擴充一筆。
- `app/config/gameSprites.ts` 新增一筆（icon 🐸，glow `#52b788`），連帶 `GameMachineCard.vue`／`GameHallSprites.vue` 自動套用。
- `app/pages/game-hall.vue` 新增一筆 `id: 19`、`name: 'FROGGER'`、`status: 'open'`、`path: '/game/frogger'` 的卡片。

## Capabilities

### Modified Capabilities

- `game-history`：既有的遊戲紀錄／coin 轉換能力擴充支援 `frogger` 這個新的 `gameKey`；`score` 語意為「HOP + GOAL + LEVEL CLEAR 累加，命數歸零前持續累計」，是本次唯一「單一命可橫跨多輪、分數不因單次落水/撞車重置」的計分模型；`meta` 欄位可額外記錄 `roundsCleared`／`goalsFilled` 供統計呈現，但不影響 `score` 計算本身。

## Impact

- 新增檔案（client）：`app/pages/game/frogger.vue`、`app/utils/froggerEngine.ts`
- 修改檔案（client）：`app/services/api.ts`、`app/composables/useGameHistory.ts`、`app/components/GameHistoryDialog.vue`、`app/config/gameSprites.ts`、`app/pages/game-hall.vue`
- 新增檔案（server）：`server/services/game/retro/frogger.ts`、對應 3 支 API 路由檔
- 修改檔案（server）：`server/services/storage.ts`（遊戲初始化區塊新增 `new RetroFroggerClass()`）
- 不涉及資料庫，沿用既有 in-memory `Storage.retroGames` 架構
- 首度出現「玩家離散跳格移動 ＋ NPC（車輛/浮木）連續 tick 移動」並存的混合驅動架構，需要在 design.md 明確記錄（見 Decision 2），其餘 Grid 渲染／Life／Level／Score/Restart／Pause／Keyboard／Touch 皆可沿用既有先例
- 不做 Timer 計分、不做多人連線、不做動態關卡編輯器、不做除原創像素蛙以外的可選角色
- 不影響既有 16 款遊戲（snake／racing／tetriminos／match3rush／match3classic／pong／runner／spaceShooter／minesweeper／pacman／spaceInvaders／solitaire／typing／breakout／orbMatch／battleship）的程式碼與行為
