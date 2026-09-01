## 1. Server 端服務層

- [ ] 1.1 新增 `server/services/game/retro/connect4.ts`：繼承 `RETRO_GAME_BASE`（`coinRate: 1`、`coinCapPerRun: 100`、`coinDailyCap: 100000`、`maxReasonableScore(): 100`——對齊 Decision 5/6 的計分公式理論上限，若 Open Questions 定案為固定值模型則常數不變，僅公式本身簡化）
- [ ] 1.2 `server/services/storage.ts`：遊戲初始化區塊新增 import 並 `new RetroConnect4Class()`

## 2. Server 端 API 路由

- [ ] 2.1 新增 `server/api/games/retro/connect4/history.get.ts`、`history.post.ts`、`history.delete.ts`（比照既有十六款遊戲樣板）
- [ ] 2.2 確認 `server/middleware/auth.ts` 的 `/api/games` 前綴已涵蓋新路由，不需修改

## 3. Client API 層

- [ ] 3.1 `app/services/api.ts`：`RetroGameKey` 擴充 `'connect4'`，`api.games.retro` 新增對應 3 個函式

## 4. Client 資料層

- [ ] 4.1 `app/composables/useGameHistory.ts`：`GAME_KEYS` 陣列與 `_handlers.gameApi()` switch 新增一個分支

## 5. 遊戲核心邏輯（`app/utils/connect4Engine.ts`，不依賴 Vue）

- [ ] 5.1 型別與常數：`Cell`（`'EMPTY' | 'PLAYER' | 'AI'`）／`Board`（`Cell[][]`）／`Phase`，`BOARD_ROWS = 6`／`BOARD_COLS = 7`，分數常數（`WIN_BASE`／`MAX_EFFICIENCY_BONUS`／`MIN_WINNING_MOVES`／`EFFICIENCY_STEP`／`DRAW_SCORE`，待 Open Questions 定案後套用實際數值，見 design.md Decision 5），AI delay 範圍常數（400~800ms），全部集中管理
- [ ] 5.2 Board 工具：`createEmptyBoard()`、`getNextOpenRow(board, col)`（由底列往頂列找第一個空格，欄滿回傳 `null`）、`isBoardFull(board)`
- [ ] 5.3 落子：`dropDisc(board, col, player)`——呼叫 `getNextOpenRow()` 找到落點 row，寫入該格，回傳落點座標（欄滿回傳 `null`，呼叫端不消耗回合）
- [ ] 5.4 Win Detection：`checkWinFromMove(board, row, col, player)`——單一純函式，從落子座標往 Horizontal／Vertical／Diagonal↘↖／Diagonal↙↗ 四軸雙向掃描，任一軸連續同色達 4 即回傳 `true`（見 design.md Decision 2）
- [ ] 5.5 試下判斷：`wouldWin(board, col, player)`——複製/模擬落子後呼叫 5.4 的 `checkWinFromMove()`，不修改實際 `board`，供 AI 決策使用（見 design.md Decision 3）
- [ ] 5.6 AI 決策：`chooseAiColumn(board)`——依序 (1) 對所有合法欄呼叫 `wouldWin(board, col, 'AI')` 找獲勝欄 (2) 對所有合法欄呼叫 `wouldWin(board, col, 'PLAYER')` 找阻擋欄 (3) 否則從合法欄中隨機選一欄，全程共用 5.4/5.5，不寫兩套規則
- [ ] 5.7 計分：依 design.md Decision 5 定案結果實作 `calculateScore(result, playerMovesUsed)`（`result: 'WIN' | 'DRAW' | 'LOSE'`）
- [ ] 5.8 `Connect4Engine` class：整合 5.1~5.7，提供 `reset()`、`getSnapshot()`（回傳棋盤快照＋回合狀態＋分數＋步數統計）

## 6. 遊戲頁面與互動流程

- [ ] 6.1 `app/pages/game/connect4.vue`：`reactive()` state 鏡像 engine snapshot，`_handlers`/`_actions`/`click` 三分法（比照 MINESWEEPER／BATTLESHIP 慣例）
- [ ] 6.2 棋盤渲染：`flatCells` computed 攤平 7×6 二維陣列 + `v-for` + `grid-template-columns: repeat(7, var(--cell))`（比照 MINESWEEPER 慣例）
- [ ] 6.3 Column Selection：點擊欄位（欄頂按鈕或整欄任一格）觸發落子，欄位已滿時該欄停用不可點擊，且不消耗回合
- [ ] 6.4 Turn UI：`state.phase` 驅動 HUD 顯示（`YOUR TURN`／`AI THINKING...`／已用步數）
- [ ] 6.5 AI 回合流程：`setTimeout(400~800ms 隨機)` 後才呼叫 `chooseAiColumn()`，callback 內檢查 `state.phase` 仍為 `AI_TURN` 才繼續（避免 Restart 後殘留 timeout 誤觸發）
- [ ] 6.6 重力掉落動畫：新落子格加上 CSS class 觸發 `transform`/`transition`，讓棋子從欄頂滑到落點格（見 design.md Decision 4），判定邏輯不等待動畫播放完成
- [ ] 6.7 Win 高亮：獲勝的 4 顆連線棋子加上高亮 class（比照既有遊戲的過關/連線高亮視覺模式）
- [ ] 6.8 Game Over：`YOU WIN`／`YOU LOSE`／`DRAW` overlay，呼叫 `useGameHistory().actions.record()`（`score` 依 design.md Decision 5/7 定案結果計算，`meta` 記錄 `movesUsed`）
- [ ] 6.9 Restart：完整重置 Board／Turn／Score／Timer／GameState，不殘留上一局資料
- [ ] 6.10 Pause（ESC/P）：`PAUSED` overlay，`[RESUME]`／`[RESTART]`／`[EXIT]`，暫停期間停用棋盤互動
- [ ] 6.11 掛載共用 `GameRateDialog` / `GameRuleDialog`，`accent-color` 採 `#e63946`（紅色，不與現有十六款遊戲撞色）

## 7. game-hall 入口

- [ ] 7.1 `app/pages/game-hall.vue`：`gameSlots` 新增 `{ id: 20, name: 'CONNECT 4', status: 'open', path: '/game/connect4' }`
- [ ] 7.2 `app/config/gameSprites.ts`：`GAME_SPRITES` 新增一筆（`key: 'connect4'`, `glow: '#e63946'`，圖示與 anim 待實作時挑選不與既有遊戲重複的組合）
- [ ] 7.3 `app/components/GameHistoryDialog.vue`：`FILTERS`／`GAME_KEYS`／`GAME_NAME` 各新增一筆

## 8. OpenSpec 文件

- [ ] 8.1 `proposal.md` / `design.md` / `tasks.md` / `specs/game-history/spec.md`（本次變更文件本身）

## 9. 驗證

- [ ] 9.1 `npm run dev` 啟動後，實際在瀏覽器測試落子流程：點擊欄位、棋子正確落到該欄最低空位、欄滿時不可再點擊
- [ ] 9.2 實測 Win Detection：分別以 Horizontal／Vertical／Diagonal↘↖／Diagonal↙↖ 四種連線方式驗證皆能正確判定獲勝
- [ ] 9.3 實測 Draw：棋盤填滿 42 格且無人連線時正確判定 Draw
- [ ] 9.4 實測 AI 優先獲勝：手動佈局出「AI 下一步可直接連成 4 子」的局面，確認 AI 選擇該欄
- [ ] 9.5 實測 AI 優先阻擋：手動佈局出「玩家下一步可直接連成 4 子」的局面，確認 AI 選擇阻擋該欄而非其他欄
- [ ] 9.6 實測 AI 隨機合法欄：無獲勝/阻擋機會時，確認 AI 只從未滿欄位中選擇，不會選到已滿的欄
- [ ] 9.7 實測 Turn 系統：`PLAYER_TURN → AI_TURN → PLAYER_TURN` 正確循環，AI 回合有明顯 400~800ms 延遲、不會瞬間完成
- [ ] 9.8 實測計分：依 Decision 5 定案結果，驗證 WIN／DRAW／LOSE 三種結局的分數計算符合公式
- [ ] 9.9 實測 Restart：確認完整重置，不殘留上一局的棋盤/步數/分數/回合狀態
- [ ] 9.10 實測 Pause：ESC/P 觸發暫停，`[RESUME]`/`[RESTART]`/`[EXIT]` 行為正確
- [ ] 9.11 未登入：確認寫入 localStorage、重整頁面紀錄仍在
- [ ] 9.12 已登入：確認 server 端紀錄寫入、coin 依 `score × coinRate` 入帳、單局與每日上限機制正確
- [ ] 9.13 `GameHistoryDialog` 篩選 tab 能正確顯示 `CONNECT 4` 紀錄與統計
- [ ] 9.14 `game-hall.vue` 卡片正常顯示、可點擊進入 `/game/connect4`
- [ ] 9.15 確認沒有 Console Error，不影響其他既有十六款遊戲
- [ ] 9.16 `npx nuxt typecheck` 確認新增/修改檔案無型別錯誤
