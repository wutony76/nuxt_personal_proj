## Why

遊戲中心目前十五款遊戲涵蓋動作／反應（射擊、跑酷）、消除（match3 系列、orb match）、解謎（minesweeper）、策略規劃（solitaire）等類型，但沒有一款是「隱藏資訊＋座標猜測」的**對戰型棋盤遊戲**。新增 BATTLESHIP（傳統戰艦，Player vs AI）補齊這個空缺：雙方各自在隱藏棋盤上佈署戰艦，輪流猜測座標攻擊，直到一方戰艦全滅。操作方式延續 SOLITAIRE 已驗證過的「全專案零拖曳」慣例（見 `add-solitaire-game` 的 Decision 3），佈局改用「選船→切換方向→點格預覽→確認」的純點擊流程，不做拖曳。

## What Changes

- 新增遊戲頁面 `app/pages/game/battleship.vue`（**BATTLESHIP**）：
  - **10×10 雙棋盤**：己方海域（顯示自己的船／被攻擊結果）＋敵方海域（未攻擊格看不到船，只能看到 HIT/MISS 標記），比照 MINESWEEPER 的 `flatCells` computed 攤平＋`grid-template-columns: repeat(10, var(--cell))` 渲染模式，各自一份 computed。
  - **5 種戰艦，共 17 格**：Carrier(5)／Battleship(4)／Cruiser(3)／Submarine(3)／Destroyer(2)。
  - **PLACEMENT 階段（零拖曳）**：點擊清單選取一艘待放戰艦 → 點擊 `[ROTATE]` 切換 HORIZONTAL/VERTICAL → 滑鼠移到／點按棋盤格即時顯示 preview（合法綠／非法紅，以該格為船頭往右或往下延伸）→ 再次點擊該格確認放置 → 自動選取下一艘未放置的船 → 5 艘放完顯示 `[READY]`。允許戰艦相鄰（不強制留空格），驗證只檢查「不超出棋盤」與「不重疊」。
  - **AI 佈局**：進入 PLACEMENT 時 AI 同步用相同的 `validateShipPlacement()` 隨機佈局（隨機起點＋隨機方向，失敗即重試），全程不顯示給玩家。
  - **BATTLE 回合制**：玩家先手；`PLACEMENT → READY → PLAYER_TURN → PLAYER_ATTACK → PLAYER_RESULT → AI_TURN(500~1000ms delay) → AI_ATTACK → AI_RESULT → PLAYER_TURN …` 循環，直到一方戰艦全滅。
  - **攻擊判定**：`attackCell()` 為玩家與 AI 共用的同一套純函式，回傳 `HIT`／`MISS`／`ALREADY_ATTACKED`／連帶的 `SUNK` 判定；已攻擊過的格子不可再選、不消耗回合。
  - **AI 攻擊策略（本次 MVP）**：僅實作 Random——從敵方棋盤所有未攻擊格中隨機選一格；Hunt & Target（命中後優先攻擊上下左右鄰格＋推測船身方向）列為本次 Non-Goal，留待下一個變更擴充（見 design.md）。
  - **計分**：HIT +33、SUNK +167、WIN +333、MISS +0（取需求既定數值 HIT+100／SUNK+500／WIN+1000 的三分之一，比例不變），集中於 `battleshipEngine.ts` 常數管理；由於命中永遠等於敵艦總格數（17），玩家獲勝時分數恆為固定值 1729（17×33 + 5×167 + 333），效率／手氣改以「Game Statistics」（射擊數／命中率）呈現，不影響分數本身（見 design.md Decision 5）。
  - **HUD**：TURN 指示（PLAYER/AI）、ROUND 數、SHOTS/HITS/MISS/ACCURACY 統計、YOUR SHIPS／ENEMY SHIPS 剩餘艘數。
  - **Restart**：完整重置 Board／Ships／Placement／Attack History／Turn／Score／GameState，不殘留上一局資料。
  - 掛載共用 `GameRateDialog`／`GameRuleDialog`，主題色採全新配色（`#3a86ff` 海軍藍，跟現有十五款遊戲皆不撞色）。
- 新增純邏輯核心 `app/utils/battleshipEngine.ts`（不依賴 Vue），比照 `match3Engine.ts`／`solitaireEngine.ts` 先例，內含 Board／Ship／Placement 驗證／Attack／Turn／AI 隨機邏輯，供頁面以 `getSnapshot()` 同步進 `reactive()` state。
- 新增 server 端服務檔 `server/services/game/retro/battleship.ts`，繼承既有 `RETRO_GAME_BASE`（`maxReasonableScore()` 對齊固定上限 1729，見 design.md Decision 6），並在 `server/services/storage.ts` 的遊戲初始化區塊新增註冊。
- 新增 server 端 API 路由 `server/api/games/retro/battleship/history.{get,post,delete}.ts`，比照既有樣板。
- `app/services/api.ts` 的 `RetroGameKey` 擴充新增 `'battleship'`，`api.games.retro` 新增對應 3 個函式。
- `app/composables/useGameHistory.ts` 的 `GAME_KEYS` 與 `_handlers.gameApi()` 擴充一個新分支。
- `app/components/GameHistoryDialog.vue` 的篩選 tab／`GAME_KEYS`／遊戲名稱對照擴充一筆。
- `app/config/gameSprites.ts` 新增一筆（icon 🚢，glow `#3a86ff`），連帶 `GameMachineCard.vue`／`GameHallSprites.vue` 自動套用。
- `app/pages/game-hall.vue` 新增一筆 `id: 16`、`name: 'BATTLESHIP'`、`status: 'open'`、`path: '/game/battleship'` 的卡片。

## Capabilities

### Modified Capabilities

- `game-history`：既有的遊戲紀錄／coin 轉換能力擴充支援 `battleship` 這個新的 `gameKey`；`score` 語意為「HIT/SUNK/WIN 固定分值加總」，是本次唯一「勝利分數恆為單一固定值（1729）」的計分模型（不像其他遊戲即使獲勝分數仍有變動區間），`meta` 欄位可額外記錄 `shots`／`accuracy`／`rounds` 供統計呈現，但不影響 `score` 計算本身。

## Impact

- 新增檔案（client）：`app/pages/game/battleship.vue`、`app/utils/battleshipEngine.ts`
- 修改檔案（client）：`app/services/api.ts`、`app/composables/useGameHistory.ts`、`app/components/GameHistoryDialog.vue`、`app/config/gameSprites.ts`、`app/pages/game-hall.vue`
- 新增檔案（server）：`server/services/game/retro/battleship.ts`、對應 3 支 API 路由檔
- 修改檔案（server）：`server/services/storage.ts`（遊戲初始化區塊新增 `new RetroBattleshipClass()`）
- 不涉及資料庫，沿用既有 in-memory `Storage.retroGames` 架構
- 首度出現「雙棋盤＋隱藏資訊＋雙方輪流攻擊」的回合制對戰玩法；操作方式維持全專案「零拖曳」的既有慣例（延續 SOLITAIRE 先例，不像 SOLITAIRE 那樣需要先規劃拖曳再拿掉，本次從一開始就定案零拖曳）
- 本次僅實作 Random AI；Hunt & Target 智慧 AI、命中/沉船動畫特效、音效、特殊武器（雷達／空襲／魚雷）等列為 Non-Goal，留待後續變更
- 不影響既有十五款遊戲（snake／racing／tetriminos／match3rush／match3classic／pong／runner／spaceShooter／minesweeper／pacman／spaceInvaders／solitaire／typing／breakout／orbMatch）的程式碼與行為
