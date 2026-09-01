## 1. Server 端服務層

- [ ] 1.1 新增 `server/services/game/retro/lightsOut.ts`：繼承 `RETRO_GAME_BASE`（`coinRate: 0.1`、`coinCapPerRun: 120`、`coinDailyCap: 100000`、`maxReasonableScore(): 3000`——開放式無上限的寬裕估計值，見 design.md Decision 5）
- [ ] 1.2 `server/services/storage.ts`：遊戲初始化區塊新增 import 並 `new RetroLightsOutClass()`

## 2. Server 端 API 路由

- [ ] 2.1 新增 `server/api/games/retro/lightsOut/history.get.ts`、`history.post.ts`、`history.delete.ts`（比照既有 16 款遊戲樣板）
- [ ] 2.2 確認 `server/middleware/auth.ts` 的 `/api/games` 前綴已涵蓋新路由，不需修改

## 3. Client API 層

- [ ] 3.1 `app/services/api.ts`：`RetroGameKey` 擴充 `'lightsOut'`，`api.games.retro` 新增對應 3 個函式

## 4. Client 資料層

- [ ] 4.1 `app/composables/useGameHistory.ts`：`GAME_KEYS` 陣列與 `_handlers.gameApi()` switch 新增一個分支

## 5. 遊戲核心邏輯（`app/utils/lightsOutEngine.ts`，不依賴 Vue）

- [ ] 5.1 型別與常數：`Cell`（`0 | 1` 或 `boolean`）／`Grid`／`GameStatus`（`'playing' | 'levelClear' | 'gameover' | 'paused'`），`LEVELS` 關卡資料表（棋盤大小、初始盤面、`moveLimit`，見 design.md Decision 2）、計分常數（`ClearBonus(level)`／`EfficiencyPool(level)`，見 design.md Decision 4），全部集中管理（呼應原始需求「所有關卡資料集中管理」）
- [ ] 5.2 邊界工具：`inBounds(grid, x, y)`，4 方向偏移量常數 `NEIGHBOR_OFFSETS = [[-1,0],[1,0],[0,-1],[0,1]]`（**務必是 4 方向，不可誤用 MINESWEEPER 的 8 方向雙層迴圈**，見 design.md Decision 1）
- [ ] 5.3 `toggleCell(grid, x, y)` 純函式：切換自己＋合法鄰格（透過 5.2 的偏移量與邊界檢查），超出棋盤的鄰居忽略
- [ ] 5.4 `isAllOff(grid)`：Win Detection 判定所有 Cell 是否皆為 OFF
- [ ] 5.5 關卡讀取：`levelConfig(level)`——依 level 從 `LEVELS` 讀取棋盤大小／初始盤面／`moveLimit`，超出表格長度時比照 BREAKOUT 的 `clampedIndex` + 延伸公式模式繼續推算（見 design.md Decision 2）
- [ ] 5.6 計分：`calcLevelScore(level, moves)` 回傳 `ClearBonus(level) + EfficiencyScore`（`EfficiencyScore = round(EfficiencyPool(level) / max(moves, 1))`，見 design.md Decision 4）
- [ ] 5.7 `LightsOutEngine` class：整合 5.1~5.6，提供 `reset()`、`toggle(x, y)`（回傳 `moved/won/gameOver` 等狀態變化）、`nextLevel()`、`getSnapshot()`（回傳 `grid`／`level`／`moves`／`moveLimit`／`score`／`status`）

## 6. 遊戲頁面與互動流程

- [ ] 6.1 `app/pages/game/lights-out.vue`：`reactive()` state 鏡像 engine snapshot，`_handlers`/`_actions`/`click` 三分法（比照 MINESWEEPER 慣例）
- [ ] 6.2 棋盤渲染：`flatCells` computed 攤平 + `v-for` + `grid-template-columns: repeat(size, var(--cell))`（比照 MINESWEEPER 慣例），ON/OFF 用純 CSS class 切換底色/發光效果，不使用外部圖片
- [ ] 6.3 點擊互動：`click.cell(x, y)` → 呼叫 `engine.toggle(x, y)` → 同步 `state`，`state.status !== 'playing'` 時停用棋盤點擊（比照 MINESWEEPER 的既有做法）
- [ ] 6.4 Move Counter／Level HUD：顯示 `LEVEL`／`MOVES / MOVE LIMIT`／`SCORE`
- [ ] 6.5 Win Detection／Next Level：全部 OFF 時短暫顯示 `LEVEL CLEAR` 訊息，延遲後呼叫 `engine.nextLevel()` 並同步 state（棋盤重建為下一關初始盤面，`moves` 歸零）
- [ ] 6.6 Game Over：`moves >= moveLimit` 且未全滅時顯示 `GAME OVER` overlay，呼叫 `useGameHistory().actions.record()`（`score` 為跨關累計值，`meta` 記錄 `levelReached`／`movesUsed`，見 design.md Decision 4）
- [ ] 6.7 Restart：完整重置 Level／Grid／Move Counter／Score／GameState，不殘留上一局資料
- [ ] 6.8 Pause（ESC/P）：`PAUSED` overlay，`[RESUME]`/`[RESTART]`/`[EXIT]`，暫停期間停用棋盤點擊（非 tick-driven，不需要額外處理計時器）
- [ ] 6.9 Keyboard：方向鍵移動一個游標高亮格（限制在棋盤範圍內），Space/Enter 觸發該格 `toggle()`，與滑鼠點擊共用同一支處理函式
- [ ] 6.10 Touch：點按即 `toggle()`，與滑鼠 `click` 共用同一個事件 handler，確認行動裝置點擊區域足夠大
- [ ] 6.11 掛載共用 `GameRateDialog` / `GameRuleDialog`，`accent-color` 採 `#adb5bd`（鋼灰色，不與現有 16 款遊戲的 glow 色碼撞色）

## 7. game-hall 入口

- [ ] 7.1 `app/pages/game-hall.vue`：`gameSlots` 新增 `{ id: 22, name: 'LIGHTS OUT', status: 'open', path: '/game/lights-out' }`
- [ ] 7.2 `app/config/gameSprites.ts`：`GAME_SPRITES` 新增一筆（`key: 'lightsOut'`, `icon: '💡'`, `anim: 'blink'`, `glow: '#adb5bd'`）
- [ ] 7.3 `app/components/GameHistoryDialog.vue`：`FILTERS`／`GAME_KEYS`／`GAME_NAME` 各新增一筆

## 8. OpenSpec 文件

- [ ] 8.1 `README.md` / `proposal.md` / `design.md` / `tasks.md` / `specs/game-history/spec.md`（本次變更文件本身）

## 9. 驗證

- [ ] 9.1 `npm run dev` 啟動後，實際在瀏覽器測試 Toggle：點擊任一格，確認自己與上下左右鄰格皆正確切換 ON/OFF，超出棋盤的鄰居不受影響
- [ ] 9.2 實測邊界情境：點擊四個角落與四個邊緣格，確認只切換棋盤範圍內存在的鄰格，沒有誤觸對角格
- [ ] 9.3 實測 Move Counter：每次點擊 `MOVES` 正確 +1，不論該次點擊是否讓盤面更接近全滅
- [ ] 9.4 實測 Win Detection：確認棋盤全部 Cell 變成 OFF 時正確判定過關並顯示 `LEVEL CLEAR`
- [ ] 9.5 實測 Next Level：過關後棋盤大小與/或 `moveLimit` 依 `LEVELS` 資料表正確變化，`moves` 歸零
- [ ] 9.6 實測 Game Over：故意用滿 `moveLimit` 仍未全滅，確認正確判定 Game Over 並停用棋盤互動
- [ ] 9.7 實測計分：確認單關分數 = `ClearBonus(level) + EfficiencyScore`，跨關正確累加，Game Over 時寫入的 `score` 為累計值
- [ ] 9.8 實測 Restart：確認完整重置，不殘留上一局的棋盤/關卡/步數/分數狀態
- [ ] 9.9 實測 Pause：ESC/P 觸發暫停，`[RESUME]`/`[RESTART]`/`[EXIT]` 行為正確，暫停中點擊棋盤無效
- [ ] 9.10 實測 Keyboard：方向鍵游標移動限制在棋盤範圍內，Space/Enter 正確觸發 Toggle
- [ ] 9.11 實測 Touch：行動裝置點按正確觸發 Toggle，與滑鼠點擊行為一致
- [ ] 9.12 確認不允許 Undo（畫面上沒有 Undo 按鈕/快捷鍵）
- [ ] 9.13 未登入：確認寫入 localStorage、重整頁面紀錄仍在
- [ ] 9.14 已登入：確認 server 端紀錄寫入、coin 依 `score × coinRate` 入帳、單局與每日上限機制正確
- [ ] 9.15 `GameHistoryDialog` 篩選 tab 能正確顯示 `LIGHTS OUT` 紀錄與統計
- [ ] 9.16 `game-hall.vue` 卡片正常顯示、可點擊進入 `/game/lights-out`
- [ ] 9.17 確認沒有 Console Error，不影響其他 16 款遊戲
- [ ] 9.18 `npx nuxt typecheck` 確認新增/修改檔案無型別錯誤
