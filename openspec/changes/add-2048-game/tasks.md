## 1. Server 端服務層

- [ ] 1.1 新增 `server/services/game/retro/2048.ts`：繼承 `RETRO_GAME_BASE`（`coinRate: 0.005`、`coinCapPerRun: 150`、`coinDailyCap: 100000`、`maxReasonableScore(): 300000`，見 design.md Decision 6）
- [ ] 1.2 `server/services/storage.ts`：遊戲初始化區塊新增 import 並 `new Retro2048Class()`

## 2. Server 端 API 路由

- [ ] 2.1 新增 `server/api/games/retro/2048/history.get.ts`、`history.post.ts`、`history.delete.ts`（比照既有十六款遊戲樣板）
- [ ] 2.2 確認 `server/middleware/auth.ts` 的 `/api/games` 前綴已涵蓋新路由，不需修改

## 3. Client API 層

- [ ] 3.1 `app/services/api.ts`：`RetroGameKey` 擴充 `'2048'`，`api.games.retro` 新增對應 3 個函式（`history2048`／`record2048`／`clear2048`，比照既有命名模式）

## 4. Client 資料層

- [ ] 4.1 `app/composables/useGameHistory.ts`：`GAME_KEYS` 陣列與 `_handlers.gameApi()` switch 新增一個分支

## 5. 遊戲核心邏輯（`app/utils/game2048Engine.ts`，不依賴 Vue）

- [ ] 5.1 型別與常數：`Tile`（`{ id: number; value: number }`）／`Board`（`(Tile|null)[4][4]`）／`Direction`／`GameStatus`，`BOARD_SIZE = 4`、`WIN_VALUE = 2048`、新 Tile 機率常數（2: 90%／4: 10%）、Swipe 閾值常數（供頁面引用，見 design.md Decision 4），全部集中管理
- [ ] 5.2 Board 工具：`createEmptyBoard()`、`spawnRandomTile(board)`（隨機空格＋90/10 機率）
- [ ] 5.3 單行/列合併核心：`compressAndMergeLine(line)`——壓縮→相鄰同值合併（一次只合併一次）→再壓縮，回傳 `{ line, scoreGained, moved }`（見 design.md Decision 2）
- [ ] 5.4 四方向轉換：`applyMove(board, direction)`——左移直接呼叫 5.3；右移反轉再呼叫再反轉；上/下移轉置棋盤後套用左/右移邏輯，四方向共用同一份合併函式
- [ ] 5.5 有效移動判斷與新 Tile 產生：任一行/列 `moved === true` 才視為有效移動並呼叫 `spawnRandomTile()`；否則不新增 Tile（見 design.md Decision 3）
- [ ] 5.6 Game Over 判定：`canMove(board)`——棋盤未滿即可移動；棋盤已滿時檢查四個方向是否存在任一相鄰同值可合併，皆不可時回傳 `false`
- [ ] 5.7 2048 判定：`hasReachedTarget(board)`——任一 Tile `value >= WIN_VALUE` 即為 `true`，`state.won` 一旦為真維持為真（見 design.md Decision 7）
- [ ] 5.8 `Game2048Engine` class：整合 5.1~5.7，提供 `reset()`、`applyMove(direction)`、`getSnapshot()`（回傳 board／score／status／won／moved）

## 6. 遊戲頁面與互動流程

- [ ] 6.1 `app/pages/game/2048.vue`：`reactive()` state 鏡像 engine snapshot，`_handlers`/`_actions`/`click` 三分法（比照 MINESWEEPER 慣例）
- [ ] 6.2 Board 渲染：`flatCells` computed 攤平 4×4 陣列 + `v-for`（`:key="tile.id"`）+ `grid-template-columns: repeat(4, var(--cell))`（比照 MINESWEEPER 慣例，見 design.md Decision 1）
- [ ] 6.3 Tile 樣式：依數值套用不同底色 class（2/4 淺色、8~1024 漸深、2048 用主題色 `#f4a261` 強調），不使用外部圖片
- [ ] 6.4 Keyboard：`onMounted` 綁定 `window.addEventListener('keydown', ...)`，方向鍵與 WASD 皆映射到 `applyMove()`，`onUnmounted` 解綁
- [ ] 6.5 Touch Swipe：棋盤容器綁定 `pointerdown`（記錄起點＋`setPointerCapture`）與 `pointerup`（座標差量判斷方向，閾值 30px），並設定 `touch-action: none` 避免與頁面捲動衝突（全專案首次引入，見 design.md Decision 4）
- [ ] 6.6 Score／Best Score HUD：`score` 即時顯示；Best Score 直接讀 `useGameHistory().statsByGame.value['2048']?.best ?? 0`，不新建儲存機制（見 design.md Decision 5）
- [ ] 6.7 WIN banner：達成 2048 時顯示一次性 `[CONTINUE]`／`[RESTART]` overlay，`[CONTINUE]` 後遊戲繼續，不強制結束（見 design.md Decision 7）
- [ ] 6.8 Game Over：`GAME OVER` overlay，呼叫 `useGameHistory().actions.record()`（`score` 為合併總和，`meta` 記錄 `maxTile`／`moves`）
- [ ] 6.9 Restart：完整重置 Board／Score／Tile id 計數器／WIN 狀態／GameState，不殘留上一局資料
- [ ] 6.10 Pause（ESC／P）：`PAUSED` overlay，`[RESUME]`／`[RESTART]`／`[EXIT]`，暫停期間 Keyboard／Swipe 皆停用
- [ ] 6.11 掛載共用 `GameRateDialog` / `GameRuleDialog`，`accent-color` 採 `#f4a261`（沙橙色，不與現有十六款遊戲撞色）

## 7. game-hall 入口

- [ ] 7.1 `app/pages/game-hall.vue`：`gameSlots` 新增 `{ id: 17, name: '2048', status: 'open', path: '/game/2048' }`
- [ ] 7.2 `app/config/gameSprites.ts`：`GAME_SPRITES` 新增一筆（`key: '2048'`, `icon: '🔢'`, `anim: 'bounce'`（沿用既有動畫值，不新增 CSS class）, `glow: '#f4a261'`）
- [ ] 7.3 `app/components/GameHistoryDialog.vue`：`FILTERS`／`GAME_KEYS`／`GAME_NAME` 各新增一筆

## 8. OpenSpec 文件

- [ ] 8.1 `proposal.md` / `design.md` / `tasks.md` / `specs/game-history/spec.md`（本次變更文件本身）

## 9. 驗證

- [ ] 9.1 `npm run dev` 啟動後，實際在瀏覽器測試四方向移動與合併：相同數字碰撞正確合併，一次移動同一格不重複合併二次
- [ ] 9.2 實測新 Tile 產生：有效移動後棋盤新增一格 2 或 4；對著無法移動的方向按鍵不新增 Tile、不消耗回合
- [ ] 9.3 實測 2048 判定：合成 2048 顯示 WIN banner，點擊 `[CONTINUE]` 後可繼續遊戲，不強制結束
- [ ] 9.4 實測 Game Over 判定：棋盤填滿且四方向皆無法移動/合併時正確顯示 `GAME OVER`
- [ ] 9.5 實測 Keyboard：方向鍵與 WASD 皆可正確觸發對應方向移動
- [ ] 9.6 實測 Touch Swipe：在觸控裝置或瀏覽器觸控模擬下，四個方向的滑動皆能正確觸發對應移動，短距離點按不誤觸
- [ ] 9.7 實測 Restart：確認完整重置，不殘留上一局的棋盤/分數/WIN 狀態
- [ ] 9.8 實測 Pause：ESC/P 觸發暫停，`[RESUME]`/`[RESTART]`/`[EXIT]` 行為正確，暫停期間輸入無效
- [ ] 9.9 實測 Best Score：確認直接反映 `statsByGame`，多局遊玩後正確更新為歷史最高分
- [ ] 9.10 未登入：確認寫入 localStorage、重整頁面紀錄仍在
- [ ] 9.11 已登入：確認 server 端紀錄寫入、coin 依 `score × coinRate` 入帳、單局與每日上限機制正確
- [ ] 9.12 `GameHistoryDialog` 篩選 tab 能正確顯示 `2048` 紀錄與統計
- [ ] 9.13 `game-hall.vue` 卡片正常顯示、可點擊進入 `/game/2048`
- [ ] 9.14 確認沒有 Console Error，不影響其他十六款遊戲
- [ ] 9.15 `npx nuxt typecheck` 確認新增/修改檔案無型別錯誤
