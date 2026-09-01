## Context

原始開發計畫要求檢查 Grid、Input、Game State、Level、Move Counter、UI、Save System 七個面向，逐一對應既有架構如下：

- **Grid**：二維棋盤，每個 Cell 只有 ON／OFF 兩態。棋盤大小依 level 從關卡資料表讀取（3×3 起跳，隨 level 遞增），資料結構為 `boolean[][]` 或等效的 0/1 矩陣，比照既有 Grid 類遊戲（MINESWEEPER／ORB MATCH）用二維陣列 + `flatCells` computed 攤平的既定模式。
- **Input**：LIGHTS OUT 屬於「非 tick-driven，只在點擊事件發生時同步處理」的棋盤策略型遊戲，比照 MINESWEEPER／SOLITAIRE／BATTLESHIP 的先例，不需要 `setInterval` 驅動的 game loop；滑鼠點擊、鍵盤 Space/Enter、觸控 tap 三種輸入最終都呼叫同一支 `toggleCell()`，不重複寫三套邏輯。
- **Game State**：`level`（目前關卡）、`grid`（目前盤面）、`moves`（本關已用步數）、`moveLimit`（本關步數上限）、`score`（跨關累計分數）、`status`（`'playing' | 'levelClear' | 'gameover' | 'paused'`）。
- **Level**：所有關卡資料（棋盤大小、初始盤面、`moveLimit`）集中存放在 `lightsOutEngine.ts` 的 `LEVELS` 常數表，比照 BREAKOUT 的 `LEVELS` 陣列先例，不散落在頁面元件裡（呼應原始需求「所有關卡資料集中管理」）。
- **Move Counter**：每次 Toggle 操作（不論結果）都會遞增 `moves`，用於 (a) 判定是否超過 `moveLimit` 觸發 Game Over、(b) 計算過關時的效率分數。
- **UI**：Pixel UI 風格，Grid 用 `flatCells` computed + `v-for` + `grid-template-columns: repeat(N, var(--cell))` 渲染，比照 MINESWEEPER 慣例；不使用外部圖片，Cell 的 ON/OFF 狀態用純 CSS class 切換底色/發光效果呈現。
- **Save System**：共用 `app/composables/useGameHistory.ts`——未登入寫 `localStorage`（key `game-history-v1`，上限 50 筆）；已登入呼叫 `api.games.retro.lightsOut()`，server 端 `server/services/game/retro/lightsOut.ts` 繼承 `RETRO_GAME_BASE`。遊戲結束（Game Over）時才寫入一筆累計分數的紀錄，比照 BREAKOUT「累計到 game over 才 record()」的既有模式，而非 BATTLESHIP 那種「單局固定分數」模式。

**MINESWEEPER 座標邏輯先例的沿用與差異**：MINESWEEPER 的 `neighbors(r, c)` 用雙層 `for (dr in -1..1) for (dc in -1..1)` 產生 8 方向（Moore neighborhood）鄰格，再用 `inBounds()` 過濾超出棋盤範圍的鄰格。LIGHTS OUT 需要的「點擊一格切換自己＋上下左右、超出棋盤忽略」座標運算，本質上是同一套「產生候選鄰格座標 → `inBounds()` 過濾」的模式，**只是把 8 方向偏移量換成 4 方向偏移量 `[[-1,0],[1,0],[0,-1],[0,1]]`**，且動作語意從「展開（`revealed = true`）」改成「切換（`state = !state` / XOR）」。這是本次唯一需要特別注意的地方：直接複製 MINESWEEPER 的鄰域產生迴圈會誤觸對角格，實作時必須明確改成 4 方向陣列，而不是沿用雙層迴圈。

現有 16 款遊戲裡沒有任何一款是「點擊觸發連動翻轉多格狀態（XOR 語意）」的玩法——MINESWEEPER 的連鎖展開是單向的（`revealed: false → true`，不會反轉回去），LIGHTS OUT 的翻轉是雙向可逆的（每格可以被切換任意次，狀態在 ON/OFF 間來回），這是本次架構首度出現的邏輯型態，但因為狀態機夠簡單（單一 boolean 陣列 + XOR），不需要引入新的架構模式，沿用既有座標運算與 Grid 渲染即可。

## Goals / Non-Goals

**Goals（本次 MVP 範圍）：**
- Grid 棋盤、ON/OFF Cell、Toggle Logic、Neighbor Toggle（4 方向、邊界忽略）。
- Move Counter、Level（棋盤大小/步數上限依 level 遞增，資料集中管理）。
- Win Detection（全部 Cell 為 OFF）、Game Over（步數超過 `moveLimit`）、Next Level、Restart。
- Pause、Keyboard、Touch、Pixel UI。
- 計分（ClearBonus + 步數反比效率分數，跨關累加）、Save System（`useGameHistory` A/B 雙模式）。
- 不允許 Undo（原始需求明確排除，MVP 不做）。

**Non-Goals（第二階段項目，本次不做）：**
- **Random Puzzle Generator**：本次關卡資料採手動設計的固定盤面（含 `moveLimit`），不做隨機盤面生成，見 Open Questions 的可解性提醒。
- **Hint**：不提供提示下一步該點哪一格的功能。
- **Undo**：不提供復原上一步操作的功能。
- **Best Moves**：不做「歷史最佳步數」的比較與顯示（但 `meta.movesUsed` 這次先記錄下來，讓第二階段能無痛加上比較邏輯，不需要改資料結構）。
- **Challenge Mode**：不做限時挑戰、每日挑戰盤面等特殊模式。
- 不做音效、Particle、Cell 翻轉動畫等視覺特效，僅做狀態正確切換與基本顏色提示。
- 不引入資料庫；server 端持久化沿用專案現況的 in-memory 作法。

## Decisions

1. **Toggle Logic 的座標邊界判斷沿用 MINESWEEPER 模式，鄰域從 8 方向改為 4 方向，動作語意從展開改為 XOR 切換**
   - 理由：MINESWEEPER 已經驗證過「候選鄰格產生 → `inBounds()` 過濾」這套座標運算模式在本專案跑得穩定，不需要重新發明；但兩者的鄰域範圍與動作語意不同，必須在設計文件明確記錄，避免實作時直接複製貼上導致鄰域方向錯誤（誤含對角格）或動作語意錯誤（誤做展開而非切換）。
   - 做法：`toggleCell(grid, x, y)` 是純函式，內部用固定的 4 方向偏移量陣列 `[[-1,0],[1,0],[0,-1],[0,1]]` 逐一計算鄰格座標，每個候選座標先做 `inBounds()` 邊界檢查，通過才對該格做 `cell = !cell`（連同自己一起，共最多 5 格）；不修改傳入的 grid，回傳新的 grid（或視實作慣例改為 in-place，於 tasks.md 實作階段決定）。
   - 替代方案：沿用 MINESWEEPER 的 8 方向迴圈只是把「展開」改成「切換」——放棄，會誤把對角格也一起切換，不符合原始需求「只切換自己與上下左右」。

2. **關卡資料表採手動設計的固定盤面，棋盤大小依 tier 遞增、`moveLimit` 在 tier 內遞減，超出表格長度沿用 BREAKOUT 的延伸模式**
   - 理由：原始需求要求「所有關卡資料集中管理」且「關卡越高棋盤越大或步數越少」；為了保證每一關都是可解的盤面（Lights Out 並非所有盤面都保證有解，見 Open Questions），MVP 階段選擇手動設計固定關卡（含棋盤大小、初始 ON/OFF 盤面、`moveLimit`），而不是隨機生成，這樣可以在設計階段就用「已知有解」的盤面填表。
   - 做法：`LEVELS` 陣列以「每 2~3 關為一個 tier」分組，同 tier 內棋盤大小不變、`moveLimit` 隨關卡數遞減；跨 tier 棋盤大小遞增一階（3×3 → 4×4 → 5×5 → 6×6 …），例如：

     | level | size | moveLimit |
     |-------|------|-----------|
     | 1 | 3 | 8 |
     | 2 | 3 | 6 |
     | 3 | 4 | 10 |
     | 4 | 4 | 8 |
     | 5 | 5 | 12 |
     | 6 | 5 | 10 |
     | 7 | 6 | 14 |
     | 8 | 6 | 12 |

     超過表格長度時，比照 BREAKOUT `levelConfig()` 的 `clampedIndex = Math.min(levelIndex, LEVELS.length - 1)` + 額外遞增/遞減公式模式，棋盤大小封頂在一個實作階段再決定的上限（例如 7×7，避免手機螢幕放不下），`moveLimit` 依公式繼續小幅遞減但設下限（例如不低於 6），避免無窮循環後變成不可能過關。確切上限數值與封頂 tier 屬於實作細節，本文件先定調策略、不鎖死最終數字。
   - 替代方案：一開始就做 Random Puzzle Generator——放棄，可解性驗證複雜度高於本次 MVP 範圍，且需求已明確把它列在第二階段，見 Non-Goals 與 Open Questions。

3. **Move Counter 驅動兩種獨立結局：Win Detection（全部 OFF）與 Game Over（步數超過 `moveLimit`），非 continue/lives 制**
   - 理由：原始需求 MVP 清單把「Win Detection」與「Game Over / Clear」列為兩個獨立項目，且「關卡越高…步數越少」意味著步數上限是硬性限制，不是像 BREAKOUT 的生命值可以重來；LIGHTS OUT 沒有「lives」概念，超過 `moveLimit` 就直接結束本局。
   - 做法：每次 `toggleCell()` 呼叫後 `moves += 1`，接著依序檢查：(a) `isAllOff(grid)` 為 true → 判定 Win，顯示 `LEVEL CLEAR`，短暫延遲後 `level += 1` 並重建下一關盤面（`moves` 歸零、`moveLimit` 讀新一關數值）；(b) 若未全滅且 `moves >= moveLimit` → 判定 Game Over，呼叫 `useGameHistory().actions.record()` 寫入累計 `score`，顯示 `GAME OVER` overlay。兩個判定互斥，Win 判定優先於 Game Over 判定（同一次點擊若剛好用完最後一步又全滅，算 Win）。
   - 替代方案：超過 `moveLimit` 不算輸，只是不再加分——放棄，違反原始需求 MVP 清單明確要求的「Game Over / Clear」是一個需要實作的獨立狀態。

4. **計分公式：ClearBonus（固定過關獎勵）＋ 步數反比的 EfficiencyScore，逐關累加，直到 Game Over 才結算**
   - 理由：原始需求只描述「過關」機制，沒有明確分數公式，需要自行設計；比照 SOLITAIRE／其他策略型遊戲「效率換分數」的設計精神——步數越少代表解題效率越高，應該給更高分數，同時每過一關都應該有基本的固定獎勵（避免玩家在困難關卡故意用最少步數卡關刷分而完全忽略關卡本身的價值）。
   - 做法：
     - `ClearBonus(level) = 50 + level * 10`（每過一關的固定獎勵，隨關卡遞增）
     - `EfficiencyPool(level) = size(level)^2 * 40`（棋盤越大，效率獎勵池越大，反映該關本身更難）
     - `EfficiencyScore = round(EfficiencyPool(level) / max(moves, 1))`（步數越少，分數越高的反比公式）
     - 單關分數 `= ClearBonus(level) + EfficiencyScore`，累加進 `state.score`；Game Over 時才把累計的 `state.score` 一次寫入 `useGameHistory().actions.record()`。
     - 舉例：Level 1（3×3，`moveLimit` 8）若在 4 步內解完：`ClearBonus = 50 + 10 = 60`，`EfficiencyPool = 9 * 40 = 360`，`EfficiencyScore = round(360 / 4) = 90`，該關得分 `150`。
   - **Move Counter → Save/Best Moves 的轉換**：`moves`（本關步數）與 `level`（當前關卡）在 Game Over 當下一併存入 `meta: { levelReached, movesUsed }`，`movesUsed` 記錄的是「本局結束當下最後一關」的步數（若在 Win 途中結束則為 0，代表已重置）；第二階段若要做「Best Moves」，可直接比較歷史紀錄裡同一 `level` 的 `meta.movesUsed` 找出最小值，不需要改動這次的資料結構。
   - 替代方案：比照 BATTLESHIP 的「勝利分數恆為固定值」設計——放棄，LIGHTS OUT 需求本身就強調「步數越少越好」的效率意涵，固定分數無法反映這一點。

5. **`maxReasonableScore()` 與 coin 倍率採「開放式無上限、抓寬裕估計值」的既有做法（比照 BREAKOUT／SPACE INVADERS／TYPING）**
   - 理由：LIGHTS OUT 如同 BREAKOUT，關卡可以無限往上疊加，沒有精確數學上限（不像 BATTLESHIP 那種「命中格數恆定」的情況），只能抓一個寬裕但不誇張的估計值防止異常回報值。
   - 初始估算：假設一場水準之上的表現大約能推進到 10~12 關並維持不錯的效率，單關分數落在 100~300 之間，累計約落在 1500~2500 區間；抓 `maxReasonableScore(): 3000` 作為寬裕上限。`coinRate: 0.1`（累計 1000 分 ≈ 100 coin，對齊「一場優秀表現 ≈ 100 coin」的既有目標）、`coinCapPerRun: 120`（略高於 100 留防呆餘裕）、`coinDailyCap: 100000`（沿用全遊戲既有慣例）。這些是程式碼估算值，比照既有慣例，上線後應依實測分數分佈校準。

## Risks / Trade-offs

- [風險] `moveLimit` 若設得太緊，玩家可能覺得「差一步就過關」不公平，體驗受挫——因應：MVP 先用手動設計、預先驗證過可解且留有餘裕步數的固定關卡資料，不做過度嚴苛的 `moveLimit`；不允許 Undo 更放大這個風險，但這是原始需求明確排除的項目，先接受此取捨，觀察上線後回饋再決定是否放寬。
- [風險] 若實作時直接複製 MINESWEEPER 的 `neighbors()` 迴圈卻忘記把 8 方向偏移量改成 4 方向，會產生「切到對角格」的邏輯錯誤——因應：已在 Context／Decision 1 明確記錄差異，且 tasks.md 會把「4 方向偏移量陣列」列為明確的驗收項目。
- [風險] 效率反比公式在極端情況（例如某關只花 1 步就解完）可能算出單關分數異常偏高——因應：`maxReasonableScore()` 對整場累計分數做寬裕上限防呆（Decision 5），且 `EfficiencyScore` 公式本身用 `max(moves, 1)` 避免除以零，必要時實作階段可再加單關分數上限。
- [風險] 「關卡資料表手動設計」意味著關卡數量有限，玩家可能很快就打穿所有手動設計的關卡進入「延伸公式」區間，難度曲線可能不如預期平滑——因應：這是 MVP 階段刻意的簡化取捨，Random Puzzle Generator（第二階段）能提供更長尾的內容量，本次先接受手動設計的關卡數量有限。

## Migration Plan

- 全新功能，無既有資料需要遷移，且刻意設計成獨立的 `gameKey`（`'lightsOut'`），不影響既有 16 款遊戲的紀錄與 coin 上限。
- 部署順序（每一步都可獨立回滾，比照既有幾次擴充的分步策略）：
  1. Server 端服務層與 `storage.ts` 註冊（尚未被路由引用，無風險）
  2. Server 端 API 路由（存在但尚未被前端呼叫，無風險）
  3. Client `app/services/api.ts` 擴充
  4. `useGameHistory.ts` 擴充
  5. `app/utils/lightsOutEngine.ts` 純邏輯核心（尚未被頁面引用，可獨立單元測試 `toggleCell()` 與關卡資料表）
  6. 遊戲頁面 `app/pages/game/lights-out.vue`（此步驟起才有實際資料寫入行為）
  7. `game-hall.vue` + `GameMachineCard.vue`（透過 `gameSprites.ts`）+ `GameHistoryDialog.vue`（此步驟起使用者才看得到入口，是唯一改變可見行為的步驟）

## Open Questions

- **隨機盤面可解性提醒（供第二階段 Random Puzzle Generator 設計參考）**：Lights Out 並非所有隨機的 ON/OFF 盤面組合都保證有解（可解盤面只是所有可能盤面的一個子集合）。若第二階段要實作「Random Puzzle Generator」，正確做法是**從全滅（全 OFF）的已解狀態開始，反向套用隨機次數的合法 Toggle 操作來生成盤面**（因為 Toggle 操作是自身的反元素、且操作順序不影響結果，用同一組操作能保證原路解回全 OFF），而不是直接對每一格隨機賦值 ON/OFF。本次 MVP 不做隨機生成，先用手動設計的固定關卡表，這個提醒先記錄下來供未來設計參考。
- `moveLimit` 的實際數值需要上線後依實測（玩家平均解題步數）校準，本文件的表格數值僅為初始估算示例。
- Best Moves（第二階段）在 UI 上如何跟現有 `score` 分開呈現、是否要在 HUD 額外顯示「本關歷史最佳步數」，留待第二階段變更的 design.md 再詳細規劃；本次僅確保 `meta.movesUsed` 有記錄，不做超出範圍的 UI 擴充。
- 是否要對「跨 tier 延伸」的棋盤大小設一個絕對上限（例如 7×7 或 8×8）以兼顧手機版面——目前傾向封頂，但確切數值留待實作階段依實際 UI 測試決定。
