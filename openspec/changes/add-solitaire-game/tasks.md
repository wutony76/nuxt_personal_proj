## 1. 核心規則引擎（純邏輯，無 UI）

- [x] 1.1 新增 `app/utils/solitaireEngine.ts`：`Suit`／`Rank`／`CardColor`／`CardLocation`／`Card` 型別定義（見 design.md Decision 1／2）
- [x] 1.2 `createDeck()`／`shuffle()`／`deal()`：52 張牌、Fisher-Yates 洗牌、Klondike 標準發牌（7 欄 1~7 張遞增、每欄最後一張正面、其餘進 Stock）
- [x] 1.3 規則驗證方法：`canStackOnTableau`（交替色＋遞減）、`isValidSequence`（合法可搬動牌組）、空欄僅限 K（併入 `tryMove` 的 tableau 分支判斷，未獨立拆 `canPlaceOnEmptyTableau` 函式）、`canPlaceOnFoundation`（同花色＋依序遞增，空 Foundation 僅限 A）
- [x] 1.4 `tryMove(cardId, targetLocation)`：統一的移動入口，內部依目標區域分派到 tableau-move／foundation-move 邏輯，成功時觸發自動翻牌（見 1.6）與計分事件
- [x] 1.5 `drawFromStock()`／`recycleWasteToStock()`：Draw 1，Stock 空時 Waste 洗回 Stock，次數不限
- [x] 1.6 自動翻牌：Tableau 某欄最下面正面牌被移走後，若下面還有反面牌自動翻正面
- [x] 1.7 `tryAutoMoveToFoundation(cardId)`：依牌本身花色嘗試對應 Foundation，呼叫 `tryMove()`
- [x] 1.8 `checkWin()`：4 個 Foundation 皆滿（各 13 張）
- [x] 1.9 計分事件：合法移動到 Tableau +5、移到 Foundation +10、完成 Bonus +200；翻牌（自動翻牌／Stock 抽牌）不計分，已移除原本的 `everFlipped` 防刷分追蹤（不再需要，見 design.md Decision 5 異動記錄）；已用 `vite-node` 跑過 52 張不重複不缺牌／發牌正確／規則判定／各計分事件確切金額（+5/+10）／翻牌與抽牌零分等案例，全數通過
- [x] 1.10 `getSnapshot()`：回傳可供 UI 渲染的純資料快照（tableau/foundation/stock/waste 陣列、score、moves）

## 2. Server 端服務層

- [x] 2.1 新增 `server/services/game/retro/solitaire.ts`：繼承 `RETRO_GAME_BASE`（`coinRate: 0.3`、`coinCapPerRun: 300`、`coinDailyCap: 100000`、`maxReasonableScore(): 3000`，見 design.md Decision 5）
- [x] 2.2 `server/services/storage.ts`：`retroGamesInit()` 新增 import 並 `new` 該類別

## 3. Server 端 API 路由

- [x] 3.1 新增 `server/api/games/retro/solitaire/history.get.ts`、`history.post.ts`、`history.delete.ts`（比照既有樣板）
- [x] 3.2 確認 `server/middleware/auth.ts` 的 `/api/games` 前綴已涵蓋新路由，不需修改

## 4. Client API 層

- [x] 4.1 `app/services/api.ts`：`RetroGameKey` 擴充 `'solitaire'`，`api.games.retro` 新增對應 3 個函式

## 5. Client 資料層

- [x] 5.1 `app/composables/useGameHistory.ts`：`GAME_KEYS` 陣列與 `_handlers.gameApi()` switch 新增一個分支

## 6. 牌面共用元件

- [x] 6.1 新增 `app/components/PlayingCard.vue`：props `suit`／`rank`／`faceUp`／`selected`／`ghost`，純 CSS/Text 畫牌面（花色符號＋點數＋左上/右下角標＋中央大符號），正面／反面（藍色斜紋 plaid）兩種樣式，不使用圖片素材（見 design.md Decision 6）

## 7. 遊戲頁面：點擊模式（先行）

- [x] 7.1 `app/pages/game/solitaire.vue`：匯入 `solitaireEngine.ts`，reactive state 鏡像＋`_handlers`/`_actions`/`click` 三層
- [x] 7.2 渲染 Tableau（7 欄）／Foundation（4 疊）／Stock／Waste，套用 `PlayingCard.vue`
- [x] 7.3 點擊模式：第一次點擊選取，第二次點擊目標區呼叫 `engine.tryMove()`（見 design.md Decision 3）；點擊空欄／空 Foundation 用 `data-drop-zone` + `click.zone()` 處理
- [x] 7.4 雙擊呼叫 `engine.tryAutoMoveToFoundation()`
- [x] 7.5 WELCOME／READY／RESULT 三段式 overlay（比照既有遊戲慣例，RESULT 依 `state.won` 顯示 WIN 或一般 RESULT 標題）
- [x] 7.6 HUD：SCORE／MOVES／TIME（TIME 比照 minesweeper.vue 的 1 秒 `setInterval`，非 tick-driven，見 design.md Decision 4）
- [x] 7.7 Win／Gameover 判定與 RESULT 顯示，呼叫 `useGameHistory().actions.record()`（`meta` 帶 `moves`／`elapsedSeconds`）

## 8. 拖曳輸入（已移除）

- [x] 8.1 原以 Pointer Events 實作拖曳，且已可正確運作（含不合法落點自動彈回、無殘留幽靈牌，Playwright 實測通過）；實作驗證後與使用者確認拿掉，最終只保留點擊模式，維持全專案「零拖曳」慣例（見 design.md Decision 3）。已移除 `solitaire.vue` 的 `pointerdown`/`pointermove`/`pointerup` 監聽、`state.dragging`、幽靈牌渲染層，以及 `PlayingCard.vue` 只給拖曳幽靈牌用的 `ghost` prop；`solitaireEngine.ts` 完全未受影響。

## 9. 視覺與主題

- [x] 9.1 掛載共用 `GameRateDialog` / `GameRuleDialog`，`accent-color` 採 `#2ecc71`（撲克綠，不與現有十一款遊戲撞色）
- [x] 9.2 格線背景（`.sol-overlay` + `::before/::after` + `ambient-drift/ambient-pulse/grid-drift`，比照其他遊戲慣例）
- [x] 9.3 Tableau 層疊間距（`CASCADE_OFFSET`）依使用者回饋兩次調緊：24px → 18px → 14px，卡片角落點數/花色仍可讀

## 10. game-hall 入口

- [x] 10.1 `app/config/gameSprites.ts`：新增 `solitaire` 項目（icon 🃏，新增 `flip` 動畫類型供 `GameHallSprites.vue` 使用）
- [x] 10.2 `app/pages/game-hall.vue`：`gameSlots` 陣列新增 `{ id: 12, name: 'SOLITAIRE', status: 'open', path: '/game/solitaire' }`
- [x] 10.3 `app/components/GameHistoryDialog.vue`：篩選 tab／`GAME_KEYS`／遊戲名稱對照各新增一筆

## 11. OpenSpec 文件

- [x] 11.1 `proposal.md` / `design.md` / `tasks.md` / `specs/game-history/spec.md`（本次變更文件本身）

## 12. 驗證

- [x] 12.1 規則引擎單獨驗證：用 `vite-node` 直接跑 `solitaireEngine.ts`，涵蓋 52 張不重複不缺牌、洗牌後發牌數量與正反面正確、交替色/遞減判定、抽牌與翻牌不計分、合法移動確切為 +5、Foundation 確切為 +10 等案例，全數通過
- [x] 12.2 `npm run dev` 啟動後，用 Playwright 實測點擊模式：發牌佈局正確（1~7 張遞增）、Stock 點擊抽牌／waste 顯示正確、點擊選取與再次點擊取消選取皆正常、雙擊 A 成功自動上疊 Foundation 且觸發自動翻牌（分數 +20＝Foundation+10＋翻牌+10）
- [x] 12.3 拖曳模式已移除（見 design.md Decision 3），拿掉前已用 Playwright 驗證拖曳到不合法位置正確不移動、無殘留幽靈牌；點擊模式為現行唯一操作方式，已於 12.2 完整驗證
- [ ] 12.4 觸控裝置（或瀏覽器裝置模擬）測試點擊操作是否順手——尚未測試，留待人工驗證
- [ ] 12.5 Win 判定：刻意排出接近完成的牌局，確認 4 個 Foundation 滿後正確觸發 WIN——`checkWin()` 邏輯已單獨驗證正確，但尚未跑過完整真實牌局到底的 UI 端到端驗證
- [x] 12.6 翻牌不計分：`vite-node` 單元測試與 Playwright 皆已驗證反覆循環 Stock/Waste、連續抽牌 5 次後 SCORE 仍為 0；Foundation 防刷分：`vite-node` 用直接注入盤面狀態的方式驗證「移出 Foundation（+5）→ 移回同一 Foundation（第二次起 +0）」，反覆兩輪皆確認不再重複給分；Tableau 防刷分：同樣用注入盤面狀態的方式驗證兩欄之間來回搬動同一張牌，第一次到訪各欄各算一次 +5，之後來回反覆皆為 +0（`tableauScored`），10 輪隨機牌局迴歸測試全數通過
- [x] 12.7 未登入：Playwright 實測確認寫入 `localStorage`（key `game-history-v1`），紀錄含正確的 `score`／`meta.moves`／`meta.elapsedSeconds`
- [ ] 12.8 已登入：尚未測試（需要登入帳號），coin 結算邏輯與其他十一款遊戲共用同一個 `RETRO_GAME_BASE`，架構上一致，留待人工驗證
- [ ] 12.9 `GameHistoryDialog` 篩選 tab 能正確顯示 `SOLITAIRE` 紀錄與統計——程式碼已加對應項目，尚未實際點開 dialog 驗證畫面
- [x] 12.10 `game-hall.vue` 卡片正常顯示（Playwright 確認頁面含「SOLITAIRE」、開放中數量顯示 12）、可點擊進入 `/game/solitaire`
- [x] 12.11 確認既有十一款遊戲程式碼完全未被修改（僅 6 個共用檔案新增分支，未動既有分支邏輯）
- [x] 12.12 `npx nuxt typecheck`：新增/修改的檔案（`solitaire.vue`、`solitaireEngine.ts`、`PlayingCard.vue`、API 路由、`api.ts`、`useGameHistory.ts`、`GameHistoryDialog.vue`、`gameSprites.ts`、`GameHallSprites.vue`、`game-hall.vue`、`storage.ts`）皆無型別錯誤；專案既有的 lottery/kl8 相關型別錯誤與本次變更無關（修改前即存在）
