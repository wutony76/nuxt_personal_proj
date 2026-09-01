## Context

- **1. 現有架構（Game Center／Game Loop／Input）**：`add-game-history` 已建立 game-hall 小遊戲的完整架構：client 頁面自包含（engine class + reactive 鏡像 snapshot）＋ `useGameHistory`（未登入 localStorage／已登入呼叫 server API 雙模式）＋ server 端 `RETRO_GAME_BASE`（共用基底＋每款遊戲一個服務檔＋每款遊戲一組 API 路由資料夾）。全專案沒有集中式 Game Loop／Input composable，16 款遊戲各自在 `<script setup>` 內用 `setInterval`/`setTimeout` 驅動 tick、`onMounted`/`onUnmounted` 綁定與解綁 `window.addEventListener('keydown'/'keyup', ...)`；全專案零 `<canvas>`、零 `requestAnimationFrame`，一律用 CSS Grid/DOM + `v-for` 做「瞬間重繪」渲染。FROGGER 沿用這個既有模式，不引入新的渲染技術或共用 composable。
- **2. 可重用模組（Game Center 既有基礎設施）**：Grid 渲染比照 MINESWEEPER 的 `flatCells` computed 攤平＋`grid-template-columns: repeat(N, var(--cell))` 模式；規則核心抽出獨立引擎檔比照 `battleshipEngine.ts`／`solitaireEngine.ts`（class + `getSnapshot()`）；Life 系統比照 `typing.vue`／`pac-man.vue` 的 `lives -= 1` 歸零判定模式；Level／難度遞增比照 `runner.vue`（依分數分段調整難度）或 `breakout.vue`（每清光一關 `level += 1` 並提高密度/速度上限）兩種既有模式；Touch 輸入比照 `pac-man.vue` 的 `pm-keypad` on-screen 四方向按鈕先例，鍵盤與觸控共用同一支 `click.dir(direction)`；Score/LocalStorage/API 儲存沿用 `useGameHistory.ts`／`server/services/game/retro/base.ts` 既有管線，登記點涵蓋 `app/services/api.ts`、`GameHistoryDialog.vue`、`gameSprites.ts`、`game-hall.vue`，皆比照既有 16 款遊戲擴充，不新增登記點。
- **3. Grid／座標系統**：採用 `(row, col)` 整數座標，`row` 由下到上編號（`row = ROWS - 1` 為起點、`row = 0` 為終點），符合「玩家從起點往終點前進」的直覺方向。詳細資料結構見 Decision 1。
- **4. 建議檔案結構**：
  ```
  app/utils/froggerEngine.ts        # 純邏輯核心，不依賴 Vue（Grid/Lane/Vehicle/Platform/Player/Collision/Level/Score）
  app/pages/game/frogger.vue         # 頁面：reactive state 鏡像 + Grid 渲染 + 輸入 + HUD + Dialog 掛載
  server/services/game/retro/frogger.ts   # 繼承 RETRO_GAME_BASE
  server/api/games/retro/frogger/history.get.ts
  server/api/games/retro/frogger/history.post.ts
  server/api/games/retro/frogger/history.delete.ts
  ```
  其餘為既有檔案的擴充點（`app/services/api.ts`、`useGameHistory.ts`、`GameHistoryDialog.vue`、`gameSprites.ts`、`game-hall.vue`、`server/services/storage.ts`），比照既有 16 款遊戲的登記方式，不新增獨立檔案。
- **5. Vehicle Architecture（NPC 連續 tick）**：5 條 ROAD 車道各自透過 `LANE_CONFIGS` 集中定義方向／速度／車輛長度／間距；所有車道由單一 `setInterval(TICK_MS)` game loop 統一驅動（不為每條車道各開一個 interval），每個 tick 對每輛車的浮點座標 `+= direction * speed`，超出邊界時 wrap-around 循環回到另一側，詳見 Decision 3。
- **6. River/Platform Architecture**：5 條 RIVER 車道的浮木資料結構與車輛相同（皆為「lane 上的線性移動實體」），差異在於玩家「站上去」而非「被撞」；玩家站在浮木上時會隨浮木一起水平漂移，欄位若失去浮木覆蓋即落水，詳見 Decision 4。
- **7. Collision Architecture**：一律以整數格判定（ROAD 撞車／RIVER 落水／GOAL 蓮花座命中），不做像素級 AABB；判定邏輯抽成單一共用函式，供「玩家離散移動後」與「NPC 連續 tick 後」兩種觸發時機共用，避免規則寫兩份，詳見 Decision 5。
- **8. Level Architecture**：`level` 只在「一輪完成（5 個蓮花座全部佔用）」時遞增，比照 `breakout.vue` 的「按輪次遞增」模式而非 `runner.vue` 的「按分數分段」模式，因為 FROGGER 的「一輪」有明確終局事件（填滿終點），不是連續分數區間；`level` 提升時重新計算所有車道的速度與間距並重建車道實體，詳見 Decision 6。
- **Score／Life**：Score／Life 常數與其餘 Level 常數比照 Decision 6 集中管理於 `froggerEngine.ts` 頂部，Life 判定沿用既有 `lives -= 1` 歸零模式（見上方第 2 點）。
- **Scrolling**：FROGGER 的 13×11 Grid 一屏完整顯示，**不需要垂直捲動視窗**（不像 `runner.vue` 用水平捲動的跑者背景模擬前進感）；本遊戲唯一的「移動」是車道/河道實體在固定視窗內的水平位移，與攝影機/世界捲動無關，不需要額外的 scroll-camera 邏輯。
- **MVP 順序**：Grid（Context 3/4）→ Player（離散移動骨架）→ Road／Vehicle／Vehicle Movement（NPC tick 骨架，先驗證與 Player 移動的互不干擾）→ Collision（撞車判定，讓 Road 有意義）→ River／Moving Platform（在 Collision 骨架上擴充落水/平台跟隨）→ Goal（終點判定，讓一輪有終局）→ Life（扣命與重生）→ Score（HOP/GOAL 計分）→ Level／Difficulty Increase（完成一輪後的難度遞增）→ Game Over／Restart（結束與重置）→ Pause → Keyboard／Touch（輸入層最後收尾，兩者共用同一支函式）。此順序讓每一步都能在前一步的基礎上獨立驗證，避免一次串起整條規則鏈才能測試。

## Goals / Non-Goals

**Goals:**
- 提供固定視角的 13×11 Grid 地圖：1 條 HOME、5 條 ROAD、1 條 MEDIAN、5 條 RIVER、1 條 GOAL（含 5 個蓮花座）。
- 玩家以方向鍵/觸控離散跳格移動，NPC（車輛／浮木）以集中 game loop 連續 tick 平移，兩者並存且互不干擾。
- 撞車或落水扣 1 命，命數歸零 Game Over；填滿全部終點蓮花座視為完成一輪，難度隨輪次遞增。
- Game Logic（Grid／Lane／Vehicle／Platform／Player／Collision／Level／Score）完全不依賴 DOM，抽到 `app/utils/froggerEngine.ts`；Server 端、client 資料層、game-hall 入口比照既有 16 款遊戲的慣例逐一擴充。
- 全部使用原創像素蛙角色與原創車輛/浮木圖形，不取用 Frogger 官方美術／Logo／受版權保護內容。

**Non-Goals:**
- 不做 Timer 倒數計分或 Timer 影響勝負（本次 Score 只由 HOP/GOAL/LEVEL CLEAR 構成）。
- 不做多人連線／排行賽／同屏雙玩家。
- 不做動態關卡編輯器或多種地圖版面，本次僅一種固定 13×11 版面。
- 不做車輛/浮木以外的額外障礙物（如鱷魚、蛇、獎勵道具），列為後續變更的擴充方向。
- 不做像素級 AABB 碰撞或次像素動畫過場，維持全專案「瞬間重繪」的既有渲染哲學。
- 不引入資料庫；server 端持久化沿用專案現況的 in-memory 作法。

## Decisions

1. **Grid／座標系統採 `(row, col)` 整數座標，`row` 由下到上編號，Lane 資料與地形資料分層**
   - 理由：需求要求「玩家從起點前進、穿越多條道路、穿越河流、到達終點」，方向感明確（起點在下、終點在上），比照畫面直覺由下到上編號比由上到下更符合視覺直觀，也與大多數 Frogger 類遊戲的座標慣例一致。
   - 做法：`GRID_COLS = 11`、`GRID_ROWS = 13`；`row 12` = HOME（起點，玩家初始 `{ row: 12, col: 5 }`）、`row 7~11` = 5 條 ROAD、`row 6` = MEDIAN（安全中線，無 NPC）、`row 1~5` = 5 條 RIVER、`row 0` = GOAL（終點列，含固定欄位 `GOAL_SLOT_COLS = [0, 2, 5, 8, 10]` 的 5 個蓮花座）。靜態地形（每列的 `LaneType: 'HOME' | 'ROAD' | 'MEDIAN' | 'RIVER' | 'GOAL'`）與動態實體（車輛/浮木的即時位置）分層儲存：`LANE_CONFIGS: LaneConfig[]`（10 條動態車道的方向/速度/長度/間距設定，索引對應 `row`）＋執行期的 `LaneEntity[]`（每條車道目前的實體清單，含浮點座標）。Grid 渲染沿用 MINESWEEPER 的 `flatCells` computed 攤平模式：每個 tick 重新計算「地形 + NPC 佔用格 + 玩家位置」三層疊加後的顯示狀態，供 `v-for` 一次性重繪。
   - 替代方案：由上到下編號（`row 0` = 起點）——放棄，數值上「row 越大代表離終點越近」不直覺，容易在計算「本命最遠進度」（HOP 計分）時搞混方向。

2. **玩家離散跳格移動 ＋ NPC 連續 tick 移動並存：兩條獨立驅動路徑，共用同一份 state**
   - 理由：這是全專案第一款「玩家離散跳格移動 ＋ NPC 連續 tick 移動」混合的遊戲。現有遊戲要嘛整頁都是離散點擊驅動（MINESWEEPER／SOLITAIRE／BATTLESHIP，沒有 tick），要嘛整頁都是連續 tick 驅動（SNAKE／BREAKOUT／RUNNER，用 `setInterval` 每格移動且無需等待玩家輸入）；FROGGER 需要「車輛/浮木用 `setInterval` 連續平移」＋「玩家只在按鍵/觸控時才離散跳一格、平時完全靜止」兩者並存，沒有既有先例可以直接照抄。
   - 做法：兩條獨立的驅動路徑寫入同一份 `FroggerEngine` 內部 state：
     - **NPC 路徑**：單一 `setInterval(tickLoop, TICK_MS)`（`TICK_MS` 集中設定，約 50ms／20fps）驅動，`engine.tick(dtMs)` 對所有 10 條動態車道的實體浮點座標依各自方向/速度累加，並在每個 tick 結束後呼叫共用的 `resolveHazard()`（見 Decision 5）檢查玩家是否因為「車輛/浮木移動到玩家所在格」而觸發撞車/落水/隨平台漂移。
     - **Player 路徑**：`window.addEventListener('keydown', ...)` 與觸控按鈕的 `click.dir(direction)` 呼叫同一支 `engine.move(direction)`，只在收到明確的方向輸入時才把玩家座標整數 `+1`/`-1`，並在移動完成後立即呼叫同一支 `resolveHazard()`（供玩家「主動跳進」車輛佔用格或非蓮花座水域的情境使用）；沒有輸入時玩家完全靜止，不會有任何自動位移。
     - 兩條路徑互不阻塞：NPC tick 不需要等待玩家輸入，玩家輸入也不需要等待 NPC tick，只在各自完成後呼叫同一份 `resolveHazard()` 保證判定邏輯只有一份。
   - 替代方案：把玩家移動也塞進同一個 `setInterval` tick（比照 SNAKE 的「持有方向、每個 tick 自動前進一格」）——放棄，需求明確是「玩家離散跳格、無自動前進」，塞進固定 tick 會讓玩家的反應時間被 tick 週期綁死，操作手感會變成「持續移動」而非「精準跳格」，不符合 Frogger 類遊戲的核心手感。

3. **車道方向/速度資料結構：`LANE_CONFIGS` 集中設定，實體位置採浮點座標＋wrap-around 循環**
   - 理由：需求明確要求「所有速度、車輛數量、河流速度集中設定」；車輛/浮木需要「連續平移」的視覺效果，若用整數格逐格跳動會失去平移感，但全專案又是「瞬間重繪」渲染（無漸層動畫），因此改用「浮點座標驅動位置、整數格驅動碰撞」的折衷做法——每個 tick 用浮點數累加位置（讓速度可以是任意精度，比如「每秒 1.5 格」），渲染與碰撞判定時再對浮點座標取整數。
   - 做法：`LANE_CONFIGS: LaneConfig[]`，每筆 `{ row, type: 'ROAD' | 'RIVER', direction: 1 | -1, baseSpeed: number /* 格/秒 */, entityLength: number, gap: number }`；`generateLaneEntities(config, level)` 依 `entityLength + gap` 的週期在該車道均勻分佈初始實體；`advanceLane(entities, config, level, dtMs)` 對每個實體 `floatCol += direction * getLaneSpeedForLevel(config, level) * (dtMs / 1000)`，並用 `((floatCol % cycleLength) + cycleLength) % cycleLength` 讓超出畫面邊界的實體直接從另一側「循環」出現，不需要額外的 spawn/despawn 生命週期管理。`getOccupiedCols(entity)` 依 `entityLength` 回傳該實體目前佔用的整數欄位集合，供 Decision 5 的碰撞判定使用。
   - 替代方案：車輛在超出畫面後銷毀、於車道起點重新 spawn——放棄，需要額外處理「新 spawn 的車輛是否會立刻和其他車輛重疊」的邊界情況，wrap-around 循環座標更簡單且視覺效果等價（車流本來就是無限循環）。

4. **河流平台跟隨判定：玩家站在浮木上時，座標隨浮木漂移；欄位失去浮木覆蓋即落水**
   - 理由：需求明確要求「穿越河流時站在漂浮平台上」，玩家不能只是「暫時安全」，還必須「跟著平台一起移動」，否則會出現「站在平台上卻不會被沖走」的不合理手感；這是本次除了 Decision 2 之外，第二個沒有既有先例可直接套用的機制。
   - 做法：玩家 state 增加 `raftCol`（浮點欄位，僅在玩家位於 RIVER 列時才有意義）。每個 NPC tick 執行 `advanceLane()` 後，若玩家目前 `row` 是 RIVER 列，`resolveHazard()` 會先找出玩家「移動前」所在整數欄位對應的浮木實體：
     - 若找不到（該欄位已無浮木覆蓋）→ 判定落水，扣 1 命、重置玩家回起點。
     - 若找到→ 讓玩家的 `raftCol += direction * speed * dt`（與該浮木同步位移），並把玩家顯示/邏輯欄位 `col = Math.round(raftCol)`；若 `round` 後的欄位超出 `[0, GRID_COLS - 1]` 範圍（被沖出畫面外）→ 同樣判定落水。
     - 玩家按下方向鍵離散移動時，先把 `raftCol` 重置為移動後的整數欄位（`raftCol = newCol`），避免浮點誤差跨多個 tick 累積導致漂移量與視覺不同步。
   - 替代方案：玩家站上浮木後只做「安全」判定，不隨浮木位移——放棄，不符合需求「穿越河流時站在漂浮平台上」的漂流手感，也會讓浮木的方向/速度設定變得沒有意義（玩家永遠站在原地不會被沖走或幫忙推進）。

5. **碰撞判定範圍：一律以整數格為準，單一共用函式 `resolveHazard()` 供玩家移動與 NPC tick 兩種觸發時機共用**
   - 理由：碰撞來源有兩種時機——「玩家主動跳進危險格」（如跳進車輛所在格）與「NPC 移動到玩家所在格」（如車輛開過來撞上靜止的玩家）；若分開寫兩份判定邏輯，容易出現「同一條撞車規則兩處實作不一致」的 bug（例如 Decision 4 的落水判定同時要處理「玩家跳進無浮木水域」與「浮木漂走後玩家腳下淨空」兩種觸發來源）。
   - 做法：`resolveHazard(state): HazardResult | null` 為唯一的碰撞/落水/漂移判定入口，內部依 `state.player.row` 對應的 `LaneType` 分流：`ROAD` → 檢查 `getOccupiedCols()` 是否包含玩家 `col`，是則 `COLLISION`；`RIVER` → 依 Decision 4 判定 `SAFE_DRIFT`／`FALL_IN_WATER`；`GOAL` → 依 Decision 6 判定 `GOAL_FILLED`／`FALL_IN_WATER`；`HOME`／`MEDIAN` → 一律安全，回傳 `null`。玩家離散移動（`engine.move()`）與 NPC tick（`engine.tick()`）在各自流程結束時都呼叫這同一支函式，不判定範圍不擴大到像素級 AABB，全部以整數格為準，維持與其他 15 款遊戲一致的「瞬間重繪、非連續物理」渲染哲學。
   - 替代方案：像素級 AABB（比較玩家與車輛的實際渲染寬高是否重疊）——放棄，全專案沒有任何一款遊戲做過像素級碰撞，會需要額外處理 CSS transform 的即時測量，複雜度與收益不成比例。

6. **Life／Level／Score 常數集中管理於 `froggerEngine.ts`；Level 只在一輪完成時遞增，重建車道實體**
   - 理由：需求明確要求「所有速度、車輛數量、河流速度、Life、Score 集中設定」；`level` 的遞增時機需要對齊「每輪難度增加」的需求敘述，FROGGER 的「一輪」有明確終局事件（5 個蓮花座全部佔用），比照 `breakout.vue`「每清光一關 `level += 1`」的模式，而非 `runner.vue`「依分數分段」的模式，因為分數是連續累加值、不適合作為「一輪是否結束」的判斷依據。
   - 做法：檔案頂部集中常數：`LIVES_START = 3`（比照 `typing.vue`／`pac-man.vue`）、`HOP_SCORE = 10`、`GOAL_SCORE = 200`、`LEVEL_CLEAR_BONUS = 500`、`TICK_MS = 50`、`SPEED_GROWTH_PER_LEVEL`／`GAP_SHRINK_PER_LEVEL`／`MIN_GAP`（難度遞增的每級增量與下限）。`getLaneSpeedForLevel(config, level) = config.baseSpeed * (1 + (level - 1) * SPEED_GROWTH_PER_LEVEL)`、`getLaneGapForLevel(config, level) = Math.max(MIN_GAP, config.gap - (level - 1) * GAP_SHRINK_PER_LEVEL)`，皆比照 `runner.vue`／`breakout.vue` 既有的 `Math.max`/`Math.min` 夾限寫法避免難度無限失控。當 `resolveHazard()` 判定 `GOAL_FILLED` 且 5 個蓮花座全部佔用時：`level += 1`、依新 `level` 重新呼叫 `generateLaneEntities()` 重建全部 10 條車道的實體、5 個蓮花座重置為空、`+LEVEL_CLEAR_BONUS`；玩家扣命重生（撞車/落水）不影響 `level`／`score`／已佔用的蓮花座，只重置玩家位置。
   - 替代方案：比照 `runner.vue` 依 `score` 分段設定難度——放棄，FROGGER 的分數在同一輪內會因為多次來回移動而持續變化，用分數分段會讓「難度」在同一輪內也可能跳變，不如「輪次」這個離散且對玩家明確可感知的事件穩定。

## Risks / Trade-offs

- [風險] 「玩家離散跳格 ＋ NPC 連續 tick」雙路徑並存（Decision 2），若玩家在 NPC tick 執行到一半時剛好觸發 `move()`，可能出現同一影格內兩份 `resolveHazard()` 呼叫的執行順序競態（例如玩家跳進一格的同時車輛也移動經過同一格）——因應：`resolveHazard()` 是純函式、每次呼叫都以「呼叫當下的完整 state」為準獨立判定，不維護跨呼叫的暫存狀態，兩次呼叫皆合法且結果符合當下畫面，不會產生「判定遺漏」，只是先後順序可能造成極端情況下「差一格」的觀感落差，可接受。
- [風險] 河流平台跟隨（Decision 4）的 `raftCol` 若在玩家離開河道列後沒有正確歸零，可能殘留影響下一次進入河道列的判定——因應：`engine.move()` 每次離散移動都會把 `raftCol` 重置為當前整數欄位，只有玩家「停留在同一個 RIVER 列」時 `raftCol` 才會被 tick 累加，離開該列即被下一次 `move()` 覆蓋，不會跨列殘留。
- [風險] 車道 wrap-around 循環座標（Decision 3）搭配 Level 提升時重建全部車道實體（Decision 6），若重建時機與 NPC tick 剛好重疊，理論上可能讀到重建中途的半套資料——因應：`generateLaneEntities()` 與 `resolveHazard()`／`tick()` 皆在同一個 JS 事件循環（單執行緒、非 async）內同步執行，不存在真正的並行寫入，重建為單次同步賦值（整個 `LaneEntity[]` 陣列一次替換），不會讀到半套資料。
- [風險] 終點列（GOAL）「跳進非蓮花座欄位視為落水」的規則對新手不直覺（乍看終點列應該全部安全）——因應：這是需求「到達終點區域後完成一輪」搭配經典 Frogger 玩法的既定設計（蓮花座是唯一安全落點），HUD 會明確標示 5 個蓮花座位置，且 `[RULE]` Dialog（`GameRuleDialog`）會說明此規則，不算隱藏規則。
- [風險] Restart／Pause 若沒有正確清除舊的 `setInterval`，可能殘留多條 NPC tick 迴圈同時運作，導致速度變快或重複扣命——因應：比照既有遊戲慣例，`onUnmounted`／Restart 前一律先 `clearInterval()` 再重新建立，並在 tick callback 內检查 `state.status === 'PLAYING'` 才執行邏輯（Pause 時直接讓 tick 提前 return，不需要真的清除/重建 interval），避免殘留計時器誤觸發。

## Migration Plan

- 全新功能，無既有資料需要遷移，且刻意設計成獨立的 `gameKey`，不影響既有 16 款遊戲的紀錄與 coin 上限。
- 部署順序（每一步都可獨立回滾，比照既有幾次擴充的分步策略）：
  1. Server 端服務層與 `storage.ts` 註冊（尚未被路由引用，無風險）
  2. Server 端 API 路由（存在但尚未被前端呼叫，無風險）
  3. Client `app/services/api.ts` 擴充
  4. `useGameHistory.ts` 擴充
  5. `app/utils/froggerEngine.ts` 純邏輯核心（尚未被頁面引用，可獨立單元測試，尤其是 Decision 2/3/4/5 的混合驅動與碰撞邏輯應優先補測試）
  6. 遊戲頁面 `app/pages/game/frogger.vue`（此步驟起才有實際資料寫入行為）
  7. `game-hall.vue` + `GameMachineCard.vue`（透過 `gameSprites.ts`）+ `GameHistoryDialog.vue`（此步驟起使用者才看得到入口，是唯一改變可見行為的步驟）

## Open Questions

- Level 提升是否需要上限（例如 level 10 之後速度不再繼續增加）？本次先讓 `getLaneSpeedForLevel()`／`getLaneGapForLevel()` 用 `Math.max`/`Math.min` 夾限但不設 level 總數上限，留待實測後決定是否要加「無盡模式封頂」。
- 是否要在後續變更加入 Timer 效率加成分數（例如更快完成一輪給額外分數）？本次 Score 只由 HOP/GOAL/LEVEL CLEAR 構成，Non-Goals 已明確排除，留待使用者回饋後評估。
- 是否要加入車輛/浮木以外的額外障礙（鱷魚、蛇、獎勵道具）？本次 Non-Goals 已排除，留待下一個變更視需求評估。
- `coinRate`／`coinCapPerRun`／`maxReasonableScore()` 目前依「一場優秀表現（清完 2~3 輪）約 100 coin」估算（見 tasks.md 常數），屬於程式碼估算值，上線後應依實測分數分佈校準。
