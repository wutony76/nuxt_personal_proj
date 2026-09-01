## Context

依需求要求逐項檢查現有架構後的分析與輸出：

**1. Game Center（`app/pages/game-hall.vue`）— 現有架構**
`gameSlots` 為固定陣列，每筆 `{ id, name, description, status, path }`；目前最後一筆為 `id: 16`（BATTLESHIP）。卡片圖示與發光色由 `app/config/gameSprites.ts` 依 `name` 關鍵字比對決定，與 `gameSlots` 本身解耦。CONNECT 4 登記為 `id: 20`、`path: '/game/connect4'`，直接沿用既有陣列擴充模式，不需調整 `GameMachineCard.vue`／`GameHallSprites.vue`。

**2. Grid（棋盤渲染）— 現有架構／可重用模組**
MINESWEEPER 已建立標準模式：二維陣列 `board[row][col]` 存純資料，頁面用 `flatCells` computed 攤平成一維陣列＋`v-for` 搭配 `grid-template-columns: repeat(N, var(--cell))` 渲染，點擊事件回推 `row/col`。CONNECT 4 的 7×6 棋盤直接沿用此模式，唯一差異是「點擊落點」不是任意格，而是整欄（點擊該欄任一格或欄頂按鈕皆等同選擇該欄），實際落子格由 Gravity 邏輯計算。

**3. Turn System（回合制對戰）— 現有架構／可重用模組**
全專案唯一先例是 BATTLESHIP：`PLACEMENT → READY → PLAYER_TURN → PLAYER_ATTACK → PLAYER_RESULT → AI_TURN(500~1000ms delay) → AI_ATTACK → AI_RESULT → PLAYER_TURN …` 九態，AI 回合以 `setTimeout` 延遲避免瞬間完成。CONNECT 4 直接沿用這個「非同步延遲驅動的狀態轉換」精神，但拿掉 `PLACEMENT`／`READY`（CONNECT 4 沒有佈局階段，開局即可直接對戰），狀態機簡化為七態（見 Decision 6）。

**4. Input（輸入）— 現有架構**
全專案沒有集中式 Input composable，多數遊戲各自在頁面內綁定 `@keydown`／`@click`。棋盤策略型遊戲（MINESWEEPER／SOLITAIRE／BATTLESHIP）皆為「非 tick-driven，只在點擊事件發生時同步處理」，沒有 `requestAnimationFrame` 迴圈。CONNECT 4 屬於同一類（回合制、無連續動畫需求），沿用「點擊事件觸發 → 同步處理 → 更新 reactive state」的既有模式，不需要新建 Input 抽象層。

**5. AI — 現有架構／本次需要新建的部分**
BATTLESHIP 是唯一的 Player vs AI 先例，其「AI 用 setTimeout 延遲執行」與「玩家與 AI 共用同一套判定純函式（`attackCell()`）」兩個先例可直接沿用於 CONNECT 4。但 BATTLESHIP 的 AI（MVP 僅 Random 攻擊）沒有「評估某步是否直接獲勝／需要阻擋」的決策邏輯，這部分 CONNECT 4 需要新建：`chooseAiColumn()` 依「優先獲勝→優先擋→隨機合法欄」的順序決策，並重用同一支 `checkWinFromMove()` 做「試下判斷」（見 Decision 3）。

**6. Game State（遊戲狀態）— 現有架構**
既有遊戲皆採單一 `reactive()` 物件管理狀態（比照 `openspec/project.md` 規範），複雜規則核心抽到 `app/utils/xxxEngine.ts`（class + `getSnapshot()` 模式，例：`battleshipEngine.ts`）。CONNECT 4 抽成 `app/utils/connect4Engine.ts`，頁面用 `reactive()` 鏡像 `getSnapshot()` 回傳的快照，維持「Logic / Rendering 分離」。

**7. Animation（動畫）— 現有架構**
多數有連續動畫需求的遊戲（PONG／BREAKOUT／SPACE INVADERS）用 `setInterval`/`requestAnimationFrame` 驅動 tick；棋盤策略型遊戲則完全沒有連續動畫，狀態變化即時反映。CONNECT 4 的「棋子由上往下掉落」是本次唯一需要視覺動效的需求，但判定邏輯不需要等動畫播完才生效——落子的合法性、勝負判定在點擊當下就已同步算完，動畫純粹是 CSS transition 讓棋子從欄頂滑到實際落點格（依落點行數可調整 duration），不引入 tick 迴圈或 canvas 物理（見 Decision 4）。

**輸出彙整：**
1. **現有架構**：Grid 渲染（MINESWEEPER `flatCells` 模式）、回合制對戰（BATTLESHIP Turn 狀態機＋AI setTimeout 延遲＋玩家 AI 共用判定純函式）、Game State（`reactive()` + Engine class `getSnapshot()`）、非 tick-driven 輸入模式，四者皆為現成可直接沿用的先例。
2. **可重用模組**：`flatCells` computed 攤平渲染模式、Engine class + `getSnapshot()` 模式、Turn 狀態機＋`setTimeout` AI 延遲模式、`useGameHistory`／`GameRateDialog`／`GameRuleDialog` 等共用 composable 與元件。
3. **檔案結構**：`app/pages/game/connect4.vue`（頁面）＋`app/utils/connect4Engine.ts`（純邏輯核心）＋`server/services/game/retro/connect4.ts`（server 端服務）＋`server/api/games/retro/connect4/history.*.ts`（API 路由），比照既有十六款遊戲一致的檔案佈局。
4. **AI 方案**：Rule-Based，優先獲勝→優先擋→隨機合法欄，與正式落子共用同一套 Win Detection 純函式做試下判斷，不引入 Minimax（見 Decision 3）。
5. **MVP 順序**：Board（7×6）→ Gravity Drop → Win Detection（H/V/D）→ Turn System（Player→AI）→ AI Random/Basic Strategy → Draw → Game Over → Restart → Pause → Pixel UI，對齊使用者提供的 MVP 清單順序，逐步疊加不跳步。

## Goals / Non-Goals

**Goals:**
- 提供經典四子棋玩法：7×6 棋盤、玩家與 AI 交替選欄落子、Horizontal／Vertical／Diagonal 四方向連線判定、棋盤填滿無連線判 Draw。
- Win Detection 集中為單一純函式，供「正式落子後判定」與「AI 試下評估」共用，不寫兩份規則。
- AI 第一版採簡單 Rule-Based（優先獲勝→優先擋→隨機合法欄），不引入複雜搜尋演算法。
- Game Logic（Board／Gravity／Win Detection／Draw／AI）完全不依賴 DOM，抽到 `app/utils/connect4Engine.ts`；Server 端、client 資料層、game-hall 入口比照既有十六款遊戲的慣例逐一擴充。
- Logic 與 Rendering 分離：判定邏輯同步完成，動畫僅為視覺層額外效果。

**Non-Goals:**
- 不做 Minimax／Alpha-Beta 剪枝／深度搜尋／開局庫等進階 AI 策略——本次僅 Rule-Based 三層決策，留待後續變更視需要擴充。
- 不做 Online Multiplayer／配對／房間系統（第一版僅 Player vs AI）。
- 不做棋子掉落的物理動畫（彈跳、震動、canvas 粒子效果）——僅用簡單 CSS transition 呈現「往下滑」，不引入 canvas 或物理引擎。
- 不做可調整棋盤大小／連線所需子數（固定 7×6、固定連 4）／特殊道具或技能。
- 不做 Timer 影響勝負（若後續加入 Timer，僅作統計顯示，不計入判定）。
- 不引入資料庫；server 端持久化沿用專案現況的 in-memory 作法。
- 本次為規劃文件，不寫任何程式碼、不執行 `npm run dev`／`npx nuxt typecheck`。

## Decisions

1. **Board 資料結構採 `board[row][col]` 二維陣列，row 0 為頂列、row 5 為底列**
   - 理由：比照 MINESWEEPER 既有的二維陣列＋`flatCells` 攤平渲染模式，維持全專案 Grid 類遊戲一致的資料結構慣例，不另創新格式。
   - 做法：`Board = Cell[][]`（`Cell = 'EMPTY' | 'PLAYER' | 'AI'`），共 6×7 = 42 格。落子只需操作「欄」：`getNextOpenRow(board, col)` 由底列（row 5）往頂列（row 0）尋找第一個 `EMPTY` 格，回傳該 row（欄滿則回傳 `null`，該欄視為不可選）。
   - 替代方案：以「每欄一個陣列，內含目前已落子數」的堆疊式結構——放棄，二維陣列可直接沿用 MINESWEEPER 的 `flatCells` 攤平渲染邏輯，減少額外轉換層。

2. **四方向 Win Detection 集中為單一純函式 `checkWinFromMove(board, row, col, player)`，從剛落子的座標雙向掃描四軸**
   - 理由：需求明確要求「Win Detection 集中管理」；若 Horizontal/Vertical/Diagonal 各寫一支函式再組合呼叫，容易在「AI 試下評估」與「正式判定」兩處各自呼叫不同組合、產生不一致風險。
   - 做法：函式內部定義 4 組方向向量對（Horizontal `(1,0)/(-1,0)`、Vertical `(0,1)/(0,-1)`、Diagonal↘↖ `(1,1)/(-1,-1)`、Diagonal↙↗ `(1,-1)/(-1,1)`），對每一軸從 `(row,col)` 往兩個相反方向各自累計連續同色格數（含自身），總數 `>= 4` 即判定該軸連線成立，回傳 `true`；四軸皆不成立則回傳 `false`。這支函式不修改任何狀態，純粹讀取傳入的 `board` 快照。
   - 替代方案：只往「新落子只可能出現在某個方向」做單向掃描（例如利用重力特性，垂直方向只需往下檢查）——放棄，雖然理論上可行，但會讓函式帶有「假設呼叫時機」的隱性耦合，且需求明確要求集中管理、通用性優先於極小幅效能優化。

3. **AI 決策採「優先獲勝→優先擋→隨機合法欄」三層順序，且與正式落子共用同一支 `checkWinFromMove()` 做試下判斷，不寫兩套規則**
   - 理由：需求明確列出這個決策順序，且開發原則要求「AI 使用與玩家相同規則」；比照 BATTLESHIP「玩家與 AI 共用同一套判定/驗證純函式（`attackCell()`）」的先例，CONNECT 4 的「勝負判定」同樣不應該為 AI 另外寫一份簡化邏輯。
   - 做法：新增輔助函式 `wouldWin(board, col, player)`——複製一份僅該欄的落子模擬（不修改實際 `board`，只在記憶體中建立一個落子後的臨時快照，或克隆整個 board 後呼叫 `dropDisc()`＋`checkWinFromMove()`，用完即丟棄），回傳「若 `player` 在 `col` 落子是否會獲勝」。`chooseAiColumn(board)` 依序：(1) 對所有合法欄呼叫 `wouldWin(board, col, 'AI')`，找到就直接回傳該欄；(2) 否則對所有合法欄呼叫 `wouldWin(board, col, 'PLAYER')`，找到就回傳該欄（阻擋）；(3) 否則從合法欄中 `Math.random()` 隨機挑一欄。正式落子（`dropDisc()` 呼叫後）與 AI 試下評估皆呼叫同一支 `checkWinFromMove()`，只是輸入的 board 快照不同（前者是真實狀態，後者是模擬狀態）。
   - 替代方案：AI 另外維護一套簡化的威脅偵測邏輯（例如只檢查水平/垂直，不含對角線）——放棄，會產生「AI 看不到某些連線」的規則不一致 bug，且需求開發原則明確禁止。

4. **重力落子動畫採純 CSS transition，判定邏輯不等待動畫播放完成**
   - 理由：需求指出「重力式由上往下掉落的視覺需要棋子從欄頂滑到欄底該行，可用簡單 CSS transition 或直接瞬間置底，不需要 canvas 物理」；比照全專案「棋盤策略型遊戲非 tick-driven」的既有精神，判定與渲染分離。
   - 做法：`dropDisc()` 呼叫後立即在 engine 層完成落子與勝負判定（同步、無延遲），頁面把新落子的格子標記一個 CSS class（例如 `is-dropping`），透過 `transform: translateY(...)` 搭配 `transition-duration` 做「從欄頂滑到落點格」的視覺效果；duration 可依落點 row 數等比例微調（讓落得越深看起來稍慢），但這只是選配的細節，MVP 階段可先用固定 duration。動畫播放期間可選擇性停用棋盤點擊（避免動畫尚未跑完就疊加下一次落子造成視覺錯亂），但這是 UI 層的節流，不影響 engine 判定時機。
   - 替代方案：不做任何動畫，棋子瞬間出現在落點格——保留為最簡化的退路選項，若後續發現 CSS transition 在效能或視覺上有問題，可直接退回這個選項，不影響任何判定邏輯（純視覺開關）。

5. **計分方案：獲勝＝固定基礎分＋依落子效率遞減的加成，平手為固定中等分，落敗為 0（使用者已拍板採用效率加成模型）**
   - 背景：原始需求只描述勝負判定，沒有明確計分公式，需自行設計。BATTLESHIP 的既有模型是「勝利分數恆為單一固定值（1729），落敗分數依累積 HIT/SUNK 變動」；CONNECT 4 若照搬同一模型（勝利=固定值），會讓「4 步驚險獲勝」與「20 步慢慢獲勝」拿到一模一樣的分數，考量 CONNECT 4 本身就是「越快連成 4 子越厲害」的遊戲性質，設計上傾向讓效率反映在分數上，這點與 BATTLESHIP 刻意選擇「固定值」不同，是本次計分模型的取捨核心。
   - 做法（提案數值）：
     - `WIN_BASE = 60`
     - `MAX_EFFICIENCY_BONUS = 40`，`MIN_WINNING_MOVES = 4`（玩家最少只需 4 顆自己的棋子即可連成 4 子，理論最速獲勝）、`EFFICIENCY_STEP = 3`
     - 獲勝分數 `= WIN_BASE + max(0, MAX_EFFICIENCY_BONUS - (playerMovesUsed - MIN_WINNING_MOVES) * EFFICIENCY_STEP)`，上限 100（`playerMovesUsed = 4` 時取滿額 40 加成）
     - `DRAW_SCORE = 20`（固定值）
     - 落敗 `= 0`
   - 取捨說明：比照 BATTLESHIP「勝利分數恆為固定值」的先例，本設計選擇加入效率加成是因為 CONNECT 4 較 BATTLESHIP 更直接地獎勵「速度」這個玩家可感知的技巧指標，這會讓分數計算多一個「用子數」的追蹤欄位（`playerMovesUsed`），複雜度略高於 BATTLESHIP 模型，使用者已確認接受此取捨。
   - 替代方案：分數只看「贏/平/輸」三態固定值（不計效率）——已評估後不採用，效率加成更符合 CONNECT 4 的遊戲性質。

6. **`maxReasonableScore()` 對齊效率加成公式的理論上限，coin 倍率同步校準**
   - 理由：Decision 5 的公式有明確且可計算的上限（`WIN_BASE + MAX_EFFICIENCY_BONUS = 100`），比照 BATTLESHIP「有精確數學上限的計分模型可以貼著上限設定」的做法（見 `add-battleship-game` design.md Decision 6）。
   - 初始估算：`maxReasonableScore(): 100`（等於公式理論上限）；`coinRate: 1`（100 分 ≈ 100 coin，對齊「一場優秀表現 ≈ 100 coin」的既有目標）；`coinCapPerRun: 100`（等於上限，不需額外緩衝，因為 100 已是精確天花板）；`coinDailyCap: 100000`（沿用全遊戲統一慣例）。
   - 若 Open Questions 中使用者選擇退回「固定值模型」（WIN=100／DRAW=20／LOSE=0，不計效率），上述常數不需調整，`maxReasonableScore()` 仍是 100，僅計分公式本身變簡單。
   - 這些是程式碼估算值，比照既有慣例，上線後應實測校準。

7. **Turn 狀態機採七態設計（比 BATTLESHIP 少兩態，拿掉佈局階段），AI 回合加入 400~800ms 人工延遲**
   - 理由：CONNECT 4 沒有佈局需求，開局即可直接對戰，因此不需要 BATTLESHIP 的 `PLACEMENT`／`READY` 兩態；但「AI 回合不應瞬間完成」的精神仍然適用（需求要求完整 Turn System），沿用 BATTLESHIP 的 `setTimeout` 延遲模式。
   - 做法：`state.phase` 為 `PLAYER_TURN | PLAYER_DROP | PLAYER_RESULT | AI_TURN | AI_DROP | AI_RESULT | GAME_OVER` 七態之一；玩家點擊合法欄位觸發 `PLAYER_DROP → PLAYER_RESULT`（同步完成，僅動畫播放期間視覺上有短暫延遲），結果非 `GAME_OVER` 則進入 `AI_TURN`，以 `setTimeout(400~800ms 隨機)` 才呼叫 `chooseAiColumn()` 進入 `AI_DROP`，讓 HUD 顯示「AI THINKING...」。`setTimeout` callback 內需檢查 `state.phase` 是否仍為 `AI_TURN`，避免 Restart 後殘留的舊 timeout 誤觸發（比照 BATTLESHIP 既有做法）。
   - 替代方案：AI 回合立即完成——放棄，會讓對戰節奏過快、玩家感受不到「輪流」的節奏感，且與 BATTLESHIP 已驗證的體感慣例不一致。

## Risks / Trade-offs

- [風險] Rule-Based AI 僅做「單步」評估（獲勝／阻擋），無法偵測「雙重威脅」（Double Threat，即對手下一步無論擋哪邊都會輸的局面）——因應：這是需求明確排定的 MVP 範圍（不引入複雜 AI），Double Threat 偵測／Minimax 留待後續變更視需要擴充，不在本次解決。
- [風險] 計分公式加入「效率加成」比 BATTLESHIP 的固定值模型複雜，且 `playerMovesUsed` 的追蹤若實作疏漏（例如誤把 AI 落子步數也算進去）容易產生分數異常——因應：`playerMovesUsed` 明確定義為「玩家自己落子次數」，在 engine 層單一計數器維護，並在 Open Questions 中保留退回固定值模型的空間。
- [風險] CSS transition 動畫若棋盤同時有多個欄位快速連續操作（例如玩家快速連點），可能造成動畫堆疊或視覺錯亂——因應：動畫播放期間可選擇性停用棋盤點擊（節流），且無論動畫播放與否，engine 層的判定都已同步完成，不影響遊戲正確性，僅影響觀感。
- [風險] Turn 狀態機的 `setTimeout` 延遲若玩家在延遲期間快速切頁/操作，需確保不會產生「AI 落子兩次」或「狀態卡住」——因應：比照 BATTLESHIP 既有做法，`AI_TURN`/`AI_DROP` 期間棋盤停用互動，且 callback 內檢查 `state.phase` 仍為預期值才繼續。

## Migration Plan

- 全新功能，無既有資料需要遷移，且刻意設計成獨立的 `gameKey`，不影響既有十六款遊戲的紀錄與 coin 上限。
- 部署順序（每一步都可獨立回滾，比照 BATTLESHIP 既有的分步策略）：
  1. Server 端服務層與 `storage.ts` 註冊（尚未被路由引用，無風險）
  2. Server 端 API 路由（存在但尚未被前端呼叫，無風險）
  3. Client `app/services/api.ts` 擴充
  4. `useGameHistory.ts` 擴充
  5. `app/utils/connect4Engine.ts` 純邏輯核心（尚未被頁面引用，可獨立單元測試 Win Detection 與 AI 決策）
  6. 遊戲頁面 `app/pages/game/connect4.vue`（此步驟起才有實際資料寫入行為）
  7. `game-hall.vue` + `GameMachineCard.vue`（透過 `gameSprites.ts`）+ `GameHistoryDialog.vue`（此步驟起使用者才看得到入口，是唯一改變可見行為的步驟）
- 本次僅為規劃文件，實際部署順序待 tasks.md 進入實作階段後才會發生。

## Open Questions

- ~~計分方案定案~~ **已拍板**：採用 Decision 5 的「固定基礎分＋效率加成」模型（`WIN_BASE=60`＋最高 `40` 效率加成，`DRAW=20`，`LOSE=0`），不採單純固定值模型。
- 是否需要在後續變更為 AI 加入 Double Threat 偵測或淺層 Minimax（例如往後看 2 步）？本次先不做，留待使用者回饋後評估。
- 是否需要讓玩家可以選擇先手/後手（目前固定玩家先手）？本次先不做，屬於範圍外的規則調整。
- 落敗局是否需要獨立於平手局的 `coinRate` 校準（例如落敗給極少量 coin 而非 0）？屬於數值調校細節，上線後可依實測調整常數，不影響架構。
