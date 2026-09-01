## 1. Server 端服務層

- [ ] 1.1 新增 `server/services/game/retro/battleship.ts`：繼承 `RETRO_GAME_BASE`（`coinRate: 0.06`、`coinCapPerRun: 130`、`coinDailyCap: 100000`、`maxReasonableScore(): 1729`——精確對齊勝利固定分數上限，見 design.md Decision 5／6）
- [ ] 1.2 `server/services/storage.ts`：遊戲初始化區塊新增 import 並 `new RetroBattleshipClass()`

## 2. Server 端 API 路由

- [ ] 2.1 新增 `server/api/games/retro/battleship/history.get.ts`、`history.post.ts`、`history.delete.ts`（比照既有十五款遊戲樣板）
- [ ] 2.2 確認 `server/middleware/auth.ts` 的 `/api/games` 前綴已涵蓋新路由，不需修改

## 3. Client API 層

- [ ] 3.1 `app/services/api.ts`：`RetroGameKey` 擴充 `'battleship'`，`api.games.retro` 新增對應 3 個函式

## 4. Client 資料層

- [ ] 4.1 `app/composables/useGameHistory.ts`：`GAME_KEYS` 陣列與 `_handlers.gameApi()` switch 新增一個分支

## 5. 遊戲核心邏輯（`app/utils/battleshipEngine.ts`，不依賴 Vue）

- [ ] 5.1 型別與常數：`Cell`／`Board`／`Ship`／`Orientation`／`GameState`，`SHIP_CONFIG`（5 種戰艦長度）、`BOARD_SIZE = 10`、分數常數（`HIT_SCORE = 33`／`SUNK_SCORE = 167`／`WIN_SCORE = 333`，見 design.md Decision 5）、AI delay 範圍常數，全部集中管理（需求第 51 點）
- [ ] 5.2 Board／座標工具：`createEmptyBoard()`、`coordToLabel(x,y)`／`labelToCoord(label)`
- [ ] 5.3 Placement：`validateShipPlacement(board, ship, position, orientation)`（僅檢查越界與重疊，允許相鄰，見 design.md Decision 3）、`placeShip()`
- [ ] 5.4 AI 佈局：`autoPlaceShips(board)`——`Choose Ship → Random Position → Random Orientation → validateShipPlacement → 合法則放置／不合法重試`，與玩家共用 5.3 的驗證函式
- [ ] 5.5 Attack：`attackCell(board, ships, x, y)` 回傳 `HIT`／`MISS`／`ALREADY_ATTACKED`／`SUNK`，玩家與 AI 共用同一支（需求第 59 點）；`checkSunk(ship)`、`checkWin(ships)`
- [ ] 5.6 敵方棋盤視角過濾：`getPlayerViewOfEnemyBoard(board, ships)`——未攻擊格隱藏 SHIP 狀態，已沉船的船顯示完整船身位置（見 design.md Decision 1）
- [ ] 5.7 AI 攻擊（MVP，Random）：`chooseAttackTarget(enemyBoardView)`——從所有 `EMPTY`／`SHIP`（即尚未攻擊）格中隨機選一格
- [ ] 5.8 `BattleshipEngine` class：整合 5.1~5.7，提供 `reset()`、`getSnapshot()`（回傳雙方棋盤快照＋船隻清單＋分數＋回合狀態）

## 6. 遊戲頁面與互動流程

- [ ] 6.1 `app/pages/game/battleship.vue`：`reactive()` state 鏡像 engine snapshot，`_handlers`/`_actions`/`click` 三分法（比照 MINESWEEPER 慣例）
- [ ] 6.2 雙棋盤渲染：己方海域／敵方海域各自 `flatCells` computed 攤平 + `v-for` + `grid-template-columns: repeat(10, var(--cell))`（比照 MINESWEEPER 慣例）
- [ ] 6.3 PLACEMENT UI：待放戰艦清單（點擊選取）、`[ROTATE]` 按鈕、棋盤 hover/點按顯示 preview（合法綠／非法紅）、點擊確認放置、5 艘放完顯示 `[READY]`（零拖曳，見 design.md Decision 2）
- [ ] 6.4 BATTLE UI：`state.phase` 驅動 HUD 顯示（YOUR TURN／AI THINKING...／ROUND N），敵方棋盤只在 `PLAYER_TURN` 且該格未攻擊時可點擊；`AI_TURN`/`AI_ATTACK` 期間兩塊棋盤皆停用互動（見 design.md Risks）
- [ ] 6.5 AI 回合流程：`setTimeout(500~1000ms 隨機)` 後才呼叫 `chooseAttackTarget()`，callback 內檢查 `state.phase` 仍為 `AI_TURN` 才繼續（避免 Restart 後殘留 timeout 誤觸發）
- [ ] 6.6 HIT／MISS／SUNK 視覺：HIT 顯示 `X`、MISS 顯示 `·`、SUNK 顯示短暫通知文字（如 `DESTROYER SUNK!`），不做爆炸/震動等特效動畫（Non-Goal，見 design.md）
- [ ] 6.7 Game Statistics HUD：SHOTS／HITS／MISS／ACCURACY／YOUR SHIPS／ENEMY SHIPS 剩餘艘數（比照需求第 46 點，與 `score` 計算脫鉤）
- [ ] 6.8 Game Over：`YOU WIN`／`YOU LOSE` overlay，呼叫 `useGameHistory().actions.record()`（`score` 依 design.md Decision 5 規則，`meta` 記錄 `shots`／`accuracy`／`rounds`）
- [ ] 6.9 Restart：完整重置 Board／Ships／Placement 狀態／Attack History／Turn／Score／Timer／GameState（需求第 50 點，不殘留上一局資料）
- [ ] 6.10 Pause（ESC／P）：`PAUSED` overlay，`[RESUME]`／`[RESTART]`／`[EXIT]`，暫停期間停用棋盤互動且不計入 Timer
- [ ] 6.11 掛載共用 `GameRateDialog` / `GameRuleDialog`，`accent-color` 採 `#3a86ff`（海軍藍，不與現有十五款遊戲撞色）

## 7. game-hall 入口

- [ ] 7.1 `app/pages/game-hall.vue`：`gameSlots` 新增 `{ id: 16, name: 'BATTLESHIP', status: 'open', path: '/game/battleship' }`
- [ ] 7.2 `app/config/gameSprites.ts`：`GAME_SPRITES` 新增一筆（`key: 'battleship'`, `icon: '🚢'`, `anim: 'drift'`, `glow: '#3a86ff'`）
- [ ] 7.3 `app/components/GameHistoryDialog.vue`：`FILTERS`／`GAME_KEYS`／`GAME_NAME` 各新增一筆

## 8. OpenSpec 文件

- [ ] 8.1 `proposal.md` / `design.md` / `tasks.md` / `specs/game-history/spec.md`（本次變更文件本身）

## 9. 驗證

- [ ] 9.1 `npm run dev` 啟動後，實際在瀏覽器測試佈局流程：選船／切換方向／預覽合法(綠)非法(紅)／確認放置／5 艘放完進入 READY，皆正常
- [ ] 9.2 實測佈局驗證：戰艦不能超出棋盤、不能與其他戰艦重疊，允許相鄰
- [ ] 9.3 實測 AI 佈局：AI 佈局全程不顯示給玩家，且合法（不超界、不重疊）
- [ ] 9.4 實測攻擊流程：HIT／MISS／SUNK 判定正確，已攻擊過的格子不可再選、不消耗回合
- [ ] 9.5 實測 Turn 系統：`PLAYER_TURN → AI_TURN → PLAYER_TURN` 正確循環，AI 回合有明顯 500~1000ms 延遲、不會瞬間完成
- [ ] 9.6 實測 AI 攻擊：AI 不會重複攻擊同一格，也不會卡住（每次都能在未攻擊格中選出合法目標）
- [ ] 9.7 實測勝負判定：所有敵方戰艦擊沉後正確顯示 `YOU WIN`，玩家戰艦全滅正確顯示 `YOU LOSE`
- [ ] 9.8 實測計分：確認任何一場勝利的最終分數皆為固定值 1729，落敗局分數為當下累積的 HIT/SUNK 加總
- [ ] 9.9 實測 Restart：確認完整重置，不殘留上一局的棋盤/船隻/分數/回合狀態
- [ ] 9.10 實測 Pause：ESC/P 觸發暫停，`[RESUME]`/`[RESTART]`/`[EXIT]` 行為正確
- [ ] 9.11 未登入：確認寫入 localStorage、重整頁面紀錄仍在
- [ ] 9.12 已登入：確認 server 端紀錄寫入、coin 依 `score × coinRate` 入帳、單局與每日上限機制正確
- [ ] 9.13 `GameHistoryDialog` 篩選 tab 能正確顯示 `BATTLESHIP` 紀錄與統計
- [ ] 9.14 `game-hall.vue` 卡片正常顯示、可點擊進入 `/game/battleship`
- [ ] 9.15 確認沒有 Console Error，不影響其他十五款遊戲
- [ ] 9.16 `npx nuxt typecheck` 確認新增/修改檔案無型別錯誤
