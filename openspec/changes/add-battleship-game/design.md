## Context

- `add-game-history` 已建立 game-hall 小遊戲的完整架構：client 頁面自包含（engine class + reactive 鏡像 snapshot）＋ `useGameHistory`（A/B 雙模式）＋ server 端 `RETRO_GAME_BASE`（共用基底＋每款遊戲一個服務檔＋每款遊戲一組 API 路由資料夾）。
- MINESWEEPER 已示範「純點擊輸入＋非 tick-driven 回合制引擎＋DOM Grid 渲染（`flatCells` computed 攤平＋`grid-template-columns: repeat(N, var(--cell))`）」的完整模式；SOLITAIRE 進一步驗證「規則核心抽到 `app/utils/xxxEngine.ts`」與「全專案零拖曳」兩個先例（原規劃含 Drag & Drop，實作後拿掉）。BATTLESHIP 直接沿用這三個既有先例，不重新發明。
- 現有十五款遊戲裡沒有任何一款是「雙方各自擁有一個棋盤、互相隱藏資訊、輪流猜測攻擊」的對戰玩法——PONG 雖然是 player vs cpu，但屬於即時物理碰撞，CPU 邏輯只是簡單追蹤球的 Y 座標，不是「選擇座標攻擊」式的策略決策。BATTLESHIP 是本次架構首度出現「雙棋盤」與「回合制猜測攻擊 AI」，需要全新的 Turn 狀態機與 AI 落子邏輯，是本次唯一沒有既有先例可直接套用的部分。
- 現有遊戲的計分模型即使有理論上限（如 MINESWEEPER 的 1170），也都是「表現越好分數越高」的區間值；BATTLESHIP 依需求既定數值（HIT+100／SUNK+500／WIN+1000／MISS+0）等比縮小為三分之一（HIT+33／SUNK+167／WIN+333）後，**勝利分數是固定常數**（見 Decision 5），是本次計分模型設計上最特殊的一點，需要在 design 中明確記錄，避免後續誤以為 bug。

## Goals / Non-Goals

**Goals:**
- 提供傳統戰艦玩法：10×10 雙棋盤、5 種戰艦（共 17 格）、隱藏資訊、回合制攻擊，HIT/MISS/SUNK 判定＋防重複攻擊。
- 佈局階段採零拖曳的「選船→切換方向→點格預覽→確認」流程，AI 佈局全程對玩家隱藏。
- AI 攻擊使用 Random 策略（MVP），玩家與 AI 共用同一套 `attackCell()` 規則，AI 回合有 500~1000ms delay 避免瞬間完成。
- Game Logic（Board／Ship／Placement／Attack／Turn／AI）完全不依賴 DOM，抽到 `app/utils/battleshipEngine.ts`；Server 端、client 資料層、game-hall 入口比照既有十五款遊戲的慣例逐一擴充。

**Non-Goals:**
- 不做 Online Multiplayer／配對／房間系統（第一版僅 Player vs AI，1 vs 1，非即時對戰）。
- 不做 Hunt & Target 智慧 AI（命中後鎖定周圍格、推測船身方向）——留待下一個變更，本次 AI 僅 Random。
- 不做命中／沉船的特效動畫（爆炸 Pixel Effect、Cell Shake、Screen Shake）、音效、Particle——本次只做狀態正確切換與基本視覺提示（顏色/文字），動畫留待 Polish 階段的獨立變更。
- 不做不同棋盤大小／不同戰艦配置／特殊武器（雷達／空襲／魚雷／護盾）／Fog Mode／Challenge Mode。
- 不做 Timer 影響勝負（Timer 只作統計顯示，不計入計分或判定）。
- 不引入資料庫；server 端持久化沿用專案現況的 in-memory 作法。

## Decisions

1. **首度引入「雙棋盤＋隱藏資訊」的狀態設計，敵方棋盤的渲染規則與己方棋盤不同**
   - 理由：需求明確要求「玩家與 AI 各自擁有一個隱藏棋盤，船隻位置不能被對手看到」；現有遊戲（包含 MINESWEEPER）都只有單一棋盤，沒有「同一份資料，兩種視角」的既有模式。
   - 做法：`battleshipEngine.ts` 對內部維護完整的雙方 `Board`（含真實船位），但 `getSnapshot()` 對外回傳時，敵方棋盤只回傳 `EMPTY／HIT／MISS` 三種狀態給未攻擊格，隱藏 `SHIP` 狀態（除非該格所屬的船已 `sunk`，此時比照需求第 35 點顯示完整船身位置）；己方棋盤照實回傳。這個過濾邏輯放在 engine 層（`getPlayerViewOfEnemyBoard()`），不是頁面層自己做字串判斷，確保規則集中、UI 只負責顯示。
   - 替代方案：讓 UI 層自己判斷要不要顯示 SHIP——放棄，會讓「敵方隱藏規則」散落在 template/computed 裡，違反需求第 59 點「不要把規則散落在 UI Code」。

2. **佈局階段採零拖曳：選船→切換方向→點格預覽→確認，沿用 SOLITAIRE 先例並在第一版就定案**
   - 理由：使用者明確要求「看能不能不使用拖曳，使用方向跟旋轉來完成佈局」；SOLITAIRE 已經驗證過「原規劃含 Drag & Drop，實作後與使用者確認拿掉，改純點擊」的教訓（見 `add-solitaire-game` design.md Decision 3），BATTLESHIP 直接沿用這個已驗證的結論，不重複繞路。
   - 做法：`state.placement.activeShipId`（目前選取的船）＋`state.placement.orientation`（`HORIZONTAL`/`VERTICAL`，由 `[ROTATE]` 按鈕切換）＋`state.placement.previewCells`（hover／點按時即時算出的預覽格，比照 MINESWEEPER 的 `@click`/`mouseenter` 事件模式）。錨點固定為船頭格，依 orientation 往右或往下延伸 `ship.length` 格；`validateShipPlacement(board, ship, {x,y}, orientation)` 為純函式，回傳合法/非法＋原因，供 preview 顏色與 `confirmPlacement()` 共用同一份判斷，不重複寫兩次驗證邏輯。
   - Mobile：無 hover 概念，改成「點一下顯示 preview，再點同一格確認」，不需要額外的拖曳事件（`dragstart`/`dragover`/`drop`）。
   - 替代方案：拖曳戰艦到棋盤上——放棄，使用者已明確排除，且需要處理觸控裝置的拖曳手感與邊界吸附，複雜度明顯高於點擊流程。

3. **允許戰艦相鄰，不強制船與船之間留一格**
   - 理由：需求第 12 點明確採用此簡化規則，「簡化規則與 AI」——若要求留空格，`validateShipPlacement()` 與 AI 隨機佈局的候選格計算都會變複雜（需要額外檢查鄰格），且對玩家體驗沒有明顯提升。
   - 做法：`validateShipPlacement()` 只檢查兩件事：(a) 船的所有格子是否都在棋盤範圍內；(b) 船的格子是否與任何一艘已放置船隻的格子重疊。不檢查對角/正交鄰接。

4. **AI 佈局與玩家佈局共用同一套 `validateShipPlacement()`，僅座標來源不同**
   - 理由：需求第 59 點「玩家與 AI 使用同一套攻擊規則」的精神同樣適用於佈局規則——如果 AI 佈局另外寫一套驗證，未來規則調整（例如日後要不要禁止相鄰）需要改兩處，容易產生行為不一致的 bug。
   - 做法：AI 佈局流程＝`Choose Ship → Random Position → Random Orientation → validateShipPlacement() → 合法就 placeShip()／不合法就重新隨機`，與玩家佈局呼叫的是同一支函式，只是座標與方向的產生方式改成 `Math.random()`。10×10 棋盤＋17 格船體（密度 17%）加上「允許相鄰」的簡化規則，理論上不會發生佈局死鎖，不需要額外的逃生機制。

5. **計分取需求既定數值的三分之一（HIT+33／SUNK+167／WIN+333／MISS+0），比例不變，但明確記錄「勝利分數恆為固定值」這個特殊性質**
   - 理由：使用者要求先將計分整體調降為三分之一；為維持 HIT:SUNK:WIN = 1:5:10 的既有比例，直接對原始數值（100／500／1000）取三分之一並四捨五入為整數（33／167／333），不改變相對權重關係。
   - 由於玩家獲勝的充分必要條件是「命中敵方全部 17 格」，且每格恰好被命中一次（重複攻擊被禁止、已攻擊格不能再選），所以任何一場勝利的 HIT 加總必然是 `17 × 33 = 561`，SUNK 加總必然是 `5 × 167 = 835`（5 艘船全部擊沉），加上 WIN `+333`，**任何一場勝利的最終分數必然是 `561 + 835 + 333 = 1729`，不因射擊次數多寡而變動**——這跟其他遊戲「表現越好分數越高」的既有計分哲學明顯不同，必須在此明確記錄，避免之後誤以為分數計算有 bug。
   - 玩家落敗（己方戰艦全滅）時的分數＝落敗當下已累積的 HIT／SUNK 加總（無 WIN 加成），依對局進度是一個變動值，上限低於 1729。
   - 效率／手氣改用「Game Statistics」呈現（SHOTS／HITS／MISS／ACCURACY／ROUND 數），屬於統計資訊、不影響 `score` 欄位本身，比照需求第 46／47 點「計分」與「統計」是兩個獨立區塊的既定設計。
   - 替代方案：依「用最少回合數獲勝」給額外加成分數（類似其他遊戲的效率獎勵）——放棄，使用者這次只要求調整既有分值比例，尚未提出效率加成的需求，不做超出範圍的擴充（見 Open Questions，留待使用者確認是否要在後續變更加入）。

6. **`maxReasonableScore()` 對齊調整後的固定上限 1729，coin 倍率同步重新校準**
   - 理由：BATTLESHIP 是本次唯一「有精確且不可超過的數學上限」的計分模型（不像大多數遊戲只能抓寬裕估計值），任何回報值超過 1729 都是確定的異常，`maxReasonableScore()` 可以貼著真實上限設定；分數整體調降為三分之一後，`coinRate` 需要同步放大約 3 倍，才能維持「一場優秀表現 ≈ 100 coin」的既有目標不變。
   - 初始估算：一場勝利固定 1729 分，抓 `coinRate: 0.06`（1729 分 ≈ 104 coin，對齊既有「一場優秀表現 ≈ 100 coin」的既有目標，與調整前的 104 coin 大致等值）；`coinCapPerRun: 130`（略高於 104，抓一點餘裕即可防呆，不需要像開放式計分遊戲抓好幾倍）；`coinDailyCap: 100000`（沿用既有慣例）；`maxReasonableScore(): 1729`（等於精確上限，不留額外緩衝，因為這是唯一一個「精確知道天花板」的遊戲）。
   - 這些是程式碼估算值，比照既有慣例，上線後應實測校準（尤其是落敗局的分數分佈，可能偏低，`coinRate` 若太低會讓落敗局幾乎拿不到 coin，屬於預期行為而非 bug）。

7. **Turn 狀態機採明確的九態設計，AI 回合加入 500~1000ms 人工延遲**
   - 理由：需求第 27／30 點明確要求完整的 Turn 狀態列表，且 AI 回合不應瞬間完成（避免玩家感覺不到「AI 在思考」）；現有遊戲沒有任何一款需要跨越「玩家操作 → 等待 → AI 操作 → 等待 → 換玩家」這種非同步交錯流程，需要新建。
   - 做法：`state.phase` 為 `PLACEMENT | READY | PLAYER_TURN | PLAYER_ATTACK | PLAYER_RESULT | AI_TURN | AI_ATTACK | AI_RESULT | GAME_OVER` 九態之一，AI 進入 `AI_TURN` 時用 `setTimeout(500~1000ms 隨機)` 才真正呼叫 `chooseAttackTarget()` 進入 `AI_ATTACK`，讓 HUD 有機會顯示「AI THINKING...」。這是本次架構首度出現「非同步延遲驅動的狀態轉換」，比照 MINESWEEPER 的「非 tick-driven、只在事件發生時同步處理」精神，只是這裡的事件來源多了一個 `setTimeout` 觸發點。
   - 替代方案：AI 回合立即完成——放棄，需求明確要求延遲，且會讓對戰節奏過快、玩家來不及看清楚上一步結果。

8. **Server／API／client 資料層完全比照既有慣例擴充，不做任何架構調整**
   - `RETRO_GAME_BASE` 不變、`server/api/games/retro/<game>/history.*` 資料夾樣式不變、`app/services/api.ts` 的 `api.games.retro.*` 命名方式不變、`useGameHistory.ts` 的 `GAME_KEYS`／`_handlers.gameApi()` switch 擴充一個分支即可，`server/middleware/auth.ts` 的 `/api/games` 前綴保護與 `BalanceChangeType` 的 `'game-reward'` 皆已涵蓋，不需修改。
   - `useGameHistory` 的 `meta` 欄位借用來記錄 `shots`／`accuracy`／`rounds` 等統計資訊，比照其他遊戲把 `meta` 當作附加資訊的既有用法，不影響 `score` 計算。

## Risks / Trade-offs

- [風險] 「勝利分數恆為固定值 1729」可能讓玩家覺得「不管打得好不好分數都一樣」，缺乏成就感差異——因應：Game Statistics（ACCURACY／ROUND 數）提供技巧回饋，`meta` 欄位保留未來若要加效率加成分數的擴充空間，但本次不做（見 Open Questions）。
- [風險] Random AI 在敵方棋盤格數變少時可能連續多次選到已知 MISS 附近的無效區域，體感較笨——因應：這是需求明確排定的 MVP 範圍（第 31 點），Hunt & Target 留待下一個變更，不在本次解決。
- [風險] 佈局階段的 preview 錨點固定為「船頭往右/往下延伸」，若玩家習慣「以滑鼠位置為船體中心」可能不直覺——因應：比照需求第 9／10 點的既定範例（`Preview` 是從選定格往右/往下延伸），屬於需求既定行為，非本次自創。
- [風險] Turn 狀態機的 `setTimeout` 延遲若玩家在延遲期間快速點擊/切頁，需確保不會產生「AI 攻擊兩次」或「狀態卡住」——因應：`AI_TURN`/`AI_ATTACK` 期間敵方棋盤與己方棋盤皆設為不可互動（比照 MINESWEEPER 的 `state.status !== 'playing'` 時停用點擊的既有做法），並在 `setTimeout` callback 內檢查當下 `state.phase` 是否仍為預期值，避免 Restart 後殘留的舊 timeout 誤觸發。

## Migration Plan

- 全新功能，無既有資料需要遷移，且刻意設計成獨立的 `gameKey`，不影響既有十五款遊戲的紀錄與 coin 上限。
- 部署順序（每一步都可獨立回滾，比照既有幾次擴充的分步策略）：
  1. Server 端服務層與 `storage.ts` 註冊（尚未被路由引用，無風險）
  2. Server 端 API 路由（存在但尚未被前端呼叫，無風險）
  3. Client `app/services/api.ts` 擴充
  4. `useGameHistory.ts` 擴充
  5. `app/utils/battleshipEngine.ts` 純邏輯核心（尚未被頁面引用，可獨立單元測試）
  6. 遊戲頁面 `app/pages/game/battleship.vue`（此步驟起才有實際資料寫入行為）
  7. `game-hall.vue` + `GameMachineCard.vue`（透過 `gameSprites.ts`）+ `GameHistoryDialog.vue`（此步驟起使用者才看得到入口，是唯一改變可見行為的步驟）

## Open Questions

- 是否要在後續變更加入「效率加成分數」（例如用更少回合數獲勝給額外分數），讓勝利分數不再是恆定值？本次先不做，留待使用者回饋後評估（見 Decision 5）。
- Hunt & Target AI 的觸發時機／推測船身方向演算法細節，留待下一個變更的 design.md 再詳細規劃，本次僅在 proposal 中列為 Non-Goal。
- 落敗局的 `coinRate` 是否需要獨立於勝利局校準（例如落敗局給稍高倍率避免玩家覺得「輸了就完全拿不到 coin」）？屬於數值調校細節，上線後可依實測調整常數，不影響架構。
