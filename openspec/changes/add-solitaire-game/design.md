## Context

- `add-game-history` 已建立 game-hall 小遊戲的完整架構：client 頁面自包含（engine class + reactive 鏡像 snapshot）＋ `useGameHistory`（A/B 雙模式）＋ server 端 `RETRO_GAME_BASE`（共用基底＋每款遊戲一個服務檔＋每款遊戲一組 API 路由資料夾）。
- 現有 11 款遊戲全部是「動作／反應」（鍵盤＋tick 迴圈）或「點擊消除」（MINESWEEPER，純點擊、無 tick）類型，**沒有任何一款需要拖曳操作**。SOLITAIRE 原規劃引入 Drag & Drop，實作驗證後與使用者確認拿掉（見 Decision 3），最終比照 MINESWEEPER 的純點擊模式，維持全專案「零拖曳」的既有慣例。
- 現有遊戲的邏輯組織方式：10 款是「inline class 寫在單一 .vue 檔案內」，只有 MATCH3 系列因為兩個變體（RUSH／CLASSIC）需要共用同一套消除演算法，才把核心引擎抽成獨立檔案 `app/utils/match3Engine.ts`。SOLITAIRE 本身只有一個變體，但其規則驗證邏輯（花色/點數/正反面/合法牌組判斷）複雜度與 match3 相近，且比照專案 Mandatory Enforcement 規範「複雜業務邏輯必須抽離至 Class」，因此比照 match3 先例把核心抽到 `app/utils/solitaireEngine.ts`（見 Decision 1），而不是像多數遊戲一樣整個塞進 .vue 檔案。
- 現有遊戲的計分方向多數是「開放式無上限」，PONG（勝場數）與 MINESWEEPER（5 關封頂總分）是兩個例外。SOLITAIRE 的分數介於兩者之間：事件觸發加分（比照 tetriminos／match3／spaceShooter 的模型）但整體受牌局規模限制、非完全開放。使用者明確要求「翻牌不計分，只有接龍接起來才計分」，因此計分只對應「牌實際被接上合法序列」這件事，翻牌（自動翻牌／Stock 抽牌）純粹是動作、不觸發任何分數事件（見 Decision 5）。

## Goals / Non-Goals

**Goals:**
- 提供傳統 Klondike 接龍完整規則：7 欄 Tableau、Stock/Waste（Draw 1）、4 個 Foundation、交替色遞減疊放、合法牌組整組搬動、空欄限 K、自動翻牌、勝負判定。
- 提供完整可玩的點擊操作（選取＋點擊目標區），比照 MINESWEEPER 的純點擊模式，不引入拖曳（見 Decision 3）。
- Server 端、client 資料層、game-hall 入口完全比照既有十一款遊戲的慣例逐一擴充，不引入資料庫。
- 規則核心（`solitaireEngine.ts`）與渲染層（`solitaire.vue`）分離，牌的邏輯位置（第幾欄第幾張）與像素座標分離，方便未來擴充 Draw-3／Undo／Hint 不需要動渲染層。

**Non-Goals:**
- 不做 Undo／Hint／Auto Complete（留待第二階段）。
- 不做 Draw-3 模式、不做難度選擇（本次只做 Draw-1 單一模式）。
- 不做每日挑戰／成就／排行榜／統計。
- 不限制 Stock 循環次數（MVP 允許無限循環；因為翻牌本身不計分，循環次數不再是計分漏洞，見 Decision 5）。
- 不做複雜歷史計分公式（不採用真實 Windows Vegas 計分那套跟時間反比的公式，避免無查證來源硬套）。
- 不引入資料庫、不做遊戲重播，只存結算後摘要（分數、moves、耗時）。
- 不影響既有十一款遊戲的程式碼與行為。

## Decisions

1. **規則核心抽成獨立檔案 `app/utils/solitaireEngine.ts`，比照 `match3Engine.ts` 先例，而非塞進 .vue 檔案**
   - 理由：本專案除 MATCH3 系列外，其餘 10 款遊戲都是 inline class 寫在 .vue 內；但 SOLITAIRE 的規則驗證（交替色＋遞減＋合法牌組＋空欄限 K＋同花色遞增）複雜度與 match3 的消除演算法相近，且完全不依賴任何畫面/DOM 概念，抽成獨立檔案更符合專案「複雜業務邏輯抽離至 Class」的強制規範，也讓未來加 Draw-3／Undo／Hint 時只需要在這個檔案內加方法，不影響渲染層。
   - 做法：`solitaireEngine.ts` 匯出 `Card`／`Suit`／`Rank`／`CardLocation` 型別與工廠函式（`createDeck`／`shuffle`／`deal`），以及 `SolitaireCoreEngine` class（內部管理 tableau/foundation/stock/waste 四組資料＋所有規則驗證方法＋`tryMove()`/`drawFromStock()`/`recycleWaste()`/`tryAutoMoveToFoundation()`/`checkWin()`/`getSnapshot()`）。不依賴 Vue，`solitaire.vue` 只匯入使用。
   - 替代方案：像其他 10 款遊戲一樣整個塞進 .vue——放棄，規則複雜度不適合跟渲染/互動邏輯混在同一個檔案，且違反專案既有的「複雜邏輯抽 Class」規範。

2. **牌的資料模型只存「邏輯位置」（第幾欄），不存像素座標；渲染層依邏輯位置換算實際座標**
   - 理由：Game Logic 與 Rendering 分離是專案既有規範；SOLITAIRE 沒有連續 physics，牌的「位置」純粹是邏輯概念（哪一欄、欄內第幾張），把像素座標放進引擎資料會讓規則邏輯意外耦合到畫面排版參數（卡片間距、層疊偏移量）。
   - 做法：`Card.location` 是 `{zone:'tableau', column} | {zone:'foundation', suit} | {zone:'stock'} | {zone:'waste'}`，不含 x/y；`solitaire.vue` 的 `_handlers.cardStyle(card, indexInZone)` 純函式依 `location` 與同一欄目前已有幾張牌，換算出實際 `left/top`。

3. **輸入方式：只做點擊模式（選取＋點擊目標區），不做拖曳**
   - 原規劃：曾以 Pointer Events 實作拖曳（`pointerdown` 記錄候選牌組 → 移動超過閾值才視為拖曳、更新純視覺 transform → `pointerup` 用 `elementFromPoint` 判定落點 → 呼叫 `engine.tryMove()`），拖曳與點擊共用同一個驗證入口，且已可正確運作（含不合法落點自動彈回）。
   - 異動理由：實作驗證後與使用者確認，拖曳只是「決定 from/to 的其中一種方式」，不影響任何規則正確性；點擊模式本身已完整可玩、已測試過，拖曳只帶來操作手感上的加分，卻是本次架構唯一需要維護的 Pointer Events／落點判定／幽靈牌渲染邏輯。使用者評估後選擇拿掉拖曳，讓 SOLITAIRE 維持跟其餘既有遊戲一致的「零拖曳」慣例，降低維護面。
   - 最終做法：僅保留點擊模式——第一次點擊選取一張牌（或合法的連續牌組），第二次點擊目標區（另一欄或某個 Foundation）呼叫 `engine.tryMove()`；雙擊呼叫 `engine.tryAutoMoveToFoundation(cardId)`。`solitaireEngine.ts` 完全不受影響（`tryMove`／`getGrabbableSequence` 從一開始就是輸入方式無關的純規則層）。
   - 影響範圍：僅 `solitaire.vue`（移除 `pointerdown`/`pointermove`/`pointerup` 監聽、`state.dragging`、幽靈牌渲染層）與 `PlayingCard.vue`（移除只給拖曳幽靈牌用的 `ghost` prop），不影響 server／API／其他共用檔案。

4. **Game State 沿用既有四態命名風格（小寫字串），額外新增 `win` 態；Timer 比照 MINESWEEPER 的「非 tick-driven」做法**
   - 理由：既有遊戲的 status union 都是 `'ready'|'playing'|'pause'|'gameover'` 這種小寫字串風格，SOLITAIRE 沿用此風格並加一個 `win`（其他遊戲沒有「贏」的概念，PONG 的勝負是「勝場數」而非整局勝利）。SOLITAIRE 本質是回合制、沒有連續 physics，比照 MINESWEEPER 只用 1 秒 `setInterval` 更新 HUD 時間顯示，不需要 16ms tick loop 驅動任何畫面更新。
   - 做法：`type SolitaireStatus = 'ready'|'playing'|'pause'|'win'|'gameover'`；`playing` 時計時器跑，`pause` 暫停，`win`/`gameover` 停止且不歸零（結算畫面顯示最終時間）；`checkWin()` 在每次成功搬牌到 Foundation 後呼叫一次。
   - `gameover` 觸發時機：SOLITAIRE 沒有「輸」的規則判定（不像其他遊戲有明確失敗條件），`gameover` 只由玩家主動按「結束」觸發（比照既有遊戲的 `endGameNow()` 慣例），純粹是「提早結算目前分數」的手動流程，不是規則上的失敗。

5. **計分模型：翻牌不計分，只有實際把牌接上合法序列（Tableau／Foundation）才算分**
   - 原規劃：翻出「本局第一次」正面的牌給 +10，並用 `Set<cardId>` 防止 Stock/Waste 無限循環時重複刷這筆翻牌分（見下方「異動」）。
   - 異動理由：使用者明確要求「翻牌不計分，只有接龍接起來才計分」，直接把整個「翻牌給分」機制拿掉，比防刷分的補丁更徹底——不只堵住 Stock 循環刷分的漏洞，也讓分數更純粹地反映「牌局實際被解開的程度」，而不是「翻了多少次牌」。連帶原本用來防刷分的 `everFlipped` 追蹤（`Set<cardId>`）也一併移除，因為已經沒有翻牌分數需要防護。
   - 最終做法：計分事件只剩兩種——合法移動到 Tableau **+5**、移到 Foundation **+10**，完成牌局額外 **+200**。`flipTopIfNeeded()`／`drawFromStock()` 只負責把牌翻正面、回傳 `flippedCardId`（供 UI 顯示用），不再回傳/累加任何分數。
   - 估算：計分事件變少，中高水準對局總分預期比原估算（300～700）略低，暫時維持 `coinRate: 0.3`、`coinCapPerRun: 300`、`coinDailyCap: 100000`、`maxReasonableScore(): 3000` 不變，這些本來就是估算值，上線後依實測校準。
   - **後續修正（Foundation 防刷分）**：拿掉翻牌分數後，發現另一個刷分路徑——牌可以合法從 Foundation 移回 Tableau、再移回同一個 Foundation，若每次上 Foundation 都給 +10，等於無限刷分。使用者確認「可以移回，但不再次加分」，因此新增 `foundationScored: Set<cardId>` 追蹤「這張牌是否已經在本局拿過 Foundation 分數」：一張牌只有**第一次**成功放上 Foundation 才給 +10，之後不管被移走幾次、又放回幾次，都不再給這筆分數；但移動本身（含移回 Tableau 的那一步，走 `MOVE_SCORE` 分支）仍然照常執行與計數，只是不重複核發 Foundation 那筆獎勵。

6. **新增共用元件 `PlayingCard.vue`，是本次唯一偏離「單一 .vue 檔案」慣例的地方**
   - 理由：牌面渲染（花色符號＋點數＋正反面樣式）會同時出現在 Tableau（7 欄）／Foundation（4 疊）／Stock／Waste 四個區域，是「同一段渲染邏輯被大量重複」的情境，跟其他遊戲「每種畫面物件通常只出現在一處」不同；拆成獨立元件避免同一段 template 在 `solitaire.vue` 裡複製 4 次。
   - 做法：純呈現、無邏輯，props `suit`／`rank`／`faceUp`／`selected`／`highlight`，內部純 CSS/Text 畫牌面（比照 `app/components/lottery/bg/6hc/*/base/Ball.vue` 的「純 CSS 畫圖形＋文字」手法），不使用任何圖片素材。
   - 這是本次架構唯一的例外，會在此明確記錄理由，避免未來誤以為是隨意拆檔案。

7. **Server／API／client 資料層完全比照既有慣例擴充，不做任何架構調整**
   - `RETRO_GAME_BASE` 不變、`server/api/games/retro/<game>/history.*` 資料夾樣式不變、`app/services/api.ts` 的 `api.games.retro.*` 命名方式不變、`useGameHistory.ts` 的 `GAME_KEYS`／`_handlers.gameApi()` switch 擴充一個分支即可。
   - `gameKey` 採用 `'solitaire'`，路由路徑採 `solitaire`（單一英文字，不需要 kebab-case 轉換）。
   - `meta` 欄位額外記錄 `{moves, elapsedSeconds}`，是本次唯一同時記錄「移動次數」與「耗時」的遊戲，供未來如果要做「最佳時間／最佳步數」統計時使用（本次不做，只是先把資料存起來）。

## Risks / Trade-offs

- [風險] 拿掉拖曳後，操作手感比原生 Windows Solitaire 的拖拉體驗弱一些（每次移動需要兩次點擊）——因應：這是使用者確認過的取捨，點擊模式已完整涵蓋所有規則操作，未來若要重新加回拖曳，`tryMove()` 這個驗證入口完全不需要更動。
- [風險，已修正] `tryMove()` 允許把牌從 Foundation 移回 Tableau（比照原版 Windows Solitaire 的行為），原本反覆「Foundation → Tableau（+5）→ 移回原本的 Foundation（+10）」可以無限刷分——已用 `foundationScored: Set<cardId>` 修正（見 Decision 5 後續修正），同一張牌只有第一次上 Foundation 才給分，移動本身仍可自由來回。
- [風險，已修正] 同一個道理也適用於純 Tableau 之間：把一張牌在兩欄之間來回搬動，原本每次都算 +5，可以無限刷分。已用同樣的「第一次計分」精神修正——`tableauScored: Set<string>`，以 `${anchorId}:${targetColumn}` 為 key，同一張牌（以抓取時的錨點牌為準）移到同一欄只有第一次給 +5，之後不論來回幾次都不再重複給分；但移動本身仍然完全自由，不限制搬動次數。
- [風險] `solitaireEngine.ts` 是全新的複雜規則引擎，正確性需要大量合法/非法移動案例驗證——因應：實作順序刻意把「規則引擎」與「UI」分開兩個階段，規則先在無 UI 情況下驗證正確，再疊加互動層，降低除錯難度。
- [風險] coin 倍率是估算值，可能跟其他遊戲的 coin/分鐘產出有落差——因應：`coinRate`／`maxReasonableScore` 是獨立於 `solitaire.ts` 的常數，上線後可單獨調整。

## Migration Plan

- 全新功能，無既有資料需要遷移，刻意設計成獨立的 `gameKey`，不影響既有十一款遊戲的紀錄與 coin 上限。
- 部署順序（每一步都可獨立回滾，比照既有幾次擴充的分步策略）：
  1. `solitaireEngine.ts` 純邏輯（無 UI，可獨立驗證正確性，無風險）
  2. Server 端服務層與 `storage.ts` 註冊（尚未被路由引用，無風險）
  3. Server 端 API 路由（存在但尚未被前端呼叫，無風險）
  4. Client `app/services/api.ts`／`useGameHistory.ts` 擴充
  5. `PlayingCard.vue` + `solitaire.vue`（點擊模式先行，此步驟起才有實際資料寫入行為）
  6. 疊加 Drag & Drop
  7. `game-hall.vue` + `gameSprites.ts` + `GameHistoryDialog.vue`（此步驟起使用者才看得到入口，是唯一改變可見行為的步驟）

## Open Questions

- Foundation 與 Tableau 兩處的來回搬動刷分都已修正（`foundationScored`／`tableauScored`），但這種「以 (牌, 目的地) 是否曾經到過」為準的防刷分規則本身是粗略的估算，上線後應觀察是否有其他未預期的組合路徑，必要時再校準。
- coin 倍率（`coinRate: 0.3`）與 `maxReasonableScore(): 3000` 皆為估算值，上線後應依實測分數分佈校準。
- 行動裝置上的點擊熱區大小（卡片間距、層疊偏移量）留待實測後調整，不影響本次架構規劃。
- 第二階段（Undo／Hint／Draw-3／Auto Complete／重新加回拖曳）留待 MVP 驗證規則正確後再評估。
