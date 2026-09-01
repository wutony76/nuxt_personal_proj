## Context

**1. 現有架構**
`add-game-history` 已建立 game-hall 小遊戲的完整架構：client 頁面自包含（engine class + `reactive()` 鏡像 snapshot）＋`useGameHistory`（未登入 localStorage／已登入 server API 雙模式）＋ server 端 `RETRO_GAME_BASE`（共用基底＋每款遊戲一個服務檔＋每款遊戲一組 API 路由資料夾）。全專案零 `<canvas>`、零 `requestAnimationFrame`，一律用 CSS Grid/DOM + `v-for` 做「瞬間重繪」渲染；規則複雜的遊戲會抽出 `app/utils/xxxEngine.ts`（`match3Engine.ts`／`match3RushEngine.ts`／`orbMatchEngine.ts`／`battleshipEngine.ts`／`solitaireEngine.ts`）。

**2. 可重用模組**
- MINESWEEPER 的 `flatCells` computed 攤平二維陣列＋`grid-template-columns: repeat(N, var(--cell))` 渲染模式，2048 的 4×4 Board 直接沿用，不重新發明棋盤渲染方式。
- `useGameHistory.ts` 既有的 `statsByGame` computed 已從 `records` 直接算出各遊戲的 `{best, count}`；2048 的 Best Score 需求**不需要另外設計儲存機制**，直接讀 `statsByGame.value['2048']?.best ?? 0` 即可（見 Decision 5）。
- `RETRO_GAME_BASE` 共用基底、`server/api/games/retro/<game>/history.*` 路由樣板、`app/services/api.ts` 的 `api.games.retro.*` 命名慣例、`GameRateDialog`／`GameRuleDialog` 共用元件，皆直接沿用既有十六款遊戲的慣例，不做架構調整。
- Pause（ESC／P）＋`[RESUME]`/`[RESTART]`/`[EXIT]` overlay 的既定互動模式，比照多數既有遊戲。

**3. 建議檔案結構**
```
app/pages/game/2048.vue          -- 頁面：reactive state 鏡像 + _handlers/_actions/click 三分法
app/utils/game2048Engine.ts      -- 純邏輯核心，不依賴 Vue
server/services/game/retro/2048.ts   -- 繼承 RETRO_GAME_BASE
server/api/games/retro/2048/history.get.ts
server/api/games/retro/2048/history.post.ts
server/api/games/retro/2048/history.delete.ts
```
（另需局部擴充既有的 `api.ts`／`useGameHistory.ts`／`GameHistoryDialog.vue`／`gameSprites.ts`／`game-hall.vue`／`storage.ts`，皆為既有檔案中新增一個分支/一筆資料，非新建檔案）

**4. Game State**
`GameEngine.getSnapshot()` 對外回傳：
```ts
{
  board: (Tile | null)[][]   // 4x4，Tile = { id: number; value: number }
  score: number              // 本局累計分數
  status: 'playing' | 'won' | 'gameover' | 'paused'
  won: boolean               // 是否已達成過 2048（達成後仍可繼續，見 Decision 7）
  moved: boolean             // 上一次 applyMove() 是否造成棋盤變化（供頁面判斷要不要新增 Tile／記錄）
}
```
頁面用 `reactive()` state 鏡像此 snapshot，`_handlers`（私有工具，如 swipe 座標換算）／`_actions`（含 loading/error 三段狀態的流程，如 `record()`）／`click`（UI 入口，如 `restart`/`pause`）三層分工，比照 project.md 規範與 MINESWEEPER 既有慣例。

**5. Board/Tile Architecture**
Board 用 `(Tile | null)[4][4]` 二維陣列表示，`Tile = { id: number; value: number }`；`id` 為遞增計數器產生的唯一值，用於 Vue `:key`，避免合併/位移時 DOM 節點誤重用。Board Data（engine 內部陣列）與 UI 渲染（頁面 `flatCells` computed）明確分離：engine 只操作純資料陣列，頁面只負責把 `board` 攤平成一維 `{ id, value, x, y }[]` 供 `v-for` 渲染，不在 template 內做任何合併/判斷邏輯。

**6. Input Architecture**
三種輸入來源共用同一個 `applyMove(direction: 'up'|'down'|'left'|'right')` 入口：
- **Keyboard**：`onMounted` 綁定 `window.addEventListener('keydown', ...)`，方向鍵與 WASD 皆映射到對應 `direction`。
- **Touch Swipe**（全專案首次引入，見 Decision 4）：棋盤容器綁定 `pointerdown`（記錄起點座標＋`setPointerCapture`）與 `pointerup`（計算與起點座標差量，換算方向），不逐格追蹤 `pointermove`。
- Pause 中／Game Over 後三種輸入來源皆直接 no-op（比照 MINESWEEPER 的 `state.status !== 'playing'` 時停用輸入的既有做法）。

**7. Score Architecture**
分數＝本局所有合併事件的「合併後數值」累加，無理論上限。與其他既有遊戲「表現越好分數越高」的計分哲學一致（不像 battleship 有恆定的勝利分數），但分數量級明顯偏低（典型優秀表現數千至 2 萬分），`coinRate`／`coinCapPerRun`／`maxReasonableScore()` 需依此量級單獨校準（見 Decision 6），不可套用其他遊戲的既有數值。

**8. MVP 實作順序**
1. Server 端服務層與 `storage.ts` 註冊
2. Server 端 API 路由
3. Client `app/services/api.ts` 擴充
4. `useGameHistory.ts` 擴充
5. `app/utils/game2048Engine.ts` 純邏輯核心（Board／移動壓縮合併／新 Tile／Game Over／2048 判定）
6. 遊戲頁面 `app/pages/game/2048.vue`（Board/Tile 渲染 → Keyboard → Touch Swipe → Score/Best Score → Win banner → Game Over → Restart → Pause）
7. `game-hall.vue` + `gameSprites.ts` + `GameHistoryDialog.vue` 入口擴充

（與 Migration Plan 的部署順序一致，每步可獨立回滾）

## Goals / Non-Goals

**Goals:**
- 提供標準 2048 玩法：4×4 棋盤、四向移動、同值合併（一次移動每格僅合併一次）、新 Tile 隨機產生（90% 為 2、10% 為 4）、達成 2048 顯示 WIN 但可繼續、無法移動時 Game Over。
- Keyboard（方向鍵／WASD）與 Touch Swipe 皆可操作，共用同一個 `applyMove()` 入口。
- Game Logic（Board／Tile／移動／合併／新 Tile／Game Over／2048 判定）完全不依賴 DOM，抽到 `app/utils/game2048Engine.ts`；Board Data 與 UI 渲染明確分離。
- Best Score 直接重用 `useGameHistory` 既有的 `statsByGame`，不新建儲存機制。
- Server／API／client 資料層比照既有十六款遊戲的慣例逐一擴充。

**Non-Goals:**
- 不做 Undo／步數回溯功能。
- 不做棋盤尺寸變體（3×3／5×5／6×6 等）——本次固定 4×4。
- 不做合併/移動的位移動畫、Tile 出現的縮放特效、音效——本次僅做「瞬間重繪」的靜態視覺切換，比照全專案既有渲染慣例，動畫留待 Polish 階段的獨立變更。
- 不做每日挑戰／關卡模式／計時模式——本次是標準無限模式（直到 Game Over 為止）。
- 不做多人／排行榜以外的社群功能。
- 不引入資料庫；server 端持久化沿用專案現況的 in-memory 作法。

## Decisions

1. **Board 用 `(Tile | null)[4][4]`，Tile 帶遞增 `id` 而非用 `value` 或座標當 key**
   - 理由：Vue `v-for` 若用陣列索引或 `value` 當 `:key`，合併/位移後同一個 DOM 節點可能被錯誤重用到不同的邏輯 Tile 上，尤其合併時兩個 Tile 變成一個，需要明確的身分識別。
   - 做法：engine 內維護一個遞增計數器，每次 `spawnRandomTile()` 或合併產生新 Tile 時配發唯一 `id`；頁面 `flatCells` computed 直接帶出 `id` 供 `:key` 使用。
   - 替代方案：用 `${row}-${col}` 當 key——放棄，這樣同一格在不同 tick 顯示不同 Tile 時無法讓 Vue 正確判斷是「同一個東西移動了」還是「新東西出現」，未來若要做位移動畫會直接卡住。

2. **合併演算法：單行/列「壓縮 → 相鄰同值合併 → 再壓縮」，一次移動每格只合併一次**
   - 理由：需求明確要求「相同數字碰撞時合併」，且 2048 的既定規則是「一次移動中，同一個新產生的合併結果不可再參與二次合併」（例如 `[2,2,2,2]` 往左移動結果是 `[4,4,0,0]` 而非 `[8,0,0,0]`）。
   - 做法：`compressAndMergeLine(line: (Tile|null)[])` 為純函式，接收單一行或列（長度 4）：(a) 過濾出非空 Tile 依序排列；(b) 由左至右掃描，若相鄰兩個 Tile 數值相同且皆尚未於本次移動中合併過，則合併為一個新 Tile（`value` 加倍，配發新 `id`），分數加上合併後的新數值；(c) 合併後的結果再次左移壓縮填滿空位。回傳 `{ line, scoreGained, moved }`，`moved` 表示這一行/列是否與移動前不同（供 Decision 3 判斷是否新增 Tile）。
   - 做法（四方向）：上下左右四個方向皆轉換成「對每一行或列呼叫 `compressAndMergeLine`」：左移直接逐行呼叫；右移先反轉行再呼叫再反轉回來；上移／下移先轉置棋盤（行列互換）再套用左移/右移邏輯，最後轉置回來。四個方向共用同一份合併函式，不重複寫四套邏輯。
   - 替代方案：對每個方向各自寫一份合併邏輯——放棄，四份幾乎相同的程式碼容易在修正 bug 時只改到其中一份，且需求本身就是同一套規則套用在四個方向。

3. **新 Tile 只在「本次移動確實造成棋盤變化」時才產生，機率 2:90%／4:10%**
   - 理由：需求明確要求「每次有效移動後隨機產生新的 2 或 4」；如果無論是否移動都新增 Tile，玩家對著牆壁方向連續按鍵會不斷增加棋盤負擔，也不符合原版 2048 的既定規則。
   - 做法：`applyMove(direction)` 呼叫 Decision 2 的移動邏輯後取得四行/列的 `moved` 旗標，只要有任一行/列 `moved === true`，代表本次移動有效：從所有空格中隨機挑一格，用 `Math.random() < 0.9 ? 2 : 4` 決定數值後放入。若四行/列皆 `moved === false`（例如已經靠右卻按右鍵），視為無效移動，不新增 Tile、不累加任何狀態、`state.moved = false` 供頁面選擇性地給予輕微提示（不算錯誤）。
   - 替代方案：固定機率或不分是否有效都新增——放棄，前者不符合原版玩法既定認知，後者會讓「无效方向乱按」也消耗棋盤空間，破壞遊戲平衡。

4. **Touch Swipe 手勢偵測：`pointerdown` 記錄起點、`pointerup` 計算座標差量判斷方向——全專案首次引入**
   - 理由：需求明確要求支援 Touch Swipe；全專案目前只有 `orb-match.vue` 用 Pointer Events 做過拖曳／觸控（`pointerdown/pointermove/pointerup` + `setPointerCapture`），但 orb-match 是「連續追蹤 `pointermove`、逐格判斷方向並即時觸發跨格交換」的拖曳型互動，2048 需要的是「放開手指那一刻，用起點到終點的座標差量一次性判斷一個方向」，判定邏輯與觸發時機都不同，因此是本專案第一款需要「由 pointerdown 到 pointerup 的座標差量判斷上下左右」的手勢偵測玩法，需在此明確記錄為新引入的決策點（比照 orb-match 當初引入拖曳時的記錄方式）。
   - 做法：棋盤容器綁定 `pointerdown`（記錄 `{x, y}` 起點並 `setPointerCapture`）；`pointerup` 時計算 `dx = endX - startX`、`dy = endY - startY`，取 `Math.abs(dx)` 與 `Math.abs(dy)` 較大者判斷主軸（水平或垂直），再依正負號決定方向（左/右或上/下）；若 `Math.max(Math.abs(dx), Math.abs(dy))` 小於閾值（30px），視為點按/誤觸，不觸發任何移動。不需要逐格追蹤 `pointermove`，也不需要 orb-match 那套「跨格判斷」邏輯，複雜度明顯低於拖曳型互動。
   - 替代方案：比照 orb-match 逐格追蹤 `pointermove`——放棄，2048 的操作單位是「一次滑動＝一個方向」，不需要連續追蹤中間路徑，逐格追蹤反而增加不必要的事件處理與狀態管理。

5. **Best Score 直接重用 `useGameHistory.ts` 既有的 `statsByGame`，不新建儲存機制**
   - 理由：`statsByGame` computed（`app/composables/useGameHistory.ts` 第 164-171 行）已經從 `state.records` 直接算出各 `gameKey` 的 `{ best, count }`，2048 只要在 `GAME_KEYS` 與相關擴充點登記好 `'2048'`，`statsByGame.value['2048']?.best` 就會自動反映歷史最高分，不需要額外設計任何本地儲存或 API。
   - 做法：頁面在 `onMounted` 呼叫既有的 `ensureLoaded()` 後，直接以 `statsByGame.value['2048']?.best ?? 0` 顯示 Best Score；每局結束呼叫 `useGameHistory().actions.record()` 寫入紀錄後，`statsByGame` 會在下次 `records` 更新時自動反映新的最高分，頁面不需要手動比較或另外持久化。
   - 替代方案：頁面自行用 `localStorage` 存一個獨立的 best score——放棄，會產生兩套資料來源（`statsByGame` 與自訂 key），且與已登入使用者的 server 端紀錄脫節，違反「優先重用 Game Center」的開發原則。

6. **`coinRate`／`coinCapPerRun`／`maxReasonableScore()` 依 2048 的分數量級單獨校準**
   - 理由：2048 的分數（合併數字總和）沒有理論上限，但典型優秀表現（合成 2048）落在數千至 2 萬分左右，量級明顯低於多數既有遊戲，不可直接套用其他遊戲的係數。
   - 估算：抓「合成 2048 的一場優秀表現 ≈ 20000 分」對齊「一場優秀表現 ≈ 100 coin」的既有目標，`coinRate: 0.005`（20000 × 0.005 = 100 coin）；`coinCapPerRun: 150`（約 1.5 倍於典型優秀表現，容許合成 4096/8192 等更高分的極端場次，同時避免無限刷分）；`coinDailyCap: 100000`（沿用全遊戲統一慣例，不自創其他值）；`maxReasonableScore(): 300000`（合成 8192 Tile 這種極罕見的高手場次估計也不會超過此值，設定為明顯異常值的過濾門檻，超過視為不合理分數，寫入紀錄與換算 coin 前先夾住）。
   - 這些是程式碼估算值，比照既有慣例，上線後應依實測分數分佈校準，不影響架構。

7. **達成 2048 時顯示 WIN banner 但不強制結束遊戲，玩家可選擇繼續或重來**
   - 理由：原版 2048 的既定玩法是「達成 2048 視為勝利，但玩家可以選擇繼續挑戰更高數值」；需求列出的 MVP 項目包含「2048 判定」與「Game Over」兩個獨立項目，暗示兩者是不同的狀態轉換，若把「達成 2048」直接等同「遊戲結束」，會強迫玩家在達標當下被迫結算，與原版既定體驗和多數玩家預期不符。
   - 做法：`state.won` 一旦為 `true` 便維持 `true`（只在 Restart 時重置），頁面顯示一次性的 WIN banner（`[CONTINUE]`／`[RESTART]`），點擊 `[CONTINUE]` 後 banner 關閉、遊戲繼續進行；真正的紀錄寫入（`useGameHistory().actions.record()`）僅在 Game Over（無法再移動）時觸發一次，`won` 狀態隨紀錄的 `meta.maxTile` 一併記錄供統計參考，不影響 `score` 計算本身。
   - 替代方案：達成 2048 立即結束遊戲並結算——放棄，會讓「見好就收」與「挑戰更高分」兩種玩家需求無法並存，且與原版 2048 的既定認知落差過大，屬於不必要的簡化（違反「不要過度設計」不等於「隨意簡化既定規則」）。

## Risks / Trade-offs

- [風險] Touch Swipe 的閾值（30px）若設太低容易誤觸、太高則不夠靈敏——因應：本次先抓一個經驗值，上線後可依實測手感調整常數，不影響架構（見 Open Questions）。
- [風險] 觸控裝置上滑動棋盤可能與整頁捲動手勢衝突——因應：棋盤容器套用 `touch-action: none`（CSS 層級處理，不影響 Game Logic），避免瀏覽器原生捲動搶走手勢。
- [風險] `coinRate`／`coinCapPerRun`／`maxReasonableScore()` 皆為初次估算值，實際分數分佈（尤其是能穩定合成 4096/8192 的高手玩家）可能與估算有落差——因應：這是全部十七款遊戲共同的既有慣例（估算值，上線後實測校準），非本次特有風險。
- [風險] 「達成 2048 後可繼續」與「Game Over 才結算」的設計，若玩家達成 2048 後直接關閉分頁離開（不點 `[CONTINUE]` 也不等到 Game Over），該局將不會被記錄——因應：這與其他遊戲「暫停或離開頁面 MUST NOT 視為結束」的既有規則一致（見 specs/game-history/spec.md 既有 Requirement），是既定行為，非本次新增的例外。

## Migration Plan

- 全新功能，無既有資料需要遷移，且刻意設計成獨立的 `gameKey`（`'2048'`），不影響既有十六款遊戲的紀錄與 coin 上限。
- 部署順序（每一步都可獨立回滾，對應 Context 第 8 項的 MVP 實作順序）：
  1. Server 端服務層與 `storage.ts` 註冊（尚未被路由引用，無風險）
  2. Server 端 API 路由（存在但尚未被前端呼叫，無風險）
  3. Client `app/services/api.ts` 擴充
  4. `useGameHistory.ts` 擴充
  5. `app/utils/game2048Engine.ts` 純邏輯核心（尚未被頁面引用，可獨立單元測試 Board／合併／新 Tile／Game Over 邏輯）
  6. 遊戲頁面 `app/pages/game/2048.vue`（此步驟起才有實際資料寫入行為）
  7. `game-hall.vue` + `gameSprites.ts` + `GameHistoryDialog.vue`（此步驟起使用者才看得到入口，是唯一改變可見行為的步驟）

## Open Questions

- Touch Swipe 的判定閾值（本次抓 30px）是否需要依裝置 DPI 或螢幕尺寸做調整？屬於數值調校細節，上線後可依實測手感調整常數，不影響架構。
- 是否要在後續變更加入「連續合併 Combo 加成分數」（例如一次移動內合併多對給予額外分數）？本次先不做，維持「合併後數值加總」的單純計分模型，留待使用者回饋後評估。
- `coinRate`／`coinCapPerRun`／`maxReasonableScore()` 的估算值是否需要在上線後依實際分數分佈重新校準？屬於數值調校細節，不影響架構（見 Decision 6）。
- 是否要在後續變更支援棋盤尺寸變體（例如 5×5 困難模式）？本次固定 4×4，列為 Non-Goal，留待使用者提出需求後再評估。
